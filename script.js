// CONSTANTS
let SHEET_ID = localStorage.getItem('SHEET_ID') || '1_Dbbjt1TC8pcBPXGbISfuQr8ilsRan21REy51nMw0hg';
// Explicitly defining the months the user wants to access as tabs
const MONTHS = ['OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE', 'ENERO', 'FEBRERO'];

// CONFIG (Thresholds)
const GOALS = {
    satSnl: 95,
    resSnl: 90,
    satEp: 95,
    resEp: 90,
    tmo: 5
};

// Metas globales (valores objetivo mostrados por el selector)
const metas = {
    tmo: 5,
    satEP: 95,
    resEP: 90,
    satSNL: 95,
    resSNL: 90,
    transfEPA: 85,
    tipificaciones: 95
};

// Resuelve la clave del selector a la propiedad real en los datos
function resolveKpiKey(key) {
    const map = {
        satEP: 'satEp',
        resEP: 'resEp',
        satSNL: 'satSnl',
        resSNL: 'resSnl',
        transfEPA: 'transfEPA',
        tipificaciones: 'tipificaciones',
        tmo: 'tmo'
    };
    return map[key] || key;
}

// Comprueba si un valor cumple la meta para el KPI dado
function cumpleMeta(kpiKey, valor) {
    const meta = metas[kpiKey];
    if (meta === undefined) return false;
    const num = Number(valor) || 0;
    if (kpiKey === 'tmo') return num <= meta;
    return num >= meta;
}

// STATE
let currentData = [];
let currentMonth = 'OCTUBRE';
let theme = localStorage.getItem('theme') || 'light';
let evolChart = null;

// SETUP
document.addEventListener('DOMContentLoaded', () => {
    applyTheme(theme);
    initEventListeners();
    populateMonthFilter();
    // Simular carga inicial con datos mock mientras se conecta a la planilla real
    simulateInitialLoad();
    const initialKpi = document.getElementById('selectKPI') ? document.getElementById('selectKPI').value : 'tmo';
    updateKpiDisplay(initialKpi);
});

// Simula la carga inicial: muestra datos mock inmediatamente y luego intenta cargar la planilla real
async function simulateInitialLoad() {
    const overlay = document.getElementById('refreshOverlay');
    if (overlay) overlay.classList.add('active');

    // Mostrar datos de ejemplo inmediatamente
    useMockData();

    // Espera breve mientras se establece la conexión real
    await new Promise(resolve => setTimeout(resolve, 900));

    // Intentar reemplazar con datos reales (fetchData maneja errores internamente)
    try {
        await fetchData(currentMonth);
    } catch (e) {
        console.error('Error al intentar cargar datos reales:', e);
    } finally {
        if (overlay) overlay.classList.remove('active');
    }
}

function initEventListeners() {
    // Theme Toggle
    document.getElementById('themeToggle').addEventListener('click', () => {
        theme = theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', theme);
        applyTheme(theme);
    });

    // Filters
    const monthSelect = document.getElementById('monthFilter');
    monthSelect.addEventListener('change', async (e) => {
        // Support multiple selected months
        const sel = Array.from(e.target.selectedOptions).map(o => o.value);
        if (sel.length === 0) return;
        // Set currentMonth to first selected for compatibility
        currentMonth = sel[0];
        if (sel.length === 1) {
            await fetchData(currentMonth);
        } else {
            // Fetch and merge all selected months
            await fetchMultipleMonths(sel);
        }
    });

    document.getElementById('execFilter').addEventListener('change', renderDashboard);
    // KPI selector listener
    const kpiSel = document.getElementById('selectKPI');
    if (kpiSel) kpiSel.addEventListener('change', (e) => updateKpiDisplay(e.target.value));
}

function populateMonthFilter() {
    const sel = document.getElementById('monthFilter');
    sel.innerHTML = '';
    MONTHS.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.innerText = m;
        sel.appendChild(opt);
    });
    sel.value = currentMonth;
}

function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    const btn = document.getElementById('themeToggle');
    btn.innerHTML = t === 'light' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
}

// FETCHING DATA
async function fetchData(month) {
    showLoading(true);
    // fallback
    if (!month) month = currentMonth;

    console.log(`Fetching Month: ${month}`);

    // Using Google Visualization API via Proxy to allow Tab Selection
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(month)}`;
    const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(gvizUrl);

    try {
        const parsed = await fetchSheet(month);
        currentData = parsed;
        console.log(`Data loaded for ${month}`, currentData);
        processData(currentData);
    } catch (err) {
        console.error('Fetch failed:', err);
        alert(`No se pudo cargar la pestaña "${month}". Asegúrate de que la hoja exista y se llame exactamente así.`);
    } finally {
        showLoading(false);
    }
}

// Fetch a single sheet and return parsed rows (does not update UI)
async function fetchSheet(month) {
    if (!month) throw new Error('Month required');
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(month)}`;
    const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(gvizUrl);
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error('Network response was not ok');
    const text = await response.text();
    const jsonString = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\);/);
    if (jsonString && jsonString[1]) {
        const json = JSON.parse(jsonString[1]);
        const rows = json.table.rows;
        const parsed = rows.map(r => {
            const c = r.c;
            const v = (idx) => (c[idx] ? (c[idx].v !== null ? c[idx].v : 0) : 0);
            return {
                name: v(0),
                mes: v(1),
                tmo: parseFloat(v(2)),
                transfEPA: parseFloat(v(3)),
                tipificaciones: parseFloat(v(4)),
                satEp: parseFloat(v(5)),
                resEp: parseFloat(v(6)),
                satSnl: parseFloat(v(7)),
                resSnl: parseFloat(v(8))
            };
        }).filter(d => d.name && d.name !== 'Ejecutivo' && d.name !== 'Column1');
        return parsed;
    }
    throw new Error('Invalid JSON format from Sheets API');
}

// Fetch multiple sheets and merge results
async function fetchMultipleMonths(months) {
    showLoading(true);
    try {
        const promises = months.map(m => fetchSheet(m).catch(err => {
            console.error(`Error loading ${m}:`, err);
            return [];
        }));
        const results = await Promise.all(promises);
        // Merge arrays
        currentData = [].concat(...results);
        // Ensure mes values are normalized to uppercase month names
        currentData.forEach(d => { if (d.mes) d.mes = d.mes.toString().toUpperCase(); });
        processData(currentData);
    } finally {
        showLoading(false);
    }
}

// Obsolete functions updateMonthFilter and filterDataByMonth removed.
// Logic is now handled by direct fetch in fetchData(month).

function parseCSV(text) {
    // Kept as utility or fallback if needed, though fetchData uses JSON now.
    // Simple CSV parser handling quotes and commas
    return [];
}

function parseNumber(str) {
    if (!str) return 0;
    // Handle "95%" or "0,95" or "0.95"
    let clean = str.replace('%', '').replace(',', '.');
    return parseFloat(clean) || 0;
}

// function filterDataByMonth removed.

function useMockData() {
    // Generate fake historical data for demo purposes
    const names = ['Juan Perez', 'Maria Gonzalez', 'Carlos Lopez', 'Ana Silva', 'Pedro Dias', 'Luisa Martinez', 'Jorge Ruiz', 'Sofia Torres'];
    const months = MONTHS.slice(0, 4); // OCTUBRE, NOVIEMBRE, DICIEMBRE, ENERO

    currentData = [];
    names.forEach(n => {
        months.forEach((m, idx) => {
            currentData.push({
                name: n,
                mes: m,
                tmo: +(4 + Math.random() * 3).toFixed(2),
                transfEPA: +(75 + Math.random() * 20).toFixed(2),
                tipificaciones: +(85 + Math.random() * 15).toFixed(2),
                satEp: +(85 + Math.random() * 15).toFixed(2),
                resEp: +(80 + Math.random() * 20).toFixed(2),
                satSnl: +(85 + Math.random() * 15).toFixed(2),
                resSnl: +(80 + Math.random() * 20).toFixed(2)
            });
        });
    });

    processData(currentData);
}

// LOGIC & CALCULATIONS
function processData(data) {
    // 1. Calculate Score for Quartiles
    // Score = Average of 4 KPIs (normalized to 0-100)
    // If input is 0.95 (decimal), convert to 95. If > 1, assume percent.

    data.forEach(d => {
        // Normalization
        d.satSnl = normalizePercent(d.satSnl);
        d.resSnl = normalizePercent(d.resSnl);
        d.satEp = normalizePercent(d.satEp);
        d.resEp = normalizePercent(d.resEp);

        // Simple Average Score
        d.score = (d.satSnl + d.resSnl + d.satEp + d.resEp) / 4;
    });

    // 2. Sort by Score Descending
    data.sort((a, b) => b.score - a.score);

    // 3. Assign Quartiles
    const total = data.length;
    data.forEach((d, index) => {
        const percentile = (index + 1) / total;
        if (percentile <= 0.25) d.quartile = 'Q1';
        else if (percentile <= 0.50) d.quartile = 'Q2';
        else if (percentile <= 0.75) d.quartile = 'Q3';
        else d.quartile = 'Q4';
    });

    initFilters(data);
    renderDashboard();
    renderPodium(data.slice(0, 3));
    renderCopcTable(data);
}

function normalizePercent(val) {
    if (val <= 1) return val * 100;
    return val;
}

function initFilters(data) {
    const sel = document.getElementById('execFilter');
    const currentVal = sel.value;
    sel.innerHTML = '<option value="all">Mostrar Todos</option>';

    // Sort alphabetically for dropdown
    const names = data.map(d => d.name).sort();
    names.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n;
        opt.innerText = n;
        sel.appendChild(opt);
    });
    sel.value = currentVal; // Maintain selection if possible
}

// RENDERING
function renderDashboard() {
    const grid = document.getElementById('dashboardGrid');
    const filterVal = document.getElementById('execFilter').value;
    grid.innerHTML = ''; // Clear

    let filtered = currentData;
    if (filterVal !== 'all') {
        filtered = currentData.filter(d => d.name === filterVal);
    }

    filtered.forEach(d => {
        const card = document.createElement('div');
        let modifier = '';
        if (d.quartile === 'Q1' || d.quartile === 'Q2') modifier = 'kpi-ok';
        else if (d.quartile === 'Q3') modifier = 'kpi-warning';
        else if (d.quartile === 'Q4') modifier = 'kpi-bad';

        card.className = `kpi-card ${modifier}`;
        card.innerHTML = `
            <div class="card-header">
                <div class="exec-name">${d.name}</div>
                <div class="quartile-badge ${d.quartile.toLowerCase()}">${d.quartile}</div>
            </div>
            <div class="kpi-grid">
                ${renderKpiItem('Satisfacción SNL', d.satSnl, GOALS.satSnl, true)}
                ${renderKpiItem('Resolución SNL', d.resSnl, GOALS.resSnl, true)}
                ${renderKpiItem('Satisfacción EP', d.satEp, GOALS.satEp, true)}
                ${renderKpiItem('Resolución EP', d.resEp, GOALS.resEp, true)}
                <div class="kpi-item" style="grid-column: span 2;">
                    <span class="kpi-label">TMO (Min)</span>
                    <span class="kpi-value">${d.tmo}</span>
                    <div class="semaphore ${getTmoColor(d.tmo)}"></div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderKpiItem(label, val, target, isHigherBetter) {
    const colorClass = getSemaphoreColor(val, target, isHigherBetter);
    return `
        <div class="kpi-item">
            <span class="kpi-label">${label}</span>
            <span class="kpi-value">${val.toFixed(1)}%</span>
            <div class="semaphore ${colorClass}"></div>
        </div>
    `;
}

function getSemaphoreColor(val, target, isHigherBetter) {
    // Heuristic: If within 5% of target => Yellow, else Red
    if (isHigherBetter) {
        if (val >= target) return 'sem-green';
        if (val >= target - 5) return 'sem-yellow';
        return 'sem-red';
    } else {
        // Lower is better (unused in standard function, handled specifically for TMO usually)
        if (val <= target) return 'sem-green';
        return 'sem-red';
    }
}

function getTmoColor(val) {
    if (val <= 5) return 'sem-green';
    if (val <= 6) return 'sem-yellow';
    return 'sem-red';
}

function renderPodium(top3) {
    const container = document.getElementById('podiumContainer');
    container.innerHTML = '';

    if (top3.length < 3) return; // Need at least 3

    // Order: 2nd, 1st, 3rd for visual Podium
    const order = [top3[1], top3[0], top3[2]];
    const places = [2, 1, 3];

    order.forEach((d, idx) => {
        const place = places[idx];
        const div = document.createElement('div');
        div.className = `podium-place place-${place}`;
        div.innerHTML = `
            <div class="podium-avatar">Q${d.quartile.replace('Q', '')}</div>
            <div class="podium-bar">
                <div>
                  <div style="font-size:0.8rem; margin-bottom:5px;">${d.score.toFixed(1)}%</div>
                  ${place}º
                </div>
            </div>
            <div class="podium-name">${d.name}</div>
        `;
        container.appendChild(div);
    });
}

function renderCopcTable(data) {
    const container = document.getElementById('copcTableContainer');
    let html = `
        <table>
            <thead>
                <tr>
                    <th>Ejecutivo</th>
                    <th>Cuartil</th>
                    <th>Score General</th>
                    <th>Estado</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.forEach(d => {
        html += `
            <tr>
                <td>${d.name}</td>
                <td><span class="quartile-badge ${d.quartile.toLowerCase()}">${d.quartile}</span></td>
                <td>${d.score.toFixed(2)}%</td>
                <td>${d.quartile === 'Q4' ? 'Crítico ⚠️' : 'Normal'}</td>
            </tr>
        `;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

// ACTIONS (New)
function openDatabase() {
    // Allow user to set or update the SHEET_ID used by the app
    const input = prompt('Pega la URL completa o el ID de la planilla de Google Sheets (Cancel para abrir la actual):');
    if (input === null) {
        // Open current sheet
        window.open(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`, '_blank');
        return;
    }

    const newId = parseSheetIdFromUrl(input.trim());
    if (!newId) {
        alert('No se pudo extraer un ID válido. Pega la URL completa o solo el ID.');
        return;
    }

    SHEET_ID = newId;
    localStorage.setItem('SHEET_ID', SHEET_ID);
    alert('SHEET_ID guardado. Intentando cargar datos...');
    // Try to fetch data immediately to validate
    fetchData(currentMonth).then(() => {
        window.open(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`, '_blank');
    }).catch(() => {
        // fetchData shows errors; still open sheet for user to check permissions
        window.open(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`, '_blank');
    });
}

function parseSheetIdFromUrl(text) {
    // If user pasted the full URL, extract the /d/<ID>/ segment
    try {
        // If it's just an ID (alphanumeric and - _), accept it
        if (/^[a-zA-Z0-9-_]{20,}$/.test(text)) return text;
        const m = text.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (m && m[1]) return m[1];
        // Also accept /spreadsheets/d/ pattern
        const m2 = text.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (m2 && m2[1]) return m2[1];
        return null;
    } catch (e) { return null; }
}

    // Actualiza la visualización del valor objetivo para la KPI seleccionada
    function updateKpiDisplay(key) {
        const el = document.getElementById('kpiValueDisplay');
        if (!el) return;
        const val = metas[key];
        if (val === undefined) {
            el.innerText = '--';
            return;
        }

        // Formateo: TMO en minutos, resto en porcentaje
        if (key === 'tmo') el.innerText = `${val} min`;
        else el.innerText = `${val}%`;
    }

async function refreshData() {
    console.log('Iniciando actualización forzada...');
    // Show Full Screen Overlay
    const overlay = document.getElementById('refreshOverlay');
    overlay.classList.add('active');

    // Add artificial delay to show the user something is happening (UX)
    await new Promise(resolve => setTimeout(resolve, 800));

    // Force fetch
    await fetchData();

    // Hide Overlay
    overlay.classList.remove('active');
}

// UI HELPERS
function showLoading(bool) {
    const p = document.getElementById('podiumContainer');
    if (bool) {
        if (p) p.innerHTML = '<div class="loader"></div>';
    }
}

function toggleCopcModal() {
    document.getElementById('copcModal').classList.toggle('active');
}

// Placeholders for Requested Features
function generateTeamsReport() {
    // Construct Payload
    const reportData = {
        title: "Reporte Operacional ACHS - " + currentMonth,
        date: new Date().toISOString(),
        summary: `Total Ejecutivos: ${currentData.length}`,
        topPerformers: currentData.slice(0, 3).map(d => d.name),
        criticalCases: currentData.filter(d => d.quartile === 'Q4').map(d => d.name)
    };

    console.log("Generando Payload para Teams Webhook:", reportData);
    alert('Reporte generado en consola (F12). Listo para enviar a Webhook:\n' + JSON.stringify(reportData, null, 2));

    // Example Fetch to Webhook (Commented out)
    // fetch('YOUR_TEAMS_WEBHOOK_URL', {
    //     method: 'POST',
    //     body: JSON.stringify(reportData)
    // });
}

async function showEvolutionary() {
    // Mostrar evolución del KPI seleccionado usando datos ya cargados (currentData)
    const kpiRaw = document.getElementById('selectKPI') ? document.getElementById('selectKPI').value : 'tmo';
    const kpi = resolveKpiKey(kpiRaw);
    const execSel = document.getElementById('execFilter') ? document.getElementById('execFilter').value : 'TODOS';

    // Render en modal (tabla en #evolTable y gráfico en canvas #evolChart)
    const modal = document.getElementById('evolModal');
    const tableContainer = document.getElementById('evolTable');
    const canvas = document.getElementById('evolChart');
    if (!modal || !tableContainer || !canvas) {
        alert('Modal evolutivo no disponible.');
        return;
    }

    // Mostrar ejecutivo seleccionado en el header del modal
    try {
        const execSelectVal = document.getElementById('execFilter') ? document.getElementById('execFilter').value : 'all';
        const execDisplay = (execSelectVal === 'all' || execSelectVal === 'TODOS') ? 'Todos' : execSelectVal;
        const headerEl = modal.querySelector('.modal-header');
        if (headerEl) {
            let lbl = headerEl.querySelector('#evolExecLabel');
            if (!lbl) {
                lbl = document.createElement('div');
                lbl.id = 'evolExecLabel';
                lbl.style.fontSize = '0.9rem';
                lbl.style.color = 'var(--text-secondary)';
                lbl.style.marginTop = '6px';
                headerEl.appendChild(lbl);
            }
            lbl.innerText = `Ejecutivo: ${execDisplay}`;
        }
    } catch (e) { /* non-blocking */ }

    // Poblar selects internos del modal (si existen) y sincronizar con global execFilter
    const evolExecSel = document.getElementById('evolExecSelect');
    const evolKpiSel = document.getElementById('evolKpiSelect');
        let evolExecListener = null;
        let evolKpiListener = null;
    if (evolExecSel) {
        const names = Array.from(new Set(currentData.map(d => d.name).filter(Boolean))).sort();
        evolExecSel.innerHTML = '';
        const optAll = document.createElement('option'); optAll.value = 'all'; optAll.innerText = 'Todos'; evolExecSel.appendChild(optAll);
        names.forEach(n => { const o = document.createElement('option'); o.value = n; o.innerText = n; evolExecSel.appendChild(o); });
        // default to global execFilter if present
        try { evolExecSel.value = document.getElementById('execFilter') ? document.getElementById('execFilter').value : 'all'; } catch (e) {}

        // When the evolExecSelect changes, update global execFilter and re-render
            evolExecListener = function() {
            const val = evolExecSel.value === 'all' ? 'all' : evolExecSel.value;
            const globalExec = document.getElementById('execFilter');
            if (globalExec) {
                try {
                    globalExec.value = val;
                    // Trigger change event so other parts react
                    const ev = new Event('change', { bubbles: true });
                    globalExec.dispatchEvent(ev);
                } catch (e) { /* ignore */ }
            }
            // update the evol content immediately
            const kpiLocal = evolKpiSel ? evolKpiSel.value : (document.getElementById('selectKPI') ? document.getElementById('selectKPI').value : kpiRaw);
            updateEvolContent(val === 'all' ? 'TODOS' : val, kpiLocal);
        };
        evolExecSel.addEventListener('change', evolExecListener);
    }
    if (evolKpiSel) {
        // set default from main KPI selector
        try { evolKpiSel.value = document.getElementById('selectKPI') ? document.getElementById('selectKPI').value : kpiRaw; } catch (e) {}
        evolKpiListener = function() {
            const ev = evolExecSel ? evolExecSel.value : (document.getElementById('execFilter') ? document.getElementById('execFilter').value : 'all');
            updateEvolContent(ev === 'all' ? 'TODOS' : ev, evolKpiSel.value);
        };
        evolKpiSel.addEventListener('change', evolKpiListener);
    }

    // Helper to build table and chart so we can re-use when filters change
    function updateEvolContent(execValue, kpiRawValue) {
    const resolvedKpi = resolveKpiKey(kpiRawValue);
    // Use the selected months from the monthFilter (support multi-select)
    const monthSelEl = document.getElementById('monthFilter');
    const selectedMonths = monthSelEl ? Array.from(monthSelEl.selectedOptions).map(o => o.value.toUpperCase()) : MONTHS;
    const labels = selectedMonths.length ? selectedMonths : MONTHS;
    const serieLocal = agruparPorMes(currentData, execValue === 'all' ? 'TODOS' : execValue, resolvedKpi, labels);

        // Construir tabla: si se muestran "Todos" mostramos una columna por ejecutivo con su KPI por mes,
        // si hay un ejecutivo seleccionado mostramos una sola columna con el valor promedio por mes.
        const showingAllExec = (execValue === 'all' || execValue === 'TODOS');

        let tableHtmlLocal = '<table style="width:100%; border-collapse:collapse; margin-bottom:12px;">';
        if (showingAllExec) {
            const execNames = Array.from(new Set(currentData.map(d => d.name).filter(Boolean))).sort();
            tableHtmlLocal += '<thead><tr><th style="text-align:left; padding:6px;">Mes</th>';
            execNames.forEach(n => { tableHtmlLocal += `<th style="text-align:right; padding:6px;">${n}</th>`; });
            tableHtmlLocal += `<th style="text-align:right; padding:6px;">Valor</th>`;
            tableHtmlLocal += '</tr></thead><tbody>';

            labels.forEach((m, idx) => {
                tableHtmlLocal += `<tr><td style="padding:6px;">${m}</td>`;
                execNames.forEach(n => {
                    const rows = currentData.filter(d => (d.name === n) && ((d.mes || '').toString().toUpperCase() === m.toUpperCase()));
                    let val = 0;
                    if (rows.length) {
                        const suma = rows.reduce((acc, r) => acc + (Number(r[resolvedKpi]) || 0), 0);
                        val = +(suma / rows.length).toFixed(2);
                    }
                    tableHtmlLocal += `<td style="padding:6px; text-align:right;">${formatKpiValue(kpiRawValue, val)}</td>`;
                });
                const aggVal = serieLocal[idx] || 0;
                tableHtmlLocal += `<td style="padding:6px; text-align:right; font-weight:700;">${formatKpiValue(kpiRawValue, aggVal)}</td>`;
                tableHtmlLocal += '</tr>';
            });
        } else {
            tableHtmlLocal += '<thead><tr><th style="text-align:left; padding:6px;">Mes</th><th style="text-align:right; padding:6px;">Valor</th></tr></thead><tbody>';
            labels.forEach((m, i) => {
                const v = serieLocal[i] || 0;
                tableHtmlLocal += `<tr><td style="padding:6px;">${m}</td><td style="padding:6px; text-align:right;">${formatKpiValue(kpiRawValue, v)}</td></tr>`;
            });
        }
        tableHtmlLocal += '</tbody></table>';
        tableContainer.innerHTML = tableHtmlLocal;

        // Dibujar gráfico con Chart.js (serie agregada)
        if (window.Chart) {
            const ctxLocal = canvas.getContext('2d');
            if (evolChart) { try { evolChart.destroy(); } catch (e) { /* noop */ } evolChart = null; }
            const isPercent = kpiRawValue !== 'tmo';
            evolChart = new Chart(ctxLocal, {
                type: 'line',
                data: { labels: labels, datasets: [{ label: kpiRawValue, data: serieLocal, borderColor: '#2ecc71', backgroundColor: 'rgba(46,204,113,0.15)', fill: true, tension: 0.3, pointRadius: 4, pointBackgroundColor: function(ctx) { const v = ctx.raw !== undefined ? ctx.raw : (ctx.parsed ? ctx.parsed.y : 0); return cumpleMeta(kpiRawValue, v) ? '#00A859' : '#DC2626'; } }] },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { callback: function(value) { return isPercent ? value + '%' : value + ' min'; } } } }, plugins: { tooltip: { callbacks: { label: function(ctx) { return formatKpiValue(kpiRawValue, ctx.parsed.y); } } } } }
            });
        }
    }

    // Inicial render
    updateEvolContent(execSel, kpiRaw);

    // Hacer reactivo el contenido: cuando cambien filtros fuera del modal, actualizar la vista
    const globalExecSel = document.getElementById('execFilter');
    const globalKpiSel = document.getElementById('selectKPI');
        function onGlobalChange() { updateEvolContent(globalExecSel ? globalExecSel.value : 'all', globalKpiSel ? globalKpiSel.value : kpiRaw); }
    if (globalExecSel) globalExecSel.addEventListener('change', onGlobalChange);
    if (globalKpiSel) globalKpiSel.addEventListener('change', onGlobalChange);

    modal.classList.add('active');

    // Close handler (remove listeners)
    const closeBtn = document.getElementById('closeEvol');
    if (closeBtn) closeBtn.onclick = () => {
        try { if (evolExecSel && evolExecListener) evolExecSel.removeEventListener('change', evolExecListener); } catch (e) {}
        try { if (evolKpiSel && evolKpiListener) evolKpiSel.removeEventListener('change', evolKpiListener); } catch (e) {}
        try { if (globalExecSel) globalExecSel.removeEventListener('change', onGlobalChange); } catch (e) {}
        try { if (globalKpiSel) globalKpiSel.removeEventListener('change', onGlobalChange); } catch (e) {}
        modal.classList.remove('active');
    };
}

// Agrupa datos por mes y promedio para un KPI dado
function agruparPorMes(datos, ejecutivo, kpi, months = MONTHS) {
    return months.map(mes => {
        const filtrados = datos.filter(d => {
            const mesDato = (d.mes || '').toString();
            return mesDato.toUpperCase() === mes.toUpperCase() &&
                (ejecutivo === 'TODOS' || d.name === ejecutivo || d.ejecutivo === ejecutivo);
        });

        if (filtrados.length === 0) return 0;

        const suma = filtrados.reduce((acc, d) => acc + (Number(d[kpi]) || 0), 0);
        return +(suma / filtrados.length).toFixed(2);
    });
}

function formatKpiValue(kpi, v) {
    if (kpi === 'tmo') return `${Number(v).toFixed(1)} min`;
    return `${Number(v).toFixed(1)}%`;
}

function showPredictive() {
    // Open Predictive modal and render cards
    const modal = document.getElementById('predictModal');
    const closeBtn = document.getElementById('closePredict');
    const execSel = document.getElementById('predictExecSelect');
    const kpiSel = document.getElementById('predictKpiSelect');

    if (!modal || !execSel || !kpiSel) {
        alert('Predictivo no disponible (elementos faltantes)');
        return;
    }

    // Fill ejecutivo select from currentData
    const names = Array.from(new Set(currentData.map(d => d.name).filter(Boolean))).sort();
    execSel.innerHTML = '';
    const optAll = document.createElement('option'); optAll.value = 'all'; optAll.innerText = 'Todos'; execSel.appendChild(optAll);
    names.forEach(n => { const o = document.createElement('option'); o.value = n; o.innerText = n; execSel.appendChild(o); });

    // Handlers
    const render = () => {
        const ejecutivo = execSel.value === 'all' ? 'TODOS' : execSel.value;
        const selectedKpi = kpiSel.value;
        renderPredictiveGrid(ejecutivo, selectedKpi);
    };

    execSel.onchange = render;
    kpiSel.onchange = render;

    // Buttons
    document.getElementById('downloadPredictJson').onclick = () => {
        const ejecutivo = execSel.value === 'all' ? 'TODOS' : execSel.value;
        const payload = buildPredictivePayload(ejecutivo, kpiSel.value);
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `predictivo_${ejecutivo}.json`; a.click(); URL.revokeObjectURL(url);
    };

    document.getElementById('sendPredictTeams').onclick = async () => {
        const ejecutivo = execSel.value === 'all' ? 'TODOS' : execSel.value;
        const payload = buildPredictivePayload(ejecutivo, kpiSel.value);
        // Prepare simple text message
        const texto = buildPredictiveMessage(payload, currentMonth, ejecutivo);
        // If user has webhook configured earlier, you can call it here. For now, show preview and copy text to clipboard.
        if (confirm('Previsualizar mensaje para Teams?')) {
            alert(texto);
        }
        try { await navigator.clipboard.writeText(texto); alert('Mensaje copiado al portapapeles. Pega en Teams o configura webhook.'); } catch(e){ /* ignore */ }
    };

    // Initial render
    render();

    modal.classList.add('active');
    if (closeBtn) closeBtn.onclick = () => modal.classList.remove('active');
}

// Build predictive payload (JSON) for export or sending
function buildPredictivePayload(ejecutivo, kpiSelection) {
    const keys = kpiSelection === 'all' ? Object.keys(metas) : [kpiSelection];
    const result = { ejecutivo, month: currentMonth, predictions: {} };
    keys.forEach(k => {
        const key = resolveKpiKey(k);
        const series = agruparPorMes(currentData, ejecutivo, key);
        // Use combined model: linear regression + weighted moving average
        const available = series.filter(v => Number(v) !== 0);
        const lr = linearRegressionPredict(available);
        const wma = weightedMovingAverage(available);
        const estimate = (Number(lr) + Number(wma)) / 2;
        const lastVals = available.slice(-3);
        const last = lastVals.length ? lastVals[lastVals.length - 1] : 0;
        const riskLabel = classifyRisk(estimate, k);
        const cumple = cumpleMeta(k, estimate);
        const slope = linearRegressionSlope(available);
        const trend = slope > thresholdFor(k) ? 'Mejora' : (slope < -thresholdFor(k) ? 'Deterioro' : 'Estable');
        result.predictions[k] = { estimate: Number(estimate), last: Number(last), risk: riskLabel, cumple, trend, slope };
    });
    return result;
}

// Build a readable message for Teams from predictive payload
function buildPredictiveMessage(payload, mes, ejecutivo) {
    let text = `📈 *Predicción Operacional ACHS*\n\n`;
    text += `📅 Mes: ${mes}\n`;
    text += `👤 Ejecutivo: ${ejecutivo}\n\n`;
    Object.keys(payload.predictions).forEach(k => {
        const p = payload.predictions[k];
        const emoji = semaforoEmojiFromRisk(p.risk);
        const cumpleText = p.cumple ? 'Cumple meta' : 'No cumple meta';
        text += `${emoji} *${k.toUpperCase()}*: ${formatPredictNumber(k, p.estimate)} — ${p.risk} (Últ: ${formatPredictNumber(k, p.last)}) — ${cumpleText}\n`;
        if (!p.cumple) text += `⚠️ Acción recomendada: Revisar medidas correctivas para ${k.toUpperCase()}\n`;
    });
    return text;
}

function formatPredictNumber(kpi, v) {
    if (kpi === 'tmo') return `${Number(v).toFixed(1)} min`;
    return `${Number(v).toFixed(1)}%`;

}

// Predictive algorithms
function predictKpi(series, kpiKey) {
    // series: array of numeric monthly averages in MONTHS order
    // Remove months with 0 (no data) from edges while keeping positions: use available data
    const vals = series.map(v => Number(v) || 0);
    const available = vals.map((v, i) => ({ v, i })).filter(x => x.v !== 0);
    if (available.length === 0) return { estimate: 0, trend: '→', risk: 'unknown' };

    // Prepare y array using last up to available values
    const y = available.map(a => a.v);
    const n = y.length;

    // Linear regression predict next (x = n)
    const lr = linearRegressionPredict(y);

    // Weighted moving average (more weight to recent)
    const wma = weightedMovingAverage(y);

    const estimate = (lr + wma) / 2;

    // Trend based on slope of linear model
    const slope = linearRegressionSlope(y);
    const trend = slope > thresholdFor(kpiKey) ? '↑' : (slope < -thresholdFor(kpiKey) ? '↓' : '→');

    // Risk evaluation relative to meta
    const cumple = cumpleMeta(kpiKey, estimate);
    let risk = 'normal';
    if (kpiKey === 'tmo') {
        if (estimate <= metas[kpiKey]) risk = 'low';
        else if (estimate <= metas[kpiKey] + 1) risk = 'medium';
        else risk = 'high';
    } else {
        if (estimate >= metas[kpiKey]) risk = 'low';
        else if (estimate >= metas[kpiKey] - 5) risk = 'medium';
        else risk = 'high';
    }

    return { estimate: Number(estimate), trend, risk, slope };
}

function thresholdFor(kpi) {
    return kpi === 'tmo' ? 0.15 : 0.5; // heuristic thresholds
}

function linearRegressionSlope(y) {
    // x = 0..n-1
    const n = y.length;
    const xs = Array.from({ length: n }, (_, i) => i);
    const meanX = (n - 1) / 2;
    const meanY = y.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - meanX) * (y[i] - meanY); den += (xs[i] - meanX) ** 2; }
    if (den === 0) return 0; return num / den;
}

function linearRegressionPredict(y) {
    const n = y.length;
    if (n === 0) return 0;
    const xs = Array.from({ length: n }, (_, i) => i);
    const meanX = (n - 1) / 2;
    const meanY = y.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - meanX) * (y[i] - meanY); den += (xs[i] - meanX) ** 2; }
    const slope = den === 0 ? 0 : num / den;
    const intercept = meanY - slope * meanX;
    const nextX = n; // predict for next month
    return intercept + slope * nextX;
}

function weightedMovingAverage(y) {
    // weights increasing for recent months
    const n = y.length;
    if (n === 0) return 0;
    let denom = 0, num = 0;
    for (let i = 0; i < n; i++) { const w = i + 1; num += y[i] * w; denom += w; }
    return num / denom;
}

// --- Predictivo simple: SMA-3 y utilidades de riesgo ---
function predictNextBySMA3(series) {
    // series: array aligned with MONTHS, possibly containing 0 for missing
    const vals = series.map(v => Number(v) || 0).filter(v => v !== 0);
    if (vals.length === 0) return 0;
    const last3 = vals.slice(-3);
    const sum = last3.reduce((a, b) => a + b, 0);
    return +(sum / last3.length).toFixed(2);
}

function classifyRisk(estimate, kpiKey) {
    // Returns 'Bajo' | 'Medio' | 'Alto'
    const meta = metas[kpiKey];
    if (meta === undefined) return 'Medio';
    const val = Number(estimate) || 0;
    if (kpiKey === 'tmo') {
        // For TMO use small absolute tolerance (5%)
        if (val <= meta) return 'Bajo';
        if (val <= meta * 1.05) return 'Medio';
        return 'Alto';
    }
    // KPIs porcentuales: Medio if within 5 percentage points below meta
    if (val >= meta) return 'Bajo';
    if (val >= meta - 5) return 'Medio';
    return 'Alto';
}

function semaforoEmojiFromRisk(risk) {
    if (risk === 'Bajo') return '🟢';
    if (risk === 'Medio') return '🟡';
    return '🔴';
}

function riskClassToSemaphore(risk) {
    if (risk === 'Bajo') return 'sem-green';
    if (risk === 'Medio') return 'sem-yellow';
    return 'sem-red';
}

// Render grid of prediction cards
function renderPredictiveGrid(ejecutivo, kpiSelection) {
    const container = document.getElementById('predictGrid');
    if (!container) return;
    container.innerHTML = '';
    const keys = kpiSelection === 'all' ? Object.keys(metas) : [kpiSelection];
    keys.forEach(k => {
        const key = resolveKpiKey(k);
        const series = agruparPorMes(currentData, ejecutivo, key);
        const pred = predictKpi(series, k);
        const estimate = Number(pred.estimate || 0);
        const lastVals = series.filter(v => Number(v) !== 0).slice(-3);
        const last = lastVals.length ? lastVals[lastVals.length - 1] : 0;
        const riskLabel = classifyRisk(estimate, k);
        const cumple = cumpleMeta(k, estimate);

        const card = document.createElement('div'); card.className = 'predict-card ' + (riskLabel === 'Alto' || !cumple ? 'predict-alert' : '');
        const title = document.createElement('h3'); title.innerText = k;
        const rowVal = document.createElement('div'); rowVal.className = 'predict-row';
        const est = document.createElement('div'); est.className = 'predict-value'; est.innerText = formatPredictNumber(k, estimate);
        const meta = document.createElement('div'); meta.className = 'predict-meta'; meta.innerText = `Meta: ${metas[k]}${k==='tmo'?' min':'%'}`;
        rowVal.appendChild(est); rowVal.appendChild(meta);

        const row2 = document.createElement('div'); row2.className = 'predict-row';
        const ind = document.createElement('div'); ind.className = 'predict-indicator ' + riskClassToSemaphore(riskLabel);
        ind.innerText = semaforoEmojiFromRisk(riskLabel);
        const trend = document.createElement('div');
        const trendLabel = pred.trend === '↑' ? 'Mejora' : (pred.trend === '↓' ? 'Deterioro' : 'Estable');
        trend.innerText = `${pred.trend} ${trendLabel} (Últ: ${formatPredictNumber(k, last)})`;
        row2.appendChild(ind); row2.appendChild(trend);

        const rec = document.createElement('div'); rec.className = 'predict-recommendation';
        rec.innerText = recommendAction(k, riskLabel);

        card.appendChild(title); card.appendChild(rowVal); card.appendChild(row2); card.appendChild(rec);
        container.appendChild(card);
    });
}

// Map KPI + riesgo -> recomendación operativa (ACHS style)
function recommendAction(kpi, riesgo) {
    const r = riesgo || 'Medio';
    const actions = {
        tmo: {
            Bajo: 'Mantener monitoreo de tiempos. Revisar scripts y priorización periódica.',
            Medio: 'Reforzar gestión de tiempo, revisar colas y asignación de recursos.',
            Alto: 'Implementar plan de reducción de tiempos: optimizar scripts, redistribuir carga y coaching en manejo de casos.'
        },
        resEP: {
            Bajo: 'Mantener procesos de resolución. Revisar indicadores de soporte.',
            Medio: 'Coaching en cierre de casos y revisión de protocolos operativos.',
            Alto: 'Acción inmediata: revisión de casos abiertos, reasignación y auditoría de procesos.'
        },
        satEP: {
            Bajo: 'Continuar mediciones de calidad y feedback.',
            Medio: 'Realizar sesiones de retroalimentación y escucha de llamadas para mejorar calidad.',
            Alto: 'Plan de mejora: revisar scripts, quality coaching y acciones correctivas focalizadas.'
        },
        resSNL: {
            Bajo: 'Mantener estándares de resolución SNL.',
            Medio: 'Refuerzo operativo y revisión de procedimientos de soporte.' ,
            Alto: 'Auditoría de casos y coaching intensivo en protocolos SNL.'
        },
        satSnl: {
            Bajo: 'Monitoreo de calidad y mantener buenas prácticas.',
            Medio: 'Escucha activa y capacitación en atención para mejorar satisfacción.',
            Alto: 'Acciones de mejora de calidad y sesiones de retroalimentación con equipos.'
        },
        transfEPA: {
            Bajo: 'Mantener criterio de derivación.',
            Medio: 'Reforzar criterios y revisar casos borderline de derivación.',
            Alto: 'Capacitación en criterios EPA y revisión de casos para asegurar correcta transferencia.'
        },
        tipificaciones: {
            Bajo: 'Continuar controles de calidad en registro.',
            Medio: 'Revisión y talleres de tipificación para reducir errores.',
            Alto: 'Plan de capacitación y control de calidad en tipificación inmediata.'
        }
    };

    const k = kpi;
    if (actions[k] && actions[k][r]) return actions[k][r];
    // default generic recommendations
    if (k === 'tmo') return actions.tmo[r];
    return 'Revisar indicador y activar plan de mejora según prioridad.';
}
