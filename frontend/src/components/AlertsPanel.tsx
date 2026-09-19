import type { WeatherAlert } from '../types'

interface Props {
  alerts: WeatherAlert[]
}

export function AlertsPanel({ alerts }: Props) {
  if (alerts.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl glass flex items-center justify-center">
          <span className="text-xl">&#9989;</span>
        </div>
        <p className="text-xs text-white/60 font-medium">No active alerts</p>
        <p className="text-[10px] text-white/40 mt-1">All clear for your locations</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-white/10">
      {alerts.map((alert) => {
        const isWarning = alert.severity === 'warning'
        return (
          <div key={alert.id} className="px-4 py-3 hover:bg-white/5 transition-colors">
            <div className="flex items-start gap-2.5">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                isWarning ? 'bg-red-500/20' : 'bg-amber-500/20'
              }`}>
                <span className="text-xs">{isWarning ? '🔴' : '🟡'}</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white leading-tight">{alert.title}</p>
                <p className="text-[11px] text-white/60 mt-0.5 line-clamp-2">{alert.message}</p>
                <p className="text-[10px] text-white/40 mt-1.5">
                  {new Date(alert.ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
