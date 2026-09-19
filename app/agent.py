"""LLM agent: query understanding + tool selection + conversational response.
Includes a deterministic fallback router so the demo survives LLM outages."""
from __future__ import annotations

import logging
import re
from typing import Any, Optional

from openai import OpenAI

from .config import settings
from .language import detect_language, LANGUAGES
from .tools import TOOL_IMPL, TOOLS, try_route_intent
from . import weather

log = logging.getLogger("weathergpt.agent")

SYSTEM_PROMPT = """You are WeatherGPT, a friendly meteorological assistant for India. You help farmers, commuters, students and disaster managers get accurate weather intelligence through natural conversation.

HOW TO ANSWER:
1. Understand the user's intent and select the correct tool:
   - "hello", "hi", "namaste", "hey", "good morning" -> respond conversationally WITHOUT tools. Introduce yourself briefly and suggest what you can help with.
   - "current / now / right now / today" -> get_current_weather
   - "forecast / next days / upcoming week / will it rain tomorrow" -> get_forecast
   - "history / trend / compared to last year / monsoon average / climate" -> get_historical_trend
   - "alert / warning / heavy rain / storm / danger / safe to travel" -> get_weather_alerts
   - "air quality / AQI / pollution / smog" -> get_air_quality
   - "sunrise / sunset / sun time / dawn / dusk" -> get_sunrise_sunset
2. Call exactly the tool(s) you need. Resolve any user location in the 'location' field.
3. After receiving tool output, write a concise, conversational reply (4-8 sentences max, use bullet lists when useful). Use °C and km/h. Mention the place, the figure, and what it means practically for the user.
4. If the user asks who you are or for help, answer conversationally without tools.
5. For weather responses, always include: the current temperature, what it feels like, humidity, wind speed, and a practical tip (e.g. "carry an umbrella", "stay hydrated", "good day for outdoor work").
6. For forecasts, mention sunrise/sunset times if relevant, UV index for outdoor activities.

LANGUAGE: Always reply in the SAME language the user wrote in. This is critical. India has 22 languages — detect Devanagari (Hindi/Marathi), Tamil, Telugu, Kannada, Malayalam, Bengali, Gujarati, Punjabi, Odia scripts. Romanised Hindi (Hinglish like "aaj ka mausam kaisa hai dilli me") should get a Hinglish reply. If the user message is in English, reply in English.

ADVISORIES: For farmers mention crop-relevant tips (irrigation for heat, drainage for rain). For commuters mention travel safety. Keep it practical.

If tool data is missing (null), say so honestly rather than inventing numbers."""


def _client() -> Optional[OpenAI]:
    if not settings.LLM_API_KEY:
        return None
    try:
        return OpenAI(api_key=settings.LLM_API_KEY, base_url=settings.LLM_BASE_URL or None)
    except Exception:
        return None


_PLACE_STOP = {
    "today", "tomorrow", "now", "right", "weather", "mausam", "forecast", "history",
    "trend", "air", "quality", "pollution", "next", "this", "the", "will", "rain",
    "heavy", "week", "days", "day", "temperature", "what", "how", "is", "are", "me",
    "my", "city", "village", "area", "kya", "kal", "aaj", "for", "and", "in", "at",
    "please", "tell", "about", "wheather", "forecaster", "delhi", "during", "after",
}


def _extract_location(text: str) -> str:
    """Best-effort: pull a location from the user message for the fallback router."""
    low = " ".join(text.lower().split())
    # 1) most reliable: known Indian city aliases (+ their local-language spellings)
    for alias in weather.CITY_ALIAS_INDEX:
        if alias and alias in low:
            return alias
    # 2) prepositional phrases ("in Kolkata", "ता में", "య్ में")
    m = re.search(
        r"\b(?:in|at|for|near|around|me|ka|ke|ki|का|की|के|में|मे|માં|இல்|లో|तालुक्यात)\s+([A-Za-z\u0900-\u0D7F][\w\u0900-\u0D7F-]*)\b",
        text, flags=re.I)
    if m and m.group(1).lower() not in _PLACE_STOP:
        return m.group(1)
    # 3) any Capitalised word that isn't at the start of a sentence / a stop word
    words = re.findall(r"\b[A-Z][a-z]{2,}\b", text)
    for w in words:
        if w.lower() not in _PLACE_STOP:
            return w
    # 4) fall back to the last plausible token
    toks = re.findall(r"[\w\u0900-\u0D7F]{3,}", text)
    for t in reversed(toks):
        if t.lower() not in _PLACE_STOP:
            return t
    return "Delhi"


def fallback_answer(message: str, lang: str) -> dict[str, Any]:
    """Deterministic answer used when the LLM is unavailable or errors."""
    lang = detect_language(message, lang)
    low = message.lower()
    loc = _extract_location(message)
    try:
        route = try_route_intent(message) or _rule_intent(low)
        # Handle greetings without tools
        if not route and re.search(r"\b(hello|hi|hey|namaste|namaskar|good morning|good evening|good afternoon)\b", low):
            greetings = {
                "en": "Hello! I'm WeatherGPT, your weather assistant for India. I can help you with:\n\n- Current weather conditions\n- Multi-day forecasts\n- Historical climate trends\n- Extreme weather alerts\n- Air quality (AQI)\n- Sunrise & sunset times\n\nJust ask me about any city — try \"What's the weather in Delhi?\" or \"Forecast for Mumbai this week\".",
                "hi": "नमस्ते! मैं WeatherGPT हूँ, भारत के लिए आपका मौसम सहायक। मैं इनमें मदद कर सकता हूँ:\n\n- मौसम की जानकारी\n- आने वाले दिनों का पूर्वानुमान\n- ऐतिहासिक मौसम डेटा\n- चेतावनी और अलर्ट\n- वायु गुणवत्ता (AQI)\n- सूर्योदय और सूर्यास्त का समय\n\nबस किसी भी शहर के बारे में पूछें — \"दिल्ली में मौसम कैसा है?\" या \"मुंबई का पूर्वानुमान\" आज़माएं।",
            }
            return {"answer": greetings.get(lang, greetings["en"]), "language": lang, "tools": [], "status": "ok", "offline": True}
        data = TOOL_IMPL[route](loc) if route else weather.current_weather(loc)
    except weather.WeatherError as e:
        return {"answer": str(e), "language": lang, "tools": [], "status": "ok", "offline": True}

    tool_label = {
        "get_current_weather": "get_current_weather",
        "get_forecast": "get_forecast",
        "get_historical_trend": "get_historical_trend",
        "get_weather_alerts": "get_weather_alerts",
        "get_air_quality": "get_air_quality",
        "get_sunrise_sunset": "get_sunrise_sunset",
    }.get(route, "get_current_weather")

    if route == "get_current_weather":
        body = f"{data.get('emoji','')} In {data.get('place')}, it is {data.get('condition')} at {data.get('temperature_c')}°C (feels like {data.get('feels_like_c')}°C). Humidity {data.get('humidity_percent')}%, wind {data.get('wind_kmh')} km/h. High today {data.get('today_high_c')}°C / low {data.get('today_low_c')}°C."
        answer = body
    elif route == "get_forecast":
        rows = data.get("days", [])
        lines = [f"{d['date']}: {d['emoji']} {d['condition']}, {d['high_c']}°C / {d['low_c']}°C, rain {d['rain_prob_percent']}%" for d in rows]
        answer = f"Forecast for {data.get('place')}:\n" + "\n".join(lines)
    elif route == "get_historical_trend":
        t, p = data.get("this_period", {}), data.get("same_period_last_year", {})
        answer = (f"Trend for {data.get('place')} ({data.get('period_start')} to {data.get('period_end')}): "
                  f"avg high {t.get('mean_high_c')}°C vs {p.get('mean_high_c')}°C a year earlier; "
                  f"rain {t.get('total_rain_mm')} mm over {t.get('rainy_days')} rainy days vs {p.get('total_rain_mm')} mm a year ago.")
    elif route == "get_weather_alerts":
        answer = f"Current conditions in {data.get('place')}: {data.get('condition')}, max today {data.get('today_high_c')}°C, rain {data.get('today_rain_mm')} mm, wind {data.get('today_wind_max_kmh')} km/h. No official IMD warning issued for this forecast."
    elif route == "get_sunrise_sunset":
        answer = f"Sun times for {data.get('place')}: sunrise {data.get('sunrise', 'N/A')}, sunset {data.get('sunset', 'N/A')}."
    else:
        answer = f"Air quality in {data.get('place')}: AQI {data.get('us_aqi')} ({data.get('category')}); PM2.5 {data.get('pm2_5')} µg/m³."

    if lang == "hi" and route:
        answer += "\n\n(मुझसे LLM की मदद के बिना उत्तर मिला — ऑफ़लाइन मोड। LLM_ API_KEY सेट करने पर और अच्छा जवाब मिलेगा।)"
    return {"answer": answer, "language": lang, "tools": [tool_label], "status": "ok", "offline": True}


def _rule_intent(low: str) -> Optional[str]:
    if re.search(r"\b(hello|hi|hey|namaste|namaskar|good morning|good evening|good afternoon)\b", low):
        return None  # greeting — no tool needed
    if re.search(r"sunrise|sunset|sun rise|sun set|sun time|dawn|dusk|सूर्योदय|सूर्यास्त", low):
        return "get_sunrise_sunset"
    if re.search(r"forecast|next \d|tomorrow|kal|week|couple of days|5 day|7 day", low):
        return "get_forecast"
    if re.search(r"history|historical|trend|compared|last year|monsoon|average|pichhla|इतिहास|औसत", low):
        return "get_historical_trend"
    if re.search(r"alert|warning|heavy rain|storm|thunder|dang|बारिश|आंधी", low):
        return "get_weather_alerts"
    if re.search(r"air quality|aqi|pollution|smog|प्रदूषण", low):
        return "get_air_quality"
    if re.search(r"weather|mausam|temp|temperature|season|मौसम|तापमान", low):
        return "get_current_weather"
    return None


def run_llm_agent(message: str, lang: str, history: list[dict]) -> dict[str, Any]:
    """Main path: LLM with function calling. Returns {answer, language, tools, status}."""
    client = _client()
    if client is None:
        return fallback_answer(message, lang)

    detected = detect_language(message, lang)
    tools_trace: list[dict] = []
    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    for h in history[-8:]:
        messages.append({"role": h["role"], "content": h["content"][:1200]})
    messages.append({"role": "user", "content": message})

    try:
        for _ in range(3):
            resp = client.chat.completions.create(
                model=settings.LLM_MODEL,
                messages=messages,
                tools=TOOLS,
                temperature=0.3,
                max_tokens=900,
            )
            choice = resp.choices[0]
            finish = (choice.finish_reason or "").lower()
            if choice.message.tool_calls:
                messages.append({"role": "assistant",
                                 "content": choice.message.content or "",
                                 "tool_calls": [tc.model_dump() for tc in choice.message.tool_calls]})
                for tc in choice.message.tool_calls:
                    fn = tc.function
                    args = _safe_args(fn.arguments)
                    try:
                        result = TOOL_IMPL[fn.name](args.get("location", ""), **args)
                        status = "ok"
                    except weather.WeatherError as e:
                        result = {"error": str(e)}
                        status = "error"
                    except Exception as e:
                        result = {"error": f"Internal error: {e}"}
                        status = "error"
                    tools_trace.append({"name": fn.name, "arguments": args, "status": status})
                    messages.append({"role": "tool", "tool_call_id": tc.id,
                                     "content": _compact(result)})
                continue
            answer = (choice.message.content or "").strip()
            if not answer:
                raise RuntimeError("empty assistant message")
            return {"answer": answer, "language": detected, "tools": tools_trace,
                    "status": "ok", "offline": False}
    except Exception as e:
        log.warning("LLM agent failed (%s); falling back to router", e)
        return fallback_answer(message, lang)


def _safe_args(raw: str) -> dict:
    import json
    try:
        a = json.loads(raw or "{}")
        return a if isinstance(a, dict) else {}
    except Exception:
        return {}


def _compact(d: dict) -> str:
    import json
    return json.dumps(d, ensure_ascii=False, default=str)[:2500]