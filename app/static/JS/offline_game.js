// ==================================================
// ESTADO GLOBAL
// ==================================================
const BOARD_SIZE = 8;
let board = []; 
let turn = 'white';
let selectedPiece = null;
let possibleMoves = [];
let chainPiece = null;
let isGameOver = false;
let difficulty = 'medium';
let lastMove = { from: null, to: null };

// Sons do Jogo
const sounds = {
    move: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3'),
    capture: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/capture.mp3'),
    promote: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/promote.mp3'),
    click: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3'),
    start: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-start.mp3'),
    end: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_WEBM_/default/game-end.webm')
};

document.addEventListener('DOMContentLoaded', () => {
    initGame();
});

// ==================================================
// SISTEMA DE SOM
// ==================================================
function playSound(type) {
    try {
        const audio = sounds[type];
        if (audio) {
            audio.currentTime = 0; 
            audio.play().catch(e => console.warn("Autoplay bloqueado/interrompido:", e));
        }
    } catch (e) {
        console.warn("Erro ao tocar som:", e);
    }
}

window.playClickSound = () => playSound('click');

// ==================================================
// INICIALIZAÇÃO
// ==================================================
function initGame() {
    isGameOver = false;
    turn = 'white';
    chainPiece = null;
    selectedPiece = null;
    possibleMoves = [];
    lastMove = { from: null, to: null };
    
    createBoard();
    renderBoard();
    updateUI();
    updateCounts();
    
    // Toca som de início (pode ser bloqueado se não houver interação prévia)
    playSound('start');
}

function restartGame() {
    const modalEl = document.getElementById('gameOverModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
    initGame();
}

function createBoard() {
    board = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
        const row = [];
        for (let c = 0; c < BOARD_SIZE; c++) {
            if ((r + c) % 2 === 1) {
                if (r < 3) row.push({ color: 'black', king: false });
                else if (r > 4) row.push({ color: 'white', king: false });
                else row.push(null);
            } else {
                row.push(null);
            }
        }
        board.push(row);
    }
}

function setDifficulty(level) {
    difficulty = level;
    document.querySelectorAll('.btn-difficulty').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.btn-difficulty.${level}`).classList.add('active');
}

// ==================================================
// LÓGICA DE MOVIMENTO
// ==================================================

function isValidPos(r, c) {
    return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

function getValidMoves(piece, r, c, checkOnlyCapture = false) {
    const moves = [];
    const color = piece.color;
    const forward = color === 'white' ? -1 : 1;
    const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

    // 1. CAPTURAS
    directions.forEach(([dr, dc]) => {
        if (!piece.king) {
            let tr = r + (dr * 2);
            let tc = c + (dc * 2);
            let mr = r + dr;
            let mc = c + dc;

            if (isValidPos(tr, tc) && board[tr][tc] === null && isValidPos(mr, mc)) {
                const mid = board[mr][mc];
                if (mid && mid.color !== color) {
                    moves.push({ r: tr, c: tc, isCapture: true, capturedR: mr, capturedC: mc });
                }
            }
        } else {
            let ir = r + dr;
            let ic = c + dc;
            while (isValidPos(ir, ic)) {
                const target = board[ir][ic];
                if (target === null) { ir += dr; ic += dc; continue; }
                
                if (target.color !== color) {
                    let jumpR = ir + dr;
                    let jumpC = ic + dc;
                    while (isValidPos(jumpR, jumpC)) {
                        if (board[jumpR][jumpC] === null) {
                            moves.push({ r: jumpR, c: jumpC, isCapture: true, capturedR: ir, capturedC: ic });
                        } else { break; }
                        jumpR += dr; jumpC += dc;
                    }
                }
                break;
            }
        }
    });

    if (checkOnlyCapture) return moves.filter(m => m.isCapture);
    if (moves.some(m => m.isCapture)) return moves.filter(m => m.isCapture);

    // 2. MOVIMENTOS SIMPLES
    if (!chainPiece) { 
        if (piece.king) {
            directions.forEach(([dr, dc]) => {
                let tr = r + dr;
                let tc = c + dc;
                while (isValidPos(tr, tc)) {
                    if (board[tr][tc] === null) {
                        moves.push({ r: tr, c: tc, isCapture: false });
                    } else { break; }
                    tr += dr; tc += dc;
                }
            });
        } else {
            directions.forEach(([dr, dc]) => {
                if (dr === forward) {
                    let tr = r + dr;
                    let tc = c + dc;
                    if (isValidPos(tr, tc) && board[tr][tc] === null) {
                        moves.push({ r: tr, c: tc, isCapture: false });
                    }
                }
            });
        }
    }
    return moves;
}

function hasAnyCapture(color) {
    if (chainPiece && color === turn) {
        const p = board[chainPiece.r][chainPiece.c];
        const moves = getValidMoves(p, chainPiece.r, chainPiece.c, true);
        return moves.length > 0;
    }
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const p = board[r][c];
            if (p && p.color === color) {
                const moves = getValidMoves(p, r, c, true);
                if (moves.length > 0) return true;
            }
        }
    }
    return false;
}

// ==================================================
// INTERAÇÃO DO JOGADOR
// ==================================================

function handleCellClick(r, c) {
    if (isGameOver || turn !== 'white') return;

    const clickedPiece = board[r][c];

    if (chainPiece) {
        if (clickedPiece && (r !== chainPiece.r || c !== chainPiece.c)) return;
        if (!clickedPiece && selectedPiece) {
            const move = possibleMoves.find(m => m.r === r && m.c === c);
            if (move) executeMove(selectedPiece, move);
        } 
        else if (r === chainPiece.r && c === chainPiece.c) {
            selectedPiece = { r, c };
            possibleMoves = getValidMoves(board[r][c], r, c, true);
            renderBoard();
        }
        return;
    }

    if (clickedPiece && clickedPiece.color === 'white') {
        const globalCapture = hasAnyCapture('white');
        const myMoves = getValidMoves(clickedPiece, r, c);
        
        if (globalCapture) {
            const captureMoves = myMoves.filter(m => m.isCapture);
            if (captureMoves.length === 0) return;
            possibleMoves = captureMoves;
        } else {
            possibleMoves = myMoves;
        }

        selectedPiece = { r, c };
        renderBoard();
        return;
    }

    if (!clickedPiece && selectedPiece) {
        const move = possibleMoves.find(m => m.r === r && m.c === c);
        if (move) {
            executeMove(selectedPiece, move);
        }
    }
}

function executeMove(from, move) {
    const piece = board[from.r][from.c];
    let soundToPlay = 'move'; 

    if (move.isCapture) {
        soundToPlay = 'capture';
    }

    board[move.r][move.c] = piece;
    board[from.r][from.c] = null;

    if (move.isCapture) {
        board[move.capturedR][move.capturedC] = null;
    }

    let promoted = false;
    if (!piece.king && ((piece.color === 'white' && move.r === 0) || (piece.color === 'black' && move.r === 7))) {
        piece.king = true;
        promoted = true;
        soundToPlay = 'promote'; 
    }

    playSound(soundToPlay);

    lastMove = { from: from, to: { r: move.r, c: move.c } };

    if (move.isCapture) {
        const nextCaptures = getValidMoves(piece, move.r, move.c, true);
        if (nextCaptures.length > 0 && !promoted) {
            chainPiece = { r: move.r, c: move.c };
            selectedPiece = chainPiece;
            possibleMoves = nextCaptures;
            updateUI();
            updateCounts();
            renderBoard();
            
            if (turn === 'black') setTimeout(cpuPlay, 500);
            return; 
        }
    }

    chainPiece = null;
    selectedPiece = null;
    possibleMoves = [];
    
    updateCounts();
    checkWinCondition();
    
    if (!isGameOver) {
        turn = turn === 'white' ? 'black' : 'white';
        updateUI();
        renderBoard();

        if (turn === 'black') {
            setTimeout(cpuPlay, 800);
        }
    } else {
        renderBoard();
    }
}

// ==================================================
// BOT (CPU)
// ==================================================

function cpuPlay() {
    if (isGameOver) return;

    let allMoves = [];
    if (chainPiece) {
        const p = board[chainPiece.r][chainPiece.c];
        const moves = getValidMoves(p, chainPiece.r, chainPiece.c, true);
        moves.forEach(m => allMoves.push({ from: { r: chainPiece.r, c: chainPiece.c }, move: m }));
    } else {
        const mustCapture = hasAnyCapture('black');
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const p = board[r][c];
                if (p && p.color === 'black') {
                    let moves = getValidMoves(p, r, c);
                    if (mustCapture) moves = moves.filter(m => m.isCapture);
                    moves.forEach(m => allMoves.push({ from: { r, c }, move: m }));
                }
            }
        }
    }

    if (allMoves.length === 0) {
        if (!chainPiece) gameOver('white');
        return;
    }

    let chosen = null;

    if (difficulty === 'easy') {
        chosen = allMoves[Math.floor(Math.random() * allMoves.length)];
    } 
    else if (difficulty === 'medium') {
        chosen = allMoves[Math.floor(Math.random() * allMoves.length)];
    } 
    else {
        const promotion = allMoves.find(m => m.move.r === 7);
        if (promotion) chosen = promotion;
        else {
            const safeMoves = allMoves.filter(m => isSafe(m.move.r, m.move.c));
            if (safeMoves.length > 0) chosen = safeMoves[Math.floor(Math.random() * safeMoves.length)];
            else chosen = allMoves[0];
        }
    }

    if (chosen) executeMove(chosen.from, chosen.move);
}

function isSafe(r, c) {
    const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (let d of dirs) {
        const nr = r + d[0];
        const nc = c + d[1];
        if (isValidPos(nr, nc)) {
            const neighbor = board[nr][nc];
            if (neighbor && neighbor.color === 'white') {
                const jumpR = r - d[0];
                const jumpC = c - d[1];
                if (isValidPos(jumpR, jumpC) && board[jumpR][jumpC] === null) return false;
            }
        }
    }
    return true;
}

// ==================================================
// UI
// ==================================================

function renderBoard() {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = document.createElement('div');
            const isBlackCell = (r + c) % 2 !== 0;
            cell.className = `cell ${isBlackCell ? 'black' : 'white'}`;

            if (lastMove.from && lastMove.to) {
                if ((lastMove.from.r === r && lastMove.from.c === c) || (lastMove.to.r === r && lastMove.to.c === c)) {
                    cell.classList.add('last-move');
                }
            }

            if (possibleMoves.some(m => m.r === r && m.c === c)) {
                cell.classList.add('highlight');
            }

            cell.onclick = () => handleCellClick(r, c);

            const p = board[r][c];
            if (p) {
                const piece = document.createElement('div');
                piece.className = `piece ${p.color}`;
                if (p.king) piece.classList.add('king');
                if (selectedPiece && selectedPiece.r === r && selectedPiece.c === c) {
                    piece.classList.add('selected');
                }
                cell.appendChild(piece);
            }
            boardEl.appendChild(cell);
        }
    }
}

function updateUI() {
    const badge = document.getElementById('gameTurnText');
    if (turn === 'white') {
        badge.textContent = chainPiece ? "CAPTURE NOVAMENTE!" : "SUA VEZ";
        badge.style.color = '#E65100';
    } else {
        badge.textContent = "CPU PENSANDO...";
        badge.style.color = '#757575';
    }
}

function updateCounts() {
    let white = 0, black = 0;
    board.forEach(row => row.forEach(p => {
        if (p && p.color === 'white') white++;
        if (p && p.color === 'black') black++;
    }));
    const whiteEl = document.getElementById('whiteCount');
    const blackEl = document.getElementById('blackCount');
    if(whiteEl) whiteEl.textContent = white;
    if(blackEl) blackEl.textContent = black;
}

function checkWinCondition() {
    let whiteCount = 0, blackCount = 0;
    board.forEach(row => row.forEach(p => {
        if (p && p.color === 'white') whiteCount++;
        if (p && p.color === 'black') blackCount++;
    }));

    if (blackCount === 0) gameOver('white');
    else if (whiteCount === 0) gameOver('black');
}

function gameOver(winner) {
    isGameOver = true;
    playSound('end'); // Toca som de fim de jogo
    
    const modal = new bootstrap.Modal(document.getElementById('gameOverModal'));
    const title = document.getElementById('gameOverTitle');
    const msg = document.getElementById('gameOverMessage');

    if (winner === 'white') {
        title.textContent = "VITÓRIA!";
        title.className = "fw-bold text-success mb-2";
        msg.textContent = "Parabéns! Você venceu a máquina.";
    } else {
        title.textContent = "DERROTA";
        title.className = "fw-bold text-danger mb-2";
        msg.textContent = "A CPU venceu desta vez.";
    }
    modal.show();
}