'use client';
import React from 'react';
import { 
  loadUserPreferences, 
  saveUserPreferences,
  VideoQualitySettings as VideoQualitySettingsType,
  VideoResolution,
  VideoFramerate,
  VideoQualityPreset
} from './userPreferences';
import type { VideoCodec } from 'livekit-client';

/**
 * Video Quality Settings Component
 * 
 * Provides controls for adjusting video quality settings including:
 * - Resolution (480p, 720p, 1080p, 1440p, 4K)
 * - Frame rate (15, 24, 30, 60 fps)
 * - Bitrate (with presets or custom)
 * - Video codec (VP8, VP9, H.264, AV1)
 * - Advanced options (dynacast, adaptive stream)
 */
export function VideoQualitySettings() {
  const [videoQuality, setVideoQuality] = React.useState<VideoQualitySettingsType>(() => {
    const prefs = loadUserPreferences();
    return prefs.videoQuality || {
      preset: 'auto',
      framerate: 30,
      dynacast: true,
      adaptiveStream: true,
    };
  });

  const [showAdvanced, setShowAdvanced] = React.useState(false);

  // Resolution presets with recommended bitrates
  const resolutionPresets: Record<VideoResolution, { width: number; height: number; recommendedBitrate: number }> = {
    '480p': { width: 640, height: 480, recommendedBitrate: 1_000_000 },
    '720p': { width: 1280, height: 720, recommendedBitrate: 2_000_000 },
    '1080p': { width: 1920, height: 1080, recommendedBitrate: 3_000_000 },
    '1440p': { width: 2560, height: 1440, recommendedBitrate: 5_000_000 },
    '4K': { width: 3840, height: 2160, recommendedBitrate: 10_000_000 },
  };

  // Quality presets with settings
  const qualityPresets: Record<VideoQualityPreset, { resolution: VideoResolution; bitrate: number; framerate: VideoFramerate }> = {
    'auto': { resolution: '720p', bitrate: 2_000_000, framerate: 30 }, // Will be auto-detected
    'standard': { resolution: '720p', bitrate: 2_000_000, framerate: 30 },
    'high': { resolution: '1080p', bitrate: 3_000_000, framerate: 30 },
    'ultra': { resolution: '1440p', bitrate: 5_000_000, framerate: 60 },
  };

  const handlePresetChange = (preset: VideoQualityPreset) => {
    const newSettings: VideoQualitySettingsType = {
      ...videoQuality,
      preset,
    };

    // Apply preset values if not 'auto'
    if (preset !== 'auto') {
      const presetValues = qualityPresets[preset];
      newSettings.resolution = presetValues.resolution;
      newSettings.maxBitrate = presetValues.bitrate;
      newSettings.framerate = presetValues.framerate;
    } else {
      // Clear manual overrides for auto mode
      delete newSettings.resolution;
      delete newSettings.maxBitrate;
    }

    setVideoQuality(newSettings);
    saveUserPreferences({ videoQuality: newSettings });
  };

  const handleResolutionChange = (resolution: VideoResolution) => {
    const newSettings: VideoQualitySettingsType = {
      ...videoQuality,
      resolution,
      preset: 'auto', // Switching to manual resolution means leaving auto preset
    };

    // Auto-adjust bitrate based on resolution if not manually set
    if (!videoQuality.maxBitrate || videoQuality.preset !== 'auto') {
      newSettings.maxBitrate = resolutionPresets[resolution].recommendedBitrate;
    }

    setVideoQuality(newSettings);
    saveUserPreferences({ videoQuality: newSettings });
  };

  const handleFramerateChange = (framerate: VideoFramerate) => {
    const newSettings: VideoQualitySettingsType = {
      ...videoQuality,
      framerate,
      preset: 'auto', // Manual framerate means leaving auto preset
    };
    setVideoQuality(newSettings);
    saveUserPreferences({ videoQuality: newSettings });
  };

  const handleBitrateChange = (bitrate: number) => {
    const newSettings: VideoQualitySettingsType = {
      ...videoQuality,
      maxBitrate: bitrate,
      preset: 'auto', // Manual bitrate means leaving auto preset
    };
    setVideoQuality(newSettings);
    saveUserPreferences({ videoQuality: newSettings });
  };

  const handleCodecChange = (codec: VideoCodec | 'auto') => {
    const newSettings: VideoQualitySettingsType = {
      ...videoQuality,
      codec: codec === 'auto' ? undefined : codec,
    };
    setVideoQuality(newSettings);
    saveUserPreferences({ videoQuality: newSettings });
  };

  const handleToggleAdvanced = (key: 'dynacast' | 'adaptiveStream', enabled: boolean) => {
    const newSettings: VideoQualitySettingsType = {
      ...videoQuality,
      [key]: enabled,
    };
    setVideoQuality(newSettings);
    saveUserPreferences({ videoQuality: newSettings });
  };

  const currentResolution = videoQuality.resolution || (videoQuality.preset === 'auto' ? 'auto' : qualityPresets[videoQuality.preset].resolution);
  const currentBitrate = videoQuality.maxBitrate || (videoQuality.preset === 'auto' ? qualityPresets.standard.bitrate : qualityPresets[videoQuality.preset].bitrate);
  const currentFramerate = videoQuality.framerate || qualityPresets.standard.framerate;

  // Color mapping for presets
  const getPresetColors = (preset: VideoQualityPreset, isSelected: boolean) => {
    const colors = {
      auto: { border: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', icon: '#10b981' },
      standard: { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', icon: '#3b82f6' },
      high: { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', icon: '#f59e0b' },
      ultra: { border: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', icon: '#a855f7' },
    };
    const presetColors = colors[preset];
    return {
      border: isSelected ? `2px solid ${presetColors.border}` : '2px solid rgba(255, 255, 255, 0.15)',
      background: isSelected ? presetColors.bg : 'rgba(255, 255, 255, 0.05)',
      textColor: presetColors.text,
      iconColor: presetColors.icon,
    };
  };

  // Color mapping for resolutions
  const getResolutionColors = (resolution: VideoResolution, isSelected: boolean) => {
    const colors = {
      '480p': { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171' },
      '720p': { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24' },
      '1080p': { border: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399' },
      '1440p': { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa' },
      '4K': { border: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc' },
    };
    const resColors = colors[resolution];
    return {
      border: isSelected ? `2px solid ${resColors.border}` : '2px solid rgba(255, 255, 255, 0.15)',
      background: isSelected ? resColors.bg : 'rgba(255, 255, 255, 0.05)',
      textColor: resColors.text,
    };
  };

  // Color mapping for frame rates
  const getFramerateColors = (fps: VideoFramerate, isSelected: boolean) => {
    const colors = {
      15: { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171' },
      24: { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24' },
      30: { border: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399' },
      60: { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa' },
    };
    const fpsColors = colors[fps];
    return {
      border: isSelected ? `2px solid ${fpsColors.border}` : '2px solid rgba(255, 255, 255, 0.15)',
      background: isSelected ? fpsColors.bg : 'rgba(255, 255, 255, 0.05)',
      textColor: fpsColors.text,
    };
  };

  // Color mapping for codecs
  const getCodecColors = (codec: string, isSelected: boolean) => {
    const colors: Record<string, { border: string; bg: string; text: string }> = {
      auto: { border: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' },
      vp8: { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa' },
      vp9: { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', text: '#a78bfa' },
      h264: { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24' },
      av1: { border: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)', text: '#f472b6' },
    };
    const codecColors = colors[codec] || colors.auto;
    return {
      border: isSelected ? `2px solid ${codecColors.border}` : '2px solid rgba(255, 255, 255, 0.15)',
      background: isSelected ? codecColors.bg : 'rgba(255, 255, 255, 0.05)',
      textColor: codecColors.text,
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Quality Preset Selector */}
      <div>
        <label style={{ 
          display: 'block', 
          fontWeight: '600', 
          fontSize: '14px', 
          marginBottom: '10px',
          color: '#e5e7eb',
        }}>
          Quality Preset
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(['auto', 'standard', 'high', 'ultra'] as VideoQualityPreset[]).map((preset) => {
            const presetInfo = qualityPresets[preset];
            const isSelected = videoQuality.preset === preset;
            const colors = getPresetColors(preset, isSelected);
            return (
              <button
                key={preset}
                onClick={() => handlePresetChange(preset)}
                className="lk-button"
                aria-pressed={isSelected}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  padding: '12px',
                  border: colors.border,
                  background: colors.background,
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  width: '100%',
                  alignItems: 'center',
                  marginBottom: '4px',
                }}>
                  <strong style={{ 
                    fontSize: '15px', 
                    textTransform: 'capitalize',
                    color: colors.textColor,
                  }}>
                    {preset === 'auto' ? '✨ Auto (Recommended)' : `● ${preset}`}
                  </strong>
                  {isSelected && (
                    <span style={{ color: colors.iconColor, fontSize: '18px', fontWeight: 'bold' }}>✓</span>
                  )}
                </div>
                {preset !== 'auto' && (
                  <div style={{ 
                    fontSize: '12px', 
                    opacity: 0.85,
                    color: '#d1d5db',
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                  }}>
                    <span style={{ color: colors.textColor, fontWeight: '500' }}>
                      {presetInfo.resolution.toUpperCase()}
                    </span>
                    <span style={{ opacity: 0.5 }}>•</span>
                    <span>{presetInfo.bitrate / 1_000_000} Mbps</span>
                    <span style={{ opacity: 0.5 }}>•</span>
                    <span>{presetInfo.framerate} fps</span>
                  </div>
                )}
                {preset === 'auto' && (
                  <div style={{ fontSize: '12px', opacity: 0.85, color: '#d1d5db' }}>
                    Automatically selects best quality based on your device and network
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Manual Override Section (shown when not using auto preset or when manually adjusted) */}
      {(videoQuality.preset !== 'auto' || videoQuality.resolution) && (
        <>
          {/* Resolution Selector */}
          <div>
            <label style={{ 
              display: 'block', 
              fontWeight: '600', 
              fontSize: '14px', 
              marginBottom: '10px',
              color: '#e5e7eb',
            }}>
              Resolution
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {(['480p', '720p', '1080p', '1440p', '4K'] as VideoResolution[]).map((resolution) => {
                const isSelected = videoQuality.resolution === resolution;
                const colors = getResolutionColors(resolution, isSelected);
                return (
                  <button
                    key={resolution}
                    onClick={() => handleResolutionChange(resolution)}
                    className="lk-button"
                    aria-pressed={isSelected}
                    style={{
                      padding: '10px 16px',
                      border: colors.border,
                      background: colors.background,
                      minWidth: '80px',
                      color: isSelected ? colors.textColor : '#d1d5db',
                      fontWeight: isSelected ? '600' : '500',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {resolution}
                    {isSelected && (
                      <span style={{ marginLeft: '8px', color: colors.textColor, fontWeight: 'bold' }}>✓</span>
                    )}
                  </button>
                );
              })}
            </div>
            <div style={{ 
              fontSize: '11px', 
              opacity: 0.8, 
              marginTop: '8px',
              color: '#9ca3af',
            }}>
              <span style={{ fontWeight: '500', color: '#d1d5db' }}>Current:</span>{' '}
              {currentResolution === 'auto' ? (
                <span style={{ color: '#10b981', fontWeight: '500' }}>Auto-detected</span>
              ) : (
                <>
                  <span style={{ color: getResolutionColors(currentResolution as VideoResolution, true).textColor, fontWeight: '600' }}>
                    {currentResolution.toUpperCase()}
                  </span>
                  {resolutionPresets[currentResolution as VideoResolution] && (
                    <span style={{ opacity: 0.6 }}>
                      {' '}({resolutionPresets[currentResolution as VideoResolution].width}x{resolutionPresets[currentResolution as VideoResolution].height})
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Frame Rate Selector */}
          <div>
            <label style={{ 
              display: 'block', 
              fontWeight: '600', 
              fontSize: '14px', 
              marginBottom: '10px',
              color: '#e5e7eb',
            }}>
              Frame Rate
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {([15, 24, 30, 60] as VideoFramerate[]).map((fps) => {
                const isSelected = videoQuality.framerate === fps;
                const colors = getFramerateColors(fps, isSelected);
                return (
                  <button
                    key={fps}
                    onClick={() => handleFramerateChange(fps)}
                    className="lk-button"
                    aria-pressed={isSelected}
                    style={{
                      padding: '10px 16px',
                      border: colors.border,
                      background: colors.background,
                      minWidth: '70px',
                      color: isSelected ? colors.textColor : '#d1d5db',
                      fontWeight: isSelected ? '600' : '500',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {fps} fps
                    {isSelected && (
                      <span style={{ marginLeft: '8px', color: colors.textColor, fontWeight: 'bold' }}>✓</span>
                    )}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '8px', color: '#9ca3af' }}>
              Higher frame rates = smoother motion but more bandwidth (60fps recommended for high-end cameras)
            </div>
          </div>

          {/* Bitrate Slider */}
          <div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginBottom: '8px',
              alignItems: 'center',
            }}>
              <label style={{ 
              fontWeight: '600', 
              fontSize: '14px',
              color: '#e5e7eb',
            }}>
                Video Bitrate
              </label>
              <span style={{ 
                fontSize: '13px', 
                fontWeight: 'bold',
                color: '#60a5fa',
                minWidth: '80px',
                textAlign: 'right',
                padding: '2px 8px',
                background: 'rgba(96, 165, 250, 0.1)',
                borderRadius: '6px',
                border: '1px solid rgba(96, 165, 250, 0.3)',
              }}>
                {(currentBitrate / 1_000_000).toFixed(1)} Mbps
              </span>
            </div>
            <input
              type="range"
              min="500000"
              max="10000000"
              step="100000"
              value={currentBitrate}
              onChange={(e) => handleBitrateChange(parseInt(e.target.value))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              fontSize: '11px',
              opacity: 0.7,
              marginTop: '4px',
              color: '#9ca3af',
            }}>
              <span style={{ color: '#ef4444' }}>Low (0.5 Mbps)</span>
              <span style={{ color: '#10b981' }}>High (10 Mbps)</span>
            </div>
            <div style={{ 
              fontSize: '11px', 
              opacity: 0.8, 
              marginTop: '8px',
              color: '#9ca3af',
            }}>
              Higher bitrate = better quality and color accuracy but more bandwidth.{' '}
              <span style={{ color: '#60a5fa', fontWeight: '500' }}>
                Recommended: {videoQuality.resolution ? resolutionPresets[videoQuality.resolution].recommendedBitrate / 1_000_000 : '2-3'} Mbps for {videoQuality.resolution || '720p'}
              </span>.
            </div>
          </div>
        </>
      )}

      {/* Video Codec Selector */}
      <div>
        <label style={{ 
          display: 'block', 
          fontWeight: '600', 
          fontSize: '14px', 
          marginBottom: '10px',
          color: '#e5e7eb',
        }}>
          Video Codec
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {(['auto', 'vp8', 'vp9', 'h264', 'av1'] as const).map((codec) => {
            const displayCodec = codec === 'auto' ? '✨ Auto (Recommended)' : codec.toUpperCase();
            const isSelected = (codec === 'auto' && !videoQuality.codec) || videoQuality.codec === codec;
            const colors = getCodecColors(codec, isSelected);
            
            return (
              <button
                key={codec}
                onClick={() => handleCodecChange(codec === 'auto' ? 'auto' : codec as VideoCodec)}
                className="lk-button"
                aria-pressed={isSelected}
                style={{
                  padding: '10px 16px',
                  border: colors.border,
                  background: colors.background,
                  color: isSelected ? colors.textColor : '#d1d5db',
                  fontWeight: isSelected ? '600' : '500',
                  transition: 'all 0.2s ease',
                }}
              >
                {displayCodec}
                {isSelected && (
                  <span style={{ marginLeft: '8px', color: colors.textColor, fontWeight: 'bold' }}>✓</span>
                )}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '8px', color: '#9ca3af' }}>
          VP9/AV1 = better quality but not supported with E2EE. H.264 = most compatible. 
          Auto = best choice for your connection.
        </div>
      </div>

      {/* Advanced Options Toggle */}
      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="lk-button"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            padding: '10px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
          }}
        >
          <span style={{ fontWeight: '600', fontSize: '14px', color: '#e5e7eb' }}>
            Advanced Options
          </span>
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none"
            style={{ 
              transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}
          >
            <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {showAdvanced && (
          <div style={{ 
            marginTop: '12px', 
            padding: '12px', 
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            {/* Dynacast Toggle */}
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '13px', color: '#e5e7eb' }}>
                  Dynacast (Dynamic Broadcasting)
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px', color: '#9ca3af' }}>
                  Automatically pauses high-quality layers when not needed to save bandwidth
                </div>
              </div>
              <input
                type="checkbox"
                checked={videoQuality.dynacast !== false}
                onChange={(e) => handleToggleAdvanced('dynacast', e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </label>

            {/* Adaptive Stream Toggle */}
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '13px', color: '#e5e7eb' }}>
                  Adaptive Stream
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px', color: '#9ca3af' }}>
                  Automatically adjusts quality based on viewer window size and visibility
                </div>
              </div>
              <input
                type="checkbox"
                checked={videoQuality.adaptiveStream !== false}
                onChange={(e) => handleToggleAdvanced('adaptiveStream', e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </label>
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div style={{ 
        marginTop: '8px', 
        padding: '12px', 
        background: 'rgba(59, 130, 246, 0.1)', 
        borderRadius: '8px',
        fontSize: '12px',
        border: '1px solid rgba(59, 130, 246, 0.3)',
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#60a5fa' }}>
          💡 Video Quality Tips
        </div>
        <ul style={{ 
          margin: '0', 
          paddingLeft: '20px',
          lineHeight: '1.6',
        }}>
          <li><strong>For best quality:</strong> Use High (1080p) or Ultra (1440p) preset with 60fps</li>
          <li><strong>For better color:</strong> Increase bitrate to 4-6 Mbps for 1080p, 8-10 Mbps for 1440p</li>
          <li><strong>Note:</strong> Changes take effect on next room join or reconnect</li>
          <li><strong>Mac users:</strong> Your camera supports up to 4K - use Ultra preset for maximum quality</li>
          <li><strong>Network:</strong> Higher settings require stable, fast internet connection</li>
        </ul>
      </div>
    </div>
  );
}

