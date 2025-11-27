// js/auth.js - Verificação real de autenticação usando /api/me

// ===== CONSTANTES =====
const API_BASE_URL = '/api';

// ===== FUNÇÕES DE VERIFICAÇÃO =====

async function isAuthenticated() {
    try {
        console.log('🔍 Verificando autenticação via /api/me...');
        
        const response = await fetch(`${API_BASE_URL}/me`, {
            method: 'GET',
            credentials: 'include' // Importante: envia o cookie
        });
        
        console.log('Status da verificação:', response.status);
        
        if (response.ok) {
            const userData = await response.json();
            console.log('✅ Autenticado - Usuário:', userData);
            
            // Salva os dados do usuário no localStorage para uso futuro
            localStorage.setItem('user', JSON.stringify(userData));
            
            return true;
        } else {
            console.log('❌ Não autenticado - Status:', response.status);
            localStorage.removeItem('user');
            return false;
        }
        
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        localStorage.removeItem('user');
        return false;
    }
}

function getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

async function requireAuth() {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
        console.log('❌ Não autenticado, redirecionando para login...');
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

// ===== FUNÇÕES DE AUTENTICAÇÃO =====

function handleLoginSuccess(data) {
    console.log('💾 Salvando dados do usuário no login:', data);
    if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
    }
}

async function logout() {
    try {
        await fetch(`${API_BASE_URL}/logout`, {
            method: 'POST',
            credentials: 'include'
        });
    } catch (error) {
        console.error('Erro no logout da API:', error);
    } finally {
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    }
}

// ===== FUNÇÕES DE VALIDAÇÃO =====

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// ===== INICIALIZAÇÃO =====

async function initializeAuth() {
    const currentPage = window.location.pathname;
    const publicPages = [
        '/login.html', 
        '/register.html', 
        '/'
    ];
    
    console.log('🔐 Inicialização de autenticação:');
    console.log(' - Página atual:', currentPage);
    console.log(' - É página pública:', publicPages.includes(currentPage));
    
    // SE NÃO está autenticado E a página NÃO é pública → Redirecionar para login
    const authenticated = await isAuthenticated();
    if (!authenticated && !publicPages.includes(currentPage)) {
        console.log('🚫 Acesso negado, redirecionando para login...');
        window.location.href = '/login.html';
        return false;
    }
    
    console.log('✅ Acesso permitido');
    return true;
}

// Executar verificação automaticamente
document.addEventListener('DOMContentLoaded', initializeAuth);