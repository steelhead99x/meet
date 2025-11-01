/** @type {import('next').NextConfig} */
const nextConfig = {
  // Note: basePath removed for DigitalOcean App Platform deployment
  // Run this app at meet.artist-space.com instead of artist-space.com/meet
  trailingSlash: false,
  reactStrictMode: false,
  productionBrowserSourceMaps: true,
  images: {
    formats: ['image/webp'],
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }) => {
    // Important: return the modified config
    config.module.rules.push({
      test: /\.mjs$/,
      enforce: 'pre',
      use: ['source-map-loader'],
      exclude: [/@mediapipe\/tasks-vision/],
    });

    // Handle E2EE worker files from livekit-client
    if (!isServer) {
      config.module.rules.push({
        test: /livekit-client.*\.worker\.(js|mjs)$/,
        type: 'asset/resource',
        generator: {
          filename: 'static/worker/[name].[hash][ext]',
        },
      });
    }

    // Exclude better-sqlite3 from webpack bundling (native module, server-only)
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('better-sqlite3');
    }

    return config;
  },
  // Note: COOP/COEP headers are now handled in middleware.ts
  // This allows proper control over which requests get the headers
  headers: async () => {
    return [
      // Ensure proper caching for static assets
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Public assets (background images)
      {
        source: '/background-images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
