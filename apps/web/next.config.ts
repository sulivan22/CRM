import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@crm/ui', '@crm/config'],
};

export default nextConfig;
