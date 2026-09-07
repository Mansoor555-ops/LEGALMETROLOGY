/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    allowedDevOrigins: ['10.75.134.26', 'localhost:3000', '10.75.134.26:3000', '26.13.176.76'],
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '*',
        port: '8000',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;
