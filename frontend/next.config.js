/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          '**/backend/**',
          '**/scratch/**',
          '**/*.log',
        ],
      };
    }
    return config;
  },
};

module.exports = nextConfig;
