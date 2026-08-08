/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    formats: ['image/avif', 'image/webp'],
  },
  webpack: (config) => {
    // Fallback для Node.js модулей (необходимо для lowdb, xlsx, pg)
    config.resolve.fallback = {
      fs: false,
      path: false,
      os: false,
      dns: false,
      http: false,
      https: false,
      stream: false,
      crypto: false,
      zlib: false,
    };

    config.optimization = {
      ...config.optimization,
      minimize: true,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          commons: {
            name: 'commons',
            chunks: 'all',
            minChunks: 2,
          },
        },
      },
    };
    return config;
  },
};

module.exports = nextConfig;
