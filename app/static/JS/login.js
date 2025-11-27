document.addEventListener('DOMContentLoaded', function() {
    initializeLoginPage();
});

function initializeLoginPage() {
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
        
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn && !loginBtn.getAttribute('data-original-text')) {
            const btnText = loginBtn.querySelector('.btn-text');
            loginBtn.setAttribute('data-original-text', btnText.textContent);
        }
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('loginBtn');
    
    clearAlerts();
    
    const validation = validateLoginForm(email, password);
    if (!validation.isValid) {
        validation.errors.forEach(error => showAlert(error, 'danger'));
        return;
    }
    
    setButtonLoading(loginBtn, true);
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                password: password
            }),
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            handleLoginSuccess(data);
            showAlert('Login realizado com sucesso! Redirecionando...', 'success');
            
            setTimeout(() => {
                window.location.href = '/index.html';
            }, 2000);
            
        } else {
            // Obter mensagem de erro específica da API - campo "detail"
            const errorData = await response.json();
            console.log('Resposta de erro da API:', errorData); // Para debug
            const errorMessage = errorData.detail || errorData.message || errorData.error || `Erro ${response.status}`;
            throw new Error(errorMessage);
        }
        
    } catch (error) {
        console.error('Erro completo:', error); // Para debug
        showAlert(error.message, 'danger');
    } finally {
        setButtonLoading(loginBtn, false);
    }
}

// ===== HELPERS ESPECÍFICOS DO LOGIN =====

function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) return;
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    alertContainer.appendChild(alert);
    
    if (type === 'success' || type === 'info') {
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }
}

function clearAlerts() {
    const alertContainer = document.getElementById('alertContainer');
    if (alertContainer) {
        alertContainer.innerHTML = '';
    }
}

function setButtonLoading(button, isLoading) {
    if (!button) return;
    
    const btnText = button.querySelector('.btn-text');
    const spinner = button.querySelector('.spinner-border');
    
    if (isLoading) {
        btnText.textContent = 'Entrando...';
        spinner?.classList.remove('d-none');
        button.disabled = true;
    } else {
        const originalText = button.getAttribute('data-original-text') || 'Entrar';
        btnText.textContent = originalText;
        spinner?.classList.add('d-none');
        button.disabled = false;
    }
}

function validateLoginForm(email, password) {
    const errors = [];
    
    if (!email || !password) {
        errors.push('Por favor, preencha todos os campos.');
    }
    
    if (email && !isValidEmail(email)) {
        errors.push('Por favor, insira um email válido.');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}