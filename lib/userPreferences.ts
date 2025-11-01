/**
 * User Preferences Management
 * 
 * Provides utilities for saving and loading user preferences in local storage
 */

import { BlurQuality, CustomSegmentationSettings } from './BlurConfig';
import type { VideoCodec } from 'livekit-client';

export type VideoResolution = '480p' | '720p' | '1080p' | '1440p' | '4K';
export type VideoFramerate = 15 | 24 | 30 | 60;
export type VideoQualityPreset = 'auto' | 'standard' | 'high' | 'ultra';

export interface VideoQualitySettings {
  /** Quality preset or 'auto' for automatic selection */
  preset: VideoQualityPreset;
  /** Resolution override (only used if preset is not 'auto') */
  resolution?: VideoResolution;
  /** Frame rate (15, 24, 30, or 60 fps) */
  framerate?: VideoFramerate;
  /** Maximum bitrate in bps (overrides preset if set) */
  maxBitrate?: number;
  /** Video codec preference */
  codec?: VideoCodec;
  /** Enable dynacast (dynamic broadcasting) */
  dynacast?: boolean;
  /** Enable adaptive stream */
  adaptiveStream?: boolean;
}

export interface UserPreferences {
  // Video preferences
  videoEnabled: boolean;
  videoDeviceId?: string;
  backgroundType: 'none' | 'blur' | 'image' | 'gradient' | 'custom-video' | 'custom-image';
  backgroundPath?: string; // For static images/gradients, or custom background ID
  blurQuality: BlurQuality;

  // Video quality settings (LiveKit v2 enhancements)
  videoQuality?: VideoQualitySettings;

  // Segmentation customization
  useCustomSegmentation?: boolean; // Whether to use custom settings instead of presets
  customSegmentation?: CustomSegmentationSettings;

  // Layout preferences
  videoLayout?: 'auto' | 'grid' | 'pip'; // auto = adaptive based on participant count
  preferredOrientation?: 'portrait' | 'landscape' | 'auto'; // auto = follow device orientation

  // Audio preferences
  audioEnabled: boolean;
  audioDeviceId?: string;
  noiseFilterEnabled: boolean;

  // User info
  username?: string;
}

const STORAGE_KEY = 'livekit-user-preferences';

/**
 * Gets default user preferences
 */
export function getDefaultPreferences(): UserPreferences {
  return {
    videoEnabled: true,
    backgroundType: 'blur', // Blur enabled by default
    blurQuality: 'medium',
    videoLayout: 'auto', // Adaptive layout based on participant count
    preferredOrientation: 'auto', // Follow device orientation automatically
    audioEnabled: true,
    noiseFilterEnabled: true,
    videoQuality: {
      preset: 'auto', // Auto-detect best quality based on device
      framerate: 30,
      dynacast: true,
      adaptiveStream: true,
    },
  };
}

/**
 * Loads user preferences from local storage
 * Returns default preferences if none are stored
 */
export function loadUserPreferences(): UserPreferences {
  if (typeof window === 'undefined') {
    return getDefaultPreferences();
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle new preference keys
      return { ...getDefaultPreferences(), ...parsed };
    }
  } catch (error) {
    console.error('Failed to load user preferences:', error);
  }

  return getDefaultPreferences();
}

/**
 * Saves user preferences to local storage
 */
export function saveUserPreferences(preferences: Partial<UserPreferences>): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const current = loadUserPreferences();
    const updated = { ...current, ...preferences };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    console.log('[UserPreferences] Saved preferences:', updated);
  } catch (error) {
    console.error('Failed to save user preferences:', error);
  }
}

/**
 * Updates a specific preference
 */
export function updatePreference<K extends keyof UserPreferences>(
  key: K,
  value: UserPreferences[K]
): void {
  saveUserPreferences({ [key]: value } as Partial<UserPreferences>);
}

/**
 * Clears all user preferences
 */
export function clearUserPreferences(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[UserPreferences] Cleared all preferences');
  } catch (error) {
    console.error('Failed to clear user preferences:', error);
  }
}



