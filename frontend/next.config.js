/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
