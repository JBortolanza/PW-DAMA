// Variáveis globais
let userData = {};
let currentSelectedAvatarId = null;

// ==========================================
// 1. GERENCIAMENTO DE AVATAR
// ==========================================

function loadAvatarOptions() {
    const avatarOptionsContainer = document.getElementById('avatarOptions');
    if (!avatarOptionsContainer) return;
    
    const defaultAvatars = [
        'https://pw.jan.bortolanza.vms.ufsc.br/images/avatars/default/default_avatar.png',
        'https://pw.jan.bortolanza.vms.ufsc.br/images/avatars/default/avatar1.png',
        'https://pw.jan.bortolanza.vms.ufsc.br/images/avatars/default/avatar2.png',
        'https://pw.jan.bortolanza.vms.ufsc.br/images/avatars/default/avatar3.png',
        'https://pw.jan.bortolanza.vms.ufsc.br/images/avatars/default/avatar4.png',
        'https://pw.jan.bortolanza.vms.ufsc.br/images/avatars/default/avatar0.png',
    ];
    
    avatarOptionsContainer.innerHTML = '';
    
    defaultAvatars.forEach((avatarUrl, index) => {
        const avatarElement = createAvatarElement(avatarUrl, index);
        avatarOptionsContainer.appendChild(avatarElement);
    });
    
    addCustomAvatarOption(avatarOptionsContainer);
}

function createAvatarElement(avatarUrl, index) {
    const avatarElement = document.createElement('img');
    avatarElement.src = avatarUrl;
    avatarElement.alt = `Avatar ${index + 1}`;
    avatarElement.className = 'avatar-option rounded-circle';
    avatarElement.setAttribute('data-avatar-url', avatarUrl);
    avatarElement.setAttribute('data-avatar-id', `avatar-${index}`);
    avatarElement.setAttribute('data-avatar-type', 'default');
    
    if (userData.avatar === avatarUrl) {
        avatarElement.classList.add('selected');
        currentSelectedAvatarId = `avatar-${index}`;
    }
    
    avatarElement.addEventListener('click', function() {
        selectAvatar(this);
    });
    
    return avatarElement;
}

function addCustomAvatarOption(container) {
    const customOption = document.createElement('div');
    customOption.className = 'avatar-option-custom text-center';
    
    customOption.innerHTML = `
        <div class="custom-avatar-placeholder rounded-circle bg-light d-flex align-items-center justify-content-center h-100 border-dashed">
            <div class="text-center">
                <small class="text-muted">Upload</small><br>
                <small class="text-muted">Foto</small>
            </div>
        </div>
    `;
    
    let fileInput = document.getElementById('avatarUpload');
    if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'avatarUpload';
        fileInput.accept = 'image/jpeg,image/png,image/webp';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
        
        fileInput.addEventListener('change', handleAvatarUpload);
    }
    
    customOption.addEventListener('click', function() {
        fileInput.click();
    });
    
    container.appendChild(customOption);
}

async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        showAlert('Apenas imagens JPG, PNG ou WEBP são permitidas', 'warning');
        return;
    }
    if (file.size > 5 * 1024 * 1024) { 
        showAlert('A imagem deve ter no máximo 5MB', 'warning');
        return;
    }

    try {
        showUploadLoading(true);

        const reader = new FileReader();
        reader.onload = function(e) {
            const currentAvatar = document.getElementById('currentAvatar');
            if(currentAvatar) currentAvatar.src = e.target.result;
        };
        reader.readAsDataURL(file);

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload-avatar', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao fazer upload');
        }

        const result = await response.json();

        if(document.getElementById('currentAvatar')) document.getElementById('currentAvatar').src = result.avatar_url;
        if(document.getElementById('userAvatar')) document.getElementById('userAvatar').src = result.avatar_url;

        await loadUserData();

        const modalEl = document.getElementById('avatarModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        showAlert('Avatar atualizado com sucesso!', 'success');

    } catch (error) {
        showAlert('Erro ao fazer upload: ' + error.message, 'danger');
    } finally {
        showUploadLoading(false);
        event.target.value = ''; 
    }
}

function showUploadLoading(show) {
    const uploadButton = document.querySelector('.avatar-option-custom');
    const modalFooter = document.querySelector('#avatarModal .modal-footer');
    
    if (show) {
        if (uploadButton) {
            uploadButton.innerHTML = `
                <div class="custom-avatar-placeholder rounded-circle bg-light d-flex align-items-center justify-content-center h-100 border-dashed">
                    <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
                </div>`;
            uploadButton.style.pointerEvents = 'none';
        }
        if (modalFooter) modalFooter.querySelectorAll('button').forEach(btn => btn.disabled = true);
    } else {
        if (uploadButton) {
            uploadButton.innerHTML = `
                <div class="custom-avatar-placeholder rounded-circle bg-light d-flex align-items-center justify-content-center h-100 border-dashed">
                    <div class="text-center"><small class="text-muted">Upload</small><br><small class="text-muted">Foto</small></div>
                </div>`;
            uploadButton.style.pointerEvents = 'auto';
            uploadButton.onclick = () => document.getElementById('avatarUpload').click();
        }
        if (modalFooter) modalFooter.querySelectorAll('button').forEach(btn => btn.disabled = false);
    }
}

function selectAvatar(element) {
    document.querySelectorAll('.avatar-option').forEach(img => img.classList.remove('selected'));
    document.querySelectorAll('.avatar-option-custom').forEach(div => div.classList.remove('selected'));
    element.classList.add('selected');
    
    if (element.getAttribute('data-avatar-type') === 'default') {
        const selectedAvatarUrl = element.getAttribute('data-avatar-url');
        document.getElementById('currentAvatar').src = selectedAvatarUrl;
        currentSelectedAvatarId = element.getAttribute('data-avatar-id');
    }
}

async function saveAvatar() {
    try {
        const currentAvatarImg = document.getElementById('currentAvatar');
        const newAvatarUrl = currentAvatarImg ? currentAvatarImg.src : null;

        if (!newAvatarUrl) {
            showAlert('Selecione um avatar antes de salvar', 'warning');
            return;
        }

        if (currentSelectedAvatarId && currentSelectedAvatarId.startsWith('avatar-')) {
            const response = await fetch(`/api/update-avatar?avatar_url=${encodeURIComponent(newAvatarUrl)}`, {
                method: 'PUT',
                credentials: 'include'
            });

            if (response.ok) {
                await loadUserData();
                const modal = bootstrap.Modal.getInstance(document.getElementById('avatarModal'));
                if(modal) modal.hide();
                showAlert('Avatar atualizado com sucesso!', 'success');
            } else {
                throw new Error('Falha ao atualizar avatar');
            }
        } else {
            const modal = bootstrap.Modal.getInstance(document.getElementById('avatarModal'));
            if(modal) modal.hide();
        }
    } catch (error) {
        showAlert('Erro: ' + error.message, 'danger');
    }
}

// ==========================================
// 2. DADOS DO USUÁRIO
// ==========================================

async function loadUserData() {
    try {
        showLoading(true);
        const response = await fetch('/api/me', { method: 'GET', credentials: 'include' });
        
        if (response.ok) {
            userData = await response.json();
            updateUserInterface();
        } else if (response.status === 401) {
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error(error);
    } finally {
        showLoading(false);
    }
}

function updateUserInterface() {
    document.getElementById('userName').textContent = userData.name || 'Usuário';
    document.getElementById('userEmail').textContent = userData.email || '';
    document.getElementById('userLocation').textContent = userData.location || 'Não informado';
    document.getElementById('userBio').textContent = userData.bio || 'Sem biografia.';
    
    const avatarUrl = userData.avatar || 'https://pw.jan.bortolanza.vms.ufsc.br/images/avatars/default/default_avatar.png';
    if(document.getElementById('userAvatar')) document.getElementById('userAvatar').src = avatarUrl;
    
    document.getElementById('totalGames').textContent = userData.totalGames || 0;
    document.getElementById('wins').textContent = userData.wins || 0;
    document.getElementById('losses').textContent = userData.losses || 0;
    document.getElementById('draws').textContent = userData.draws || 0;
    
    const total = userData.totalGames || 0;
    const wins = userData.wins || 0;
    document.getElementById('winRate').textContent = total > 0 ? ((wins / total) * 100).toFixed(1) + '%' : '0%';
    
    document.getElementById('editName').value = userData.name || '';
    document.getElementById('editEmail').value = userData.email || '';
    document.getElementById('editLocation').value = userData.location || '';
    document.getElementById('editBio').value = userData.bio || '';
}

function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    const content = document.getElementById('profileContent');
    if (spinner && content) {
        spinner.style.display = show ? 'block' : 'none';
        content.style.display = show ? 'none' : 'block';
    }
}

async function saveProfileChanges() {
    const data = {
        name: document.getElementById('editName').value,
        email: document.getElementById('editEmail').value,
        location: document.getElementById('editLocation').value,
        bio: document.getElementById('editBio').value
    };

    if (!data.name.trim() || !data.email.trim()) {
        showAlert('Nome e Email são obrigatórios', 'warning');
        return;
    }

    try {
        const response = await fetch('/api/update-profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });

        if (response.ok) {
            await loadUserData();
            bootstrap.Modal.getInstance(document.getElementById('editProfileModal'))?.hide();
            showAlert('Perfil salvo!', 'success');
        } else {
            throw new Error('Erro ao salvar perfil');
        }
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

// ==========================================
// 3. HISTÓRICO E VÍDEOS (CORRIGIDO)
// ==========================================

async function forceDownload(url, title) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Falha na rede');
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `Partida_${title.replace(/\s+/g, '_')}.webm`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
        console.warn("Fallback download", error);
        window.open(url, '_blank');
    }
}

async function loadGameHistory() {
    const gamesList = document.getElementById('gamesList');
    if (!gamesList) return;
    
    try {
        gamesList.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-secondary" role="status"></div>
                <p class="mt-2 text-muted">Carregando galeria...</p>
            </div>`;

        const response = await fetch('/api/upload/my-recordings', { // URL relativa
            method: 'GET', credentials: 'include'
        });

        if (!response.ok) throw new Error(`Erro: ${response.status}`);
        const recordings = await response.json();

        if (!recordings || recordings.length === 0) {
            gamesList.innerHTML = `
                <div class="text-center py-5 h-100 d-flex flex-column justify-content-center align-items-center text-muted">
                    <i class="bi bi-film fs-1 mb-3 opacity-50"></i>
                    <h5>Galeria Vazia</h5>
                    <p>Jogue agora para gravar suas partidas.</p>
                </div>`;
            return;
        }

        gamesList.innerHTML = '';

        recordings.reverse().forEach(rec => { // Mais recentes primeiro
            // LÓGICA NOVA DE EXIBIÇÃO
            let opponentName = "CPU/Desconhecido";
            let myResult = "indefinido";
            
            if (rec.players && rec.players.length > 0) {
                // Tenta encontrar EU na lista
                const me = rec.players.find(p => p.email === userData.email);
                // Tenta encontrar o OPONENTE (quem não sou eu)
                const opponent = rec.players.find(p => p.email !== userData.email);
                
                if (opponent) {
                    opponentName = opponent.name;
                }
                
                if (me && me.result) {
                    myResult = me.result;
                }
            }

            // Formata resultado
            let resultBadge = '';
            if (myResult === 'win') {
                resultBadge = '<span class="badge bg-success">Vitória</span>';
            } else if (myResult === 'loss') {
                resultBadge = '<span class="badge bg-danger">Derrota</span>';
            } else if (myResult === 'draw') {
                resultBadge = '<span class="badge bg-secondary">Empate</span>';
            } else {
                resultBadge = '<span class="badge bg-light text-dark border">Indefinido</span>';
            }

            const dateStr = new Date(rec.created_at).toLocaleDateString('pt-BR');
            
            const mins = Math.floor(rec.duration / 60);
            const secs = Math.floor(rec.duration % 60);
            const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
            
            const safeTitle = rec.title || 'Partida';

            const cardDiv = document.createElement('div');
            cardDiv.className = 'game-card-full';
            
            cardDiv.innerHTML = `
                <div class="game-card-header align-items-center">
                    <div>
                        <span class="game-title d-block">${safeTitle}</span>
                        <span class="game-date small text-muted">${dateStr}</span>
                    </div>
                    <div>${resultBadge}</div>
                </div>
                
                <div class="game-video-wrapper">
                    <video controls preload="metadata">
                        <source src="${rec.public_url}" type="video/webm">
                        Seu navegador não suporta vídeo.
                    </video>
                </div>
                
                <div class="game-details-grid">
                    <div class="detail-item">
                        <span class="detail-label">Adversário</span>
                        <span class="detail-value text-truncate d-block" style="max-width: 100px;" title="${opponentName}">${opponentName}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Duração</span>
                        <span class="detail-value">${durationStr}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Ação</span>
                        <button class="btn-download-action border-0 bg-transparent text-primary p-0" type="button" title="Baixar Vídeo">
                            <i class="bi bi-download fs-5"></i>
                        </button>
                    </div>
                </div>
            `;
            
            const btn = cardDiv.querySelector('.btn-download-action');
            btn.onclick = () => forceDownload(rec.public_url, safeTitle);

            gamesList.appendChild(cardDiv);
        });

    } catch (error) {
        console.error(error);
        gamesList.innerHTML = `<div class="alert alert-danger m-3">Erro ao carregar galeria.</div>`;
    }
}

// ==========================================
// 4. UTILITÁRIOS E INIT
// ==========================================

function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show shadow`;
    alertDiv.style.position = 'fixed'; alertDiv.style.top = '20px'; alertDiv.style.right = '20px'; alertDiv.style.zIndex = '2000';
    alertDiv.innerHTML = `${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
    document.body.appendChild(alertDiv);
    setTimeout(() => { if(alertDiv.parentNode) alertDiv.parentNode.removeChild(alertDiv); }, 5000);
}

function goToHome() { window.location.href = 'index.html'; }

async function logout() {
    try { await fetch('/api/logout', { method: 'POST', credentials: 'include' }); } 
    catch(e) {}
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', function() {
    loadUserData().then(() => {
        // Carrega o histórico SÓ DEPOIS de ter os dados do usuário (para comparar emails)
        loadGameHistory();
    });
    
    const avatarModal = document.getElementById('avatarModal');
    if (avatarModal) {
        avatarModal.addEventListener('show.bs.modal', function() {
            loadAvatarOptions();
            if(document.getElementById('currentAvatar') && userData.avatar) {
                document.getElementById('currentAvatar').src = userData.avatar;
            }
        });
    }
    
    const editModal = document.getElementById('editProfileModal');
    if (editModal) {
        editModal.addEventListener('hide.bs.modal', function() {
            if(userData.name) document.getElementById('editName').value = userData.name;
        });
    }
});