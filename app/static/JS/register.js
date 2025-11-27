// js/register.js - Lógica completa da página de registro

document.addEventListener('DOMContentLoaded', function() {
    initializeRegisterPage();
});

function initializeRegisterPage() {
    const registerForm = document.getElementById('registerForm');
    
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
        setupRealTimeValidation();
        
        const registerBtn = document.getElementById('registerBtn');
        if (registerBtn && !registerBtn.getAttribute('data-original-text')) {
            const btnText = registerBtn.querySelector('.btn-text');
            registerBtn.setAttribute('data-original-text', btnText.textContent);
        }
    }
}

function setupRealTimeValidation() {
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirmPassword');
    
    if (password && confirmPassword) {
        confirmPassword.addEventListener('input', validatePasswordMatch);
        password.addEventListener('input', function() {
            validatePasswordMatch();
            validatePasswordStrength();
        });
    }
}

function validatePasswordMatch() {
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirmPassword');
    
    if (password && confirmPassword && password.value && confirmPassword.value) {
        if (password.value === confirmPassword.value) {
            confirmPassword.classList.add('password-match');
            confirmPassword.classList.remove('password-mismatch');
        } else {
            confirmPassword.classList.add('password-mismatch');
            confirmPassword.classList.remove('password-match');
        }
    }
}

function validatePasswordStrength() {
    const password = document.getElementById('password');
    if (password && password.value) {
        if (password.value.length >= 6) {
            password.classList.add('password-match');
            password.classList.remove('password-mismatch');
        } else {
            password.classList.add('password-mismatch');
            password.classList.remove('password-match');
        }
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const registerBtn = document.getElementById('registerBtn');
    
    clearAlerts();
    
    const validation = validateRegisterForm(name, email, password, confirmPassword);
    if (!validation.isValid) {
        validation.errors.forEach(error => showAlert(error, 'danger'));
        return;
    }
    
    setButtonLoading(registerBtn, true);
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: name,
                email: email,
                password: password
            })
        });
        
        if (response.status === 201) {
            showAlert('✅ Conta criada com sucesso! Redirecionando para login...', 'success');
            
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 3000);
            
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
        setButtonLoading(registerBtn, false);
    }
}

function validateRegisterForm(name, email, password, confirmPassword) {
    const errors = [];
    
    if (!name || !email || !password || !confirmPassword) {
        errors.push('Por favor, preencha todos os campos.');
    }
    
    if (name && name.length < 2) {
        errors.push('O nome deve ter pelo menos 2 caracteres.');
    }
    
    if (email && !isValidEmail(email)) {
        errors.push('Por favor, insira um email válido.');
    }
    
    if (password && password.length < 6) {
        errors.push('A senha deve ter pelo menos 6 caracteres.');
    }
    
    if (password !== confirmPassword) {
        errors.push('As senhas não coincidem.');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// ===== HELPERS ESPECÍFICOS DO REGISTRO =====

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
        btnText.textContent = 'Criando conta...';
        spinner?.classList.remove('d-none');
        button.disabled = true;
    } else {
        const originalText = button.getAttribute('data-original-text') || 'Criar conta';
        btnText.textContent = originalText;
        spinner?.classList.add('d-none');
        button.disabled = false;
    }
}