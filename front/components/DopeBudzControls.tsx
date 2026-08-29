'use client'

interface DopeBudzControlsProps {
  onAction: (action: string) => void
}

const ACTIONS = [
  { action: 'dopebudz:status', label: 'Street status' },
  { action: 'dopebudz:lots', label: 'Owned lots' },
  { action: 'dopebudz:missions', label: 'Current job' },
]

/** Functional controls for querying the authoritative Streets ECS session. */
export default function DopeBudzControls({ onAction }: DopeBudzControlsProps) {
  return (
    <div className="mt-3 border-t border-emerald-900/40 pt-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-400/90">
        Streets ECS session
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {ACTIONS.map(({ action, label }) => (
          <button
            key={action}
            type="button"
            onClick={() => onAction(action)}
            className="rounded border border-emerald-800/50 bg-emerald-950/50 px-2 py-1 text-[10px] text-emerald-100 hover:bg-emerald-900/60"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
