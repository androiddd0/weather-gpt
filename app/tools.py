"""Tool definitions + implementations. The LLM picks which tool to call per query."""
from __future__ import annotations

import re
from typing import Any, Callable

from . import weather
from .language import CITY_KEYWORDS


def _clean_location(loc: str) -> str:
    """Extract the place part from a free-text location string."""
    if not loc:
        return loc
    loc = loc.strip().strip('"').strip("'")
    loc = re.sub(r"\b(today|tomorrow|now|right now|next \w+ days|this week|the |in |at |for)\b", " ", loc, flags=re.I)
    return " ".join(loc.split()).strip()


def _cur(loc: str, **kwargs) -> dict[str, Any]:
    return weather.current_weather(_clean_location(loc))


def _fc(loc: str, days: int = 3, **kwargs) -> dict[str, Any]:
    return weather.forecast(_clean_location(loc), days=int(kwargs.get("days", days) or days))


def _hist(loc: str, **kwargs) -> dict[str, Any]:
    days = int(kwargs.get("period_days") or kwargs.get("days") or 30)
    return weather.historical_analysis(_clean_location(loc), period_days=days)


def _alerts(loc: str, **kwargs) -> dict[str, Any]:
    return weather.current_weather(_clean_location(loc))


def _aq(loc: str, **kwargs) -> dict[str, Any]:
    return weather.air_quality(_clean_location(loc))


TOOLS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "get_current_weather",
            "description": "Get the real-time current weather for a place: temperature, feels-like, humidity, wind, cloud cover, and today's high/low. Use for queries about 'now', 'current', 'today's weather', 'temperature right now'.",
            "parameters": {
                "type": "object",
                "properties": {"location": {"type": "string", "description": "City or town name, e.g. 'Delhi'. Works in Hindi and other Indian languages too."}},
                "required": ["location"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_forecast",
            "description": "Get a multi-day weather forecast for a place: daily highs/lows, rain chance, wind and conditions. Use for 'forecast', 'next few days', 'the coming week', 'will it rain tomorrow'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "City or town name, e.g. 'Mumbai'."},
                    "days": {"type": "integer", "description": "Number of days ahead (1-7 typical).", "minimum": 1, "maximum": 16, "default": 5},
                },
                "required": ["location"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_historical_trend",
            "description": "Climate trend / historical analysis for a place: compares the recent period (default last 30 days) against the same period a year earlier — avg highs/lows, total rain, rainy days, hot days. Use for 'history', 'trend', 'monsoon comparison', 'hotter or cooler than last year', 'average weather'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "City or town name, e.g. 'Pune'."},
                    "period_days": {"type": "integer", "description": "How many recent days to analyse (7-365).", "minimum": 7, "maximum": 365, "default": 30},
                },
                "required": ["location"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather_alerts",
            "description": "Check a place for active extreme-weather conditions or warnings: heavy rain, heat, high wind, fog or storms. Returns a severity + advisory message. Use for 'alert', 'warning', 'heavy rain', 'storm', 'dangerous weather', 'safe to travel'.",
            "parameters": {
                "type": "object",
                "properties": {"location": {"type": "string", "description": "City or town name, e.g. 'Chennai'."}},
                "required": ["location"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_air_quality",
            "description": "Get the current Air Quality Index (AQI) and pollutants (PM2.5, PM10, O3, NO2) for a place. Use for 'air quality', 'AQI', 'pollution', 'smog', 'breathing'.",
            "parameters": {
                "type": "object",
                "properties": {"location": {"type": "string", "description": "City or town name, e.g. 'Delhi'."}},
                "required": ["location"],
            },
        },
    },
]

TOOL_IMPL: dict[str, Callable[..., dict]] = {
    "get_current_weather": _cur,
    "get_forecast": _fc,
    "get_historical_trend": _hist,
    "get_weather_alerts": _alerts,
    "get_air_quality": _aq,
}


def try_route_intent(message: str) -> str | None:
    """Very cheap safety-net router: returns a tool name or None (let the LLM decide)."""
    low = message.lower()
    hits = 0
    for kw in CITY_KEYWORDS:
        if kw in low:
            hits += 1
    if hits and ("kal" in low or "tomorrow" in low or "forecast" in low or "next" in low):
        return "get_forecast"
    if hits:
        return "get_current_weather"
    return None