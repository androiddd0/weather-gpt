"""Open-Meteo weather provider: current conditions, forecast, history, air quality, geocoding."""
from __future__ import annotations

import json
import re
import threading
import time
from datetime import date, datetime, timedelta
from typing import Any, Optional

import httpx

from .config import settings

# ---------------------------------------------------------------------------
# City aliases so queries written in Hindi/Indian languages resolve correctly
# (Open-Meteo geocoding is weak for non-English text).
# ---------------------------------------------------------------------------
CITY_ALIASES: dict[str, dict] = {
    "delhi": {"name": "New Delhi", "aliases": ["delhi", "new delhi", "दिल्ली", "दिली", "dilli", "dillii"]},
    "mumbai": {"name": "Mumbai", "aliases": ["mumbai", "bombay", "मुंबई", "बॉम्बे", "मुम्बई", "मुंबई शहर"]},
    "bengaluru": {"name": "Bengaluru", "aliases": ["bengaluru", "bangalore", "बेंगलुरु", "बैंगलोर", "ಬೆಂಗಳೂರು", "பெங்களூரு"]},
    "chennai": {"name": "Chennai", "aliases": ["chennai", "madras", "चेन्नई", "சென்னை", "చెన్నై", "مدراس"]},
    "kolkata": {"name": "Kolkata", "aliases": ["kolkata", "calcutta", "कोलकाता", "কলকাতা", "ಕೋಲ್ಕತ್ತಾ"]},
    "hyderabad": {"name": "Hyderabad", "aliases": ["hyderabad", "हैदराबाद", "హైదరాబాద్", "ہیدرآباد"]},
    "pune": {"name": "Pune", "aliases": ["pune", "पुणे", "पूना", "పూణే", "पुणे शहर"]},
    "jaipur": {"name": "Jaipur", "aliases": ["jaipur", "जयपुर", "జైపూర్"]},
    "lucknow": {"name": "Lucknow", "aliases": ["lucknow", "लखनऊ", "లక్నో"]},
    "patna": {"name": "Patna", "aliases": ["patna", "पटना", "પટના"]},
    "bhopal": {"name": "Bhopal", "aliases": ["bhopal", "भोपाल", "భోపాల్"]},
    "ahmedabad": {"name": "Ahmedabad", "aliases": ["ahmedabad", "अहमदाबाद", "અમદાવાદ"]},
    "surat": {"name": "Surat", "aliases": ["surat", "सूरत", "સુરત"]},
    "guwahati": {"name": "Guwahati", "aliases": ["guwahati", "गुवाहाटी", "গুৱাহাটী"]},
    "bhubaneswar": {"name": "Bhubaneswar", "aliases": ["bhubaneswar", "भुवनेश्वर", "ଭୁବନେଶ୍ୱର"]},
    "amritsar": {"name": "Amritsar", "aliases": ["amritsar", "अमृतसर"]},
    "varanasi": {"name": "Varanasi", "aliases": ["varanasi", "banaras", "kashi", "वाराणसी", "बनारस", "కాశీ"]},
    "coimbatore": {"name": "Coimbatore", "aliases": ["coimbatore", "கோயம்புத்தூர்"]},
    "kochi": {"name": "Kochi", "aliases": ["kochi", "cochin", "कोच्चि", "കൊച്ചി", "கொச்சி"]},
    "indore": {"name": "Indore", "aliases": ["indore", "इंदौर", "इन्दौर"]},
    "nagpur": {"name": "Nagpur", "aliases": ["nagpur", "नागपुर"]},
    "kanpur": {"name": "Kanpur", "aliases": ["kanpur", "कानपुर"]},
    "agra": {"name": "Agra", "aliases": ["agra", "आगरा"]},
    "mysuru": {"name": "Mysuru", "aliases": ["mysuru", "mysore", "मैसूर", "ಮೈಸೂರು"]},
    "chandigarh": {"name": "Chandigarh", "aliases": ["chandigarh", "चंडीगढ़"]},
    "goa": {"name": "Panaji", "aliases": ["goa", "panaji", "panjim", "गोवा", "पणजी"]},
    "udupi": {"name": "Udupi", "aliases": ["udupi", "उडुपी", "ಉಡುಪಿ"]},
    "thiruvananthapuram": {"name": "Thiruvananthapuram", "aliases": ["thiruvananthapuram", "trivandrum", "तिरुवनंतपुरम", "തിരുവനന്തപുരം", "திருவனந்தபுரம்"]},
    "shimla": {"name": "Shimla", "aliases": ["shimla", "simla", "शिमला"]},
    "srinagar": {"name": "Srinagar", "aliases": ["srinagar", "श्रीनगर", "سری نگر"]},
    "mangaluru": {"name": "Mangaluru", "aliases": ["mangaluru", "mangalore", "मंगलुरु", "ಮಂಗಳೂರು"]},
}

CITY_ALIAS_INDEX: dict[str, str] = {}
for key, entry in CITY_ALIASES.items():
    for alias in entry["aliases"]:
        CITY_ALIAS_INDEX[re.sub(r"\s+", " ", alias.strip()).lower()] = key

# ---------------------------------------------------------------------------
# WMO weather codes with Indian-context wording
# ---------------------------------------------------------------------------
WMO_TEXT: dict[int, str] = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Dense fog / rime fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
    56: "Freezing drizzle", 57: "Freezing drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain",
    66: "Freezing rain", 67: "Freezing rain",
    71: "Light snow", 73: "Snow", 75: "Heavy snow",
    77: "Snow grains",
    80: "Light rain showers", 81: "Rain showers", 82: "Violent rain showers",
    85: "Snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with heavy hail",
}


def wmo_text(code: int) -> str:
    return WMO_TEXT.get(code, "Unknown")


def wmo_emoji(code: int) -> str:
    if code == 0:
        return "☀️"
    if code in (1, 2):
        return "🌤️"
    if code == 3:
        return "☁️"
    if code in (45, 48):
        return "🌫️"
    if code in (51, 53, 55, 56, 57):
        return "🌦️"
    if code in (61, 66, 67):
        return "🌧️"
    if code in (63, 65):
        return "🌧️"
    if code in (71, 73, 75, 77, 85, 86):
        return "🌨️"
    if code in (80, 81, 82):
        return "🌧️"
    if code in (95,):
        return "⛈️"
    if code in (96, 99):
        return "⛈️"
    return "🌡️"


# ---------------------------------------------------------------------------
# HTTP helper (persistent cache + rate-limit retries + stale-while-revalidate)
# ---------------------------------------------------------------------------
class WeatherError(Exception):
    pass


_client = httpx.Client(timeout=settings.HTTP_TIMEOUT)

# Open-Meteo free tier rate-limits the shared Render outbound IP with 429s.
# Strategy: short-lived live cache, plus a *persistent* on-disk copy that
# survives instance restarts/sleeps, plus stale-while-revalidate so a 429
# never shows an error to the user when we already have recent data.
_CACHE_TTL = 900          # serve fresh results for 15 minutes
_CACHE_MAX_AGE = 6 * 3600 # keep an on-disk copy up to 6 hours old
_cache: dict = {}
_cache_lock = threading.RLock()
_CACHE_FILE = settings.DATA_FILE.parent / "weather_api_cache.json"


def _cache_key(url: str, params: dict) -> str:
    return json.dumps([url, sorted(params.items())], sort_keys=True)


def _load_weather_cache() -> None:
    now = time.time()
    try:
        raw = json.loads(_CACHE_FILE.read_text(encoding="utf-8"))
        for key, pair in raw.items():
            if isinstance(pair, list) and len(pair) == 2 and now - pair[0] < _CACHE_MAX_AGE:
                _cache[key] = [pair[0], pair[1]]
    except Exception:
        pass  # no cache yet / corrupt -> start empty


_load_weather_cache()


def _save_weather_cache() -> None:
    now = time.time()
    try:
        with _cache_lock:
            payload = {k: v for k, v in _cache.items() if now - v[0] < _CACHE_MAX_AGE}
        _CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        tmp = _CACHE_FILE.with_suffix(".tmpjson")
        tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        tmp.replace(_CACHE_FILE)
    except Exception:
        pass  # disk write failure must never break a weather reply


def _stale(key: str) -> Optional[dict]:
    with _cache_lock:
        pair = _cache.get(key)
        return pair[1] if pair and time.time() - pair[0] < _CACHE_MAX_AGE else None


def _get_json(url: str, params: dict, ttl: int = _CACHE_TTL) -> dict:
    key = _cache_key(url, params)
    now = time.time()
    with _cache_lock:
        hit = _cache.get(key)
    if hit and now - hit[0] < ttl:
        return hit[1]

    for attempt in range(3):
        try:
            resp = _client.get(url, params=params)
            if resp.status_code == 429 and attempt < 2:
                wait = 1 + attempt * 2  # 1s, 3s backoff
                time.sleep(wait)
                continue
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPStatusError as e:
            stale = _stale(key)
            if stale is not None:
                return stale
            if e.response.status_code == 429 and attempt < 2:
                continue
            if e.response.status_code == 429:
                raise WeatherError("Weather data service is busy (rate limited). Try again in a minute.") from e
            raise WeatherError(f"Weather API error {e.response.status_code} for {url}") from e
        except Exception as e:  # network / json decode
            stale = _stale(key)
            if stale is not None:
                return stale
            raise WeatherError(f"Failed to reach weather service: {e}") from e

        if isinstance(data, dict):
            with _cache_lock:
                _cache[key] = [time.time(), data]
            _save_weather_cache()
        return data

    stale = _stale(key)
    if stale is not None:
        return stale
    raise WeatherError("Weather data service is busy. Try again shortly.")


# ---------------------------------------------------------------------------
# Location resolution
# ---------------------------------------------------------------------------
def resolve_location(query: str) -> dict[str, Any]:
    """Return {name, latitude, longitude, admin1?, country?} for a place name."""
    if not query or not query.strip():
        raise WeatherError("I need a place name to fetch weather for.")

    q = " ".join(query.strip().split())
    # 1) try "lat,lng" or coords in brackets like (28.61, 77.20)
    m = re.search(r"(-?\d+\.\d+)\s*[,;\s]\s*(-?\d+\.\d+)", q)
    if m and len(q) < 40:
        return {"name": q, "latitude": float(m.group(1)), "longitude": float(m.group(2))}

    # 2) alias table
    low = re.sub(r"\s+", " ", q.lower())
    if low in CITY_ALIAS_INDEX:
        entry = CITY_ALIASES[CITY_ALIAS_INDEX[low]]
        return _geocode(entry["name"])

    # 3) geocoding API
    return _geocode(q)


def _geocode(name: str) -> dict[str, Any]:
    data = _get_json(f"{settings.GEOCODE_BASE}/search",
                     {"name": name, "count": 3, "language": "en", "format": "json"})
    results = data.get("results")
    if not results:
        raise WeatherError(f"Could not find a place called '{name}'. Try a city name like 'Delhi' or 'Mumbai'.")
    r = results[0]
    return {"name": r.get("name", name),
            "latitude": r.get("latitude"),
            "longitude": r.get("longitude"),
            "admin1": r.get("admin1"),
            "country": r.get("country")}


def search_places(query: str, count: int = 8) -> list[dict[str, Any]]:
    """World-wide place autocomplete for the "add location" dropdown."""
    if not query or not query.strip():
        return []
    q = " ".join(query.strip().split())
    out: list[dict[str, Any]] = []

    low = re.sub(r"\s+", " ", q.lower())
    if low in CITY_ALIAS_INDEX:
        entry = CITY_ALIASES[CITY_ALIAS_INDEX[low]]
        loc = _geocode(entry["name"])
        out.append(loc)

    data = _get_json(f"{settings.GEOCODE_BASE}/search",
                     {"name": q, "count": count, "language": "en", "format": "json"})
    for r in data.get("results") or []:
        if r.get("latitude") is None or r.get("longitude") is None:
            continue
        out.append({
            "name": r.get("name", q),
            "latitude": r.get("latitude"),
            "longitude": r.get("longitude"),
            "admin1": r.get("admin1"),
            "country": r.get("country"),
        })

    seen: set[tuple] = set()
    deduped: list[dict[str, Any]] = []
    for r in out:
        key = (r["name"], r.get("latitude"), r.get("longitude"), r.get("country"))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(r)
    return deduped[:count]


# ---------------------------------------------------------------------------
# Data products
# ---------------------------------------------------------------------------
def current_weather(location: str) -> dict[str, Any]:
    loc = resolve_location(location)
    params = {
        "latitude": loc["latitude"], "longitude": loc["longitude"], "timezone": "auto",
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,cloud_cover,pressure_msl",
        "hourly": "temperature_2m,weather_code,precipitation,precipitation_probability,wind_speed_10m",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,sunrise,sunset",
        "forecast_days": 1,
    }
    data = _get_json(f"{settings.WEATHER_BASE}/forecast", params)
    c = data.get("current", {})
    code = int(c.get("weather_code", 0))

    today_high = data["daily"]["temperature_2m_max"][0]
    today_low = data["daily"]["temperature_2m_min"][0]
    rain_prob = data["daily"]["precipitation_probability_max"][0]
    rain_today = data["daily"]["precipitation_sum"][0]
    wind_max = data["daily"]["wind_speed_10m_max"][0]

    out = {
        "place": loc["name"],
        "admin": loc.get("admin1"),
        "country": loc.get("country"),
        "observed_at": c.get("time"),
        "condition": wmo_text(code),
        "emoji": wmo_emoji(code),
        "temperature_c": c.get("temperature_2m"),
        "feels_like_c": c.get("apparent_temperature"),
        "humidity_percent": c.get("relative_humidity_2m"),
        "wind_kmh": _kmh(c.get("wind_speed_10m")),
        "wind_gusts_kmh": _kmh(c.get("wind_gusts_10m")),
        "precipitation_mm": c.get("precipitation"),
        "cloud_cover_percent": c.get("cloud_cover"),
        "pressure_hpa": round(c.get("pressure_msl", 0), 1) if c.get("pressure_msl") is not None else None,
        "is_day": bool(c.get("is_day")),
        "today_high_c": today_high,
        "today_low_c": today_low,
        "today_rain_mm": rain_today,
        "today_rain_prob_percent": rain_prob,
        "today_wind_max_kmh": _kmh(wind_max),
        "sunrise": data["daily"].get("sunrise", [None])[0],
        "sunset": data["daily"].get("sunset", [None])[0],
    }
    return out


def forecast(location: str, days: int = 7) -> dict[str, Any]:
    days = max(1, min(16, int(days)))
    loc = resolve_location(location)
    params = {
        "latitude": loc["latitude"], "longitude": loc["longitude"], "timezone": "auto",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset",
        "forecast_days": days,
    }
    data = _get_json(f"{settings.WEATHER_BASE}/forecast", params)
    rows = []
    d = data["daily"]
    for i in range(len(d.get("time", []))):
        code = int(d["weather_code"][i] or 0)
        rows.append({
            "date": d["time"][i],
            "condition": wmo_text(code),
            "emoji": wmo_emoji(code),
            "high_c": d["temperature_2m_max"][i],
            "low_c": d["temperature_2m_min"][i],
            "rain_mm": d["precipitation_sum"][i],
            "rain_prob_percent": d["precipitation_probability_max"][i],
            "wind_kmh": _kmh(d["wind_speed_10m_max"][i]),
            "wind_gust_kmh": _kmh(d["wind_gusts_10m_max"][i]),
            "uv_index": d["uv_index_max"][i],
        })
    return {"place": loc["name"], "admin": loc.get("admin1"), "country": loc.get("country"),
            "days": rows, "wind_unit": "km/h"}


def historical_analysis(location: str, period_days: int = 30) -> dict[str, Any]:
    """Recent period vs the same period in the previous year (climate trend)."""
    period_days = max(7, min(365, int(period_days)))
    loc = resolve_location(location)

    end = date.today()
    start = end - timedelta(days=period_days)
    last_end = end - timedelta(days=365)
    last_start = start - timedelta(days=365)

    def fetch(s: date, e: date) -> dict:
        return _get_json(f"{settings.ARCHIVE_BASE}/archive", {
            "latitude": loc["latitude"], "longitude": loc["longitude"], "timezone": "auto",
            "start_date": s.isoformat(), "end_date": e.isoformat(),
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code",
        })

    this = fetch(start, end)
    prev = fetch(last_start, last_end)

    def summarise(src: dict):
        d = src["daily"]
        highs = [x for x in d["temperature_2m_max"] if x is not None]
        lows = [x for x in d["temperature_2m_min"] if x is not None]
        rains = [x or 0 for x in d["precipitation_sum"]]
        winds = [x or 0 for x in d["wind_speed_10m_max"]]
        rainy = sum(1 for x in rains if x >= 2.5)
        hot = sum(1 for x in highs if x >= 35)
        return {
            "mean_high_c": round(sum(highs) / len(highs), 1) if highs else None,
            "mean_low_c": round(sum(lows) / len(lows), 1) if lows else None,
            "max_high_c": max(highs) if highs else None,
            "min_low_c": min(lows) if lows else None,
            "total_rain_mm": round(sum(rains), 1),
            "rainy_days": rainy,
            "mean_wind_kmh": round(sum(winds) / len(winds), 1) if winds else None,
            "days_over_35c": hot,
        }

    today_cur = _get_json(f"{settings.WEATHER_BASE}/forecast", {
        "latitude": loc["latitude"], "longitude": loc["longitude"], "timezone": "auto",
        "daily": "temperature_2m_max,precipitation_sum", "forecast_days": 1,
    })
    tw = today_cur["daily"]

    return {
        "place": loc["name"], "admin": loc.get("admin1"), "country": loc.get("country"),
        "period_start": start.isoformat(), "period_end": end.isoformat(),
        "last_year_start": last_start.isoformat(), "last_year_end": last_end.isoformat(),
        "this_period": summarise(this),
        "same_period_last_year": summarise(prev),
        "today_high_forecast_c": tw["temperature_2m_max"][0],
        "today_rain_forecast_mm": tw["precipitation_sum"][0],
    }


def air_quality(location: str) -> dict[str, Any]:
    loc = resolve_location(location)
    data = _get_json(f"{settings.AIR_BASE}/air-quality", {
        "latitude": loc["latitude"], "longitude": loc["longitude"], "timezone": "auto",
        "current": "us_aqi,pm10,pm2_5,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide",
    })
    c = data.get("current", {})
    aqi = c.get("us_aqi")
    return {
        "place": loc["name"], "admin": loc.get("admin1"), "country": loc.get("country"),
        "us_aqi": aqi,
        "category": aqi_category(aqi),
        "pm2_5": c.get("pm2_5"), "pm10": c.get("pm10"), "o3": c.get("ozone"),
        "no2": c.get("nitrogen_dioxide"), "so2": c.get("sulphur_dioxide"),
        "co": c.get("carbon_monoxide"),
    }


def aqi_category(aqi) -> str:
    if aqi is None:
        return "unknown"
    if aqi <= 50:
        return "Good"
    if aqi <= 100:
        return "Moderate"
    if aqi <= 150:
        return "Unhealthy for sensitive groups"
    if aqi <= 200:
        return "Unhealthy"
    if aqi <= 300:
        return "Very unhealthy"
    return "Hazardous"


def _kmh(ms) -> Optional[float]:
    if ms is None:
        return None
    return round(ms * 3.6, 1)