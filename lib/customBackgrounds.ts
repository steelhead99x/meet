/**
 * Custom Background Management
 * 
 * Provides utilities for storing and retrieving custom background videos
 * using IndexedDB for efficient storage of large files
 */

const DB_NAME = 'livekit-custom-backgrounds';
const DB_VERSION = 1;
const STORE_NAME = 'backgrounds';

export interface CustomBackground {
  id: string;
  name: string;
  type: 'video' | 'image';
  data: Blob;
  thumbnail: string; // base64 thumbnail
  uploadedAt: number;
  size: number; // in bytes
}

/**
 * Opens the IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('uploadedAt', 'uploadedAt', { unique: false });
      }
    };
  });
}

/**
 * Generates a thumbnail for a video file
 */
function generateVideoThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    video.onloadeddata = () => {
      // Seek to 1 second or 10% of video duration
      video.currentTime = Math.min(1, video.duration * 0.1);
    };

    video.onseeked = () => {
      try {
        // Set canvas size to match video aspect ratio (max 200px wide)
        const aspectRatio = video.videoHeight / video.videoWidth;
        canvas.width = 200;
        canvas.height = 200 * aspectRatio;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
        
        // Cleanup
        video.src = '';
        URL.revokeObjectURL(video.src);
        
        resolve(thumbnail);
      } catch (error) {
        reject(error);
      }
    };

    video.onerror = () => {
      reject(new Error('Failed to load video'));
    };

    video.src = URL.createObjectURL(file);
  });
}

/**
 * Generates a thumbnail for an image file
 */
function generateImageThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    img.onload = () => {
      try {
        // Set canvas size (max 200px wide)
        const aspectRatio = img.height / img.width;
        canvas.width = 200;
        canvas.height = 200 * aspectRatio;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
        
        // Cleanup
        URL.revokeObjectURL(img.src);
        
        resolve(thumbnail);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Saves a custom background to IndexedDB
 */
export async function saveCustomBackground(file: File): Promise<CustomBackground> {
  const db = await openDB();

  // Validate file
  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');

  if (!isVideo && !isImage) {
    throw new Error('File must be a video or image');
  }

  // Check file size (limit to 100MB)
  const MAX_SIZE = 100 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error('File size must be less than 100MB');
  }

  // Generate thumbnail
  const thumbnail = isVideo 
    ? await generateVideoThumbnail(file)
    : await generateImageThumbnail(file);

  // Create custom background object
  const customBg: CustomBackground = {
    id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: file.name,
    type: isVideo ? 'video' : 'image',
    data: file,
    thumbnail,
    uploadedAt: Date.now(),
    size: file.size,
  };

  // Save to IndexedDB
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(customBg);

    request.onsuccess = () => resolve(customBg);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Gets all custom backgrounds from IndexedDB
 */
export async function getAllCustomBackgrounds(): Promise<CustomBackground[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const backgrounds = request.result as CustomBackground[];
      // Sort by upload date (newest first)
      backgrounds.sort((a, b) => b.uploadedAt - a.uploadedAt);
      resolve(backgrounds);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Gets a custom background by ID
 */
export async function getCustomBackground(id: string): Promise<CustomBackground | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Deletes a custom background by ID
 */
export async function deleteCustomBackground(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clears all custom backgrounds
 */
export async function clearAllCustomBackgrounds(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Gets the total storage used by custom backgrounds
 */
export async function getTotalStorageUsed(): Promise<number> {
  const backgrounds = await getAllCustomBackgrounds();
  return backgrounds.reduce((total, bg) => total + bg.size, 0);
}

/**
 * Formats bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

