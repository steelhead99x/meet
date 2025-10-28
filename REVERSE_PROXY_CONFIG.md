# Reverse Proxy Configuration for /meet

## ⚠️ UPDATE: This app no longer uses basePath

**This file is kept for reference only.** The app has been restructured to work at `/meet` without using `basePath` in Next.js config.

See `RESTRUCTURE_SUMMARY.md` and `DIGITALOCEAN_APP_PLATFORM.md` for current deployment instructions.

---

## The Original Problem (When Using basePath)

When you use `basePath: '/meet'` in Next.js, the reverse proxy **MUST STRIP** the `/meet` prefix before forwarding requests to the Next.js app.

### How It Should Work

1. User visits: `https://stage-www.artist-space.com/meet`
2. Reverse proxy receives: `/meet` 
3. Reverse proxy forwards to Next.js: `/` (strips `/meet`)
4. Next.js generates HTML with paths like `/meet/_next/static/...`
5. Browser requests: `https://stage-www.artist-space.com/meet/_next/static/...`
6. Reverse proxy receives: `/meet/_next/static/...`
7. Reverse proxy forwards to Next.js: `/_next/static/...` (strips `/meet`)

## Nginx Configuration

### ✅ CORRECT Configuration (Path Stripping)

```nginx
server {
    server_name stage-www.artist-space.com;
    
    # Root service (different service)
    location / {
        proxy_pass http://your-root-service:PORT/;
    }
    
    # Next.js meet app - NOTE THE TRAILING SLASH IN proxy_pass
    location /meet/ {
        # The trailing slash in proxy_pass strips /meet from the path
        proxy_pass http://your-nextjs-app:3000/;
        
        # Required headers
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Handle /meet without trailing slash
    location = /meet {
        return 301 $scheme://$host/meet/;
    }
}
```

### ❌ WRONG Configuration (No Path Stripping)

```nginx
# This will NOT work with basePath: '/meet'
location /meet/ {
    proxy_pass http://your-nextjs-app:3000;  # No trailing slash = keeps /meet
}
```

## Apache Configuration

### ✅ CORRECT Configuration

```apache
<VirtualHost *:80>
    ServerName stage-www.artist-space.com
    
    # Root service
    ProxyPass / http://your-root-service:PORT/
    ProxyPassReverse / http://your-root-service:PORT/
    
    # Next.js meet app - strip /meet prefix
    ProxyPass /meet http://your-nextjs-app:3000/
    ProxyPassReverse /meet http://your-nextjs-app:3000/
    
    ProxyPreserveHost On
    RequestHeader set X-Forwarded-Proto "https"
</VirtualHost>
```

## Caddy Configuration

### ✅ CORRECT Configuration

```caddy
stage-www.artist-space.com {
    # Root service
    handle / {
        reverse_proxy your-root-service:PORT
    }
    
    # Next.js meet app - strip /meet prefix
    handle_path /meet/* {
        reverse_proxy your-nextjs-app:3000
    }
}
```

## Docker Compose Example

If you're using Docker Compose with nginx:

```yaml
version: '3'
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - nextjs-meet
      - root-service
  
  nextjs-meet:
    build: ./meet
    environment:
      - NODE_ENV=production
      - LIVEKIT_URL=${LIVEKIT_URL}
      - LIVEKIT_API_KEY=${LIVEKIT_API_KEY}
      - LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}
    expose:
      - "3000"
  
  root-service:
    # Your main service configuration
    ...
```

## Testing Your Configuration

After configuring your reverse proxy, test these URLs:

1. **Homepage**: `https://stage-www.artist-space.com/meet`
   - Should show the meet landing page with styling

2. **Check CSS in browser DevTools**:
   - Open DevTools → Network tab
   - Refresh the page
   - Look for files like `/_next/static/css/...`
   - Status should be `200 OK`
   - Type should be `text/css`

3. **Check JavaScript**:
   - Look for files like `/_next/static/chunks/...`
   - Status should be `200 OK`
   - Type should be `application/javascript`

## Debugging

If CSS still doesn't load, check:

1. **Browser DevTools → Network tab**
   - What's the full URL of the failing CSS file?
   - What status code do you get? (404, 500, 200)
   - If 200, what's the actual content type?

2. **Check your reverse proxy logs**
   - Are requests to `/_next/static/...` reaching the Next.js app?
   - What paths is your proxy forwarding?

3. **Test Next.js directly**
   - Access your Next.js app directly at `http://your-nextjs-app:3000/`
   - Does it work without the proxy?

## Alternative: No Reverse Proxy Path Stripping

If you **CANNOT** configure your reverse proxy to strip paths, you need to remove `basePath` and restructure your app:

1. Remove `basePath: '/meet'` from `next.config.js`
2. Move all routes to `app/meet/` directory structure
3. This is more complex and NOT recommended

## Need Help?

Provide the following information:
1. Your reverse proxy software (nginx/apache/caddy/etc.)
2. Current configuration file
3. Browser DevTools → Network tab screenshot showing failed CSS requests
4. The actual vs expected URLs for static assets

