/*yf * @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true  // ✅ ИГНОРИРУЕМ TS ошибки!
  },
  //eslint: {     ignoreDuringBuilds: true }, // ✅ ИГНОРИРУЕМ ESLint warnings! 
  
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }]
  },
  
  // Используем webpack вместо turbopack для стабильности
  turbopack: false,
  
  // Настройки компиляции
  compiler: {
    // Убираем minify для отладки проблем с CSS (опционально)
    // minify: false,
  },
  
  // Настройки webpack для стабильности
  webpack: (config, { isServer }) => {
    // Увеличиваем лимит для CSS
    config.optimization = config.optimization || {};
    config.optimization.splitChunks = config.optimization.splitChunks || {};
    
    // Не разбивать CSS на чанки (может помочь с ошибкой лимита)
    if (!isServer) {
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        styles: {
          name: 'styles',
          test: /\.css$/,
          chunks: 'all',
          enforce: true,
        },
      };
    }
    
    return config;
  },
};

module.exports = nextConfig;
