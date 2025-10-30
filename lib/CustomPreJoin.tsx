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
import { BackgroundProcessor, VirtualBackground } from '@livekit/track-processors';
import { getBlurConfig, getRecommendedBlurQuality, CustomSegmentationSettings } from './BlurConfig';
import { detectDeviceCapabilities } from './client-utils';
import { waitForProcessorWithFallback } from './videoProcessorUtils';
import { MediaPipeImageSegmenterProcessor } from './processors/MediaPipeImageSegmenter';
import { useProcessorLoading } from './ProcessorLoadingContext';

// Helper function to create a canvas with gradient for VirtualBackground
// Placed outside component to avoid recreation
const createGradientCanvas = (gradient: string): string => {
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Parse gradient string and create gradient
    const gradientObj = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    
    // Extract colors from gradient string (handles both hex and rgb formats)
    if (gradient.includes('linear-gradient')) {
      // Match hex colors like #fa709a
      const hexColors = gradient.match(/#[0-9a-fA-F]{6}/g);
      // Match rgb colors like rgb(250, 112, 154)
      const rgbColors = gradient.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/g);
      
      let colors: string[] = [];
      if (hexColors && hexColors.length >= 2) {
        colors = hexColors;
      } else if (rgbColors && rgbColors.length >= 2) {
        // Convert rgb() to usable format
        colors = rgbColors;
      }
      
      if (colors.length >= 2) {
        gradientObj.addColorStop(0, colors[0]);
        gradientObj.addColorStop(1, colors[1]);
      }
    }
    
    ctx.fillStyle = gradientObj;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  return canvas.toDataURL();
};

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
  
  // Settings panel state
  const [showSettings, setShowSettings] = React.useState(false);
  const [backgroundType, setBackgroundType] = React.useState(
    savedPrefs.backgroundType || 'blur'
  );
  const [backgroundPath, setBackgroundPath] = React.useState(
    savedPrefs.backgroundPath || ''
  );
  
  // Use shared processor loading context for privacy screen during room join
  const { setIsApplyingProcessor } = useProcessorLoading();

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
  // Start with isPreparingVideo=true if blur/effects are enabled (for privacy)
  const [isPreparingVideo, setIsPreparingVideo] = React.useState(() => {
    return backgroundType !== 'none'; // Hide video initially if effect is enabled
  });
  
  // Handle background effect changes
  const selectBackground = React.useCallback((type: string, path?: string) => {
    console.log('[CustomPreJoin] Changing background to:', type, path);
    
    // PRIVACY: Hide video immediately when switching to a blur/effect
    if (type !== 'none') {
      setIsPreparingVideo(true);
    } else {
      // Show video immediately when switching to 'none'
      setIsPreparingVideo(false);
    }
    
    // Stop current processor first
    if (videoTrack instanceof LocalVideoTrack && blurProcessorRef.current) {
      const mediaStreamTrack = videoTrack.mediaStreamTrack;
      if (mediaStreamTrack && mediaStreamTrack.readyState === 'live') {
        videoTrack.stopProcessor().catch(err => {
          console.warn('[CustomPreJoin] Error stopping processor during background change:', err);
        });
      }
    }
    
    // Reset the processed track ID so the effect can be reapplied
    processedTrackIdRef.current = null;
    
    // Update state
    setBackgroundType(type as any);
    if (path) {
      setBackgroundPath(path);
    }
    
    // Save to preferences
    saveUserPreferences({
      backgroundType: type as any,
      backgroundPath: path,
    });
  }, [videoTrack]);

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

  // Apply the saved background effect to preview track IMMEDIATELY before displaying
  React.useEffect(() => {
    // Track if this effect is still active
    let isEffectActive = true;
    
    const applyPreviewEffect = async () => {
      if (!videoTrack) {
        console.log('[CustomPreJoin] No videoTrack available, skipping effect application');
        return;
      }
      console.log('[CustomPreJoin] videoTrack available, checking if effect should be applied');
      
      // Prevent concurrent effect applications
      if (isApplyingBlurRef.current) {
        console.log('[CustomPreJoin] Already applying effect, skipping duplicate attempt');
        return;
      }
      
      // Apply the user's saved effect preference, or blur as default
      // Skip if user explicitly set backgroundType to 'none'
      if (backgroundType === 'none') {
        console.log('[CustomPreJoin] No effect requested, skipping');
        return;
      }
      
      if (videoTrack instanceof LocalVideoTrack) {
        // Get unique track identifier
        const mediaStreamTrack = videoTrack.mediaStreamTrack;
        if (!mediaStreamTrack) {
          console.warn('[CustomPreJoin] MediaStreamTrack is null, cannot apply blur');
          return;
        }
        
        const trackId = mediaStreamTrack.id;
        
        // Create a unique key combining track ID and effect settings
        const effectKey = `${trackId}-${backgroundType}-${backgroundPath}`;
        
        // Skip if already applied this exact effect to this specific track
        if (processedTrackIdRef.current === effectKey) {
          console.log('[CustomPreJoin] Effect already applied to track:', effectKey);
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
        await new Promise(resolve => setTimeout(resolve, 50));
        
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
          
          // Determine blur quality for both blur and virtual backgrounds
          const blurQuality = savedPrefs.blurQuality || 
            getRecommendedBlurQuality(detectDeviceCapabilities());
          
          // Check if user has custom segmentation settings
          const useCustom = savedPrefs.useCustomSegmentation || false;
          const customSettings = savedPrefs.customSegmentation || null;
          
          const config = getBlurConfig(blurQuality, useCustom ? customSettings : null);
          console.log('[CustomPreJoin] Applying', backgroundType, 'effect with quality:', blurQuality, 
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
          
          // Create processor based on background type
          if (backgroundType === 'blur') {
            // IMPORTANT: For preview, always use LiveKit default processor instead of MediaPipe
            // MediaPipe initialization takes too long (downloads 3MB WASM) and preview tracks
            // can close during initialization. The main video track in-room will use MediaPipe.
            console.log(`[CustomPreJoin] Using LiveKit BackgroundProcessor for preview (fast initialization)`);
            
            blurProcessorRef.current = BackgroundProcessor({
              blurRadius: config.blurRadius,
              segmenterOptions: {
                delegate: config.segmenterOptions.delegate,
              },
            });
            
            console.log(`[BlurConfig] ✅ PreJoin: ${config.blurRadius}px blur, ${config.segmenterOptions.delegate} processing`);
            
            // Note: MediaPipe and enhanced features will be used in the main room video track
            if (config.processorType === 'mediapipe-image') {
              console.log('[BlurConfig] ℹ️  MediaPipe will be used for in-room video (not preview)');
            }
          } else if (backgroundType === 'gradient' || backgroundType === 'image' || backgroundType === 'custom-image') {
            // Create virtual background processor
            // For gradient, convert CSS gradient to canvas data URL
            let imageSrc = backgroundPath;
            if (backgroundType === 'gradient' && backgroundPath) {
              imageSrc = createGradientCanvas(backgroundPath);
              console.log('[CustomPreJoin] Created gradient canvas for:', backgroundPath);
            }
            
            blurProcessorRef.current = VirtualBackground(imageSrc, {
              delegate: config.segmenterOptions.delegate,
            });
          }
          
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
          
          // Apply the processor to the track
          await videoTrack.setProcessor(blurProcessorRef.current);
          
          // Final check before marking as complete
          if (!isEffectActive) {
            console.log('[CustomPreJoin] Effect cancelled after setProcessor, cleanup needed');
            setIsPreparingVideo(false);
            return;
          }
          
          processedTrackIdRef.current = effectKey;
          console.log('[CustomPreJoin] Effect processor applied successfully');
          
          // Wait for processor to actually start outputting processed frames
          // This detects when the effect is actually ready instead of using fixed timeouts
          console.log('[CustomPreJoin] Detecting when', backgroundType, 'processor is ready...');
          try {
            await waitForProcessorWithFallback(videoTrack, 50);
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

    applyPreviewEffect();

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
  }, [videoTrack, backgroundType, backgroundPath]); // Reapply effect when track or background settings change

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

    // PRIVACY: Show global loading overlay while joining room if video effects are enabled
    // This prevents showing unblurred video during the transition from preview to room
    const currentPrefs2 = loadUserPreferences();
    if (videoEnabled && currentPrefs2.backgroundType && currentPrefs2.backgroundType !== 'none') {
      console.log('[CustomPreJoin] Setting global processor loading state for room join');
      setIsApplyingProcessor(true);
      // The CameraSettings component will clear this state once the processor is applied
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
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover', 
                transform: 'scaleX(-1)',
                // PRIVACY: Hide video until blur is ready (only if blur/effect is enabled)
                visibility: (isPreparingVideo && backgroundType !== 'none') ? 'hidden' : 'visible'
              }}
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
              <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500, textAlign: 'center', padding: '0 20px' }}>
                Securing your privacy...<br/>
                <span style={{ fontSize: '12px', opacity: 0.7 }}>Applying background effect</span>
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
          
          {/* Settings Button */}
          <button
            type="button"
            className="lk-button"
            onClick={() => setShowSettings(!showSettings)}
            aria-label="Video settings"
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2"/>
              <path d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.0113 9.77251C4.28059 9.5799 4.48572 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        
        {/* Settings Panel */}
        {showSettings && videoEnabled && (
          <div style={{
            padding: '16px',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}>
            <div style={{ marginBottom: '12px', fontWeight: '500', fontSize: '14px' }}>
              Background Effects
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {/* None */}
              <button
                type="button"
                onClick={() => selectBackground('none')}
                className="lk-button lk-button-visual"
                aria-label="No background effect"
                aria-pressed={backgroundType === 'none'}
                disabled={isPreparingVideo}
                style={{
                  border: backgroundType === 'none' ? '2px solid #3b82f6' : '2px solid rgba(255, 255, 255, 0.15)',
                  background: 'rgba(255, 255, 255, 0.08)',
                  minWidth: '60px',
                  minHeight: '60px',
                  padding: '0',
                  opacity: isPreparingVideo ? 0.5 : 1,
                }}
              >
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <line x1="4" y1="28" x2="28" y2="4" stroke="currentColor" strokeWidth="3"/>
                </svg>
              </button>
              
              {/* Blur */}
              <button
                type="button"
                onClick={() => selectBackground('blur')}
                className="lk-button lk-button-visual"
                aria-label="Blur background effect"
                aria-pressed={backgroundType === 'blur'}
                disabled={isPreparingVideo}
                style={{
                  border: backgroundType === 'blur' ? '2px solid #3b82f6' : '2px solid rgba(255, 255, 255, 0.15)',
                  background: 'rgba(255, 255, 255, 0.08)',
                  minWidth: '60px',
                  minHeight: '60px',
                  padding: '8px',
                  opacity: isPreparingVideo ? 0.5 : 1,
                }}
              >
                <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor" opacity="0.3">
                  <circle cx="10" cy="10" r="3"/>
                  <circle cx="22" cy="10" r="3"/>
                  <circle cx="10" cy="22" r="3"/>
                  <circle cx="22" cy="22" r="3"/>
                </svg>
              </button>
              
              {/* Gradient backgrounds */}
              {[
                { id: 'ocean', bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
                { id: 'sunset', bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
                { id: 'forest', bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
                { id: 'aurora', bg: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
              ].map((gradient) => (
                <button
                  key={gradient.id}
                  type="button"
                  onClick={() => selectBackground('gradient', gradient.bg)}
                  className="lk-button lk-button-visual"
                  aria-label={`${gradient.id} gradient background`}
                  aria-pressed={backgroundType === 'gradient' && backgroundPath === gradient.bg}
                  disabled={isPreparingVideo}
                  style={{
                    border: (backgroundType === 'gradient' && backgroundPath === gradient.bg) ? '2px solid #3b82f6' : '2px solid rgba(255, 255, 255, 0.15)',
                    background: gradient.bg,
                    minWidth: '60px',
                    minHeight: '60px',
                    padding: '0',
                    opacity: isPreparingVideo ? 0.5 : 1,
                  }}
                />
              ))}
              
              {/* Image backgrounds */}
              {[
                { id: 'nature', name: 'Nature', path: '/background-images/ali-kazal-tbw_KQE3Cbg-unsplash.jpg' },
                { id: 'office', name: 'Office', path: '/background-images/samantha-gades-BlIhVfXbi9s-unsplash.jpg' },
              ].map((image) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => selectBackground('image', image.path)}
                  className="lk-button lk-button-visual"
                  aria-label={`${image.name} background`}
                  aria-pressed={backgroundType === 'image' && backgroundPath === image.path}
                  disabled={isPreparingVideo}
                  style={{
                    border: (backgroundType === 'image' && backgroundPath === image.path) ? '2px solid #3b82f6' : '2px solid rgba(255, 255, 255, 0.15)',
                    backgroundImage: `url(${image.path})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    minWidth: '60px',
                    minHeight: '60px',
                    padding: '0',
                    opacity: isPreparingVideo ? 0.5 : 1,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Username Input */}
        <input
          type="text"
          placeholder="Enter your name"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="name"
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck="false"
          inputMode="text"
          enterKeyHint="done"
          style={{
            width: '100%',
            padding: '16px 18px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            background: 'rgba(255, 255, 255, 0.08)',
            color: 'white',
            fontSize: '16px', // 16px minimum prevents iOS zoom
            minHeight: '52px', // Larger touch target
            WebkitAppearance: 'none',
            appearance: 'none',
            touchAction: 'manipulation',
          }}
        />

        {/* Join Button */}
        <button
          type="submit"
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '10px',
            border: 'none',
            background: '#3b82f6',
            color: 'white',
            fontSize: '16px', // Prevent zoom on iOS
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            minHeight: '52px', // Larger touch target
            touchAction: 'manipulation',
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

