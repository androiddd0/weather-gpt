"""Server-side speech-to-text via an OpenAI-compatible audio endpoint (Groq Whisper).

Used as a fallback when the browser's Web Speech API is unavailable or fails
(common on localhost, with Edge, or when Google's speech servers are blocked)."""
from __future__ import annotations

from openai import OpenAI

from .config import settings

STT_MODEL = "whisper-large-v3-turbo"
MAX_AUDIO_BYTES = 10 * 1024 * 1024

# App language codes Whisper understands natively (ISO-639-1)
_WHISPER_LANGS = {"en", "hi", "mr", "bn", "ta", "te", "kn", "ml", "gu", "pa", "or"}


def transcribe(data: bytes, filename: str, language: str = "en") -> str:
    if not settings.LLM_API_KEY:
        raise RuntimeError("Speech-to-text is not configured. Set LLM_API_KEY in .env to enable voice input.")
    if not data:
        raise RuntimeError("No audio received.")
    if len(data) > MAX_AUDIO_BYTES:
        raise RuntimeError("Audio file is too large.")
    client = OpenAI(api_key=settings.LLM_API_KEY, base_url=settings.LLM_BASE_URL or None)
    lang = (language or "").split("-")[0].lower()
    lang = lang if lang in _WHISPER_LANGS else None  # None = let Whisper auto-detect
    kwargs = {"language": lang} if lang else {}
    result = client.audio.transcriptions.create(
        model=STT_MODEL,
        file=(filename or "recording.webm", data, "audio/webm"),
        response_format="text",
        **kwargs,
    )
    return result.strip() if isinstance(result, str) else (result.text or "").strip()