"""WebSocket connection manager for live alert pushes."""
from __future__ import annotations

from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active: dict[str, list[WebSocket]] = {}

    async def connect(self, client_id: str, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(client_id, []).append(ws)

    def disconnect(self, client_id: str, ws: WebSocket):
        conns = self.active.get(client_id, [])
        if ws in conns:
            conns.remove(ws)
        if not conns:
            self.active.pop(client_id, None)

    async def send_to(self, client_id: str, payload: dict):
        conns = list(self.active.get(client_id, []))
        dead = []
        for ws in conns:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(client_id, ws)

    async def broadcast(self, payload: dict):
        for client_id in list(self.active.keys()):
            await self.send_to(client_id, payload)


manager = ConnectionManager()