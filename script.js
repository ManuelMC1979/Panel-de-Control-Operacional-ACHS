// CONSTANTS
let SHEET_ID = localStorage.getItem('SHEET_ID') || '1_Dbbjt1TC8pcBPXGbISfuQr8ilsRan21REy51nMw0hg';
// Explicitly defining the months the user wants to access as tabs
const MONTHS = ['OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE', 'ENERO'];

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

// ⚖️ PONDERACIÓN COPC DE KPI
const pesosCOPC = {
    tmo: 0.15,
    satEP: 0.15,
    resEP: 0.20,
    satSNL: 0.15,
    resSNL: 0.15,
    transfEPA: 0.10,
    tipificaciones: 0.10
};

// 🚨 PENALIZACIÓN POR ALERTAS
const penalizacionAlerta = {
    OK: 0,
    advertencia: 5,
    critica: 15
};

// 📊 CATÁLOGO DE MÉTRICAS PARA REPORTES
const metricsCatalog = [
    { id: 'tmo', label: 'TMO', target: metas.tmo, type: 'lower' },
    { id: 'satEP', label: 'Satisfacción EP', target: metas.satEP, type: 'higher' },
    { id: 'resEP', label: 'Resolución EP', target: metas.resEP, type: 'higher' },
    { id: 'satSNL', label: 'Satisfacción SNL', target: metas.satSNL, type: 'higher' },
    { id: 'resSNL', label: 'Resolución SNL', target: metas.resSNL, type: 'higher' },
    { id: 'transfEPA', label: 'Transferencia a EPA', target: metas.transfEPA, type: 'higher' },
    { id: 'tipificaciones', label: 'Tipificaciones', target: metas.tipificaciones, type: 'higher' }
];

// Resuelve la clave del selector a la propiedad real en los datos
function resolveKpiKey(key) {
    const map = {
        todos: 'score',
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

// Helper to match months robustly (handles abbreviations, case, and numeric values)
function matchMonth(dataMonth, targetMonth) {
    if (!dataMonth || !targetMonth) return false;
    const d = dataMonth.toString().trim().toUpperCase();
    const t = targetMonth.toString().trim().toUpperCase();

    // Direct match or abbreviation
    if (d === t) return true;
    if (d.startsWith(t.substring(0, 3))) return true;
    if (t.startsWith(d.substring(0, 3)) && d.length >= 3) return true;

    // Handle Spanish months and year suffixes (e.g., "DIC-23" or "DICIEMBRE 2023")
    const monthsEs = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const idxT = monthsEs.indexOf(t);
    if (idxT !== -1) {
        // Look for the month name inside the data string
        if (d.includes(t)) return true;
        // Check for 3-letter abbreviation
        const abbr = t.substring(0, 3);
        if (d.includes(abbr)) return true;
        // Check for numeric month (1-12)
        const monthNum = (idxT + 1).toString();
        const monthNumZero = monthNum.padStart(2, '0');
        if (d === monthNum || d === monthNumZero) return true;
    }
    return false;
}
// --- CACHE MANAGEMENT ---
function getTodayDate() {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

const SheetCache = {
    get: (month) => {
        try {
            const cache = JSON.parse(localStorage.getItem('sheet_cache') || '{}');
            const entry = cache[month];
            if (entry && entry.date === getTodayDate()) {
                return entry.data;
            }
        } catch (e) { console.error("Cache read error", e); }
        return null;
    },
    set: (month, data) => {
        try {
            const cache = JSON.parse(localStorage.getItem('sheet_cache') || '{}');
            cache[month] = {
                date: getTodayDate(),
                data: data
            };
            localStorage.setItem('sheet_cache', JSON.stringify(cache));
        } catch (e) { console.error("Cache save error", e); }
    }
};

// STATE
let currentData = [];
const getCurrentMonthName = () => {
    const monthsEs = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    return monthsEs[new Date().getMonth()];
};
let currentMonth = MONTHS.includes(getCurrentMonthName()) ? getCurrentMonthName() : 'ENERO';
let theme = localStorage.getItem('theme') || 'light';
let evolChart = null;
let forcedExecutive = null; // To handle race condition in role application

// SETUP
document.addEventListener('DOMContentLoaded', () => {
    applyTheme(theme);
    initEventListeners();
    populateMonthFilter();
    // Iniciar con la carga del mes actual y el historial en paralelo
    simulateInitialLoad();

    const initialKpi = document.getElementById('selectKPI') ? document.getElementById('selectKPI').value : 'tmo';
    updateKpiDisplay(initialKpi);

    // Sync roles after data might have started loading
    const session = JSON.parse(localStorage.getItem('userSession'));
    if (session) {
        aplicarRol(session.rol);
    }
});

// Simula la carga inicial: muestra datos mock inmediatamente y luego intenta cargar la planilla real
async function simulateInitialLoad() {
    // 1. Intentar cargar desde el Caché diario primero
    const cached = SheetCache.get(currentMonth);
    if (cached) {
        console.log(`🚀 Carga inicial desde caché diario para ${currentMonth}`);
        currentData = cached;
        processData(currentData);
        // Saltamos la animación de carga si ya tenemos datos frescos
        return;
    }

    // 2. Si no hay caché, proceder con el flujo normal
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

    // Custom Multi-select for Months
    const monthHeader = document.getElementById('monthHeader');
    const monthOptions = document.getElementById('monthOptions');

    if (monthHeader) {
        monthHeader.onclick = (e) => {
            e.stopPropagation();
            monthOptions.classList.toggle('active');
        };
    }

    // Close dropdown on outside click
    document.addEventListener('click', () => {
        if (monthOptions) monthOptions.classList.remove('active');
    });

    if (monthOptions) {
        monthOptions.onclick = (e) => e.stopPropagation();

        monthOptions.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', async () => {
                updateMonthHeaderText();
                const sel = getSelectedMonths();
                if (sel.length === 0) return;

                currentMonth = sel[0];
                if (sel.length === 1) {
                    await fetchData(currentMonth);
                } else {
                    await fetchMultipleMonths(sel);
                }
            });
        });
    }

    document.getElementById('execFilter').addEventListener('change', renderDashboard);
    // KPI selector listener
    const kpiSel = document.getElementById('selectKPI');
    if (kpiSel) kpiSel.addEventListener('change', (e) => updateKpiDisplay(e.target.value));
}

function getSelectedMonths() {
    const monthOptions = document.getElementById('monthOptions');
    if (!monthOptions) return [currentMonth];
    const checked = Array.from(monthOptions.querySelectorAll('input:checked')).map(cb => cb.value);
    return checked;
}

function updateMonthHeaderText() {
    const sel = getSelectedMonths();
    const textEl = document.getElementById('selectedMonthsText');
    if (!textEl) return;

    if (sel.length === 0) textEl.innerText = 'Seleccionar meses';
    else if (sel.length === 1) textEl.innerText = sel[0];
    else textEl.innerText = `${sel.length} meses seleccionados`;
}

function populateMonthFilter() {
    const container = document.getElementById('monthOptions');
    if (!container) return;

    container.innerHTML = '';
    MONTHS.forEach(m => {
        const label = document.createElement('label');
        const isChecked = m === currentMonth ? 'checked' : '';
        label.innerHTML = `<input type="checkbox" value="${m}" ${isChecked}> ${m.charAt(0) + m.slice(1).toLowerCase()}`;
        container.appendChild(label);
    });

    // Add listeners to new checkboxes
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', async () => {
            updateMonthHeaderText();
            const sel = getSelectedMonths();
            if (sel.length === 0) return;

            currentMonth = sel[0];
            if (sel.length === 1) {
                await fetchData(currentMonth);
            } else {
                await fetchMultipleMonths(sel);
            }
        });
    });

    updateMonthHeaderText();
}

function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    const btn = document.getElementById('themeToggle');
    btn.innerHTML = t === 'light' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
}

// FETCHING DATA
async function fetchData(month, force = false) {
    showLoading(true);
    try {
        const parsed = await fetchSheet(month, force);
        parsed.forEach(d => {
            if (d.mes) d.mes = d.mes.toString().trim().toUpperCase();
            if (d.name) d.name = d.name.toString().trim();
        });
        currentData = parsed;
        console.log(`Data loaded for ${month} (Force: ${force})`, currentData);
        processData(currentData);
    } catch (err) {
        console.error('Fetch failed:', err);
        alert(`No se pudo cargar la pestaña "${month}". Asegúrate de que la hoja exista y se llame exactamente así.`);
    } finally {
        showLoading(false);
    }
}

// Fetch a single sheet and return parsed rows (does not update UI)
async function fetchSheet(month, force = false) {
    if (!month) throw new Error('Month required');

    // Revisar Caché antes de ir a la red (si no es forzado)
    if (!force) {
        const cached = SheetCache.get(month);
        if (cached) {
            console.log(`📦 Usando caché diario para la hoja: ${month}`);
            return cached;
        }
    }

    const tryFetch = async (sheetName) => {
        try {
            const gvizUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
            const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(gvizUrl);
            const response = await fetch(proxyUrl, { cache: 'no-cache' });
            if (!response.ok) return null;
            const text = await response.text();
            const jsonString = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\);/);
            if (jsonString && jsonString[1]) {
                const json = JSON.parse(jsonString[1]);
                if (json.status === 'error') return null;
                return json;
            }
        } catch (e) { return null; }
        return null;
    };

    const variations = [month.toUpperCase(), month.charAt(0).toUpperCase() + month.slice(1).toLowerCase(), month.substring(0, 3).toUpperCase()];
    let json = null;
    for (const name of variations) {
        json = await tryFetch(name);
        if (json) break;
    }
    if (!json) throw new Error(`Hoja "${month}" no encontrada.`);

    const rows = json.table.rows;
    if (!rows || rows.length === 0) return [];

    // --- HEURISTIC COLUMN DETECTION ---
    let colMap = { name: -1, mes: -1, tmo: -1, transfEPA: -1, tipificaciones: -1, satEp: -1, resEp: -1, satSnl: -1, resSnl: -1 };

    // Scan many rows to find the headers
    for (let i = 0; i < Math.min(20, rows.length); i++) {
        const cells = rows[i].c;
        if (!cells) continue;
        cells.forEach((cell, idx) => {
            if (!cell || !cell.v) return;
            const h = cell.v.toString().toUpperCase();
            if ((h.includes('EJECUTIVO') || h.includes('NOMBRE')) && colMap.name === -1) colMap.name = idx;
            else if (h.includes('MES') && colMap.mes === -1) colMap.mes = idx;
            else if (h.includes('TMO') && colMap.tmo === -1) colMap.tmo = idx;
            else if ((h.includes('EPA') || h.includes('TRANSF')) && colMap.transfEPA === -1) colMap.transfEPA = idx;
            else if (h.includes('TIPI') && colMap.tipificaciones === -1) colMap.tipificaciones = idx;
            else if (h.includes('SAT') && h.includes('EP') && colMap.satEp === -1) colMap.satEp = idx;
            else if (h.includes('RES') && h.includes('EP') && colMap.resEp === -1) colMap.resEp = idx;
            else if (h.includes('SAT') && (h.includes('SNL') || h.includes('PROV')) && colMap.satSnl === -1) colMap.satSnl = idx;
            else if (h.includes('RES') && (h.includes('SNL') || h.includes('PROV')) && colMap.resSnl === -1) colMap.resSnl = idx;
        });
    }

    // Default Fallbacks if still not found
    if (colMap.name === -1) colMap.name = 0;
    if (colMap.mes === -1) colMap.mes = 1;
    // Map missing KPIs to sensible defaults if we can't find them
    Object.keys(colMap).forEach((key, idx) => { if (colMap[key] === -1) colMap[key] = idx; });

    console.log(`Detected Columns for ${month}:`, colMap);

    const parsed = rows.map(r => {
        const c = r.c;
        if (!c) return null;

        const getStr = (idx) => (c[idx] ? (c[idx].f || c[idx].v || "").toString().trim() : "");
        const getNum = (idx) => {
            if (!c[idx] || c[idx].v === null || c[idx].v === undefined) return 0;
            let val = c[idx].v;
            // Handle scientific notation and different decimal separators
            if (typeof val === 'string') {
                val = val.replace(/[^\d,.E+-]/g, '').replace(',', '.').trim();
                if (val === '') return 0;
            }
            let n = parseFloat(val);
            if (isNaN(n)) return 0;
            // Heuristic: If it's a very small decimal, it's likely a percentage
            if (n > 0 && n <= 1.0) return n * 100;
            return n;
        };

        const name = getStr(colMap.name);
        if (!name || ['TOTAL', 'PROMEDIO', 'EJECUTIVO', 'NOMBRE'].includes(name.toUpperCase()) || name.length < 3) return null;

        return {
            name,
            mes: getStr(colMap.mes) || month,
            tmo: getNum(colMap.tmo),
            transfEPA: getNum(colMap.transfEPA),
            tipificaciones: getNum(colMap.tipificaciones),
            satEp: getNum(colMap.satEp),
            resEp: getNum(colMap.resEp),
            satSnl: getNum(colMap.satSnl),
            resSnl: getNum(colMap.resSnl)
        };
    }).filter(d => d && d.name);

    // Guardar en caché antes de retornar
    SheetCache.set(month, parsed);

    return parsed;
}

// Fetch multiple sheets and merge results
async function fetchMultipleMonths(months, force = false) {
    showLoading(true);
    try {
        const promises = months.map(m => fetchSheet(m, force).catch(err => {
            console.error(`Error loading ${m}:`, err);
            return [];
        }));
        const results = await Promise.all(promises);
        // Merge arrays
        currentData = [].concat(...results);
        // Ensure mes values are normalized to uppercase month names and trimmed
        currentData.forEach(d => { if (d.mes) d.mes = d.mes.toString().trim().toUpperCase(); });
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
    // Tomar nombres reales de la base de datos de usuarios autorizados
    const names = Object.values(USUARIOS_DB)
        .filter(u => u.rol === 'ejecutivo')
        .map(u => u.ejecutivo)
        .slice(0, 8); // Tomar hasta 8 para el demo

    const months = MONTHS.slice(0, 4); // OCTUBRE, NOVIEMBRE, DICIEMBRE, ENERO

    currentData = [];
    names.forEach(n => {
        months.forEach((m) => {
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
    // 1. Calculate Score COPC for each executive
    data.forEach(d => {
        // Normalization to percent
        d.satSnl = normalizePercent(d.satSnl);
        d.resSnl = normalizePercent(d.resSnl);
        d.satEp = normalizePercent(d.satEp);
        d.resEp = normalizePercent(d.resEp);
        d.transfEPA = normalizePercent(d.transfEPA);
        d.tipificaciones = normalizePercent(d.tipificaciones);

        // Map data to the format calcularScoreCOPC expects
        const kpisValues = {
            tmo: d.tmo,
            satEP: d.satEp,
            resEP: d.resEp,
            satSNL: d.satSnl,
            resSNL: d.resSnl,
            transfEPA: d.transfEPA,
            tipificaciones: d.tipificaciones
        };

        // Get individual alerts for this executive to calculate penalties
        const alerts = [];
        Object.keys(metas).forEach(k => {
            const met = metas[k];
            const val = kpisValues[k];
            const isFailing = (k === 'tmo' ? val > met : val < met);
            if (isFailing) {
                const diff = k === 'tmo' ? (val - met) / met : (met - val) / met;
                alerts.push({ nivel: diff > 0.1 ? 'critica' : 'advertencia' });
            }
        });

        // Forzar recalcularScore con mapeo exacto
        const kpisValuesRecalc = {
            tmo: Number(d.tmo) || 0,
            satEP: Number(d.satEp) || 0,
            resEP: Number(d.resEp) || 0,
            satSNL: Number(d.satSnl) || 0,
            resSNL: Number(d.resSnl) || 0,
            transfEPA: Number(d.transfEPA) || 0,
            tipificaciones: Number(d.tipificaciones) || 0
        };

        const scoreCalculado = calcularScoreCOPC(kpisValuesRecalc, alerts);
        d.score = scoreCalculado;
        const classification = clasificarCOPC(d.score);
        d.copcNivel = classification.nivel;
        d.copcColor = classification.color;
    });

    // 2. Sort by COPC Score Descending
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
    updatePodium('todos');
    renderCopcTable(data);
    setTimeout(processIntelligentAlerts, 500);
}

// 📏 NORMALIZACIÓN DEL KPI (0–100)
function normalizarKPI(kpi, valor) {
    const meta = metas[kpi];
    if (!meta) return 0;
    let res;
    if (kpi === "tmo") {
        res = valor === 0 ? 100 : (meta / valor) * 100;
    } else {
        res = (valor / meta) * 100;
    }
    return Math.max(0, Math.min(100, res));
}

// 🧮 CÁLCULO DEL SCORE COPC
function calcularScoreCOPC(datosKPIs, alertas) {
    let score = 0;
    for (let kpi in datosKPIs) {
        if (pesosCOPC[kpi]) {
            const valor = datosKPIs[kpi];
            const normalizado = normalizarKPI(kpi, valor);
            score += normalizado * pesosCOPC[kpi];
        }
    }
    // Penalización por alertas
    alertas.forEach(a => {
        score -= penalizacionAlerta[a.nivel] || 0;
    });
    return Math.max(0, Math.round(score));
}

// 🟢🟡🔴 CLASIFICACIÓN DEL SCORE COPC
function clasificarCOPC(score) {
    if (score >= 90) return { nivel: "ÓPTIMO", color: "green" };
    if (score >= 75) return { nivel: "CONTROL", color: "yellow" };
    return { nivel: "RIESGO", color: "red" };
}

function normalizePercent(val) {
    if (val <= 1 && val > 0) return val * 100;
    return val || 0;
}

function initFilters(data) {
    const sel = document.getElementById('execFilter');
    if (!sel) return;

    // Save current selection or use forcedExecutive from role application
    const session = JSON.parse(localStorage.getItem('userSession'));
    const targetExec = forcedExecutive || (session && session.rol === 'ejecutivo' ? session.ejecutivo : sel.value);

    sel.innerHTML = '<option value="all">Mostrar Todos</option>';

    // Sort alphabetically for dropdown
    const names = Array.from(new Set(data.map(d => d.name).filter(Boolean))).sort();
    names.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n;
        opt.innerText = n;
        sel.appendChild(opt);
    });

    // Attempt to restore selection
    if (targetExec && targetExec !== 'all') {
        const exists = names.includes(targetExec);
        if (exists) {
            sel.value = targetExec;
        } else {
            // Try fuzzy match if exact match fails
            const fuzzyMatch = names.find(n => n.toLowerCase().includes(targetExec.toLowerCase()) || targetExec.toLowerCase().includes(n.toLowerCase()));
            if (fuzzyMatch) sel.value = fuzzyMatch;
        }
    } else {
        sel.value = 'all';
    }

    // If it's an executive, keep it disabled
    if (session && session.rol === 'ejecutivo') {
        sel.disabled = true;
    }
}

// RENDERING
function renderDashboard() {
    const grid = document.getElementById('dashboardGrid');
    const filterEl = document.getElementById('execFilter');
    if (!grid || !filterEl) return;

    const filterVal = filterEl.value;
    const selectedMonths = getSelectedMonths();

    grid.innerHTML = ''; // Clear

    let filtered = [...currentData];

    // Filter by months using the robust matchMonth helper
    if (selectedMonths.length > 0) {
        filtered = filtered.filter(d => {
            return selectedMonths.some(sm => matchMonth(d.mes, sm));
        });
    }

    if (filterVal && filterVal !== 'all') {
        filtered = filtered.filter(d => d.name === filterVal);
    }

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: var(--bg-card); border-radius: 16px; border: 1px dashed var(--border-color);">
                <i class="fas fa-search" style="font-size: 3rem; color: var(--text-secondary); opacity: 0.3; margin-bottom: 1rem;"></i>
                <h3 style="color: var(--text-secondary);">No se encontraron indicadores para los criterios seleccionados</h3>
                <p style="color: var(--text-secondary); font-size: 0.9rem;">Verifica el filtro de meses o ejecutivo.</p>
            </div>
        `;
        renderExecutiveSummary([]); // Clear summary if no data
        return;
    }

    // Render Executive Summary before the grid (pass current and previous filtered data)
    let previousDataFiltered = [];
    if (selectedMonths.length === 1) {
        // Only calculate trends if a single month is selected
        const currentIdx = MONTHS.indexOf(selectedMonths[0]);
        if (currentIdx > 0) {
            const prevMonth = MONTHS[currentIdx - 1];
            previousDataFiltered = currentData.filter(d => matchMonth(d.mes, prevMonth));
            if (filterVal && filterVal !== 'all') {
                previousDataFiltered = previousDataFiltered.filter(d => d.name === filterVal);
            }
        }
    }
    renderExecutiveSummary(filtered, previousDataFiltered);

    filtered.forEach(d => {
        try {
            const card = document.createElement('div');
            let modifier = '';
            if (d.quartile === 'Q1' || d.quartile === 'Q2') modifier = 'kpi-ok';
            else if (d.quartile === 'Q3') modifier = 'kpi-warning';
            else if (d.quartile === 'Q4') modifier = 'kpi-bad';

            const kpisExec = {
                tmo: Number(d.tmo) || 0,
                satEP: Number(d.satEp) || 0,
                resEP: Number(d.resEp) || 0,
                satSNL: Number(d.satSnl) || 0,
                resSNL: Number(d.resSnl) || 0,
                transfEPA: Number(d.transfEPA) || 0,
                tipificaciones: Number(d.tipificaciones) || 0
            };

            const recomendaciones = generarRecomendaciones(kpisExec);
            const hasFails = Object.keys(kpisExec).some(k => !cumpleMeta(k, kpisExec[k]));

            // Auto-registrar en historial
            registrarRecomendaciones(recomendaciones, {
                ejecutivo: d.name,
                mes: d.mes
            });

            // Escape names for JS calls
            const safeName = d.name.replace(/'/g, "\\'");

            card.className = `kpi-card ${modifier}`;
            card.innerHTML = `
                <div class="card-header">
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <div class="exec-name">${d.name}</div>
                            <span style="background: var(--achs-azul); color: white; font-size: 0.65rem; padding: 2px 8px; border-radius: 4px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">${d.mes}</span>
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
                            <i class="fas fa-medal" style="color: ${d.copcColor === 'green' ? '#00A859' : (d.copcColor === 'yellow' ? '#FACC15' : '#DC2626')}"></i> 
                            Score COPC: <strong>${d.score}</strong> (<span>${d.copcNivel}</span>)
                        </div>
                    </div>
                    <div class="quartile-badge ${d.quartile.toLowerCase()}">${d.quartile}</div>
                </div>
                <div class="kpi-grid">
                    ${renderKpiItem('Satisfacción SNL', kpisExec.satSNL, metas.satSNL, true, safeName, 'satSNL', 'fas fa-smile')}
                    ${renderKpiItem('Resolución SNL', kpisExec.resSNL, metas.resSNL, true, safeName, 'resSNL', 'fas fa-check-circle')}
                    ${renderKpiItem('Satisfacción EP', kpisExec.satEP, metas.satEP, true, safeName, 'satEP', 'fas fa-star')}
                    ${renderKpiItem('Resolución EP', kpisExec.resEP, metas.resEP, true, safeName, 'resEP', 'fas fa-clipboard-check')}
                    <div class="kpi-item clickable-kpi" onclick="showEvolutionary('${safeName}', 'tmo')">
                        <span class="kpi-label"><i class="fas fa-clock" style="margin-right: 6px; color: var(--achs-azul-claro);"></i> TMO</span>
                        <span class="kpi-value">${kpisExec.tmo.toFixed(1)}</span>
                        <div class="semaphore ${getTmoColor(kpisExec.tmo)}"></div>
                    </div>
                    <div class="kpi-item" style="background: var(--bg-card); border: 1px dashed var(--border-color);">
                         <span class="kpi-label"><i class="fas fa-chart-pie" style="margin-right: 6px; color: var(--achs-azul-claro);"></i> COPC</span>
                         <span class="kpi-value" style="color: ${d.copcColor === 'green' ? '#00A859' : (d.copcColor === 'yellow' ? '#FACC15' : '#DC2626')}">${d.score}</span>
                    </div>
                </div>
                <!-- Recomendaciones Box -->
                <div class="recomendaciones-box" style="border-left-color: ${hasFails ? '#F9A825' : '#6BBE45'}; display: block !important; position: relative; padding-bottom: 45px;">
                    <h4 style="color: ${hasFails ? '#92400E' : 'var(--achs-verde-oscuro)'};">
                        <i class="fas fa-lightbulb"></i> ${hasFails ? 'Acciones Recomendadas' : 'Estado de Desempeño'}
                    </h4>
                    <ul>
                        ${recomendaciones.map(acc => `<li>${acc}</li>`).join('')}
                    </ul>
                    <button class="btn-1-1" onclick="openOneOnOneModal('${safeName}')" 
                        style="position: absolute; bottom: 10px; right: 10px; font-size: 0.75rem; padding: 4px 10px; background: var(--achs-azul); color: white; border: none; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 5px;"
                        data-rol="jefatura supervisor">
                        <i class="fas fa-comments"></i> Puntos 1:1
                    </button>
                </div>
            `;
            grid.appendChild(card);
        } catch (cardError) {
            console.error("Error rendering card for", d.name, cardError);
        }
    });
}

function renderKpiItem(label, val, target, isHigherBetter, name, kpiKey, iconClass) {
    const colorClass = getSemaphoreColor(val, target, isHigherBetter);
    const iconHtml = iconClass ? `<i class="${iconClass}" style="margin-right: 6px; color: var(--achs-azul-claro);"></i>` : '';
    return `
        <div class="kpi-item clickable-kpi" onclick="showEvolutionary('${name}', '${kpiKey}')">
            <span class="kpi-label">${iconHtml}${label}</span>
            <span class="kpi-value">${val.toFixed(1)}%</span>
            <div class="semaphore ${colorClass}"></div>
        </div>
    `;
}

// Utility to get a short name: "First Name + First Surname"
function getShortName(fullName) {
    if (!fullName) return "---";

    // Si hay una coma (Formato: Apellidos, Nombres)
    if (fullName.includes(',')) {
        const parts = fullName.split(',');
        const apellidos = parts[0].trim().split(' ');
        const nombres = parts[1].trim().split(' ');
        return `${nombres[0]} ${apellidos[0]}`;
    }

    const words = fullName.trim().split(/\s+/);
    if (words.length >= 3) {
        // Heurística para formato ACHS: ApellidoP ApellidoM Nombre1...
        // Retornamos Nombre1 + ApellidoP
        return `${words[2]} ${words[0]}`;
    }

    // Fallback: Mostrar las primeras dos palabras
    return words.slice(0, 2).join(' ');
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

function updatePodium(kpiKey) {
    const top3 = getTopPerformers(currentData, kpiKey);
    renderPodium(top3, kpiKey);
}

function getTopPerformers(data, kpiKey) {
    if (!data || data.length === 0) return [];
    const resolved = resolveKpiKey(kpiKey);
    const sorted = [...data].sort((a, b) => {
        const valA = Number(a[resolved]) || 0;
        const valB = Number(b[resolved]) || 0;
        // For TMO, lower is better. For others (including 'todos'/score), higher is better.
        if (kpiKey === 'tmo') return valA - valB;
        return valB - valA;
    });
    return sorted.slice(0, 3);
}

function renderPodium(top3, kpiKey) {
    const container = document.getElementById('podiumContainer');
    if (!container) return;
    container.innerHTML = '';

    if (top3.length < 3) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">Cargando ranking...</p>';
        return;
    }

    // Order for visual display: [2nd, 1st, 3rd]
    const order = [top3[1], top3[0], top3[2]];
    const places = [2, 1, 3];
    const medals = ['🥈', '🥇', '🥉'];

    order.forEach((d, idx) => {
        if (!d) return;
        const place = places[idx];
        const medal = medals[place - 1]; // places are [2, 1, 3], but medals are [1st, 2nd, 3rd]
        // medal logic: place 2 => medal[1]🥈, place 1 => medal[0]🥇, place 3 => medal[2]🥉
        const placeMedal = place === 1 ? '🥇' : (place === 2 ? '🥈' : '🥉');

        const div = document.createElement('div');
        div.className = `podium-place place-${place}`;

        const resolvedKpi = resolveKpiKey(kpiKey);
        const val = Number(d[resolvedKpi]) || 0;
        const displayVal = kpiKey === 'tmo' ? `${val.toFixed(1)}m` : `${val.toFixed(1)}%`;

        div.innerHTML = `
            <div class="podium-avatar">
                <span style="font-size:1.5rem;">${placeMedal}</span>
            </div>
            <div class="podium-bar">
                <div style="text-align:center;">
                  <div style="font-size:0.9rem; font-weight:800; background:rgba(0,0,0,0.25); color:#ffffff; border-radius:12px; padding:4px 10px; margin-bottom:8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">${displayVal}</div>
                  <div style="font-size:1.2rem;">${place}º</div>
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

    // Update target value text
    const val = metas[key];
    if (val === undefined) {
        el.innerText = '--';
    } else {
        if (key === 'tmo') el.innerText = `${val} min`;
        else el.innerText = `${val}%`;
    }

    // Refresh Ranking/Podium based on new KPI
    updatePodium(key);
}

async function refreshData() {
    console.log('Iniciando actualización forzada...');
    // Show Full Screen Overlay
    const overlay = document.getElementById('refreshOverlay');
    if (overlay) overlay.classList.add('active');

    // Add artificial delay to show the user something is happening (UX)
    await new Promise(resolve => setTimeout(resolve, 800));

    // Force fetch for currently selected months
    const sel = getSelectedMonths();
    if (sel.length > 1) {
        await fetchMultipleMonths(sel, true);
    } else {
        await fetchData(sel[0] || currentMonth, true);
    }

    // Hide Overlay
    if (overlay) overlay.classList.remove('active');
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
// TEAMS REPORT MODAL LOGIC
function generateTeamsReport() {
    const modal = document.getElementById('modalTeams');
    if (!modal) return;
    modal.classList.add('active');
    cargarMetricasModal();
    generarReporteTeamsActual();
}

function cerrarModalTeams() {
    const modal = document.getElementById('modalTeams');
    if (modal) modal.classList.remove('active');
}

function cargarMetricasModal() {
    const cont = document.getElementById("metricSelector");
    if (!cont) return;
    cont.innerHTML = "";

    metricsCatalog.forEach(m => {
        const div = document.createElement('div');
        div.innerHTML = `
            <label style="display:flex; align-items:center; gap:8px; margin-bottom:5px;">
                <input type="checkbox" value="${m.id}" checked onchange="generarReporteTeamsActual()">
                <span style="font-size:0.9rem;">${m.label}</span>
            </label>
        `;
        cont.appendChild(div);
    });
}

function getStatusIcon(value, target, type) {
    if (type === 'higher') {
        if (value >= target) return '🟢';
        if (value >= target - 5) return '🟡';
        return '🔴';
    } else {
        if (value <= target) return '🟢';
        if (value <= target + 1) return '🟡';
        return '🔴';
    }
}

function getShortName(fullName) {
    if (!fullName) return "";
    const parts = fullName.trim().split(' ');
    if (parts.length <= 2) return fullName;
    return `${parts[0]} ${parts[parts.length - 1]}`;
}

function rankExecutivesForTeams(data, metricId, type) {
    // Si no hay métrica o datos, salir
    if (!data || data.length === 0) return { top: [], bottom: [] };

    const resolved = resolveKpiKey(metricId);
    const sorted = [...data].sort((a, b) => {
        const valA = Number(a[resolved]) || 0;
        const valB = Number(b[resolved]) || 0;
        return type === 'higher' ? valB - valA : valA - valB;
    });

    return {
        top: sorted.slice(0, 3),
        bottom: sorted.slice(-3).reverse()
    };
}

// 🧠 LOGICA DE DESVIACIÓN PARA RANKING GLOBAL DEL INFORME
function scoreDesviacion(e, selectedMetrics) {
    let score = 0;
    selectedMetrics.forEach(mId => {
        const meta = metricsCatalog.find(x => x.id === mId);
        if (!meta) return;
        const val = Number(e[resolveKpiKey(mId)]) || 0;
        // Normalizamos desviación: (valor - meta) / meta
        // Para 'higher', queremos (val - meta) positivo. Para 'lower', (meta - val) positivo.
        if (meta.type === 'higher') {
            score += (val - meta.target);
        } else {
            score += (meta.target - val);
        }
    });
    return score;
}

function obtenerTopYBottomGlobal(data, selectedMetrics) {
    if (!data || data.length === 0) return { top: [], bottom: [] };

    const ranked = data.map(e => ({
        ...e,
        globalScore: scoreDesviacion(e, selectedMetrics)
    })).sort((a, b) => b.globalScore - a.globalScore);

    return {
        top: ranked.slice(0, 3),
        bottom: ranked.slice(-3).reverse()
    };
}

// 📋 GENERADOR DE SECCIÓN DE EQUIPO COMPLETO (FORMATO TARJETA)
function generarBloqueEquipo(data, selectedMetrics) {
    let txt = "👥 RENDIMIENTO DEL EQUIPO (RESUMEN)\n\n";

    data.forEach(e => {
        txt += "━━━━━━━━━━━━━━━━━━━━━━\n";
        txt += `👤 ${e.name.toUpperCase()}\n\n`;

        // TMO
        if (selectedMetrics.includes('tmo')) {
            const val = Number(e.tmo) || 0;
            txt += `TMO               ${getStatusIcon(val, metas.tmo, 'lower')} ${val.toFixed(1)}m\n`;
        }

        // Grupo EP
        if (selectedMetrics.includes('satEP') || selectedMetrics.includes('resEP')) {
            const sVal = Number(e.satEp) || 0;
            const rVal = Number(e.resEp) || 0;
            const sIcon = getStatusIcon(sVal, metas.satEP, 'higher');
            txt += `Sat EP / Res EP   ${sIcon} ${sVal.toFixed(1)}% / ${rVal.toFixed(1)}%\n`;
        }

        // Grupo SNL
        if (selectedMetrics.includes('satSNL') || selectedMetrics.includes('resSNL')) {
            const sVal = Number(e.satSnl) || 0;
            const rVal = Number(e.resSnl) || 0;
            const sIcon = getStatusIcon(sVal, metas.satSNL, 'higher');
            txt += `Sat SNL / Res SNL ${sIcon} ${sVal.toFixed(1)}% / ${rVal.toFixed(1)}%\n`;
        }

        // Grupo EPA / Tipif
        if (selectedMetrics.includes('transfEPA') || selectedMetrics.includes('tipificaciones')) {
            const eVal = Number(e.transfEPA) || 0;
            const tVal = Number(e.tipificaciones) || 0;
            const eIcon = getStatusIcon(eVal, metas.transfEPA, 'higher');
            txt += `EPA / Tipif.      ${eIcon} ${eVal.toFixed(1)}% / ${tVal.toFixed(1)}%\n`;
        }

        txt += "━━━━━━━━━━━━━━━━━━━━━━\n\n";
    });
    return txt;
}

function getPerformanceNote(e, selectedMetrics, type, rank) {
    if (type === 'top') {
        const notes = [
            "Consistent performance above all targets",
            "Strong quality and resolution indicators",
            "Stable performance with no deviations",
            "Excellent efficiency and customer focus",
            "Reliable and consistent KPIs"
        ];
        return notes[rank] || notes[0];
    } else {
        // Encontrar el KPI más débil
        let worstKpi = "";
        let worstStatus = "";
        selectedMetrics.forEach(mId => {
            const meta = metricsCatalog.find(x => x.id === mId);
            const val = Number(e[resolveKpiKey(mId)]) || 0;
            const status = getStatusIcon(val, meta.target, meta.type);
            if (status === "🔴") {
                worstKpi = meta.label;
                worstStatus = "deviation";
            } else if (status === "🟡" && !worstKpi) {
                worstKpi = meta.label;
                worstStatus = "below optimal";
            }
        });

        if (worstKpi) return `${worstKpi} ${worstStatus}`;
        return "Performance trend needs monitoring";
    }
}

// 🧠 GENERADOR AUTOMÁTICO DE INFORMACIÓN (INTELIGENCIA)
function generarInsight(data, selectedMetrics) {
    const totalReds = data.reduce((count, e) => {
        const hasRed = selectedMetrics.some(mId => {
            const meta = metricsCatalog.find(x => x.id === mId);
            const val = Number(e[resolveKpiKey(mId)]) || 0;
            return getStatusIcon(val, meta.target, meta.type) === "🔴";
        });
        return count + (hasRed ? 1 : 0);
    }, 0);

    let insight = "━━━━━━━━━━━━━━━━━━━━━━\n";
    if (totalReds === 0) {
        insight += "• Overall performance is stable.\n";
        insight += "• No critical deviations detected in current period.\n";
    } else {
        insight += "• Overall performance is stable.\n";
        insight += `• ${totalReds} executives show critical deviations.\n`;

        // Identificar áreas de riesgo
        const risks = [];
        if (selectedMetrics.includes('tmo') && data.some(e => getStatusIcon(e.tmo, metas.tmo, 'lower') === "🔴")) risks.push("TMO Efficiency");
        if (data.some(e => getStatusIcon(e.satEp, metas.satEP, 'higher') === "🔴")) risks.push("EP Satisfaction");
        if (data.some(e => getStatusIcon(e.transfEPA, metas.transfEPA, 'higher') === "🔴")) risks.push("EPA Transfer");

        if (risks.length > 0) {
            insight += `• Main risk identified: ${risks.join(' and ')}.\n`;
        }
    }

    insight += "• Recommended actions:\n";
    insight += "  - Reinforce scripts\n";
    insight += "  - Adjust workload distribution\n";
    insight += "  - Focused coaching on affected executives\n";
    insight += "━━━━━━━━━━━━━━━━━━━━━━";

    return insight;
}

function renderTeamsPreview(selectedMetrics, data) {
    const cont = document.getElementById("previewResultados");
    if (!cont) return;
    cont.innerHTML = "";

    // 1. Resumen de KPIs
    const header = document.createElement('h5');
    header.innerText = "Resumen de Tendencias Globales";
    header.style.marginBottom = "10px";
    header.style.borderBottom = "1px solid var(--border-color)";
    cont.appendChild(header);

    const currentViewMonths = getSelectedMonths();
    const currentMonthName = currentViewMonths[0] || 'ENERO';
    const prevMonthName = MONTHS[MONTHS.indexOf(currentMonthName) - 1];
    const prevData = prevMonthName ? currentData.filter(d => matchMonth(d.mes, prevMonthName)) : [];

    selectedMetrics.forEach(mId => {
        const meta = metricsCatalog.find(x => x.id === mId);
        const currentAvg = data.reduce((sum, e) => sum + (Number(e[resolveKpiKey(mId)]) || 0), 0) / data.length;
        const unit = mId === 'tmo' ? 'm' : '%';

        let trendIcon = "➖";
        let trendColor = "var(--text-secondary)";

        if (prevData.length > 0) {
            const prevAvg = prevData.reduce((sum, e) => sum + (Number(e[resolveKpiKey(mId)]) || 0), 0) / prevData.length;
            const trend = getTrendInfo(currentAvg, prevAvg, mId);
            trendIcon = trend.symbol;
            if (trend.text === 'Mejorando') trendColor = "var(--achs-verde)";
            else if (trend.text === 'En declive') trendColor = "var(--achs-red)";
        }

        const row = document.createElement('div');
        row.className = "report-row";
        row.style.background = "var(--bg-body)";
        row.innerHTML = `
            <span>${meta.label}</span>
            <span class="badge-modal" style="color: ${trendColor}">${currentAvg.toFixed(1)}${unit} ${trendIcon} ${getStatusIcon(currentAvg, meta.target, meta.type)}</span>
        `;
        cont.appendChild(row);
    });

    // 2. Movers (Simplificado)
    if (prevData.length > 0) {
        const moverHeader = document.createElement('h5');
        moverHeader.innerText = "Top Movers (Deltas)";
        moverHeader.style.marginTop = "15px";
        moverHeader.style.marginBottom = "10px";
        moverHeader.style.borderBottom = "1px solid var(--border-color)";
        cont.appendChild(moverHeader);

        const moverList = data.map(e => {
            const prevE = prevData.find(p => p.name === e.name);
            if (!prevE) return null;
            return { name: getShortName(e.name), delta: scoreDesviacion(e, selectedMetrics) - scoreDesviacion(prevE, selectedMetrics) };
        }).filter(Boolean).sort((a, b) => b.delta - a.delta);

        const top = moverList.slice(0, 1);
        const bottom = moverList.slice(-1);

        top.forEach(m => {
            const div = document.createElement('div');
            div.className = "report-row good";
            div.innerHTML = `<span>🚀 Mejora: ${m.name}</span> <span class="badge-modal">+${m.delta.toFixed(1)} pts</span>`;
            cont.appendChild(div);
        });

        bottom.forEach(m => {
            const div = document.createElement('div');
            div.className = "report-row bad";
            div.innerHTML = `<span>📉 Declive: ${m.name}</span> <span class="badge-modal">${m.delta.toFixed(1)} pts</span>`;
            cont.appendChild(div);
        });
    }
}


function generarReporteTeamsActual() {
    const selected = [...document.querySelectorAll("#metricSelector input:checked")]
        .map(i => i.value);

    // Identificar mes actual y anterior
    const currentViewMonths = getSelectedMonths();
    const currentMonthName = currentViewMonths[0] || 'ENERO';
    const prevMonthName = MONTHS[MONTHS.indexOf(currentMonthName) - 1];

    const data = currentData.filter(d => matchMonth(d.mes, currentMonthName));
    const prevData = prevMonthName ? currentData.filter(d => matchMonth(d.mes, prevMonthName)) : [];

    if (data.length === 0) {
        document.getElementById("teamsMessage").value = "No hay datos para el mes seleccionado.";
        return;
    }

    let msg = `📊 *INFORME DE DESEMPEÑO OPERATIVO – ACHS*\n\n`;
    msg += `📅 Periodo: ${currentMonthName}${prevMonthName ? ' vs ' + prevMonthName : ''}\n\n`;

    // A. RESUMEN DE INDICADORES CLAVE (TENDENCIAS GLOBALES)
    msg += `🔹 RESUMEN DE INDICADORES CLAVE\n`;
    msg += `KPI | Valor | Tendencia | Estado\n`;
    msg += `---|---|---|---\n`;

    selected.forEach(mId => {
        const meta = metricsCatalog.find(x => x.id === mId);
        const currentAvg = data.reduce((sum, e) => sum + (Number(e[resolveKpiKey(mId)]) || 0), 0) / data.length;

        let trendStr = "➖ Estable";
        let trendIcon = "➖";

        if (prevData.length > 0) {
            const prevAvg = prevData.reduce((sum, e) => sum + (Number(e[resolveKpiKey(mId)]) || 0), 0) / prevData.length;
            const trend = getTrendInfo(currentAvg, prevAvg, mId);
            trendStr = trend.text;
            trendIcon = trend.symbol;
        }

        const statusIcon = getStatusIcon(currentAvg, meta.target, meta.type);
        const unit = mId === 'tmo' ? ' min' : '%';
        msg += `${meta.label} | ${currentAvg.toFixed(1)}${unit} | ${trendIcon} ${trendStr} | ${statusIcon}\n`;
    });
    msg += `\n`;

    // B. INSIGHTS SOBRE LAS TENDENCIAS (INTELIGENCIA)
    msg += `🧠 INFORMACIÓN SOBRE TENDENCIAS DEL SISTEMA\n`;
    msg += generarInsightTendencial(data, prevData, selected);
    msg += `\n`;

    // C. MEJORES MOVIMIENTOS (MOVERS)
    if (prevData.length > 0) {
        const moverList = data.map(e => {
            const prevE = prevData.find(p => p.name === e.name);
            if (!prevE) return null;
            const currentScore = scoreDesviacion(e, selected);
            const prevScore = scoreDesviacion(prevE, selected);

            // Buscar el KPI con mayor cambio
            const kpiDeltas = selected.map(mId => {
                const meta = metricsCatalog.find(x => x.id === mId);
                const cVal = Number(e[resolveKpiKey(mId)]) || 0;
                const pVal = Number(prevE[resolveKpiKey(mId)]) || 0;
                const diff = cVal - pVal;
                return { label: meta.label, diff, unit: mId === 'tmo' ? ' min' : '%' };
            }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

            return { name: getShortName(e.name), delta: currentScore - prevScore, bestKpi: kpiDeltas[0] };
        }).filter(Boolean);

        const posMovers = [...moverList].sort((a, b) => b.delta - a.delta).slice(0, 2);
        const negMovers = [...moverList].sort((a, b) => a.delta - b.delta).slice(0, 2);

        msg += `🏆 MEJORES MOVIMIENTOS\n`;
        msg += `🥇 Mejora superior\n`;
        posMovers.forEach(m => {
            const sign = m.bestKpi.diff > 0 ? '+' : '';
            msg += `• ${m.name} – ${sign}${m.bestKpi.diff.toFixed(1)}${m.bestKpi.unit} en ${m.bestKpi.label}\n`;
        });

        msg += `\n🚨 Tendencia negativa\n`;
        negMovers.forEach(m => {
            const sign = m.bestKpi.diff > 0 ? '+' : '';
            msg += `• ${m.name} – ${sign}${m.bestKpi.diff.toFixed(1)}${m.bestKpi.unit} en ${m.bestKpi.label}\n`;
        });
        msg += `\n`;
    }

    // D. RECOMENDACIÓN EJECUTIVA
    msg += `🎯 RECOMENDACIÓN EJECUTIVA\n`;
    msg += generarRecomendacionConsolidada(data, selected);
    msg += `\n\n`;

    // E. PRONÓSTICO DE RIESGO PRÓXIMO MES (PREDICTIVO)
    if (prevData.length > 0) {
        msg += `📈 PRONÓSTICO DE RIESGO PRÓXIMO MES\n`;
        let topRisks = [];
        selected.forEach(mId => {
            const meta = metricsCatalog.find(x => x.id === mId);
            const currentAvg = data.reduce((sum, e) => sum + (Number(e[resolveKpiKey(mId)]) || 0), 0) / data.length;
            const prevAvg = prevData.reduce((sum, e) => sum + (Number(e[resolveKpiKey(mId)]) || 0), 0) / prevData.length;
            const score = calculateRiskScore({ values: [prevAvg, currentAvg], target: meta.target, higherIsBetter: meta.type === 'higher' });
            topRisks.push({ label: meta.label, ...classifyRisk(score) });
        });

        topRisks.sort((a, b) => (a.label === "RIESGO ALTO" ? -1 : 1)).forEach(r => {
            msg += `• ${r.label} → ${r.color} ${r.label}\n`;
        });

        const highRiskKpi = topRisks.find(r => r.label === "RIESGO ALTO");
        if (highRiskKpi) {
            msg += `\n🧠 Insight Predictivo:\nSin acciones correctivas, es probable que ${highRiskKpi.label} caiga por debajo de la meta el próximo mes.`;
        }
    }

    const txtArea = document.getElementById("teamsMessage");
    if (txtArea) txtArea.value = msg;

    renderTeamsPreview(selected, data);
}

function getTrendInfo(current, previous, kpiId) {
    const meta = metricsCatalog.find(m => m.id === kpiId);
    const tolerance = kpiId === 'tmo' ? 0.2 : 1.0;
    const diff = current - previous;

    if (meta.type === 'higher') {
        if (diff > tolerance) return { symbol: '🔼', text: 'Mejorando' };
        if (diff < -tolerance) return { symbol: '🔽', text: 'En declive' };
        return { symbol: '➖', text: 'Estable' };
    } else {
        if (diff < -tolerance) return { symbol: '🔼', text: 'Mejorando' };
        if (diff > tolerance) return { symbol: '🔽', text: 'En declive' };
        return { symbol: '➖', text: 'Estable' };
    }
}

function generarInsightTendencial(data, prevData, selected) {
    let txt = "";
    const momentum = [];
    const watch = [];
    const risk = [];

    selected.forEach(mId => {
        const meta = metricsCatalog.find(x => x.id === mId);
        const currentAvg = data.reduce((sum, e) => sum + (Number(e[resolveKpiKey(mId)]) || 0), 0) / data.length;

        // Alerta de Riesgo (Valores absolutos críticos)
        if (getStatusIcon(currentAvg, meta.target, meta.type) === '🔴') {
            risk.push(`${meta.label} por debajo del umbral crítico.`);
        }

        if (prevData.length > 0) {
            const prevAvg = prevData.reduce((sum, e) => sum + (Number(e[resolveKpiKey(mId)]) || 0), 0) / prevData.length;
            const trend = getTrendInfo(currentAvg, prevAvg, mId);

            if (trend.text === 'Mejorando') {
                momentum.push(`El ${meta.label} mejoró consistentemente.`);
            } else if (trend.text === 'En declive') {
                const diff = (currentAvg - prevAvg).toFixed(1);
                watch.push(`La ${meta.label} disminuyó ligeramente (${diff}%).`);
            }
        }
    });

    txt += `🟢 Impulso positivo\n${momentum.slice(0, 2).map(m => `• ${m}`).join('\n') || '• Tendencias estables en indicadores principales.'}\n\n`;
    txt += `🟡 Zonas de vigilancia\n${watch.slice(0, 2).map(w => `• ${w}`).join('\n') || '• No se detectan debilidades tendenciales significativas.'}\n\n`;
    txt += `🔴 Alerta de riesgo\n${risk.map(r => `• ${r}`).join('\n') || '• No se detectó deterioro crítico de los KPI en este periodo.'}\n`;

    return txt;
}

function generarRecomendacionConsolidada(data, selected) {
    let rec = "";
    const worstKpi = selected.map(mId => {
        const meta = metricsCatalog.find(x => x.id === mId);
        const avg = data.reduce((sum, e) => sum + (Number(e[resolveKpiKey(mId)]) || 0), 0) / data.length;
        const dist = meta.type === 'higher' ? meta.target - avg : avg - meta.target;
        return { label: meta.label, dist };
    }).sort((a, b) => b.dist - a.dist)[0];

    if (worstKpi.dist > 0) {
        rec = `• Centrar la capacitación correctiva en el desempeño de ${worstKpi.label}.\n`;
        rec += `• Reforzar guiones y procesos operativos para revertir desviaciones detectadas.`;
    } else {
        rec = `• Mantener la distribución actual de la carga de trabajo.\n`;
        rec += `• Continuar con el monitoreo preventivo para asegurar la estabilidad del servicio.`;
    }
    return rec;
}


function copiarReporteTeams() {
    const text = document.getElementById("teamsMessage").value;
    if (!text || text.includes("No hay datos")) return;

    navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector('button[onclick="copiarReporteTeams()"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> ¡Copiado!';
        btn.style.background = 'var(--achs-verde)';

        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = '';
        }, 2000);
    });
}

async function showEvolutionary(overrideExec, overrideKpi, force = false) {
    // Si no tenemos datos de todos los meses, intentar cargarlos ahora
    let missingMonths = MONTHS.filter(m => !currentData.some(d => matchMonth(d.mes, m)));

    if (force) {
        missingMonths = [...MONTHS]; // Refrescar todo si es forzado
    }

    if (missingMonths.length > 0) {
        console.log("Meses faltantes o forzados detectados para evolutivo:", missingMonths);

        // ⚡ Optimización: Intentar cargar desde Caché primero para reducir parpadeos
        const monthsToFetch = [];
        missingMonths.forEach(m => {
            const cached = !force ? SheetCache.get(m) : null;
            if (cached) {
                console.log(`📦 Histórico desde caché para ${m}`);
                // Unir al currentData filtrando duplicados (por nombre y mes)
                const existingHash = new Set(currentData.map(d => `${d.name}|${d.mes}`));
                cached.forEach(d => {
                    const key = `${d.name}|${d.mes}`;
                    if (!existingHash.has(key)) {
                        currentData.push(d);
                        existingHash.add(key);
                    }
                });
            } else {
                monthsToFetch.push(m);
            }
        });

        if (monthsToFetch.length > 0) {
            const overlay = document.getElementById('refreshOverlay');
            if (overlay) {
                overlay.classList.add('active');
                const statusEl = overlay.querySelector('p:last-child');
                if (statusEl) statusEl.innerText = `Cargando histórico: ${monthsToFetch.join(', ')}`;
            }
            try {
                const promises = monthsToFetch.map(m => fetchSheet(m, force).catch(() => []));
                const results = await Promise.all(promises);
                const flatResults = [].concat(...results);

                const existingHash = new Set(currentData.map(d => `${d.name}|${d.mes}`));
                flatResults.forEach(d => {
                    const key = `${d.name}|${d.mes}`;
                    if (!existingHash.has(key)) {
                        currentData.push(d);
                        existingHash.add(key);
                    }
                });

                currentData.forEach(d => { if (d.mes) d.mes = d.mes.toString().trim().toUpperCase(); });
                processData(currentData);
            } catch (e) {
                console.error("Error cargando meses para evolutivo:", e);
            } finally {
                if (overlay) overlay.classList.remove('active');
            }
        } else {
            // Si todo estaba en caché, re-procesar para asegurar que cuartiles están al día
            processData(currentData);
        }
    }

    // Mostrar evolución del KPI seleccionado usando datos ya cargados (currentData)
    const kpiRaw = overrideKpi || (document.getElementById('selectKPI') ? document.getElementById('selectKPI').value : 'tmo');
    const execSel = overrideExec || (document.getElementById('execFilter') ? document.getElementById('execFilter').value : 'all');

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
        const execDisplay = (execSel === 'all' || execSel === 'TODOS') ? 'Todos' : execSel;
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

        // Use override if provided, otherwise sync with global filter
        evolExecSel.value = execSel === 'TODOS' ? 'all' : execSel;

        // When the evolExecSelect changes, update global execFilter and re-render
        evolExecListener = function () {
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
            const kpiLocal = evolKpiSel ? evolKpiSel.value : kpiRaw;
            updateEvolContent(val === 'all' ? 'TODOS' : val, kpiLocal);
        };
        evolExecSel.addEventListener('change', evolExecListener);
    }
    if (evolKpiSel) {
        // set from override or main KPI selector
        evolKpiSel.value = kpiRaw === 'todos' ? 'tmo' : kpiRaw;

        evolKpiListener = function () {
            const ev = evolExecSel ? evolExecSel.value : execSel;
            updateEvolContent(ev === 'all' ? 'TODOS' : ev, evolKpiSel.value);
        };
        evolKpiSel.addEventListener('change', evolKpiListener);
    }

    // Helper to build table and chart so we can re-use when filters change
    function updateEvolContent(execValue, kpiRawValue) {
        const resolvedKpi = resolveKpiKey(kpiRawValue);
        // Use the selected months from the monthFilter (support multi-select)
        // If only one month is selected, we still show the full evolution (MONTHS)
        const monthSelEl = document.getElementById('monthFilter');
        const selectedOptions = monthSelEl ? Array.from(monthSelEl.selectedOptions) : [];
        const selectedMonths = selectedOptions.map(o => o.value.trim().toUpperCase());

        // Forzar a que labels sea siempre MONTHS para ver la evolución completa independientemente del filtro externo
        const labels = MONTHS;
        const serieLocal = agruparPorMes(currentData, execValue, resolvedKpi, labels);

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
                    const rows = currentData.filter(d => (d.name === n) && matchMonth(d.mes, m));
                    let val = null;
                    if (rows.length) {
                        const suma = rows.reduce((acc, r) => acc + (Number(r[resolvedKpi]) || 0), 0);
                        val = +(suma / rows.length).toFixed(2);
                    }
                    const displayVal = (val === null) ? '-' : formatKpiValue(kpiRawValue, val);
                    tableHtmlLocal += `<td style="padding:6px; text-align:right;">${displayVal}</td>`;
                });
                const aggVal = serieLocal[idx];
                const displayAgg = (aggVal === null || aggVal === 0 && !currentData.some(d => matchMonth(d.mes, m))) ? '-' : formatKpiValue(kpiRawValue, aggVal);
                tableHtmlLocal += `<td style="padding:6px; text-align:right; font-weight:700;">${displayAgg}</td>`;
                tableHtmlLocal += '</tr>';
            });
        } else {
            tableHtmlLocal += '<thead><tr><th style="text-align:left; padding:6px;">Mes</th><th style="text-align:right; padding:6px;">Valor</th></tr></thead><tbody>';
            labels.forEach((m, idx) => {
                const v = serieLocal[idx];
                const displayVal = (v === null) ? '-' : formatKpiValue(kpiRawValue, v);
                tableHtmlLocal += `<tr><td style="padding:6px;">${m}</td><td style="padding:6px; text-align:right;">${displayVal}</td></tr>`;
            });
        }
        tableHtmlLocal += '</tbody></table>';
        tableContainer.innerHTML = tableHtmlLocal;

        // Dibujar gráfico con Chart.js (serie agregada)
        if (window.Chart) {
            const ctxLocal = canvas.getContext('2d');
            if (evolChart) { try { evolChart.destroy(); } catch (e) { /* noop */ } evolChart = null; }
            const isPercent = kpiRawValue !== 'tmo';

            // Si es porcentaje, forzamos escala a 100 para que no se vea "zoom" en 0
            const yScaleConfig = {
                beginAtZero: true,
                ticks: { callback: function (value) { return isPercent ? value + '%' : value + ' min'; } }
            };
            if (isPercent) {
                yScaleConfig.max = 100;
                yScaleConfig.suggestedMax = 100;
            }

            evolChart = new Chart(ctxLocal, {
                type: 'line',
                data: { labels: labels, datasets: [{ label: kpiRawValue, data: serieLocal, borderColor: '#2ecc71', backgroundColor: 'rgba(46,204,113,0.15)', fill: true, tension: 0.3, pointRadius: 4, pointBackgroundColor: function (ctx) { const v = ctx.raw !== null ? ctx.raw : 0; return cumpleMeta(kpiRawValue, v) ? '#00A859' : '#DC2626'; } }] },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: yScaleConfig }, plugins: { tooltip: { callbacks: { label: function (ctx) { return formatKpiValue(kpiRawValue, ctx.parsed.y); } } } } }
            });
        }
    }

    // Inicial render
    updateEvolContent(execSel === 'all' ? 'TODOS' : execSel, kpiRaw === 'todos' ? 'tmo' : kpiRaw);

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
        try { if (evolExecSel && evolExecListener) evolExecSel.removeEventListener('change', evolExecListener); } catch (e) { }
        try { if (evolKpiSel && evolKpiListener) evolKpiSel.removeEventListener('change', evolKpiListener); } catch (e) { }
        try { if (globalExecSel) globalExecSel.removeEventListener('change', onGlobalChange); } catch (e) { }
        try { if (globalKpiSel) globalKpiSel.removeEventListener('change', onGlobalChange); } catch (e) { }
        try { const lbl = modal.querySelector('#evolExecLabel'); if (lbl && lbl.parentNode) lbl.parentNode.removeChild(lbl); } catch (e) { }
        modal.classList.remove('active');
    };
}

// Agrupa datos por mes y promedio para un KPI dado
function agruparPorMes(datos, ejecutivo, kpi, months = MONTHS) {
    return months.map(mes => {
        const filtrados = datos.filter(d => {
            const matchesName = (ejecutivo === 'all' || ejecutivo === 'TODOS' || d.name === ejecutivo || d.ejecutivo === ejecutivo);
            return matchMonth(d.mes, mes) && matchesName;
        });

        if (filtrados.length === 0) return null;

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
        try { await navigator.clipboard.writeText(texto); alert('Mensaje copiado al portapapeles. Pega en Teams o configura webhook.'); } catch (e) { /* ignore */ }
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
        const meta = document.createElement('div'); meta.className = 'predict-meta'; meta.innerText = `Meta: ${metas[k]}${k === 'tmo' ? ' min' : '%'}`;
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
            Medio: 'Refuerzo operativo y revisión de procedimientos de soporte.',
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

// --- INTELLIGENT RECOMMENDATION ENGINE (ACHS) ---

function generarRecomendaciones(kpis) {
    const acciones = [];
    const {
        tmo,
        satEP,
        resEP,
        satSNL,
        resSNL,
        transfEPA,
        tipificaciones
    } = kpis;

    // 🔴 REGLAS CRUZADAS (INTELIGENCIA REAL)

    // Si el TMO es alto y la Satisfacción es baja, el problema es el tiempo de atención que afecta la percepción
    if (tmo > metas.tmo && satEP < metas.satEP) {
        acciones.push("Reducir carga operativa y reforzar uso de scripts.");
    }

    // Si la resolución es baja y la transferencia es alta, se está derivando sin resolver
    if (resEP < metas.resEP && transfEPA > metas.transfEPA) {
        acciones.push("Reforzar criterio de resolución antes de derivar a EPA.");
    }

    // Si la satisfacción es baja pero el TMO es bueno, el problema es el trato o manejo de expectativas
    if (satSNL < metas.satSNL && tmo <= metas.tmo) {
        acciones.push("Reforzar calidad de atención y manejo de expectativas.");
    }

    // Errores de registro
    if (tipificaciones < metas.tipificaciones) {
        acciones.push("Capacitación inmediata en registro y control de calidad.");
    }

    // Doble falla en calidad/resolución
    if (resEP < metas.resEP && satEP < metas.satEP) {
        acciones.push("Coaching operativo enfocado en cierre efectivo.");
    }

    // 🟢 SIN HALLAZGOS
    if (acciones.length === 0) {
        acciones.push("Desempeño controlado. Mantener estrategia actual.");
    }

    return priorizarRecomendaciones(acciones);
}

// --- PERSONALIZACIÓN POR ROL & ACCESO (RBAC ACHS) ---

const USUARIOS_DB = {
    // Ejecutivos
    "msastudillom@ext.achs.cl": { rol: "ejecutivo", ejecutivo: "Astudillo Marin Manuela Soledad", name: "Manuela Astudillo" },
    "mncastroc@ext.achs.cl": { rol: "ejecutivo", ejecutivo: "Castro Cáceres Marcia Nicole", name: "Marcia Castro" },
    "adchacona@ext.achs.cl": { rol: "ejecutivo", ejecutivo: "Chacón Avilés Alejandra Daniela", name: "Alejandra Chacón" },
    "atgarciav@ext.achs.cl": { rol: "ejecutivo", ejecutivo: "Garcia Velasco Ataly Tatiana", name: "Ataly Garcia" },
    "esgongoraz@ext.achs.cl": { rol: "ejecutivo", ejecutivo: "Góngora Zuleta Elsa Susana", name: "Elsa Góngora" },
    "klhaldt@ext.achs.cl": { rol: "ejecutivo", ejecutivo: "Hald Tello Katia Liza", name: "Katia Hald" },
    "jallancapich@ext.achs.cl": { rol: "ejecutivo", ejecutivo: "Llancapichun Soto Johana Angelica", name: "Johana Llancapichun" },
    "nzmendezp@ext.achs.cl": { rol: "ejecutivo", ejecutivo: "Méndez Pérez Nanci Zobeida", name: "Nanci Méndez" },
    "mamonsalvec@achs.cl": { rol: "ejecutivo", ejecutivo: "Monsalve Corvacho Manuel Alejandro", name: "Manuel Monsalve" },
    "malolivaresg@ext.achs.cl": { rol: "ejecutivo", ejecutivo: "Olivares González Maximiliano Alfonso", name: "Maximiliano Olivares" },
    "eorellanam@ext.achs.cl": { rol: "ejecutivo", ejecutivo: "Orellana Mallea Ema Alejandra", name: "Ema Orellana" },
    "appenailillc@ext.achs.cl": { rol: "ejecutivo", ejecutivo: "Penailillo Cartagena Alejandro Patricio", name: "Alejandro Penailillo" },
    "dprodriguezf@ext.achs.cl": { rol: "ejecutivo", ejecutivo: "Rodriguez Fernandez Daniela Paz", name: "Daniela Rodriguez" },
    "jmrodriguezz@ext.achs.cl": { rol: "ejecutivo", ejecutivo: "Rodríguez Zenteno José Manuel", name: "José Rodríguez" },
    "masalgadot@ext.achs.cl": { rol: "ejecutivo", ejecutivo: "Salgado Tobar Melissa Aracelli", name: "Melissa Salgado" },
    "mlvelasquezp@ext.achs.cl": { rol: "ejecutivo", ejecutivo: "Velasquez Perez María Loreto", name: "María Velasquez" },

    // Jefatura
    "rgberraf@achs.cl": { rol: "jefatura", ejecutivo: null, name: "Renzo Berra" },
    "lsantander@ext.achs.cl": { rol: "jefatura", ejecutivo: null, name: "Luis Santander" },

    // Supervisor
    "lpgarciac@ext.achs.cl": { rol: "supervisor", ejecutivo: null, name: "Luz Garcia" },
    "bvdiaza@ext.achs.cl": { rol: "supervisor", ejecutivo: null, name: "Barbara Diaz" }
};

const PERMISOS = {
    jefatura: {
        verRanking: true,
        enviarTeams: true,
        editarMetas: true,
        cambiarRol: true
    },
    supervisor: {
        verRanking: true,
        enviarTeams: true,
        editarMetas: false,
        cambiarRol: false
    },
    ejecutivo: {
        verRanking: true,
        enviarTeams: false,
        editarMetas: false,
        cambiarRol: false,
        verHistorial: true
    }
};

const SECCIONES_BLOQUEADAS = {
    ejecutivo: [], // Quitamos el bloqueo para que vean sus alertas
    supervisor: [],
    jefatura: []
};

const MENSAJES_ROL = {
    jefatura: "Visión estratégica del desempeño operacional.",
    supervisor: "Gestión activa y control diario de plataforma.",
    ejecutivo: "Tu desempeño actual y acciones de mejora sugeridas."
};

function login() {
    const email = document.getElementById("emailLogin").value.toLowerCase();
    const errorEl = document.getElementById("loginError");
    const user = USUARIOS_DB[email];

    if (!user) {
        if (errorEl) errorEl.style.display = "block";
        return;
    }

    if (errorEl) errorEl.style.display = "none";
    localStorage.setItem("userSession", JSON.stringify(user));

    // Ocultar Overlay
    document.getElementById("loginOverlay").style.display = "none";

    // Configurar UI
    const userNameTxt = document.getElementById("userNameTxt");
    if (userNameTxt) userNameTxt.innerText = user.name;
    document.getElementById("userInfo").style.display = "block";

    aplicarRol(user.rol);
}

function logout() {
    localStorage.removeItem("userSession");
    location.reload();
}

function aplicarRol(rol) {
    console.log(`Aplicando permisos para: ${rol}`);
    const msgEl = document.getElementById("rolMessage");
    if (msgEl) msgEl.innerText = MENSAJES_ROL[rol] || "";

    // 1. Visibilidad básica por data-rol
    document.querySelectorAll("[data-rol]").forEach(el => {
        const allowed = el.getAttribute("data-rol").split(" ");
        if (allowed.includes(rol)) {
            el.style.display = ""; // Reset to default (block/flex/etc)
        } else {
            el.style.display = "none";
        }
    });

    // 2. Control fino de permisos (Bloqueo)
    const p = PERMISOS[rol];
    if (p) {
        // Ejemplo: si no puede ver ranking, bloqueamos el podio
        const podio = document.getElementById("podiumContainer");
        if (podio) {
            if (!p.verRanking) podio.classList.add("bloqueado");
            else podio.classList.remove("bloqueado");
        }

        // Selector manual solo si tiene permiso cambiarRol
        const manualSelector = document.getElementById("manualRoleSelector");
        if (manualSelector) {
            manualSelector.style.display = p.cambiarRol ? "flex" : "none";
        }
    }

    // 3. Aplicar bloqueos específicos
    if (SECCIONES_BLOQUEADAS[rol]) {
        SECCIONES_BLOQUEADAS[rol].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add("bloqueado");
        });
    }

    // 4. Auto-filtro para Ejecutivos (Seguridad)
    const session = JSON.parse(localStorage.getItem('userSession'));
    const execFilter = document.getElementById('execFilter');
    if (rol === 'ejecutivo' && session && session.ejecutivo && execFilter) {
        forcedExecutive = session.ejecutivo; // Save for initFilters
        execFilter.value = session.ejecutivo;
        // Impedir que cambie el filtro
        execFilter.disabled = true;
        execFilter.style.background = "#f1f5f9";
        execFilter.style.color = "#64748b";
    } else if (execFilter) {
        forcedExecutive = null;
        execFilter.disabled = false;
        execFilter.style.background = "";
        execFilter.style.color = "";
    }

    localStorage.setItem('userRole', rol);
    renderDashboard();
}

// Escuchador para Sesión y Cambio de Rol
document.addEventListener('DOMContentLoaded', () => {
    // Verificar sesión activa
    const session = JSON.parse(localStorage.getItem('userSession'));
    const loginOverlay = document.getElementById('loginOverlay');

    if (session) {
        if (loginOverlay) loginOverlay.style.display = "none";
        const userNameTxt = document.getElementById("userNameTxt");
        if (userNameTxt) userNameTxt.innerText = session.name;
        document.getElementById("userInfo").style.display = "block";
        aplicarRol(session.rol);
    } else {
        if (loginOverlay) loginOverlay.style.display = "flex";
    }

    const selector = document.getElementById('rolSelector');
    if (selector) {
        selector.addEventListener('change', (e) => {
            aplicarRol(e.target.value);
        });
    }
});

// --- HISTORIAL DE RECOMENDACIONES (Persistence & Management) ---

let historialRecomendaciones = JSON.parse(localStorage.getItem('historialRecomendaciones')) || [];

function limpiarHistorialHuerfanos() {
    // Nombres prohibidos (Mock persistente)
    const prohibidos = ['Pedro Dias', 'Carlos Lopez', 'Jorge Ruiz', 'Luisa Martinez', 'Juan Perez', 'Maria Gonzalez', 'Ana Silva', 'Sofia Torres'];

    // Definir nombres válidos basados en USUARIOS_DB (nombres largos y cortos para evitar falsos positivos)
    const nombresValidos = new Set(['GLOBAL', 'TODOS']);
    Object.values(USUARIOS_DB).forEach(u => {
        if (u.ejecutivo) nombresValidos.add(u.ejecutivo);
        if (u.name) nombresValidos.add(u.name);
    });

    const inicial = historialRecomendaciones.length;
    historialRecomendaciones = historialRecomendaciones.filter(item => {
        const esProhibido = prohibidos.some(p => item.ejecutivo.includes(p));
        return nombresValidos.has(item.ejecutivo) && !esProhibido;
    });

    if (historialRecomendaciones.length !== inicial) {
        console.log(`Limpieza de historial: Se eliminaron ${inicial - historialRecomendaciones.length} registros no autorizados.`);
        localStorage.setItem('historialRecomendaciones', JSON.stringify(historialRecomendaciones));
    }
}

// Llamar a la limpieza al cargar
limpiarHistorialHuerfanos();

function registrarRecomendaciones(recomendaciones, contexto) {
    if (!recomendaciones || recomendaciones.length === 0) return;

    let added = false;
    recomendaciones.forEach(texto => {
        // Evitar duplicados exactos en estado Pendiente para el mismo ejecutivo y recomendación en el mismo mes
        const exists = historialRecomendaciones.find(h =>
            h.ejecutivo === contexto.ejecutivo &&
            h.mes === contexto.mes &&
            h.recomendacion === texto &&
            h.estado === "Pendiente"
        );

        if (!exists && !texto.includes("Desempeño controlado")) {
            historialRecomendaciones.push({
                fecha: new Date().toLocaleString(),
                ejecutivo: contexto.ejecutivo || "Todos",
                mes: contexto.mes || "Actual",
                recomendacion: texto,
                estado: "Pendiente"
            });
            added = true;
        }
    });

    if (added) {
        localStorage.setItem('historialRecomendaciones', JSON.stringify(historialRecomendaciones));
        renderHistorial();
    }
}

function renderHistorial() {
    const tbody = document.getElementById("tablaHistorial");
    if (!tbody) return;
    tbody.innerHTML = "";

    // Mostrar los más recientes primero
    [...historialRecomendaciones].reverse().forEach((item, originalIdx) => {
        // Encontrar el índice original ya que invertimos la lista para mostrarla
        const idx = historialRecomendaciones.length - 1 - originalIdx;
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${item.fecha}</td>
            <td style="font-weight:700;">${item.ejecutivo}</td>
            <td><span class="status-badge" style="background:#DEE2E6; color:#495057;">${item.mes}</span></td>
            <td>${item.recomendacion}</td>
            <td>
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="checkbox" 
                        class="custom-checkbox"
                        ${item.estado === "Ejecutada" ? "checked" : ""} 
                        onchange="marcarEjecutada(${idx})">
                    <span class="status-badge ${item.estado === "Ejecutada" ? "status-ejecutada" : "status-pendiente"}">
                        ${item.estado}
                    </span>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function marcarEjecutada(index) {
    if (historialRecomendaciones[index]) {
        // Toggle estado
        historialRecomendaciones[index].estado = historialRecomendaciones[index].estado === "Ejecutada" ? "Pendiente" : "Ejecutada";
        localStorage.setItem('historialRecomendaciones', JSON.stringify(historialRecomendaciones));
        renderHistorial();
    }
}

function toggleHistorialModal() {
    const modal = document.getElementById('historialModal');
    if (modal) {
        modal.classList.toggle('active');
        if (modal.classList.contains('active')) renderHistorial();
    }
}

function priorizarRecomendaciones(recomendaciones) {
    const prioridad = {
        "Reducir carga operativa y reforzar uso de scripts.": 1,
        "Coaching operativo enfocado en cierre efectivo.": 2,
        "Reforzar criterio de resolución antes de derivar a EPA.": 3,
        "Capacitación inmediata en registro y control de calidad.": 4,
        "Reforzar calidad de atención y manejo de expectativas.": 5
    };

    return recomendaciones.sort(
        (a, b) => (prioridad[a] || 99) - (prioridad[b] || 99)
    );
}

function processIntelligentAlerts() {
    console.log("Iniciando análisis de Alertas Inteligentes...");
    const banner = document.getElementById('alertsBanner');
    const badge = document.getElementById('alertsCounter');
    if (!banner) return;

    banner.innerHTML = '';
    let alertCount = 0;
    const activeAlerts = [];

    // ANALYZE GLOBAL TRENDS & RISKS
    // We analyze the aggregate performance for each KPI
    Object.keys(metas).forEach(kpiKey => {
        const resolved = resolveKpiKey(kpiKey);
        const series = agruparPorMes(currentData, 'TODOS', resolved);
        const available = series.filter(v => v !== null && v !== 0);

        if (available.length < 1) return;

        const valorActual = available[available.length - 1];
        const pred = predictKpi(series, kpiKey);
        const valorProyectado = pred.estimate;
        const tendencia = pred.trend; // '↑' Mejora, '↓' Deterioro, '→' Estable

        const alerta = evaluateIntelligentAlert(kpiKey, valorActual, valorProyectado, tendencia);

        if (alerta.nivel !== 'OK') {
            activeAlerts.push(alerta);
            renderAlertItem(banner, alerta);
            alertCount++;

            // Registrar Recomendación Global en el Historial
            if (alerta.recomendacion) {
                registrarRecomendaciones([alerta.recomendacion], {
                    ejecutivo: "GLOBAL",
                    mes: "Análisis " + kpiKey.toUpperCase()
                });
            }
        }
    });

    // Handle counter badge
    if (badge) {
        badge.innerText = alertCount;
        badge.style.display = alertCount > 0 ? 'block' : 'none';

        // Add subtle animation if count > 0
        if (alertCount > 0) {
            badge.parentElement.classList.add('pulse');
            setTimeout(() => badge.parentElement.classList.remove('pulse'), 2000);
        }
    }

    if (alertCount === 0) {
        banner.innerHTML = '<div style="text-align:center; padding:12px; color:var(--text-secondary); font-size:0.9rem;">🟢 Todos los KPIs operan dentro de los parámetros normales.</div>';
    }
}

function evaluateIntelligentAlert(kpi, valorActual, valorProyectado, tendencia) {
    const meta = metas[kpi];
    const rec = recommendAction(kpi, valorProyectado < meta ? 'Alto' : 'Medio');

    // 1. CRITICAL: Projected value fails meta
    if (valorProyectado < meta && kpi !== 'tmo' || (kpi === 'tmo' && valorProyectado > meta)) {
        return {
            kpi: kpi.toUpperCase(),
            nivel: "critica",
            icon: "fas fa-exclamation-triangle",
            titulo: `${kpi.toUpperCase()} en Riesgo Crítico`,
            desc: `Proyección (${formatKpiValue(kpi, valorProyectado)}) incumple la meta (${formatKpiValue(kpi, meta)}).`,
            recomendacion: rec
        };
    }

    // 2. WARNING: Negative trend (Deterioro)
    if (tendencia === '↓' && kpi !== 'tmo' || (kpi === 'tmo' && tendencia === '↑')) {
        return {
            kpi: kpi.toUpperCase(),
            nivel: "advertencia",
            icon: "fas fa-chart-line",
            titulo: `Tendencia Negativa en ${kpi.toUpperCase()}`,
            desc: `Se observa un deterioro constante en los últimos meses. Valor actual: ${formatKpiValue(kpi, valorActual)}.`,
            recomendacion: rec
        };
    }

    // 3. INFO: Close to meta
    const margin = kpi === 'tmo' ? 0.5 : 2; // 0.5 min or 2%
    const isClose = kpi === 'tmo'
        ? (valorActual > meta - margin && valorActual <= meta)
        : (valorActual < meta + margin && valorActual >= meta);

    if (isClose) {
        return {
            kpi: kpi.toUpperCase(),
            nivel: "info",
            icon: "fas fa-info-circle",
            titulo: `${kpi.toUpperCase()} en Observación`,
            desc: `El KPI está operando cerca del límite de la meta (${formatKpiValue(kpi, meta)}).`,
            recomendacion: "Mantener monitoreo preventivo."
        };
    }

    return { nivel: "OK" };
}

function renderAlertItem(container, alert) {
    const div = document.createElement('div');
    div.className = `alerta ${alert.nivel}`;
    div.innerHTML = `
        <i class="${alert.icon}"></i>
        <div class="alerta-content">
            <div class="alerta-title">${alert.titulo}</div>
            <div class="alerta-desc">${alert.desc}</div>
            <div style="font-size:0.85rem; margin-top:4px; font-weight:600; opacity:0.8;">💡 Rec: ${alert.recomendacion}</div>
        </div>
    `;
    container.appendChild(div);
}

// --- LOGICA RESUMEN EJECUTIVO (INTELIGENCIA) ---

function calculateSummaryTrend(current, previous) {
    if (previous === 0 || previous === null || previous === undefined) {
        return { icon: "—", class: "flat", delta: "" };
    }

    const diff = current - previous;
    const percent = Math.abs(((diff / previous) * 100)).toFixed(1);

    if (diff > 0) return { icon: "⬆️", class: "up", delta: `+${percent}%` };
    if (diff < 0) return { icon: "⬇️", class: "down", delta: `-${percent}%` };

    return { icon: "➡️", class: "flat", delta: "0%" };
}

function getExecutivesAtRiskCount(data) {
    const metricsToTrack = metricsCatalog.map(m => m.id);
    return data.filter(e => {
        return metricsToTrack.some(mId => {
            const meta = metricsCatalog.find(x => x.id === mId);
            const val = Number(e[resolveKpiKey(mId)]) || 0;
            return getSemaphoreColor(val, meta.target, meta.type === 'higher') === "semaphore-red";
        });
    }).length;
}

function renderExecutiveSummary(data, prevData = []) {
    const summarySection = document.getElementById("executiveSummary");
    if (!summarySection) return;

    if (!data || data.length === 0) {
        summarySection.style.display = "none";
        return;
    }
    summarySection.style.display = "block";

    // 1. Ejecutivos en Riesgo
    const riskCount = getExecutivesAtRiskCount(data);
    const prevRiskCount = prevData.length > 0 ? getExecutivesAtRiskCount(prevData) : null;
    const riskTrend = calculateSummaryTrend(riskCount, prevRiskCount);

    // 2. Desviación Principal
    const metricsToTrack = metricsCatalog.map(m => m.id);
    const getCounter = (dataset) => {
        const counter = {};
        dataset.forEach(e => {
            metricsToTrack.forEach(mId => {
                const meta = metricsCatalog.find(x => x.id === mId);
                const val = Number(e[resolveKpiKey(mId)]) || 0;
                if (getSemaphoreColor(val, meta.target, meta.type === 'higher') === "semaphore-red") {
                    counter[mId] = (counter[mId] || 0) + 1;
                }
            });
        });
        return counter;
    };

    const currentCounter = getCounter(data);
    const mainDevEntry = Object.entries(currentCounter).sort((a, b) => b[1] - a[1])[0];
    const mainDevLabel = mainDevEntry ? metricsCatalog.find(x => x.id === mainDevEntry[0]).label : "Sin desviaciones críticas";

    let devTrend = { icon: "—", class: "flat", delta: "" };
    if (mainDevEntry && prevData.length > 0) {
        const prevCounter = getCounter(prevData);
        const currentVal = currentCounter[mainDevEntry[0]] || 0;
        const prevVal = prevCounter[mainDevEntry[0]] || 0;
        devTrend = calculateSummaryTrend(currentVal, prevVal);
    }

    // 3. Estado General
    const ratio = riskCount / data.length;
    let overallStatus = "🟢 Estable";
    let statusClass = "down"; // Green trend usually means improvement in this context
    if (riskCount > 0) {
        overallStatus = ratio > 0.3 ? "🔴 Crítico" : "🟡 Riesgo Controlado";
    }

    // Overall trend based on risk ratio
    let overallTrend = { icon: "—", class: "flat", delta: "" };
    if (prevData.length > 0) {
        const prevRatio = getExecutivesAtRiskCount(prevData) / prevData.length;
        overallTrend = calculateSummaryTrend(ratio, prevRatio);
        // Invert classes for overall/risk because DOWN is GOOD for risks
        if (overallTrend.class === 'up') overallTrend.label = "Empeorando";
        else if (overallTrend.class === 'down') {
            overallTrend.label = "Mejorando";
            overallTrend.class = "down"; // stay green
        }
    }

    // 4. Acción recomendada
    let recommendation = "Mantener controles operacionales actuales.";
    if (mainDevEntry) {
        const mKey = mainDevEntry[0];
        if (mKey === 'transfEPA') recommendation = "Reforzar criterios de escalamiento y balance de carga.";
        else if (mKey.includes('sat')) recommendation = "Reforzar scripts y sesiones de coaching de calidad.";
        else if (mKey === 'tmo') recommendation = "Revisar complejidad de llamadas y distribución de tiempos.";
        else recommendation = `Focalizar mejora en indicadores de ${mainDevLabel.toLowerCase()}.`;
    }

    // Actualizar UI
    document.getElementById("overallStatus").innerText = overallStatus;
    const overallTrendEl = document.getElementById("overallTrend");
    overallTrendEl.innerHTML = overallTrend.delta ? `${overallTrend.icon} ${overallTrend.label || ''}` : '';
    overallTrendEl.className = `trend ${overallTrend.class}`;

    document.getElementById("riskCount").innerText = `${riskCount} / ${data.length}`;
    const riskTrendEl = document.getElementById("riskTrend");
    riskTrendEl.innerText = riskTrend.delta ? `${riskTrend.icon} ${riskTrend.delta}` : '';
    riskTrendEl.className = `trend ${riskTrend.class}`;

    document.getElementById("mainDeviation").innerText = mainDevLabel;
    const devTrendEl = document.getElementById("deviationTrend");
    devTrendEl.innerText = devTrend.delta ? `${devTrend.icon} ${devTrend.class === 'down' ? 'Reducida' : 'Aumentada'}` : '';
    devTrendEl.className = `trend ${devTrend.class}`;

    document.getElementById("recommendedAction").innerText = recommendation;

    const msgEl = document.getElementById("summaryMessage");
    let narrative = "";
    if (prevData.length > 0) {
        if (overallTrend.class === "down") narrative = "El riesgo operativo está disminuyendo respecto al periodo anterior. ";
        else if (overallTrend.class === "up") narrative = "El riesgo operativo ha aumentado y requiere atención inmediata. ";
        else narrative = "El riesgo operativo se mantiene estable respecto al periodo anterior. ";
    }

    if (riskCount > 0) {
        msgEl.innerHTML = `${narrative}Identificamos <strong>${riskCount} ejecutivo(s)</strong> con desviaciones críticas. 
                           Prioridad: <strong>${mainDevLabel}</strong>.`;
        msgEl.style.background = ratio > 0.3 ? "rgba(220, 38, 38, 0.05)" : "rgba(217, 119, 6, 0.05)";
    } else {
        msgEl.innerHTML = `${narrative}Excelente desempeño general. No se detectan anomalías críticas.`;
        msgEl.style.background = "rgba(5, 150, 105, 0.05)";
    }
}

// --- LÓGICA PREDICTIVA (NEXT MONTH FORECAST) ---

function showPredictive() {
    const modal = document.getElementById('predictModal');
    if (!modal) return;

    modal.classList.add('active');

    // Inicializar filtros del modal
    const execSel = document.getElementById('predictExecSelect');
    const kpiSel = document.getElementById('predictKpiSelect');
    const session = JSON.parse(localStorage.getItem('userSession'));
    const isEjecutivo = session && session.rol === 'ejecutivo';

    if (execSel) {
        if (isEjecutivo) {
            execSel.innerHTML = `<option value="${session.ejecutivo}">${session.ejecutivo}</option>`;
            execSel.value = session.ejecutivo;
            execSel.disabled = true;
        } else {
            const names = Array.from(new Set(currentData.map(d => d.name).filter(Boolean))).sort();
            execSel.innerHTML = '<option value="all">Todo el Equipo</option>';
            names.forEach(n => { const o = document.createElement('option'); o.value = n; o.innerText = n; execSel.appendChild(o); });
            execSel.disabled = false;
        }
    }

    // Cerrar modal
    const closeBtn = document.getElementById('closePredict');
    if (closeBtn) {
        closeBtn.onclick = () => modal.classList.remove('active');
    }

    // Render inicial
    renderPredictiveContent();

    // Listeners
    if (execSel) execSel.onchange = renderPredictiveContent;
    if (kpiSel) kpiSel.onchange = renderPredictiveContent;
}

function renderPredictiveContent() {
    const container = document.getElementById('predictContainer');
    const session = JSON.parse(localStorage.getItem('userSession'));
    const isEjecutivo = session && session.rol === 'ejecutivo';

    let execVal = document.getElementById('predictExecSelect').value;
    const kpiVal = document.getElementById('predictKpiSelect').value;

    if (isEjecutivo) {
        execVal = session.ejecutivo;
    }

    if (!container) return;

    // Si no hay datos históricos suficientes, avisar
    const monthsLoaded = Array.from(new Set(currentData.map(d => d.mes))).length;
    if (monthsLoaded < 2) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px; color:var(--text-secondary);">
                <i class="fas fa-info-circle" style="font-size:2rem; margin-bottom:10px;"></i>
                <p>Se requieren al menos 2 meses de datos cargados para generar predicción.</p>
                <button class="btn btn-primary" onclick="showEvolutionary()" style="margin-top:10px;">Cargar Histórico</button>
            </div>`;
        return;
    }

    let html = `<div style="display:grid; gap:16px;">`;

    // Filtramos métricas a mostrar
    const metricsToShow = kpiVal === 'all' ? metricsCatalog : metricsCatalog.filter(m => m.id === kpiVal);

    metricsToShow.forEach(meta => {
        let riskInfo;
        let trendData = [];

        if (execVal === 'all') {
            // Predicción para el EQUIPO (Promedio)
            MONTHS.forEach(m => {
                const mesData = currentData.filter(d => matchMonth(d.mes, m));
                if (mesData.length > 0) {
                    const avg = mesData.reduce((sum, e) => sum + (Number(e[resolveKpiKey(meta.id)]) || 0), 0) / mesData.length;
                    trendData.push(avg);
                }
            });
        } else {
            // Predicción para EJECUTIVO INDIVIDUAL
            MONTHS.forEach(m => {
                const entry = currentData.find(d => d.name === execVal && matchMonth(d.mes, m));
                if (entry) trendData.push(Number(entry[resolveKpiKey(meta.id)]) || 0);
            });
        }

        const score = calculateRiskScore({ values: trendData, target: meta.target, higherIsBetter: meta.type === 'higher' });
        riskInfo = classifyRisk(score);
        const insight = generatePredictiveInsight(meta.label, riskInfo);

        html += `
            <div class="summary-card" style="margin:0; border-left: 5px solid ${riskInfo.hex};">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h4 style="margin:0; color:var(--achs-azul);">${meta.label}</h4>
                        <p style="font-size:0.85rem; color:var(--text-secondary); margin:4px 0;">Pronóstico próximo periodo</p>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:1.2rem; font-weight:bold; color:${riskInfo.hex};">${riskInfo.color} ${riskInfo.label}</span>
                        <div style="font-size:0.75rem; opacity:0.7;">Score de Riesgo: ${score.toFixed(0)}/100</div>
                    </div>
                </div>
                <div style="margin-top:12px; padding:10px; background:var(--bg-body); border-radius:8px; font-size:0.9rem;">
                    <strong>🧠 Análisis Predictivo:</strong> ${insight}
                </div>
            </div>`;
    });

    html += `</div>`;

    // Si es vista de equipo, añadir el Heatmap al final
    if (execVal === 'all') {
        html += renderRiskHeatmap();
    }

    container.innerHTML = html;
}

function getRiskClass(riskLabel) {
    if (riskLabel === "RIESGO ALTO") return "risk-high";
    if (riskLabel === "RIESGO MEDIO") return "risk-medium";
    return "risk-low";
}

function renderRiskHeatmap() {
    const kpis = metricsCatalog;
    const executives = Array.from(new Set(currentData.map(d => d.name).filter(Boolean))).sort();

    let html = `
        <div class="heatmap-container">
            <h3>📊 Mapa de Riesgo Predictivo – Próximo Mes</h3>
            <div style="overflow-x:auto;">
                <table id="riskHeatmap">
                    <thead>
                        <tr>
                            <th style="text-align:left; position:sticky; left:0; z-index:2; background:var(--bg-body);">Ejecutivo</th>
                            ${kpis.map(kpi => `<th>${kpi.label}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
    `;

    executives.forEach(name => {
        html += `<tr><td style="text-align:left; font-weight:bold; position:sticky; left:0; z-index:1; background:var(--bg-card);">${getShortName(name)}</td>`;

        kpis.forEach(meta => {
            const trendData = [];
            MONTHS.forEach(m => {
                const entry = currentData.find(d => d.name === name && matchMonth(d.mes, m));
                if (entry) trendData.push(Number(entry[resolveKpiKey(meta.id)]) || 0);
            });

            const score = calculateRiskScore({ values: trendData, target: meta.target, higherIsBetter: meta.type === 'higher' });
            const risk = classifyRisk(score);

            // Lógica de Activación de Coaching IA (Reglas de prioridad)
            const currentVal = trendData[trendData.length - 1] || 0;
            const prevVal = trendData[trendData.length - 2] || 0;
            const isDeclining = score > 40 && (meta.type === 'higher' ? currentVal < prevVal : currentVal > prevVal);
            const isResolutionGap = meta.label.includes('Resolución') && currentVal < meta.target;
            const needsPriorityCoaching = isResolutionGap || (isDeclining && risk.label === 'RIESGO ALTO') || (meta.label.includes('Satisfacción') && currentVal < 6.3);

            html += `
                <td class="risk-cell ${getRiskClass(risk.label)}" 
                    onclick="openRecommendation('${name.replace(/'/g, "\\'")}', '${meta.label}', '${risk.label}', ${score.toFixed(0)})"
                    title="${needsPriorityCoaching ? 'Prioridad: Coaching Recomendado' : 'Haga clic para ver recomendación'}">
                    ${risk.color} ${needsPriorityCoaching ? '<span style="font-size:0.7rem; vertical-align:middle;" title="Coaching Sugerido">🤖</span>' : ''}
                </td>
            `;

        });
        html += `</tr>`;
    });

    html += `
                    </tbody>
                </table>
            </div>
            <div style="margin-top:12px; font-size:0.8rem; color:var(--text-secondary); display:flex; gap:15px; justify-content:center;">
                <span>🟢 Bajo Riesgo</span>
                <span>🟡 Vigilancia</span>
                <span>🔴 Intervención</span>
            </div>
        </div>
    `;
    return html;
}


// MATH PREDICTIVE ENGINE
function calculateRiskScore({ values, target, higherIsBetter = true }) {
    if (values.length < 2) return 0;

    const current = values[values.length - 1];
    const prev = values[values.length - 2];
    const trend = current - prev;

    // Distancia al objetivo (Normalizada a 0-50)
    let distance = higherIsBetter ? (target - current) : (current - target);
    let distScore = Math.max(0, Math.min(distance * 5, 50));

    // Factor de Inercia/Tendencia (Normalizada a 0-50)
    let trendScore = 0;
    const isBadTrend = higherIsBetter ? trend < 0 : trend > 0;
    if (isBadTrend) {
        trendScore = Math.min(Math.abs(trend) * 15, 50);
    } else {
        // Si la tendencia es buena, amortiguamos el riesgo de distancia
        distScore *= 0.7;
    }

    return Math.min(distScore + trendScore, 100);
}

function classifyRisk(score) {
    if (score >= 70) return { label: "RIESGO ALTO", color: "🔴", hex: "#dc2626" };
    if (score >= 40) return { label: "RIESGO MEDIO", color: "🟡", hex: "#d97706" };
    return { label: "RIESGO BAJO", color: "🟢", hex: "#059669" };
}

const KPI_BEHAVIOR_MAP = {
    "Satisfacción SNL": "la calidad de comunicación y empatía percibida por el paciente en Salud No Laboral (SNL)",
    "Resolución SNL": "la efectividad y precisión en la respuesta de Salud No Laboral (SNL)",
    "Satisfacción EP": "la confianza y claridad en la guía proporcionada al paciente",
    "Resolución EP": "el empoderamiento y la ejecución correcta del proceso operativo",
    "TMO": "la eficiencia operativa sin sacrificar la calidad del servicio",
    "Transferencia a EPA": "la autonomía y propiedad en la toma de decisiones",
    "Tipificaciones": "la disciplina post-llamada y exactitud del registro"
};

function generatePredictiveInsight(kpiName, risk) {
    if (risk.label === "RIESGO ALTO") return `Se proyecta un deterioro crítico en ${kpiName}. Se recomienda intervención inmediata y plan de acción preventivo.`;
    if (risk.label === "RIESGO MEDIO") return `Posible inestabilidad detectada en ${kpiName}. Los niveles actuales sugieren una probabilidad de no cumplir la meta el próximo mes.`;
    return `${kpiName} muestra una trayectoria saludable y se espera que permanezca estable o mejore en el próximo periodo.`;
}

// 🎯 RECOMENDACIONES PREDICTIVAS
function getRecommendation(kpi, riskLabel) {
    const rules = {
        "Satisfacción EP": {
            "RIESGO ALTO": "Coaching inmediato requerido. Revisar scripts de EP y reducir carga de trabajo temporalmente para asegurar calidad.",
            "RIESGO MEDIO": "Monitorear de cerca. Reforzar mejores prácticas y fomentar mentoría entre pares.",
            "RIESGO BAJO": "Mantener la estrategia actual. Se observa estabilidad."
        },
        "TMO": {
            "RIESGO ALTO": "Analizar flujo de llamadas y reducir pasos innecesarios en la gestión. Sesión de calibración de tiempos.",
            "RIESGO MEDIO": "Revisar distribución de tiempos y reforzar disciplina en la llamada (scripts concisos).",
            "RIESGO BAJO": "Desempeño dentro del rango esperado. Eficiencia operativa óptima."
        },
        "Transferencia a EPA": {
            "RIESGO ALTO": "Re-capacitar en criterios de decisión para transferencias y reforzar la autonomía del ejecutivo.",
            "RIESGO MEDIO": "Revisar patrones de transferencia y casos borderline. Reforzar matriz de escalamiento.",
            "RIESGO BAJO": "El comportamiento de transferencias es estable. Buen criterio de resolución inicial."
        },
        "Resolución EP": {
            "RIESGO ALTO": "Reforzar empoderamiento para cierre de casos en el primer contacto. Revisar herramientas de apoyo.",
            "RIESGO MEDIO": "Auditar llamadas con rellamadas para identificar brechas de resolución rápida.",
            "RIESGO BAJO": "Excelente tasa de resolución. Proyecta estabilidad."
        }
    };

    return rules[kpi]?.[riskLabel] || "Continuar con el monitoreo preventivo y reforzar los puntos clave del KPI en las sesiones de equipo.";
}

function openRecommendation(executive, kpi, riskLabel, score) {
    const modal = document.getElementById("recommendationModal");
    const title = document.getElementById("modalTitle");
    const body = document.getElementById("modalBody");
    const btnAi = document.getElementById("btnGenAICoaching");

    const recommendation = getRecommendation(kpi, riskLabel);

    title.innerHTML = `<i class="fas fa-lightbulb"></i> ${kpi} – ${riskLabel}`;
    body.innerHTML = `
        <div id="recMainContent">
            <div style="background:var(--bg-body); padding:15px; border-radius:8px; margin-bottom:15px; border-left:4px solid ${riskLabel === 'RIESGO ALTO' ? '#dc2626' : (riskLabel === 'RIESGO MEDIO' ? '#d97706' : '#059669')}">
                <strong>👤 Ejecutivo:</strong> ${executive}<br>
                <strong>📊 Score de Riesgo:</strong> ${score}/100<br>
                <strong>🚩 Nivel:</strong> ${riskLabel}
            </div>
            <div style="font-size:1.1rem; color:var(--achs-azul); margin-bottom:10px; font-weight:bold;">
                🚀 Acción Recomendada:
            </div>
            <div style="font-size:0.95rem;">
                ${recommendation}
            </div>
        </div>
        <div id="coachingAiContent" style="display:none;">
            <!-- AI Content here -->
        </div>
    `;

    // Configurar botón de IA
    if (btnAi) {
        btnAi.style.display = "block";
        btnAi.onclick = () => runAICoachingSim(executive, kpi, riskLabel, score);
    }

    // Botón adicional para 1:1 directo desde recomendación
    let btnOneOnOne = modal.querySelector('#btnDirect1a1');
    if (!btnOneOnOne) {
        btnOneOnOne = document.createElement('button');
        btnOneOnOne.id = 'btnDirect1a1';
        btnOneOnOne.className = 'btn btn-secondary';
        btnOneOnOne.style.cssText = 'background: var(--achs-verde); color: white; margin-left: 10px;';
        btnOneOnOne.innerHTML = '<i class="fas fa-comments"></i> Generar 1:1';
        const footer = modal.querySelector('.modal-footer');
        if (footer) footer.insertBefore(btnOneOnOne, footer.firstChild);
    }
    btnOneOnOne.onclick = () => {
        closeRecommendationModal();
        openOneOnOneModal(executive);
    };

    if (modal) modal.classList.add("active");
}

function runAICoachingSim(name, kpi, risk, score) {
    const main = document.getElementById("recMainContent");
    const aiCont = document.getElementById("coachingAiContent");
    const btnAi = document.getElementById("btnGenAICoaching");

    if (!aiCont || !main) return;

    main.style.display = "none";
    if (btnAi) btnAi.style.display = "none";

    aiCont.style.display = "block";
    aiCont.innerHTML = `
        <div style="text-align:center; padding:20px;">
            <i class="fas fa-robot fa-spin" style="font-size:2rem; color:var(--achs-azul); margin-bottom:15px;"></i>
            <p>Generando Plan de Coaching Personalizado vía IA COPC...</p>
        </div>
    `;

    setTimeout(() => {
        const plan = generateAICoachingPlan(name, kpi, risk, score);
        aiCont.innerHTML = plan;
    }, 1500);
}

function generateAICoachingPlan(name, kpi, risk, score) {
    const date = new Date().toLocaleDateString();
    const behavior = KPI_BEHAVIOR_MAP[kpi] || "la conducta operativa general";

    // Lógica de Priorización y Reglas COPC
    let objective = "";
    let observations = [];
    let actions = [];
    let impact = "";

    if (kpi.includes("Resolución")) {
        objective = `Mejorar la propiedad del caso y la resolución al primer contacto en ${kpi}.`;
        observations = [
            `Se detecta una brecha en ${behavior} que impacta directamente en la experiencia final.`,
            `La tendencia indica cierres de llamada sin confirmación de solución efectiva.`
        ];
        actions = [
            `Reforzar el checklist de validación de cierre antes de finalizar la interacción.`,
            `Aplicar técnica de parafraseo para asegurar comprensión total del requerimiento del paciente.`,
            `Analizar 3 casos no resueltos para identificar el punto de quiebre en el proceso.`
        ];
        impact = `Aumento inmediato en la tasa de resolución y reducción de rellamadas.`;
    } else if (kpi.includes("Satisfacción")) {
        objective = `Elevar los estándares de servicio y empatía en las interacciones de ${kpi}.`;
        observations = [
            `El score de riesgo sugiere una desconexión emocional o falta de claridad percibida.`,
            `El paciente evalúa ${behavior} por debajo del umbral de excelencia.`
        ];
        actions = [
            `Utilizar frases de empatía y validación activa durante toda la conversación.`,
            `Ajustar el tono de voz para proyectar seguridad y disposición de ayuda.`,
            `Simular una interacción de alta complejidad enfocada en el manejo de objeciones.`
        ];
        impact = `Mejora en el indicador de satisfacción y fidelización del paciente.`;
    } else if (kpi === "TMO") {
        objective = `Optimizar la eficiencia operativa manteniendo el equilibrio con la calidad.`;
        observations = [
            `Se observa un tiempo de gestión que se desvía de los 5 minutos meta.`,
            `Es necesario equilibrar ${behavior} para no afectar la resolución.`
        ];
        actions = [
            `Identificar y eliminar tiempos muertos durante la búsqueda de información.`,
            `Mejorar la agilidad en el uso de herramientas de soporte y tipificación.`,
            `Practicar el control de la llamada para evitar desviaciones del tema principal.`
        ];
        impact = `Reducción del TMO a niveles de meta sin degradar la resolución o satisfacción.`;
    } else {
        objective = `Reforzar la adherencia a procesos y autonomía en ${kpi}.`;
        observations = [
            `Se detectan inconsistencias en ${behavior}.`,
            `El nivel de riesgo ${risk} exige un ajuste en la disciplina operativa.`
        ];
        actions = [
            `Revisar y aplicar rigurosamente la matriz de toma de decisiones.`,
            `Asegurar la tipificación correcta en Genesys antes de pasar a la siguiente llamada.`,
            `Participar en una sesión de calibración sobre criterios de transferencia.`
        ];
        impact = `Estabilización de los indicadores de proceso y cumplimiento normativo.`;
    }

    return `
        <div class="ai-coaching-plan" style="animation: fadeIn 0.5s ease; color: var(--text-main);">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:15px; padding-bottom:10px; border-bottom:2px solid var(--achs-azul);">
                <i class="fas fa-robot" style="font-size:1.5rem; color:var(--achs-azul);"></i>
                <h3 style="margin:0;">Plan de Coaching Predictivo IA (COPC)</h3>
            </div>
            
            <p style="font-size:0.85rem; color:var(--text-secondary);"><strong>Fecha:</strong> ${date} | <strong>Ejecutivo:</strong> ${name}</p>

            <div style="margin-top:10px;">
                <h4 style="color:var(--achs-azul); margin-bottom:4px; font-size:1rem;">1. Objetivo del Coaching</h4>
                <p style="margin:0; font-size:0.9rem;">${objective}</p>
            </div>

            <div style="margin-top:15px;">
                <h4 style="color:var(--achs-azul); margin-bottom:4px; font-size:1rem;">2. Observaciones Clave</h4>
                <ul style="margin:0; padding-left:20px; font-size:0.9rem;">
                    ${observations.map(obs => `<li>${obs}</li>`).join('')}
                </ul>
            </div>

            <div style="margin-top:15px;">
                <h4 style="color:var(--achs-azul); margin-bottom:4px; font-size:1rem;">3. Acciones Recomendadas</h4>
                <ul style="margin:0; padding-left:20px; font-size:0.9rem;">
                    ${actions.map(act => `<li>${act}</li>`).join('')}
                </ul>
            </div>

            <div style="margin-top:15px;">
                <h4 style="color:var(--achs-azul); margin-bottom:4px; font-size:1rem;">4. Impacto Esperado</h4>
                <p style="margin:0; font-size:0.9rem;">${impact}</p>
            </div>

            <div style="margin-top:15px; padding:12px; background:rgba(0,115,188,0.05); border-radius:8px; border:1px solid rgba(0,115,188,0.1);">
                <p style="margin:0; font-size:0.9rem;"><strong>5. Métrica y Plazo de Seguimiento:</strong> ${kpi} – Revisión semanal por los próximos 15 días.</p>
                <p style="margin:6px 0 0 0; font-size:0.75rem; opacity:0.7; font-style:italic;">Generado siguiendo el Marco de Gestión COPC para servicios de salud.</p>
            </div>
            
            <button class="btn btn-secondary" onclick="restoreRecommendationMain()" style="margin-top:15px; width:100%; border:1px solid var(--border-color); font-weight:600;">
                <i class="fas fa-arrow-left"></i> Volver al Análisis de Riesgo
            </button>
        </div>
    `;
}


// --- LÓGICA DE PUNTOS DE CONVERSACIÓN 1:1 (IA) ---

function openOneOnOneModal(executiveName) {
    const modal = document.getElementById('oneOnOneModal');
    if (!modal) return;

    modal.classList.add('active');
    const loading = document.getElementById('oneOnOneLoading');
    const content = document.getElementById('oneOnOneContent');

    if (loading) loading.style.display = 'block';
    if (content) content.innerHTML = '';

    // Simular retraso de IA
    setTimeout(() => {
        generateOneOnOnePoints(executiveName).then(data => {
            if (loading) loading.style.display = 'none';
            renderOneOnOneContent(data);
        });
    }, 1200);
}

function closeOneOnOneModal() {
    const modal = document.getElementById('oneOnOneModal');
    if (modal) modal.classList.remove('active');
}

async function generateOneOnOnePoints(name) {
    // 1. Gather all required data
    const currentMonthData = currentData.find(d => d.name === name && matchMonth(d.mes, currentMonth));
    const latestData = currentData.filter(d => d.name === name)[0];
    const data = currentMonthData || latestData;

    if (!data) return { error: "No hay datos para este ejecutivo" };

    const kpisValues = {
        tmo: Number(data.tmo) || 0,
        satEP: Number(data.satEp) || 0,
        resEP: Number(data.resEp) || 0,
        satSNL: Number(data.satSnl) || 0,
        resSNL: Number(data.resSnl) || 0,
        transfEPA: Number(data.transfEPA) || 0,
        tipificaciones: Number(data.tipificaciones) || 0
    };

    const riskKPIs = [];
    const positiveKPIs = [];
    Object.keys(metas).forEach(k => {
        if (!cumpleMeta(k, kpisValues[k])) {
            riskKPIs.push(k.toUpperCase());
        } else {
            positiveKPIs.push(k.toUpperCase());
        }
    });

    // 2. Trend analysis (comparing with previous month if possible)
    let trend = "Estable";
    const currentIdx = MONTHS.indexOf(currentMonth);
    if (currentIdx > 0) {
        const prevMonth = MONTHS[currentIdx - 1];
        const prevData = currentData.find(d => d.name === name && matchMonth(d.mes, prevMonth));
        if (prevData) {
            const currentScore = data.score;
            const prevScore = prevData.score;
            if (currentScore > prevScore + 3) trend = "Al alza";
            else if (currentScore < prevScore - 3) trend = "A la baja";
        }
    }

    // 3. Previous actions
    const previousActions = historialRecomendaciones
        .filter(h => h.ejecutivo === name && h.estado === "Ejecutada")
        .slice(-2)
        .map(h => h.recomendacion)
        .join(", ") || "Ninguna registrada recientemente";

    return simulateAIOneOnOne(name, kpisValues, riskKPIs, positiveKPIs, trend, previousActions, data.copcNivel);
}

function simulateAIOneOnOne(name, values, riskKPIs, positiveKPIs, trend, previousActions, riskLevel) {
    const kpiDefinitions = {
        'SATISFACCION SNL': 'calidad de servicio, empatía y claridad en Salud No Laboral',
        'RESOLUCION SNL': 'efectividad y resolución al primer contacto',
        'TMO': 'eficiencia operativa equilibrada con calidad',
        'TRANSFERENCIA A EPA': 'autonomía en la toma de decisiones vs sobre-derivación',
        'TIPIFICACIONES': 'disciplina post-llamada y cumplimiento normativo'
    };

    const mainTopicKey = riskKPIs.length > 0 ? riskKPIs[0] : (positiveKPIs.length > 0 ? positiveKPIs[0] : "DESEMPEÑO GENERAL");
    const definition = kpiDefinitions[mainTopicKey] || "la conducta operativa general";

    const opening = positiveKPIs.length > 0
        ? `Reconocer la consistencia en ${positiveKPIs.slice(0, 2).join(' y ')}. Se observa un manejo profesional que impacta positivamente en la experiencia del paciente y cumple con los estándares de calidad ACHS.`
        : `Valorar el esfuerzo por mantener la continuidad operativa. El compromiso con el servicio es fundamental en nuestra gestión de salud.`;

    const topics = riskKPIs.length > 0
        ? `• Análisis detallado de ${riskKPIs.join(' y ')}, enfocándonos en ${kpiDefinitions[riskKPIs[0]] || 'los comportamientos clave'}.\n• Revisión de tendencias: El desempeño se muestra ${trend.toLowerCase()} en el último periodo.`
        : `• Mantener los niveles de excelencia en los KPIs actuales.\n• Oportunidad de mentoría: Cómo tu manejo de ${mainTopicKey} puede servir de modelo para el equipo.`;

    const questions = riskKPIs.includes('TMO')
        ? `• ¿Qué situaciones específicas en tus llamadas están extendiendo el tiempo de gestión más allá de la meta de 5 minutos?\n• ¿Cómo podemos optimizar el uso de las herramientas de consulta para no sacrificar la calidad por la rapidez?`
        : (riskKPIs.includes('RESOLUCION') || riskKPIs.includes('RESEP') || riskKPIs.includes('RESSNL') ? `• ¿En qué tipo de solicitudes de pacientes sientes que pierdes autonomía y decides derivar a EPA?\n• ¿Qué información o herramienta te haría sentir más seguro para resolver el caso en el primer contacto?` : `• ¿Cómo percibes tu propia evolución en el manejo de casos complejos este mes?\n• ¿Qué barreras operativas has identificado que dificulten tu ${mainTopicKey.toLowerCase()}?`);

    const actions = riskKPIs.length > 0
        ? `• Aplicar el checklist de resolución ACHS antes de cada cierre o transferencia.\n• Sesión de escucha cruzada con un referente del equipo para identificar puntos de decisión en la llamada.`
        : `• Continuar con el monitoreo preventivo y registrar un caso de éxito para el próximo huddle.\n• Liderar una breve cápsula de conocimiento sobre ${mainTopicKey} para el equipo.`;

    return {
        name,
        opening,
        topics,
        questions,
        actions,
        metric: `${mainTopicKey} - Índice de cumplimiento s/ meta`,
        date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString()
    };
}

function renderOneOnOneContent(data) {
    const container = document.getElementById('oneOnOneContent');
    if (!container) return;

    if (data.error) {
        container.innerHTML = `<p style="color: var(--achs-red); text-align: center;">${data.error}</p>`;
        return;
    }

    container.innerHTML = `
        <div style="background: linear-gradient(135deg, var(--achs-azul), var(--achs-azul-claro)); color: white; padding: 18px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="margin: 0; font-size: 1.2rem; font-weight: 700;">Guía 1:1 Inteligente</h3>
                    <p style="margin: 4px 0 0 0; font-size: 0.85rem; opacity: 0.9;">Colaborador: <strong>${data.name}</strong></p>
                </div>
                <i class="fas fa-robot" style="font-size: 2rem; opacity: 0.3;"></i>
            </div>
        </div>
        
        <div class="one-on-one-sections">
            <section style="margin-bottom: 20px; padding: 15px; background: rgba(0,115,188,0.03); border-radius: 8px; border-left: 4px solid var(--achs-verde);">
                <h4 style="color: var(--achs-azul); margin: 0 0 10px 0; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.5px;"><i class="fas fa-certificate" style="margin-right: 8px;"></i> 1. Refuerzo Positivo</h4>
                <p style="margin: 0; font-size: 0.95rem; color: var(--text-main); line-height: 1.5;">${data.opening}</p>
            </section>

            <section style="margin-bottom: 20px; padding: 15px; background: rgba(0,115,188,0.03); border-radius: 8px; border-left: 4px solid var(--achs-azul);">
                <h4 style="color: var(--achs-azul); margin: 0 0 10px 0; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.5px;"><i class="fas fa-list-check" style="margin-right: 8px;"></i> 2. Temas Centrales</h4>
                <div style="margin: 0; font-size: 0.95rem; color: var(--text-main); line-height: 1.5; white-space: pre-line;">${data.topics}</div>
            </section>

            <section style="margin-bottom: 20px; padding: 15px; background: rgba(0,115,188,0.03); border-radius: 8px; border-left: 4px solid var(--achs-azul-claro);">
                <h4 style="color: var(--achs-azul); margin: 0 0 10px 0; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.5px;"><i class="fas fa-comments-question" style="margin-right: 8px;"></i> 3. Preguntas de Coaching</h4>
                <div style="margin: 0; font-size: 0.95rem; color: var(--text-main); line-height: 1.5; white-space: pre-line;">${data.questions}</div>
            </section>

            <section style="margin-bottom: 20px; padding: 15px; background: rgba(0,115,188,0.03); border-radius: 8px; border-left: 4px solid #FACC15;">
                <h4 style="color: var(--achs-azul); margin: 0 0 10px 0; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.5px;"><i class="fas fa-handshake" style="margin-right: 8px;"></i> 4. Acuerdos y Compromisos</h4>
                <div style="margin: 0; font-size: 0.95rem; color: var(--text-main); line-height: 1.5; white-space: pre-line;">${data.actions}</div>
            </section>

            <section style="padding: 15px; background: var(--bg-body); border-radius: 8px; border: 1px dashed var(--border-color);">
                <h4 style="color: var(--achs-azul); margin: 0 0 10px 0; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.5px;"><i class="fas fa-calendar-check" style="margin-right: 8px;"></i> 5. Seguimiento</h4>
                <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);"><strong>Métrica:</strong> ${data.metric}</p>
                <p style="margin: 4px 0 0 0; font-size: 0.9rem; color: var(--text-secondary);"><strong>Fecha Revisión:</strong> ${data.date}</p>
            </section>
        </div>
    `;
}

function exportOneOnOne() {
    const content = document.getElementById('oneOnOneContent').innerText;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Puntos_1a1_${currentMonth}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

function closeOneOnOneModal() {
    document.getElementById('oneOnOneModal').classList.remove('active');
}

function restoreRecommendationMain() {
    document.getElementById("recMainContent").style.display = "block";
    document.getElementById("coachingAiContent").style.display = "none";
    const btnAi = document.getElementById("btnGenAICoaching");
    if (btnAi) btnAi.style.display = "block";
}

function closeRecommendationModal() {
    const modal = document.getElementById("recommendationModal");
    if (modal) modal.classList.remove("active");
}
