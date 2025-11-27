// JS/index.js - Lógica Final (Chat Texto + Matchmaking + Ranking)

let chatSocket = null;
let matchmakingSocket = null;
let currentUserData = null;

document.addEventListener('DOMContentLoaded', async function() {
    // 1. Verificar Autenticação (Protege a página)
    // (Funções de auth.js assumidas como existentes e carregadas antes)
    const isAuthenticatedUser = await requireAuth(); 
    
    if (isAuthenticatedUser) {
        // Remove a tela de carregamento
        const loader = document.getElementById('pageLoader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 500);
        }
        
        // 2. Carregar dados do usuário (Header)
        await loadUserDataForHeader();
        
        // 3. Inicializar Sistemas
        initOnlineCounter(); 
        initChatSystem(); 
        initMatchmaking(); 
        loadGlobalRankings(); // <--- Agora chama a função real
    }
});

// ==================================================
// 1. CABEÇALHO E DADOS DO USUÁRIO
// ==================================================

async function loadUserDataForHeader() {
    const cachedUser = getCurrentUser();
    if (cachedUser) {
        currentUserData = cachedUser;
        updateHeaderUI(cachedUser);
    }

    try {
        const response = await fetch('/api/me', { method: 'GET', credentials: 'include' });
        if (response.ok) {
            const userData = await response.json();
            currentUserData = userData;
            updateHeaderUI(userData);
            localStorage.setItem('user', JSON.stringify(userData));
        }
    } catch (error) {
        console.error('Erro ao atualizar dados do usuário:', error);
    }
}

function updateHeaderUI(user) {
    const nameEl = document.getElementById('navUserName');
    const avatarEl = document.getElementById('navAvatar');
    
    if (nameEl && user.name) {
        nameEl.textContent = user.name.split(' ')[0];
    }
    
    if (avatarEl && user.avatar) {
        avatarEl.src = user.avatar;
    }
}

// ==================================================
// 2. SISTEMA DE MATCHMAKING (BUSCAR PARTIDA)
// ==================================================

function initMatchmaking() {
    const matchCard = document.getElementById('btnFindMatch');
    if (matchCard) {
        matchCard.onclick = null; 
        matchCard.addEventListener('click', toggleMatchmaking);
    }
}

function toggleMatchmaking() {
    const btnText = document.getElementById('btnTextMatch');
    
    if (matchmakingSocket) {
        matchmakingSocket.close();
        matchmakingSocket = null;
        if(btnText) {
            btnText.innerHTML = 'Buscar Partida';
            btnText.classList.remove('btn-primary');
            btnText.classList.add('btn-outline-primary');
        }
        return;
    }

    if(btnText) {
        btnText.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Buscando...';
        btnText.classList.remove('btn-outline-primary');
        btnText.classList.add('btn-primary');
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws/matchmaking`;

    matchmakingSocket = new WebSocket(wsUrl);

    matchmakingSocket.onopen = () => {
        console.log("🔎 Entrou na fila de matchmaking...");
    };

    matchmakingSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'match_found') {
            console.log("⚔️ Partida encontrada!", data);
            sessionStorage.setItem('current_game_id', data.game_id);
            sessionStorage.setItem('my_color', data.color);
            
            if(btnText) {
                btnText.classList.replace('btn-primary', 'btn-success');
                btnText.innerHTML = '<i class="bi bi-check-circle"></i> Partida Encontrada!';
            }

            setTimeout(() => {
                window.location.href = `game.html?id=${data.game_id}`;
            }, 500);
        }
    };

    matchmakingSocket.onclose = () => {
        console.log("Fila cancelada.");
        matchmakingSocket = null;
        if(btnText && btnText.innerHTML.includes('Buscando')) {
            btnText.innerHTML = 'Buscar Partida';
            btnText.classList.remove('btn-primary');
            btnText.classList.add('btn-outline-primary');
        }
    };
}

// ==================================================
// 3. SISTEMA DE CHAT 
// ==================================================

function initChatSystem() {
    const form = document.getElementById('chatForm');
    const input = document.getElementById('messageInput');

    if (!form) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws/chat`;

    connectChatWebSocket(wsUrl);

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const text = input.value.trim();
        
        if (!text) return;
        
        if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
            const messageData = {
                username: currentUserData ? currentUserData.name.split(' ')[0] : 'Anônimo',
                text: text
            };
            chatSocket.send(JSON.stringify(messageData));
            input.value = '';
        } else {
            connectChatWebSocket(wsUrl);
        }
    });
}

function connectChatWebSocket(url) {
    if (chatSocket && (chatSocket.readyState === WebSocket.OPEN || chatSocket.readyState === WebSocket.CONNECTING)) {
        return;
    }

    chatSocket = new WebSocket(url);

    chatSocket.onopen = () => {
        const statusBadge = document.querySelector('.chat-header .badge');
        if(statusBadge) statusBadge.classList.replace('bg-danger', 'bg-success');
    };

    chatSocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'count') {
                updateOnlineCounter(data.count);
            } 
            else if (data.type === 'chat') {
                const myName = currentUserData ? currentUserData.name.split(' ')[0] : 'Eu';
                const isMe = (data.username === myName);
                appendMessage(data.text, isMe ? 'me' : 'user', data.username);
            }
            
        } catch (e) {
            console.log("Dado não-JSON:", event.data);
        }
    };

    chatSocket.onclose = () => {
        const statusBadge = document.querySelector('.chat-header .badge');
        if(statusBadge) statusBadge.classList.replace('bg-success', 'bg-danger');
        updateOnlineCounter("...");
        setTimeout(() => connectChatWebSocket(url), 3000);
    };
}

function updateOnlineCounter(count) {
    const counterEl = document.getElementById('onlineCount');
    if (counterEl) counterEl.textContent = count;
}

function initOnlineCounter() {
    const counter = document.getElementById('onlineCount');
    if (counter) counter.textContent = "...";
}

function appendMessage(text, type, senderName) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;
    
    if (type === 'me') {
        msgDiv.innerHTML = `${text}`;
    } else {
        msgDiv.innerHTML = `<strong>${senderName}:</strong> ${text}`;
    }
    
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

// ==================================================
// 4. RANKING GLOBAL (REAL)
// ==================================================

async function loadGlobalRankings() {
    const rankingList = document.getElementById('rankingList');
    if (!rankingList) return;

    try {
        // Mostra loading enquanto busca
        rankingList.innerHTML = '<div class="text-center p-3"><div class="spinner-border spinner-border-sm text-muted"></div></div>';

        // Faz a requisição para a API real
        const response = await fetch('/api/ranking', { 
            method: 'GET', 
            credentials: 'include' 
        });

        if (!response.ok) throw new Error('Falha ao carregar ranking');

        const users = await response.json();

        // Limpa a lista
        rankingList.innerHTML = '';

        if (users.length === 0) {
            rankingList.innerHTML = '<div class="text-center text-muted p-3 small">Nenhum jogador ranqueado ainda.</div>';
            return;
        }

        users.forEach((user, index) => {
            const position = index + 1;
            let posDisplay = `#${position}`;
            let posClass = '';

            // Ícones para TOP 3
            if (position === 1) { posDisplay = '<i class="bi bi-trophy-fill"></i>'; posClass = 'rank-1'; }
            else if (position === 2) { posDisplay = '<i class="bi bi-trophy-fill"></i>'; posClass = 'rank-2'; }
            else if (position === 3) { posDisplay = '<i class="bi bi-trophy-fill"></i>'; posClass = 'rank-3'; }

            // Fallback de avatar se vier nulo ou quebrado
            const avatarUrl = user.avatar || 'https://pw.jan.bortolanza.vms.ufsc.br/images/avatars/default/default_avatar.png';
            // Formata nome (Pega primeiro nome se for muito longo)
            const displayName = user.name.length > 15 ? user.name.split(' ')[0] : user.name;

            const item = document.createElement('div');
            item.className = 'ranking-item';
            
            // Estrutura do item da lista
            item.innerHTML = `
                <div class="rank-pos ${posClass}">${posDisplay}</div>
                <div class="rank-user">
                    <img src="${avatarUrl}" class="rank-avatar" alt="${displayName}" onerror="this.src='https://pw.jan.bortolanza.vms.ufsc.br/images/avatars/default/default_avatar.png'">
                    <span class="fw-bold text-primary-custom small text-truncate" style="max-width: 120px;" title="${user.name}">${displayName}</span>
                </div>
                <div class="rank-points" title="${user.totalGames} Jogos">${user.wins} wins</div>
            `;
            
            rankingList.appendChild(item);
        });

    } catch (error) {
        console.error("Erro ranking:", error);
        rankingList.innerHTML = '<div class="text-center text-danger p-3 small">Erro ao carregar ranking.</div>';
    }
}