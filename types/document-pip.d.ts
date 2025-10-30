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
  request(options?: DocumentPictureInPictureOptions): Promise<Window>;
}

interface Window {
  documentPictureInPicture?: DocumentPictureInPicture;
}

