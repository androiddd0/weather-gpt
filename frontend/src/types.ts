export interface CurrentWeather {
  place: string
  admin?: string
  country?: string
  observed_at: string
  condition: string
  emoji: string
  temperature_c: number
  feels_like_c: number
  humidity_percent: number
  wind_kmh: number
  wind_gusts_kmh: number
  precipitation_mm: number
  cloud_cover_percent: number
  pressure_hpa: number | null
  is_day: boolean
  today_high_c: number
  today_low_c: number
  today_rain_mm: number
  today_rain_prob_percent: number
  today_wind_max_kmh: number
  sunrise: string | null
  sunset: string | null
}

export interface ForecastDay {
  date: string
  condition: string
  emoji: string
  high_c: number
  low_c: number
  rain_mm: number
  rain_prob_percent: number
  wind_kmh: number
  wind_gust_kmh: number | null
  uv_index: number
}

export interface Forecast {
  place: string
  admin?: string
  country?: string
  days: ForecastDay[]
  wind_unit: string
}

export interface WeatherSummary {
  place: string
  current: {
    temperature_c: number
    feels_like_c: number
    humidity_percent: number
    wind_kmh: number
    wind_gusts_kmh: number | null
    condition: string
    emoji: string
    cloud_cover_percent: number | null
    pressure_hpa: number | null
    precipitation_mm: number | null
    is_day: boolean
    sunrise: string | null
    sunset: string | null
    today_high_c: number | null
    today_low_c: number | null
  }
  daily: ForecastDay[]
}

export interface AirQuality {
  place: string
  us_aqi: number
  category: string
  pm2_5: number | null
  pm10: number | null
  o3: number | null
  no2: number | null
  so2: number | null
  co: number | null
}

export interface WeatherAlert {
  id: string
  place: string
  severity: 'info' | 'advisory' | 'watch' | 'warning'
  title: string
  message: string
  type: string
  ts: string
  data?: {
    today_high_c?: number
    today_rain_mm?: number
    today_wind_max_kmh?: number
    hourly_precip_max?: number
  }
}

export interface SavedLocation {
  id: string
  name: string
  latitude: number
  longitude: number
  created: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  tools?: string[]
  offline?: boolean
}

export interface ChatResponse {
  answer: string
  language: string
  tools: string[]
  status: string
  offline?: boolean
  elapsed_ms?: number
  hint?: string
}
