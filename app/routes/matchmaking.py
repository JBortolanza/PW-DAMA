from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.game_manager import game_manager

router = APIRouter()

@router.websocket("/ws/matchmaking")
async def matchmaking_endpoint(websocket: WebSocket):
    await websocket.accept()
    await game_manager.add_to_queue(websocket)
    try:
        while True:
            await websocket.receive_text()
    except (WebSocketDisconnect, RuntimeError):
        game_manager.remove_from_queue(websocket)