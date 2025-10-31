import React from 'react';
import {
  MediaDeviceMenu,
  TrackReference,
  TrackToggle,
  useLocalParticipant,
  VideoTrack,
} from '@livekit/components-react';
import { BackgroundBlur, BackgroundProcessor, VirtualBackground, ProcessorWrapper } from '@livekit/track-processors';
import { isLocalTrack, LocalTrackPublication, Track, ParticipantEvent, LocalVideoTrack } from 'livekit-client';
import { detectDeviceCapabilities } from './client-utils';
import { getBlurConfig, getRecommendedBlurQuality, BlurQuality } from './BlurConfig';
import { loadUserPreferences, saveUserPreferences } from './userPreferences';
import {
  saveCustomBackground,
  getAllCustomBackgrounds,
  deleteCustomBackground,
  getTotalStorageUsed,
  formatBytes,
  CustomBackground,
} from './customBackgrounds';
import { waitForProcessorWithFallback } from './videoProcessorUtils';
import { useProcessorLoading } from './ProcessorLoadingContext';
import { MediaPipeImageSegmenterProcessor } from './processors/MediaPipeImageSegmenter';
import MediaPipeBlurTransformer from './processors/MediaPipeBlurTransformer';

// Background image paths (using public URLs to avoid Turbopack static import issues)
const BACKGROUND_IMAGES = [
  { name: 'Desk', path: '/background-images/samantha-gades-BlIhVfXbi9s-unsplash.jpg' },
  { name: 'Nature', path: '/background-images/ali-kazal-tbw_KQE3Cbg-unsplash.jpg' },
];

// Gradient backgrounds - lightweight and modern
const GRADIENT_BACKGROUNDS = [
  {
    name: 'Ocean',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  {
    name: 'Sunset',
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  },
  {
    name: 'Forest',
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  },
  {
    name: 'Aurora',
    gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  },
  {
    name: 'Twilight',
    gradient: 'linear-gradient(135deg, #434343 0%, #000000 100%)',
  },
  {
    name: 'Galaxy',
    gradient: 'linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%)',
  },
];

// Background options
type BackgroundType = 'none' | 'blur' | 'image' | 'gradient' | 'custom-video' | 'custom-image';

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
    
    // Extract colors from gradient string (simplified parser)
    if (gradient.includes('linear-gradient')) {
      const colors = gradient.match(/#[0-9a-fA-F]{6}/g);
      if (colors && colors.length >= 2) {
        gradientObj.addColorStop(0, colors[0]);
        gradientObj.addColorStop(1, colors[1]);
      }
    }
    
    ctx.fillStyle = gradientObj;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  return canvas.toDataURL();
};

export function CameraSettings() {
  const { cameraTrack, localParticipant } = useLocalParticipant();
  
  // Custom backgrounds state
  const [customBackgrounds, setCustomBackgrounds] = React.useState<CustomBackground[]>([]);
  const [storageUsed, setStorageUsed] = React.useState<number>(0);
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  // Use shared loading state from context to show overlay in room
  const { isApplyingProcessor, setIsApplyingProcessor } = useProcessorLoading();
  const isApplyingProcessorRef = React.useRef(false);

  // Track blob URLs to prevent memory leaks
  const activeBlobUrlsRef = React.useRef<Set<string>>(new Set());

  // Helper function to revoke blob URLs and prevent memory leaks
  const revokeBlobUrls = React.useCallback(() => {
    activeBlobUrlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
        console.log('[CameraSettings] Revoked blob URL:', url.substring(0, 50) + '...');
      } catch (error) {
        console.warn('[CameraSettings] Error revoking blob URL:', error);
      }
    });
    activeBlobUrlsRef.current.clear();
  }, []);

  // Track console.warn override timeout to prevent memory leaks
  const consoleWarnTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const originalConsoleWarnRef = React.useRef<typeof console.warn>(console.warn);

  // Helper function to suppress MediaPipe warnings with proper cleanup
  const suppressMediaPipeWarnings = React.useCallback(() => {
    // Clear any existing timeout
    if (consoleWarnTimeoutRef.current) {
      clearTimeout(consoleWarnTimeoutRef.current);
      consoleWarnTimeoutRef.current = null;
    }

    // Store the current console.warn
    const currentWarn = console.warn;

    // Override console.warn to filter MediaPipe warnings
    console.warn = (...args: any[]) => {
      const message = args.join(' ');
      // Filter out MediaPipe OpenGL warnings
      if (message.includes('OpenGL error checking') || message.includes('gl_context.cc')) {
        return; // Suppress this specific warning
      }
      currentWarn.apply(console, args);
    };

    // Return a cleanup function that restores console.warn
    return () => {
      // Clear the timeout if it exists
      if (consoleWarnTimeoutRef.current) {
        clearTimeout(consoleWarnTimeoutRef.current);
        consoleWarnTimeoutRef.current = null;
      }
      // Restore console.warn immediately
      console.warn = currentWarn;
    };
  }, []);

  // Initialize from saved preferences - BLUR ENABLED BY DEFAULT
  const [backgroundType, setBackgroundType] = React.useState<BackgroundType>(() => {
    if (typeof window === 'undefined') return 'blur';
    
    const prefs = loadUserPreferences();
    console.log('[CameraSettings] Loaded preferences:', prefs);
    
    // Return saved preference or default to 'blur'
    return prefs.backgroundType || 'blur';
  });

  const [virtualBackgroundImagePath, setVirtualBackgroundImagePath] = React.useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    
    const prefs = loadUserPreferences();
    return prefs.backgroundPath || null;
  });
  
  // Custom background ID for tracking which custom background is selected
  const [selectedCustomBgId, setSelectedCustomBgId] = React.useState<string | null>(null);

  // Reapply trigger for forcing effect reapplication (e.g., on orientation change)
  // Incrementing this value forces the effect to be recreated with fresh state
  const [reapplyTrigger, setReapplyTrigger] = React.useState<number>(0);

  // Load custom backgrounds on mount and restore selection
  const loadCustomBackgrounds = React.useCallback(async () => {
    try {
      const backgrounds = await getAllCustomBackgrounds();
      setCustomBackgrounds(backgrounds);
      
      const storage = await getTotalStorageUsed();
      setStorageUsed(storage);
      
      console.log('[CameraSettings] Loaded custom backgrounds:', backgrounds.length);
      
      // Restore custom background selection if saved
      const prefs = loadUserPreferences();
      if ((prefs.backgroundType === 'custom-video' || prefs.backgroundType === 'custom-image') && prefs.backgroundPath) {
        // Check if the custom background still exists
        const customBgExists = backgrounds.some(bg => bg.id === prefs.backgroundPath);
        if (customBgExists) {
          setSelectedCustomBgId(prefs.backgroundPath);
          console.log('[CameraSettings] Restored custom background:', prefs.backgroundPath);
        } else {
          // Custom background was deleted, fallback to blur
          console.warn('[CameraSettings] Saved custom background not found, falling back to blur');
          selectBackground('blur');
        }
      }
    } catch (error) {
      console.error('Failed to load custom backgrounds:', error);
    }
  }, []);
  
  React.useEffect(() => {
    loadCustomBackgrounds();
  }, [loadCustomBackgrounds]);
  
  // Detect device capabilities and determine recommended blur quality
  const [blurQuality, setBlurQuality] = React.useState<BlurQuality>(() => {
    if (typeof window === 'undefined') return 'medium';
    
    const prefs = loadUserPreferences();
    
    // Use saved blur quality if available
    if (prefs.blurQuality && ['low', 'medium', 'high', 'ultra'].includes(prefs.blurQuality)) {
      return prefs.blurQuality;
    }
    
    // Auto-detect based on device capabilities
    const capabilities = detectDeviceCapabilities();
    const recommended = getRecommendedBlurQuality(capabilities);
    console.log('[BlurConfig] Device capabilities:', capabilities);
    console.log('[BlurConfig] Recommended blur quality:', recommended);
    return recommended;
  });

  // Track the currently applied processor configuration to avoid reapplying the same one
  const currentProcessorRef = React.useRef<{
    type: BackgroundType;
    path: string | null;
    quality: BlurQuality | null;
    customSettings: string | null; // JSON stringified custom settings for comparison
    reapplyTrigger?: number; // Track reapply trigger to force recreation on orientation changes
  }>({ type: 'none', path: null, quality: null, customSettings: null, reapplyTrigger: 0 });

  const camTrackRef: TrackReference | undefined = React.useMemo(() => {
    return cameraTrack
      ? { participant: localParticipant, publication: cameraTrack, source: Track.Source.Camera }
      : undefined;
  }, [localParticipant, cameraTrack]);

  // Track custom segmentation settings
  const [useCustomSegmentation, setUseCustomSegmentation] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const prefs = loadUserPreferences();
    return prefs.useCustomSegmentation || false;
  });

  const [customSegmentation, setCustomSegmentation] = React.useState<any>(() => {
    if (typeof window === 'undefined') return null;
    const prefs = loadUserPreferences();
    return prefs.customSegmentation || null;
  });

  // Initialize and save default settings on first mount
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
        console.log('[CameraSettings] First visit - saved default preferences including blur:', prefs);
      }
    }
  }, []);

  // Expose blur quality and custom segmentation setters for SettingsMenu
  React.useEffect(() => {
    window.__setBlurQuality = (quality: BlurQuality) => {
      setBlurQuality(quality);
      saveUserPreferences({ blurQuality: quality });
      console.log('[BlurConfig] Blur quality changed to:', quality);
    };
    window.__getBlurQuality = () => blurQuality;
    
    window.__setUseCustomSegmentation = (use: boolean) => {
      setUseCustomSegmentation(use);
      saveUserPreferences({ useCustomSegmentation: use });
      console.log('[BlurConfig] Use custom segmentation:', use);
    };
    window.__getUseCustomSegmentation = () => useCustomSegmentation;
    
    window.__setCustomSegmentation = (settings: any) => {
      setCustomSegmentation(settings);
      saveUserPreferences({ customSegmentation: settings });
      console.log('[BlurConfig] Custom segmentation updated:', settings);
    };
    window.__getCustomSegmentation = () => customSegmentation;
    
    return () => {
      delete window.__setBlurQuality;
      delete window.__getBlurQuality;
      delete window.__setUseCustomSegmentation;
      delete window.__getUseCustomSegmentation;
      delete window.__setCustomSegmentation;
      delete window.__getCustomSegmentation;
    };
  }, [blurQuality, useCustomSegmentation, customSegmentation]);

  const selectBackground = (type: BackgroundType, imagePath?: string, customBgId?: string) => {
    setBackgroundType(type);
    
    if ((type === 'image' || type === 'gradient') && imagePath) {
      setVirtualBackgroundImagePath(imagePath);
      setSelectedCustomBgId(null);
      saveUserPreferences({ 
        backgroundType: type, 
        backgroundPath: imagePath 
      });
    } else if ((type === 'custom-video' || type === 'custom-image') && customBgId) {
      // For custom backgrounds, we'll handle the path separately
      setSelectedCustomBgId(customBgId);
      setVirtualBackgroundImagePath(null);
      saveUserPreferences({ 
        backgroundType: type, 
        backgroundPath: customBgId // Store the ID
      });
    } else if (type !== 'image' && type !== 'gradient' && type !== 'custom-video' && type !== 'custom-image') {
      setVirtualBackgroundImagePath(null);
      setSelectedCustomBgId(null);
      saveUserPreferences({ 
        backgroundType: type, 
        backgroundPath: undefined 
      });
    }
    
    console.log('[CameraSettings] Background changed to:', type, imagePath, customBgId);
  };
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[CameraSettings] File input changed');
    const file = event.target.files?.[0];
    
    if (!file) {
      console.log('[CameraSettings] No file selected');
      return;
    }
    
    console.log('[CameraSettings] File selected:', file.name, file.type, file.size);
    setIsUploading(true);
    
    try {
      console.log('[CameraSettings] Saving custom background...');
      const customBg = await saveCustomBackground(file);
      console.log('[CameraSettings] Custom background saved:', customBg);
      
      await loadCustomBackgrounds();
      console.log('[CameraSettings] Custom backgrounds reloaded');
      
      // Auto-select the newly uploaded background
      const bgType = customBg.type === 'video' ? 'custom-video' : 'custom-image';
      selectBackground(bgType, undefined, customBg.id);
      
      console.log('[CameraSettings] Uploaded custom background:', customBg.name);
    } catch (error) {
      console.error('[CameraSettings] Failed to upload custom background:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  const handleDeleteCustomBackground = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this background?')) {
      return;
    }
    
    try {
      await deleteCustomBackground(id);
      await loadCustomBackgrounds();
      
      // If the deleted background was selected, switch to blur
      if (selectedCustomBgId === id) {
        selectBackground('blur');
      }
      
      console.log('[CameraSettings] Deleted custom background:', id);
    } catch (error) {
      console.error('Failed to delete custom background:', error);
      alert('Failed to delete background');
    }
  };

  // Effect to apply processors with caching - IMMEDIATE application for privacy
  React.useEffect(() => {
    console.log('[CameraSettings] 🎬 PROCESSOR EFFECT TRIGGERED');
    console.log('[CameraSettings] Current state: backgroundType=', backgroundType, ', blurQuality=', blurQuality, ', reapplyTrigger=', reapplyTrigger);

    // Track if this effect is still active
    let isEffectActive = true;

    const track = cameraTrack?.track;

    // Only process if track exists, is local, and is in 'live' state
    if (!isLocalTrack(track) || track.mediaStreamTrack?.readyState !== 'live') {
      console.log('[CameraSettings] ⏭️  Skipping - track not local or not live');
      return;
    }

    // Log current track dimensions
    const currentDims = track.mediaStreamTrack?.getSettings();
    if (currentDims) {
      console.log('[CameraSettings] 📐 Current track dimensions:', currentDims.width, 'x', currentDims.height);
    }

    // Check if we're already using this processor configuration
    const currentPath = selectedCustomBgId || virtualBackgroundImagePath;
    const customSettingsStr = useCustomSegmentation && customSegmentation
      ? JSON.stringify(customSegmentation)
      : null;

    if (
      currentProcessorRef.current.type === backgroundType &&
      currentProcessorRef.current.path === currentPath &&
      currentProcessorRef.current.quality === blurQuality &&
      currentProcessorRef.current.customSettings === customSettingsStr &&
      currentProcessorRef.current.reapplyTrigger === reapplyTrigger
    ) {
      console.log('[CameraSettings] Processor already applied with same config, skipping');
      return; // Already applied, skip
    }

    console.log('[CameraSettings] 🔧 Processor config/trigger changed:', {
      old: currentProcessorRef.current,
      new: { type: backgroundType, path: currentPath, quality: blurQuality, reapplyTrigger },
    });

    // Apply processor immediately for privacy - no debounce
    const applyProcessor = async () => {
      // Prevent concurrent processor applications
      if (isApplyingProcessorRef.current) {
        console.log('[CameraSettings] Already applying a processor, skipping');
        return;
      }
      
      // CRITICAL: Update the processor ref BEFORE starting to prevent re-triggers
      // This tells React we're already handling this configuration
      const targetConfig = {
        type: backgroundType,
        path: currentPath,
        quality: blurQuality,
        customSettings: customSettingsStr,
        reapplyTrigger: reapplyTrigger
      };
      console.log('[CameraSettings] 📝 Updating processor ref to prevent re-triggers:', targetConfig);
      currentProcessorRef.current = targetConfig;
      
      try {
        // Re-check track state to prevent race conditions
        if (!isLocalTrack(track)) {
          console.warn('[CameraSettings] Track is not a local track, skipping processor update');
          return;
        }
        
        const mediaStreamTrack = track.mediaStreamTrack;
        if (!mediaStreamTrack) {
          console.warn('[CameraSettings] MediaStreamTrack is null, skipping processor update');
          return;
        }
        
        // Check readyState - must be 'live' for video processing
        if (mediaStreamTrack.readyState !== 'live') {
          console.warn('[CameraSettings] MediaStreamTrack is not live (state:', mediaStreamTrack.readyState, '), skipping processor update');
          return;
        }
        
        // Mark that we're applying a processor
        isApplyingProcessorRef.current = true;
        setIsApplyingProcessor(true);
        
        // IMPORTANT: Do NOT mute room tracks - it can cause the MediaStreamTrack to end
        // Apply the processor directly while the track is live
        // The processor initialization is fast enough that minimal unprocessed frames are sent
        console.log('[CameraSettings] Applying processor directly to live track (no mute needed)');

        // Suppress MediaPipe initialization warnings with proper cleanup
        const restoreConsoleWarn = suppressMediaPipeWarnings();

        // No longer need to restore/unmute since we don't mute anymore
        // Keeping this function as a no-op to avoid changing all call sites
        const restoreVideoTrack = async () => {
          // Track is never muted, so no need to unmute
        };

        if (backgroundType === 'blur') {
          // Track state was already validated - proceed with applying blur

          // CRITICAL: Revoke blob URLs when switching away from custom backgrounds
          revokeBlobUrls();

          // Get advanced blur configuration - use custom settings if enabled
          const config = getBlurConfig(
            blurQuality,
            useCustomSegmentation ? customSegmentation : null
          );

          // Check effect is still active before creating processor
          if (!isEffectActive) {
            console.log('[CameraSettings] Effect cancelled before blur processor creation');
            await restoreVideoTrack();
            return;
          }
          
          // CRITICAL FIX: Always create a FRESH processor when quality changes
          // DO NOT reuse cached processors - they have stale state that causes issues
          // DO NOT call stopProcessor() first - it closes the stream and causes black screen
          // LiveKit's setProcessor() will handle stopping the old processor internally
          console.log(`[CameraSettings] Creating fresh blur processor for quality:`, blurQuality);
          
          let blurProcessor: any;
          
          // Choose processor based on configuration
          if (config.processorType === 'mediapipe-image') {
            // ⭐ ENHANCED: Use MediaPipe Image Segmenter for better quality (HIGH/ULTRA only)
            console.log(`[CameraSettings] ========================================`);
            console.log(`[CameraSettings] Using MediaPipe Image Segmenter (Enhanced Quality)`);
            console.log(`[CameraSettings] Blur radius: ${config.blurRadius}px`);
            console.log(`[CameraSettings] Delegate: ${config.segmenterOptions.delegate}`);
            console.log(`[CameraSettings] Quality: ${blurQuality}`);
            console.log(`[CameraSettings] Enhanced person detection: ${config.enhancedPersonDetection?.enabled}`);
            console.log(`[CameraSettings] ========================================`);

            // Extract temporal smoothing alpha from custom settings or use config value
            const temporalAlpha = customSegmentation?.mediaPipeSettings?.temporalSmoothingAlpha
              || config.edgeRefinement?.temporalSmoothingFactor;

            try {
              // Create the MediaPipe blur transformer
              console.log('[MediaPipe] Creating MediaPipeBlurTransformer...');
              const transformer = new MediaPipeBlurTransformer({
                blurRadius: config.blurRadius,
                delegate: config.segmenterOptions.delegate,
                enhancedPersonDetection: config.enhancedPersonDetection,
                temporalSmoothingAlpha: temporalAlpha,
                outputConfidenceMasks: config.segmenterOptions.outputConfidenceMasks ?? true,
                outputCategoryMask: config.segmenterOptions.outputCategoryMask ?? false,
                processEveryNFrames: blurQuality === 'ultra' ? 1 : 2, // Ultra: every frame, others: every 2nd frame
              });

              // Wrap with LiveKit's ProcessorWrapper
              console.log('[MediaPipe] Wrapping transformer with ProcessorWrapper...');
              blurProcessor = new ProcessorWrapper(transformer, 'mediapipe-blur');

              console.log(`[BlurConfig] ✅ MediaPipe processor created successfully`);
              console.log(`[BlurConfig] ✅ Applied ${blurQuality} quality: ${config.blurRadius}px blur, ${config.segmenterOptions.delegate} processing`);

              if (config.enhancedPersonDetection?.enabled) {
                console.log('[BlurConfig] ✅ Enhanced person detection ACTIVE with settings:', {
                  confidenceThreshold: config.enhancedPersonDetection.confidenceThreshold,
                  morphologyEnabled: config.enhancedPersonDetection.morphologyEnabled,
                  keepLargestComponent: config.enhancedPersonDetection.keepLargestComponentOnly,
                });
              }
            } catch (error) {
              console.error('[CameraSettings] ❌ MediaPipe processor creation failed, falling back to default:', error);
              console.warn('[CameraSettings] ⚠️  Using LiveKit default processor instead');
              // Fallback to LiveKit default on error
              blurProcessor = BackgroundProcessor({
                blurRadius: config.blurRadius,
                segmenterOptions: {
                  delegate: config.segmenterOptions.delegate,
                },
              }, 'background-blur');
              console.log('[CameraSettings] ✅ Fallback processor created');
            }
            
          } else {
            // Use existing LiveKit processor (default)
            console.log(`[CameraSettings] ========================================`);
            console.log(`[CameraSettings] Creating LiveKit BackgroundProcessor (blur)`);
            console.log(`[CameraSettings] Blur radius: ${config.blurRadius}px`);
            console.log(`[CameraSettings] Delegate: ${config.segmenterOptions.delegate}`);
            console.log(`[CameraSettings] Quality: ${blurQuality}`);
            console.log(`[CameraSettings] ========================================`);

            try {
              blurProcessor = BackgroundProcessor({
                blurRadius: config.blurRadius,
                segmenterOptions: {
                  delegate: config.segmenterOptions.delegate,
                },
              }, 'background-blur');

              console.log(`[BlurConfig] ✅ BackgroundProcessor created successfully`);
            } catch (createError) {
              console.error('[CameraSettings] ❌ FAILED to create BackgroundProcessor:', createError);
              throw createError;
            }

            // Log what's actually being applied
            console.log(`[BlurConfig] ✅ Applied ${blurQuality} quality: ${config.blurRadius}px blur, ${config.segmenterOptions.delegate} processing`);
          }

          // Check effect is still active and track is still valid after processor creation
          if (!isEffectActive || !isLocalTrack(track)) {
            console.log('[CameraSettings] Effect cancelled or track invalid after blur processor creation');
            restoreConsoleWarn();
            await restoreVideoTrack();
            return;
          }
          
          // CRITICAL: Final track state check right before setProcessor
          // The track can end at any time, so we check immediately before the call
          const finalMediaStreamTrack = track.mediaStreamTrack;
          if (!finalMediaStreamTrack || finalMediaStreamTrack.readyState !== 'live') {
            console.warn('[CameraSettings] Track ended before setProcessor (state:', finalMediaStreamTrack?.readyState, '), aborting blur application');
            restoreConsoleWarn();
            await restoreVideoTrack();
            return;
          }
          
          try {
            console.log('[CameraSettings] 🔄 Calling track.setProcessor() with blur processor...');
            const preSetProcessorDims = track.mediaStreamTrack?.getSettings();
            console.log('[CameraSettings] 📐 Track dimensions RIGHT BEFORE setProcessor:', preSetProcessorDims?.width, 'x', preSetProcessorDims?.height);
            console.log('[CameraSettings] Track state before setProcessor:', {
              kind: track.kind,
              muted: track.isMuted,
              readyState: track.mediaStreamTrack?.readyState,
              hasProcessor: track.getProcessor() !== undefined,
            });

            // setProcessor() handles stopping the old processor internally without closing the stream
            await track.setProcessor(blurProcessor);

            console.log('[CameraSettings] ✅ track.setProcessor() completed successfully!');
            console.log('[CameraSettings] Track state after setProcessor:', {
              kind: track.kind,
              muted: track.isMuted,
              readyState: track.mediaStreamTrack?.readyState,
              hasProcessor: track.getProcessor() !== undefined,
            });

            // Check effect is still active after setProcessor
            if (!isEffectActive) {
              console.log('[CameraSettings] Effect cancelled after setProcessor');
              restoreConsoleWarn();
              await restoreVideoTrack();
              return;
            }

            // Wait for processor to actually start outputting processed frames
            // This detects when the blur is ready instead of using fixed timeouts
            console.log('[CameraSettings] Detecting when blur processor is ready...');
            try {
              await waitForProcessorWithFallback(track as LocalVideoTrack, 100);
              console.log('[CameraSettings] ✅ Blur processor is ready and processing frames!');
            } catch (waitError) {
              console.warn('[CameraSettings] Error waiting for blur processor ready:', waitError);
            }

            // Final check before marking as complete
            if (!isEffectActive) {
              console.log('[CameraSettings] Effect cancelled during processor initialization');
              restoreConsoleWarn();
              await restoreVideoTrack();
              return;
            }

            // Note: currentProcessorRef.current already updated at start of applyProcessor
            console.log('[CameraSettings] ✅✅✅ Blur processor applied successfully, stream remains active');
            restoreConsoleWarn();

            // Unmute track now that blur is ready
            await restoreVideoTrack();
          } catch (processorError) {
            console.error('[CameraSettings] ❌❌❌ ERROR in track.setProcessor():', processorError);
            console.error('[CameraSettings] Error details:', {
              name: (processorError as any).name,
              message: (processorError as any).message,
              stack: (processorError as any).stack,
            });

            restoreConsoleWarn();
            await restoreVideoTrack(); // Always restore video on error

            // Handle specific error cases
            if (processorError instanceof DOMException && processorError.name === 'InvalidStateError') {
              console.warn('[CameraSettings] Stream closed while applying blur processor:', processorError.message);
              return;
            } else if (processorError instanceof TypeError &&
                       ((processorError as Error).message.includes('Input track cannot be ended') ||
                        (processorError as Error).message.includes('MediaStreamTrackProcessor'))) {
              console.warn('[CameraSettings] Track ended before processor could be applied:', processorError.message);
              return;
            }
            throw processorError; // Re-throw other errors
          }
          
        } else if ((backgroundType === 'image' || backgroundType === 'gradient') && virtualBackgroundImagePath) {
          // Track state was already validated - proceed with applying virtual background

          // CRITICAL: Revoke blob URLs when switching away from custom backgrounds
          revokeBlobUrls();

          // Always create fresh virtual background processor to avoid state issues
          let imagePath = virtualBackgroundImagePath;
          
          // For gradient, generate the canvas data URL
          if (backgroundType === 'gradient') {
            imagePath = createGradientCanvas(virtualBackgroundImagePath);
          }
          
          console.log('[CameraSettings] Creating fresh virtual background processor');
          const virtualBgProcessor = VirtualBackground(imagePath, {
            delegate: 'GPU',
          });

          // CRITICAL: Final track state check right before setProcessor
          const finalMediaStreamTrack = track.mediaStreamTrack;
          if (!finalMediaStreamTrack || finalMediaStreamTrack.readyState !== 'live') {
            console.warn('[CameraSettings] Track ended before setProcessor (state:', finalMediaStreamTrack?.readyState, '), aborting virtual background');
            restoreConsoleWarn();
            await restoreVideoTrack();
            return;
          }
          
          try {
            // setProcessor() handles stopping the old processor internally
            await track.setProcessor(virtualBgProcessor);
            
            // Wait for processor to actually start outputting processed frames
            console.log('[CameraSettings] Detecting when virtual background is ready...');
            try {
              await waitForProcessorWithFallback(track as LocalVideoTrack, 100);
            } catch (waitError) {
              console.warn('[CameraSettings] Error waiting for virtual background ready:', waitError);
            }
            
            // Note: currentProcessorRef.current already updated at start of applyProcessor
            console.log('[CameraSettings] Virtual background applied successfully, stream remains active');
            restoreConsoleWarn();
            
            // Unmute track now that effect is ready
            await restoreVideoTrack();
          } catch (processorError) {
            restoreConsoleWarn();
            await restoreVideoTrack(); // Always restore video on error
            
            // Handle specific error cases
            if (processorError instanceof DOMException && processorError.name === 'InvalidStateError') {
              console.warn('[CameraSettings] Stream closed while applying virtual background:', processorError.message);
              return;
            } else if (processorError instanceof TypeError && 
                       (processorError.message.includes('Input track cannot be ended') ||
                        processorError.message.includes('MediaStreamTrackProcessor'))) {
              console.warn('[CameraSettings] Track ended before virtual background could be applied:', processorError.message);
              return;
            }
            throw processorError; // Re-throw other errors
          }
          
        } else if ((backgroundType === 'custom-video' || backgroundType === 'custom-image') && selectedCustomBgId) {
          // Track state was already validated - proceed with applying custom background

          // Handle custom backgrounds from IndexedDB
          const customBg = customBackgrounds.find(bg => bg.id === selectedCustomBgId);
          if (customBg) {
            // CRITICAL: Revoke previous blob URLs before creating new ones to prevent memory leaks
            revokeBlobUrls();

            // Always create fresh custom background processor to avoid state issues
            // Create object URL from blob
            const blobUrl = URL.createObjectURL(customBg.data);
            activeBlobUrlsRef.current.add(blobUrl);
            console.log('[CameraSettings] Created blob URL for custom background:', customBg.name);

            console.log('[CameraSettings] Creating fresh custom background processor:', customBg.name);
            const virtualBgProcessor = VirtualBackground(blobUrl, {
              delegate: 'GPU',
            });

            // CRITICAL: Final track state check right before setProcessor
            const finalMediaStreamTrack = track.mediaStreamTrack;
            if (!finalMediaStreamTrack || finalMediaStreamTrack.readyState !== 'live') {
              console.warn('[CameraSettings] Track ended before setProcessor (state:', finalMediaStreamTrack?.readyState, '), aborting custom background');
              restoreConsoleWarn();
              await restoreVideoTrack();
              return;
            }
            
            try {
              // setProcessor() handles stopping the old processor internally
              await track.setProcessor(virtualBgProcessor);
              
              // Wait for processor to actually start outputting processed frames
              console.log('[CameraSettings] Detecting when custom background is ready...');
              try {
                await waitForProcessorWithFallback(track as LocalVideoTrack, 100);
              } catch (waitError) {
                console.warn('[CameraSettings] Error waiting for custom background ready:', waitError);
              }
              
              // Note: currentProcessorRef.current already updated at start of applyProcessor
              console.log('[CameraSettings] Custom background applied successfully, stream remains active:', customBg.name);
              restoreConsoleWarn();
              
              // Unmute track now that effect is ready
              await restoreVideoTrack();
            } catch (processorError) {
              restoreConsoleWarn();
              await restoreVideoTrack(); // Always restore video on error
              
              // Handle specific error cases
              if (processorError instanceof DOMException && processorError.name === 'InvalidStateError') {
                console.warn('[CameraSettings] Stream closed while applying custom background:', processorError.message);
                return;
              } else if (processorError instanceof TypeError && 
                         (processorError.message.includes('Input track cannot be ended') ||
                          processorError.message.includes('MediaStreamTrackProcessor'))) {
                console.warn('[CameraSettings] Track ended before custom background could be applied:', processorError.message);
                return;
              }
              throw processorError; // Re-throw other errors
            }
          }
          
        } else {
          // No effect - stop processor

          // CRITICAL: Revoke blob URLs when switching to no effect
          revokeBlobUrls();

          // MOBILE FIX: On mobile devices (especially Android), stopProcessor() can leave
          // the video track in a broken state that prevents effects from working when re-enabled.
          // Instead, we'll use setProcessor(BackgroundProcessor with 0 blur) which maintains
          // track health while effectively removing the visual effect.
          const deviceCapabilities = detectDeviceCapabilities();
          const isMobileDevice = deviceCapabilities.deviceType === 'mobile';

          if (isMobileDevice) {
            // Mobile workaround: Apply a minimal "passthrough-like" processor
            // This keeps the track pipeline active and healthy for future effects
            console.log('[CameraSettings] Mobile device detected - using minimal processor instead of stopProcessor()');

            try {
              // Create a minimal blur processor (0px = no effect)
              // This keeps the processing pipeline active without visual changes
              const passthroughProcessor = BackgroundProcessor({
                blurRadius: 0,
                segmenterOptions: {
                  delegate: 'GPU',
                },
              }, 'passthrough');

              await track.setProcessor(passthroughProcessor);
              console.log('[CameraSettings] Passthrough processor applied (mobile)');
              restoreConsoleWarn();
              await restoreVideoTrack();
            } catch (error) {
              console.error('[CameraSettings] Error applying passthrough processor:', error);
              restoreConsoleWarn();
              await restoreVideoTrack();
            }
          } else {
            // Desktop: Use normal stopProcessor() approach
            // Check stream state before stopping processor
            if (mediaStreamTrack && mediaStreamTrack.readyState === 'live') {
              try {
                await track.stopProcessor();
                // Note: currentProcessorRef.current already updated at start of applyProcessor
                console.log('[CameraSettings] Processor stopped successfully');
                restoreConsoleWarn();

                // Unmute track since no effect is being applied
                await restoreVideoTrack();
              } catch (stopError) {
                restoreConsoleWarn();
                await restoreVideoTrack(); // Always restore video even on error
                if (stopError instanceof DOMException && stopError.name === 'InvalidStateError') {
                  console.warn('[CameraSettings] Stream closed while stopping processor:', stopError.message);
                } else {
                  console.error('[CameraSettings] Error stopping processor:', stopError);
                }
              }
            } else {
              console.warn('[CameraSettings] Cannot stop processor - stream is not live');
              // Note: currentProcessorRef.current already updated at start of applyProcessor
              restoreConsoleWarn();
              await restoreVideoTrack(); // Always restore video
            }
          }
        }
        
      } catch (error) {
        // Handle errors gracefully and always restore video
        if (error instanceof DOMException && error.name === 'InvalidStateError') {
          console.warn('[CameraSettings] Track is in invalid state (stream closed), skipping processor update');
        } else {
          console.error('[CameraSettings] Error setting video processor:', error);
        }
        
        // CRITICAL: Always unmute the video track on error to prevent permanent black screen
        const track = cameraTrack?.track;
        if (isLocalTrack(track) && track.isMuted) {
          const mediaStreamTrack = track.mediaStreamTrack;
          if (mediaStreamTrack?.readyState === 'live') {
            track.unmute().catch(unmuteError => {
              console.warn('[CameraSettings] Error unmuting track after processor error:', unmuteError);
            });
          }
        }
      } finally {
        // Always clear the applying flag
        isApplyingProcessorRef.current = false;
        setIsApplyingProcessor(false);
      }
    };

    // Apply immediately - no debounce to prevent background exposure
    applyProcessor();
    
    // Cleanup function to cancel ongoing operations
    return () => {
      console.log('[CameraSettings] Effect cleanup triggered - cancelling ongoing processor operations');
      isEffectActive = false;
    };
  }, [cameraTrack, backgroundType, virtualBackgroundImagePath, blurQuality, selectedCustomBgId, customBackgrounds, useCustomSegmentation, customSegmentation, setIsApplyingProcessor, revokeBlobUrls, suppressMediaPipeWarnings, reapplyTrigger]);

  // Cleanup processors on unmount
  React.useEffect(() => {
    // Copy ref value to avoid stale reference in cleanup
    const originalWarn = originalConsoleWarnRef.current;

    return () => {
      console.log('[CameraSettings] Component unmount - cleaning up processors');
      const track = cameraTrack?.track;
      if (isLocalTrack(track)) {
        // Check if track is still valid before stopping processor
        const mediaStreamTrack = track.mediaStreamTrack;
        if (mediaStreamTrack && mediaStreamTrack.readyState === 'live') {
          track.stopProcessor().catch((err) => {
            // Silently handle errors during cleanup
            if (err instanceof DOMException && err.name === 'InvalidStateError') {
              console.warn('[CameraSettings] Stream already closed during cleanup');
            } else {
              console.warn('[CameraSettings] Error stopping processor on cleanup:', err);
            }
          });
        }
      }

      // CRITICAL: Revoke all blob URLs to prevent memory leaks
      revokeBlobUrls();

      // CRITICAL: Clear any pending console.warn restore timeout
      if (consoleWarnTimeoutRef.current) {
        clearTimeout(consoleWarnTimeoutRef.current);
        consoleWarnTimeoutRef.current = null;
      }
      // Restore original console.warn if it was overridden
      console.warn = originalWarn;

      // Clear processor configuration tracking
      currentProcessorRef.current = { type: 'none', path: null, quality: null, customSettings: null, reapplyTrigger: 0 };
      console.log('[CameraSettings] Cleanup complete');
    };
  }, [cameraTrack, revokeBlobUrls]);

  // Handle device orientation changes (mobile)
  // When user rotates phone, ensure processor adapts to new dimensions
  React.useEffect(() => {
    // Only needed on mobile devices
    const deviceCapabilities = detectDeviceCapabilities();
    if (deviceCapabilities.deviceType !== 'mobile') {
      return; // Skip orientation handling on desktop/tablet
    }

    console.log('[CameraSettings] 📱 Setting up robust orientation change handler for mobile');

    // Track last known dimensions to detect actual changes
    let lastWidth = 0;
    let lastHeight = 0;
    let isHandlingOrientation = false;

    /**
     * Poll track dimensions until they stabilize after orientation change
     * Returns true if dimensions changed, false if they stayed the same
     */
    const waitForDimensionStability = async (track: any, maxAttempts = 20, intervalMs = 150): Promise<boolean> => {
      let stableCount = 0;
      const requiredStableChecks = 3; // Need 3 consecutive stable readings
      let previousWidth = 0;
      let previousHeight = 0;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const mediaStreamTrack = track.mediaStreamTrack;
        if (!mediaStreamTrack || mediaStreamTrack.readyState !== 'live') {
          console.log('[CameraSettings] Track ended during dimension polling');
          return false;
        }

        const settings = mediaStreamTrack.getSettings();
        const currentWidth = settings.width || 0;
        const currentHeight = settings.height || 0;

        console.log(`[CameraSettings] 🔍 Poll ${attempt + 1}/${maxAttempts}: ${currentWidth}x${currentHeight} (stable: ${stableCount}/${requiredStableChecks})`);

        // Check if dimensions are stable (same as previous check)
        if (currentWidth === previousWidth && currentHeight === previousHeight && currentWidth > 0) {
          stableCount++;
          if (stableCount >= requiredStableChecks) {
            console.log(`[CameraSettings] ✅ Dimensions stabilized at ${currentWidth}x${currentHeight}`);

            // Check if dimensions actually changed from last known values
            const dimensionsChanged = (currentWidth !== lastWidth || currentHeight !== lastHeight);
            if (dimensionsChanged) {
              console.log(`[CameraSettings] 📐 Dimension change confirmed: ${lastWidth}x${lastHeight} → ${currentWidth}x${currentHeight}`);
              lastWidth = currentWidth;
              lastHeight = currentHeight;
              return true;
            } else {
              console.log(`[CameraSettings] ℹ️ Dimensions unchanged (false alarm)`);
              return false;
            }
          }
        } else {
          // Dimensions still changing, reset stable count
          stableCount = 0;
        }

        previousWidth = currentWidth;
        previousHeight = currentHeight;

        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }

      console.log('[CameraSettings] ⚠️ Dimension polling timed out without stabilization');
      return false;
    };

    const handleOrientationChange = async () => {
      // Prevent concurrent orientation handling
      if (isHandlingOrientation) {
        console.log('[CameraSettings] Already handling orientation change, skipping');
        return;
      }

      isHandlingOrientation = true;
      console.log('[CameraSettings] 🔄 Orientation change event triggered');

      try {
        const track = cameraTrack?.track;
        if (!isLocalTrack(track)) {
          console.log('[CameraSettings] No local track available');
          return;
        }

        const mediaStreamTrack = track.mediaStreamTrack;
        if (!mediaStreamTrack || mediaStreamTrack.readyState !== 'live') {
          console.log('[CameraSettings] Track not live');
          return;
        }

        // Initial delay to let the OS/browser start adjusting
        await new Promise(resolve => setTimeout(resolve, 100));

        // Actively poll for dimension changes and wait for stability
        const dimensionsChanged = await waitForDimensionStability(track);

        if (dimensionsChanged && backgroundType !== 'none') {
          console.log('[CameraSettings] ♻️♻️♻️ REAPPLYING EFFECT FOR NEW ORIENTATION ♻️♻️♻️');
          console.log('[CameraSettings] Current backgroundType:', backgroundType);
          console.log('[CameraSettings] Current blurQuality:', blurQuality);
          console.log('[CameraSettings] Current virtualBackgroundImagePath:', virtualBackgroundImagePath);

          // DON'T manually stop processor - setProcessor() handles that internally
          // Manually stopping can put the track in a bad state on mobile

          // Add small delay to ensure track is fully stable before reapplying
          await new Promise(resolve => setTimeout(resolve, 200));

          // Verify track is still valid and dimensions are still what we expect
          const finalCheck = track.mediaStreamTrack?.getSettings();
          if (finalCheck) {
            console.log('[CameraSettings] Final dimension check before reapply:', finalCheck.width, 'x', finalCheck.height);
          }

          // Trigger reapplication by incrementing the trigger
          // This will cause the main effect to run again with the new dimensions
          console.log('[CameraSettings] Triggering effect reapplication...');
          setReapplyTrigger(prev => {
            const newValue = prev + 1;
            console.log('[CameraSettings] reapplyTrigger:', prev, '→', newValue);
            return newValue;
          });

          console.log('[CameraSettings] ✅ Reapply trigger set, waiting for effect to run...');
        } else if (!dimensionsChanged) {
          console.log('[CameraSettings] No dimension change detected, skipping reapply');
        }
      } catch (error) {
        console.error('[CameraSettings] Error handling orientation change:', error);
      } finally {
        isHandlingOrientation = false;
      }
    };

    // Listen for orientation changes
    window.addEventListener('orientationchange', handleOrientationChange);

    // Also listen for resize as a backup (some devices don't fire orientationchange)
    window.addEventListener('resize', handleOrientationChange);

    // Listen for screen orientation API changes (more reliable on some browsers)
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', handleOrientationChange);
    }

    // Get initial dimensions
    const track = cameraTrack?.track;
    if (isLocalTrack(track)) {
      const settings = track.mediaStreamTrack?.getSettings();
      if (settings) {
        lastWidth = settings.width || 0;
        lastHeight = settings.height || 0;
        console.log(`[CameraSettings] 📏 Initial video dimensions: ${lastWidth}x${lastHeight}`);
      }
    }

    return () => {
      console.log('[CameraSettings] Removing orientation change handlers');
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', handleOrientationChange);
      }
    };
  }, [cameraTrack, backgroundType, setReapplyTrigger]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ position: 'relative' }}>
        {camTrackRef ? (
          <VideoTrack
            style={{
              maxHeight: '280px',
              objectFit: 'contain',
              objectPosition: 'right',
              transform: 'scaleX(-1)',
              // PRIVACY: Hide video while applying processor (only for blur/background effects)
              visibility: (isApplyingProcessor && backgroundType !== 'none') ? 'hidden' : 'visible'
            }}
            trackRef={camTrackRef}
          />
        ) : (
          <video
            className="lk-participant-media-video"
            data-lk-local-participant="true"
            data-lk-source="camera"
            data-lk-orientation="landscape"
            style={{
              maxHeight: '280px',
              objectFit: 'contain',
              objectPosition: 'right center',
              transform: 'scaleX(-1)',
            }}
            autoPlay
            playsInline
          />
        )}
        
        {/* Loading overlay while applying processor - PRIVACY PROTECTION */}
        {isApplyingProcessor && backgroundType !== 'none' && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(26, 26, 26, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            zIndex: 10,
            borderRadius: '8px',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid rgba(255, 255, 255, 0.1)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <div style={{ color: '#fff', fontSize: '12px', fontWeight: 500, textAlign: 'center' }}>
              Applying effect...
            </div>
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}
      </div>

      <section className="lk-button-group">
        <TrackToggle aria-label="Toggle camera" source={Track.Source.Camera} />
        <div className="lk-button-group-menu">
          <MediaDeviceMenu kind="videoinput">
            <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </MediaDeviceMenu>
        </div>
      </section>

      <div style={{ marginTop: '10px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}
        >
          <div style={{ fontWeight: '500' }}>
            Background Effects
          </div>
          <div
            title="Tips for best person detection:&#10;&#10;LIGHTING (Most Important):&#10;• Use bright, even lighting from the front&#10;• Avoid windows or bright lights behind you&#10;• Side lighting can create harsh shadows&#10;&#10;CAMERA POSITION:&#10;• Center yourself in the frame&#10;• Keep 1-2 feet of space above your head&#10;• Position camera at eye level&#10;&#10;BACKGROUND:&#10;• Use simple, uncluttered backgrounds&#10;• Avoid complex patterns or textures&#10;• Keep background objects away from you&#10;• Solid walls work better than shelves&#10;&#10;CLOTHING:&#10;• Wear colors that contrast with background&#10;• Avoid patterns that blend with surroundings&#10;&#10;ADVANCED:&#10;• Enable 'High' or 'Ultra' quality in settings&#10;• Use Settings > Advanced > Custom Segmentation&#10;• Enable temporal smoothing to reduce flicker"
            style={{
              cursor: 'help',
              fontSize: '14px',
              color: '#0090ff',
              fontWeight: 'bold',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              border: '2px solid #0090ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ?
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => !isApplyingProcessor && selectBackground('none')}
            className="lk-button lk-button-visual"
            aria-label="No background effect"
            aria-pressed={backgroundType === 'none'}
            disabled={isApplyingProcessor}
            style={{
              border: backgroundType === 'none' ? '2px solid #3b82f6' : '2px solid rgba(255, 255, 255, 0.15)',
              background: 'rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '60px',
              minHeight: '60px',
              padding: '0',
              opacity: isApplyingProcessor ? 0.5 : 1,
              cursor: isApplyingProcessor ? 'not-allowed' : 'pointer',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M3 3L21 21M3 21L21 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>

          <button
            onClick={() => !isApplyingProcessor && selectBackground('blur')}
            className="lk-button lk-button-visual"
            aria-label="Blur background effect"
            aria-pressed={backgroundType === 'blur'}
            disabled={isApplyingProcessor}
            style={{
              border: backgroundType === 'blur' ? '2px solid #3b82f6' : '2px solid rgba(255, 255, 255, 0.15)',
              backgroundColor: '#e0e0e0',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '60px',
              minHeight: '60px',
              padding: '0',
              opacity: isApplyingProcessor ? 0.5 : 1,
              cursor: isApplyingProcessor ? 'not-allowed' : 'pointer',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#d0d0d0',
                filter: 'blur(12px)',
                zIndex: 0,
              }}
            />
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ position: 'relative', zIndex: 1 }}>
              <circle cx="12" cy="12" r="4" fill="#666" opacity="0.3"/>
              <circle cx="8" cy="8" r="3" fill="#999" opacity="0.4"/>
              <circle cx="16" cy="9" r="2.5" fill="#999" opacity="0.4"/>
              <circle cx="9" cy="16" r="2" fill="#999" opacity="0.4"/>
              <circle cx="16" cy="15" r="2.5" fill="#999" opacity="0.4"/>
            </svg>
          </button>

          {GRADIENT_BACKGROUNDS.map((gradientBg) => (
            <button
              key={gradientBg.name}
              onClick={() => !isApplyingProcessor && selectBackground('gradient', gradientBg.gradient)}
              className="lk-button lk-button-visual"
              aria-label={`${gradientBg.name} gradient background`}
              aria-pressed={
                backgroundType === 'gradient' && virtualBackgroundImagePath === gradientBg.gradient
              }
              disabled={isApplyingProcessor}
              style={{
                background: gradientBg.gradient,
                border:
                  backgroundType === 'gradient' && virtualBackgroundImagePath === gradientBg.gradient
                    ? '2px solid #3b82f6'
                    : '2px solid rgba(255, 255, 255, 0.15)',
                minWidth: '60px',
                minHeight: '60px',
                padding: '0',
                opacity: isApplyingProcessor ? 0.5 : 1,
                cursor: isApplyingProcessor ? 'not-allowed' : 'pointer',
              }}
            >
            </button>
          ))}

          {BACKGROUND_IMAGES.map((image) => (
            <button
              key={image.path}
              onClick={() => !isApplyingProcessor && selectBackground('image', image.path)}
              className="lk-button lk-button-visual"
              aria-label={`${image.name} background image`}
              aria-pressed={
                backgroundType === 'image' && virtualBackgroundImagePath === image.path
              }
              disabled={isApplyingProcessor}
              style={{
                backgroundImage: `url(${image.path})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                border:
                  backgroundType === 'image' && virtualBackgroundImagePath === image.path
                    ? '2px solid #3b82f6'
                    : '2px solid rgba(255, 255, 255, 0.15)',
                minWidth: '60px',
                minHeight: '60px',
                padding: '0',
                opacity: isApplyingProcessor ? 0.5 : 1,
                cursor: isApplyingProcessor ? 'not-allowed' : 'pointer',
              }}
            >
            </button>
          ))}
          
          {/* Custom uploaded backgrounds */}
          {customBackgrounds.map((customBg) => {
            const bgType = customBg.type === 'video' ? 'custom-video' : 'custom-image';
            const isSelected = selectedCustomBgId === customBg.id;
            
            return (
              <button
                key={customBg.id}
                onClick={() => !isApplyingProcessor && selectBackground(bgType, undefined, customBg.id)}
                className="lk-button lk-button-visual"
                aria-label={`Custom ${customBg.type}: ${customBg.name}`}
                aria-pressed={isSelected}
                disabled={isApplyingProcessor}
                style={{
                  backgroundImage: `url(${customBg.thumbnail})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  border: isSelected
                    ? '2px solid #3b82f6'
                    : '2px solid rgba(255, 255, 255, 0.15)',
                  minWidth: '60px',
                  minHeight: '60px',
                  padding: '0',
                  position: 'relative',
                  opacity: isApplyingProcessor ? 0.5 : 1,
                  cursor: isApplyingProcessor ? 'not-allowed' : 'pointer',
                }}
              >
                {/* Video indicator */}
                {customBg.type === 'video' && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '4px',
                      right: '4px',
                      background: 'rgba(0, 0, 0, 0.7)',
                      borderRadius: '4px',
                      padding: '2px 4px',
                      fontSize: '10px',
                      color: 'white',
                      fontWeight: 'bold',
                    }}
                  >
                    VIDEO
                  </div>
                )}
                
                {/* Delete button */}
                <button
                  onClick={(e) => handleDeleteCustomBackground(customBg.id, e)}
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    background: 'rgba(220, 38, 38, 0.9)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    padding: '0',
                  }}
                  aria-label="Delete custom background"
                  title="Delete"
                >
                  ×
                </button>
              </button>
            );
          })}
          
          {/* Upload button with direct file input */}
          <label
            className="lk-button lk-button-visual"
            aria-label="Upload custom background"
            style={{
              border: '2px dashed rgba(255, 255, 255, 0.3)',
              background: 'rgba(255, 255, 255, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '60px',
              minHeight: '60px',
              padding: '8px',
              cursor: isUploading ? 'not-allowed' : 'pointer',
              opacity: isUploading ? 0.6 : 1,
              position: 'relative',
            }}
          >
            {isUploading ? (
              <div style={{ fontSize: '10px', textAlign: 'center' }}>
                Uploading...
              </div>
            ) : (
              <>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div style={{ fontSize: '10px', marginTop: '4px' }}>
                  Upload
                </div>
              </>
            )}
            
            {/* Direct file input that captures clicks */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,video/mp4,video/webm,video/ogg"
              onChange={handleFileUpload}
              disabled={isUploading}
              style={{ 
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: isUploading ? 'not-allowed' : 'pointer',
                zIndex: 1,
              }}
              onClick={(e) => {
                console.log('[CameraSettings] File input clicked directly');
                e.stopPropagation();
              }}
            />
          </label>
        </div>
        
        {/* Storage info */}
        {customBackgrounds.length > 0 && (
          <div style={{
            marginTop: '8px',
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.7)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>{customBackgrounds.length} custom background{customBackgrounds.length !== 1 ? 's' : ''}</span>
            <span>Storage: {formatBytes(storageUsed)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
