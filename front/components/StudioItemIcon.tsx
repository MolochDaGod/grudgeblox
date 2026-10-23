'use client'

export type StudioIconId =
  | 'chest'
  | 'crate'
  | 'container'
  | 'workbench'
  | 'furnace'
  | 'turret'
  | 'spike'
  | 'barricade'
  | 'sword'
  | 'guard'
  | 'bolt'
  | 'shot'
  | 'smash'
  | 'heart'
  | 'stamina'
  | 'aim'

export function StudioItemIcon({
  id,
  size = 28,
  className,
}: {
  id: StudioIconId
  size?: number
  className?: string
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 48 48',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    className,
    'aria-hidden': true,
  }

  if (id === 'heart') {
    return (
      <svg {...common}>
        <path d="M24 40S8 30 8 17c0-5 4-9 9-9 3 0 5.5 1.5 7 4 1.5-2.5 4-4 7-4 5 0 9 4 9 9 0 13-16 23-16 23Z" fill="#ef4444" stroke="#fecaca" strokeWidth="2" />
      </svg>
    )
  }
  if (id === 'stamina') {
    return (
      <svg {...common}>
        <path d="M27 4 10 27h12l-2 17 18-25H26l1-15Z" fill="#f59e0b" stroke="#fde68a" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    )
  }
  if (id === 'aim') {
    return (
      <svg {...common}>
        <circle cx="24" cy="24" r="15" stroke="#7dd3fc" strokeWidth="3" />
        <path d="M24 7v10M24 31v10M7 24h10M31 24h10" stroke="#e0f2fe" strokeWidth="3" strokeLinecap="round" />
        <circle cx="24" cy="24" r="3" fill="#7dd3fc" />
      </svg>
    )
  }
  if (id === 'sword') {
    return (
      <svg {...common}>
        <path d="M33 5 41 7 39 15 18 36l-6-6L33 5Z" fill="#cbd5e1" stroke="#f8fafc" strokeWidth="2" strokeLinejoin="round" />
        <path d="m14 28 6 6M10 34l4 4M7 41l7-7" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
      </svg>
    )
  }
  if (id === 'guard') {
    return (
      <svg {...common}>
        <path d="M24 5 39 11v12c0 9-6 16-15 20C15 39 9 32 9 23V11L24 5Z" fill="#1e3a8a" stroke="#bfdbfe" strokeWidth="2" />
        <path d="M24 9v29M13 17h22" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" />
      </svg>
    )
  }
  if (id === 'bolt') {
    return (
      <svg {...common}>
        <path d="M22 4 9 25h12l-4 19 22-27H27l5-13H22Z" fill="#8b5cf6" stroke="#ddd6fe" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="35" cy="13" r="4" fill="#f0abfc" />
      </svg>
    )
  }
  if (id === 'shot') {
    return (
      <svg {...common}>
        <path d="M7 29h24l7-8h5v-5H24L7 23v6Z" fill="#92400e" stroke="#fde68a" strokeWidth="2" strokeLinejoin="round" />
        <path d="M26 21v15h-7l-3-8" stroke="#451a03" strokeWidth="3" strokeLinecap="round" />
      </svg>
    )
  }
  if (id === 'smash') {
    return (
      <svg {...common}>
        <path d="M28 5 43 20l-7 7L21 12l7-7Z" fill="#f59e0b" stroke="#fde68a" strokeWidth="2" />
        <path d="m21 12-4 4 15 15 4-4M15 18 5 38l5 5 20-10" stroke="#78350f" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (id === 'furnace') {
    return (
      <svg {...common}>
        <path d="M10 11h28v30H10V11Z" fill="#57534e" stroke="#d6d3d1" strokeWidth="2" />
        <path d="M14 16h8M26 16h8M14 23h20M14 34h20" stroke="#292524" strokeWidth="2" />
        <path d="M17 38V27h14v11" fill="#111827" stroke="#fbbf24" strokeWidth="2" />
        <path d="M24 36c-4-3 2-7-1-10 6 3 8 7 1 10Z" fill="#fb923c" />
      </svg>
    )
  }
  if (id === 'workbench') {
    return (
      <svg {...common}>
        <path d="M8 15h32v11H8V15Z" fill="#92400e" stroke="#fde68a" strokeWidth="2" />
        <path d="M13 26v15M35 26v15M10 33h28" stroke="#451a03" strokeWidth="4" strokeLinecap="round" />
        <path d="M17 20h8M30 18l4 4" stroke="#fef3c7" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  if (id === 'turret') {
    return (
      <svg {...common}>
        <path d="M17 33h14l4 9H13l4-9Z" fill="#334155" stroke="#cbd5e1" strokeWidth="2" />
        <circle cx="24" cy="24" r="10" fill="#475569" stroke="#e2e8f0" strokeWidth="2" />
        <path d="M30 22h13v5H30" fill="#94a3b8" stroke="#e2e8f0" strokeWidth="2" />
        <circle cx="24" cy="24" r="3" fill="#38bdf8" />
      </svg>
    )
  }
  if (id === 'spike') {
    return (
      <svg {...common}>
        <path d="M7 39h34" stroke="#78350f" strokeWidth="4" strokeLinecap="round" />
        <path d="m11 38 5-25 5 25M22 38l5-30 5 30M33 38l4-21 4 21" fill="#94a3b8" stroke="#e2e8f0" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    )
  }
  if (id === 'barricade') {
    return (
      <svg {...common}>
        <path d="M8 16 40 32M8 32 40 16" stroke="#92400e" strokeWidth="7" strokeLinecap="round" />
        <path d="M10 15 38 29M10 31 38 17" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" opacity=".55" />
        <path d="M13 10v28M35 10v28" stroke="#451a03" strokeWidth="4" strokeLinecap="round" />
      </svg>
    )
  }

  const crateFill = id === 'container' ? '#2563eb' : id === 'chest' ? '#92400e' : '#a16207'
  return (
    <svg {...common}>
      <path d="M8 16 24 7l16 9v20l-16 8-16-8V16Z" fill={crateFill} stroke="#fde68a" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 16 24 25l16-9M24 25v19" stroke="#451a03" strokeWidth="2" opacity=".65" />
      <path d="M15 13v27M33 13v27M11 31h26" stroke="#fef3c7" strokeWidth="2" opacity=".45" />
      {id === 'chest' && <path d="M19 25h10v6H19v-6Z" fill="#f59e0b" stroke="#451a03" strokeWidth="2" />}
    </svg>
  )
}
