// Lista de arquivos presentes no projeto
const projectFiles = [
    'index.html',
    'login.html',
    'register.html',
    'game.html',
    'profile.html',
    'offline_game.html'
];

document.addEventListener('DOMContentLoaded', () => {
    renderFileList();
    
    // INJEÇÃO DE CSS PARA ÁRVORE VERTICAL (Estilo File Tree)
    injectVerticalStyles();
    
    // Carrega o index.html por padrão
    loadFile('index.html');
});

function injectVerticalStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* Container Principal */
        .dom-viewer-container {
            overflow: auto;
            padding: 30px;
            background: #f8f9fa;
        }

        /* Nó (Vertical) */
        .dom-node {
            display: block;
            position: relative;
            margin: 0;
            padding: 0;
        }

        /* O "Card" do Elemento (Tag) */
        .node-line {
            background: #fff;
            border: 1px solid #ccc;
            border-radius: 6px;
            padding: 6px 10px;
            margin-bottom: 8px; /* Espaço vertical entre nós */
            display: inline-block; /* Ocupa apenas o tamanho necessário */
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            font-family: 'Segoe UI', monospace;
            font-size: 13px;
            position: relative;
            z-index: 2;
            transition: all 0.2s;
            cursor: default;
        }
        
        .node-line:hover {
            transform: translateX(5px);
            border-color: #E65100;
            box-shadow: 0 2px 8px rgba(230, 81, 0, 0.15);
        }

        /* Container de Filhos (Indentado à esquerda) */
        .children-container {
            display: block;
            margin-left: 25px; /* Indentação */
            padding-left: 20px; /* Espaço para o conector */
            border-left: 2px solid #ddd; /* Linha Vertical Principal */
            position: relative;
        }
        
        /* CONECTOR: Haste horizontal da linha vertical para o filho */
        .children-container > .dom-node::before {
            content: '';
            position: absolute;
            top: 15px; /* Alinha com o meio da primeira linha do filho */
            left: -22px; /* Vai até a borda esquerda (border-left) */
            width: 20px;
            height: 2px;
            background: #ddd;
        }

        /* Remove conectores para o nó raiz principal */
        #domOutput > .dom-node::before { display: none; }
        
        /* Botão de Colapso */
        .toggle-btn {
            margin-right: 8px;
            color: #666;
            font-size: 10px;
            cursor: pointer;
            display: inline-block;
            width: 10px;
            text-align: center;
        }
        .toggle-btn.collapsed { transform: rotate(-90deg); }

        /* Cores de Sintaxe */
        .tag-name { color: #D81B60; font-weight: 700; }
        .attr-name { color: #E65100; }
        .attr-value { color: #43A047; }
        .text-content { 
            color: #555; 
            font-style: italic; 
            display: inline-block;
            max-width: 400px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            vertical-align: bottom;
        }
        .comment { color: #999; }
    `;
    document.head.appendChild(style);
}

function renderFileList() {
    const list = document.getElementById('fileList');
    list.innerHTML = '';

    projectFiles.forEach(file => {
        const item = document.createElement('button');
        item.className = 'list-group-item list-group-item-action';
        item.textContent = file;
        item.onclick = () => {
            // Atualiza classe active
            document.querySelectorAll('.file-selector .active').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            loadFile(file);
        };
        
        if (file === 'index.html') item.classList.add('active');
        list.appendChild(item);
    });
}

async function loadFile(filename) {
    const output = document.getElementById('domOutput');
    const title = document.getElementById('currentFileName');
    
    title.textContent = filename;
    output.innerHTML = '<div class="text-center mt-5"><div class="spinner-border text-secondary"></div></div>';

    try {
        const response = await fetch(filename);
        if (!response.ok) throw new Error('Arquivo não encontrado');
        
        const text = await response.text();
        
        // Parseia o texto HTML para um Documento DOM virtual
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        
        output.innerHTML = ''; // Limpa loader
        
        // Começa a renderização a partir do elemento HTML (raiz)
        const rootElement = createDomTree(doc.documentElement);
        output.appendChild(rootElement);

        // Calcula estatísticas
        calculateStats(doc);

    } catch (error) {
        output.innerHTML = `<div class="alert alert-danger m-3">Erro ao carregar ${filename}: ${error.message}</div>`;
    }
}

/**
 * Função Recursiva para criar a árvore visual (Modo Árvore Vertical)
 */
function createDomTree(node) {
    // Ignora nós de texto vazios (quebras de linha)
    if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) {
        return null;
    }

    const container = document.createElement('div');
    container.className = 'dom-node';

    // --- TIPO: COMENTÁRIO ---
    if (node.nodeType === Node.COMMENT_NODE) {
        const comment = document.createElement('div');
        comment.className = 'node-line comment';
        comment.textContent = `<!-- ${node.textContent.substring(0, 30)}... -->`;
        container.appendChild(comment);
        return container;
    }

    // --- TIPO: TEXTO ---
    if (node.nodeType === Node.TEXT_NODE) {
        const textSpan = document.createElement('span');
        textSpan.className = 'text-content';
        textSpan.textContent = `"${node.textContent.trim()}"`;
        
        const line = document.createElement('div');
        line.className = 'node-line';
        line.appendChild(textSpan);
        container.appendChild(line);
        return container;
    }

    // --- TIPO: ELEMENTO (TAG) ---
    if (node.nodeType === Node.ELEMENT_NODE) {
        const line = document.createElement('div');
        line.className = 'node-line';

        // Verifica filhos
        const hasChildren = node.childNodes.length > 0 && Array.from(node.childNodes).some(n => n.nodeType === Node.ELEMENT_NODE || (n.nodeType === Node.TEXT_NODE && n.textContent.trim()));
        
        // Botão de Colapso
        const toggle = document.createElement('span');
        toggle.className = `toggle-btn ${hasChildren ? '' : 'hidden'}`;
        toggle.textContent = '▼';
        toggle.onclick = (e) => {
            e.stopPropagation();
            toggle.classList.toggle('collapsed');
            if (childrenContainer) {
                // Alterna display block/none para layout vertical
                if (childrenContainer.style.display === 'none') {
                    childrenContainer.style.display = 'block';
                } else {
                    childrenContainer.style.display = 'none';
                }
            }
        };
        line.appendChild(toggle);

        // Nome da Tag
        const tagSpan = document.createElement('span');
        tagSpan.className = 'tag-name';
        tagSpan.textContent = node.tagName.toLowerCase();
        line.appendChild(tagSpan);
        
        // ID (se houver)
        if (node.id) {
            const idSpan = document.createElement('span');
            idSpan.style.color = '#d63384'; // Rosa/Roxo para ID
            idSpan.style.fontWeight = 'bold';
            idSpan.textContent = `#${node.id}`;
            line.appendChild(idSpan);
        }

        // Classes (se houver)
        if (node.className && typeof node.className === 'string') {
            const classes = node.className.split(/\s+/).filter(c => c).join('.');
            if (classes) {
                const classSpan = document.createElement('span');
                classSpan.style.color = '#0d6efd'; // Azul para classes
                classSpan.textContent = `.${classes}`;
                line.appendChild(classSpan);
            }
        }

        // Atributos importantes
        if (node.hasAttribute('src')) {
            const srcSpan = document.createElement('span');
            srcSpan.className = 'attr-value';
            srcSpan.style.marginLeft = '5px';
            srcSpan.style.color = '#999';
            srcSpan.textContent = `(src="${node.getAttribute('src')}")`;
            line.appendChild(srcSpan);
        } else if (node.hasAttribute('href')) {
            const hrefSpan = document.createElement('span');
            hrefSpan.className = 'attr-value';
            hrefSpan.style.marginLeft = '5px';
            hrefSpan.style.color = '#999';
            hrefSpan.textContent = `(href="${node.getAttribute('href')}")`;
            line.appendChild(hrefSpan);
        }

        container.appendChild(line);

        // Filhos (Recursão)
        let childrenContainer = null;
        if (hasChildren) {
            childrenContainer = document.createElement('div');
            childrenContainer.className = 'children-container';
            
            Array.from(node.childNodes).forEach(child => {
                const childNode = createDomTree(child);
                if (childNode) {
                    childrenContainer.appendChild(childNode);
                }
            });

            container.appendChild(childrenContainer);
        }
    }

    return container;
}

function calculateStats(doc) {
    const allElements = doc.getElementsByTagName('*');
    document.getElementById('tagCount').textContent = allElements.length;
    
    let maxDepth = 0;
    function getDepth(node, depth) {
        if (depth > maxDepth) maxDepth = depth;
        for (let i = 0; i < node.children.length; i++) {
            getDepth(node.children[i], depth + 1);
        }
    }
    getDepth(doc.documentElement, 1);
    document.getElementById('depthCount').textContent = maxDepth;
}

function expandAll() {
    // Na árvore vertical, mostrar display block
    document.querySelectorAll('.children-container').forEach(el => el.style.display = 'block');
    document.querySelectorAll('.toggle-btn').forEach(el => el.classList.remove('collapsed'));
}

function collapseAll() {
    // Na árvore vertical, esconder display none
    document.querySelectorAll('.children-container').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.toggle-btn').forEach(el => el.classList.add('collapsed'));
}