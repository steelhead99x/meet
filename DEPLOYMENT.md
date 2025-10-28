# Deployment Guide

## MIME Type Error Fix

The MIME type errors you're experiencing happen when the server returns HTML (like 404 pages) instead of the actual CSS/JS files.

### Root Cause

Your app was attempting to use **static export** (`next export`), but your application has:
- Dynamic routes (`/rooms/[roomName]`)
- API routes (`/api/connection-details`, `/api/record/*`)
- Server-side features that require a Node.js server

**Static export is NOT compatible with these features.**

### Solution

Your app MUST run as a **Node.js server** using `next start`.

## Heroku Deployment

### Required Files

1. **Procfile** (✅ Created)
```
web: pnpm start
```

2. **package.json** scripts (✅ Already correct)
```json
{
  "scripts": {
    "build": "next build",
    "start": "next start"
  }
}
```

### Important: Remove Any Export Commands

If you have any build scripts or deployment configurations that run:
- `next export`
- `next build && next export`
- Or any export-related commands

**REMOVE THEM** and use only:
```bash
pnpm build    # For building
pnpm start    # For running in production
```

### Heroku Configuration

Make sure your Heroku app is configured to:

1. **Install dependencies**: `pnpm install` (or `npm install`)
2. **Build**: `pnpm build`
3. **Start**: `pnpm start` (defined in Procfile)

### Environment Variables

Ensure these are set in Heroku:
```bash
NODE_ENV=production
LIVEKIT_API_KEY=your_key
LIVEKIT_API_SECRET=your_secret
LIVEKIT_URL=your_livekit_url
```

### Port Configuration

Heroku automatically provides the PORT environment variable. Next.js will use it automatically when you run `next start`.

## Deployment Checklist

- [x] Procfile exists with `web: pnpm start`
- [x] No static export commands in build process
- [x] Force dynamic rendering on pages that need it
- [ ] Environment variables set in Heroku
- [ ] Deploy and test

## Common Issues

### Issue: Static files not loading (MIME type errors)
**Cause**: Using `next export` or static export
**Fix**: Use `next start` (Node.js server mode)

### Issue: API routes not working
**Cause**: Static export doesn't support API routes
**Fix**: Use Node.js server mode (`next start`)

### Issue: Dynamic routes not working
**Cause**: Static export with dynamic routes
**Fix**: Use Node.js server mode with `export const dynamic = 'force-dynamic'`

## Testing Locally

Test your production build locally:

```bash
# Build the app
pnpm build

# Start the production server
pnpm start

# Visit http://localhost:3000
```

The app should work exactly as it will on Heroku.

## Current Status

✅ Build configuration fixed
✅ Procfile created  
✅ Dynamic rendering enabled on required pages
✅ ToasterProvider fixed for SSR

**Next Step**: Deploy to Heroku and ensure the deployment pipeline uses:
1. `pnpm build` (or `npm run build`)
2. `pnpm start` (or `npm start`)

And does NOT use `next export` or any static export commands.

