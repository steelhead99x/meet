'use client';
import * as React from 'react';
import { Track } from 'livekit-client';
import {
  useMaybeLayoutContext,
  MediaDeviceMenu,
  TrackToggle,
  useRoomContext,
  useIsRecording,
} from '@livekit/components-react';
import styles from '../styles/SettingsMenu.module.css';
import { CameraSettings } from './CameraSettings';
import { MicrophoneSettings } from './MicrophoneSettings';
import { 
  BlurQuality, 
  getBlurQualityDescription, 
  getPerformanceImpact,
  CustomSegmentationSettings,
  customSettingsFromPreset,
  getDefaultCustomSettings
} from './BlurConfig';
import { detectDeviceCapabilities } from './client-utils';
/**
 * @alpha
 */
export interface SettingsMenuProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * @alpha
 */
export function SettingsMenu(props: SettingsMenuProps) {
  const layoutContext = useMaybeLayoutContext();
  const room = useRoomContext();
  const recordingEndpoint = process.env.NEXT_PUBLIC_LK_RECORD_ENDPOINT;
  
  // Track settings menu visibility state from LayoutContext
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  
  // Listen to LayoutContext widget state changes
  React.useEffect(() => {
    if (!layoutContext?.widget) return;
    
    // Check if widget state has settings property
    // LiveKit's ControlBar toggles settings via widget state
    const checkState = () => {
      const state = layoutContext.widget.state;
      const widgetStateOpen = state.settings === true;
      // Settings can be tracked via widget.state or we can listen to DOM changes
      // Since LiveKit may use DOM attributes, we'll check for modal wrapper
      const modal = document.querySelector('.lk-settings-menu-modal');
      const modalOpen = modal && modal.getAttribute('aria-hidden') !== 'true';
      const isOpen = widgetStateOpen || modalOpen;
      setIsSettingsOpen(isOpen);
    };
    
    // Check initial state
    checkState();
    
    // Subscribe to widget state changes if available
    let unsubscribe: (() => void) | undefined;
    if (layoutContext.widget.subscribe) {
      unsubscribe = layoutContext.widget.subscribe((state) => {
        const isOpen = state.settings === true;
        setIsSettingsOpen(isOpen);
      });
    }
    
    // Watch for DOM changes (when LiveKit creates modal wrapper)
    const observer = new MutationObserver(checkState);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-hidden', 'data-lk-settings-menu-open']
    });
    
    return () => {
      observer.disconnect();
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [layoutContext]);

  const settings = React.useMemo(() => {
    return {
      media: { camera: true, microphone: true, label: 'Media Devices', speaker: true },
      recording: recordingEndpoint ? { label: 'Recording' } : undefined,
    };
  }, [recordingEndpoint]);

  const tabs = React.useMemo(
    () => Object.keys(settings).filter((t) => t !== undefined) as Array<keyof typeof settings>,
    [settings],
  );
  // Default to 'media' tab if available, otherwise first available tab
  const [activeTab, setActiveTab] = React.useState(() => {
    return tabs.includes('media' as keyof typeof settings) ? 'media' : tabs[0];
  });

  const isRecording = useIsRecording();
  const [initialRecStatus, setInitialRecStatus] = React.useState(isRecording);
  const [processingRecRequest, setProcessingRecRequest] = React.useState(false);

  // Blur quality control state
  const [blurQuality, setBlurQuality] = React.useState<BlurQuality>('medium');
  const [deviceInfo, setDeviceInfo] = React.useState<ReturnType<typeof detectDeviceCapabilities> | null>(null);
  
  // Custom segmentation state
  const [useCustomSegmentation, setUseCustomSegmentation] = React.useState(false);
  const [customSegmentation, setCustomSegmentation] = React.useState<CustomSegmentationSettings>(
    getDefaultCustomSettings()
  );
  const [showAdvancedSettings, setShowAdvancedSettings] = React.useState(false);
  
  // Debounce timer for slider changes to prevent freezing
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const [isApplyingChanges, setIsApplyingChanges] = React.useState(false);
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = React.useState<{
    camera: boolean;
    microphone: boolean;
    speaker: boolean;
    blur: boolean;
    segmentation: boolean;
    mediapipe: boolean;
  }>({
    camera: true,
    microphone: false,
    speaker: false,
    blur: false,
    segmentation: false,
    mediapipe: false,
  });
  
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Helper function to close settings menu using all available methods
  const closeSettingsMenu = React.useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Update local component state first
    setIsSettingsOpen(false);
    
    // Method 1: Update LayoutContext widget state (LiveKit's preferred method)
    if (layoutContext?.widget) {
      // Only dispatch toggle if settings is currently open (to avoid toggling back open)
      const isCurrentlyOpen = layoutContext.widget.state?.settings === true;
      if (isCurrentlyOpen && layoutContext.widget.dispatch) {
        layoutContext.widget.dispatch({ msg: 'toggle_settings' });
      }
    }
    
    // Method 2: Find LiveKit's modal wrapper and update attributes directly
    // LiveKit typically wraps settings in a portal with specific classes
    const modalSelectors = [
      '.lk-widget-modal',
      '.lk-settings-menu-modal',
      '[data-lk-widget="settings"]',
      '[data-lk-settings-menu-open="true"]',
    ];
    
    let foundModal = false;
    modalSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        if (el instanceof HTMLElement) {
          foundModal = true;
          // Update attributes instead of forcing display:none to avoid breaking animations
          el.setAttribute('aria-hidden', 'true');
          el.removeAttribute('data-lk-settings-menu-open');
          // Check if LiveKit uses data-lk-widget-state
          if (el.hasAttribute('data-lk-widget-state')) {
            try {
              const currentState = JSON.parse(el.getAttribute('data-lk-widget-state') || '{}');
              currentState.settings = false;
              el.setAttribute('data-lk-widget-state', JSON.stringify(currentState));
            } catch {}
          }
        }
      });
    });
    
    // Method 3: Find the parent modal/portal that LiveKit might create
    // and ensure it's closed
    if (!foundModal) {
      // Try to find any LiveKit widget containers
      const widgetContainers = document.querySelectorAll('[data-lk-widget], [class*="lk-widget"]');
      widgetContainers.forEach((container) => {
        if (container instanceof HTMLElement) {
          const isSettingsWidget = container.getAttribute('data-lk-widget') === 'settings' ||
                                   container.className.includes('settings');
          if (isSettingsWidget) {
            container.setAttribute('aria-hidden', 'true');
            container.style.display = 'none';
          }
        }
      });
    }
    
    // Method 4: Trigger a click on LiveKit's overlay/backdrop if it exists
    // This simulates clicking outside to close (common pattern)
    const overlay = document.querySelector('.lk-widget-modal > [data-lk-overlay], .lk-settings-menu-modal > [data-lk-overlay], [role="dialog"] > button[aria-label*="close" i]');
    if (overlay instanceof HTMLElement) {
      overlay.click();
    }
  }, [layoutContext]);

  // Initialize blur quality, device info, and custom segmentation
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const capabilities = detectDeviceCapabilities();
      setDeviceInfo(capabilities);
      
      const currentQuality = window.__getBlurQuality?.();
      if (currentQuality) {
        setBlurQuality(currentQuality);
      }
      
      const useCustom = window.__getUseCustomSegmentation?.();
      if (useCustom !== undefined) {
        setUseCustomSegmentation(useCustom);
      }
      
      const customSettings = window.__getCustomSegmentation?.();
      if (customSettings) {
        setCustomSegmentation(customSettings);
      }
    }
  }, []);

  const handleBlurQualityChange = (quality: BlurQuality) => {
    setBlurQuality(quality);
    
    // Show "applying" indicator
    setIsApplyingChanges(true);
    
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Debounce the actual processor update to prevent freezing
    // Apply changes after user stops clicking (300ms delay for preset changes)
    debounceTimerRef.current = setTimeout(() => {
      if (window.__setBlurQuality) {
        window.__setBlurQuality(quality);
      }
      
      // Hide "applying" indicator after update is sent
      setIsApplyingChanges(false);
    }, 300); // 300ms debounce for preset changes (shorter than slider changes)
    
    // When switching presets, update custom settings to match (for reference)
    if (!useCustomSegmentation) {
      const presetSettings = customSettingsFromPreset(quality);
      setCustomSegmentation(presetSettings);
    }
  };
  
  const handleToggleCustomSegmentation = (enabled: boolean) => {
    setUseCustomSegmentation(enabled);
    if (window.__setUseCustomSegmentation) {
      window.__setUseCustomSegmentation(enabled);
    }
    
    // If enabling custom, initialize with current preset values
    if (enabled) {
      const presetSettings = customSettingsFromPreset(blurQuality);
      setCustomSegmentation(presetSettings);
      if (window.__setCustomSegmentation) {
        window.__setCustomSegmentation(presetSettings);
      }
    }
  };
  
  const handleCustomSegmentationChange = (
    field: keyof CustomSegmentationSettings,
    value: number | boolean
  ) => {
    // Update local state immediately for responsive UI
    const updated = { ...customSegmentation, [field]: value };
    setCustomSegmentation(updated);
    
    // Show "applying" indicator
    setIsApplyingChanges(true);
    
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Debounce the actual processor update to prevent freezing
    // Only apply to video processor after user stops dragging (500ms delay)
    debounceTimerRef.current = setTimeout(() => {
      if (window.__setCustomSegmentation) {
        window.__setCustomSegmentation(updated);
      }
      // Hide "applying" indicator after update is sent
      setIsApplyingChanges(false);
    }, 500); // 500ms debounce - adjust after user stops sliding
  };
  
  // Helper function for updating MediaPipe settings (nested object)
  const handleMediaPipeSettingChange = (
    updatedSettings: CustomSegmentationSettings['mediaPipeSettings']
  ) => {
    const updated = { ...customSegmentation, mediaPipeSettings: updatedSettings };
    setCustomSegmentation(updated);
    
    // Show "applying" indicator
    setIsApplyingChanges(true);
    
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Debounce the actual processor update
    debounceTimerRef.current = setTimeout(() => {
      if (window.__setCustomSegmentation) {
        window.__setCustomSegmentation(updated);
      }
      setIsApplyingChanges(false);
    }, 500);
  };

  // Cleanup debounce timer on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Handle ESC key to close settings menu
  React.useEffect(() => {
    if (!isSettingsOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeSettingsMenu();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isSettingsOpen, closeSettingsMenu]);

  React.useEffect(() => {
    if (initialRecStatus !== isRecording) {
      setProcessingRecRequest(false);
    }
  }, [isRecording, initialRecStatus]);

  const toggleRoomRecording = async () => {
    if (!recordingEndpoint) {
      throw TypeError('No recording endpoint specified');
    }
    if (room.isE2EEEnabled) {
      throw Error('Recording of encrypted meetings is currently not supported');
    }
    setProcessingRecRequest(true);
    setInitialRecStatus(isRecording);
    let response: Response;
    if (isRecording) {
      response = await fetch(recordingEndpoint + `/stop?roomName=${room.name}`);
    } else {
      response = await fetch(recordingEndpoint + `/start?roomName=${room.name}`);
    }
    if (response.ok) {
    } else {
      console.error(
        'Error handling recording request, check server logs:',
        response.status,
        response.statusText,
      );
      setProcessingRecRequest(false);
    }
  };

  // Don't render if settings menu is not open (when not managed by VideoConference)
  if (!isSettingsOpen && !layoutContext?.widget.state?.settings) {
    // Still render but hidden - let CSS handle visibility
    // This allows LiveKit to wrap it in modal when it opens
  }
  
  return (
    <div 
      className="settings-menu" 
      data-lk-settings-menu-open={isSettingsOpen ? "true" : "false"}
      aria-hidden={!isSettingsOpen}
      {...props}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div className={styles.tabs}>
          {tabs.map(
            (tab) =>
              settings[tab] && tab !== 'media' && (
                <button
                  className={`${styles.tab} lk-button`}
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  aria-pressed={tab === activeTab}
                  aria-label={
                    // @ts-ignore
                    settings[tab].label
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '12px',
                    minWidth: '48px',
                    minHeight: '48px',
                  }}
                >
                  {tab === 'recording' && (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" fill="red"/>
                      <circle cx="12" cy="12" r="3" fill="white"/>
                    </svg>
                  )}
                </button>
              ),
          )}
        </div>
        <button
          className={`lk-button`}
          onClick={closeSettingsMenu}
          aria-label="Close settings"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px',
            minWidth: '48px',
            minHeight: '48px',
            cursor: 'pointer',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M18 6L6 18M6 6L18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      <div className="tab-content">
        {activeTab === 'media' && (
          <>
            {/* Camera Section */}
            {settings.media && settings.media.camera && (
              <>
                <h3 
                  onClick={() => toggleSection('camera')}
                  style={{ 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    margin: '0 0 8px 0',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                >
                  <span>Camera</span>
                  <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    style={{ 
                      transform: expandedSections.camera ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                  >
                    <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </h3>
                {expandedSections.camera && (
                  <section>
                    <CameraSettings />
                  </section>
                )}
              </>
            )}
            
            {/* Microphone Section */}
            {settings.media && settings.media.microphone && (
              <>
                <h3 
                  onClick={() => toggleSection('microphone')}
                  style={{ 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    margin: '8px 0 8px 0',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                >
                  <span>Microphone</span>
                  <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    style={{ 
                      transform: expandedSections.microphone ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                  >
                    <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </h3>
                {expandedSections.microphone && (
                  <section>
                    <MicrophoneSettings />
                  </section>
                )}
              </>
            )}
            
            {/* Speaker & Headphones Section */}
            {settings.media && settings.media.speaker && (
              <>
                <h3 
                  onClick={() => toggleSection('speaker')}
                  style={{ 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    margin: '8px 0 8px 0',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                >
                  <span>Speaker & Headphones</span>
                  <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    style={{ 
                      transform: expandedSections.speaker ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                  >
                    <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </h3>
                {expandedSections.speaker && (
                  <section className="lk-button-group">
                    <span 
                      className="lk-button" 
                      aria-label="Audio Output"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '12px',
                        minWidth: '48px',
                        minHeight: '48px',
                      }}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M11 5L6 9H2V15H6L11 19V5Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M15.54 8.46C16.4774 9.39764 17.0039 10.6692 17.0039 11.995C17.0039 13.3208 16.4774 14.5924 15.54 15.53M19.07 4.93C20.9447 6.80528 21.9979 9.34836 21.9979 12C21.9979 14.6516 20.9447 17.1947 19.07 19.07" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <div className="lk-button-group-menu">
                      <MediaDeviceMenu kind="audiooutput">
                        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </MediaDeviceMenu>
                    </div>
                  </section>
                )}
              </>
            )}
            
            {/* Background Blur Quality Section */}
            {settings.media && settings.media.camera && (
              <>
                <h3 
                  onClick={() => toggleSection('blur')}
                  style={{ 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    margin: '8px 0 8px 0',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                >
                  <span>Background Blur Quality</span>
                  <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    style={{ 
                      transform: expandedSections.blur ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                  >
                    <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </h3>
                {expandedSections.blur && (
                  <section>
                  {/* Applying changes indicator */}
                  {isApplyingChanges && (
                    <div style={{
                      marginBottom: '12px',
                      padding: '8px 12px',
                      background: 'rgba(59, 130, 246, 0.15)',
                      borderRadius: '6px',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      fontSize: '12px',
                      color: '#60a5fa',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      <svg 
                        width="14" 
                        height="14" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        style={{ animation: 'spin 1s linear infinite' }}
                      >
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="8" strokeLinecap="round"/>
                      </svg>
                      Applying changes...
                    </div>
                  )}
                  
                  {deviceInfo && (
                    <div style={{ 
                      marginBottom: '12px', 
                      padding: '10px', 
                      background: 'rgba(255, 255, 255, 0.05)', 
                      borderRadius: '8px',
                      fontSize: '13px',
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>Device Info</div>
                      <div>CPU Cores: {deviceInfo.cpuCores}</div>
                      {deviceInfo.deviceMemoryGB && <div>Memory: {deviceInfo.deviceMemoryGB} GB</div>}
                      <div>GPU: {deviceInfo.hasGPU ? '✓ Available' : '✗ Not detected'}</div>
                      <div>Type: {deviceInfo.deviceType}</div>
                      <div>Power Level: <span style={{ 
                        color: deviceInfo.powerLevel === 'high' ? '#10b981' : 
                               deviceInfo.powerLevel === 'medium' ? '#f59e0b' : '#ef4444',
                        fontWeight: 'bold'
                      }}>{deviceInfo.powerLevel.toUpperCase()}</span></div>
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(['low', 'medium', 'high', 'ultra'] as BlurQuality[]).map((quality) => {
                      const impact = getPerformanceImpact(quality);
                      return (
                        <button
                          key={quality}
                          onClick={() => handleBlurQualityChange(quality)}
                          className="lk-button"
                          aria-pressed={blurQuality === quality}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            padding: '12px',
                            border: blurQuality === quality 
                              ? '2px solid #3b82f6' 
                              : '2px solid rgba(255, 255, 255, 0.15)',
                            background: blurQuality === quality 
                              ? 'rgba(59, 130, 246, 0.1)' 
                              : 'rgba(255, 255, 255, 0.05)',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            width: '100%',
                            alignItems: 'center',
                            marginBottom: '4px',
                          }}>
                            <strong style={{ fontSize: '15px', textTransform: 'capitalize' }}>
                              {quality}
                            </strong>
                            {blurQuality === quality && (
                              <span style={{ color: '#3b82f6', fontSize: '18px' }}>✓</span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '6px' }}>
                            {getBlurQualityDescription(quality).split(' - ')[1]}
                          </div>
                          <div style={{ 
                            fontSize: '11px', 
                            opacity: 0.7,
                            display: 'flex',
                            gap: '12px',
                          }}>
                            <span>CPU: {impact.cpuUsage}</span>
                            <span>GPU: {impact.gpuUsage}</span>
                            <span>Memory: {impact.memoryUsage}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  
                  <div style={{ 
                    marginTop: '12px', 
                    padding: '10px', 
                    background: 'rgba(59, 130, 246, 0.1)', 
                    borderRadius: '8px',
                    fontSize: '12px',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#60a5fa' }}>
                      💡 How Quality Settings Work
                    </div>
                    <div style={{ lineHeight: '1.5' }}>
                      <strong>Blur Strength:</strong> 15px (Low) → 45px (Medium) → 90px (High) → 150px (Ultra)
                      <br/><br/>
                      <strong>Segmentation Engine:</strong>
                      <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                        <li>⭐ All quality levels now use MediaPipe Image Segmenter</li>
                        <li>Low: CPU processing for compatibility</li>
                        <li>Medium/High/Ultra: GPU-accelerated for best quality</li>
                      </ul>
                      <strong>System Activity:</strong> Low uses CPU only. Medium/High/Ultra use GPU with 
                      similar processing load - the main difference is visual blur intensity and segmentation quality.
                      <br/><br/>
                      Your device: <strong>{deviceInfo?.powerLevel}</strong> power.
                      Changes apply with a short delay to prevent freezing.
                    </div>
                  </div>
                  </section>
                )}
              </>
            )}
            
            {/* Advanced Segmentation Controls */}
            {settings.media && settings.media.camera && (
              <>
                <h3 
                  onClick={() => toggleSection('segmentation')}
                  style={{ 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    margin: '8px 0 8px 0',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                >
                  <span>Advanced Segmentation Settings</span>
                  <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    style={{ 
                      transform: expandedSections.segmentation ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                  >
                    <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </h3>
                {expandedSections.segmentation && (
                  <section>
                    {/* Applying changes indicator */}
                    {isApplyingChanges && (
                      <div style={{
                        marginBottom: '12px',
                        padding: '8px 12px',
                        background: 'rgba(59, 130, 246, 0.15)',
                        borderRadius: '6px',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        fontSize: '12px',
                        color: '#60a5fa',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}>
                        <svg 
                          width="14" 
                          height="14" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          style={{ animation: 'spin 1s linear infinite' }}
                        >
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="8" strokeLinecap="round"/>
                        </svg>
                        Applying changes...
                      </div>
                    )}
                    
                    <div style={{ 
                    marginBottom: '16px',
                    padding: '12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: '8px',
                    }}>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                          Custom Segmentation
                        </div>
                        <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '2px' }}>
                          Fine-tune blur settings for your lighting conditions
                        </div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={useCustomSegmentation}
                          onChange={(e) => handleToggleCustomSegmentation(e.target.checked)}
                          style={{ 
                            width: '18px', 
                            height: '18px',
                            cursor: 'pointer',
                          }}
                        />
                      </label>
                    </div>
                    
                    {!useCustomSegmentation && (
                      <div style={{ 
                        fontSize: '11px', 
                        opacity: 0.6,
                        fontStyle: 'italic',
                      }}>
                        Enable to adjust blur strength, edge quality, and performance settings
                      </div>
                    )}
                  </div>
                  
                  {useCustomSegmentation && (
                    <>
                      {/* Blur Strength Slider */}
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          marginBottom: '8px',
                          alignItems: 'center',
                        }}>
                          <label style={{ fontWeight: '500', fontSize: '14px' }}>
                            Blur Strength
                          </label>
                          <span style={{ 
                            fontSize: '13px', 
                            fontWeight: 'bold',
                            color: '#60a5fa',
                            minWidth: '35px',
                            textAlign: 'right',
                          }}>
                            {customSegmentation.blurRadius}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="100"
                          step="5"
                          value={customSegmentation.blurRadius}
                          onChange={(e) => handleCustomSegmentationChange('blurRadius', parseInt(e.target.value))}
                          style={{ width: '100%', cursor: 'pointer' }}
                        />
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          fontSize: '11px',
                          opacity: 0.6,
                          marginTop: '4px',
                        }}>
                          <span>Light (10)</span>
                          <span>Strong (100)</span>
                        </div>
                        <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '6px', fontStyle: 'italic' }}>
                          Higher values = stronger background blur
                        </div>
                      </div>
                      
                      {/* Edge Quality Slider */}
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          marginBottom: '8px',
                          alignItems: 'center',
                        }}>
                          <label style={{ fontWeight: '500', fontSize: '14px' }}>
                            Edge Quality (Feather)
                          </label>
                          <span style={{ 
                            fontSize: '13px', 
                            fontWeight: 'bold',
                            color: '#60a5fa',
                            minWidth: '35px',
                            textAlign: 'right',
                          }}>
                            {(customSegmentation.edgeFeather * 100).toFixed(0)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={customSegmentation.edgeFeather}
                          onChange={(e) => handleCustomSegmentationChange('edgeFeather', parseFloat(e.target.value))}
                          style={{ width: '100%', cursor: 'pointer' }}
                        />
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          fontSize: '11px',
                          opacity: 0.6,
                          marginTop: '4px',
                        }}>
                          <span>Sharp (0%)</span>
                          <span>Soft (100%)</span>
                        </div>
                        <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '6px', fontStyle: 'italic' }}>
                          Controls edge smoothness - increase if you see jagged edges
                        </div>
                      </div>
                      
                      {/* Toggle Options */}
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '12px',
                        marginTop: '16px',
                      }}>
                        {/* Enhanced Person Detection Toggle - MOST IMPORTANT */}
                        <div style={{
                          background: 'rgba(96, 165, 250, 0.15)',
                          borderRadius: '6px',
                          border: '2px solid rgba(96, 165, 250, 0.4)',
                          padding: '10px',
                        }}>
                          <label style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: '600', fontSize: '13px', color: '#60a5fa' }}>
                                🎯 Enhanced Person Detection
                              </div>
                              <div style={{ fontSize: '11px', opacity: 0.9, marginTop: '2px' }}>
                                Advanced algorithms to reduce false background detections
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={customSegmentation.useEnhancedPersonModel}
                              onChange={(e) => handleCustomSegmentationChange('useEnhancedPersonModel', e.target.checked)}
                              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            />
                          </label>
                          
                          {/* Detailed explanation when enabled */}
                          {customSegmentation.useEnhancedPersonModel && (
                            <div style={{
                              marginTop: '10px',
                              paddingTop: '10px',
                              borderTop: '1px solid rgba(96, 165, 250, 0.3)',
                              fontSize: '11px',
                              lineHeight: '1.5',
                            }}>
                              <div style={{ fontWeight: '600', marginBottom: '6px', color: '#60a5fa' }}>
                                Active Enhancements:
                              </div>
                              <ul style={{ margin: '0', paddingLeft: '20px' }}>
                                <li>✓ Confidence threshold filtering (removes uncertain areas)</li>
                                <li>✓ Morphological noise removal (eliminates small artifacts)</li>
                                <li>✓ Largest component isolation (focuses on main person)</li>
                                <li>✓ Minimum area filtering (blocks tiny false detections)</li>
                              </ul>
                              <div style={{ 
                                marginTop: '8px', 
                                fontStyle: 'italic',
                                opacity: 0.8,
                              }}>
                                These algorithms significantly reduce false positives from objects like
                                chairs, lamps, plants, and other background items that might be mistaken
                                for a person.
                              </div>
                              <div style={{ 
                                marginTop: '10px',
                                padding: '8px',
                                background: 'rgba(251, 191, 36, 0.2)',
                                borderRadius: '4px',
                                fontSize: '10px',
                                border: '1px solid rgba(251, 191, 36, 0.4)',
                              }}>
                                ⚠️ <strong>Note:</strong> Enhanced person detection algorithms are configured 
                                but require custom processor integration to be fully active. Check browser console 
                                for details on applied settings.
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Edge Refinement Toggle */}
                        <label style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          padding: '10px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}>
                          <div>
                            <div style={{ fontWeight: '500', fontSize: '13px' }}>
                              Edge Refinement
                            </div>
                            <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>
                              Advanced edge smoothing post-processing
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={customSegmentation.enableEdgeRefinement}
                            onChange={(e) => handleCustomSegmentationChange('enableEdgeRefinement', e.target.checked)}
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                          />
                        </label>
                        
                        {/* Temporal Smoothing Toggle */}
                        <label style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          padding: '10px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}>
                          <div>
                            <div style={{ fontWeight: '500', fontSize: '13px' }}>
                              Temporal Smoothing
                            </div>
                            <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>
                              Reduces flickering between frames
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={customSegmentation.temporalSmoothing}
                            onChange={(e) => handleCustomSegmentationChange('temporalSmoothing', e.target.checked)}
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                          />
                        </label>
                        
                        {/* GPU Acceleration Toggle */}
                        <label style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          padding: '10px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}>
                          <div>
                            <div style={{ fontWeight: '500', fontSize: '13px' }}>
                              GPU Acceleration
                            </div>
                            <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>
                              Use GPU for better performance (recommended)
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={customSegmentation.useGPU}
                            onChange={(e) => handleCustomSegmentationChange('useGPU', e.target.checked)}
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                          />
                        </label>
                      </div>
                      
                      {/* Reset Button */}
                      <button
                        onClick={() => {
                          const presetSettings = customSettingsFromPreset(blurQuality);
                          setCustomSegmentation(presetSettings);
                          if (window.__setCustomSegmentation) {
                            window.__setCustomSegmentation(presetSettings);
                          }
                        }}
                        className="lk-button"
                        style={{
                          marginTop: '16px',
                          width: '100%',
                          padding: '10px',
                          fontSize: '13px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                        }}
                      >
                        Reset to {blurQuality.charAt(0).toUpperCase() + blurQuality.slice(1)} Preset
                      </button>
                      
                      {/* Tips Panel */}
                      <div style={{ 
                        marginTop: '16px', 
                        padding: '12px', 
                        background: 'rgba(16, 185, 129, 0.1)', 
                        borderRadius: '8px',
                        fontSize: '12px',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                      }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#10b981' }}>
                          💡 Optimization Tips
                        </div>
                        <ul style={{ 
                          margin: '0', 
                          paddingLeft: '20px',
                          lineHeight: '1.6',
                        }}>
                          <li>Changes apply automatically 0.5s after you stop adjusting sliders</li>
                          <li><strong>Enable Enhanced Person Detection</strong> to reduce false positives from background objects</li>
                          <li>Increase Edge Quality if you see jagged outlines</li>
                          <li>Enable Temporal Smoothing to reduce flickering</li>
                          <li>Lower Blur Strength if experiencing performance issues</li>
                          <li>Disable GPU Acceleration if you see visual glitches</li>
                          <li><strong>Good lighting is crucial</strong> - front lighting with simple backgrounds works best</li>
                        </ul>
                      </div>
                    </>
                  )}
                  </section>
                )}
              </>
            )}
            
            {/* MediaPipe Image Segmenter Controls - Show for all quality levels since all use MediaPipe now */}
            {settings.media && settings.media.camera && useCustomSegmentation && (
              <>
                <h3 
                  onClick={() => toggleSection('mediapipe')}
                  style={{ 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    margin: '8px 0 8px 0',
                    background: 'rgba(147, 51, 234, 0.15)',
                    borderRadius: '8px',
                    transition: 'background 0.2s',
                    border: '2px solid rgba(147, 51, 234, 0.3)',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(147, 51, 234, 0.2)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(147, 51, 234, 0.15)'}
                >
                  <span>⭐ MediaPipe Image Segmenter Settings</span>
                  <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    style={{ 
                      transform: expandedSections.mediapipe ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                  >
                    <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </h3>
                {expandedSections.mediapipe && (
                  <section>
                    {/* Applying changes indicator */}
                    {isApplyingChanges && (
                      <div style={{
                        marginBottom: '12px',
                        padding: '8px 12px',
                        background: 'rgba(147, 51, 234, 0.15)',
                        borderRadius: '6px',
                        border: '1px solid rgba(147, 51, 234, 0.3)',
                        fontSize: '12px',
                        color: '#c084fc',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}>
                        <svg 
                          width="14" 
                          height="14" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          style={{ animation: 'spin 1s linear infinite' }}
                        >
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="8" strokeLinecap="round"/>
                        </svg>
                        Applying MediaPipe changes...
                      </div>
                    )}
                    
                    <div style={{ 
                      marginBottom: '16px',
                      padding: '12px',
                      background: 'rgba(147, 51, 234, 0.1)',
                      borderRadius: '8px',
                      border: '1px solid rgba(147, 51, 234, 0.3)',
                      fontSize: '12px',
                      lineHeight: '1.6',
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#c084fc' }}>
                        🎯 About MediaPipe Image Segmenter
                      </div>
                      <div>
                        These controls adjust the <strong>MediaPipe Image Segmentation model</strong> used in 
                        High and Ultra quality modes. This advanced AI model provides superior person detection 
                        compared to the standard processor.
                        <br/><br/>
                        <strong>Fine-tune these settings</strong> based on your lighting, background, and clothing 
                        to get the best blur results.
                      </div>
                    </div>
                    
                    {/* Initialize mediaPipeSettings if not exists */}
                    {!customSegmentation.mediaPipeSettings && (() => {
                      const updated = {
                        ...customSegmentation,
                        mediaPipeSettings: {
                          confidenceThreshold: 0.7,
                          morphologyEnabled: true,
                          morphologyKernelSize: 5,
                          keepLargestComponentOnly: true,
                          minMaskAreaRatio: 0.02,
                          temporalSmoothingAlpha: 0.7,
                        },
                      };
                      setCustomSegmentation(updated);
                      return null;
                    })()}
                    
                    {/* Confidence Threshold Slider */}
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        marginBottom: '8px',
                        alignItems: 'center',
                      }}>
                        <label style={{ fontWeight: '500', fontSize: '14px' }}>
                          Confidence Threshold
                        </label>
                        <span style={{ 
                          fontSize: '13px', 
                          fontWeight: 'bold',
                          color: '#c084fc',
                          minWidth: '35px',
                          textAlign: 'right',
                        }}>
                          {((customSegmentation.mediaPipeSettings?.confidenceThreshold ?? 0.7) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="0.95"
                        step="0.05"
                        value={customSegmentation.mediaPipeSettings?.confidenceThreshold ?? 0.7}
                        onChange={(e) => {
                          handleMediaPipeSettingChange({
                            ...(customSegmentation.mediaPipeSettings || {
                              morphologyEnabled: true,
                              morphologyKernelSize: 5,
                              keepLargestComponentOnly: true,
                              minMaskAreaRatio: 0.02,
                              temporalSmoothingAlpha: 0.7,
                            }),
                            confidenceThreshold: parseFloat(e.target.value),
                          });
                        }}
                        style={{ width: '100%', cursor: 'pointer' }}
                      />
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        fontSize: '11px',
                        opacity: 0.6,
                        marginTop: '4px',
                      }}>
                        <span>Lenient (50%)</span>
                        <span>Strict (95%)</span>
                      </div>
                      <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '6px', fontStyle: 'italic' }}>
                        Higher = stricter person detection, fewer false positives (background blur stays intact)
                      </div>
                    </div>
                    
                    {/* Morphology Kernel Size Slider */}
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        marginBottom: '8px',
                        alignItems: 'center',
                      }}>
                        <label style={{ fontWeight: '500', fontSize: '14px' }}>
                          Noise Removal Strength
                        </label>
                        <span style={{ 
                          fontSize: '13px', 
                          fontWeight: 'bold',
                          color: '#c084fc',
                          minWidth: '35px',
                          textAlign: 'right',
                        }}>
                          {customSegmentation.mediaPipeSettings?.morphologyKernelSize ?? 5}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="3"
                        max="9"
                        step="2"
                        value={customSegmentation.mediaPipeSettings?.morphologyKernelSize ?? 5}
                        onChange={(e) => {
                          handleMediaPipeSettingChange({
                            ...(customSegmentation.mediaPipeSettings || {
                              confidenceThreshold: 0.7,
                              morphologyEnabled: true,
                              keepLargestComponentOnly: true,
                              minMaskAreaRatio: 0.02,
                              temporalSmoothingAlpha: 0.7,
                            }),
                            morphologyKernelSize: parseInt(e.target.value),
                          });
                        }}
                        style={{ width: '100%', cursor: 'pointer' }}
                      />
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        fontSize: '11px',
                        opacity: 0.6,
                        marginTop: '4px',
                      }}>
                        <span>Light (3)</span>
                        <span>Strong (9)</span>
                      </div>
                      <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '6px', fontStyle: 'italic' }}>
                        Removes small noise and artifacts from the segmentation mask
                      </div>
                    </div>
                    
                    {/* Minimum Mask Area Slider */}
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        marginBottom: '8px',
                        alignItems: 'center',
                      }}>
                        <label style={{ fontWeight: '500', fontSize: '14px' }}>
                          Minimum Mask Area
                        </label>
                        <span style={{ 
                          fontSize: '13px', 
                          fontWeight: 'bold',
                          color: '#c084fc',
                          minWidth: '35px',
                          textAlign: 'right',
                        }}>
                          {((customSegmentation.mediaPipeSettings?.minMaskAreaRatio ?? 0.02) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.01"
                        max="0.1"
                        step="0.01"
                        value={customSegmentation.mediaPipeSettings?.minMaskAreaRatio ?? 0.02}
                        onChange={(e) => {
                          handleMediaPipeSettingChange({
                            ...(customSegmentation.mediaPipeSettings || {
                              confidenceThreshold: 0.7,
                              morphologyEnabled: true,
                              morphologyKernelSize: 5,
                              keepLargestComponentOnly: true,
                              temporalSmoothingAlpha: 0.7,
                            }),
                            minMaskAreaRatio: parseFloat(e.target.value),
                          });
                        }}
                        style={{ width: '100%', cursor: 'pointer' }}
                      />
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        fontSize: '11px',
                        opacity: 0.6,
                        marginTop: '4px',
                      }}>
                        <span>Tiny (1%)</span>
                        <span>Large (10%)</span>
                      </div>
                      <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '6px', fontStyle: 'italic' }}>
                        Filters out detections smaller than this % of frame - prevents tiny false positives
                      </div>
                    </div>
                    
                    {/* Temporal Smoothing Alpha Slider */}
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        marginBottom: '8px',
                        alignItems: 'center',
                      }}>
                        <label style={{ fontWeight: '500', fontSize: '14px' }}>
                          Temporal Smoothing Factor
                        </label>
                        <span style={{ 
                          fontSize: '13px', 
                          fontWeight: 'bold',
                          color: '#c084fc',
                          minWidth: '35px',
                          textAlign: 'right',
                        }}>
                          {((customSegmentation.mediaPipeSettings?.temporalSmoothingAlpha ?? 0.7) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="0.9"
                        step="0.05"
                        value={customSegmentation.mediaPipeSettings?.temporalSmoothingAlpha ?? 0.7}
                        onChange={(e) => {
                          handleMediaPipeSettingChange({
                            ...(customSegmentation.mediaPipeSettings || {
                              confidenceThreshold: 0.7,
                              morphologyEnabled: true,
                              morphologyKernelSize: 5,
                              keepLargestComponentOnly: true,
                              minMaskAreaRatio: 0.02,
                            }),
                            temporalSmoothingAlpha: parseFloat(e.target.value),
                          });
                        }}
                        style={{ width: '100%', cursor: 'pointer' }}
                      />
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        fontSize: '11px',
                        opacity: 0.6,
                        marginTop: '4px',
                      }}>
                        <span>More Smoothing (50%)</span>
                        <span>More Responsive (90%)</span>
                      </div>
                      <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '6px', fontStyle: 'italic' }}>
                        Lower = smoother but laggy, Higher = responsive but may flicker
                      </div>
                    </div>
                    
                    {/* Toggle Options */}
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '12px',
                      marginTop: '16px',
                    }}>
                      {/* Morphology Enabled Toggle */}
                      <label style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        padding: '10px',
                        background: 'rgba(147, 51, 234, 0.08)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        border: '1px solid rgba(147, 51, 234, 0.2)',
                      }}>
                        <div>
                          <div style={{ fontWeight: '500', fontSize: '13px' }}>
                            Enable Morphological Operations
                          </div>
                          <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>
                            Apply erosion/dilation to clean up mask edges
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={customSegmentation.mediaPipeSettings?.morphologyEnabled ?? true}
                          onChange={(e) => {
                            handleMediaPipeSettingChange({
                              ...(customSegmentation.mediaPipeSettings || {
                                confidenceThreshold: 0.7,
                                morphologyKernelSize: 5,
                                keepLargestComponentOnly: true,
                                minMaskAreaRatio: 0.02,
                                temporalSmoothingAlpha: 0.7,
                              }),
                              morphologyEnabled: e.target.checked,
                            });
                          }}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                      </label>
                      
                      {/* Keep Largest Component Toggle */}
                      <label style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        padding: '10px',
                        background: 'rgba(147, 51, 234, 0.08)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        border: '1px solid rgba(147, 51, 234, 0.2)',
                      }}>
                        <div>
                          <div style={{ fontWeight: '500', fontSize: '13px' }}>
                            Keep Only Largest Person
                          </div>
                          <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>
                            Focus on main person, blur any others
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={customSegmentation.mediaPipeSettings?.keepLargestComponentOnly ?? true}
                          onChange={(e) => {
                            handleMediaPipeSettingChange({
                              ...(customSegmentation.mediaPipeSettings || {
                                confidenceThreshold: 0.7,
                                morphologyEnabled: true,
                                morphologyKernelSize: 5,
                                minMaskAreaRatio: 0.02,
                                temporalSmoothingAlpha: 0.7,
                              }),
                              keepLargestComponentOnly: e.target.checked,
                            });
                          }}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                      </label>
                    </div>
                    
                    {/* Reset Button */}
                    <button
                      onClick={() => {
                        const presetSettings = customSettingsFromPreset(blurQuality);
                        setCustomSegmentation(presetSettings);
                        if (window.__setCustomSegmentation) {
                          window.__setCustomSegmentation(presetSettings);
                        }
                      }}
                      className="lk-button"
                      style={{
                        marginTop: '16px',
                        width: '100%',
                        padding: '10px',
                        fontSize: '13px',
                        background: 'rgba(147, 51, 234, 0.15)',
                        border: '1px solid rgba(147, 51, 234, 0.3)',
                      }}
                    >
                      Reset MediaPipe Settings to {blurQuality.charAt(0).toUpperCase() + blurQuality.slice(1)} Defaults
                    </button>
                    
                    {/* Advanced Tips Panel */}
                    <div style={{ 
                      marginTop: '16px', 
                      padding: '12px', 
                      background: 'rgba(251, 146, 60, 0.1)', 
                      borderRadius: '8px',
                      fontSize: '12px',
                      border: '1px solid rgba(251, 146, 60, 0.3)',
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#fb923c' }}>
                        🔧 MediaPipe Tuning Guide
                      </div>
                      <ul style={{ 
                        margin: '0', 
                        paddingLeft: '20px',
                        lineHeight: '1.6',
                      }}>
                        <li><strong>If background items are unblurred:</strong> Increase Confidence Threshold (70-85%)</li>
                        <li><strong>If you&apos;re getting blurred:</strong> Decrease Confidence Threshold (50-65%)</li>
                        <li><strong>If mask has holes/gaps:</strong> Increase Noise Removal Strength (7-9)</li>
                        <li><strong>If edges are too rough:</strong> Increase Edge Quality in previous section</li>
                        <li><strong>If blur flickers:</strong> Lower Temporal Smoothing Factor (50-60%)</li>
                        <li><strong>If blur lags behind movements:</strong> Increase Temporal Smoothing Factor (80-90%)</li>
                        <li>Enable both toggles for best results in complex scenes</li>
                      </ul>
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}
        {activeTab === 'recording' && (
          <>
            <h3>Record Meeting</h3>
            <section>
              <p>
                {isRecording
                  ? 'Meeting is currently being recorded'
                  : 'No active recordings for this meeting'}
              </p>
              <button 
                className="lk-button"
                disabled={processingRecRequest} 
                onClick={() => toggleRoomRecording()}
                aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
                style={{
                  background: isRecording ? '#dc2626' : '#3b82f6',
                  border: 'none',
                  color: 'white',
                  padding: '16px',
                  borderRadius: '50%',
                  fontWeight: 600,
                  cursor: processingRecRequest ? 'not-allowed' : 'pointer',
                  opacity: processingRecRequest ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '56px',
                  height: '56px',
                }}
              >
                {isRecording ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <rect x="6" y="6" width="12" height="12" fill="white" rx="2"/>
                  </svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" fill="white"/>
                  </svg>
                )}
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
