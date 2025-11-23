from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.game_manager import game_manager
import json

router = APIRouter()

@router.websocket("/ws/game/{game_id}/{color}")
async def game_endpoint(websocket: WebSocket, game_id: str, color: str):
    await websocket.accept() # Aceita a conexão imediatamente
    await game_manager.connect_player(game_id, websocket, color)
    
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            
            if msg.get("type") == "move":
                await game_manager.process_move(game_id, msg, color)
            elif msg.get("type") == "surrender": # <--- ENCERRAMENTO POR DESISTÊNCIA
                await game_manager.player_surrender(game_id, color)
                
    except (WebSocketDisconnect, RuntimeError):
        await game_manager.disconnect_player(game_id, color)