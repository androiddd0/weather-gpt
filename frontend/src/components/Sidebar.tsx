import { useState, useEffect } from 'react'
import type { SavedLocation, WeatherAlert } from '../types'
import { getLocations, getAlertHistory } from '../api'
import { LocationManager } from './LocationManager'
import { AlertsPanel } from './AlertsPanel'
import { LanguagePicker } from './LanguagePicker'
import { ThemeToggle } from './ThemeToggle'

interface Props {
  clientId: string
  language: string
  languages: Record<string, { name: string; native: string }>
  onLanguageChange: (code: string) => void
  theme: 'light' | 'dark'
  onThemeToggle: () => void
  onSelectLocation: (name: string) => void
  alertCount: number
}

type Tab = 'locations' | 'alerts'

export function Sidebar({
  clientId, language, languages, onLanguageChange,
  theme, onThemeToggle, onSelectLocation, alertCount,
}: Props) {
  const [tab, setTab] = useState<Tab>('locations')
  const [locations, setLocations] = useState<SavedLocation[]>([])
  const [alerts, setAlerts] = useState<WeatherAlert[]>([])
  const [mobileOpen, setMobileOpen] = useState(false)

  const refresh = async () => {
    try {
      const [locs, alts] = await Promise.all([getLocations(clientId), getAlertHistory(clientId)])
      setLocations(locs.locations)
      setAlerts(alts.alerts)
    } catch {}
  }

  useEffect(() => {
    refresh()
    const i = setInterval(refresh, 60000)
    return () => clearInterval(i)
  }, [clientId])

  const sidebar = (
    <div className="w-72 h-full flex flex-col wx-clear overflow-hidden">
      {/* Header */}
      <div className="px-5 py-5 border-b border-white/15">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl glass flex items-center justify-center shadow-lg">
              <span className="text-xl">🌤️</span>
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-white tracking-tight">WeatherGPT</h1>
              <p className="text-[10px] text-white/50 font-medium">India Weather Assistant</p>
            </div>
          </div>
          <ThemeToggle theme={theme} onToggle={onThemeToggle} />
        </div>
      </div>

      {/* Language */}
      <div className="px-4 py-3 border-b border-white/15">
        <LanguagePicker languages={languages} current={language} onChange={onLanguageChange} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/15">
        {(['locations', 'alerts'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 text-xs py-2.5 font-bold transition-colors relative capitalize ${
              tab === t ? 'text-white' : 'text-white/40 hover:text-white/60'
            }`}
          >
            {t}
            {tab === t && <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-white" />}
            {t === 'alerts' && alertCount > 0 && (
              <span className="ml-1 w-1.5 h-1.5 inline-block rounded-full bg-red-400" />
            )}
            {t === 'locations' && <span className="ml-1 text-[10px] font-normal opacity-50">({locations.length})</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'locations' ? (
          <LocationManager locations={locations} clientId={clientId} onRefresh={refresh} onSelect={onSelectLocation} />
        ) : (
          <AlertsPanel alerts={alerts} />
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/15">
        <p className="text-[10px] text-white/30 text-center font-medium">Powered by Open-Meteo</p>
      </div>
    </div>
  )

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 w-10 h-10 rounded-xl glass-strong flex items-center justify-center text-white/70 shadow-xl"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative">{sidebar}</div>
        </div>
      )}

      <div className="hidden md:block">{sidebar}</div>
    </>
  )
}
