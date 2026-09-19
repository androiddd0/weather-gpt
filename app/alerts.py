"""IMD-style extreme-weather alert engine with a scheduled background scanner."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from apscheduler.schedulers.background import BackgroundScheduler

from .config import settings
from .notifier import telegram
from .store import store
from . import weather

log = logging.getLogger("weathergpt.alerts")

# Thresholds inspired by IMD colour-coded warnings
SEV_RULES = [
    # (severity, label, test(data) -> bool)
    # Heavy / very heavy rain from hourly or daily data
    ("warning", "Very Heavy Rainfall", lambda w: (w.get("hourly_precip_max") or 0) >= 20 or (w.get("today_rain_mm") or 0) >= 115.6),
    ("warning", "Heavy Rainfall", lambda w: (w.get("hourly_precip_max") or 0) >= 10 or (w.get("today_rain_mm") or 0) >= 64.5),
    ("warning", "Extreme Heatwave", lambda w: (w.get("today_high_c") or 0) >= 47),
    ("watch", "Heatwave", lambda w: (w.get("today_high_c") or 0) >= 40),
    ("warning", "Storm-Force Winds", lambda w: (w.get("today_wind_max_kmh") or 0) >= 90),
    ("watch", "Strong Winds", lambda w: (w.get("today_wind_max_kmh") or 0) >= 62),
]

SEVERITY_ORDER = {"info": 0, "advisory": 1, "watch": 2, "warning": 3}


def evaluate_location(loc: dict) -> list[dict]:
    """Evaluate one saved location and return new alert events."""
    try:
        cur = weather.current_weather(loc["name"])
    except Exception as e:
        log.warning("alert scan failed for %s: %s", loc.get("name"), e)
        return []

    hourly = cur.get("hourly_precip_max")
    if hourly is None:
        try:
            cur["hourly_precip_max"] = 0.0
        except (KeyError, TypeError):
            pass

    w = {
        "hourly_precip_max": None,
        "today_rain_mm": cur.get("today_rain_mm"),
        "today_high_c": cur.get("today_high_c"),
        "today_wind_max_kmh": cur.get("today_wind_max_kmh"),
    }
    # try to get hourly peak precipitation for better rain detection
    try:
        loc2 = weather.resolve_location(loc["name"])
        data = weather._get_json(f"{settings.WEATHER_BASE}/forecast", {
            "latitude": loc2["latitude"], "longitude": loc2["longitude"], "timezone": "auto",
            "hourly": "precipitation", "forecast_days": 1, "past_days": 1,
        })
        vals = [v or 0 for v in data["hourly"]["precipitation"]][-12:]
        w["hourly_precip_max"] = round(max(vals), 1) if vals else 0.0
    except Exception:
        w["hourly_precip_max"] = 0.0

    events = []
    for sev, label, test in SEV_RULES:
        if test(w):
            bucket = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            events.append({
                "place": cur.get("place") or loc["name"],
                "severity": sev,
                "title": f"{label} likely in {cur.get('place') or loc['name']}",
                "message": _advice(sev, label, w, cur),
                "type": "extreme_weather",
                "dedup_key": f"{loc.get('name')}|{label}|{bucket}",
                "data": {k: w[k] for k in ("today_high_c", "today_rain_mm", "today_wind_max_kmh", "hourly_precip_max")},
            })
    return events


def _advice(sev: str, label: str, w: dict, cur: dict) -> str:
    parts = []
    if w["today_high_c"]:
        parts.append(f"Max temp {w['today_high_c']}°C")
    if w["today_rain_mm"]:
        parts.append(f"expected rain {w['today_rain_mm']} mm")
    if (w.get("hourly_precip_max") or 0) > 1:
        parts.append(f"hourly peak {w['hourly_precip_max']} mm")
    if w["today_wind_max_kmh"]:
        parts.append(f"wind up to {w['today_wind_max_kmh']} km/h")
    detail = ", ".join(parts)
    if sev == "warning":
        tip = "Avoid travel unless necessary, keep emergency numbers handy, and follow local IMD bulletins."
    else:
        tip = "Stay alert, secure loose items, and check updates before travel."
    return f"{label}. {detail}. {tip}"


async def run_scan_and_notify() -> list[dict]:
    """Scan all watched locations, store new alerts, fan out to clients + Telegram."""
    watched = store.all_watched_locations()
    new_alerts: list[dict] = []
    for client_id, loc in watched:
        for ev in evaluate_location(loc):
            if SEVERITY_ORDER[ev["severity"]] < SEVERITY_ORDER.get(settings.ALERT_MIN_SEVERITY, "watch"):
                continue
            if store.add_alert(ev):
                new_alerts.append((client_id, ev))
    for client_id, ev in new_alerts:
        await broadcast_alert(client_id, ev)
    if new_alerts:
        log.info("dispatched %d alert event(s)", len(new_alerts))
    return [ev for _, ev in new_alerts]


_broadcast_fns: Any = None


def bind_broadcaster(fn):
    """Register the WebSocket broadcast callback (set by main app)."""
    global _broadcast_fns
    _broadcast_fns = fn


async def broadcast_alert(client_id: str, ev: dict):
    if _broadcast_fns is not None:
        try:
            await _broadcast_fns(client_id, {"type": "alert", "alert": ev})
        except Exception:
            pass
    if telegram.enabled:
        try:
            loop = asyncio.get_running_loop()
            loop.run_in_executor(None, telegram.send, telegram.alert_message(ev))
        except RuntimeError:
            telegram.send(telegram.alert_message(ev))


_scheduler: BackgroundScheduler | None = None


def start_scheduler():
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(_job, "interval", minutes=max(5, settings.ALERT_INTERVAL_MIN),
                       id="alert_scan", misfire_grace_time=120)
    _scheduler.start()
    log.info("alert scheduler started (every %d min)", settings.ALERT_INTERVAL_MIN)


def stop_scheduler():
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None


def _job():
    try:
        asyncio.run(run_scan_and_notify())
    except Exception:
        log.exception("alert scan job crashed")