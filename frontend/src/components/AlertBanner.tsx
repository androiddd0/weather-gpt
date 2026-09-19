import type { WeatherAlert } from '../types'

interface Props {
  alert: WeatherAlert | null
  onDismiss: () => void
}

export function AlertBanner({ alert, onDismiss }: Props) {
  if (!alert) return null
  const isWarning = alert.severity === 'warning'

  return (
    <div className={`px-4 py-3 border-b backdrop-blur-sm fade-in ${
      isWarning
        ? 'bg-red-500/20 border-red-500/30'
        : 'bg-amber-500/20 border-amber-500/30'
    }`}>
      <div className="flex items-center justify-between max-w-3xl mx-auto">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">{isWarning ? '🔴' : '🟡'}</span>
          <div>
            <p className="text-sm font-bold text-white">{alert.title}</p>
            <p className="text-xs text-white/70">{alert.message}</p>
          </div>
        </div>
        <button onClick={onDismiss} className="text-xs text-white/50 hover:text-white/80 transition-colors px-2 py-1 font-medium">
          Dismiss
        </button>
      </div>
    </div>
  )
}
