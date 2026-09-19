import { useState, useEffect, useCallback, useRef } from 'react'
import { useTheme } from './hooks/useTheme'
import { useChat } from './hooks/useChat'
import { useWebSocket } from './hooks/useWebSocket'
import { getLanguages, getWeatherSummary } from './api'
import type { WeatherSummary } from './types'
import { Sidebar } from './components/Sidebar'
import { ChatPanel } from './components/ChatPanel'
import { ChatInput } from './components/ChatInput'
import { WeatherCard } from './components/WeatherCard'
import { ForecastChart } from './components/ForecastChart'
import { AlertBanner } from './components/AlertBanner'

// Fast-lookup city list (Indian + major worldwide cities)
const KNOWN_CITIES = new Set([
  // India
  'Delhi', 'New Delhi', 'Mumbai', 'Bombay', 'Bengaluru', 'Bangalore',
  'Chennai', 'Madras', 'Kolkata', 'Calcutta', 'Hyderabad', 'Pune',
  'Jaipur', 'Lucknow', 'Patna', 'Bhopal', 'Ahmedabad', 'Surat',
  'Guwahati', 'Bhubaneswar', 'Amritsar', 'Varanasi', 'Coimbatore',
  'Kochi', 'Cochin', 'Indore', 'Nagpur', 'Kanpur', 'Agra',
  'Mysuru', 'Mysore', 'Chandigarh', 'Goa', 'Panaji', 'Shimla',
  'Srinagar', 'Mangaluru', 'Mangalore', 'Thiruvananthapuram', 'Trivandrum',
  'Dehradun', 'Rishikesh', 'Haridwar', 'Darjeeling', 'Gangtok',
  'Shillong', 'Agartala', 'Puducherry', 'Pondicherry', 'Port Blair',
  // Worldwide
  'London', 'Paris', 'Tokyo', 'New York', 'Los Angeles', 'Chicago',
  'San Francisco', 'Seattle', 'Miami', 'Boston', 'Austin', 'Denver',
  'Dubai', 'Abu Dhabi', 'Singapore', 'Bangkok', 'Kuala Lumpur',
  'Jakarta', 'Manila', 'Ho Chi Minh', 'Hanoi', 'Seoul', 'Osaka',
  'Beijing', 'Shanghai', 'Hong Kong', 'Taipei', 'Sydney', 'Melbourne',
  'Brisbane', 'Perth', 'Auckland', 'Wellington', 'Toronto', 'Vancouver',
  'Montreal', 'Mexico City', 'São Paulo', 'Rio de Janeiro', 'Buenos Aires',
  'Cairo', 'Nairobi', 'Cape Town', 'Lagos', 'Casablanca', 'Istanbul',
  'Berlin', 'Munich', 'Amsterdam', 'Barcelona', 'Madrid', 'Rome',
  'Milan', 'Zurich', 'Vienna', 'Prague', 'Warsaw', 'Budapest',
  'Stockholm', 'Oslo', 'Copenhagen', 'Helsinki', 'Dublin', 'Lisbon',
  'Athens', 'Moscow', 'Saint Petersburg', 'Kyiv', 'Bucharest',
  'Tel Aviv', 'Jerusalem', 'Doha', 'Riyadh', 'Jeddah', 'Muscat',
  'Kathmandu', 'Colombo', 'Dhaka', 'Lahore', 'Islamabad', 'Karachi',
  'Kabul', 'Tehran', 'Baghdad', 'Amman', 'Beirut', 'Tbilisi',
])

const STOP_WORDS = new Set([
  'weather', 'forecast', 'temperature', 'temperature', 'today', 'tomorrow',
  'current', 'what', 'how', 'will', 'show', 'tell', 'give', 'check',
  'is', 'it', 'the', 'a', 'an', 'in', 'at', 'for', 'near', 'like',
  'right', 'now', 'this', 'next', 'week', 'day', 'days', 'rain', 'sunny',
  'cloudy', 'windy', 'hot', 'cold', 'warm', 'cool', 'humidity', 'wind',
  'storm', 'snow', 'fog', 'alert', 'warning', 'air', 'quality', 'aqi',
  'sunrise', 'sunset', 'uv', 'index', 'feels', 'like', 'high', 'low',
  'morning', 'evening', 'night', 'afternoon', 'monsoon', 'summer',
  'winter', 'spring', 'autumn', 'climate', 'history', 'trend', 'average',
  'please', 'could', 'would', 'can', 'do', 'does', 'about', 'know',
  'weather', 'mausam', 'मौसम', 'तापमान', 'कल', 'आज', 'में',
  'and', 'or', 'but', 'with', 'from', 'to', 'of', 'on',
])

const HINDI_CITIES: Record<string, string> = {
  'दिल्ली': 'Delhi', 'मुंबई': 'Mumbai', 'बेंगलुरु': 'Bengaluru',
  'चेन्नई': 'Chennai', 'कोलकाता': 'Kolkata', 'हैदराबाद': 'Hyderabad',
  'पुणे': 'Pune', 'जयपुर': 'Jaipur', 'लखनऊ': 'Lucknow',
  'पटना': 'Patna', 'भोपाल': 'Bhopal', 'अहमदाबाद': 'Ahmedabad',
  'सूरत': 'Surat', 'वाराणसी': 'Varanasi', 'गोवा': 'Goa',
  'शिमला': 'Shimla', 'श्रीनगर': 'Srinagar', 'कोच्चि': 'Kochi',
}

function extractCity(text: string): string | null {
  const lower = text.toLowerCase()

  // 1) Check known cities (fast, most reliable)
  for (const city of KNOWN_CITIES) {
    if (lower.includes(city.toLowerCase())) return city
  }

  // 2) Hindi/Indian language city names
  for (const [hindi, eng] of Object.entries(HINDI_CITIES)) {
    if (text.includes(hindi)) return eng
  }

  // 3) Extract after prepositions: "in Mumbai", "for Delhi", "me Dilli", "बारिश में दिल्ली"
  const prepMatch = text.match(/(?:in|at|for|near|around|me|में|मे)\s+([A-Za-z\u0900-\u0D7F][\w\u0900-\u0D7F-]*(?:\s+[A-Za-z\u0900-\u0D7F][\w\u0900-\u0D7F-]*){0,2})/i)
  if (prepMatch) {
    const candidate = prepMatch[1].trim()
    // Filter out stop words
    const words = candidate.split(/\s+/)
    const placeWords = words.filter(w => !STOP_WORDS.has(w.toLowerCase()))
    if (placeWords.length > 0) return placeWords.join(' ')
  }

  // 4) Look for any capitalized word that isn't a stop word or common verb
  const words = text.match(/\b[A-Za-z\u0900-\u0D7F]{3,}\b/g)
  if (words) {
    for (const w of words) {
      const low = w.toLowerCase()
      if (STOP_WORDS.has(low)) continue
      // If it's capitalized (proper noun) and not a known verb/adjective
      if (w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase()) {
        return w
      }
    }
    // If no capitalized word found, try any non-stop word that could be a place
    for (const w of words) {
      const low = w.toLowerCase()
      if (STOP_WORDS.has(low) || low.length < 3) continue
      return w
    }
  }

  return null
}

function App() {
  const { theme, toggle: toggleTheme } = useTheme()
  const [language, setLanguage] = useState('en')
  const [languages, setLanguages] = useState<Record<string, { name: string; native: string }>>({})
  const [clientId] = useState(() => `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  const [weatherSummary, setWeatherSummary] = useState<WeatherSummary | null>(null)
  const [alertBanner, setAlertBanner] = useState<any>(null)
  const [alertCount, setAlertCount] = useState(0)
  const lastUserMsgRef = useRef('')

  const { messages, isLoading, send, clear } = useChat(language, clientId)
  const { lastAlert, connected } = useWebSocket(clientId)

  useEffect(() => {
    getLanguages().then(r => setLanguages(r.languages)).catch(() => {})
  }, [])

  useEffect(() => {
    if (lastAlert) {
      setAlertBanner(lastAlert)
      setAlertCount(c => c + 1)
      setTimeout(() => setAlertBanner(null), 15000)
    }
  }, [lastAlert])

  useEffect(() => {
    const h = (e: Event) => send((e as CustomEvent).detail)
    window.addEventListener('weathergpt-suggestion', h)
    return () => window.removeEventListener('weathergpt-suggestion', h)
  }, [send])

  const handleSelectLocation = useCallback(async (name: string) => {
    try {
      const data = await getWeatherSummary(name, 7)
      setWeatherSummary(data)
    } catch {}
  }, [])

  // Auto-load weather when user sends a message with a city name
  useEffect(() => {
    const lastUser = [...messages].reverse().find(m => m.role === 'user')
    if (lastUser && lastUser.content !== lastUserMsgRef.current) {
      lastUserMsgRef.current = lastUser.content
      const city = extractCity(lastUser.content)
      if (city) handleSelectLocation(city)
    }
  }, [messages, handleSelectLocation])

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar
        clientId={clientId}
        language={language}
        languages={languages}
        onLanguageChange={setLanguage}
        theme={theme}
        onThemeToggle={toggleTheme}
        onSelectLocation={handleSelectLocation}
        alertCount={alertCount}
      />

      <div className="flex-1 flex flex-col min-w-0 wx-clear">
        <AlertBanner alert={alertBanner} onDismiss={() => setAlertBanner(null)} />

        {/* Top bar */}
        <div className="h-11 border-b border-white/10 glass-strong flex items-center px-4 justify-between md:px-6 pl-14 md:pl-6 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-white/30'}`} />
            <span className="text-[11px] text-white/50 font-semibold">
              {connected ? 'Live' : 'Connecting...'}
            </span>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clear}
              className="text-[11px] text-white/40 hover:text-white/70 transition-colors font-semibold px-2 py-1 rounded-lg hover:bg-white/10"
            >
              Clear
            </button>
          )}
        </div>

        {/* Scrollable area: charts on top, chat below */}
        <div className="flex-1 overflow-y-auto">
          {/* Weather summary + charts (always visible when loaded) */}
          {weatherSummary && (
            <div className="fade-in">
              <WeatherCard data={weatherSummary} />
              {weatherSummary.daily.length > 0 && (
                <ForecastChart days={weatherSummary.daily} />
              )}
            </div>
          )}

          {/* Chat messages */}
          <ChatPanel messages={messages} isLoading={isLoading} />
        </div>

        <ChatInput onSend={send} isLoading={isLoading} />
      </div>
    </div>
  )
}

export default App
