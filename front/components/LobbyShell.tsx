import type { ReactNode } from 'react'
import Navbar from '@/components/Navbar'

export default function LobbyShell({
  children,
  wide = true,
}: {
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0c0a08] via-[#12100e] to-[#0a0a0c] text-stone-100">
      <div className={`${wide ? 'container' : 'max-w-5xl'} mx-auto px-4 pb-16`}>
        <Navbar />
        {children}
      </div>
    </div>
  )
}
