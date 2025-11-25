from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from app.services.game_manager import game_manager
from app.auth import get_current_user, decode_access_token # Importe suas funcoes de auth
from app.db import db
from bson import ObjectId
import json

router = APIRouter()

async def get_user_from_ws(websocket: WebSocket):
    """Tenta recuperar o usuário autenticado a partir dos cookies do WebSocket"""
    try:
        token = websocket.cookies.get("access_token")
        if not token: return None
        
        payload = decode_access_token(token)
        if not payload: return None
        
        email = payload.get("sub")
        if not email: return None
        
        user = db["users"].find_one({"email": email})
        return user
    except:
        return None

@router.websocket("/ws/game/{game_id}/{color}")
async def game_endpoint(
    websocket: WebSocket, 
    game_id: str, 
    color: str,
    userId: str = Query(None) # Mantém como fallback
):
    await websocket.accept() 
    
    # 1. Tenta autenticação segura via Cookie
    user = await get_user_from_ws(websocket)
    
    player_data = {
        "id": None,
        "name": "Anônimo",
        "email": ""
    }

    if user:
        # Usuário autenticado real
        player_data["id"] = str(user["_id"])
        player_data["name"] = user.get("name", "Jogador")
        player_data["email"] = user.get("email", "")
    elif userId and userId != "anon":
        # Fallback para ID da URL (menos seguro, mas útil para dev)
        player_data["id"] = userId
        try:
            u = db["users"].find_one({"_id": ObjectId(userId)})
            if u:
                player_data["name"] = u.get("name", "Visitante")
                player_data["email"] = u.get("email", "")
        except: pass
    
    # Conecta usando os dados resolvidos
    await game_manager.connect_player(game_id, websocket, color, player_data)
    
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