import React from 'react';
import { Track, LocalVideoTrack } from 'livekit-client';
import {
  TrackToggle,
  usePreviewDevice,
  usePreviewTracks,
  MediaDeviceMenu,
  VideoTrack,
  LocalUserChoices,
} from '@livekit/components-react';
import { loadUserPreferences, saveUserPreferences } from './userPreferences';
import { BackgroundProcessor } from '@livekit/track-processors';
import { getBlurConfig, getRecommendedBlurQuality, CustomSegmentationSettings } from './BlurConfig';
import { detectDeviceCapabilities } from './client-utils';
import { waitForProcessorWithFallback } from './videoProcessorUtils';

export interface CustomPreJoinProps {
  defaults?: Partial<LocalUserChoices>;
  onSubmit?: (values: LocalUserChoices) => void;
  onValidate?: (values: LocalUserChoices) => boolean;
  onError?: (error: Error) => void;
}

export function CustomPreJoin({
  defaults,
  onSubmit,
  onValidate,
  onError,
}: CustomPreJoinProps) {
  // Load saved preferences
  const savedPrefs = React.useMemo(() => loadUserPreferences(), []);
  
  const [username, setUsername] = React.useState(
    defaults?.username ?? savedPrefs.username ?? ''
  );
  const [videoEnabled, setVideoEnabled] = React.useState(
    defaults?.videoEnabled ?? savedPrefs.videoEnabled ?? true
  );
  const [audioEnabled, setAudioEnabled] = React.useState(
    defaults?.audioEnabled ?? savedPrefs.audioEnabled ?? true
  );

  // Validate that saved devices are still available
  const [validatedDeviceIds, setValidatedDeviceIds] = React.useState<{
    video?: string;
    audio?: string;
  } | null>(null); // null = validation in progress

  // Validate devices on mount - MUST complete before creating tracks
  React.useEffect(() => {
    const validateDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        const audioDevices = devices.filter(d => d.kind === 'audioinput');
        
        let videoIdValid = !savedPrefs.videoDeviceId;
        let audioIdValid = !savedPrefs.audioDeviceId;
        
        if (savedPrefs.videoDeviceId) {
          videoIdValid = videoDevices.some(d => d.deviceId === savedPrefs.videoDeviceId);
          if (!videoIdValid) {
            console.log('[CustomPreJoin] Saved video device not found, will use default');
            saveUserPreferences({ videoDeviceId: undefined });
          }
        }
        
        if (savedPrefs.audioDeviceId) {
          audioIdValid = audioDevices.some(d => d.deviceId === savedPrefs.audioDeviceId);
          if (!audioIdValid) {
            console.log('[CustomPreJoin] Saved audio device not found, will use default');
            saveUserPreferences({ audioDeviceId: undefined });
          }
        }
        
        setValidatedDeviceIds({
          video: videoIdValid ? savedPrefs.videoDeviceId : undefined,
          audio: audioIdValid ? savedPrefs.audioDeviceId : undefined,
        });
        console.log('[CustomPreJoin] Device validation complete');
      } catch (error) {
        console.error('[CustomPreJoin] Error validating devices:', error);
        // Clear invalid devices
        setValidatedDeviceIds({ video: undefined, audio: undefined });
      }
    };
    
    validateDevices();
  }, [savedPrefs.audioDeviceId, savedPrefs.videoDeviceId]);

  // Create stable track options that don't change when validatedDeviceIds object reference changes
  // CRITICAL: Only recreate tracks when actual device IDs or enabled state changes
  const trackOptions = React.useMemo(() => {
    // Use string values to avoid object reference issues
    const audioId = validatedDeviceIds?.audio || '';
    const videoId = validatedDeviceIds?.video || '';
    
    return {
      audio: audioEnabled ? (audioId ? { deviceId: audioId } : true) : false,
      video: videoEnabled ? (videoId ? { deviceId: videoId } : true) : false,
    };
  }, [
    validatedDeviceIds?.audio, 
    validatedDeviceIds?.video, 
    audioEnabled, 
    videoEnabled
  ]);

  const tracks = usePreviewTracks(trackOptions, onError);

  React.useEffect(() => {
    console.log('[CustomPreJoin] Tracks updated:', tracks?.length, 'tracks', 
                tracks?.map(t => ({ kind: t.kind, id: t.mediaStreamTrack?.id })));
  }, [tracks]);

  const videoEl = React.useRef<HTMLVideoElement>(null);
  const videoTrack = tracks?.filter((t) => t.kind === Track.Kind.Video)[0];
  
  React.useEffect(() => {
    console.log('[CustomPreJoin] VideoTrack updated:', videoTrack ? 'available' : 'null', 
                videoTrack?.mediaStreamTrack?.id);
  }, [videoTrack]);
  const blurProcessorRef = React.useRef<any>(null);
  const processedTrackIdRef = React.useRef<string | null>(null);
  const isApplyingBlurRef = React.useRef(false);
  const [isPreparingVideo, setIsPreparingVideo] = React.useState(false);

  // Initialize and save default settings on first mount (preview stage)
  // This ensures first-time users have blur settings saved to localStorage
  const hasInitializedRef = React.useRef(false);
  React.useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      
      // Check if this is first time (no saved preferences)
      const stored = typeof window !== 'undefined' ? localStorage.getItem('livekit-user-preferences') : null;
      if (!stored) {
        // First time - save all default settings including blur
        const prefs = loadUserPreferences();
        saveUserPreferences({
          backgroundType: prefs.backgroundType,
          backgroundPath: prefs.backgroundPath,
          blurQuality: prefs.blurQuality,
          useCustomSegmentation: prefs.useCustomSegmentation,
          customSegmentation: prefs.customSegmentation,
          videoEnabled: prefs.videoEnabled,
          audioEnabled: prefs.audioEnabled,
          noiseFilterEnabled: prefs.noiseFilterEnabled,
        });
        console.log('[CustomPreJoin] First visit - saved default preferences including blur:', prefs);
      }
    }
  }, []);

  // Apply blur to preview track IMMEDIATELY before displaying
  React.useEffect(() => {
    // Track if this effect is still active
    let isEffectActive = true;
    
    const applyPreviewBlur = async () => {
      if (!videoTrack) {
        console.log('[CustomPreJoin] No videoTrack available, skipping effect application');
        return;
      }
      console.log('[CustomPreJoin] videoTrack available, checking if effect should be applied');
      
      // Prevent concurrent blur applications
      if (isApplyingBlurRef.current) {
        console.log('[CustomPreJoin] Already applying blur, skipping duplicate attempt');
        return;
      }
      
      // PreJoin always applies blur as a sensible default for privacy
      // The actual user preference (blur/image/gradient/etc) will be applied by CameraSettings after joining
      // We only skip if the user explicitly set backgroundType to 'none'
      const backgroundType = savedPrefs.backgroundType || 'blur';
      
      if (backgroundType !== 'none' && videoTrack instanceof LocalVideoTrack) {
        // Get unique track identifier
        const mediaStreamTrack = videoTrack.mediaStreamTrack;
        if (!mediaStreamTrack) {
          console.warn('[CustomPreJoin] MediaStreamTrack is null, cannot apply blur');
          return;
        }
        
        const trackId = mediaStreamTrack.id;
        
        // Skip if already applied blur to this specific track
        if (processedTrackIdRef.current === trackId) {
          console.log('[CustomPreJoin] Blur already applied to track:', trackId);
          return;
        }
        
        // Check track state before we start
        if (mediaStreamTrack.readyState !== 'live') {
          console.warn('[CustomPreJoin] MediaStreamTrack is not live (state:', mediaStreamTrack.readyState, '), skipping blur');
          return;
        }
        
        // Wait a brief moment for track to stabilize after creation
        // This prevents applying blur to a track that's still initializing
        console.log('[CustomPreJoin] Waiting for track to stabilize:', trackId);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check if effect is still active after wait
        if (!isEffectActive) {
          console.log('[CustomPreJoin] Effect cancelled during stabilization wait');
          return;
        }
        
        // Re-check track state after stabilization wait
        if (mediaStreamTrack.readyState !== 'live') {
          console.warn('[CustomPreJoin] Track no longer live after stabilization wait');
          return;
        }
        
        isApplyingBlurRef.current = true;
        console.log('[CustomPreJoin] Starting blur application for track:', trackId);
        
        try {
          // Set preparing state to show loading overlay
          setIsPreparingVideo(true);
          
          // IMPORTANT: Do NOT mute preview tracks - it can cause the MediaStreamTrack to end
          // Instead, apply the processor directly while the track is live
          // The processor initialization happens fast enough that no unblurred frames are sent
          console.log('[CustomPreJoin] Applying processor directly to live track (no mute needed for preview)');
          
          // Determine blur quality
          const blurQuality = savedPrefs.blurQuality || 
            getRecommendedBlurQuality(detectDeviceCapabilities());
          
          // Check if user has custom segmentation settings
          const useCustom = savedPrefs.useCustomSegmentation || false;
          const customSettings = savedPrefs.customSegmentation || null;
          
          const config = getBlurConfig(blurQuality, useCustom ? customSettings : null);
          console.log('[CustomPreJoin] Applying blur preview (saved preference:', backgroundType, ') with quality:', blurQuality, 
                      useCustom ? '(custom settings)' : '');
          
          // Suppress MediaPipe initialization warnings
          // MediaPipe logs benign OpenGL warnings during WebGL context initialization
          const originalWarn = console.warn;
          console.warn = (...args: any[]) => {
            const message = args.join(' ');
            // Filter out MediaPipe OpenGL warnings
            if (message.includes('OpenGL error checking') || 
                message.includes('gl_context.cc')) {
              return; // Suppress this specific warning
            }
            originalWarn.apply(console, args);
          };
          
          // Verify track is still valid before creating processor
          const currentMediaStreamTrack = videoTrack.mediaStreamTrack;
          const currentReadyState = currentMediaStreamTrack?.readyState;
          if (!isEffectActive || currentReadyState !== 'live') {
            console.log('[CustomPreJoin] Track no longer valid before processor creation. isEffectActive:', isEffectActive, 'readyState:', currentReadyState, 'trackId:', currentMediaStreamTrack?.id);
            console.warn = originalWarn;
            setIsPreparingVideo(false);
            return;
          }
          
          // Create and apply blur processor
          blurProcessorRef.current = BackgroundProcessor({
            blurRadius: config.blurRadius,
            segmenterOptions: {
              delegate: config.segmenterOptions.delegate,
            },
          }, 'background-blur');
          
          // Restore console.warn after a delay to catch initialization warnings
          setTimeout(() => {
            console.warn = originalWarn;
          }, 1000);
          
          // CRITICAL: Check if effect is still active and track is still live
          if (!isEffectActive) {
            console.log('[CustomPreJoin] Effect cancelled during processor creation, aborting');
            setIsPreparingVideo(false);
            return;
          }
          
          const postProcessorMediaStreamTrack = videoTrack.mediaStreamTrack;
          if (!postProcessorMediaStreamTrack || postProcessorMediaStreamTrack.readyState !== 'live') {
            console.warn('[CustomPreJoin] Track ended during processor creation, aborting');
            setIsPreparingVideo(false);
            return;
          }
          
          // Apply the blur processor to the track
          await videoTrack.setProcessor(blurProcessorRef.current);
          
          // Final check before marking as complete
          if (!isEffectActive) {
            console.log('[CustomPreJoin] Effect cancelled after setProcessor, cleanup needed');
            setIsPreparingVideo(false);
            return;
          }
          
          processedTrackIdRef.current = trackId;
          console.log('[CustomPreJoin] Blur processor applied successfully');
          
          // Wait for processor to actually start outputting processed frames
          // This detects when the blur is actually ready instead of using fixed timeouts
          console.log('[CustomPreJoin] Detecting when blur processor is ready...');
          try {
            await waitForProcessorWithFallback(videoTrack, 100);
          } catch (waitError) {
            console.warn('[CustomPreJoin] Error waiting for processor ready, continuing anyway:', waitError);
          }
          
          // Check one more time before finalizing
          if (!isEffectActive) {
            console.log('[CustomPreJoin] Effect cancelled during processor initialization');
            setIsPreparingVideo(false);
            return;
          }
          
          // Mark video as ready to show - remove loading overlay
          setIsPreparingVideo(false);
          console.log('[CustomPreJoin] Blur is ready and video is now visible with effect applied');
        } catch (error) {
          // Always restore video state on error
          setIsPreparingVideo(false);
          if (videoTrack instanceof LocalVideoTrack && videoTrack.isMuted) {
            videoTrack.unmute().catch(() => {});
          }
          
          // Handle specific error cases
          if (error instanceof DOMException && error.name === 'InvalidStateError') {
            console.warn('[CustomPreJoin] Stream closed while applying blur to preview:', error.message);
          } else if (error instanceof TypeError && error.message.includes('track cannot be ended')) {
            console.warn('[CustomPreJoin] Track ended before processor could be applied. This can happen during device changes.');
            console.warn('[CustomPreJoin] Video will play without blur. Try refreshing or the effect will apply on next load.');
          } else {
            console.error('[CustomPreJoin] Error applying blur to preview:', error);
          }
        } finally {
          // Always clear the applying flag
          isApplyingBlurRef.current = false;
        }
      } else {
        // No blur needed, video is ready immediately
        setIsPreparingVideo(false);
      }
    };

    applyPreviewBlur();

    return () => {
      // Mark effect as inactive to cancel any ongoing operations
      isEffectActive = false;
      
      // Cleanup runs when track changes - stop processor on OLD track
      if (videoTrack instanceof LocalVideoTrack && blurProcessorRef.current) {
        const mediaStreamTrack = videoTrack.mediaStreamTrack;
        if (mediaStreamTrack && mediaStreamTrack.readyState === 'live') {
          videoTrack.stopProcessor().catch(err => {
            if (err instanceof DOMException && err.name === 'InvalidStateError') {
              console.warn('[CustomPreJoin] Stream closed while stopping preview processor');
            } else {
              console.warn('[CustomPreJoin] Error stopping preview processor:', err);
            }
          });
        }
      }
      // Reset flags AND clear processed track ID so blur can be applied to NEW track
      processedTrackIdRef.current = null;
      isApplyingBlurRef.current = false;
      setIsPreparingVideo(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoTrack]); // Only depend on videoTrack - apply blur once per track with saved preferences

  React.useEffect(() => {
    if (videoEl.current && videoTrack) {
      videoTrack.attach(videoEl.current);
    }

    return () => {
      videoTrack?.detach();
    };
  }, [videoTrack]);

  // Save video/audio toggle preferences in real-time
  React.useEffect(() => {
    saveUserPreferences({ videoEnabled, audioEnabled });
  }, [videoEnabled, audioEnabled]);

  // Save device changes in real-time
  React.useEffect(() => {
    if (tracks) {
      const videoDeviceId = tracks.find((t) => t.kind === Track.Kind.Video)?.mediaStreamTrack.getSettings().deviceId;
      const audioDeviceId = tracks.find((t) => t.kind === Track.Kind.Audio)?.mediaStreamTrack.getSettings().deviceId;
      
      if (videoDeviceId || audioDeviceId) {
        saveUserPreferences({
          videoDeviceId,
          audioDeviceId,
        });
      }
    }
  }, [tracks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const videoDeviceId = tracks?.find((t) => t.kind === Track.Kind.Video)?.mediaStreamTrack.getSettings().deviceId;
    const audioDeviceId = tracks?.find((t) => t.kind === Track.Kind.Audio)?.mediaStreamTrack.getSettings().deviceId;
    
    const values: LocalUserChoices = {
      username,
      videoEnabled,
      audioEnabled,
      videoDeviceId,
      audioDeviceId,
    };

    if (onValidate && !onValidate(values)) {
      return;
    }

    // Save ALL preferences when user joins, including background settings
    // This ensures first-time users have their default blur settings saved
    const currentPrefs = loadUserPreferences();
    saveUserPreferences({
      username,
      videoEnabled,
      audioEnabled,
      videoDeviceId,
      audioDeviceId,
      // Preserve existing background settings (including defaults like blur)
      backgroundType: currentPrefs.backgroundType,
      backgroundPath: currentPrefs.backgroundPath,
      blurQuality: currentPrefs.blurQuality,
      useCustomSegmentation: currentPrefs.useCustomSegmentation,
      customSegmentation: currentPrefs.customSegmentation,
      noiseFilterEnabled: currentPrefs.noiseFilterEnabled,
    });
    
    console.log('[CustomPreJoin] Saved complete user preferences:', currentPrefs);

    // Stop the blur processor on preview track before joining
    // This allows the preview track to be properly disposed
    // The blur will be reapplied by CameraSettings when the room track is created
    if (videoTrack instanceof LocalVideoTrack && blurProcessorRef.current) {
      try {
        await videoTrack.stopProcessor();
        console.log('[CustomPreJoin] Stopped preview blur processor before joining');
      } catch (err) {
        console.warn('[CustomPreJoin] Error stopping preview processor:', err);
      }
    }

    onSubmit?.(values);
  };

  return (
    <div className="lk-prejoin" style={{ maxWidth: '500px', width: '100%' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Video Preview */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#1a1a1a', borderRadius: '12px', overflow: 'hidden' }}>
          {videoEnabled && videoTrack ? (
            <video
              ref={videoEl}
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
              autoPlay
              playsInline
              muted
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' }}>
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="8" r="4" fill="currentColor" opacity="0.3" />
                <path d="M4 20c0-4 3-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" opacity="0.3" />
              </svg>
            </div>
          )}
          
          {/* Loading overlay while preparing blur effect - PRIVACY PROTECTION */}
          {isPreparingVideo && videoEnabled && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: '#1a1a1a',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              zIndex: 10,
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                border: '3px solid rgba(255, 255, 255, 0.1)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
              <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                Applying blur effect...
              </div>
              <style>{`
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          )}
        </div>

        {/* Device Controls */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          {/* Microphone */}
          <div className="lk-button-group">
            <button
              type="button"
              className="lk-button"
              onClick={() => setAudioEnabled(!audioEnabled)}
              aria-label="Toggle microphone"
              data-lk-source="microphone"
              data-lk-enabled={audioEnabled}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {audioEnabled ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="9" y="2" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="2"/>
                  <path d="M5 10V12C5 15.866 8.134 19 12 19C15.866 19 19 15.866 19 12V10M12 19V22M8 22H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="9" y="2" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="2"/>
                  <path d="M5 10V12C5 15.866 8.134 19 12 19C15.866 19 19 15.866 19 12V10M12 19V22M8 22H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 2L22 22" stroke="red" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              )}
            </button>
            <div className="lk-button-group-menu">
              <MediaDeviceMenu kind="audioinput">
                <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </MediaDeviceMenu>
            </div>
          </div>

          {/* Camera */}
          <div className="lk-button-group">
            <button
              type="button"
              className="lk-button"
              onClick={() => setVideoEnabled(!videoEnabled)}
              aria-label="Toggle camera"
              data-lk-source="camera"
              data-lk-enabled={videoEnabled}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {videoEnabled ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <path d="M18 10L22 7V17L18 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <path d="M18 10L22 7V17L18 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 2L22 22" stroke="red" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              )}
            </button>
            <div className="lk-button-group-menu">
              <MediaDeviceMenu kind="videoinput">
                <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </MediaDeviceMenu>
            </div>
          </div>
        </div>

        {/* Username Input */}
        <input
          type="text"
          placeholder="Enter your name"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            background: 'rgba(255, 255, 255, 0.08)',
            color: 'white',
            fontSize: '15px',
          }}
        />

        {/* Join Button */}
        <button
          type="submit"
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '10px',
            border: 'none',
            background: '#3b82f6',
            color: 'white',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 21C4.45 21 3.979 20.804 3.587 20.412C3.195 20.02 2.99933 19.5493 3 19V5C3 4.45 3.196 3.979 3.588 3.587C3.98 3.195 4.45067 2.99933 5 3H11V5H5V19H11V21H5ZM16 17L14.625 15.55L17.175 13H9V11H17.175L14.625 8.45L16 7L21 12L16 17Z" fill="currentColor"/>
          </svg>
          Join Room
        </button>
      </form>
    </div>
  );
}

