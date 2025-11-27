// ==================================================
// VARIÁVEIS GLOBAIS
// ==================================================
let gameSocket = null;
let globalChatSocket = null;
let gameId = null;
let myColor = null;
let myName = "Jogador"; 
let myUserId = null; 
let myEmail = ""; 

// Dados Completos dos Jogadores (Sync com Backend)
let playersData = {
    white: { name: "Aguardando...", email: "", id: "" },
    black: { name: "Aguardando...", email: "", id: "" }
};

// Estado do Jogo
let currentBoard = null;
let selectedPiece = null;
let possibleMoves = [];
let isMyTurn = false;
let chainPiece = null;
let isGameOver = false;

// WebRTC
let localStream = null;
let peerConnection = null;
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

let startModalInstance = null;

// SONS DO JOGO
const sounds = {
    move: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3'),
    capture: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/capture.mp3'),
    promote: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/promote.mp3'),
    start: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-start.mp3'),
    end: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_WEBM_/default/game-end.webm')
};

function playSound(type) {
    try {
        const audio = sounds[type];
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(e => console.warn("Som bloqueado pelo navegador:", e));
        }
    } catch (e) { console.warn("Erro ao tentar tocar som:", e); }
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Setup Sessão
    gameId = sessionStorage.getItem('current_game_id');
    myColor = sessionStorage.getItem('my_color');
    
    try {
        const userJson = localStorage.getItem('user'); 
        if(userJson) {
            const userData = JSON.parse(userJson);
            myName = userData.name ? userData.name.split(' ')[0] : 'Visitante';
            myUserId = userData._id;
            myEmail = userData.email || "anonimo@game.com";
        }
    } catch(e) { console.error(e); }

    const urlParams = new URLSearchParams(window.location.search);
    if (!gameId && urlParams.get('id')) gameId = urlParams.get('id');
    
    if (!gameId || !myColor) {
        alert("Sessão inválida."); window.location.href = "index.html"; return;
    }

    // UI Updates Iniciais
    updatePlayerInfoUI();

    // Listeners
    document.getElementById('btnSurrender').addEventListener('click', handleSurrender);
    document.getElementById('matchChatForm').addEventListener('submit', sendMatchMessage);
    document.getElementById('globalChatForm').addEventListener('submit', sendGlobalMessage);
    document.getElementById('btnToggleVideo').onclick = toggleVideo;
    document.getElementById('btnToggleAudio').onclick = toggleAudio;
    
    // 2. Mídia
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('localVideo').srcObject = localStream;
    } catch (e) {
        addSystemMessage('matchMessages', "Sem acesso à câmera/mic.");
    }

    // 3. Sockets
    initGameConnection();
    initGlobalChat();

    // 4. Modal Início
    const startModalEl = document.getElementById('startGameModal');
    if(startModalEl) {
        startModalInstance = new bootstrap.Modal(startModalEl, { backdrop: 'static', keyboard: false });
        startModalInstance.show();

        document.getElementById('btnStartGame').addEventListener('click', async () => {
            const btn = document.getElementById('btnStartGame');
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Iniciando...';
            btn.disabled = true;
            await startRecording();
            
            // Toca som de início ao clicar no botão (garante permissão de áudio)
            playSound('start');
            
            startModalInstance.hide();
        });
    } else {
        startRecording();
    }
});

// ==================================================
// UI HELPER (TOP BAR)
// ==================================================
function updatePlayerInfoUI() {
    document.getElementById('myNavName').textContent = myName;
    const myColorEl = document.getElementById('myNavColor');
    if(myColorEl) myColorEl.className = `avatar-indicator shadow-sm ${myColor === 'white' ? 'bg-white border' : 'bg-dark'}`;
    updateOpponentUI();
}

function updateOpponentUI() {
    const opColor = myColor === 'white' ? 'black' : 'white';
    const opData = playersData[opColor];
    const opName = (opData && opData.name) ? opData.name : "Aguardando...";
    
    const opNameEl = document.getElementById('opponentNameDisplay');
    const opColorEl = document.getElementById('opNavColor');

    if(opNameEl) opNameEl.textContent = opName;
    if(opColorEl) opColorEl.className = `avatar-indicator shadow-sm ${opColor === 'white' ? 'bg-white border' : 'bg-dark'}`;
}

// ==================================================
// GRAVAÇÃO E UPLOAD
// ==================================================
async function startRecording() {
    try {
        if (typeof window.startScreenRecording === 'function') {
            const success = await window.startScreenRecording();
            if (success) {
                const recIndicator = document.getElementById('recordingIndicator');
                if(recIndicator) recIndicator.classList.replace('d-none', 'd-flex');
                addSystemMessage('matchMessages', "Gravação iniciada. Bom jogo!");
            }
        }
    } catch (e) { console.error(e); }
}

async function stopAndUploadRecording(winnerColor) {
    if (typeof window.isRecording === 'function' && window.isRecording()) {
        const statusEl = document.getElementById('uploadStatus');
        if(statusEl) statusEl.classList.remove('d-none');

        const finalPlayersList = [];
        const getResult = (color) => {
            if (winnerColor === "draw") return "draw";
            return winnerColor === color ? "win" : "loss";
        };

        const whiteData = playersData.white || {};
        finalPlayersList.push({
            name: whiteData.name !== "Aguardando..." ? whiteData.name : (myColor==='white' ? myName : "Oponente"),
            email: whiteData.email || "cpu@game.com",
            role: "white",
            user_id: whiteData.id || "unknown",
            result: getResult("white")
        });

        const blackData = playersData.black || {};
        finalPlayersList.push({
            name: blackData.name !== "Aguardando..." ? blackData.name : (myColor==='black' ? myName : "Oponente"),
            email: blackData.email || "cpu@game.com",
            role: "black",
            user_id: blackData.id || "unknown",
            result: getResult("black")
        });

        const metadata = {
            title: `Partida ${gameId.substring(0,6)}`,
            gameId: gameId,
            players: finalPlayersList
        };

        try {
            await window.stopScreenRecording(metadata);
            if(statusEl) {
                statusEl.classList.replace('text-info', 'text-success');
                statusEl.innerHTML = 'Replay Salvo!';
            }
        } catch (e) {
            if(statusEl) {
                statusEl.classList.replace('text-info', 'text-danger');
                statusEl.innerHTML = 'Erro ao salvar.';
            }
        }
    }
}

// ==================================================
// SOCKETS E JOGO
// ==================================================
function initGameConnection() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const userIdParam = myUserId ? `?userId=${myUserId}` : '?userId=anon';
    const wsUrl = `${protocol}//${window.location.host}/api/ws/game/${gameId}/${myColor}${userIdParam}`;

    gameSocket = new WebSocket(wsUrl);

    gameSocket.onopen = () => { 
        const statusBadge = document.getElementById('statusText');
        if(statusBadge) {
            statusBadge.textContent = "Online";
            statusBadge.className = "badge bg-success shadow-sm ms-2";
        }
        setTimeout(() => { 
            if(!currentBoard) gameSocket.send(JSON.stringify({type:"request_state"})); 
            // Se sou brancas, inicio WebRTC
            if(myColor === 'white') startWebRTC();
        }, 1000);
    };

    gameSocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'update') handleGameUpdate(data);
            else if (data.type === 'game_over') handleGameOver(data);
            else if (data.type === 'chat') handleIncomingMatchMessage(data);
            else if (data.type === 'signal') handleWebRTCSignal(data);
        } catch(e) {}
    };
    
    gameSocket.onclose = () => {
        if(!isGameOver) {
            const statusBadge = document.getElementById('statusText');
            if(statusBadge) {
                statusBadge.textContent = "Offline";
                statusBadge.className = "badge bg-danger shadow-sm ms-2";
            }
        }
    };
}

// ... (WebRTC e Chat mantidos iguais) ...
async function startWebRTC() {
    createPeerConnection();
    try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        sendSignal({ type: 'signal', description: peerConnection.localDescription });
    } catch(e) {}
}
function createPeerConnection() {
    if (peerConnection) return;
    peerConnection = new RTCPeerConnection(rtcConfig);
    if (localStream) localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    peerConnection.ontrack = (event) => {
        const remoteVideo = document.getElementById('remoteVideo');
        if(remoteVideo) remoteVideo.srcObject = event.streams[0];
    };
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) sendSignal({ type: 'signal', candidate: event.candidate });
    };
}
async function handleWebRTCSignal(data) {
    if (!peerConnection) createPeerConnection();
    try {
        if (data.description) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.description));
            if (data.description.type === 'offer') {
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                sendSignal({ type: 'signal', description: peerConnection.localDescription });
            }
        } else if (data.candidate) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    } catch(e) {}
}
function sendSignal(data) { if(gameSocket) gameSocket.send(JSON.stringify(data)); }
function toggleVideo() { if(localStream) localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled; }
function toggleAudio() { if(localStream) localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled; }

function sendMatchMessage(e) {
    e.preventDefault();
    const input = document.getElementById('matchInput');
    const text = input.value.trim();
    if (!text) return;
    gameSocket.send(JSON.stringify({ type: 'chat', text: text, sender: myName }));
    addChatMessage('matchMessages', text, 'mine');
    input.value = '';
}
function handleIncomingMatchMessage(data) {
    if(data.sender === myName) return; 
    addChatMessage('matchMessages', data.text, 'opponent', data.sender);
}
function initGlobalChat() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws/chat`;
    globalChatSocket = new WebSocket(wsUrl);
    globalChatSocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if(data.type === 'count') return;
            if(data.type === 'chat' || data.text) { 
                const text = data.text;
                const senderName = data.username || "Anônimo";
                const isMine = (senderName === myName);
                addChatMessage('globalMessages', text, isMine ? 'mine' : 'opponent', senderName);
            }
        } catch(e) {}
    };
}
function sendGlobalMessage(e) {
    e.preventDefault();
    const input = document.getElementById('globalInput');
    const text = input.value.trim();
    if (!text) return;
    if(globalChatSocket) {
        globalChatSocket.send(JSON.stringify({ username: myName, text: text }));
        input.value = '';
    }
}
function addChatMessage(containerId, text, type, senderName = null) {
    const container = document.getElementById(containerId);
    const div = document.createElement('div');
    div.className = `chat-msg ${type}`;
    if (type === 'mine') div.textContent = text;
    else {
        const nameDisplay = senderName ? senderName : 'Oponente';
        div.innerHTML = `<strong>${nameDisplay}:</strong> ${text}`;
    }
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}
function addSystemMessage(containerId, text) {
    const container = document.getElementById(containerId);
    const div = document.createElement('div');
    div.className = `chat-msg system`;
    div.innerHTML = `<small>${text}</small>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// ==================================================
// LÓGICA DO JOGO (CORE ATUALIZADO)
// ==================================================

function handleGameUpdate(data) {
    currentBoard = data.board;
    chainPiece = data.chain_piece;
    currentBoard.last_move_from = data.last_move_from;
    currentBoard.last_move_to = data.last_move_to;
    
    if (data.players) {
        playersData = { ...playersData, ...data.players };
        updateOpponentUI();
    }

    // --- CORREÇÃO DO SOM ---
    // Confia no backend: se ele mandou 'capture', toca 'capture'.
    if (data.sound) {
        playSound(data.sound);
    }

    if (!isGameOver) {
        if (chainPiece && data.turn === myColor) {
            selectedPiece = chainPiece;
            possibleMoves = getValidMoves(currentBoard, selectedPiece, myColor);
        } else {
            if(data.turn !== myColor) {
                selectedPiece = null;
                possibleMoves = [];
            }
        }
    }
    renderBoard(data.board, data.last_move_from, data.last_move_to);
    updateTurnInfo(data.turn);
}

function renderBoard(board, lastFrom, lastTo) {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = ''; 
    const isFlipped = (myColor === 'black');
    
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const r = isFlipped ? 7 - i : i;
            const c = isFlipped ? 7 - j : j;
            const cell = document.createElement('div');
            const isBlackCell = (r + c) % 2 !== 0;
            cell.className = `cell ${isBlackCell ? 'black' : 'white'}`;
            
            if (lastFrom && lastTo) {
                if ((lastFrom.r === r && lastFrom.c === c) || (lastTo.r === r && lastTo.c === c)) {
                    cell.classList.add('last-move');
                }
            }
            
            const isHighlight = possibleMoves.some(m => m.r === r && m.c === c);
            if (isHighlight) cell.classList.add('highlight');
            
            cell.onclick = () => handleCellClick(r, c);
            const pieceData = board[r][c];
            if (pieceData) {
                const piece = document.createElement('div');
                piece.className = `piece ${pieceData.color}`;
                if (pieceData.king) piece.classList.add('king');
                if (selectedPiece && selectedPiece.r === r && selectedPiece.c === c) piece.classList.add('selected');
                cell.appendChild(piece);
            }
            boardEl.appendChild(cell);
        }
    }
}

function handleCellClick(r, c) {
    if (!isMyTurn || isGameOver) return;
    const clickedPiece = currentBoard[r][c];
    if (chainPiece) {
        const move = possibleMoves.find(m => m.r === r && m.c === c);
        if (!clickedPiece && move) sendMove(chainPiece, { r, c });
        return; 
    }
    if (clickedPiece && clickedPiece.color === myColor) {
        selectedPiece = { r, c };
        possibleMoves = getValidMoves(currentBoard, selectedPiece, myColor);
        renderBoard(currentBoard, currentBoard.last_move_from, currentBoard.last_move_to); 
        return;
    }
    if (!clickedPiece && selectedPiece) {
        const move = possibleMoves.find(m => m.r === r && m.c === c);
        if (move) {
            sendMove(selectedPiece, { r, c });
            selectedPiece = null; 
            possibleMoves = [];
            renderBoard(currentBoard); 
        }
    }
}

// --- CORREÇÃO DO MOVIMENTO DA DAMA (VISUAL) ---
function getValidMoves(board, piecePos, color) {
    const moves = [];
    const r = piecePos.r;
    const c = piecePos.c;
    const piece = board[r][c];
    if (!piece) return [];
    const forward = color === 'white' ? -1 : 1;
    let captureFound = false;
    const allDiagonals = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    
    // 1. CAPTURAS (Prioridade)
    allDiagonals.forEach(([dr, dc]) => {
        if (!piece.king) {
            // Peça Comum: Pulo de 2
            let tr = r + (dr * 2);
            let tc = c + (dc * 2);
            let mr = r + dr;
            let mc = c + dc;
            if (isValidPos(tr, tc) && board[tr][tc] === null && isValidPos(mr, mc)) {
                const mid = board[mr][mc];
                if (mid && mid.color !== color) {
                    moves.push({ r: tr, c: tc, isCapture: true });
                    captureFound = true;
                }
            }
        } else {
            // DAMA VOADORA: Captura à distância
            let ir = r + dr;
            let ic = c + dc;
            while (isValidPos(ir, ic)) {
                const target = board[ir][ic];
                if (target === null) { ir += dr; ic += dc; continue; } // Avança no vazio
                
                // Achou peça. Se inimiga...
                if (target.color !== color) {
                    let jumpR = ir + dr;
                    let jumpC = ic + dc;
                    // Verifica casas vazias APÓS a peça
                    while (isValidPos(jumpR, jumpC)) {
                        if (board[jumpR][jumpC] === null) {
                            moves.push({ r: jumpR, c: jumpC, isCapture: true });
                            captureFound = true;
                        } else {
                            break; // Bloqueado depois da captura
                        }
                        jumpR += dr; jumpC += dc;
                    }
                }
                break; // Para ao encontrar qualquer peça
            }
        }
    });

    if (captureFound) return moves;

    // 2. MOVIMENTOS SIMPLES (Sem captura)
    if (!chainPiece) {
        if (piece.king) {
            // DAMA VOADORA: Movimento livre nas diagonais
            allDiagonals.forEach(([dr, dc]) => {
                let tr = r + dr;
                let tc = c + dc;
                while (isValidPos(tr, tc)) {
                    if (board[tr][tc] === null) {
                        moves.push({ r: tr, c: tc, isCapture: false });
                    } else { break; } // Bloqueado
                    tr += dr; tc += dc;
                }
            });
        } else {
            // PEÇA COMUM
            allDiagonals.forEach(([dr, dc]) => {
                if (dr !== forward) return; 
                let tr = r + dr;
                let tc = c + dc;
                if (isValidPos(tr, tc) && board[tr][tc] === null) {
                    moves.push({ r: tr, c: tc, isCapture: false });
                }
            });
        }
    }
    return moves;
}

function isValidPos(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function sendMove(from, to) { if (gameSocket) gameSocket.send(JSON.stringify({ type: 'move', from, to })); }

function updateTurnInfo(turnColor) {
    isMyTurn = (turnColor === myColor);
    const statusText = document.getElementById('gameTurnText');
    if (isMyTurn) {
        statusText.textContent = chainPiece ? "CAPTURA OBRIGATÓRIA!" : "SUA VEZ";
        statusText.className = "fw-bold text-primary-custom text-uppercase small";
    } else {
        statusText.textContent = "Aguardando oponente...";
        statusText.className = "fw-bold text-muted text-uppercase small";
    }
}

function handleSurrender() {
    if (!isGameOver && confirm("Deseja realmente desistir?")) {
        gameSocket.send(JSON.stringify({ type: "surrender" }));
    }
}

function handleGameOver(data) {
    isGameOver = true;
    playSound('end');
    stopAndUploadRecording(data.winner);
    const modal = new bootstrap.Modal(document.getElementById('gameOverModal'));
    document.getElementById('gameOverTitle').textContent = data.winner === myColor ? "VITÓRIA!" : (data.winner === "draw" ? "EMPATE" : "DERROTA");
    document.getElementById('gameOverMessage').textContent = `Motivo: ${data.reason}`;
    modal.show();
}