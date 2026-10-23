import { HUD_Z } from '@/game/hudLayers'

interface LoadingScreenProps {
  error?: string | null
  isRetrying?: boolean
  onRetry?: () => void
}

export default function LoadingScreen({ error, isRetrying = false, onRetry }: LoadingScreenProps) {
  const hasError = Boolean(error)

  return (
    <div
      className="absolute top-1/2 left-1/2 w-[min(92vw,28rem)] transform -translate-x-1/2 -translate-y-1/2"
      style={{ zIndex: HUD_Z.OVERLAY }}
      role={hasError ? 'alert' : 'status'}
      aria-live="polite"
    >
      <div className="border border-slate-900 bg-slate-50 text-slate-950 shadow-xl rounded-lg p-5 w-full mx-auto">
        <div className={`flex space-x-4 ${hasError ? '' : 'animate-pulse'}`}>
          <div className="flex-1 space-y-6 py-1">
            <p className="normal-case text-2xl font-semibold">
              {hasError ? 'Connection failed' : 'Loading…'}
            </p>
            <p className="normal-case text-base">
              {error ?? 'Connecting to the game server…'}
            </p>
            <div className={`h-2 rounded ${hasError ? 'bg-red-500' : 'bg-slate-400'}`}></div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={hasError ? onRetry : undefined}
                disabled={!hasError || isRetrying}
                className="w-full text-white bg-gradient-to-r from-gray-600 via-gray-700 to-gray-800 enabled:hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-green-300 disabled:cursor-wait disabled:opacity-70 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
              >
                {hasError ? (isRetrying ? 'Retrying…' : 'Retry connection') : 'Please wait…'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
