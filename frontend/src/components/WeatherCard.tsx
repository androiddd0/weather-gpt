import type { WeatherSummary } from '../types'

interface Props {
  data: WeatherSummary | null
}

function wxClass(condition: string): string {
  const c = condition.toLowerCase()
  if (c.includes('thunder') || c.includes('storm')) return 'wx-thunderstorm'
  if (c.includes('heavy rain') || c.includes('violent')) return 'wx-heavy-rain'
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) return 'wx-rain'
  if (c.includes('snow') || c.includes('sleet') || c.includes('freezing')) return 'wx-snow'
  if (c.includes('fog') || c.includes('mist')) return 'wx-fog'
  if (c.includes('overcast') || c.includes('cloud')) return 'wx-partly-cloudy'
  return 'wx-clear'
}

function formatTime(iso: string | null): string {
  if (!iso) return '--'
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  } catch { return '--' }
}

function uvLabel(uv: number): { text: string; color: string } {
  if (uv <= 2) return { text: 'Low', color: 'text-emerald-400' }
  if (uv <= 5) return { text: 'Moderate', color: 'text-yellow-400' }
  if (uv <= 7) return { text: 'High', color: 'text-orange-400' }
  if (uv <= 10) return { text: 'Very High', color: 'text-red-400' }
  return { text: 'Extreme', color: 'text-purple-400' }
}

export function WeatherCard({ data }: Props) {
  if (!data) return null
  const c = data.current
  const gradient = wxClass(c.condition)
  const todayForecast = data.daily[0]
  const uv = todayForecast?.uv_index ?? 0
  const uvInfo = uvLabel(uv)

  return (
    <div className={`mx-4 mb-4 rounded-[1.5rem] ${gradient} p-6 pb-5 text-white shadow-xl fade-in`}>
      {/* Location */}
      <div className="flex items-start justify-between mb-0.5">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{data.place}</h2>
          <p className="text-sm text-white/70 font-medium">{c.condition}</p>
        </div>
        <span className="text-5xl drop-shadow-lg">{c.emoji}</span>
      </div>

      {/* Big temp */}
      <div className="mt-5 mb-7">
        <div className="flex items-start">
          <span className="text-[5.5rem] font-extrabold leading-none tracking-tighter drop-shadow-md">
            {Math.round(c.temperature_c)}
          </span>
          <span className="text-3xl font-light mt-3 ml-0.5 opacity-80">°C</span>
        </div>
        <p className="text-sm text-white/70 font-medium mt-1">Feels like {Math.round(c.feels_like_c)}°</p>
      </div>

      {/* Primary stats row */}
      <div className="grid grid-cols-3 gap-2.5 mb-3">
        <StatCard icon="💨" label="Wind" value={`${Math.round(c.wind_kmh)}`} unit="km/h" />
        <StatCard icon="💧" label="Humidity" value={`${c.humidity_percent}`} unit="%" />
        <StatCard icon="🌧️" label="Rain" value={`${todayForecast?.rain_prob_percent ?? 0}`} unit="%" />
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-3 gap-2.5 mb-3">
        <StatCard icon="☁️" label="Cloud" value={`${c.cloud_cover_percent ?? '--'}`} unit="%" />
        <StatCard icon="🔆" label="UV" value={`${uv}`} unit="" extra={<span className={`text-[9px] font-bold ${uvInfo.color}`}>{uvInfo.text}</span>} />
        <StatCard icon="🌡️" label="Pressure" value={c.pressure_hpa ? `${Math.round(c.pressure_hpa)}` : '--'} unit="hPa" />
      </div>

      {/* Hi/Lo + sunrise/sunset */}
      <div className="glass rounded-xl px-4 py-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="font-semibold">H: {Math.round(c.today_high_c ?? todayForecast?.high_c ?? c.temperature_c)}°</span>
            <span className="text-white/30">|</span>
            <span className="text-white/80 font-medium">L: {Math.round(c.today_low_c ?? todayForecast?.low_c ?? c.temperature_c)}°</span>
          </div>
          <span className="text-xs text-white/50">{c.condition}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-white/60 border-t border-white/10 pt-2">
          <span>🌅 {formatTime(c.sunrise)}</span>
          <span>🌇 {formatTime(c.sunset)}</span>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, unit, extra }: {
  icon: string; label: string; value: string; unit: string; extra?: React.ReactNode
}) {
  return (
    <div className="glass rounded-2xl px-3 py-3 text-center">
      <span className="text-sm block mb-0.5">{icon}</span>
      <p className="text-[8px] uppercase tracking-[0.12em] text-white/50 mb-0.5 font-medium">{label}</p>
      <p className="text-base font-bold leading-none">{value}<span className="text-[10px] font-normal ml-0.5 opacity-70">{unit}</span></p>
      {extra}
    </div>
  )
}
