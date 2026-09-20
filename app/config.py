import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


class Settings:
    LLM_API_KEY = os.getenv("LLM_API_KEY", "")
    LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.groq.com/openai/v1")
    LLM_MODEL = os.getenv("LLM_MODEL", "openai/gpt-oss-120b")

    TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
    TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

    ALERT_INTERVAL_MIN = int(os.getenv("ALERT_INTERVAL_MIN", "15"))
    ALERT_MIN_SEVERITY = os.getenv("ALERT_MIN_SEVERITY", "watch")

    DATA_FILE = BASE_DIR / "data" / "weathergpt.json"
    FRONTEND_DIR = BASE_DIR / "frontend"

    HTTP_TIMEOUT = 15.0
    WEATHER_BASE = "https://api.open-meteo.com/v1"
    ARCHIVE_BASE = "https://archive-api.open-meteo.com/v1"
    GEOCODE_BASE = "https://geocoding-api.open-meteo.com/v1"
    AIR_BASE = "https://air-quality-api.open-meteo.com/v1"


settings = Settings()