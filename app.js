// Sistema de Validação com Aprovação - v4 (Persistência Total)

// --- Configurações e Constantes ---
const DB_NAME = "validacaoRA_DB_v4";
const STORE_NAME = "embarques";
const COMPARISON_FIELDS = [
    "Empresa", "Master", "House", "Data House", "Prioridade", "Origem", "Destino",
    "Peso Bruto", "Peso Cubado", "Peso Taxado", "PTAX (Bacen)",
    "Dimensões", "Ítem Especial Tabela PGL", "Rate Frete", "Rate Screening Fee", 
    "Rate Security Fee", "Frete EUR", "Screening Fee EUR", "Security Fee EUR", 
    "Combustível \"Fuel\" EUR", "Total PGL EUR", "Total PGL R$"
];
const NUMERIC_FIELDS = [
    "Peso Bruto", "Peso Cubado", "Peso Taxado", "PTAX (Bacen)",
    "Rate Frete", "Rate Screening Fee", "Rate Security Fee", 
    "Frete EUR", "Screening Fee EUR", "Security Fee EUR", 
    "Combustível \"Fuel\" EUR", "Total PGL EUR", "Total PGL R$"
];
const NUMERIC_TOLERANCE = 0.01; // 1% de tolerância

// --- Elementos DOM ---
const userSelector = document.getElementById("userSelector");
const addShipmentBtn = document.getElementById("addShipmentBtn");
const monthSelector = document.getElementById("monthSelector");
const filterButtons = document.querySelectorAll(".filter-btn");
const searchInput = document.getElementById("searchInput");
const shipmentsContainer = document.getElementById("shipmentsContainer");
const emptyState = document.getElementById("emptyState");
const exportExcelBtn = document.getElementById("exportExcelBtn");
const clearAllBtn = document.getElementById("clearAllBtn");

// Modal e Formulários
const shipmentDataModal = document.getElementById("shipmentDataModal");
const shipmentModalTitle = document.getElementById("shipmentModalTitle");
const closeModalBtns = document.querySelectorAll(".close-modal");
const shipmentForm = document.getElementById("shipmentForm");
const feedbackArea = document.getElementById("feedbackArea");
const feedbackContent = document.getElementById("feedbackContent");
const rejectionCommentsArea = document.getElementById("rejectionCommentsArea");
const rejectionComments = document.getElementById("rejectionComments");
const comparisonResultArea = document.getElementById("comparisonResultArea");
const comparisonResult = document.getElementById("comparisonResult");
const saveDataBtn = document.getElementById("saveDataBtn");
const rejectBtn = document.getElementById("rejectBtn");
const approveBtn = document.getElementById("approveBtn");
const shipmentIdInput = document.getElementById("shipmentId");

// --- Estado da Aplicação ---
let db;
let currentUser = "pgl";
let currentFilter = "todos";
let currentSearchTerm = "";
let currentMonth = new Date().getMonth() + 1; // Mês atual como padrão
let allShipments = [];
let currentShipment = null;

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", () => {
    initDB().then(() => {
        setupEventListeners();
        renderMonths();
        loadShipments();
        updateUIForUser();
    });
});

// --- Banco de Dados (IndexedDB) ---
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onerror = (event) => {
            console.error("Erro ao abrir IndexedDB:", event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log("IndexedDB aberto com sucesso.");
            resolve();
        };

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
                store.createIndex("mes_referencia", "mes_referencia", { unique: false });
                store.createIndex("status_geral", "status_geral", { unique: false });
                console.log("Object store 'embarques' criado.");
            }
        };
    });
}

async function addOrUpdateShipment(shipment) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB não inicializado");
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(shipment);

        request.onsuccess = () => resolve(shipment);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function getShipment(id) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB não inicializado");
        const transaction = db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function getAllShipments() {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB não inicializado");
        const transaction = db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function deleteShipment(id) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB não inicializado");
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

async function clearAllShipments() {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB não inicializado");
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

// --- Lógica da Aplicação ---
async function loadShipments() {
    try {
        allShipments = await getAllShipments();
        renderShipments();
    } catch (error) {
        console.error("Erro ao carregar embarques:", error);
    }
}

function filterAndSearchShipments() {
    let filtered = allShipments;

    // Filtrar por mês
    if (currentMonth !== "todos") {
        filtered = filtered.filter(s => s.mes_referencia === String(currentMonth).padStart(2, '0'));
    }

    // Filtrar por status
    if (currentFilter !== "todos") {
        filtered = filtered.filter(s => s.status_geral === currentFilter.replace(/-/g, '_'));
    }

    // Filtrar por busca
    if (currentSearchTerm) {
        const term = currentSearchTerm.toLowerCase();
        filtered = filtered.filter(s =>
            s.id.toLowerCase().includes(term) ||
            s.dados_pgl.Master?.toLowerCase().includes(term) ||
            s.dados_pgl.House?.toLowerCase().includes(term) ||
            s.dados_pgl.Empresa?.toLowerCase().includes(term)
        );
    }

    return filtered;
}

function renderShipments() {
    const filteredShipments = filterAndSearchShipments();
    shipmentsContainer.innerHTML = ''; // Limpa o container

    if (filteredShipments.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    // Agrupar por mês se "todos" os meses estiverem selecionados
    if (currentMonth === "todos") {
        const groupedByMonth = filteredShipments.reduce((acc, shipment) => {
            const month = shipment.mes_referencia;
            if (!acc[month]) {
                acc[month] = [];
            }
            acc[month].push(shipment);
            return acc;
        }, {});

        const sortedMonths = Object.keys(groupedByMonth).sort();

        sortedMonths.forEach(month => {
            const monthHeader = document.createElement('div');
            monthHeader.className = 'month-header';
            monthHeader.textContent = `Mês: ${month}/${new Date().getFullYear()}`;
            shipmentsContainer.appendChild(monthHeader);

            const table = createShipmentTable(groupedByMonth[month]);
            shipmentsContainer.appendChild(table);
        });
    } else {
        // Renderizar apenas a tabela do mês selecionado
        const table = createShipmentTable(filteredShipments);
        shipmentsContainer.appendChild(table);
    }
}

function createShipmentTable(shipments) {
    const tableContainer = document.createElement('div');
    tableContainer.className = 'table-container';
    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>ID</th>
                <th>Master</th>
                <th>House</th>
                <th>Empresa</th>
                <th>Origem</th>
                <th>Destino</th>
                <th>Status</th>
                <th>Ações</th>
            </tr>
        </thead>
        <tbody>
            ${shipments.map(shipment => createShipmentRow(shipment)).join('')}
        </tbody>
    `;
    tableContainer.appendChild(table);
    return tableContainer;
}

function createShipmentRow(shipment) {
    const statusClass = `status-${shipment.status_geral.replace(/_/g, '-')}`;
    const statusText = getStatusText(shipment.status_geral);
    const badgeClass = `badge-${shipment.status_geral.replace(/_/g, '-')}`;

    return `
        <tr class="${statusClass}">
            <td>${shipment.id}</td>
            <td>${shipment.dados_pgl.Master || '-'}</td>
            <td>${shipment.dados_pgl.House || '-'}</td>
            <td>${shipment.dados_pgl.Empresa || '-'}</td>
            <td>${shipment.dados_pgl.Origem || '-'}</td>
            <td>${shipment.dados_pgl.Destino || '-'}</td>
            <td><span class="status-badge ${badgeClass}">${statusText}</span></td>
            <td>${createActionButtons(shipment)}</td>
        </tr>
    `;
}

function getStatusText(status) {
    switch (status) {
        case 'pendente_pgl': return 'Pendente PGL';
        case 'pendente_aprovacao': return 'Pendente Aprovação';
        case 'rejeitado': return 'Rejeitado';
        case 'aprovado': return 'Aprovado';
        case 'validado_ok': return 'Validado OK';
        case 'validado_divergencia': return 'Com Divergências';
        default: return status;
    }
}

function createActionButtons(shipment) {
    let buttons = '';

    if (currentUser === 'pgl') {
        if (shipment.status_geral === 'pendente_pgl' || shipment.status_geral === 'rejeitado') {
            buttons += `<button class="btn btn-sm btn-primary" onclick="openShipmentModal('${shipment.id}', 'pgl')"><i class="fas fa-edit"></i> Lançar/Corrigir</button>`;
        }
    }

    if (currentUser === 'embraer') {
        if (shipment.status_geral === 'pendente_aprovacao') {
            buttons += `<button class="btn btn-sm btn-warning" onclick="openShipmentModal('${shipment.id}', 'embraer')"><i class="fas fa-tasks"></i> Analisar/Lançar</button>`;
        }
    }

    if (shipment.status_geral === 'aprovado' || shipment.status_geral === 'validado_ok' || shipment.status_geral === 'validado_divergencia') {
         buttons += `<button class="btn btn-sm btn-success" onclick="openValidationModal('${shipment.id}')"><i class="fas fa-check-double"></i> Ver Validação</button>`;
    }

    buttons += `<button class="btn btn-sm btn-secondary" onclick="openHistoryModal('${shipment.id}')"><i class="fas fa-history"></i> Histórico</button>`;
    buttons += `<button class="btn btn-sm btn-danger btn-icon" onclick="confirmDeleteShipment('${shipment.id}')"><i class="fas fa-trash"></i></button>`;

    return `<div class="action-buttons">${buttons}</div>`;
}

function renderMonths() {
    monthSelector.innerHTML = ''; // Limpa seletor
    const months = ["Todos", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    months.forEach((monthName, index) => {
        const monthValue = index === 0 ? "todos" : index;
        const button = document.createElement('button');
        button.className = 'month-btn';
        button.textContent = monthName;
        button.dataset.month = monthValue;
        if (monthValue === currentMonth) {
            button.classList.add('active');
        }
        button.addEventListener('click', () => {
            currentMonth = monthValue;
            document.querySelectorAll('.month-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            loadShipments(); // Recarrega e renderiza com o novo mês
        });
        monthSelector.appendChild(button);
    });
}

function updateUIForUser() {
    const isPGL = currentUser === 'pgl';
    addShipmentBtn.style.display = isPGL ? 'inline-block' : 'none';
    renderShipments(); // Re-renderiza para mostrar/ocultar botões de ação
}

// --- Manipulação de Modais ---
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

async function openShipmentModal(shipmentId = null, mode = 'pgl') {
    resetShipmentForm();
    
    if (shipmentId) {
        currentShipment = await getShipment(shipmentId);
        if (!currentShipment) {
            alert("Embarque não encontrado!");
            return;
        }
        shipmentModalTitle.textContent = `Editar Embarque: ${currentShipment.id}`;
        populateShipmentForm(currentShipment);
        shipmentIdInput.value = currentShipment.id;
    } else {
        shipmentModalTitle.textContent = "Adicionar Novo Embarque";
        shipmentIdInput.value = ''; // Limpa ID para novo embarque
        currentShipment = null;
        // Garante que o mês atual esteja selecionado para novos embarques
        document.getElementById('mesReferencia').value = String(new Date().getMonth() + 1).padStart(2, '0');
    }

    // Configurar campos e botões com base no usuário e status
    configureModalForContext(currentShipment, mode);
    openModal('shipmentDataModal');
}

function resetShipmentForm() {
    shipmentForm.reset();
    feedbackArea.style.display = 'none';
    feedbackContent.textContent = '';
    rejectionCommentsArea.style.display = 'none';
    rejectionComments.value = '';
    comparisonResultArea.style.display = 'none';
    comparisonResult.innerHTML = '';
    
    // Remove indicadores visuais de comparação anteriores
    document.querySelectorAll('.field-value input').forEach(input => {
        input.classList.remove('match', 'diverge');
    });
}

function populateShipmentForm(shipment) {
    // Preencher mês de referência
    document.getElementById('mesReferencia').value = shipment.mes_referencia;
    
    // Preencher dados PGL
    for (const key in shipment.dados_pgl) {
        if (key === 'lancado_em' || key === 'lancado_por') continue;
        
        const fieldId = `pgl_${key.replace(/ /g, '').replace(/\(/g, '').replace(/\)/g, '').replace(/"/g, '').replace(/\$/g, 'BRL')}`;
        const element = document.getElementById(fieldId);
        if (element) {
            element.value = shipment.dados_pgl[key] !== null ? shipment.dados_pgl[key] : '';
        }
    }
    
    // Preencher dados Embraer
    for (const key in shipment.dados_embraer) {
        if (key === 'lancado_em' || key === 'lancado_por' || key === 'aprovado' || key === 'comentarios' || key === 'data_analise') continue;
        
        const fieldId = `embraer_${key.replace(/ /g, '').replace(/\(/g, '').replace(/\)/g, '').replace(/"/g, '').replace(/\$/g, 'BRL')}`;
        const element = document.getElementById(fieldId);
        if (element) {
            element.value = shipment.dados_embraer[key] !== null ? shipment.dados_embraer[key] : '';
        }
    }

    // Mostrar feedback se rejeitado
    if (shipment.status_geral === 'rejeitado' && currentUser === 'pgl') {
        feedbackArea.style.display = 'block';
        feedbackContent.textContent = shipment.dados_embraer.comentarios || 'Sem comentários.';
    }
}

function configureModalForContext(shipment, mode) {
    const isPGL = currentUser === 'pgl';
    const isEmbraer = currentUser === 'embraer';
    const status = shipment ? shipment.status_geral : 'novo';

    // Habilitar/Desabilitar campos PGL
    const pglFields = document.querySelectorAll('[id^="pgl_"]');
    pglFields.forEach(field => {
        field.disabled = !(isPGL && (status === 'novo' || status === 'pendente_pgl' || status === 'rejeitado'));
    });

    // Habilitar/Desabilitar campos Embraer
    const embraerFields = document.querySelectorAll('[id^="embraer_"]');
    embraerFields.forEach(field => {
        field.disabled = !(isEmbraer && status === 'pendente_aprovacao');
    });

    // Habilitar/Desabilitar campo de mês
    document.getElementById('mesReferencia').disabled = !(isPGL && status === 'novo');

    // Configurar botões
    saveDataBtn.style.display = (isPGL && (status === 'novo' || status === 'pendente_pgl' || status === 'rejeitado')) ? 'inline-block' : 'none';
    rejectBtn.style.display = (isEmbraer && status === 'pendente_aprovacao') ? 'inline-block' : 'none';
    approveBtn.style.display = (isEmbraer && status === 'pendente_aprovacao') ? 'inline-block' : 'none';
    
    // Mostrar área de comentários para rejeição apenas para Embraer
    rejectionCommentsArea.style.display = (isEmbraer && status === 'pendente_aprovacao') ? 'block' : 'none';
    
    // Configurar comparação em tempo real para Embraer
    if (isEmbraer && status === 'pendente_aprovacao') {
        enableRealTimeComparison();
    }
    
    // Mostrar resultado da comparação para embarques aprovados/validados
    if (status === 'aprovado' || status === 'validado_ok' || status === 'validado_divergencia') {
        comparisonResultArea.style.display = 'block';
        renderComparisonResult(shipment);
    } else {
        comparisonResultArea.style.display = 'none';
    }
}

function enableRealTimeComparison() {
    // Limpa resultados anteriores
    document.querySelectorAll('.field-value input').forEach(input => {
        input.classList.remove('match', 'diverge');
    });

    // Para cada campo Embraer, adiciona listener para comparação em tempo real
    COMPARISON_FIELDS.forEach(fieldKey => {
        const normalizedKey = fieldKey.replace(/ /g, '').replace(/\(/g, '').replace(/\)/g, '').replace(/"/g, '').replace(/\$/g, 'BRL');
        const embraerInputId = `embraer_${normalizedKey}`;
        const pglInputId = `pgl_${normalizedKey}`;
        
        const embraerInput = document.getElementById(embraerInputId);
        const pglInput = document.getElementById(pglInputId);
        
        if (embraerInput && pglInput) {
            const compareFunction = () => {
                const pglValue = pglInput.value;
                const embraerValue = embraerInput.value;
                const isNumeric = NUMERIC_FIELDS.includes(fieldKey);
                
                const comparison = compareValues(pglValue, embraerValue, isNumeric);
                
                // Atualiza indicador visual
                embraerInput.classList.toggle('match', comparison.coincide);
                embraerInput.classList.toggle('diverge', !comparison.coincide);
            };

            embraerInput.addEventListener('input', compareFunction);
            embraerInput.addEventListener('change', compareFunction);
            
            // Executa a comparação inicial
            compareFunction();
        }
    });
}

function compareValues(value1, value2, isNumeric) {
    const v1 = value1 === null || value1 === undefined ? '' : String(value1).trim();
    const v2 = value2 === null || value2 === undefined ? '' : String(value2).trim();

    if (isNumeric) {
        const num1 = parseFloat(v1);
        const num2 = parseFloat(v2);
        
        if (isNaN(num1) && isNaN(num2)) return { coincide: true, diferenca_percentual: null };
        if (isNaN(num1) || isNaN(num2)) return { coincide: false, diferenca_percentual: null };
        if (num1 === 0 && num2 === 0) return { coincide: true, diferenca_percentual: 0 };
        
        if (num1 === 0 || num2 === 0) {
            const diff = Math.abs(num1 - num2);
            return { coincide: diff < 0.0001, diferenca_percentual: 100 }; // Diferença significativa se um é zero
        }
        
        const difference = Math.abs(num1 - num2);
        const average = (Math.abs(num1) + Math.abs(num2)) / 2;
        const percentageDifference = average === 0 ? 0 : (difference / average);
        
        return {
            coincide: difference <= (average * NUMERIC_TOLERANCE),
            diferenca_percentual: percentageDifference * 100
        };
    } else {
        // Comparação de string (case-insensitive para robustez)
        return { coincide: v1.toLowerCase() === v2.toLowerCase(), diferenca_percentual: null };
    }
}

function performCrossChecking(shipment) {
    const validationResult = {
        status: "ok",
        total_divergencias: 0,
        comparacoes: [],
        validado_em: new Date().toISOString()
    };

    COMPARISON_FIELDS.forEach(fieldKey => {
        const pglValue = shipment.dados_pgl[fieldKey];
        const embraerValue = shipment.dados_embraer[fieldKey];
        const isNumeric = NUMERIC_FIELDS.includes(fieldKey);
        const comparison = compareValues(pglValue, embraerValue, isNumeric);

        validationResult.comparacoes.push({
            campo: fieldKey,
            valor_pgl: pglValue,
            valor_embraer: embraerValue,
            coincide: comparison.coincide,
            diferenca_percentual: comparison.diferenca_percentual,
            eh_numerico: isNumeric
        });

        if (!comparison.coincide) {
            validationResult.total_divergencias++;
            validationResult.status = "divergencia";
        }
    });
    
    shipment.status_geral = validationResult.status === 'ok' ? 'validado_ok' : 'validado_divergencia';
    shipment.resultado_validacao = validationResult;
    return shipment;
}

function renderComparisonResult(shipment) {
    comparisonResult.innerHTML = ''; // Limpa antes de renderizar
    
    let comparisonData = [];
    
    if (shipment.resultado_validacao && shipment.resultado_validacao.comparacoes) {
        // Usa os resultados da validação já salva
        comparisonData = shipment.resultado_validacao.comparacoes;
        
        // Adiciona resumo da validação
        const summaryDiv = document.createElement('div');
        summaryDiv.className = `comparison-summary ${shipment.resultado_validacao.status === 'ok' ? 'summary-ok' : 'summary-diverge'}`;
        summaryDiv.innerHTML = `
            <strong>Resultado: ${shipment.resultado_validacao.status === 'ok' ? 'Todos os campos coincidem' : `${shipment.resultado_validacao.total_divergencias} divergência(s) encontrada(s)`}</strong>
            <br>
            <span>Validado em: ${new Date(shipment.resultado_validacao.validado_em).toLocaleString()}</span>
        `;
        comparisonResult.appendChild(summaryDiv);
    } else {
        // Realiza comparação em tempo real
        COMPARISON_FIELDS.forEach(fieldKey => {
            const normalizedKey = fieldKey.replace(/ /g, '').replace(/\(/g, '').replace(/\)/g, '').replace(/"/g, '').replace(/\$/g, 'BRL');
            const pglInputId = `pgl_${normalizedKey}`;
            const embraerInputId = `embraer_${normalizedKey}`;
            
            const pglInput = document.getElementById(pglInputId);
            const embraerInput = document.getElementById(embraerInputId);
            
            if (pglInput && embraerInput) {
                const pglValue = pglInput.value;
                const embraerValue = embraerInput.value;
                const isNumeric = NUMERIC_FIELDS.includes(fieldKey);
                const comparison = compareValues(pglValue, embraerValue, isNumeric);
                
                comparisonData.push({
                    campo: fieldKey,
                    valor_pgl: pglValue,
                    valor_embraer: embraerValue,
                    coincide: comparison.coincide,
                    diferenca_percentual: comparison.diferenca_percentual,
                    eh_numerico: isNumeric
                });
            }
        });
        
        // Adiciona resumo da comparação em tempo real
        const divergencias = comparisonData.filter(item => !item.coincide).length;
        const summaryDiv = document.createElement('div');
        summaryDiv.className = `comparison-summary ${divergencias === 0 ? 'summary-ok' : 'summary-diverge'}`;
        summaryDiv.innerHTML = `
            <strong>Resultado Preliminar: ${divergencias === 0 ? 'Todos os campos coincidem' : `${divergencias} divergência(s) encontrada(s)`}</strong>
        `;
        comparisonResult.appendChild(summaryDiv);
    }

    // Cria tabela de comparação
    const table = document.createElement('table');
    table.className = 'comparison-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Campo</th>
                <th>Valor PGL</th>
                <th>Valor Embraer</th>
                <th>Resultado</th>
            </tr>
        </thead>
        <tbody>
            ${comparisonData.map(comp => `
                <tr>
                    <td>${comp.campo}</td>
                    <td>${comp.valor_pgl ?? '-'}</td>
                    <td>${comp.valor_embraer ?? '-'}</td>
                    <td class="${comp.coincide ? 'comparison-match' : 'comparison-diverge'}">
                        ${comp.coincide ? '<i class="fas fa-check"></i> OK' : '<i class="fas fa-times"></i> Divergente'}
                        ${comp.diferenca_percentual !== null ? ` (${comp.diferenca_percentual.toFixed(2)}%)` : ''}
                    </td>
                </tr>
            `).join('')}
        </tbody>
    `;
    comparisonResult.appendChild(table);
}

async function handleSaveShipment() {
    const id = shipmentIdInput.value;
    const mes = document.getElementById('mesReferencia').value;
    if (!mes) {
        alert("Por favor, selecione o mês de referência.");
        return;
    }

    let shipment;
    const now = new Date().toISOString();

    if (id) { // Editando
        shipment = await getShipment(id);
        if (!shipment) {
            alert("Erro: Embarque não encontrado para edição.");
            return;
        }
    } else { // Novo
        shipment = {
            id: `EMB-${Date.now()}`,
            mes_referencia: mes,
            status_geral: "pendente_pgl",
            dados_pgl: { lancado_em: null, lancado_por: 'pgl' },
            dados_embraer: { lancado_em: null, lancado_por: 'embraer', aprovado: false, comentarios: '', data_analise: null },
            resultado_validacao: { status: "nao_validado", total_divergencias: 0, comparacoes: [], validado_em: null },
            historico: [{ data: now, acao: "criacao", usuario: currentUser, comentario: `Embarque criado para o mês ${mes}` }]
        };
    }

    // Atualiza mês
    shipment.mes_referencia = mes;
    
    // Coleta todos os dados PGL do formulário
    COMPARISON_FIELDS.forEach(fieldKey => {
        const normalizedKey = fieldKey.replace(/ /g, '').replace(/\(/g, '').replace(/\)/g, '').replace(/"/g, '').replace(/\$/g, 'BRL');
        const fieldId = `pgl_${normalizedKey}`;
        const element = document.getElementById(fieldId);
        
        if (element) {
            const value = element.value.trim();
            shipment.dados_pgl[fieldKey] = NUMERIC_FIELDS.includes(fieldKey) ? 
                (value === '' ? null : parseFloat(value)) : 
                value;
        }
    });
    
    // Atualiza metadados PGL
    shipment.dados_pgl.lancado_em = now;
    shipment.dados_pgl.lancado_por = currentUser;

    // Atualiza status e histórico
    const previousStatus = shipment.status_geral;
    if (previousStatus === 'pendente_pgl' || previousStatus === 'rejeitado' || previousStatus === 'novo') {
        shipment.status_geral = 'pendente_aprovacao';
        shipment.historico.push({ 
            data: now, 
            acao: "lancamento_pgl", 
            usuario: currentUser, 
            comentario: `Dados PGL ${id ? 'corrigidos' : 'lançados'}` 
        });
    }

    try {
        await addOrUpdateShipment(shipment);
        closeModal('shipmentDataModal');
        loadShipments();
    } catch (error) {
        console.error("Erro ao salvar embarque:", error);
        alert("Erro ao salvar embarque. Verifique o console.");
    }
}

async function handleApproveShipment() {
    const id = shipmentIdInput.value;
    if (!id) return;

    const shipment = await getShipment(id);
    if (!shipment || shipment.status_geral !== 'pendente_aprovacao') {
        alert("Ação inválida para o status atual do embarque.");
        return;
    }

    const now = new Date().toISOString();

    // Coleta todos os dados Embraer do formulário
    COMPARISON_FIELDS.forEach(fieldKey => {
        const normalizedKey = fieldKey.replace(/ /g, '').replace(/\(/g, '').replace(/\)/g, '').replace(/"/g, '').replace(/\$/g, 'BRL');
        const fieldId = `embraer_${normalizedKey}`;
        const element = document.getElementById(fieldId);
        
        if (element) {
            const value = element.value.trim();
            shipment.dados_embraer[fieldKey] = NUMERIC_FIELDS.includes(fieldKey) ? 
                (value === '' ? null : parseFloat(value)) : 
                value;
        }
    });
    
    // Atualiza metadados Embraer
    shipment.dados_embraer.lancado_em = now;
    shipment.dados_embraer.lancado_por = currentUser;
    shipment.dados_embraer.aprovado = true;
    shipment.dados_embraer.comentarios = document.getElementById('rejectionComments').value.trim();
    shipment.dados_embraer.data_analise = now;

    // Realiza o cross-checking
    const validatedShipment = performCrossChecking(shipment);
    
    // Atualiza histórico
    validatedShipment.historico.push({ 
        data: now, 
        acao: "aprovacao_embraer", 
        usuario: currentUser, 
        comentario: `Aprovado pela Embraer. ${validatedShipment.resultado_validacao.total_divergencias} divergências encontradas.` 
    });

    try {
        await addOrUpdateShipment(validatedShipment);
        closeModal('shipmentDataModal');
        loadShipments();
    } catch (error) {
        console.error("Erro ao aprovar embarque:", error);
        alert("Erro ao aprovar embarque. Verifique o console.");
    }
}

async function handleRejectShipment() {
    const id = shipmentIdInput.value;
    if (!id) return;

    const shipment = await getShipment(id);
    if (!shipment || shipment.status_geral !== 'pendente_aprovacao') {
        alert("Ação inválida para o status atual do embarque.");
        return;
    }

    const comments = document.getElementById('rejectionComments').value.trim();
    if (!comments) {
        alert("Por favor, forneça um comentário explicando o motivo da rejeição.");
        return;
    }

    const now = new Date().toISOString();

    shipment.status_geral = 'rejeitado';
    shipment.dados_embraer.aprovado = false;
    shipment.dados_embraer.comentarios = comments;
    shipment.dados_embraer.data_analise = now;
    shipment.historico.push({ 
        data: now, 
        acao: "rejeicao_embraer", 
        usuario: currentUser, 
        comentario: comments 
    });

    try {
        await addOrUpdateShipment(shipment);
        closeModal('shipmentDataModal');
        loadShipments();
    } catch (error) {
        console.error("Erro ao rejeitar embarque:", error);
        alert("Erro ao rejeitar embarque. Verifique o console.");
    }
}

async function confirmDeleteShipment(id) {
    if (confirm(`Tem certeza que deseja excluir o embarque ${id}? Esta ação não pode ser desfeita.`)) {
        try {
            await deleteShipment(id);
            loadShipments();
        } catch (error) {
            console.error("Erro ao excluir embarque:", error);
            alert("Erro ao excluir embarque.");
        }
    }
}

async function confirmClearAll() {
    if (confirm("Tem certeza que deseja limpar TODOS os dados de embarques? Esta ação não pode ser desfeita.")) {
        try {
            await clearAllShipments();
            allShipments = [];
            renderShipments();
        } catch (error) {
            console.error("Erro ao limpar dados:", error);
            alert("Erro ao limpar todos os dados.");
        }
    }
}

async function openValidationModal(id) {
    const shipment = await getShipment(id);
    if (!shipment) {
        alert("Embarque não encontrado.");
        return;
    }

    const modalBody = document.getElementById('validationModalBody');
    modalBody.innerHTML = ''; // Limpa conteúdo anterior

    if (shipment.resultado_validacao && shipment.resultado_validacao.status !== 'nao_validado') {
        const result = shipment.resultado_validacao;
        const statusClass = result.status === 'ok' ? 'validation-ok' : 'validation-divergence';
        const statusText = result.status === 'ok' ? 'Validado OK' : `Com ${result.total_divergencias} Divergência(s)`;

        const summaryDiv = document.createElement('div');
        summaryDiv.className = `validation-result ${statusClass}`;
        summaryDiv.innerHTML = `<strong>Resultado: ${statusText}</strong> (Validado em: ${new Date(result.validado_em).toLocaleString()})`;
        modalBody.appendChild(summaryDiv);

        const comparisonTable = document.createElement('table');
        comparisonTable.className = 'comparison-table';
        comparisonTable.style.marginTop = '1rem';
        comparisonTable.innerHTML = `
            <thead>
                <tr>
                    <th>Campo</th>
                    <th>Valor PGL</th>
                    <th>Valor Embraer</th>
                    <th>Resultado</th>
                </tr>
            </thead>
            <tbody>
                ${result.comparacoes.map(comp => `
                    <tr>
                        <td>${comp.campo}</td>
                        <td>${comp.valor_pgl ?? '-'}</td>
                        <td>${comp.valor_embraer ?? '-'}</td>
                        <td class="${comp.coincide ? 'comparison-match' : 'comparison-diverge'}">
                            ${comp.coincide ? '<i class="fas fa-check"></i> OK' : '<i class="fas fa-times"></i> Divergente'}
                            ${comp.diferenca_percentual !== null ? ` (${comp.diferenca_percentual.toFixed(2)}%)` : ''}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        modalBody.appendChild(comparisonTable);
    } else {
        modalBody.innerHTML = '<p>Validação ainda não realizada ou dados inválidos.</p>';
    }

    openModal('validationModal');
}

async function openHistoryModal(id) {
    const shipment = await getShipment(id);
    if (!shipment || !shipment.historico) {
        alert("Histórico não encontrado.");
        return;
    }

    const historyContent = document.getElementById('historyContent');
    historyContent.innerHTML = ''; // Limpa conteúdo anterior

    shipment.historico.slice().reverse().forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div class="history-date">${new Date(item.data).toLocaleString()}</div>
            <div class="history-action"><strong>Ação:</strong> ${item.acao}</div>
            <div class="history-user"><strong>Usuário:</strong> ${item.usuario}</div>
            ${item.comentario ? `<div class="history-comment"><strong>Comentário:</strong> ${item.comentario}</div>` : ''}
        `;
        historyContent.appendChild(div);
    });

    openModal('historyModal');
}

// --- Exportação Excel ---
async function exportToExcel() {
    const filteredShipments = filterAndSearchShipments();
    if (filteredShipments.length === 0) {
        alert("Nenhum dado para exportar com os filtros atuais.");
        return;
    }

    // Mapeia os dados para o formato da planilha original + validação
    const dataForExport = filteredShipments.map(s => {
        const row = {};
        
        // Colunas PGL (A-K)
        COMPARISON_FIELDS.forEach(field => {
            row[field] = s.dados_pgl[field];
        });
        
        // Espaços em branco (L-AC)
        // ... (adicionar colunas vazias se necessário manter estrutura exata)
        
        // Colunas Embraer (AD-AN)
        COMPARISON_FIELDS.forEach(field => {
            row[`${field} (Embraer)`] = s.dados_embraer[field];
        });

        // Colunas de Validação Adicionais
        row['Status Validação'] = getStatusText(s.status_geral);
        row['Total Divergências'] = s.resultado_validacao?.total_divergencias ?? 'N/A';
        row['Data Validação'] = s.resultado_validacao?.validado_em ? new Date(s.resultado_validacao.validado_em).toLocaleString() : 'N/A';
        row['Aprovado Embraer'] = s.dados_embraer.aprovado ? 'Sim' : 'Não';
        row['Data Análise Embraer'] = s.dados_embraer.data_analise ? new Date(s.dados_embraer.data_analise).toLocaleString() : 'N/A';
        row['Comentários Embraer'] = s.dados_embraer.comentarios;

        return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Validação RA");

    // Gera o nome do arquivo
    const monthName = currentMonth === 'todos' ? 'TodosMeses' : String(currentMonth).padStart(2, '0');
    const fileName = `ValidacaoRA_${monthName}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    XLSX.writeFile(workbook, fileName);
}

// --- Event Listeners ---
function setupEventListeners() {
    userSelector.addEventListener("change", (e) => {
        currentUser = e.target.value;
        updateUIForUser();
    });

    addShipmentBtn.addEventListener("click", () => openShipmentModal());

    filterButtons.forEach(button => {
        button.addEventListener("click", () => {
            filterButtons.forEach(btn => btn.classList.remove("active"));
            button.classList.add("active");
            currentFilter = button.dataset.filter;
            renderShipments();
        });
    });

    searchInput.addEventListener("input", (e) => {
        currentSearchTerm = e.target.value;
        renderShipments();
    });

    closeModalBtns.forEach(button => {
        button.addEventListener("click", () => {
            closeModal(button.dataset.modal);
        });
    });

    saveDataBtn.addEventListener('click', handleSaveShipment);
    approveBtn.addEventListener('click', handleApproveShipment);
    rejectBtn.addEventListener('click', handleRejectShipment);
    exportExcelBtn.addEventListener('click', exportToExcel);
    clearAllBtn.addEventListener('click', confirmClearAll);

    // Fechar modal clicando fora
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            closeModal(event.target.id);
        }
    });
}

// --- Funções Globais (para acesso via onclick) ---
window.openShipmentModal = openShipmentModal;
window.openValidationModal = openValidationModal;
window.openHistoryModal = openHistoryModal;
window.confirmDeleteShipment = confirmDeleteShipment;

console.log("App V4 inicializado com persistência total.");
