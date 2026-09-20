import { useState, useEffect } from 'react'
import type { SavedLocation } from '../types'
import { saveLocation, removeLocation, searchLocations } from '../api'
import type { GeocodeResult } from '../api'

interface Props {
  locations: SavedLocation[]
  clientId: string
  onRefresh: () => void
  onSelect: (name: string) => void
}

const DEBOUNCE_MS = 250

export function LocationManager({ locations, clientId, onRefresh, onSelect }: Props) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [highlighted, setHighlighted] = useState(0)

  const exists = (name: string) => locations.some(l => l.name.toLowerCase() === name.toLowerCase())

  useEffect(() => {
    const query = q.trim()
    if (query.length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    const t = setTimeout(async () => {
      try {
        const r = await searchLocations(query)
        setResults(r.results || [])
        setHighlighted(0)
        setErr(null)
      } catch {
        setResults([])
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    if (q.trim().length >= 2) setOpen(true)
  }, [results])

  const addSaved = async (raw: string): Promise<string | null> => {
    const name = raw.trim()
    if (!name || adding) return null
    if (exists(name)) {
      onSelect(name)
      setQ('')
      setOpen(false)
      setErr(null)
      return name
    }
    setAdding(true)
    setErr(null)
    try {
      const res = await saveLocation(clientId, name)
      const resolvedName = res.resolved?.name || res.location.name || name
      setQ('')
      setOpen(false)
      onRefresh()
      onSelect(resolvedName)
      return resolvedName
    } catch {
      setErr('Could not find that place. Pick from the dropdown or try another name.')
      return null
    } finally {
      setAdding(false)
    }
  }

  const handlePick = (r: GeocodeResult) => {
    addSaved(r.name)
  }

  const handleAddTyped = () => {
    const query = q.trim()
    if (!query) return
    const top = results[0]
    if (top && top.name.toLowerCase() === query.toLowerCase()) {
      addSaved(top.name)
    } else {
      addSaved(query)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (open && results.length > 0) {
        addSaved(results[highlighted].name)
      } else {
        handleAddTyped()
      }
    } else if (open && results.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlighted(i => (i + 1) % results.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlighted(i => (i - 1 + results.length) % results.length)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
  }

  const handleRemove = async (locId: string) => {
    await removeLocation(clientId, locId)
    onRefresh()
  }

  return (
    <div className="px-3 py-3 relative">
      <div className="relative mb-3">
        <div className="flex gap-1.5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (q.trim().length >= 2) setOpen(true) }}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Search any city in the world..."
            className="flex-1 text-xs px-3 py-2.5 rounded-xl glass-subtle text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/30 font-medium"
          />
          <button
            onClick={handleAddTyped}
            disabled={!q.trim() || adding}
            className="text-xs px-3 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white disabled:opacity-30 transition-colors font-bold"
          >
            {adding ? '…' : '+'}
          </button>
        </div>

        {open && q.trim().length >= 2 && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 glass-strong rounded-xl shadow-xl overflow-y-auto max-h-60">
            {results.length > 0 ? (
              results.map((r, i) => (
                <button
                  key={`${r.name}-${r.latitude}-${r.longitude}-${i}`}
                  onMouseDown={(e) => { e.preventDefault(); handlePick(r) }}
                  onMouseEnter={() => setHighlighted(i)}
                  className={`w-full text-left px-3 py-2.5 flex items-center gap-2 transition-colors ${i === highlighted ? 'bg-white/15' : 'hover:bg-white/10'}`}
                >
                  <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center flex-shrink-0">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white/70">
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <span className="min-w-0 text-left">
                    <span className="block text-xs font-semibold text-white truncate">{r.name}</span>
                    <span className="block text-[10px] text-white/50 truncate">
                      {[r.admin1, r.country].filter(Boolean).join(', ') || '—'}
                    </span>
                  </span>
                </button>
              ))
            ) : (
              <div className="px-3 py-2.5 text-left">
                <span className="text-xs text-white/60">No matches yet — press <span className="font-bold text-white/90">+</span> to add as typed</span>
              </div>
            )}
          </div>
        )}
      </div>

      {err && (
        <p className="text-[11px] text-red-300 font-medium mb-2 px-1">{err}</p>
      )}

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