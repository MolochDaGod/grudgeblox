/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: {
    externalDir: true,
  },
  env: {
    NEXT_PUBLIC_SERVER_URL:
      process.env.NEXT_PUBLIC_SERVER_URL || 'wss://blox-game.grudge-studio.com',
    NEXT_PUBLIC_FLEET_ASSETS:
      process.env.NEXT_PUBLIC_FLEET_ASSETS || 'https://assets.grudge-studio.com',
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'assets.grudge-studio.com' },
      { protocol: 'https', hostname: '**.grudge-studio.com' },
    ],
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
    }

    return config
  },
}

module.exports = nextConfig
