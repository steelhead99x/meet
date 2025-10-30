# Custom Background Upload Feature

## Overview

Users can now upload their own background videos and images to use as virtual backgrounds during video calls. These custom backgrounds are stored locally in the browser using IndexedDB, ensuring privacy and persistence across sessions.

## Features

### 1. Upload Custom Backgrounds
- **Supported formats**: Videos (MP4, WebM, etc.) and Images (JPG, PNG, etc.)
- **File size limit**: 100MB per file
- **Storage**: Browser IndexedDB (separate from localStorage)
- **Automatic thumbnail generation**: Creates preview thumbnails for easy selection

### 2. Storage Management
- View total storage used by custom backgrounds
- Count of uploaded backgrounds displayed
- Easy deletion of individual backgrounds

### 3. User Experience
- Upload button with visual feedback
- Thumbnail previews with video indicator badge
- One-click deletion with confirmation
- Automatic selection of newly uploaded backgrounds
- Persistent selection across sessions

## Technical Implementation

### Files Created
- **`lib/customBackgrounds.ts`**: Core functionality for managing custom backgrounds
  - IndexedDB integration
  - Thumbnail generation for videos and images
  - Storage management utilities
  - File validation and size limits

### Files Modified
- **`lib/CameraSettings.tsx`**: 
  - Added upload UI
  - Display custom backgrounds alongside preset backgrounds
  - Apply custom backgrounds using VirtualBackground processor
  - Handle deletion and storage display

- **`lib/userPreferences.ts`**:
  - Extended `backgroundType` to include `'custom-video'` and `'custom-image'`
  - Store custom background ID in preferences

### How It Works

1. **Upload Flow**:
   ```typescript
   User clicks upload button
   → File input opens
   → File selected
   → Validation (type, size)
   → Thumbnail generation
   → Save to IndexedDB
   → Display in UI
   → Auto-select
   ```

2. **Storage Structure**:
   ```typescript
   interface CustomBackground {
     id: string;              // Unique identifier
     name: string;            // Original filename
     type: 'video' | 'image'; // File type
     data: Blob;              // Actual file data
     thumbnail: string;       // Base64 thumbnail
     uploadedAt: number;      // Timestamp
     size: number;            // File size in bytes
   }
   ```

3. **Background Application**:
   - Custom backgrounds are loaded on component mount
   - When selected, blob URL is created from stored data
   - VirtualBackground processor uses the blob URL
   - Processor instances are cached for performance
   - Selection persists via user preferences

## Usage

### For Users

1. **Upload a Background**:
   - Open Settings (gear icon)
   - Navigate to Camera section
   - Scroll to "Background Effects"
   - Click the "Upload" button (+ icon)
   - Select a video or image file (max 100MB)
   - Background is automatically applied

2. **Delete a Background**:
   - Hover over a custom background thumbnail
   - Click the red × button in the top-right corner
   - Confirm deletion

3. **Select a Background**:
   - Click on any thumbnail to apply that background
   - Selected background has a blue border
   - Selection is saved and restored on next visit

### For Developers

#### Get All Custom Backgrounds
```typescript
import { getAllCustomBackgrounds } from './lib/customBackgrounds';

const backgrounds = await getAllCustomBackgrounds();
```

#### Save a Custom Background
```typescript
import { saveCustomBackground } from './lib/customBackgrounds';

const file = /* File object */;
const customBg = await saveCustomBackground(file);
```

#### Delete a Custom Background
```typescript
import { deleteCustomBackground } from './lib/customBackgrounds';

await deleteCustomBackground(backgroundId);
```

#### Get Storage Usage
```typescript
import { getTotalStorageUsed, formatBytes } from './lib/customBackgrounds';

const bytes = await getTotalStorageUsed();
const readable = formatBytes(bytes); // e.g., "25.5 MB"
```

## Browser Compatibility

- **IndexedDB**: Supported in all modern browsers
- **File API**: Supported in all modern browsers
- **Canvas API**: Required for thumbnail generation
- **Object URLs**: Required for applying video backgrounds

## Storage Considerations

- **Browser Limits**: IndexedDB typically allows 50MB+ per origin (varies by browser)
- **100MB per file limit**: Prevents excessive storage usage
- **Manual cleanup**: Users must delete backgrounds to free space
- **No automatic expiration**: Backgrounds persist until manually deleted

## Future Enhancements

Potential improvements:
- [ ] Bulk upload multiple files
- [ ] Drag-and-drop upload interface
- [ ] Background preview before applying
- [ ] Cloud sync option for cross-device availability
- [ ] Video trimming/editing tools
- [ ] Import from URL
- [ ] Background effects (filters, animations)
- [ ] Automatic cleanup of old/unused backgrounds

## Security & Privacy

- All files stored locally in browser
- No server upload required
- Files never leave the user's device
- IndexedDB data is origin-specific
- User has complete control over their data

## Troubleshooting

### Upload Fails
- Check file size (must be < 100MB)
- Verify file type (video/* or image/*)
- Ensure browser supports IndexedDB
- Check browser console for errors

### Background Not Applying
- Verify custom background still exists in storage
- Check browser console for processor errors
- Ensure camera track is active
- Try re-selecting the background

### Storage Full
- Delete unused custom backgrounds
- Clear browser data (will remove all custom backgrounds)
- Consider using smaller file sizes
- Compress videos before uploading

## API Reference

See `lib/customBackgrounds.ts` for complete API documentation.

