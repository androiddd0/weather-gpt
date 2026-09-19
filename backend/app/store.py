"""Simple JSON-file persistence for users, saved locations and alerts.
Structured so it can be swapped for PostgreSQL/MongoDB later without touching callers."""
from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import settings


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Store:
    def __init__(self, path: Path):
        self.path = path
        self._lock = threading.RLock()
        self.data: dict[str, Any] = {"users": {}, "alerts": [], "alert_seq": 0, "chat_log": []}
        if path.exists():
            try:
                loaded = json.loads(path.read_text(encoding="utf-8"))
                for k in ("users", "alerts", "alert_seq", "chat_log"):
                    if k in loaded:
                        self.data[k] = loaded[k]
            except Exception:
                pass
        # Bootstrap a demo bot user so the platform never looks empty.
        self.data["users"].setdefault("demonow", {
            "id": "demonow", "language": "en",
            "locations": [{"id": "loc-hyd", "name": "Hyderabad", "latitude": 17.385, "longitude": 78.4867, "created": _now_iso()}],
        })

    def save(self):
        with self._lock:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(json.dumps(self.data, ensure_ascii=False, indent=1), encoding="utf-8")
            tmp.replace(self.path)

    # ---------------- users ----------------
    def get_user(self, client_id: str) -> dict | None:
        with self._lock:
            return self.data["users"].get(client_id)

    def ensure_user(self, client_id: str, language: str = "en") -> dict:
        with self._lock:
            u = self.data["users"].get(client_id)
            if u is None:
                u = {"id": client_id, "language": language, "locations": []}
                self.data["users"][client_id] = u
                self.save()
            else:
                u["language"] = language
            return u

    # ---------------- saved locations ----------------
    def add_location(self, client_id: str, name: str, latitude: float, longitude: float) -> dict:
        with self._lock:
            u = self.ensure_user(client_id)
            rec = {"id": "loc-" + uuid.uuid4().hex[:8], "name": name,
                   "latitude": latitude, "longitude": longitude, "created": _now_iso()}
            u.setdefault("locations", []).append(rec)
            self.save()
            return rec

    def remove_location(self, client_id: str, loc_id: str) -> bool:
        with self._lock:
            u = self.ensure_user(client_id)
            before = len(u.get("locations", []))
            u["locations"] = [l for l in u.get("locations", []) if l["id"] != loc_id]
            changed = len(u["locations"]) != before
            if changed:
                self.save()
            return changed

    def all_watched_locations(self) -> list[tuple[str, str, dict]]:
        """Return (client_id, location_record) pairs across all users, deduped by coords."""
        seen: set[tuple[float, float]] = set()
        out: list[tuple[str, dict]] = []
        with self._lock:
            for u in self.data["users"].values():
                for loc in u.get("locations", []):
                    key = (round(loc.get("latitude", 0), 2), round(loc.get("longitude", 0), 2))
                    if key in seen:
                        continue
                    seen.add(key)
                    out.append((u["id"], loc))
        return out

    # ---------------- alerts ----------------
    def add_alert(self, alert: dict) -> bool:
        """Add an alert; dedupe by (location_id, alert_key, date-bucket). Returns True if new."""
        key = alert.get("dedup_key")
        with self._lock:
            for a in self.data["alerts"][-100:]:
                if a.get("dedup_key") == key:
                    return False
            alert["id"] = "al-" + uuid.uuid4().hex[:8]
            alert["ts"] = _now_iso()
            self.data["alerts"].append(alert)
            self.data["alerts"] = self.data["alerts"][-300:]
            self.save()
            return True

    def list_alerts(self, client_id: str | None = None, limit: int = 50) -> list[dict]:
        with self._lock:
            alerts = self.data["alerts"]
            if client_id:
                u = self.data["users"].get(client_id)
                my_names = {l["name"].lower() for l in u.get("locations", [])} if u else set()
                alerts = [a for a in alerts if a.get("place", "").lower() in my_names and a["severity"] in ("watch", "warning")]
            alerts = sorted(alerts, key=lambda a: a.get("ts", ""), reverse=True)
            return alerts[:limit]


store = Store(settings.DATA_FILE)