import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@vpsknow/database', '@vpsknow/shared'],
};

export default nextConfig;
