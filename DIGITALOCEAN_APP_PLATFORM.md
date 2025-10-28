# DigitalOcean App Platform Deployment Guide

## Current Configuration

The app has been restructured to run at `/meet` path **without using basePath**.

### File Structure

```
app/
  ├── page.tsx                    # Redirects / → /meet
  ├── layout.tsx                  # Root layout
  ├── meet/                       # All meet app routes
  │   ├── page.tsx               # Landing page at /meet
  │   ├── rooms/                 # Room routes at /meet/rooms/[roomName]
  │   ├── custom/                # Custom page at /meet/custom
  │   └── api/                   # API routes at /meet/api/*
  └── ...
```

## ⚠️ Important: Two Deployment Options

### Option 1: Single App Deployment (RECOMMENDED)

**Merge this meet app into your main artist-space app** so everything runs as one service.

**Pros:**
- Simple deployment (one service)
- No proxy configuration needed
- Works natively at `artist-space.com/meet`
- Cost-effective (one app on DO)

**Steps:**
1. Copy this entire codebase into your main artist-space app
2. Deploy as one Next.js app on DigitalOcean App Platform
3. Users access at `https://stage-www.artist-space.com/meet`

### Option 2: Separate Service with Subdomain (EASIER BUT DIFFERENT URL)

Keep meet as a separate service, use subdomain instead of path.

**Revert to basePath approach:**
```bash
# Undo the restructuring
git checkout main  # or your previous commit
```

**Deploy Configuration:**
1. Main app service → `artist-space.com`
2. Meet app service → `meet.artist-space.com` (subdomain)

This is the **easiest** approach for DigitalOcean App Platform.

### Option 3: Separate Services with Manual Reverse Proxy (COMPLEX)

Keep as two separate services and manually configure reverse proxy.

**This defeats the purpose of App Platform's simplicity** and requires:
1. Deploy meet app to App Platform
2. Set up a separate server (DigitalOcean Droplet) with nginx
3. Configure nginx to route `/meet` → meet service
4. Point DNS to nginx server instead of App Platform

**Not recommended** - too complex for this use case.

## Recommended Deployment: Option 1 (Merge into Main App)

Since you have two Node services on DigitalOcean App Platform, the **best approach** is to merge the meet functionality into your main artist-space app.

### Steps to Merge

1. **Copy this meet app into your main app:**
   ```bash
   # In your main artist-space app directory
   cp -r /path/to/meet/app/meet ./app/
   cp -r /path/to/meet/lib ./lib/meet-lib
   cp -r /path/to/meet/styles ./styles/meet-styles
   cp /path/to/meet/public/livekit-e2ee-worker.mjs ./public/
   ```

2. **Install dependencies in main app:**
   ```bash
   pnpm add @livekit/components-react@2.9.15 \
            @livekit/components-styles@1.1.6 \
            @livekit/krisp-noise-filter@0.3.4 \
            @livekit/track-processors@^0.6.1 \
            livekit-client@2.15.14 \
            livekit-server-sdk@2.14.0 \
            react-hot-toast@^2.5.2 \
            tinykeys@^3.0.0
   ```

3. **Add to your main app's next.config.js:**
   ```javascript
   webpack: (config, { isServer }) => {
     // Add E2EE worker handling
     if (!isServer) {
       config.module.rules.push({
         test: /livekit-client.*\.worker\.(js|mjs)$/,
         type: 'asset/resource',
         generator: {
           filename: 'static/worker/[name].[hash][ext]',
         },
       });
     }
     return config;
   }
   ```

4. **Add environment variables in DigitalOcean:**
   - `LIVEKIT_URL` - Your LiveKit server URL
   - `LIVEKIT_API_KEY` - Your LiveKit API key
   - `LIVEKIT_API_SECRET` - Your LiveKit API secret

5. **Deploy:**
   ```bash
   git add .
   git commit -m "Integrate meet video conferencing"
   git push
   ```

## Current App Structure (For Separate Deployment)

If you still want to run this as a **separate service**, here's what you need to know:

### Routes Available

- `/` → Redirects to `/meet`
- `/meet` → Landing page with "Start Meeting" button
- `/meet/rooms/[roomName]` → Video conference room
- `/meet/custom` → Custom room entry
- `/meet/api/*` → API endpoints for LiveKit

### DigitalOcean App Platform Settings

```yaml
name: meet-app
services:
  - name: web
    source_dir: /
    build_command: pnpm install && pnpm build
    run_command: pnpm start
    environment_slug: node-js
    http_port: 3000
    
    envs:
      - key: NODE_ENV
        value: production
      - key: LIVEKIT_URL
        value: ${LIVEKIT_URL}  # Set in App Platform settings
      - key: LIVEKIT_API_KEY
        value: ${LIVEKIT_API_KEY}
      - key: LIVEKIT_API_SECRET
        value: ${LIVEKIT_API_SECRET}
```

### Custom Domain Setup

If running as separate service, use:
- Primary domain: `meet.artist-space.com` (subdomain)
- NOT: `artist-space.com/meet` (path-based routing not supported)

## Testing

After deployment:

1. **Visit your meet page:**
   - If merged: `https://stage-www.artist-space.com/meet`
   - If subdomain: `https://meet.artist-space.com`

2. **Check DevTools:**
   - Open Network tab
   - Look for CSS files: `/_next/static/css/...`
   - Status should be `200 OK`
   - Content-Type should be `text/css`

3. **Test E2EE:**
   - Enable "End-to-end encryption"
   - Start a meeting
   - Check browser console for errors
   - Verify video/audio works

## Troubleshooting

### CSS Still Not Loading

Check these URLs in your browser:
- `/meet/_next/static/css/[hash].css` → Should return CSS, status 200
- `/_next/static/css/[hash].css` → Should return CSS, status 200

If 404, the restructuring didn't work correctly.

### App Not Accessible at /meet

If your main app doesn't include the meet code:
- You CANNOT access `/meet` on the main domain
- You MUST use a subdomain or merge the apps

### Routes Return 404

Make sure:
1. You deployed after restructuring
2. Build completed successfully (`pnpm build`)
3. No TypeScript errors
4. All files moved correctly to `app/meet/`

## Summary

**The bottom line for DigitalOcean App Platform:**

✅ **Best Option**: Merge meet app into main app (Option 1)
✅ **Easiest Option**: Use subdomain `meet.artist-space.com` (Option 2)
❌ **Not Recommended**: Path-based routing with separate services (requires manual proxy setup)

Choose based on your needs, but **Option 1 (merge)** is the recommended approach for your use case.


