# WeatherGPT

Conversational Weather & Local Alert Assistant for India.

AI-powered chatbot that integrates meteorological data, forecasting models, and alert systems to deliver accurate, contextual, multilingual weather intelligence through natural conversation.

## Features

- **Natural language weather queries** — ask in English, Hindi, or 11 Indian languages
- **Real-time weather** — temperature, humidity, wind, conditions for any Indian city
- **Multi-day forecasts** — up to 16 days with rain probability, UV index
- **Historical trends** — climate comparison vs same period last year
- **Extreme weather alerts** — IMD-inspired severity rules with live push notifications
- **Air quality (AQI)** — PM2.5, PM10, ozone, NO2 data
- **Sunrise/sunset times** — daily sun data for any location
- **Voice input** — hands-free queries via Web Speech API
- **Dark/light theme** — toggle based on preference, persists across sessions
- **Multilingual** — Hindi, Marathi, Bengali, Tamil, Telugu, Kannada, Malayalam, Gujarati, Punjabi, Odia
- **Saved locations** — manage favourite cities, get alerts for each
- **WebSocket live alerts** — real-time push when extreme weather is detected
- **Telegram notifications** — optional Bot API integration

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11+, FastAPI, Uvicorn |
| LLM Agent | OpenAI SDK (Groq / any compatible API) with function calling |
| Weather Data | Open-Meteo (free, no API key) |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Charts | Chart.js via react-chartjs-2 |
| Notifications | WebSocket + optional Telegram Bot API |

## Quick Start

### 1. Backend

```bash
# Install Python dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your LLM_API_KEY (get one free from https://console.groq.com/keys)

# Run the server
python -m app.main
# Server starts at http://localhost:8000
```

### 2. Frontend

```bash
cd frontend

# Install Node dependencies
npm install

# Development mode (hot reload, proxies to backend)
npm run dev
# Frontend at http://localhost:5173

# Production build (served by FastAPI)
npm run build
```

### 3. Production

```bash
# Build frontend
cd frontend && npm run build && cd ..

# Run backend (serves built frontend from frontend/dist/)
python -m app.main
# Visit http://localhost:8000
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Send a message to the weather agent |
| `GET` | `/api/weather/summary` | Structured weather data for charting |
| `GET` | `/api/locations` | List saved locations |
| `POST` | `/api/locations` | Save a new location |
| `DELETE` | `/api/locations/{id}` | Remove a saved location |
| `GET` | `/api/alerts` | List active alerts |
| `GET` | `/api/alerts/history` | Alert history with timestamps |
| `POST` | `/api/alerts/scan` | Manually trigger alert scan |
| `POST` | `/api/alerts/test` | Push a demo alert |
| `GET` | `/api/languages` | List supported languages |
| `GET` | `/api/health` | Health check |
| `WS` | `/ws` | WebSocket for live alert push |

## Configuration

Environment variables (`.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_API_KEY` | — | API key for Groq or OpenAI-compatible endpoint |
| `LLM_BASE_URL` | `https://api.groq.com/openai/v1` | LLM API base URL |
| `LLM_MODEL` | `openai/gpt-oss-120b` | Model name |
| `TELEGRAM_BOT_TOKEN` | — | Optional Telegram bot token |
| `TELEGRAM_CHAT_ID` | — | Optional Telegram chat ID |
| `ALERT_INTERVAL_MIN` | `15` | Alert scan interval in minutes |
| `ALERT_MIN_SEVERITY` | `watch` | Minimum severity to trigger notifications |

## Architecture

```
weather-gpt/
├── app/                    # Python backend
│   ├── main.py            # FastAPI app + routes
│   ├── agent.py           # LLM agent with tool calling
│   ├── tools.py           # Tool definitions + implementations
│   ├── weather.py         # Open-Meteo API integration
│   ├── alerts.py          # Alert engine + scheduler
│   ├── language.py        # Multilingual support
│   ├── store.py           # JSON persistence
│   ├── notifier.py        # Telegram integration
│   ├── config.py          # Settings from env
│   └── ws.py              # WebSocket manager
├── frontend/              # React + Vite frontend
│   ├── src/
│   │   ├── App.tsx        # Main app component
│   │   ├── api.ts         # Backend API client
│   │   ├── types.ts       # TypeScript interfaces
│   │   ├── hooks/         # Custom React hooks
│   │   └── components/    # UI components
│   └── package.json
├── .env.example
├── requirements.txt
└── pyproject.toml
```

## License

MIT
