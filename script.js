// CONSTANTS
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR26wryBtx5y9A6D2O_IK4KqwMNjoEx2G8mOuttuBa-DubHtRra14S2d44Ruzn42OMQyP-j2REehIHH/pub?output=csv';

// CONFIG (Thresholds)
const GOALS = {
    satSnl: 95,
    resSnl: 90,
    satEp: 95,
    resEp: 90,
    tmo: 5
};

// STATE
let allData = []; // Store fresh CSV data
let currentData = [];
let currentMonth = ''; // Will be set dynamically
let theme = localStorage.getItem('theme') || 'light';

// SETUP
document.addEventListener('DOMContentLoaded', () => {
    applyTheme(theme);
    initEventListeners();
    fetchData();
});

function initEventListeners() {
    // Theme Toggle
    document.getElementById('themeToggle').addEventListener('click', () => {
        theme = theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', theme);
        applyTheme(theme);
    });

    // Filters
    const monthSelect = document.getElementById('monthFilter');
    monthSelect.addEventListener('change', (e) => {
        currentMonth = e.target.value;
        filterDataByMonth();
    });

    document.getElementById('execFilter').addEventListener('change', renderDashboard);
}

function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    const btn = document.getElementById('themeToggle');
    btn.innerHTML = t === 'light' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
}

// FETCHING DATA
async function fetchData() {
    showLoading(true);

    try {
        // Use a CORS proxy to bypass browser restrictions
        const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(CSV_URL);
        console.log('Fetching via Proxy:', proxyUrl);

        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Network response was not ok');

        const text = await response.text();
        console.log('CSV Received (first 100 chars):', text.substring(0, 100));

        // Parse CSV
        const rows = parseCSV(text);

        // Map rows to object structure
        allData = rows.map(row => {
            if (row.length < 9) return null;

            // Handle TMO specifically (Column 2) which might be empty
            let tmoVal = row[2] ? parseNumber(row[2]) : 0;

            return {
                name: row[0],
                mes: row[1] ? row[1].trim().toUpperCase() : '',
                tmo: tmoVal,
                transfEpa: parseNumber(row[3]),
                tipificaciones: parseNumber(row[4]),
                satEp: parseNumber(row[5]),
                resEp: parseNumber(row[6]),
                satSnl: parseNumber(row[7]),
                resSnl: parseNumber(row[8])
            };
        }).filter(d => d && d.name && d.name !== 'Ejecutivo' && d.name !== 'Column1' && d.mes);

        console.log('Data Parsed (All Months):', allData);

        // DYNAMIC MONTHS: Extract unique months from data
        const uniqueMonths = [...new Set(allData.map(d => d.mes))].sort();
        updateMonthFilter(uniqueMonths);

        filterDataByMonth();

    } catch (err) {
        console.error('Fetch failed:', err);
        alert('Error: No se pudo obtener la información. Verifique conexión.');
        useMockData();
    } finally {
        showLoading(false);
    }
}

function updateMonthFilter(months) {
    const sel = document.getElementById('monthFilter');

    if (months.length === 0) return;

    // Clear existing options
    sel.innerHTML = '';

    months.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.innerText = m;
        sel.appendChild(opt);
    });

    // Smart Selection: 
    // If currentMonth is valid, keep it. 
    // Else, select the LAST month (usually most recent in sequential data) or First.
    if (!months.includes(currentMonth)) {
        currentMonth = months[months.length - 1]; // Default to latest
        sel.value = currentMonth;
    } else {
        sel.value = currentMonth;
    }
}

function parseCSV(text) {
    // Simple CSV parser handling quotes and commas
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                cell += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            row.push(cell.trim());
            cell = "";
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (cell || row.length > 0) row.push(cell.trim());
            if (row.length > 0) rows.push(row);
            row = [];
            cell = "";
            if (char === '\r' && nextChar === '\n') i++;
        } else {
            cell += char;
        }
    }
    if (cell || row.length > 0) row.push(cell.trim());
    if (row.length > 0) rows.push(row);

    return rows;
}

function parseNumber(str) {
    if (!str) return 0;
    // Handle "95%" or "0,95" or "0.95"
    let clean = str.replace('%', '').replace(',', '.');
    return parseFloat(clean) || 0;
}

function filterDataByMonth() {
    // Filter allData based on currentMonth
    // Case-insensitive comparison just in case
    currentData = allData.filter(d => d.mes.toUpperCase() === currentMonth.toUpperCase());

    console.log(`Filtered for ${currentMonth}:`, currentData);

    if (currentData.length === 0 && allData.length > 0) {
        // Fallback or Alert if month missing
        console.warn(`No data found for month ${currentMonth}`);
    }

    processData(currentData);
}

function useMockData() {
    // Generate some fake data for demo purposes
    const names = ['Juan Perez', 'Maria Gonzalez', 'Carlos Lopez', 'Ana Silva', 'Pedro Dias', 'Luisa Martinez', 'Jorge Ruiz', 'Sofia Torres', 'Miguel Angel', 'Laura Nuñez', 'David Diaz', 'Carmen Vega', 'Luis Soto', 'Rosa Paz', 'Diego Cid', 'Elena Mar'];
    currentData = names.map(n => ({
        name: n,
        tmo: (4 + Math.random() * 2).toFixed(2), // 4.0 - 6.0
        satSnl: (0.85 + Math.random() * 0.15).toFixed(2),
        resSnl: (0.80 + Math.random() * 0.20).toFixed(2),
        satEp: (0.85 + Math.random() * 0.15).toFixed(2),
        resEp: (0.80 + Math.random() * 0.20).toFixed(2)
    }));
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
        card.className = 'card';
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
    window.open(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`, '_blank');
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
    alert('Cargando histórico anual simulado...');
    // Real implementation would require fetching all tabs:
    // const months = ['OCTUBRE', 'Noviembre', 'Diciembre', 'Enero'];
    // const allData = await Promise.all(months.map(m => fetchData(m))); 
    // And then rendering a table comparing scores.

    // For now, simple alert:
    console.log("Para implementar Evolutivo: Descomentar lógica de fetch múltiple en showEvolutionary()");
}

function showPredictive() {
    // Simple simulation logic
    // Improve projection: Weighted increase for lower performers
    const nextMonthScore = currentData.map(d => {
        const boost = d.score < 80 ? 1.10 : 1.02; // 10% boost for strugglers, 2% for top
        return {
            name: d.name,
            current: d.score,
            projected: Math.min(d.score * boost, 100)
        };
    }).sort((a, b) => b.projected - a.projected);

    let msg = 'Simulación Predictiva (Boost Inteligente):\n\n';
    nextMonthScore.slice(0, 5).forEach((d, i) => {
        msg += `${i + 1}. ${d.name}: ${d.current.toFixed(1)}% -> ${d.projected.toFixed(1)}%\n`;
    });
    alert(msg);
}
