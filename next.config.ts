import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    domains: ['static.usernames.app-backend.toolsforhumanity.com'],
  },
  allowedDevOrigins: ['https://dealing-theater-tested-proceed.trycloudflare.com'],
  reactStrictMode: false,
  experimental: {
    /** Large JSON bodies for complete-withdrawal (ID data URLs). */
    serverActions: { bodySizeLimit: '12mb' },
  },
};

export default nextConfig;
