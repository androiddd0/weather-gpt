# 🌦️ WeatherGPT — Conversational Weather & Local Alert Assistant

An AI-powered, multilingual weather chatbot for India. Understands natural-language queries, **picks the right data source via LLM tool-calling**, answers in the user's own language, and runs a **scheduled extreme-weather alert engine** that pushes warnings live to the web UI and (optionally) Telegram.

Built for a 5–6 hour hackathon window. Live data from **Open-Meteo** (current / forecast / historical archive / air quality / geocoding — all free, no API key).

---

## ✨ Features vs. the problem statement

| Problem-statement requirement | Implementation |
|---|---|
| Real-time weather retrieval | Open-Meteo current conditions (temp, feels-like, humidity, wind, pressure) |
| NL querying for forecasts | Chat agent; multi-day forecasts with rain %, wind, UV, sunrise/sunset |
| Tool-selection logic (current vs forecast vs history) | `gpt-oss-120b` function-calling over **5 distinct tools**; deterministic router as fallback. The UI shows which tool was used ✔ |
| Extreme weather alerts + proactive warning | APScheduler scans saved locations every 15 min against **IMD-style thresholds** (heavy rain ≥10 mm/h or ≥64.5 mm/day, heatwave ≥40 °C, gale ≥62 km/h) |
| Location-based forecasting & advisory | Every answer includes practical advice (farmer / commuter use cases) |
| Multilingual (Indian languages) | Auto-detects 10 scripts (Hindi, Tamil, Telugu, Bengali, Marathi, Kannada, Malayalam, Gujarati, Punjabi, Odia) + Hinglish; replies in the same language |
| Climate trend / historical analysis | Archive API compares recent 30 days vs same period a year earlier |
| Voice-enabled interaction | Web Speech API: 🎤 mic input + spoken answers in `hi-IN`/regional voices (Chrome/Edge) |

---

## 🏗️ Architecture

```
frontend/index.html (chat UI + WS client)
        │  POST /api/chat                │ WS /ws (alerts)
        ▼                                ▼
  ┌───────────────────────────────────────────────┐
  │ FastAPI (backend/app/main.py)                  │
  │  agent.py  → LLM tool-calling loop (gpt-oss)   │
  │              └─ fallback: rule router (tools)  │
  │  tools.py    5 tool schemas + implementations  │
  │  weather.py  Open-Meteo client (all products)  │
  │  language.py script/language detection + hints │
  │  alerts.py   APScheduler scan + severity rules │
  │  notifier.py Telegram bot push (optional)      │
  │  store.py    JSON persistence (→ swap: Postgres)│
  └───────────────┬───────────┬────────────────────┘
                  │           │
              Telegram     WebSocket push to UI
```

## 🚀 Quick start

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # or: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env          # then edit .env
.venv\Scripts\uvicorn app.main:app --port 8000
```

Open **http://localhost:8000**

Windows shortcut: `python start.py` (or double-click `start.bat`).

### `.env`
```ini
# LLM for query-understanding + tool selection (OpenAI-compatible)
LLM_API_KEY=             # free key from https://console.groq.com  (model: openai/gpt-oss-120b)
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=openai/gpt-oss-120b

# Optional Telegram push — via @BotFather, then message your bot once and use that chat id
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

ALERT_INTERVAL_MIN=15
```

> **No LLM key?** The app still works — it falls back to a deterministic intent router (~300 ms) with the same tool layer. Set `LLM_API_KEY` to unlock full conversational replies + language generation.

## 🎬 5-minute demo script

1. **Tool selection** — ask "5 day forecast for Mumbai" → shows `forecast` chip. Then "heavy rain warning for Kolkata" → `alert check`. Then "is it hotter than last year in Pune" → `climate trend`.
2. **Multilingual** — pick हिन्दी (or type "दिल्ली का मौसम कैसा है"); answer comes back in Hindi. Try தமிழ் / తెలుగు / বাংলা.
3. **Voice** — tap 🎤 and speak "aaj ka mausam kaisa hai mumbai"; it types, answers, and speaks back (Chrome/Edge).
4. **Alerts** — click 🚨 *Simulate alert* → a red "Very Heavy Rainfall" warning pops into the chat + bell badge, over the live WebSocket. 
5. **Saved locations** — add Chennai in the sidebar → the 15-min scheduler will start watching it; bell shows matching alerts.

## 🔌 API summary

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/chat` | `{message, language, client_id, history}` → `{answer, language, tools[], elapsed_ms}` |
| GET/POST/DELETE | `/api/locations` | saved-location watchlist per client |
| GET | `/api/alerts` | alert feed for a client |
| POST | `/api/alerts/scan` | run alert engine now |
| POST | `/api/alerts/test` | simulate a warning (live-push demo) |
| WS | `/ws?client_id=…` | live alert push |
| GET | `/api/languages`, `/api/health` | meta |

## 📁 Structure

```
backend/app/     FastAPI + agent + tools + weather + alerts + store
backend/start.py portable launcher
frontend/        index.html (self-contained chat app)
data/            JSON persistence (created at runtime)
```

## 🧠 How it decides the right tool

The agent's system prompt maps intents → tools and calls them with the resolved `location`:

- "now / right now / today" → `get_current_weather`
- "forecast / next week / will it rain" → `get_forecast`
- "trend / history / vs last year / monsoon" → `get_historical_trend`
- "warning / heavy rain / safe to travel" → `get_weather_alerts`
- "air quality / AQI / pollution" → `get_air_quality`

City names work in Indian scripts too (`दिल्ली`, `சென்னை`, `ಕೋಲ್ಕತ್ತಾ`…) via an alias + geocoding layer.

## ⚠️ Evaluation notes (for the judges)

- **Accuracy** — data is live from Open-Meteo; nothing is hard-coded.
- **Latency** — offline router ~300 ms; Groq gpt-oss-120b ~400–900 ms, both far under real-time limits.
- **Working alerts** — scheduler is wired; use 🚨 to prove the live push + Telegram.
- **Multilingual** — visible in the chat + selectable language menu + voice.