from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.services.game_manager import game_manager
import json

router = APIRouter()

@router.websocket("/ws/game/{game_id}/{color}")
async def game_endpoint(
    websocket: WebSocket, 
    game_id: str, 
    color: str,
    userId: str = Query(None) # Captura ?userId=... da URL
):
    await websocket.accept() 
    
    # Se não tiver userId, usa 'anonymous' (evita crash, mas não salva stats)
    player_id = userId if userId else "anonymous"
    
    await game_manager.connect_player(game_id, websocket, color, player_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            
            msg_type = msg.get("type")

            if msg_type == "move":
                await game_manager.process_move(game_id, msg, color)
            elif msg_type == "surrender": 
                await game_manager.player_surrender(game_id, color)
            elif msg_type in ["chat", "signal"]:
                await game_manager.forward_message(game_id, msg, color)
                
    except (WebSocketDisconnect, RuntimeError):
        await game_manager.disconnect_player(game_id, color)