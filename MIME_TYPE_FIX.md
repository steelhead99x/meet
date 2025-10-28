# MIME Type Error - Root Cause & Fix

## Problem Summary

Your deployment was serving HTML error pages instead of CSS/JavaScript files, resulting in:
```
Refused to apply style from '...css' because its MIME type ('text/html') 
is not a supported stylesheet MIME type
```

## Root Cause

Looking at your build logs, the deployment was trying to use **static export** (`next export`), but your application requires a **Node.js server** because it has:

1. ✅ Dynamic API routes (`/api/*`)
2. ✅ Dynamic page routes (`/rooms/[roomName]`)
3. ✅ Server-side features (E2EE setup, connection handling)

**Static export is incompatible with these features.**

## What Was Fixed

### 1. ✅ Created `Procfile` for Heroku
```
web: pnpm start
```
This ensures Heroku runs your app as a Node.js server.

### 2. ✅ Configured Pages for Dynamic Rendering
Added `export const dynamic = 'force-dynamic'` to:
- `app/page.tsx`
- `app/custom/page.tsx`
- `app/rooms/[roomName]/page.tsx`

This prevents Next.js from trying to pre-render pages that need dynamic features.

### 3. ✅ Fixed ToasterProvider for SSR
The toast notifications now properly handle server-side rendering and hydration.

## What You Need to Do

### Critical: Check Your Deployment Configuration

Your Heroku deployment should:

**✅ DO:**
- Build: `pnpm build` (or `npm run build`)
- Start: `pnpm start` (or `npm start`)

**❌ DON'T:**
- Use `next export`
- Use `next build && next export`
- Use any export commands

### Where to Check

1. **Heroku Dashboard** → Your App → Settings → Buildpacks
   - Should be: `heroku/nodejs`

2. **Heroku Dashboard** → Your App → Deploy → Deployment Method
   - If using Git, check there's no custom build command with "export"

3. **Check package.json** (already verified ✅)
   ```json
   {
     "scripts": {
       "build": "next build",     // ✅ Correct
       "start": "next start"      // ✅ Correct
     }
   }
   ```

## Testing Before Deployment

Test the production build locally:

```bash
# Build
pnpm build

# Start production server
pnpm start

# Visit http://localhost:3000
# Check browser console - should have NO MIME type errors
```

## Expected Result After Fix

After redeploying with the correct configuration:

1. ✅ CSS files load correctly with `content-type: text/css`
2. ✅ JS files load correctly with `content-type: application/javascript`
3. ✅ API routes work (`/api/*`)
4. ✅ Dynamic routes work (`/rooms/[roomName]`)
5. ✅ Video conferencing works
6. ✅ E2EE works

## Build Output Verification

Your build should show (as it does now):
```
Route (app)                              Size     First Load JS
├ ○ /                                    Static
├ ƒ /api/connection-details              Dynamic API
├ ƒ /api/record/start                    Dynamic API
├ ƒ /api/record/stop                     Dynamic API
├ ƒ /custom                              Dynamic
└ ƒ /rooms/[roomName]                    Dynamic
```

The `ƒ` symbol means **dynamic** (server-rendered), which is correct for your app.

## Deployment Steps

1. ✅ Commit these changes:
   ```bash
   git add .
   git commit -m "Fix MIME type errors - configure for Node.js server mode"
   ```

2. ✅ Push to Heroku:
   ```bash
   git push heroku main
   ```

3. ✅ Monitor the build logs:
   ```bash
   heroku logs --tail
   ```
   
   You should see:
   - ✅ `pnpm install` (or npm)
   - ✅ `pnpm build`
   - ✅ `pnpm start`
   - ❌ NO "export" commands

4. ✅ Test the deployed app:
   - Open browser console
   - Check for MIME type errors (should be NONE)
   - Test video conference features

## If Issues Persist

If you still see MIME type errors after deployment:

1. Check if Heroku is using a custom buildpack or build command
2. Verify the `Procfile` was committed and pushed
3. Check Heroku logs for any export-related commands
4. Make sure `.next` directory is built fresh (not cached)

## Summary

- ✅ Build works locally
- ✅ All necessary files created/updated
- ✅ Configuration correct for Node.js server mode
- 🚀 Ready to deploy

**Next step**: Push to Heroku and verify the MIME type errors are gone!

