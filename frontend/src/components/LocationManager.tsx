import { useState } from 'react'
import type { SavedLocation } from '../types'
import { saveLocation, removeLocation } from '../api'

interface Props {
  locations: SavedLocation[]
  clientId: string
  onRefresh: () => void
  onSelect: (name: string) => void
}

export function LocationManager({ locations, clientId, onRefresh, onSelect }: Props) {
  const [newLoc, setNewLoc] = useState('')
  const [adding, setAdding] = useState(false)

  const handleAdd = async () => {
    if (!newLoc.trim() || adding) return
    setAdding(true)
    try {
      await saveLocation(clientId, newLoc.trim())
      setNewLoc('')
      onRefresh()
    } catch {}
    setAdding(false)
  }

  const handleRemove = async (locId: string) => {
    await removeLocation(clientId, locId)
    onRefresh()
  }

  return (
    <div className="px-3 py-3">
      <div className="flex gap-1.5 mb-3">
        <input
          value={newLoc}
          onChange={(e) => setNewLoc(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add a city..."
          className="flex-1 text-xs px-3 py-2.5 rounded-xl glass-subtle text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/30 font-medium"
        />
        <button
          onClick={handleAdd}
          disabled={!newLoc.trim() || adding}
          className="text-xs px-3 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white disabled:opacity-30 transition-colors font-bold"
        >
          +
        </button>
      </div>
      <div className="space-y-0.5">
        {locations.map((loc) => (
          <div
            key={loc.id}
            className="flex items-center justify-between group px-3 py-2.5 rounded-xl hover:bg-white/10 cursor-pointer transition-colors"
            onClick={() => onSelect(loc.name)}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg glass flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white/70">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <span className="text-xs font-semibold text-white/90">{loc.name}</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleRemove(loc.id) }}
              className="text-white/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
