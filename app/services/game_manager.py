import uuid
import json
import logging
from typing import List, Dict, Any
from fastapi import WebSocket
from app.db import db
from bson import ObjectId
from datetime import datetime

# Configuração básica de logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GameManager:
    def __init__(self):
        self.waiting_queue: List[WebSocket] = []
        self.active_games: Dict[str, Dict[str, Any]] = {}

    # --- MATCHMAKING ---
    async def add_to_queue(self, websocket: WebSocket):
        self.waiting_queue.append(websocket)
        if len(self.waiting_queue) >= 2:
            p1 = self.waiting_queue.pop(0)
            p2 = self.waiting_queue.pop(0)
            await self.create_match(p1, p2)

    def remove_from_queue(self, websocket: WebSocket):
        if websocket in self.waiting_queue: self.waiting_queue.remove(websocket)

    async def create_match(self, p1: WebSocket, p2: WebSocket):
        game_id = str(uuid.uuid4())
        logger.info(f"Criando partida {game_id}")
        
        self.active_games[game_id] = {
            "white_ws": None, "black_ws": None,
            "white_user_id": None, "black_user_id": None,
            "white_name": "Aguardando...", "white_email": "",
            "black_name": "Aguardando...", "black_email": "",
            "turn": "white",
            "board": self._get_initial_board(),
            "chain_piece": None,
            "last_move_from": None,
            "last_move_to": None,
            "start_time": datetime.utcnow()
        }
        
        # Notifica jogadores
        for s, c in [(p1, 'white'), (p2, 'black')]:
            try:
                await s.send_json({"type": "match_found", "game_id": game_id, "color": c})
                await s.close() # Fecha socket de matchmaking para forçar reconexão no socket de jogo
            except Exception as e:
                logger.error(f"Erro ao notificar match: {e}")

    # --- CONEXÃO ---
    async def connect_player(self, game_id: str, websocket: WebSocket, color: str, player_data: dict):
        if game_id not in self.active_games:
            logger.warning(f"Tentativa de conexão em jogo inexistente: {game_id}")
            await websocket.close(code=4000)
            return

        game = self.active_games[game_id]
        game[f"{color}_ws"] = websocket
        
        if player_data:
            game[f"{color}_user_id"] = player_data.get("id")
            game[f"{color}_name"] = player_data.get("name", "Jogador")
            game[f"{color}_email"] = player_data.get("email", "")

        logger.info(f"Jogador {color} conectado em {game_id}")
        await self.broadcast_game_state(game_id)

    async def disconnect_player(self, game_id: str, color: str):
        if game_id in self.active_games:
            logger.info(f"Jogador {color} desconectado de {game_id}")
            if f"{color}_ws" in self.active_games[game_id]:
                self.active_games[game_id][f"{color}_ws"] = None

    # --- CHAT ---
    async def forward_message(self, game_id: str, message: dict, sender_color: str):
        game = self.active_games.get(game_id)
        if not game: return
        
        if message.get("type") == "chat":
            sender_name = game.get(f"{sender_color}_name", "Oponente")
            message["sender"] = sender_name
        
        opponent_color = "black" if sender_color == "white" else "white"
        ws = game.get(f"{opponent_color}_ws")
        if ws:
            try: await ws.send_json(message)
            except Exception as e: logger.error(f"Erro ao encaminhar mensagem: {e}")

    # --- ESTADO ---
    def _build_state_msg(self, game):
        return {
            "type": "update", 
            "board": game["board"], 
            "turn": game["turn"], 
            "chain_piece": game["chain_piece"],
            "last_move_from": game["last_move_from"], 
            "last_move_to": game["last_move_to"],
            "players": {
                "white": { 
                    "name": game["white_name"], 
                    "email": game.get("white_email", ""), 
                    "id": game["white_user_id"] 
                },
                "black": { 
                    "name": game["black_name"], 
                    "email": game.get("black_email", ""), 
                    "id": game["black_user_id"] 
                }
            }
        }

    async def send_individual_update(self, websocket: WebSocket, game: dict):
        try: await websocket.send_json(self._build_state_msg(game))
        except: pass

    async def broadcast_game_state(self, game_id: str):
        game = self.active_games.get(game_id)
        if not game: return
        msg = self._build_state_msg(game)
        for c in ["white", "black"]:
            ws = game.get(f"{c}_ws")
            if ws: 
                try: await ws.send_json(msg)
                except Exception as e: logger.error(f"Erro broadcast: {e}")

    # --- FINALIZAÇÃO ---
    async def player_surrender(self, game_id: str, loser_color: str):
        game = self.active_games.get(game_id)
        if not game: return
        winner_color = "black" if loser_color == "white" else "white"
        await self.broadcast_game_over(game_id, winner_color, "surrender")

    async def broadcast_game_over(self, game_id: str, winner: str, reason: str):
        game = self.active_games.get(game_id)
        if not game: return
        
        self._update_player_stats(game, winner)

        msg = {"type": "game_over", "winner": winner, "reason": reason}
        
        for c in ["white", "black"]:
            ws = game.get(f"{c}_ws")
            if ws: 
                try: 
                    await ws.send_json(msg)
                    await ws.close()
                except: pass
        
        if game_id in self.active_games:
            del self.active_games[game_id]

    def _update_player_stats(self, game, winner_color):
        try:
            white_id = game.get("white_user_id")
            black_id = game.get("black_user_id")
            if not white_id or not black_id or len(str(white_id)) < 10: return
            
            white_oid = ObjectId(white_id)
            black_oid = ObjectId(black_id)
            
            if winner_color == "white":
                db["users"].update_one({"_id": white_oid}, {"$inc": {"wins": 1, "totalGames": 1}})
                db["users"].update_one({"_id": black_oid}, {"$inc": {"losses": 1, "totalGames": 1}})
            elif winner_color == "black":
                db["users"].update_one({"_id": black_oid}, {"$inc": {"wins": 1, "totalGames": 1}})
                db["users"].update_one({"_id": white_oid}, {"$inc": {"losses": 1, "totalGames": 1}})
            elif winner_color == "draw":
                db["users"].update_one({"_id": white_oid}, {"$inc": {"draws": 1, "totalGames": 1}})
                db["users"].update_one({"_id": black_oid}, {"$inc": {"draws": 1, "totalGames": 1}})
        except Exception as e: logger.error(f"Stats error: {e}")

    # --- PROCESSAMENTO DE MOVIMENTO (COM TRY/EXCEPT) ---
    async def process_move(self, game_id: str, move_data: dict, player_color: str):
        try:
            game = self.active_games.get(game_id)
            if not game: return

            if move_data.get("type") == "request_state":
                ws = game.get(f"{player_color}_ws")
                if ws: await self.send_individual_update(ws, game)
                return

            if game["turn"] != player_color: 
                logger.warning(f"Movimento rejeitado: turno errado ({player_color})")
                return 

            origin, target = move_data["from"], move_data["to"]
            board = game["board"]

            is_valid, is_capture = self._validate_move_logic(game, origin, target, player_color)
            
            if not is_valid:
                logger.warning(f"Movimento inválido de {player_color}")
                # Envia estado atual para corrigir o cliente (rollback visual)
                await self.broadcast_game_state(game_id)
                return

            self._apply_move_on_board(board, origin, target, is_capture)
            
            game["last_move_from"] = origin
            game["last_move_to"] = target
            game["chain_piece"] = None 
            turn_ends = True

            if is_capture:
                if self._can_capture_from(board, target, player_color):
                    game["chain_piece"] = target
                    turn_ends = False
            
            if turn_ends:
                game["turn"] = "black" if game["turn"] == "white" else "white"
                opponent_color = game["turn"] 
                if await self._check_win_conditions(board, player_color, opponent_color, game_id):
                    return

            await self.broadcast_game_state(game_id)
            
        except Exception as e:
            logger.error(f"Erro processando movimento: {e}")
            # Tenta recuperar o estado para não travar
            await self.broadcast_game_state(game_id)

    # --- REGRAS DE MOVIMENTO (DAMA VOADORA) ---
    
    def _is_path_clear(self, board, r1, c1, r2, c2):
        dr = 1 if r2 > r1 else -1
        dc = 1 if c2 > c1 else -1
        r, c = r1 + dr, c1 + dc
        while r != r2:
            if board[r][c] is not None: return False
            r += dr
            c += dc
        return True

    def _validate_move_logic(self, game, o, t, color):
        try:
            board, chain_piece = game["board"], game["chain_piece"]
            
            # Validações básicas de índices
            if not (0 <= t['r'] < 8 and 0 <= t['c'] < 8) or board[t['r']][t['c']]: return False, False
            piece = board[o['r']][o['c']]
            if not piece or piece['color'] != color: return False, False
            
            # Se houver chain piece, a origem DEVE ser ela
            if chain_piece and (o['r'] != chain_piece['r'] or o['c'] != chain_piece['c']): return False, False

            row_diff = t['r'] - o['r']
            col_diff = t['c'] - o['c']
            if abs(row_diff) != abs(col_diff): return False, False

            is_king = piece.get('king', False)
            forward = -1 if color == 'white' else 1

            has_capture_available = self._has_any_capture(board, color)

            # MOVIMENTO SIMPLES
            if not has_capture_available and not chain_piece:
                if is_king:
                    if self._is_path_clear(board, o['r'], o['c'], t['r'], t['c']): return True, False
                else:
                    if abs(row_diff) == 1 and row_diff == forward: return True, False
                return False, False

            # MOVIMENTO DE CAPTURA
            # Simplificação: Captura com salto de 2 casas (para peças e damas em curta distância)
            # Para suporte completo a dama voadora capturando à distância, a lógica seria:
            # Verificar se no caminho existe APENAS UMA peça inimiga e se o destino é livre.
            
            # Vamos manter a lógica robusta de captura próxima por enquanto para evitar bugs de travamento
            if abs(row_diff) >= 2:
                # Verifica caminho
                dr = 1 if row_diff > 0 else -1
                dc = 1 if col_diff > 0 else -1
                
                r, c = o['r'] + dr, o['c'] + dc
                enemy_found = False
                
                while r != t['r']:
                    p = board[r][c]
                    if p:
                        if p['color'] == color: return False, False # Bloqueado por amiga
                        if enemy_found: return False, False # Já pulou uma inimiga, não pode pular duas
                        enemy_found = True
                    r += dr
                    c += dc
                
                if enemy_found: return True, True

            return False, False
        except Exception as e:
            logger.error(f"Erro validação lógica: {e}")
            return False, False

    def _apply_move_on_board(self, board, o, t, is_capture):
        p = board[o['r']][o['c']]
        
        if is_capture:
            # Remove a peça capturada entre a origem e o destino
            dr = 1 if t['r'] > o['r'] else -1
            dc = 1 if t['c'] > o['c'] else -1
            r, c = o['r'] + dr, o['c'] + dc
            while r != t['r']:
                if board[r][c]:
                    board[r][c] = None
                    break
                r += dr
                c += dc
        
        board[o['r']][o['c']] = None
        board[t['r']][t['c']] = p
        
        if (p['color']=='white' and t['r']==0) or (p['color']=='black' and t['r']==7): p['king'] = True

    def _can_capture_from(self, board, pos, color):
        # Simplificado: Captura adjacente (pulo de 2)
        # Para Dama Voadora completa, isso precisaria escanear as diagonais inteiras
        r, c = pos['r'], pos['c']
        dirs = [(-2,-2),(-2,2),(2,-2),(2,2)]
        for dr, dc in dirs:
            tr, tc, mr, mc = r+dr, c+dc, r+dr//2, c+dc//2
            if 0<=tr<8 and 0<=tc<8 and not board[tr][tc]:
                mid = board[mr][mc]
                if mid and mid['color']!=color: return True
        return False

    def _has_any_capture(self, board, color):
        for r in range(8):
            for c in range(8):
                piece = board[r][c]
                if piece and piece['color'] == color and self._can_capture_from(board, {'r': r, 'c': c}, color):
                    return True
        return False

    def _check_win_conditions(self, board, current_player_color, opponent_color, game_id):
        opponent_pieces = sum(1 for row in board for piece in row if piece and piece['color'] == opponent_color)
        if opponent_pieces == 0:
            return self.broadcast_game_over(game_id, current_player_color, "annihilation")
        return False 

    def _get_initial_board(self):
        b = [[None]*8 for _ in range(8)]
        for r in range(8):
            for c in range(8):
                if (r+c)%2==1:
                    if r<3: b[r][c]={"color":"black","king":False}
                    elif r>4: b[r][c]={"color":"white","king":False}
        return b

game_manager = GameManager()