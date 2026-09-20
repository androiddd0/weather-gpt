import type { ChatResponse, WeatherSummary, WeatherAlert, SavedLocation } from './types'

const BASE = ''

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export function sendChat(
  message: string,
  language: string,
  clientId: string,
  history: { role: string; content: string }[]
): Promise<ChatResponse> {
  return post('/api/chat', { message, language, client_id: clientId, history })
}

export function getWeatherSummary(location: string, days = 7): Promise<WeatherSummary> {
  return get(`/api/weather/summary?location=${encodeURIComponent(location)}&days=${days}`)
}

export function getAlerts(clientId: string): Promise<{ alerts: WeatherAlert[]; count: number }> {
  return get(`/api/alerts?client_id=${encodeURIComponent(clientId)}`)
}

export function getAlertHistory(clientId: string, limit = 50): Promise<{ alerts: WeatherAlert[]; count: number }> {
  return get(`/api/alerts/history?client_id=${encodeURIComponent(clientId)}&limit=${limit}`)
}

export interface GeocodeResult {
  name: string
  latitude: number
  longitude: number
  admin1?: string
  country?: string
}

export function searchLocations(q: string, count = 8): Promise<{ results: GeocodeResult[] }> {
  return get(`/api/geocode?q=${encodeURIComponent(q)}&count=${count}`)
}

export function getLocations(clientId: string): Promise<{ locations: SavedLocation[] }> {
  return get(`/api/locations?client_id=${encodeURIComponent(clientId)}`)
}

export function saveLocation(clientId: string, location: string): Promise<{ location: SavedLocation; resolved: { name?: string } }> {
  return post('/api/locations', { client_id: clientId, location })
}

export function removeLocation(clientId: string, locId: string): Promise<{ ok: boolean }> {
  return del(`/api/locations/${locId}?client_id=${encodeURIComponent(clientId)}`)
}

export function getLanguages(): Promise<{ languages: Record<string, { name: string; native: string }>; default: string }> {
  return get('/api/languages')
}

export async function transcribeAudio(blob: Blob, language: string): Promise<string> {
  const form = new FormData()
  form.append('file', blob, 'recording.webm')
  form.append('language', language)
  let res: Response
  try {
    res = await fetch(`${BASE}/api/stt`, { method: 'POST', body: form })
  } catch {
    throw new Error('Could not reach the server.')
  }
  if (res.status === 404 || res.status === 405) {
    throw new Error('Server is outdated. Restart the backend (python -m app.main) to enable voice input.')
  }
  if (!res.ok) {
    let detail = ''
    try { detail = (await res.json())?.detail ?? '' } catch {}
    throw new Error(`Speech-to-text error ${res.status}${detail ? `: ${detail}` : ''}`)
  }
  const data = await res.json() as { text?: string }
  return data.text ?? ''
}
