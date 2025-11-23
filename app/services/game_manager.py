import uuid
import json
from typing import List, Dict, Any
from fastapi import WebSocket
# Removido import asyncio

class GameManager:
    def __init__(self):
        self.waiting_queue: List[WebSocket] = []
        self.active_games: Dict[str, Dict[str, Any]] = {}

    # --- MATCHMAKING (Mantido) ---
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
        self.active_games[game_id] = {
            "white_ws": None, "black_ws": None,
            "turn": "white",
            "board": self._get_initial_board(),
            "chain_piece": None,
            "last_move_from": None, # Novo campo
            "last_move_to": None     # Novo campo
        }
        for s, c in [(p1, 'white'), (p2, 'black')]:
            try:
                await s.send_json({"type": "match_found", "game_id": game_id, "color": c})
                await s.close()
            except: pass

    # --- GAMEPLAY & ESTADO ---
    async def connect_player(self, game_id: str, websocket: WebSocket, color: str):
        if game_id in self.active_games:
            self.active_games[game_id][f"{color}_ws"] = websocket
            await self.broadcast_game_state(game_id)
        else: await websocket.close(code=4000)

    async def send_individual_update(self, websocket: WebSocket, game: dict):
        msg = {
            "type": "update", 
            "board": game["board"], 
            "turn": game["turn"], 
            "chain_piece": game["chain_piece"],
            "last_move_from": game["last_move_from"], # Incluído
            "last_move_to": game["last_move_to"]       # Incluído
        }
        try: await websocket.send_json(msg)
        except: pass

    async def player_surrender(self, game_id: str, loser_color: str):
        game = self.active_games.get(game_id)
        if not game: return
        winner_color = "black" if loser_color == "white" else "white"
        await self.broadcast_game_over(game_id, winner_color, "surrender")

    async def broadcast_game_over(self, game_id: str, winner: str, reason: str):
        game = self.active_games.get(game_id)
        if not game: return
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

    async def process_move(self, game_id: str, move_data: dict, player_color: str):
        game = self.active_games.get(game_id)
        if not game: return

        if move_data.get("type") == "request_state":
            ws = game.get(f"{player_color}_ws")
            if ws: await self.send_individual_update(ws, game)
            return

        if game["turn"] != player_color: return 

        origin, target = move_data["from"], move_data["to"]
        board = game["board"]

        is_valid, is_capture = self._validate_move_logic(game, origin, target, player_color)
        
        if not is_valid:
            await self.broadcast_game_state(game_id)
            return

        self._apply_move_on_board(board, origin, target, is_capture)
        
        # --- REGISTRAR O MOVIMENTO ---
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

    async def broadcast_game_state(self, game_id: str):
        game = self.active_games.get(game_id)
        if not game: return
        
        msg = {
            "type": "update", 
            "board": game["board"], 
            "turn": game["turn"], 
            "chain_piece": game["chain_piece"],
            "last_move_from": game["last_move_from"], # Incluído
            "last_move_to": game["last_move_to"]       # Incluído
        }
        for c in ["white", "black"]:
            ws = game.get(f"{c}_ws")
            if ws: 
                try: await ws.send_json(msg)
                except: pass

    async def disconnect_player(self, game_id: str, color: str):
        if game_id in self.active_games:
            if f"{color}_ws" in self.active_games[game_id]:
                self.active_games[game_id][f"{color}_ws"] = None

    # --- VERIFICAÇÃO DE VITÓRIA / EMPATE (Mantidas) ---
    async def _check_win_conditions(self, board, current_player_color, opponent_color, game_id):
        opponent_pieces = sum(1 for row in board for piece in row if piece and piece['color'] == opponent_color)
        if opponent_pieces == 0:
            await self.broadcast_game_over(game_id, current_player_color, "annihilation")
            return True

        can_opponent_move = self._has_any_valid_move(board, opponent_color)
        
        if not can_opponent_move:
            can_current_move = self._has_any_valid_move(board, current_player_color)
            if can_current_move:
                await self.broadcast_game_over(game_id, current_player_color, "blockade")
                return True
            else:
                await self.broadcast_game_over(game_id, "draw", "stalemate")
                return True

        return False

    def _has_any_valid_move(self, board, color):
        if self._has_any_capture(board, color):
            for r in range(8):
                for c in range(8):
                    piece = board[r][c]
                    if piece and piece['color'] == color:
                        if self._can_capture_from(board, {'r': r, 'c': c}, color):
                            return True
            return False 
        
        for r in range(8):
            for c in range(8):
                piece = board[r][c]
                if piece and piece['color'] == color:
                    if self._can_capture_from(board, {'r': r, 'c': c}, color): return True
                    if self._can_move_simply(board, {'r': r, 'c': c}, color): return True
        return False
        
    def _can_move_simply(self, board, pos, color):
        r, c = pos['r'], pos['c']
        piece = board[r][c]
        if not piece: return False
        forward = -1 if color == 'white' else 1
        directions = []
        if piece.get('king'):
            directions = [(-1, -1), (-1, 1), (1, -1), (1, 1)]
        else:
            directions = [(forward, -1), (forward, 1)]

        for dr, dc in directions:
            tr, tc = r + dr, c + dc
            if 0 <= tr < 8 and 0 <= tc < 8 and board[tr][tc] is None:
                return True
        return False

    # --- REGRAS DE MOVIMENTO E LÓGICA (Mantidas) ---
    def _validate_move_logic(self, game, o, t, color):
        board, chain_piece = game["board"], game["chain_piece"]
        if chain_piece and (o['r'] != chain_piece['r'] or o['c'] != chain_piece['c']): return False, False
        if not (0 <= t['r'] < 8 and 0 <= t['c'] < 8) or board[t['r']][t['c']]: return False, False
        piece = board[o['r']][o['c']]
        if not piece or piece['color'] != color: return False, False
        row_diff, col_diff = t['r'] - o['r'], abs(t['c'] - o['c'])
        is_capture = (abs(row_diff) == 2 and col_diff == 2)
        if chain_piece and not is_capture: return False, False
        if not chain_piece and not is_capture and self._has_any_capture(board, color): return False, False
        forward = -1 if color == 'white' else 1
        if piece['king']:
            if abs(row_diff) == abs(col_diff):
                if is_capture: return self._check_middle_piece(board, o, t, color), True
                return True, False 
            return False, False
        if col_diff == 1 and row_diff == forward: return True, False
        if is_capture: return self._check_middle_piece(board, o, t, color), True
        return False, False

    def _check_middle_piece(self, board, o, t, color):
        mid = board[(o['r']+t['r'])//2][(o['c']+t['c'])//2]
        return mid and mid['color'] != color

    def _apply_move_on_board(self, board, o, t, is_capture):
        p = board[o['r']][o['c']]
        if is_capture: board[(o['r']+t['r'])//2][(o['c']+t['c'])//2] = None
        board[o['r']][o['c']] = None
        board[t['r']][t['c']] = p
        if (p['color']=='white' and t['r']==0) or (p['color']=='black' and t['r']==7): p['king'] = True

    def _can_capture_from(self, board, pos, color):
        r, c = pos['r'], pos['c']
        p = board[r][c]
        if not p: return False
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
                p = board[r][c]
                if p and p['color']==color and self._can_capture_from(board,{'r':r,'c':c},color): return True
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