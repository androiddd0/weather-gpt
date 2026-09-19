"""Lightweight Telegram bot notifier using the Bot API over HTTP (no extra deps)."""
from __future__ import annotations

import httpx

from .config import settings


class TelegramNotifier:
    def __init__(self, token: str = "", chat_id: str = ""):
        self.token = token or settings.TELEGRAM_BOT_TOKEN
        self.chat_id = chat_id or settings.TELEGRAM_CHAT_ID

    @property
    def enabled(self) -> bool:
        return bool(self.token and self.chat_id)

    def send(self, text: str, parse_mode: str = "HTML") -> bool:
        if not self.enabled:
            return False
        try:
            resp = httpx.post(
                f"https://api.telegram.org/bot{self.token}/sendMessage",
                json={"chat_id": self.chat_id, "text": text, "parse_mode": parse_mode},
                timeout=10,
            )
            return resp.status_code == 200
        except Exception:
            return False

    def alert_message(self, alert: dict) -> str:
        emoji = {"watch": "🟡", "warning": "🔴"}.get(alert.get("severity", "watch"), "🔵")
        return (f"{emoji} <b>WeatherGPT Alert — {alert.get('place', '')}</b>\n"
                f"{alert.get('title', '')}\n{alert.get('message', '')}\n"
                f"🕐 {alert.get('ts', '')[:19].replace('T', ' ')} UTC")


telegram = TelegramNotifier()