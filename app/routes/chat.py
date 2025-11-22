from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List
import json

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        # Envia atualização de contagem para todos ao conectar
        await self.broadcast_count()

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            # A atualização de contagem no disconnect será chamada manualmente no endpoint
            # pois este método é síncrono aqui, mas precisamos fazer await no broadcast

    async def broadcast(self, message: str):
        # Envia mensagem bruta para todos
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                print(f"Error sending message: {e}")

    async def broadcast_json(self, data: dict):
        # Helper para enviar dicionário como JSON string
        await self.broadcast(json.dumps(data))

    async def broadcast_count(self):
        # Envia o número total de conexões ativas
        count = len(self.active_connections)
        message = {"type": "count", "count": count}
        await self.broadcast_json(message)

manager = ConnectionManager()
router = APIRouter()

@router.websocket("/ws/chat")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            
            # Tenta processar a mensagem recebida
            try:
                # O frontend manda {"username": "X", "text": "Y"}
                # Vamos adicionar o type="chat" e retransmitir
                message_data = json.loads(data)
                message_data["type"] = "chat"
                
                await manager.broadcast_json(message_data)
            except:
                # Fallback para texto puro se não for JSON válido
                await manager.broadcast(data)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        # Envia atualização de contagem para todos ao desconectar
        await manager.broadcast_count()