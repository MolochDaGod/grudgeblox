/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.GRUDGE_LOCAL_WORLD === 'shire' ? {
    distDir: '.shire-next',
    cleanDistDir: false,
    typescript: { tsconfigPath: 'shire.tsconfig.json' },
  } : {}),
  reactStrictMode: false,
  experimental: {
    externalDir: true,
    ...(process.env.GRUDGE_LOCAL_WORLD === 'shire' ? { cpus: 2 } : {}),
  },
  env: {
    NEXT_PUBLIC_SERVER_URL:
      process.env.NEXT_PUBLIC_SERVER_URL || 'wss://grudgeblox-production.up.railway.app',
    NEXT_PUBLIC_FLEET_ASSETS:
      process.env.NEXT_PUBLIC_FLEET_ASSETS || 'https://assets.grudge-studio.com',
    NEXT_PUBLIC_MINE:
      process.env.NEXT_PUBLIC_MINE || 'https://mine.grudge-studio.com',
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'assets.grudge-studio.com' },
      { protocol: 'https', hostname: '**.grudge-studio.com' },
    ],
  },
  webpack: (config) => {
    if (process.platform === 'win32') {
      // Next 15 prefixes relative client entries with "./", including absolute
      // paths returned when the pnpm store lives on a different Windows drive.
      const repairEntry = (entry) => {
        if (typeof entry === 'string') return entry.replace(/^\.\/(?=[A-Za-z]:[/\\])/, '')
        if (Array.isArray(entry)) return entry.map(repairEntry)
        if (entry && typeof entry === 'object' && 'import' in entry) {
          return { ...entry, import: repairEntry(entry.import) }
        }
        return entry
      }
      const originalEntry = config.entry
      config.entry = async () => {
        const entries = typeof originalEntry === 'function' ? await originalEntry() : originalEntry
        return Object.fromEntries(Object.entries(entries).map(([name, entry]) => [name, repairEntry(entry)]))
      }
    }
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
    }

    return config
  },
}

module.exports = nextConfig
