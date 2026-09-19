"""WeatherGPT — FastAPI application. Chat agent + saved locations + scheduled alerts + WebSocket push."""
from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from fastapi.middleware.cors import CORSMiddleware

from . import alerts
from .agent import run_llm_agent
from .config import settings
from .language import LANGUAGES, language_hint_sentence
from .store import store
from .weather import WeatherError, resolve_location
from .ws import manager

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("weathergpt")


@asynccontextmanager
async def lifespan(app: FastAPI):
    alerts.bind_broadcaster(manager.send_to)
    alerts.start_scheduler()
    yield
    alerts.stop_scheduler()


app = FastAPI(title="WeatherGPT", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------- models -------------------------------
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=800)
    language: str = "en"
    client_id: str = "anonymous"
    history: list[dict] = Field(default_factory=list)


class LocationRequest(BaseModel):
    client_id: str
    location: str = Field(..., min_length=2, max_length=120)


# ------------------------------- chat -------------------------------
@app.post("/api/chat")
def chat(req: ChatRequest) -> dict[str, Any]:
    store.ensure_user(req.client_id, req.language)
    t0 = time.perf_counter()
    result = run_llm_agent(req.message.strip(), req.language, req.history)
    result["elapsed_ms"] = int((time.perf_counter() - t0) * 1000)
    result["hint"] = language_hint_sentence(result.get("language", "en"))
    return result


# ------------------------------- saved locations -------------------------------
@app.get("/api/locations")
def list_locations(client_id: str = Query(...)):
    u = store.get_user(client_id) or store.ensure_user(client_id)
    return {"locations": u.get("locations", [])}


@app.post("/api/locations")
def save_location(req: LocationRequest):
    try:
        loc = resolve_location(req.location)
    except WeatherError as e:
        raise HTTPException(status_code=422, detail=str(e))
    rec = store.add_location(req.client_id, loc["name"], loc["latitude"], loc["longitude"])
    return {"location": rec, "resolved": loc}


@app.delete("/api/locations/{loc_id}")
def remove_location(loc_id: str, client_id: str = Query(...)):
    if not store.remove_location(client_id, loc_id):
        raise HTTPException(status_code=404, detail="location not found")
    return {"ok": True}


# ------------------------------- alerts -------------------------------
@app.get("/api/alerts")
def get_alerts(client_id: str = Query(""), severe_only: bool = Query(False)):
    alerts_list = store.list_alerts(client_id or None, limit=50)
    if severe_only:
        alerts_list = [a for a in alerts_list if a.get("severity") == "warning"]
    return {"alerts": alerts_list, "count": len(alerts_list)}


@app.post("/api/alerts/scan")
async def scan_now():
    """Manual trigger of the alert engine (great for demos / tests)."""
    created = await alerts.run_scan_and_notify()
    return {"created": len(created), "alerts": created}


@app.post("/api/alerts/test")
async def push_test_alert(client_id: str = Query("anonymous")):
    """Simulate a severe-weather alert to demo the live push pipeline end-to-end."""
    ev = {
        "place": "Chennai",
        "severity": "warning",
        "title": "[DEMO] Very Heavy Rainfall alert — Chennai",
        "message": "Simulated IMD red alert: 120 mm rain expected in 24h. Stay indoors, avoid waterlogged roads, keep emergency numbers handy.",
        "type": "extreme_weather",
        "dedup_key": f"demo|{time.time_ns()}",
    }
    store.add_alert(ev)
    await alerts.broadcast_alert(client_id, ev)
    return {"created": 1, "alert": ev}


# ------------------------------- weather summary (for charts) -------------------------------
@app.get("/api/weather/summary")
def weather_summary(location: str = Query(..., min_length=2), days: int = Query(7, ge=1, le=16)):
    """Structured weather data optimised for charting: temp/rain arrays by day."""
    from . import weather as w
    try:
        fc = w.forecast(location, days=days)
        cur = w.current_weather(location)
    except WeatherError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {
        "place": fc["place"],
        "current": {
            "temperature_c": cur["temperature_c"],
            "feels_like_c": cur["feels_like_c"],
            "humidity_percent": cur["humidity_percent"],
            "wind_kmh": cur["wind_kmh"],
            "wind_gusts_kmh": cur.get("wind_gusts_kmh"),
            "condition": cur["condition"],
            "emoji": cur["emoji"],
            "cloud_cover_percent": cur.get("cloud_cover_percent"),
            "pressure_hpa": cur.get("pressure_hpa"),
            "precipitation_mm": cur.get("precipitation_mm"),
            "is_day": cur.get("is_day", True),
            "sunrise": cur.get("sunrise"),
            "sunset": cur.get("sunset"),
            "today_high_c": cur.get("today_high_c"),
            "today_low_c": cur.get("today_low_c"),
        },
        "daily": [
            {
                "date": d["date"],
                "high_c": d["high_c"],
                "low_c": d["low_c"],
                "rain_mm": d["rain_mm"],
                "rain_prob_percent": d["rain_prob_percent"],
                "wind_kmh": d["wind_kmh"],
                "wind_gust_kmh": d.get("wind_gust_kmh"),
                "uv_index": d["uv_index"],
                "condition": d["condition"],
                "emoji": d["emoji"],
            }
            for d in fc["days"]
        ],
    }


# ------------------------------- alerts history -------------------------------
@app.get("/api/alerts/history")
def alerts_history(client_id: str = Query(""), limit: int = Query(50, ge=1, le=200)):
    """Alert history with timestamps for the UI alerts panel."""
    alerts_list = store.list_alerts(client_id or None, limit=limit)
    return {"alerts": alerts_list, "count": len(alerts_list)}


# ------------------------------- meta -------------------------------
@app.get("/api/languages")
def languages():
    return {"languages": LANGUAGES, "default": "en"}


@app.get("/api/health")
def health():
    return {"status": "ok", "llm_configured": bool(settings.LLM_API_KEY),
            "telegram_configured": bool(settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID)}


# ------------------------------- websocket (alert push) -------------------------------
@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket, client_id: str = "anonymous"):
    await manager.connect(client_id, ws)
    try:
        # send any stored alerts for this client on connect
        for alert in store.list_alerts(client_id, limit=10):
            if alert.get("severity") in ("watch", "warning"):
                await ws.send_json({"type": "alert", "alert": alert})
        while True:
            msg = await ws.receive_json()
            if msg.get("type") == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(client_id, ws)


# ------------------------------- static frontend -------------------------------
FRONTEND = Path(settings.FRONTEND_DIR)
DIST = FRONTEND / "dist"

if DIST.exists():
    # Production: serve built Vite output
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        file = DIST / full_path
        if file.is_file():
            return FileResponse(file)
        return FileResponse(DIST / "index.html")
else:
    # Development: serve raw frontend/ or show placeholder
    if FRONTEND.exists():
        app.mount("/assets", StaticFiles(directory=FRONTEND / "assets"), name="assets")

        @app.get("/")
        def index():
            return FileResponse(FRONTEND / "index.html")
    else:
        @app.get("/")
        def index():
            return {"message": "WeatherGPT API is running. Frontend not built yet. Run 'npm run dev' in frontend/ or 'npm run build' to create dist/."}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)