/**
 * TypeScript definitions for Document Picture-in-Picture API
 * https://developer.chrome.com/docs/web-platform/document-picture-in-picture/
 */

interface DocumentPictureInPictureOptions {
  width?: number;
  height?: number;
  disallowReturnToOpener?: boolean;
}

interface DocumentPictureInPicture extends EventTarget {
  requestWindow(options?: DocumentPictureInPictureOptions): Promise<Window>;
  window: Window | null;
}

interface Window {
  documentPictureInPicture?: DocumentPictureInPicture;
  __getBlurQuality?: () => 'low' | 'medium' | 'high' | 'ultra';
  __setBlurQuality?: (quality: 'low' | 'medium' | 'high' | 'ultra') => void;
  __getUseCustomSegmentation?: () => boolean;
  __setUseCustomSegmentation?: (enabled: boolean) => void;
  __getCustomSegmentation?: () => any;
  __setCustomSegmentation?: (settings: any) => void;
}

