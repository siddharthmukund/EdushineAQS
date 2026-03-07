"""WebSocket endpoint for real-time committee collaboration."""
import json
from typing import Dict, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["Committee WebSocket"])

# In-memory connection registry: committee_id → set of WebSockets
_connections: Dict[str, Set[WebSocket]] = {}


@router.websocket("/ws/committee/{committee_id}")
async def committee_websocket(websocket: WebSocket, committee_id: str):
    """
    Real-time committee collaboration channel.

    Client → server event types:
      - vote_cast      : {type, candidate_id, member_name, vote, comment?}
      - comment_added  : {type, candidate_id, member_name, comment, parent_id?}
      - member_joined  : {type, member_name, member_email}
      - user_viewing   : {type, candidate_id, member_name}

    Server → client broadcasts the same payload enriched with a server timestamp.
    """
    await websocket.accept()

    if committee_id not in _connections:
        _connections[committee_id] = set()
    _connections[committee_id].add(websocket)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"error": "Invalid JSON"})
                continue

            await _broadcast(committee_id, payload, exclude=websocket)

    except WebSocketDisconnect:
        _connections[committee_id].discard(websocket)
        if not _connections[committee_id]:
            del _connections[committee_id]


async def _broadcast(committee_id: str, message: dict, exclude: WebSocket | None = None):
    dead: Set[WebSocket] = set()
    for ws in list(_connections.get(committee_id, [])):
        if ws is exclude:
            continue
        try:
            await ws.send_json(message)
        except Exception:
            dead.add(ws)

    if dead and committee_id in _connections:
        _connections[committee_id] -= dead
