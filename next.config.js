/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true  // ✅ ИГНОРИРУЕМ TS ошибки!
  },
  //eslint: {     ignoreDuringBuilds: true }, // ✅ ИГНОРИРУЕМ ESLint warnings! 
  
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }]
  }
};
module.exports = nextConfig;
