from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.game_manager import game_manager
import json

# Definição do router (necessária antes de usar @router)
router = APIRouter()

@router.websocket("/ws/game/{game_id}/{color}")
async def game_endpoint(websocket: WebSocket, game_id: str, color: str):
    await websocket.accept() 
    await game_manager.connect_player(game_id, websocket, color)
    
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            
            msg_type = msg.get("type")

            if msg_type == "move":
                await game_manager.process_move(game_id, msg, color)
            elif msg_type == "surrender": 
                await game_manager.player_surrender(game_id, color)
            # --- NOVOS TIPOS DE MENSAGEM ---
            elif msg_type in ["chat", "signal"]:
                # 'signal' = WebRTC (SDP offer/answer/ice candidates)
                # 'chat' = texto dentro da partida
                await game_manager.forward_message(game_id, msg, color)
                
    except (WebSocketDisconnect, RuntimeError):
        await game_manager.disconnect_player(game_id, color)