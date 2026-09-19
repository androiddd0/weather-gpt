"""Multilingual support: language detection, mappings, romanised-Hindi hints."""
from __future__ import annotations

import re

# language code -> English name + native name
LANGUAGES: dict[str, dict] = {
    "en": {"name": "English", "native": "English"},
    "hi": {"name": "Hindi", "native": "हिन्दी"},       # Devanagari
    "mr": {"name": "Marathi", "native": "मराठी"},
    "bn": {"name": "Bengali", "native": "বাংলা"},
    "ta": {"name": "Tamil", "native": "தமிழ்"},
    "te": {"name": "Telugu", "native": "తెలుగు"},
    "kn": {"name": "Kannada", "native": "ಕನ್ನಡ"},
    "ml": {"name": "Malayalam", "native": "മലയാളം"},
    "gu": {"name": "Gujarati", "native": "ગુજરાતી"},
    "pa": {"name": "Punjabi", "native": "ਪੰਜਾਬੀ"},
    "or": {"name": "Odia", "native": "ଓଡ଼ିଆ"},
}

# Script unicode blocks -> language code (best guess for Indian scripts)
_SCRIPT_MAP = [
    (re.compile(r"[\u0B00-\u0B7F]"), "or"),    # Odia
    (re.compile(r"[\u0980-\u09FF]"), "bn"),    # Bengali/Assamese
    (re.compile(r"[\u0B80-\u0BFF]"), "ta"),    # Tamil
    (re.compile(r"[\u0C00-\u0C7F]"), "te"),    # Telugu
    (re.compile(r"[\u0C80-\u0CFF]"), "kn"),    # Kannada
    (re.compile(r"[\u0D00-\u0D7F]"), "ml"),    # Malayalam
    (re.compile(r"[\u0900-\u097F]"), "hi"),    # Devanagari (Hindi/Marathi/Sanskrit)
    (re.compile(r"[\u0A80-\u0AFF]"), "gu"),    # Gujarati
    (re.compile(r"[\u0A00-\u0A7F]"), "pa"),    # Gurmukhi Punjabi
]

# Romanised Hindi keywords: if the Latin-script message contains them, treat as Hinglish
_ROMAN_HINDI_HINTS = (
    "mausam", "aaj", "kal", "kya", "hai", "nahi", "kaise", "kahan", "kaisa", "kaisi",
    "garmi", "sardi", "barish", "baarish", "barsaat", "bheeg", "taap", "chale", "kab",
    "kitna", "kitni", "dilli", "mumbai", "aur", "toh", "bahut", "ho",
)


def detect_language(text: str, preferred: str = "en") -> str:
    """Detect the language of a user message. Falls back to the UI preference."""
    if not text or not text.strip():
        return _norm(preferred)
    for regex, code in _SCRIPT_MAP:
        if regex.search(text):
            if code == "hi" and "\u0921\u094B" in text and text.isascii() is False:
                # Devanagari overwhelmingly maps to Hindi for weather chat
                pass
            return code
    low = text.lower()
    if re.search(r"[a-z]", low):
        hints = sum(1 for w in _ROMAN_HINDI_HINTS if w in low)
        if hints >= 1:
            return "hi"
    return _norm(preferred)


def _norm(code: str) -> str:
    code = code.lower()
    if code in ("hi-latn", "hinglish", "hindi"):
        return "hi"
    if code.startswith("hi"):
        return "hi"
    if code in LANGUAGES:
        return code
    return "en"


def language_hint_sentence(lang: str) -> str:
    """Native-language sentence saying 'Chat with me in <language>'."""
    native = LANGUAGES.get(lang, LANGUAGES["en"])["native"]
    greet = {
        "en": f"Hi! I'm WeatherGPT. Ask me about the weather anywhere in India. Try: ",
        "hi": "नमस्ते! मैं WeatherGPT हूँ। मुझसे किसी भी शहर का मौसम पूछिए। कुछ सुझाव: ",
        "mr": "नमस्कार! मी WeatherGPT. कोणत्याहा शहराचं हवामान विचारा. सूचना: ",
        "bn": "নমস্কার! আমি WeatherGPT। কোনো শহরের আবহাওয়া জিজ্ঞেস করুন। পরামর্শ: ",
        "ta": "வணக்கம்! நான் WeatherGPT. எந்த நகரத்தின் வானிலையும் கேளுங்கள். குறிப்புகள்: ",
        "te": "నమస్తే! నేను WeatherGPT. ఏ నగరం వాతావరణం అయినా అడగండి. సూచనలు: ",
        "kn": "ನಮಸ್ಕಾರ! ನಾನು WeatherGPT. ಯಾವುದೇ ನಗರದ ಹವಾಮಾನವನ್ನು ಕೇಳಿ. ಸಲಹೆಗಳು: ",
        "ml": "നമസ്കാരം! ഞാൻ WeatherGPT. ഏത് നഗരത്തിന്റെ കാലാവസ്ഥയും ചോദിക്കൂ. നിർദ്ദേശങ്ങൾ: ",
        "gu": "નમસ્તે! હું WeatherGPT. કોઈ પણ શહેરનું હવામાન પૂછો. સૂચનો: ",
        "pa": "ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ WeatherGPT। ਕਿਸੇ ਵੀ ਸ਼ਹਿਰ ਦਾ ਮੌਸਮ ਪੁੱਛੋ। ਸੁਝਾਅ: ",
        "or": "ନମସ୍କାର! ମୁଁ WeatherGPT। କୌଣସି ସହରର ପାଣିପାଗ ପଚାରନ୍ତୁ। ପରାମର୍ଶ: ",
    }
    return greet.get(lang, greet["en"])


# Simple fallback templates (used only if the LLM is unavailable)
FALLBACK_HEADERS = {
    "en": "WeatherGPT (offline mode)",
    "hi": "WeatherGPT (ऑफ़लाइन मोड)",
}

CITY_KEYWORDS = {
    "weather status", "current weather", "weather now", "temperature", "humidity",
    "wind", "mausam", "aaj ka mausam", "तेज", "तापमान", "मौसम",
}
FORECAST_KEYWORDS = {"forecast", "next", "5 day", "5-day", "week", "tomorrow", "kal", "mausam", "पूर्वानुमान", "कल"}
ALERT_KEYWORDS = {"alert", "warning", "alert", "बारिश", "rain alert", "heavy rain", "storm", "weather warning"}
HISTORY_KEYWORDS = {"history", "historical", "trend", "compared", "last year", "monsoon", "average", "इतिहास", "औसत", "पिछला"}
AIR_KEYWORDS = {"air quality", "aqi", "pollution", "हवा", "प्रदूषण"}