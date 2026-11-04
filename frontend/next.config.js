/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable image optimization for external domains
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

module.exports = nextConfig;
