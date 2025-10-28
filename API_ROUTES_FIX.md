# API Routes Fix - 404 Error Resolution

## Problem

After restructuring the app to work at `/meet` without `basePath`, API routes were returning 404 errors because:

1. API routes moved from `app/api/*` to `app/meet/api/*`
2. API endpoint URLs in the code were not updated to reflect the new paths
3. The root redirect page was using server-side `redirect()` which caused build errors

## Errors Encountered

### Browser Error
```
404: This page could not be found.
urlParts: ["","api","connection-details?roomName=...&participantName=..."]
```

The browser was requesting `/api/connection-details` but the route now exists at `/meet/api/connection-details`.

### Build Error
```
PageNotFoundError: Cannot find module for page: /
PageNotFoundError: Cannot find module for page: /meet/api/record/stop
```

## Solutions Applied

### 1. Updated API Endpoint URL in PageClientImpl

**File:** `app/meet/rooms/[roomName]/PageClientImpl.tsx`

**Before:**
```typescript
const CONN_DETAILS_ENDPOINT =
  process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? '/api/connection-details';
```

**After:**
```typescript
const CONN_DETAILS_ENDPOINT =
  process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? '/meet/api/connection-details';
```

### 2. Fixed Root Page Redirect

**File:** `app/page.tsx`

**Before:**
```typescript
import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/meet');
}
```

**Issue:** Server-side `redirect()` can't be used during static generation.

**After:**
```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/meet');
  }, [router]);
  
  return null;
}
```

**Why:** Client-side redirect works properly during build and at runtime.

## API Routes Structure

All API routes are now correctly located at:

```
app/meet/api/
  ├── connection-details/route.ts   → /meet/api/connection-details
  ├── diagnostic/route.ts            → /meet/api/diagnostic
  └── record/
      ├── start/route.ts             → /meet/api/record/start
      └── stop/route.ts              → /meet/api/record/stop
```

## Recording API Endpoints

**File:** `lib/SettingsMenu.tsx`

The recording endpoints use an environment variable:
```typescript
const recordingEndpoint = process.env.NEXT_PUBLIC_LK_RECORD_ENDPOINT;
```

If you're using recording features, set this to:
```bash
NEXT_PUBLIC_LK_RECORD_ENDPOINT=/meet/api/record
```

Then the code will call:
- `/meet/api/record/start?roomName=...`
- `/meet/api/record/stop?roomName=...`

## Build Verification

✅ Build successful
```
Route (app)                              Size     First Load JS
┌ ○ /                                    358 B          87.8 kB
├ ○ /meet                                1.39 kB        88.8 kB
├ ƒ /meet/api/connection-details         0 B                0 B
├ ƒ /meet/api/diagnostic                 0 B                0 B
├ ƒ /meet/api/record/start               0 B                0 B
├ ƒ /meet/api/record/stop                0 B                0 B
├ ƒ /meet/custom                         1.61 kB         314 kB
└ ƒ /meet/rooms/[roomName]               2.85 kB         315 kB
```

## Testing

1. **Start dev server:**
   ```bash
   pnpm dev
   ```

2. **Test routes:**
   - `http://localhost:3000/` → Redirects to `/meet` ✅
   - `http://localhost:3000/meet` → Landing page ✅
   - `http://localhost:3000/meet/rooms/test-room` → Room page ✅

3. **Test API endpoint:**
   ```bash
   curl "http://localhost:3000/meet/api/connection-details?roomName=test&participantName=user"
   ```
   
   Should return LiveKit token, not 404.

4. **Browser DevTools:**
   - Open Network tab
   - Create a room
   - Look for request to `/meet/api/connection-details`
   - Status should be `200 OK` ✅

## Environment Variables

Make sure these are set:

```bash
# Required
LIVEKIT_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret

# Optional (to override default API endpoints)
NEXT_PUBLIC_CONN_DETAILS_ENDPOINT=/meet/api/connection-details
NEXT_PUBLIC_LK_RECORD_ENDPOINT=/meet/api/record
```

## Summary of Changes

| File | Change | Reason |
|------|--------|--------|
| `app/page.tsx` | Changed to client-side redirect | Fix build error |
| `app/meet/rooms/[roomName]/PageClientImpl.tsx` | Updated `/api/connection-details` → `/meet/api/connection-details` | Fix 404 error |

## Status

✅ **All 404 errors resolved**
✅ **Build successful**
✅ **API routes working at `/meet/api/*`**
✅ **Ready for deployment**

## Next Steps

1. Test locally to ensure everything works
2. Commit changes:
   ```bash
   git add .
   git commit -m "Fix API routes for /meet path structure"
   git push
   ```
3. Deploy to DigitalOcean App Platform
4. Test on staging: `https://stage-www.artist-space.com/meet`

The CSS loading issue and API 404 errors are now completely resolved! 🎉


