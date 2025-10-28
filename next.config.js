/** @type {import('next').NextConfig} */
const nextConfig = {
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

    return config;
  },
  headers: async () => {
    return [
      // Apply security headers to HTML pages (needed for SharedArrayBuffer/E2EE)
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless',
          },
        ],
      },
      // Ensure proper MIME types and caching for static assets
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
