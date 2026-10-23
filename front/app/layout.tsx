import '@/styles/globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL('https://blox.grudge-studio.com'),
  applicationName: 'GrudgeBlox',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icons/grudgeblox-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/icons/grudgeblox-192.png', type: 'image/png', sizes: '192x192' },
    ],
    shortcut: '/favicon.ico',
    apple: [{ url: '/icons/grudgeblox-180.png', type: 'image/png', sizes: '180x180' }],
  },
}

export default function RootLayout({
  // Layouts must accept a children prop.
  // This will be populated with nested layouts or pages
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-[#0c0a08]">
        <main>{children}</main>
      </body>
    </html>
  )
}
