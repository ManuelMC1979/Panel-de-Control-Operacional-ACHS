window.apiFetch = async (url, options = {}) => {
    if (!window.API_BASE) throw new Error("API_BASE no definido");
    // Normaliza url relativa o absoluta
    const isApi = (url.startsWith(window.API_BASE) || url.startsWith("/api/"));
    let finalUrl = url;
    if (!url.startsWith("http")) {
        finalUrl = `${window.API_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
    }
    let headers = options.headers || {};
    // Si hay getAuthHeaders y es API, fusionar Authorization
    if (isApi && typeof window.getAuthHeaders === "function") {
        const authHeaders = window.getAuthHeaders();
        // Evitar duplicar Authorization
        if (authHeaders.Authorization && !headers.Authorization) {
            headers = { ...headers, Authorization: authHeaders.Authorization };
        }
    }
    // Siempre mantener Content-Type si ya existe
    if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
    // Asegura credentials: 'omit' salvo que ya venga
    const mergedOptions = { ...options, headers, credentials: options.credentials || 'omit' };
    const resp = await fetch(finalUrl, mergedOptions);
    if ((resp.status === 401 || resp.status === 403)) {
        console.warn(`[apiFetch] Error ${resp.status} en ${finalUrl}`);
    }
    return resp;
};
console.log("[apiFetch] habilitado");
// ============================================
// AUTH GATE: Bloqueo global de llamadas a API si no autenticado
// ============================================
function isAuthenticated() {
    return !!localStorage.getItem('auth_token');
}
// CONSTANTS
// LEGACY: SHEET_ID ya no se usa - datos vienen de FastAPI
// let SHEET_ID = '...'; // REMOVIDO - sin fallback a Google Sheets
const GOOGLE_APPS_SCRIPT_URL = ""; // DESHABILITADO - sin acceso a Google
const API_BASE = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "http://127.0.0.1:8000/api"
    : "https://api.gtrmanuelmonsalve.cl/api";
const GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSceoBX3pg8im7kgdISr4t26EHQA8xQNiARLFtXox1UP3MeLRQ/viewform?usp=publish-editor";
const FORM_FIELDS = {
    email: 'entry.123456789',
    // agregar más campos según el formulario, por ejemplo:
    // nombre: 'entry.987654321',
    // comentario: 'entry.1112131415'
};
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

// Formateadores globales (porcentajes sin decimales, TMO en minutos)
function formatPercent(value) {
    return Math.round(Number(value)) + '%';
}

// Nota: valores por defecto ahora vienen del HTML; no asignar ejemplos desde JS.

function formatTMO(value) {
    return Math.round(Number(value)) + ' min';
}

// === ESTRUCTURA BASE DE LA IA ===
// IA operacional cargada desde ia.js (externo). `ia.js` debe estar incluido antes de `script.js`.

// === SISTEMA UNIFICADO DE MODALES ===
// Manejador global de modales para cerrar con ESC y click fuera
const ModalManager = {
    activeModals: [],
    
    init() {
        // Global ESC key handler
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModals.length > 0) {
                const topModal = this.activeModals[this.activeModals.length - 1];
                if (topModal && topModal.closeFunction) {
                    topModal.closeFunction();
                }
            }
        });
        
        // Setup click-outside for all modal overlays
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    const modalId = overlay.id;
                    const modal = this.activeModals.find(m => m.id === modalId);
                    if (modal && modal.closeFunction) {
                        modal.closeFunction();
                    }
                }
            });
        });
    },
    
    register(modalId, closeFunction) {
        // Remove if exists
        this.activeModals = this.activeModals.filter(m => m.id !== modalId);
        this.activeModals.push({ id: modalId, closeFunction });
    },
    
    unregister(modalId) {
        this.activeModals = this.activeModals.filter(m => m.id !== modalId);
    },
    
    isOpen(modalId) {
        return this.activeModals.some(m => m.id === modalId);
    }
};

// Initialize modal manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    ModalManager.init();
    initMobileNavigation();
});

// ===== MOBILE NAVIGATION =====
function initMobileNavigation() {
    const hamburger = document.getElementById('hamburgerMenu');
    const mobileNav = document.getElementById('mobileNav');
    const mobileOverlay = document.getElementById('mobileNavOverlay');
    
    if (!hamburger || !mobileNav || !mobileOverlay) return;
    
    // Toggle mobile nav on hamburger click
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        mobileNav.classList.toggle('active');
        mobileOverlay.classList.toggle('active');
        document.body.style.overflow = mobileNav.classList.contains('active') ? 'hidden' : '';
    });
    
    // Close on overlay click
    mobileOverlay.addEventListener('click', closeMobileNav);
    
    // Close on ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && mobileNav.classList.contains('active')) {
            closeMobileNav();
        }
    });
}

function closeMobileNav() {
    const hamburger = document.getElementById('hamburgerMenu');
    const mobileNav = document.getElementById('mobileNav');
    const mobileOverlay = document.getElementById('mobileNavOverlay');
    
    if (hamburger) hamburger.classList.remove('active');
    if (mobileNav) mobileNav.classList.remove('active');
    if (mobileOverlay) mobileOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

// updateMobileNavUser y updateMobileNavVisibility movidos a auth.js

// Comparar evolución entre dos registros (actual vs anterior)
function compararEvolucion(actual, anterior) {
    const resultado = { mejoras: [], empeora: [], cambios: {} };
    if (!actual || !anterior) return resultado;

    const kpimap = {
        satEP: ['satEP','satEp'],
        resEP: ['resEP','resEp'],
        satSNL: ['satSNL','satSnl','satSNL','satSnl'],
        resSNL: ['resSNL','resSnl'],
        tmo: ['tmo','TMO'],
        transfEPA: ['transfEPA','epa','transfEpa'],
        tipificaciones: ['tipificaciones','tip']
    };

    function obtener(obj, variants) {
        for (const k of variants) {
            if (obj && obj[k] !== undefined && obj[k] !== null) return Number(obj[k]) || 0;
        }
        return 0;
    }

    for (const k in kpimap) {
        const variants = kpimap[k];
        const aVal = obtener(actual, variants);
        const bVal = obtener(anterior, variants);
        const delta = aVal - bVal;
        resultado.cambios[k] = delta;

        if (k === 'tmo') {
            if (aVal < bVal) resultado.mejoras.push(k);
            else if (aVal > bVal) resultado.empeora.push(k);
        } else {
            if (aVal > bVal) resultado.mejoras.push(k);
            else if (aVal < bVal) resultado.empeora.push(k);
        }
    }

    return resultado;
}

// Calcula la pendiente promedio (tendencia) de una serie de valores (antiguo -> reciente)
function tendencia(valores) {
    const n = valores.length;
    if (n < 2) return 0;
    return (valores[n - 1] - valores[0]) / (n - 1);
}

// Proyecta el siguiente valor usando la pendiente promedio (redondeado)
function proyectarSiguiente(valores) {
    if (!Array.isArray(valores) || valores.length === 0) return 0;
    const pendiente = tendencia(valores);
    const ultimo = Number(valores[valores.length - 1]) || 0;
    return Math.round(ultimo + pendiente);
}

// Evalúa riesgo futuro para una KPI dado un valor proyectado
function riesgoFuturo(kpi, proyeccion) {
    const umbrales = {
        resEP: 90,
        satEP: 95,
        tmo: 5,
        epa: 85
    };

    if (kpi === "tmo") {
        return proyeccion > umbrales[kpi] ? "riesgo" : "ok";
    }

    return proyeccion < umbrales[kpi] ? "riesgo" : "ok";
}

// Prioriza el riesgo más relevante en base a proyección, tendencia e impacto
function priorizarRiesgo(historial) {
    let riesgoPrioritario = null;
    let mayorScore = -Infinity;

    for (const kpi in historial) {
        const valores = historial[kpi];
        const proyeccion = proyectarSiguiente(valores);
        const estado = riesgoFuturo(kpi, proyeccion);

        if (estado === "riesgo") {
            const tendenciaValor = tendencia(valores);
            const impacto = impactoKPI[kpi] || 1;

            const score = Math.abs(tendenciaValor) * impacto;

            if (score > mayorScore) {
                mayorScore = score;
                riesgoPrioritario = {
                    kpi,
                    proyeccion,
                    tendencia: tendenciaValor,
                    impacto
                };
            }
        }
    }

    return riesgoPrioritario;
}

// Genera predicciones y estado futuro para cada KPI en un historial
function predecir(historial) {
    const predicciones = {};

    for (const kpi in historial) {
        const proy = proyectarSiguiente(historial[kpi]);
        predicciones[kpi] = {
            valor: proy,
            estado: riesgoFuturo(kpi, proy)
        };
    }

    return predicciones;
}

// Renderiza la lista predictiva en la UI usando IA.predecir(historial)
async function renderPredictivo() {
    const lista = document.getElementById('lista-predictivo');
    if (!lista) return;
    lista.innerHTML = "";

    try {
        const hist = await loadHistorialFromDB();
        const predicciones = (typeof IA !== 'undefined' && typeof IA.predecir === 'function') ? IA.predecir(hist) : predecir(hist);

        for (const kpi in predicciones) {
            const item = predicciones[kpi];
            const li = document.createElement('li');

            li.textContent =
                item.estado === 'riesgo'
                    ? `⚠️ ${kpi.toUpperCase()} podría salir de objetivo (${item.valor})`
                    : `✅ ${kpi.toUpperCase()} se mantendría estable (${item.valor})`;

            lista.appendChild(li);
        }

            // Mostrar riesgo priorizado en la UI
            try {
                const riesgo = (typeof IA !== 'undefined' && typeof IA.priorizarRiesgo === 'function') ? IA.priorizarRiesgo(hist) : (typeof priorizarRiesgo === 'function' ? priorizarRiesgo(hist) : null);

                const textoEl = document.getElementById('riesgo-texto');
                const motivoEl = document.getElementById('riesgo-motivo');

                if (riesgo) {
                    if (textoEl) textoEl.textContent = `${riesgo.kpi.toUpperCase()} podría incumplir el objetivo el próximo mes (${riesgo.proyeccion})`;
                    if (motivoEl) motivoEl.textContent = `Motivo: tendencia negativa sostenida y alto impacto en experiencia del paciente.`;
                } else {
                    if (textoEl) textoEl.textContent = "No se detectan riesgos críticos para el próximo mes.";
                    if (motivoEl) motivoEl.textContent = "";
                }

                // Generar y mostrar acción preventiva sugerida
                try {
                    const accion = (typeof IA !== 'undefined' && typeof IA.generarAccionPreventiva === 'function') ? IA.generarAccionPreventiva(riesgo) : (typeof generarAccionPreventiva === 'function' ? generarAccionPreventiva(riesgo) : null);

                    const tituloEl = document.getElementById('accion-titulo');
                    const detalleEl = document.getElementById('accion-detalle');

                    if (accion) {
                        if (tituloEl) tituloEl.textContent = accion.titulo || '--';
                        if (detalleEl) detalleEl.innerHTML = `\
                            <li><strong>Acción:</strong> ${accion.accion}</li>\
                            <li><strong>Responsable:</strong> ${accion.responsable}</li>\
                            <li><strong>Duración:</strong> ${accion.duracion}</li>\
                            <li><strong>Foco:</strong> ${accion.foco}</li>\
                            <li><strong>Prioridad:</strong> ${accion.prioridad}</li>\
                        `;
                    } else {
                        if (tituloEl) tituloEl.textContent = '--';
                        if (detalleEl) detalleEl.innerHTML = '';
                    }
                } catch (err2) {
                    console.warn('No fue posible actualizar acción preventiva', err2);
                }
            } catch (err) {
                console.warn('No fue posible actualizar riesgo priorizado', err);
            }
    } catch (e) {
        lista.innerHTML = '<li>Error generando predicciones</li>';
        console.error('Predictivo error', e);
    }
}

// 🧠 NORMAS KPI (configurable)
const KPI_NORMAS = {
    satisfaccionSNL: { tipo: 'mayorIgual', valor: 95 },
    resolucionSNL:   { tipo: 'mayorIgual', valor: 90 },
    satisfaccionEP:  { tipo: 'mayorIgual', valor: 95 },
    resolucionEP:    { tipo: 'mayorIgual', valor: 90 },
    tmo:             { tipo: 'menorIgual', valor: 5 },
    transferenciaEPA:{ tipo: 'mayorIgual', valor: 85 },
    tipificaciones:  { tipo: 'mayorIgual', valor: 95 }
};

// Alias mapping between norma keys and data properties
const KPI_ALIASES = {
    satisfaccionSNL: 'satSnl',
    resolucionSNL: 'resSnl',
    satisfaccionEP: 'satEp',
    resolucionEP: 'resEp',
    transferenciaEPA: 'transfEPA',
    tipificaciones: 'tipificaciones',
    tmo: 'tmo'
};

const impactoKPI = {
    satEP: 3,   // alto impacto experiencia
    resEP: 3,   // alto impacto resolución
    satSNL: 2,
    resSNL: 2,
    tmo: 2,
    epa: 1,
    tip: 1
};

const accionesPreventivas = {
    satEP: {
        titulo: "Refuerzo de calidad EP",
        accion: "Aplicar coaching focalizado en cierre empático y validación final",
        duracion: "7 días",
        responsable: "Supervisor",
        foco: "Experiencia del paciente EP"
    },
    resEP: {
        titulo: "Mejora resolución EP",
        accion: "Revisar causas de no resolución y reforzar uso de flujos EP",
        duracion: "5 días",
        responsable: "Supervisor",
        foco: "Resolución efectiva"
    },
    satSNL: {
        titulo: "Optimización atención SNL",
        accion: "Escucha guiada de llamadas y refuerzo de lenguaje claro",
        duracion: "7 días",
        responsable: "Supervisor",
        foco: "Comunicación"
    },
    tmo: {
        titulo: "Control de TMO",
        accion: "Reducir reprocesos y reforzar tipificación en tiempo real",
        duracion: "5 días",
        responsable: "Ejecutivo",
        foco: "Eficiencia operativa"
    }
};

function generarAccionPreventiva(riesgo) {
    if (!riesgo) return null;

    const accionBase = accionesPreventivas[riesgo.kpi];
    if (!accionBase) return null;

    return Object.assign({}, accionBase, {
        kpi: riesgo.kpi,
        motivo: "Riesgo predictivo detectado para el próximo mes",
        prioridad: "Alta"
    });
}

function getKpiValue(ejecutivo, kpiKey) {
    // Try direct property first
    if (ejecutivo[kpiKey] !== undefined) return Number(ejecutivo[kpiKey]) || 0;
    const alias = KPI_ALIASES[kpiKey];
    if (alias && ejecutivo[alias] !== undefined) return Number(ejecutivo[alias]) || 0;
    // Try common normalized keys
    const normalized = { satSNL: 'satSnl', resSNL: 'resSnl', satEP: 'satEp', resEP: 'resEp', transfEPA: 'transfEPA' };
    if (normalized[kpiKey] && ejecutivo[normalized[kpiKey]] !== undefined) return Number(ejecutivo[normalized[kpiKey]]) || 0;
    return 0;
}

// 🧮 Evaluar KPIs de un ejecutivo
function evaluarKPIs(ejecutivo) {
    let puntos = 0;
    const detalle = {};

    for (const kpi in KPI_NORMAS) {
        const norma = KPI_NORMAS[kpi];
        const valor = getKpiValue(ejecutivo, kpi);

        let cumple = false;

        if (norma.tipo === 'mayorIgual') {
            cumple = valor >= norma.valor;
        } else if (norma.tipo === 'menorIgual') {
            cumple = valor <= norma.valor;
        }

        detalle[kpi] = cumple ? 1 : 0;
        puntos += cumple ? 1 : 0;
    }

    return Object.assign({}, ejecutivo, {
        kpiTotal: puntos,
        kpiDetalle: detalle
    });
}

// 📊 Cuartilizar el equipo completo
function cuartilizarEquipo(ejecutivos) {
    // 1️⃣ Evaluar KPIs
    const evaluados = ejecutivos.map(evaluarKPIs);

    // 2️⃣ Ordenar de mayor a menor por KPIs cumplidos
    evaluados.sort((a, b) => (b.kpiTotal || 0) - (a.kpiTotal || 0));

    const total = evaluados.length;

    // 3️⃣ Asignar cuartil (añadimos ambas propiedades para compatibilidad)
    return evaluados.map((ej, index) => {
        const posicion = index + 1;
        const percentil = posicion / total;

        let cuartil;
        if (percentil <= 0.25) cuartil = 'Q1';
        else if (percentil <= 0.50) cuartil = 'Q2';
        else if (percentil <= 0.75) cuartil = 'Q3';
        else cuartil = 'Q4';

        return Object.assign({}, ej, {
            cuartil,
            quartile: cuartil
        });
    });
}

// 🎨 Opcional: Color/emoji por cuartil
function colorCuartil(cuartil) {
    return {
        Q1: '🟢',
        Q2: '🟡',
        Q3: '🟠',
        Q4: '🔴'
    }[cuartil];
}

// 🧭 CRITERIO DE UMBRALES - CONFIGURACIÓN DE SEMÁFOROS
const KPI_SEMAFORO_CONFIG = {
    satisfaccionSNL: { tipo: 'mayor', norma: 95, tolerancia: 3 },
    resolucionSNL:   { tipo: 'mayor', norma: 90, tolerancia: 3 },
    satisfaccionEP:  { tipo: 'mayor', norma: 95, tolerancia: 3 },
    resolucionEP:    { tipo: 'mayor', norma: 90, tolerancia: 3 },
    transferenciaEPA:{ tipo: 'mayor', norma: 85, tolerancia: 3 },
    tipificaciones:  { tipo: 'mayor', norma: 95, tolerancia: 3 },

    tmo:             { tipo: 'menor', norma: 5, tolerancia: 0.5 }
};

// 🟢🟡🔴 TIPS POR KPI (lista compacta para modal de mejora)
const tipsKPI = {
    satisfaccionSNL: {
        VERDE: [
            'Mantén saludo empático en los primeros 10 segundos',
            'Continúa cerrando la llamada confirmando solución',
            'Refuerza el uso del nombre del paciente durante la llamada'
        ],
        AMARILLO: [
            'Llama al paciente por su nombre al menos 2 veces',
            'Evita silencios largos sin explicar qué estás haciendo',
            'Usa frases de transición cortas para mantener flujo'
        ],
        ROJO: [
            'Usa frases de contención (“entiendo su preocupación”)',
            'Resume el problema antes de entregar la solución',
            'Evita respuestas automáticas o cortantes'
        ]
    },
    resolucionSNL: {
        VERDE: [
            'Continúa validando: “¿Quedó clara la respuesta?”',
            'Confirma el siguiente paso cuando corresponda',
            'Cierra con una frase de verificación final'
        ],
        AMARILLO: [
            'Confirma explícitamente si la duda quedó resuelta',
            'Evita cerrar la llamada sin check final',
            'Resume la acción tomada durante la llamada'
        ],
        ROJO: [
            'No asumas que el paciente entendió',
            'Reformula la respuesta en palabras simples',
            'Si no resuelves, explica el siguiente paso con claridad'
        ]
    },
    satisfaccionEP: {
        VERDE: [
            'Mantén tono cordial y ritmo constante',
            'Usa frases positivas durante la interacción',
            'Asegura que la despedida sea cálida y personalizada'
        ],
        AMARILLO: [
            'Sonríe al hablar (se nota en la voz)',
            'Evita frases negativas (“no se puede”)',
            'Aclara expectativas cuando haya demoras'
        ],
        ROJO: [
            'Baja la velocidad de la llamada',
            'Repite instrucciones paso a paso',
            'Evita multitarea mientras atiendes'
        ]
    },
    resolucionEP: {
        VERDE: [
            'Continúa validando resultado final',
            'Confirma acción concreta tomada',
            'Cierra con confirmación de satisfacción'
        ],
        AMARILLO: [
            'Asegúrate de revisar toda la información antes de cerrar',
            'Verifica datos críticos (email/teléfono)',
            'Documenta pasos en observaciones'
        ],
        ROJO: [
            'Usa checklist mental por tipo de caso',
            'No cierres sin confirmar acción concreta',
            'Escala cuando el caso excede tu alcance'
        ]
    },
    tmo: {
        VERDE: [
            'Buen ritmo: mantén foco en objetivo de la llamada',
            'Prepárate con atajos y scripts frecuentes',
            'Anticipa preguntas comunes para ahorrar tiempo'
        ],
        AMARILLO: [
            'Evita conversaciones paralelas',
            'Ten a mano scripts frecuentes',
            'Usa preguntas cerradas para reconducir'
        ],
        ROJO: [
            'Dirige la llamada con preguntas cerradas',
            'Evita explicaciones largas innecesarias',
            'Usa frases de reconducción (“para avanzar…”)'
        ]
    },
    transferenciaEPA: {
        VERDE: [
            'Mantén explicación clara del beneficio de la transferencia',
            'Confirma disponibilidad del paciente antes de derivar',
            'Prepara al paciente indicando qué le preguntarán'
        ],
        AMARILLO: [
            'Explica el propósito de la encuesta antes de transferir',
            'Indica tiempos estimados de atención',
            'Solicita permiso para transferir cuando corresponda'
        ],
        ROJO: [
            'Usa guion fijo de traspaso',
            'Confirma disponibilidad del paciente antes de derivar',
            'Evita transferir sin explicar el motivo'
        ]
    },
    tipificaciones: {
        VERDE: [
            'Tipifica EN VIVO, no después',
            'Sigue el flujo: categoría → resultado → motivo',
            'Verifica siempre el ✓ verde de guardado'
        ],
        AMARILLO: [
            'Revisa categoría antes de guardar',
            'Evita postergar tipificación',
            'Usa observaciones para detalles importantes'
        ],
        ROJO: [
            'Tipifica apenas corte el paciente',
            'Usa categorías frecuentes como favoritos',
            'No dejes llamadas sin cerrar'
        ]
    }
};

function obtenerTips(kpiKey, estado) {
    if (!tipsKPI[kpiKey]) return [];
    // esperar estado en MAYUS (VERDE/AMARILLO/ROJO)
    return tipsKPI[kpiKey][estado] || [];
}

function showTipsModal(ejecutivoName) {
    const name = (ejecutivoName || '').replace(/\\'/g, "'");
    const exec = (currentData || []).find(e => e.name === name || e.ejecutivo === name || getShortName(e.name) === name);
    const semaforos = exec ? semaforosEjecutivo(exec) : {};

    const kpis = Object.keys(KPI_SEMAFORO_CONFIG);

    // Buscar modal de indicadores activo (contenido real)
    const refContent = document.querySelector('.modal-overlay.active .modal-content') || document.querySelector('.modal-content');

    // Construir panel lateral compacto para tips
    const panel = document.createElement('div');
    panel.id = 'tipsPanel';
    panel.style.position = 'fixed';
    panel.style.width = '420px';
    panel.style.maxHeight = '80vh';
    panel.style.overflow = 'auto';
    panel.style.background = 'var(--bg-card)';
    panel.style.border = '1px solid var(--border-color)';
    panel.style.borderRadius = '12px';
    panel.style.boxShadow = '0 12px 30px rgba(0,0,0,0.12)';
    panel.style.zIndex = 11000;

    // Inicialmente oculto para medir dimensiones
    panel.style.visibility = 'hidden';
    panel.innerHTML = `
        <div style="padding:12px 14px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color);">
            <div>
                <strong>Tips de Mejora</strong>
                <div style="font-size:0.85rem; color:var(--text-secondary);">${name || 'Ejecutivo'}</div>
            </div>
            <button onclick="document.getElementById('tipsPanel')?.remove()" style="background:none; border:none; font-size:1.1rem; cursor:pointer">✖</button>
        </div>
        <div style="display:flex; gap:12px; padding:12px;">
            <div style="min-width:140px;">
                ${kpis.map(k => {
                    const s = semaforos[k] || { estado: 'VERDE', color: '🟢' };
                    return `<button class="tips-tab" data-kpi="${k}" style="display:block; width:100%; text-align:left; padding:8px; margin-bottom:8px; border-radius:8px; border:1px solid var(--border-color); background: var(--bg-card); cursor:pointer;">${s.color} <strong style="margin-left:8px">${k}</strong> <div style="font-size:0.75rem; color:var(--text-secondary);">${s.estado}</div></button>`;
                }).join('')}
            </div>
            <div style="flex:1; padding:6px;">
                <div id="tipsContent" style="min-height:120px; color:var(--text-main); font-size:0.95rem;">
                    <p style="color:var(--text-secondary); margin:0;">Selecciona una KPI para ver tips específicos.</p>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(panel);

    // Si existe un modal de referencia, reposicionar el panel para alinear verticalmente
    if (refContent) {
        const refRect = refContent.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        // Calcular top centrado respecto al modal de referencia
        let top = Math.max(12, Math.round(refRect.top + (refRect.height / 2) - (panelRect.height / 2)));
        // Solapamiento parcial: distancia en px que queremos solapar sobre el modal
        const overlapPx = 40; // se puede ajustar (por defecto 40px)
        // Posicionar panel de modo que solape `overlapPx` desde el borde derecho del modal de referencia
        let left = Math.round(refRect.right - overlapPx);
        // Clamp para que no se salga de la pantalla
        const minLeft = 12;
        const maxLeft = Math.max(12, window.innerWidth - panelRect.width - 12);
        if (left < minLeft) left = minLeft;
        if (left > maxLeft) left = maxLeft;
        // Ajustes para no salirse de la pantalla
        if (left + panelRect.width > window.innerWidth - 8) left = window.innerWidth - panelRect.width - 12;
        if (top + panelRect.height > window.innerHeight - 12) top = Math.max(12, window.innerHeight - panelRect.height - 12);
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
        panel.style.transform = '';
    } else {
        // Centrado fallback
        panel.style.left = '50%';
        panel.style.top = '50%';
        panel.style.transform = 'translate(-50%, -50%)';
    }
    panel.style.visibility = 'visible';

    // Agregar manejador a tabs (panel)
    panel.querySelectorAll('.tips-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            panel.querySelectorAll('.tips-tab').forEach(b => b.style.boxShadow = '');
            btn.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)';
            const k = btn.dataset.kpi;
            const estado = (semaforos[k] && semaforos[k].estado) ? semaforos[k].estado : 'VERDE';
            const tips = obtenerTips(k, estado);
            const content = document.getElementById('tipsContent');
            content.innerHTML = `
                <h4 style="margin:0 0 8px 0">${k} — ${estado}</h4>
                <ul style="list-style:none; padding-left:0; margin:0;">
                    ${tips.map(t => `<li style="padding:8px 0; display:flex; gap:10px; align-items:start;\"><span style=\"font-size:1.05rem; line-height:1.2; color:var(--achs-verde)\">✔</span><div style=\"color:var(--text-main)\">${t}</div></li>`).join('')}
                </ul>
            `;
        });
    });

}

// === MODAL TIPS DE MEJORA - Funciones de cierre ===
let tipsModalEscHandler = null;

function closeTipsModal() {
    const modal = document.getElementById('tipsModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        // Remover handler ESC
        if (tipsModalEscHandler) {
            document.removeEventListener('keydown', tipsModalEscHandler);
            tipsModalEscHandler = null;
        }
    }
    // Remover panel lateral de tips si existe
    const panel = document.getElementById('tipsPanel');
    if (panel) panel.remove();
}

function openTipsModal() {
    const modal = document.getElementById('tipsModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        // Handler para tecla ESC
        tipsModalEscHandler = function(e) {
            if (e.key === 'Escape') closeTipsModal();
        };
        document.addEventListener('keydown', tipsModalEscHandler);
    }
}

// 🧮 Obtener semáforo para un KPI específico
function obtenerSemaforoKPI(kpi, valor) {
    const cfg = KPI_SEMAFORO_CONFIG[kpi];
    if (!cfg) return null;

    let estado = 'ROJO';
    let color = '🔴';

    if (cfg.tipo === 'mayor') {
        if (valor >= cfg.norma) {
            estado = 'VERDE'; color = '🟢';
        } else if (valor >= cfg.norma - cfg.tolerancia) {
            estado = 'AMARILLO'; color = '🟡';
        }
    }

    if (cfg.tipo === 'menor') {
        if (valor <= cfg.norma) {
            estado = 'VERDE'; color = '🟢';
        } else if (valor <= cfg.norma + cfg.tolerancia) {
            estado = 'AMARILLO'; color = '🟡';
        }
    }

    return {
        estado,
        color,
        norma: cfg.norma
    };
}

// 📊 Obtener semáforos completos para un ejecutivo
function semaforosEjecutivo(ejecutivo) {
    const resultado = {};
    for (const kpi in KPI_SEMAFORO_CONFIG) {
        const valor = getKpiValue(ejecutivo, kpi);
        resultado[kpi] = obtenerSemaforoKPI(kpi, valor);
    }
    return resultado;
}

// Función auxiliar: clase CSS para heatmap según estado
function claseHeatmap(estado) {
    if (!estado) return 'heat-na';
    if (estado === 'VERDE') return 'heat-green';
    if (estado === 'AMARILLO') return 'heat-yellow';
    if (estado === 'ROJO') return 'heat-red';
    return 'heat-na';
}

// Generar HTML dinámico para mapa de calor
function generarMapaCalor(ejecutivos, opciones = {}) {
    const kpis = Object.keys(KPI_SEMAFORO_CONFIG);
    let html = `<table class="heatmap">
        <thead>
            <tr>
                <th>Ejecutivo</th>
                ${kpis.map(k => `<th>${k}</th>`).join('')}
            </tr>
        </thead>
        <tbody>
    `;

    ejecutivos.forEach(ej => {
        const semaforos = semaforosEjecutivo(ej);
        const displayName = ej.nombre || ej.name || ej.ejecutivo || '—';

        html += `<tr>`;
        html += `<td class="exec-name">${displayName}</td>`;

        kpis.forEach(kpi => {
            const s = semaforos[kpi] || { estado: null, color: '', norma: '' };
            const valor = getKpiValue(ej, kpi);
            const clase = claseHeatmap(s.estado);
            const tooltip = `Valor: ${valor} | Norma: ${s.norma || '-'} | Estado: ${s.estado || 'N/A'}`;

            // Click handler: opcional mostrar recomendación si se define `mostrarRecomendacion`
            const onclick = opciones.onclick ? `onclick="${opciones.onclick}(\'${displayName.replace(/'/g, "\\'")}\', \"${kpi}\")"` : '';

            html += `
                <td class="${clase}" title="${tooltip}" ${onclick}>
                    ${s.color || ''}
                </td>
            `;
        });

        html += `</tr>`;
    });

    html += `</tbody></table>`;
    return html;
}

// === RANKING POR Nº DE KPIs CUMPLIDOS ===
const TOTAL_KPIS = Object.keys(KPI_NORMAS).length || 7;

// Contar KPIs en ROJO para un ejecutivo
function contarRojos(ejecutivo) {
    const semaforos = semaforosEjecutivo(ejecutivo);
    return Object.values(semaforos).filter(s => s && s.estado === 'ROJO').length;
}

// Generar ranking por KPIs cumplidos (empate -> menos rojos)
function rankingKPIs(ejecutivos) {
    return ejecutivos
        .map(evaluarKPIs)
        .sort((a, b) => {
            if ((b.kpiTotal || 0) !== (a.kpiTotal || 0)) return (b.kpiTotal || 0) - (a.kpiTotal || 0);
            const rojosA = contarRojos(a);
            const rojosB = contarRojos(b);
            return rojosA - rojosB;
        })
        .map((ej, index) => Object.assign({}, ej, { ranking: index + 1 }));
}

// Medalla visual por posicion
function medalla(posicion) {
    if (posicion === 1) return '🥇';
    if (posicion === 2) return '🥈';
    if (posicion === 3) return '🥉';
    return '';
}

// Reloj en el header: muestra día y hora en locale español
function startClock() {
    const el = document.getElementById('headerClock');
    if (!el) return;

    function update() {
        const now = new Date();
        const fecha = now.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
        const hora = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        // Capitalizar primera letra del día
        const fechaCap = fecha.charAt(0).toUpperCase() + fecha.slice(1);
        el.textContent = `${fechaCap} · ${hora}`;
    }

    update();
    setInterval(update, 1000);
}

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
        todos: 'kpiTotal',
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
// Normaliza una representación de mes (ej: "Nov", "noviembre 23", "11") a nombre completo en mayúsculas
function normalizeMonthName(input) {
    if (!input && input !== 0) return '';
    const monthsEs = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
    let s = input.toString().trim().toUpperCase();
    // If already exact
    if (monthsEs.includes(s)) return s;
    // Remove year suffixes like -23 or 2023
    s = s.replace(/[-\s]\d{2,4}$/,'').trim();
    // Check full name contains
    for (const m of monthsEs) {
        if (s.includes(m)) return m;
    }
    // Check 3-letter matches
    const abbr = s.substring(0,3);
    for (const m of monthsEs) if (m.substring(0,3) === abbr) return m;
    // Check numeric month
    const num = parseInt(s.replace(/^0+/,''),10);
    if (!isNaN(num) && num >=1 && num <=12) return monthsEs[num-1];
    return s; // fallback to original uppercased string
}

function normalizeCurrentDataMonths(dataArray) {
    if (!Array.isArray(dataArray)) return;
    dataArray.forEach(d => { if (d && d.mes) d.mes = normalizeMonthName(d.mes); });
}
// --- CACHE MANAGEMENT ---
// DESHABILITADO: No usar caché local - siempre consultar API
function getTodayDate() {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

const SheetCache = {
    get: (month) => {
        // DESHABILITADO: No usar caché localStorage
        // Siempre retornar null para forzar consulta a API
        return null;
    },
    set: (month, data) => {
        // DESHABILITADO: No guardar en localStorage
        // Los datos deben venir siempre de la API
        console.log(`[SheetCache] Cache deshabilitado - datos de ${month} no guardados`);
    }
};

// STATE
let currentData = [];
// Historial vacío - los datos deben venir de la API
const historial = {
    resEP: [],
    satEP: [],
    tmo: [],
    epa: [],
    satSNL: []
};

// CARGA de historial desde la API
// Si la API responde OK (incluso con data vacía), usar esa respuesta
// Solo usar fallback vacío si hay error de red
async function loadHistorialFromDB() {
    if (!isAuthenticated()) {
        console.log('[auth] Bloqueada llamada a API (no autenticado): loadHistorialFromDB');
        return [];
    }
    try {
        if (typeof window.fetchHistorialFromDB === 'function') {
            const remote = await window.fetchHistorialFromDB();
            if (remote && typeof remote === 'object') return remote;
        }

        // Consultar API de historial
    const resp = await window.apiFetch(`/kpis/historial`, {cache: 'no-store'});
        if (resp.ok) {
            const json = await resp.json();
            // API respondió OK - usar la respuesta aunque esté vacía
            if (json && typeof json === 'object') {
                console.log('[loadHistorialFromDB] Datos recibidos de API');
                return json;
            }
        }
        // API respondió pero no OK - estado vacío
        console.warn('[loadHistorialFromDB] API no disponible, usando historial vacío');
        return historial;

    } catch (err) {
        // Error de red - usar historial vacío
        console.error('[loadHistorialFromDB] Error de red:', err.message || err);
        return historial;
    }
}

// Obtiene el mes actual en español MAYÚSCULAS según la fecha del navegador
function getCurrentMonthES() {
    const monthsEs = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    return monthsEs[new Date().getMonth()];
}

// Mes inicial: usar mes actual si está soportado, sino el primer mes del array MONTHS
const mesActualReal = getCurrentMonthES();
let currentMonth = MONTHS.includes(mesActualReal) ? mesActualReal : MONTHS[0];
console.log("[month-sync] mes actual del navegador:", mesActualReal, "| mes inicial elegido:", currentMonth);

let theme = localStorage.getItem('theme') || 'light';
let evolChart = null;
// forcedExecutive movido a auth.js - usar window.forcedExecutive o getForcedExecutive()

// SETUP
document.addEventListener('DOMContentLoaded', () => {

    applyTheme(theme);
    startClock();
    initEventListeners();
    populateMonthFilter();
    // Iniciar con la carga del mes actual y el historial solo si autenticado
    if (localStorage.getItem('auth_token')) {
        simulateInitialLoad();
    } else {
        console.log('[auth] Usuario no autenticado, carga de datos detenida');
    }

    // Registrar Service Worker SOLO en producción
    const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if ('serviceWorker' in navigator) {
        if (isLocal) {
            console.log('[sw] Registro SW omitido en local');
        } else {
            navigator.serviceWorker.register('/static/sw.js?v=20260130-1', { scope: '/static/' })
                .then(reg => console.log('SW registrado versión 20260130-1'))
                .catch(err => console.warn('Error registro ServiceWorker:', err));
        }
    }

    const initialKpi = document.getElementById('selectKPI') ? document.getElementById('selectKPI').value : 'tmo';
    updateKpiDisplay(initialKpi);

    // Mostrar predictivo al cargar
    renderPredictivo();
    // Mostrar gráfico de tendencia KPI (intento inicial)
    try { renderKpiTrendChart(); } catch (e) { console.warn('kpiTrendChart init failed', e); }

    // Inicializar controles desplegables para secciones IA
    setupIaCollapsibles();

    // Sync roles after data might have started loading
    const session = JSON.parse(localStorage.getItem('userSession'));
    if (session) {
        aplicarRol(session.rol);
    } else {
        // Si no hay sesión (modo desarrollo/local), mostrar elementos protegidos para pruebas
        try {
            document.querySelectorAll('[data-rol]').forEach(el => { el.style.display = ''; });
        } catch (e) { /* noop */ }
    }
});

// Carga inicial desde API - sin mock ni fallback, CON auto-fallback de mes
async function simulateInitialLoad() {
    // SIEMPRE cargar desde API - no usar caché ni mock
    const overlay = document.getElementById('refreshOverlay');
    if (overlay) overlay.classList.add('active');

    // Limpiar datos anteriores mientras carga
    currentData = [];

    // Orden de meses para fallback (del más reciente al más antiguo)
    const FALLBACK_MONTHS = ['DICIEMBRE', 'NOVIEMBRE', 'OCTUBRE', 'SEPTIEMBRE', 'AGOSTO', 'JULIO', 'JUNIO', 'MAYO', 'ABRIL', 'MARZO', 'FEBRERO', 'ENERO'];

    const mesInicial = currentMonth;
    console.log("[month-sync] mes inicial:", mesInicial);

    try {
        // Intentar cargar el mes actual primero
        const initialData = await fetchSheet(currentMonth, true);
        
        if (initialData && initialData.length > 0) {
            // El mes actual tiene data, usarlo
            console.log("[init] mes elegido final:", currentMonth, "regs:", initialData.length);
            
            // PASO 1: Asegurar variable global actualizada (ya está, pero confirmar)
            // currentMonth ya es el correcto
            
            // PASO 2: Actualizar selector visual
            updateMonthSelectorUI(currentMonth);
            
            // PASO 3: Procesar y renderizar
            currentData = initialData;
            currentData.forEach(d => {
                if (d.mes) d.mes = normalizeMonthName(d.mes);
                if (d.name) d.name = d.name.toString().trim();
            });
            
            console.log("[month-sync] mes activo final =", currentMonth);
            console.log("[month-sync] selector actualizado para:", currentMonth);
            
            processData(currentData);
        } else {
            // Mes actual sin data, buscar fallback
            console.log("[init] mes sin data, probando fallback desde:", currentMonth);
            
            let foundMonth = null;
            let foundData = null;

            for (const mes of FALLBACK_MONTHS) {
                if (mes === mesInicial) continue; // Ya lo intentamos
                
                console.log("[init] probando fallback:", mes);
                try {
                    const testData = await fetchSheet(mes, true);
                    if (testData && testData.length > 0) {
                        foundMonth = mes;
                        foundData = testData;
                        console.log("[init] encontrado data en:", mes, "regs:", testData.length);
                        break;
                    }
                } catch (e) {
                    // Continuar con el siguiente mes
                    console.log(`[init] fallback ${mes} falló:`, e.message);
                }
            }

            if (foundMonth && foundData) {
                console.log("[init] mes elegido final:", foundMonth, "regs:", foundData.length);
                
                // PASO 1: Actualizar variable global del mes activo
                currentMonth = foundMonth;
                
                // PASO 2: Actualizar selector visual (checkbox)
                updateMonthSelectorUI(foundMonth);
                
                // PASO 3: Procesar data encontrada y renderizar
                currentData = foundData;
                currentData.forEach(d => {
                    if (d.mes) d.mes = normalizeMonthName(d.mes);
                    if (d.name) d.name = d.name.toString().trim();
                });
                
                console.log("[month-sync] mes activo final =", currentMonth);
                console.log("[month-sync] selector actualizado para:", foundMonth);
                
                processData(currentData);
            } else {
                // Ningún mes tiene data
                console.log("[init] ningún mes tiene data disponible");
                console.log("[month-sync] mes activo final =", currentMonth, "(sin datos)");
                currentData = [];
                processData(currentData);
            }
        }
    } catch (e) {
        console.error('[simulateInitialLoad] Error al cargar datos desde API:', e);
        // Mostrar estado vacío - NO usar mock data
        currentData = [];
        processData(currentData);
    } finally {
        if (overlay) overlay.classList.remove('active');
    }
}

// Actualiza el checkbox del selector de mes en la UI
function updateMonthSelectorUI(month) {
    const container = document.getElementById('monthOptions');
    if (!container) {
        console.warn("[month-sync] no se encontró #monthOptions");
        return;
    }
    
    // Desmarcar todos y marcar solo el mes encontrado
    let marcado = false;
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        const shouldCheck = (cb.value === month);
        cb.checked = shouldCheck;
        if (shouldCheck) marcado = true;
    });
    
    console.log("[month-sync] checkbox marcado:", marcado ? month : "NINGUNO");
    
    // Actualizar texto del header si existe la función
    if (typeof updateMonthHeaderText === 'function') {
        updateMonthHeaderText();
    }
}

// Configura los encabezados IA como desplegables (colapsables)
function setupIaCollapsibles() {
    const selectors = ['.ia-predictivo', '.ia-prioridad', '.accion-preventiva'];
    selectors.forEach(sel => {
        const section = document.querySelector(sel);
        if (!section) return;

        const header = section.querySelector('h3');
        if (!header) return;

        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');

        // Mostrar cerrado por defecto
        section.classList.add('collapsed');
        header.setAttribute('aria-expanded', 'false');

        const toggle = () => {
            const isCollapsedNow = section.classList.toggle('collapsed');
            // aria-expanded debe ser true cuando está desplegado
            header.setAttribute('aria-expanded', (!isCollapsedNow).toString());
        };

        header.addEventListener('click', toggle);
        header.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                toggle();
            }
        });
    });
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
                console.log("[month-manual] Usuario seleccionó manualmente:", sel);
                if (sel.length === 1) {
                    // isManualSelection = true: NO hacer fallback si está vacío
                    await fetchData(currentMonth, false, true);
                } else {
                    await fetchMultipleMonths(sel, false, true);
                }
            });
        });

        // Also trigger a dashboard re-render when months selection changes
        document.querySelectorAll('#monthOptions input').forEach(cb => cb.addEventListener('change', renderDashboard));
    }

    document.getElementById('execFilter').addEventListener('change', renderDashboard);
    // KPI selector listener
    const kpiSel = document.getElementById('selectKPI');
    if (kpiSel) kpiSel.addEventListener('change', (e) => updateKpiDisplay(e.target.value));

    // IA example runner button
    const btnIa = document.getElementById('btnRunIAExample');
    if (btnIa) btnIa.addEventListener('click', () => runIAExample());

    const btnCloseIa = document.getElementById('closeIaResult');
    if (btnCloseIa) btnCloseIa.addEventListener('click', () => {
        const modal = document.getElementById('iaResultModal');
        if (modal) modal.style.display = 'none';
    });
}

function getSelectedMonths() {
    const monthOptions = document.getElementById('monthOptions');
    if (!monthOptions) return [currentMonth]; // Fallback a variable global
    const checked = Array.from(monthOptions.querySelectorAll('input:checked')).map(cb => cb.value);
    // Si no hay ninguno marcado, usar la variable global currentMonth
    return checked.length > 0 ? checked : [currentMonth];
}

function updateMonthHeaderText() {
    const sel = getSelectedMonths();
    const textEl = document.getElementById('selectedMonthsText');
    if (!textEl) return;

    if (sel.length === 0) textEl.innerText = 'Seleccionar meses';
    else if (sel.length === 1) textEl.innerText = sel[0];
    else textEl.innerText = `${sel.length} meses seleccionados`;
}

function selectLast3Months() {
    const container = document.getElementById('monthOptions');
    if (!container) return;

    const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]'));
    if (checkboxes.length === 0) return;

    // Uncheck all first
    checkboxes.forEach(cb => cb.checked = false);

    // Select the last 3 months (last 3 checkboxes in the list)
    const last3 = checkboxes.slice(-3);
    last3.forEach(cb => cb.checked = true);

    // Update header text
    updateMonthHeaderText();

    // Close the dropdown
    container.classList.remove('active');

    // Trigger data fetch for selected months
    const sel = getSelectedMonths();
    if (sel.length > 0) {
        currentMonth = sel[0];
        if (sel.length === 1) {
            fetchData(currentMonth);
        } else {
            fetchMultipleMonths(sel);
        }
    }
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

    // Add "Select last 3 months" button
    const btnLast3 = document.createElement('button');
    btnLast3.innerHTML = '<i class="fas fa-calendar-alt"></i> Seleccionar últimos 3 meses';
    btnLast3.style.cssText = 'margin-top: 8px; padding: 6px 12px; background: linear-gradient(135deg, #005DAA, #003B73); color: white; border: none; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer; width: 100%; transition: all 0.2s;';
    btnLast3.onclick = selectLast3Months;
    container.appendChild(btnLast3);

    // Add listeners to new checkboxes (selección manual = NO fallback)
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', async () => {
            updateMonthHeaderText();
            const sel = getSelectedMonths();
            if (sel.length === 0) return;

            currentMonth = sel[0];
            console.log("[month-manual] Selección manual desde populateMonthFilter:", sel);
            if (sel.length === 1) {
                // isManualSelection = true: NO hacer fallback si está vacío
                await fetchData(currentMonth, false, true);
            } else {
                await fetchMultipleMonths(sel, false, true);
            }
        });
    });

    updateMonthHeaderText();
}

// Ejecuta el flujo IA con ejemplo y muestra resultados en modal
async function runIAExample() {
    const ejecutivo = {
        nombre: 'Manuel Monsalve',
        satEP: 93,
        resEP: 88,
        satSNL: 96,
        resSNL: 92,
        tmo: 5.8,
        epa: 78,
        tip: 97
    };

    const estado = await IA.analizar(ejecutivo);
    const riesgos = IA.detectarRiesgos(estado);
    const recomendacion = IA.recomendar(riesgos);
    const coaching = IA.generarCoaching(riesgos);

    const contentEl = document.getElementById('iaResultContent');
    if (contentEl) {
        contentEl.innerHTML = `
            <div><strong>Ejecutivo:</strong> ${ejecutivo.nombre}</div>
            <pre style="white-space:pre-wrap; margin-top:8px;">Estado: ${JSON.stringify(estado, null, 2)}</pre>
            <div><strong>Riesgos:</strong> ${JSON.stringify(riesgos)}</div>
            <div style="margin-top:8px;"><strong>Recomendación:</strong> ${recomendacion}</div>
            <div style="margin-top:8px;"><strong>Coaching:</strong><ul>${coaching.map(t => `<li>${t}</li>`).join('')}</ul></div>
        `;
    }

    const modal = document.getElementById('iaResultModal');
    if (modal) modal.style.display = 'block';

    // También actualizar la caja IA en la página si existe
    const recEl = document.getElementById('ia-recomendacion');
    const coachEl = document.getElementById('ia-coaching');
    if (recEl) recEl.textContent = recomendacion;
    if (coachEl) {
        // Limpiar lista y añadir elementos uno a uno con prefijo •
        coachEl.innerHTML = "";
        coaching.forEach(tip => {
            const li = document.createElement('li');
            li.textContent = '• ' + tip;
            coachEl.appendChild(li);
        });
    }
}

function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    const btn = document.getElementById('themeToggle');
    btn.innerHTML = t === 'light' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
}

// =====================================================
// RESET UI PARA ESTADO SIN DATOS
// =====================================================
function resetDashboardUIForNoData(selectedMonth) {
    console.log("[no-data-reset] Reseteando UI para mes sin datos:", selectedMonth);
    
    // 1. Limpiar datos en memoria
    currentData = [];
    
    // 2. Resetear Resumen KPIs - Nivel Equipo
    const teamKpiContainer = document.getElementById('teamKpiSummary');
    if (teamKpiContainer) {
        const kpis = [
            { label: 'Satisfacción SNL', display: '—' },
            { label: 'Resolución SNL', display: '—' },
            { label: 'Satisfacción EP', display: '—' },
            { label: 'Resolución EP', display: '—' },
            { label: 'TMO', display: '—' },
            { label: 'Transferencia a EPA', display: '—' },
            { label: 'Tipificaciones', display: '—' }
        ];
        teamKpiContainer.innerHTML = `
            <div class="team-kpi-summary">
                <h3>📊 Resumen KPIs – Nivel Equipo</h3>
                <div class="kpi-grid">${kpis.map(k => `
                    <div class="kpi-card">
                        <div class="kpi-title">${k.label}</div>
                        <div class="kpi-value" style="color: var(--text-secondary);">${k.display}</div>
                        <div class="kpi-meta">Sin datos</div>
                    </div>
                `).join('')}</div>
            </div>
        `;
    }
    
    // 3. Resetear Podium/Ranking
    const podiumContainer = document.getElementById('podiumContainerInline');
    if (podiumContainer) {
        podiumContainer.innerHTML = `
            <div class="podium-title">Ranking KPI Mes en curso</div>
            <p style="text-align:center; color:var(--text-secondary); padding: 2rem;">
                <i class="fas fa-inbox" style="font-size: 2rem; opacity: 0.3; display: block; margin-bottom: 0.5rem;"></i>
                Sin datos para ${selectedMonth}
            </p>
        `;
    }
    
    // 4. Resetear grid de ejecutivos
    const dashboardGrid = document.getElementById('dashboardGrid');
    if (dashboardGrid) {
        dashboardGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: var(--bg-card); border-radius: 16px; border: 1px dashed var(--border-color);">
                <i class="fas fa-calendar-times" style="font-size: 3rem; color: var(--text-secondary); opacity: 0.3; margin-bottom: 1rem;"></i>
                <h3 style="color: var(--text-secondary);">No hay datos para ${selectedMonth}</h3>
                <p style="color: var(--text-secondary); font-size: 0.9rem;">La API no tiene información para este período.</p>
            </div>
        `;
    }
    
    // 5. Resetear resumen ejecutivo si existe
    const execSummary = document.getElementById('executiveSummary');
    if (execSummary) {
        execSummary.innerHTML = '';
    }
    
    // 6. Resetear tabla COPC
    const copcTable = document.getElementById('copcTableContainer');
    if (copcTable) {
        copcTable.innerHTML = `
            <p style="text-align:center; color:var(--text-secondary); padding: 1rem;">
                Sin datos para mostrar en ${selectedMonth}
            </p>
        `;
    }
    
    // 7. Resetear sección evolutivo/predictivo si depende del mes
    const evolutivoSection = document.querySelector('.evolucion-chart');
    if (evolutivoSection) {
        const chartContainer = evolutivoSection.querySelector('canvas');
        if (chartContainer && window.evolChart) {
            window.evolChart.data.labels = [];
            window.evolChart.data.datasets = [];
            window.evolChart.update();
        }
    }
    
    // 8. Limpiar secciones IA
    const iaPrediccion = document.getElementById('ia-prediccion');
    if (iaPrediccion) iaPrediccion.textContent = 'Sin datos disponibles';
    
    const iaRecomendacion = document.getElementById('ia-recomendacion');
    if (iaRecomendacion) iaRecomendacion.textContent = 'Sin datos disponibles';
    
    const iaCoaching = document.getElementById('ia-coaching');
    if (iaCoaching) iaCoaching.innerHTML = '';
    
    console.log("[no-data-reset] Reset completado para:", selectedMonth);
}

// FETCHING DATA
// isManualSelection: true si el usuario seleccionó manualmente el mes (NO hacer fallback)
async function fetchData(month, force = false, isManualSelection = false) {
    showLoading(true);
    try {
        const parsed = await fetchSheet(month, force);
        
        // Si viene vacío y es selección manual, NO hacer fallback - mostrar estado vacío
        if (parsed.length === 0 && isManualSelection) {
            console.log("[month-manual] Selección manual de", month, "sin datos - NO fallback");
            resetDashboardUIForNoData(month);
            showLoading(false);
            return;
        }
        
        parsed.forEach(d => {
            if (d.mes) d.mes = normalizeMonthName(d.mes);
            if (d.name) d.name = d.name.toString().trim();
        });
        currentData = parsed;
        console.log(`Data loaded for ${month} (Force: ${force})`, currentData);
        processData(currentData);
    } catch (err) {
        console.error('Fetch failed:', err);
        // Limpiar datos y mostrar estado vacío usando la función central
        resetDashboardUIForNoData(month);
    } finally {
        showLoading(false);
    }
}

// Fetch a single sheet and return parsed rows (does not update UI)
async function fetchSheet(month, force = false) {
    if (!isAuthenticated()) {
        console.log('[auth] Bloqueada llamada a API (no autenticado): fetchSheet');
        return [];
    }
    if (!month) throw new Error('Month required');

    // Helper: convierte a número o null (nunca 0 por defecto)
    function toNumOrNull(v) {
        if (v === null || v === undefined) return null;
        if (typeof v === "string" && v.trim() === "") return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }

    // SIEMPRE consultar API - caché deshabilitado
    console.log(`[fetchSheet] Consultando API para: ${month}`);

    // Fetch desde API FastAPI
    const response = await window.apiFetch(`/kpis?meses=${encodeURIComponent(month)}`, { cache: 'no-cache' });
    if (!response.ok) {
        console.error(`[fetchSheet] API error para "${month}": ${response.status}`);
        throw new Error(`La API no tiene datos para ${month}.`);
    }

    const json = await response.json();
    const rows = Array.isArray(json.data) ? json.data : [];

    if (rows.length === 0) {
        console.log(`[fetchSheet] API devolvió data vacía para: ${month}`);
        return [];
    }

    const parsed = rows.map(r => {
        if (!r || !r.name) return null;

        return {
            name: (r.name || "").toString().trim(),
            mes: (r.mes || month).toString().trim(),
            tmo: toNumOrNull(r.tmo),
            transfEPA: toNumOrNull(r.transfEPA),
            tipificaciones: toNumOrNull(r.tipificaciones),
            satEp: toNumOrNull(r.satEp),
            resEp: toNumOrNull(r.resEp),
            satSnl: toNumOrNull(r.satSnl),
            resSnl: toNumOrNull(r.resSnl),
        };
    }).filter(d => d && d.name && !['TOTAL', 'PROMEDIO', 'EJECUTIVO', 'NOMBRE'].includes(d.name.toUpperCase()) && d.name.length >= 3);

    console.log(`[fetchSheet] ${month}: ${parsed.length} registros procesados`);
    console.log("[fetchSheet] sample parsed:", parsed[0]);
    return parsed;
}

// Fetch multiple sheets and merge results
// isManualSelection: si es true, no hacer fallback ni alertas intrusivas
async function fetchMultipleMonths(months, force = false, isManualSelection = false) {
    showLoading(true);
    try {
        const promises = months.map(m => fetchSheet(m, force).catch(err => {
            console.error(`Error loading ${m}:`, err);
            return [];
        }));
        const results = await Promise.all(promises);
        // Merge arrays
        currentData = [].concat(...results);
        
        // Si es selección manual y no hay datos, mostrar estado vacío
        if (isManualSelection && currentData.length === 0) {
            console.log("[month-manual] Múltiples meses sin datos:", months);
            resetDashboardUIForNoData(months.join(', '));
            showLoading(false);
            return;
        }
        
        // Log months that returned empty results to help debugging missing sheets
        results.forEach((res, i) => {
            if (!res || (Array.isArray(res) && res.length === 0)) console.warn(`fetchMultipleMonths: no data for ${months[i]}`);
        });
        // Normalize month names in merged data
        normalizeCurrentDataMonths(currentData);

        // Detect missing months (those with no rows after merge)
        const missingAfterFetch = months.filter(m => !currentData.some(d => matchMonth(d.mes, m)));
        if (missingAfterFetch.length > 0) {
            console.warn('fetchMultipleMonths: sin datos en API para:', missingAfterFetch);
            // Solo mostrar alert si NO es selección manual (para no ser intrusivo)
            if (!isManualSelection) {
                try {
                    alert(`Sin datos para: ${missingAfterFetch.join(', ')}.\nLa API no tiene información para estos meses.`);
                } catch (e) { /* ignore alert failures */ }
            }
        }
        // Ensure mes values are normalized to full uppercase month names
        normalizeCurrentDataMonths(currentData);
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
    // DESHABILITADO: No usar datos mock - siempre consultar API
    console.warn('[useMockData] DESHABILITADO - Los datos deben venir de la API');
    currentData = [];
    processData(currentData);
}

// LOGIC & CALCULATIONS
function processData(data) {
    console.log("[processData] sample BEFORE:", JSON.stringify(data[0]));
    // 1. Calculate Score COPC for each executive
    // IMPORTANTE: NO mutar los KPIs originales (null debe preservarse)
    data.forEach(d => {
        // Variables locales para cálculos (con fallback a 0), SIN mutar el objeto original
        const satSnlCalc = normalizePercent(d.satSnl);
        const resSnlCalc = normalizePercent(d.resSnl);
        const satEpCalc = normalizePercent(d.satEp);
        const resEpCalc = normalizePercent(d.resEp);
        const transfEPACalc = normalizePercent(d.transfEPA);
        const tipificacionesCalc = normalizePercent(d.tipificaciones);
        const tmoCalc = d.tmo ?? 0;

        // Map data to the format calcularScoreCOPC expects (usando valores de cálculo)
        const kpisValues = {
            tmo: tmoCalc,
            satEP: satEpCalc,
            resEP: resEpCalc,
            satSNL: satSnlCalc,
            resSNL: resSnlCalc,
            transfEPA: transfEPACalc,
            tipificaciones: tipificacionesCalc
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

        // Forzar recalcularScore con mapeo exacto (valores de cálculo, no muta KPIs)
        const kpisValuesRecalc = {
            tmo: tmoCalc,
            satEP: satEpCalc,
            resEP: resEpCalc,
            satSNL: satSnlCalc,
            resSNL: resSnlCalc,
            transfEPA: transfEPACalc,
            tipificaciones: tipificacionesCalc
        };

        // KPI_TOTAL: suma de KPIs cumplidos (tmo cuenta como cumplir si es menor o igual a la meta)
        d.kpiTotal = Object.keys(kpisValuesRecalc).reduce((acc, k) => {
            try {
                return acc + (cumpleMeta(k, kpisValuesRecalc[k]) ? 1 : 0);
            } catch (e) { return acc; }
        }, 0);
        // Remove COPC score/classification to rely ONLY on KPI_TOTAL per new requirement
        d.score = null;
        d.copcNivel = null;
        d.copcColor = null;
    });

    console.log("[processData] sample AFTER:", JSON.stringify(data[0]));

    // 2. Sort by KPI_TOTAL Descending (mayores KPIs cumplidos primero)
    data.sort((a, b) => (b.kpiTotal || 0) - (a.kpiTotal || 0));

    // 3. Assign classic quartiles based solely on KPI_TOTAL (top 25% = Q1)
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

    // Save current selection or use forcedExecutive from role application (auth.js)
    const session = JSON.parse(localStorage.getItem('userSession'));
    const forcedExec = typeof getForcedExecutive === 'function' ? getForcedExecutive() : window.forcedExecutive;
    const targetExec = forcedExec || (session && session.rol === 'ejecutivo' ? session.ejecutivo : sel.value);

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
// ------------------ Team KPI Summary ------------------
function semaforoEquipo(valor, meta, tipo = 'mayor') {
    if (tipo === 'mayor') {
        if (valor >= meta) return 'green';
        if (valor >= meta - 5) return 'yellow';
        return 'red';
    }
    if (tipo === 'menor') {
        if (valor <= meta) return 'green';
        if (valor <= meta + 1) return 'yellow';
        return 'red';
    }
    return 'red';
}

// Resetea las cards de Resumen KPIs - Nivel Equipo a estado vacío
function resetTeamSummaryCards(container, month) {
    const kpis = [
        { label: 'Satisfacción SNL' },
        { label: 'Resolución SNL' },
        { label: 'Satisfacción EP' },
        { label: 'Resolución EP' },
        { label: 'TMO' },
        { label: 'Transferencia a EPA' },
        { label: 'Tipificaciones' }
    ];
    
    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'team-kpi-summary';
    wrapper.innerHTML = `
        <h3>📊 Resumen KPIs – Nivel Equipo <span style="font-size:0.8rem; color:var(--text-secondary);">(${month})</span></h3>
        <div class="kpi-grid">${kpis.map(k => `
            <div class="kpi-card">
                <div class="kpi-title">${k.label}</div>
                <div class="kpi-value" style="color: var(--text-secondary);">—</div>
                <div class="kpi-meta">Sin datos</div>
            </div>
        `).join('')}</div>
    `;
    container.appendChild(wrapper);
    console.log("[team-summary] Cards reseteadas a estado vacío para:", month);
}

function renderTeamKpiSummary() {
    const containerId = 'teamKpiSummary';
    let container = document.getElementById(containerId);
    if (!container) {
        // create and insert before dashboardGrid (not after podium)
        container = document.createElement('div');
        container.id = containerId;
        const dashGrid = document.getElementById('dashboardGrid');
        if (dashGrid && dashGrid.parentNode) dashGrid.parentNode.insertBefore(container, dashGrid);
        else {
            const contentArea = document.querySelector('.content-area');
            if (contentArea) contentArea.insertBefore(container, contentArea.firstChild);
        }
    }

    const selectedMonths = getSelectedMonths();
    const month = selectedMonths && selectedMonths.length ? selectedMonths[0] : currentMonth;

    // build list of unique executives with an entry for the month
    const execNames = Array.from(new Set(currentData.map(d => d.name).filter(Boolean))).sort();
    const execEntries = execNames.map(name => currentData.find(d => d.name === name && matchMonth(d.mes, month))).filter(Boolean);

    // Si no hay datos para el mes seleccionado, mostrar estado vacío y salir
    if (execEntries.length === 0) {
        console.log("[team-summary] Sin datos para el mes:", month);
        resetTeamSummaryCards(container, month);
        return;
    }

    const kpis = [
        { dataKey: 'satSnl', label: 'Satisfacción SNL', metaKey: 'satSNL', tipo: 'mayor' },
        { dataKey: 'resSnl', label: 'Resolución SNL', metaKey: 'resSNL', tipo: 'mayor' },
        { dataKey: 'satEp',  label: 'Satisfacción EP', metaKey: 'satEP',  tipo: 'mayor' },
        { dataKey: 'resEp',  label: 'Resolución EP', metaKey: 'resEP',  tipo: 'mayor' },
        { dataKey: 'tmo',    label: 'TMO',             metaKey: 'tmo',     tipo: 'menor' },
        { dataKey: 'transfEPA', label: 'Transferencia a EPA', metaKey: 'transfEPA', tipo: 'mayor' },
        { dataKey: 'tipificaciones', label: 'Tipificaciones', metaKey: 'tipificaciones', tipo: 'mayor' }
    ];

    const averages = {};
    kpis.forEach(k => {
        const vals = execEntries.map(e => {
            const v = getKpiValue(e, k.dataKey);
            return (k.dataKey === 'tmo') ? (Number(v) || 0) : (Number(v) || 0);
        }).filter(v => typeof v === 'number' && !isNaN(v));
        averages[k.dataKey] = vals.length ? (vals.reduce((a,b) => a + b, 0) / vals.length) : 0;
    });

    // render HTML
    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'team-kpi-summary';
    wrapper.innerHTML = `
        <h3>📊 Resumen KPIs – Nivel Equipo</h3>
        <div class="kpi-grid">${kpis.map(k => {
            const val = averages[k.dataKey] || 0;
            const display = k.dataKey === 'tmo' ? formatTMO(val) : formatPercent(val);
            const metaVal = (metas[k.metaKey] !== undefined) ? metas[k.metaKey] : metas[k.metaKey.toLowerCase()];
            const metaDisplay = k.dataKey === 'tmo' ? formatTMO(metaVal) : formatPercent(metaVal);
            const sem = semaforoEquipo(k.dataKey === 'tmo' ? val : val, Number(metaVal), k.tipo);
            return `
                <div class="kpi-card ${sem}">
                    <div class="kpi-title">${k.label}</div>
                    <div class="kpi-value">${display}</div>
                    <div class="kpi-meta">Meta ${metaDisplay}</div>
                    <div class="kpi-dot ${sem}"></div>
                </div>`;
        }).join('')}</div>
    `;
    container.appendChild(wrapper);
}

// -------------------------------------------------------
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

    // Render team KPI summary (always visible)
    try { renderTeamKpiSummary(); } catch (e) { console.error('Error rendering team KPI summary', e); }
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
                            <i class="fas fa-chart-bar" style="color: var(--achs-azul);"></i>
                            <span style="margin-left:6px">KPIs cumplidos: <strong>${d.kpiTotal ?? 0}</strong></span>
                            <span style="margin-left:12px">Indicador: <strong>${d.indicatorScore ?? 0}</strong></span>
                        </div>
                    </div>
                    <div class="quartile-badge ${d.quartile.toLowerCase()}">${d.quartile}</div>
                </div>
                <div class="kpi-grid" style="grid-template-columns: 1fr 1fr; gap: 0.8rem;">
                    ${renderKpiItem('Satisfacción SNL', kpisExec.satSNL, metas.satSNL, true, safeName, 'satSNL', 'fas fa-smile')}
                    ${renderKpiItem('Resolución SNL', kpisExec.resSNL, metas.resSNL, true, safeName, 'resSNL', 'fas fa-check-circle')}
                    ${renderKpiItem('Satisfacción EP', kpisExec.satEP, metas.satEP, true, safeName, 'satEP', 'fas fa-star')}
                    ${renderKpiItem('Resolución EP', kpisExec.resEP, metas.resEP, true, safeName, 'resEP', 'fas fa-clipboard-check')}
                    ${renderKpiItem('Transferencia a EPA', kpisExec.transfEPA, metas.transfEPA, true, safeName, 'transfEPA', 'fas fa-exchange-alt')}
                    ${renderKpiItem('Tipificaciones', kpisExec.tipificaciones, metas.tipificaciones, true, safeName, 'tipificaciones', 'fas fa-tags')}
                    <div class="kpi-item clickable-kpi" onclick="event.stopPropagation(); showEvolutionary('${safeName}', 'tmo')">
                        <span class="kpi-label"><i class="fas fa-clock" style="margin-right: 6px; color: var(--achs-azul-claro);"></i> TMO</span>
                        <span class="kpi-value">${formatTMO(kpisExec.tmo)}</span>
                        <div class="semaphore ${getTmoColor(kpisExec.tmo)}"></div>
                    </div>
                    <div class="kpi-item" style="background: var(--bg-card); border: 1px dashed var(--border-color);">
                        <span class="kpi-label"><i class="fas fa-chart-pie" style="margin-right: 6px; color: var(--achs-azul-claro);"></i> Indicador</span>
                        <span class="kpi-value">${d.indicatorScore ?? 0}</span>
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
                    <div style="position: absolute; bottom: 10px; right: 10px; display:flex; gap:8px;">
                        <button class="btn-1-1" onclick="event.stopPropagation(); openOneOnOneModal('${safeName}')" 
                            style="font-size: 0.75rem; padding: 6px 10px; background: var(--achs-azul); color: white; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px;"
                            data-rol="jefatura supervisor">
                            <i class="fas fa-comments"></i> Puntos 1:1
                        </button>
                        <button class="btn-tips" onclick="event.stopPropagation(); showTipsModal('${safeName}')" style="font-size:0.75rem; padding:6px 10px; background: linear-gradient(135deg,#F8FAFC,#EFF6FF); border:1px solid var(--border-color); color:var(--achs-azul); border-radius:6px; cursor:pointer; display:flex; align-items:center; gap:8px;">
                            <i class="fas fa-lightbulb"></i> Ver tips de mejora
                        </button>
                    </div>
                </div>
            `;
            // Abrir modal ejecutivo al hacer click en la tarjeta (pero evitar si clickea un control interno)
            card.addEventListener('click', function (ev) { ev.stopPropagation(); abrirModalEjecutivo(d); });
            grid.appendChild(card);
        } catch (cardError) {
            console.error("Error rendering card for", d.name, cardError);
        }
    });
}

function renderKpiItem(label, val, target, isHigherBetter, name, kpiKey, iconClass) {
    const colorClass = getSemaphoreColor(val, target, isHigherBetter);
    const iconHtml = iconClass ? `<i class="${iconClass}" style="margin-right: 6px; color: var(--achs-azul-claro);"></i>` : '';
    const valueDisplay = (kpiKey === 'tmo') ? formatTMO(val) : formatPercent(val);
    return `
        <div class="kpi-item clickable-kpi" onclick="showEvolutionary('${name}', '${kpiKey}')">
            <span class="kpi-label">${iconHtml}${label}</span>
            <span class="kpi-value">${valueDisplay}</span>
            <div class="semaphore ${colorClass}"></div>
        </div>
    `;
}

// Utility to get a short name: "First Name + First Surname"
// Formato entrada ACHS: "ApellidoP ApellidoM Nombre1 Nombre2..."
// Formato salida: "Nombre1 ApellidoP" (ej: "Manuel Monsalve")
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
    
    // Formato ACHS típico: ApellidoP ApellidoM Nombre1 Nombre2...
    // Ejemplo: "Monsalve Corvacho Manuel Alejandro" -> "Manuel Monsalve"
    // Heurística más robusta:
    // - Si hay 4 o más tokens, asumimos: ApellidoP ApellidoM Nombre1 Nombre2... -> Nombre1 ApellidoP
    // - Si hay exactamente 3 tokens, puede ser: ApellidoP Nombre1 Nombre2 (sin segundo apellido)
    //   o Nombre1 Nombre2 ApellidoP. En este caso priorizamos el token del medio como primer nombre
    //   porque en muchos registros ACHS el formato suele ser ApellidoP Nombre1 Nombre2.
    if (words.length >= 4) {
        return `${words[2]} ${words[0]}`;
    }

    if (words.length === 3) {
        return `${words[1]} ${words[0]}`;
    }
    
    // Caso de 2 palabras: asumimos Nombre Apellido
    if (words.length === 2) {
        return `${words[0]} ${words[1]}`;
    }

    // Fallback: devolver tal cual
    return fullName;
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
    const container = document.getElementById('podiumContainerInline');
    if (!container) return;
    container.innerHTML = '';

    if (top3.length < 3) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">Cargando ranking...</p>';
        return;
    }

    // Add title
    const title = document.createElement('div');
    title.className = 'podium-title';
    title.textContent = 'Ranking KPI Mes en curso';
    container.appendChild(title);

    // Wrapper for podium places
    const podiumWrapper = document.createElement('div');
    podiumWrapper.className = 'podium-wrapper';
    podiumWrapper.style.display = 'flex';
    podiumWrapper.style.gap = '24px';
    podiumWrapper.style.alignItems = 'flex-end';
    podiumWrapper.style.justifyContent = 'center';
    podiumWrapper.style.width = '100%';
    podiumWrapper.style.position = 'relative';
    podiumWrapper.style.zIndex = '1';

    // Order for visual display: [2nd, 1st, 3rd]
    const order = [top3[1], top3[0], top3[2]];
    const places = [2, 1, 3];

    order.forEach((d, idx) => {
        if (!d) return;
        const place = places[idx];
        const placeMedal = place === 1 ? '🥇' : (place === 2 ? '🥈' : '🥉');

        // Use centralized helper to get first name + first surname
        const shortName = getShortName(d.name || d.nombre || d.ejecutivo || '');

        const div = document.createElement('div');
        div.className = `podium-place place-${place}`;

        const resolvedKpi = resolveKpiKey(kpiKey);
        const val = Number(d[resolvedKpi]) || 0;
        const displayVal = kpiKey === 'tmo' ? formatTMO(val) : formatPercent(val);

        div.innerHTML = `
            <div class="podium-avatar">
                <span style="font-size:inherit;">${placeMedal}</span>
            </div>
            <div class="podium-bar">
                <div style="text-align:center;">
                  <div style="font-size:0.85rem; font-weight:800; background:rgba(0,0,0,0.25); color:#ffffff; border-radius:12px; padding:4px 10px; margin-bottom:6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">${displayVal}</div>
                </div>
            </div>
            <div class="podium-badge">${place}º</div>
            <div class="podium-name">${shortName}</div>
        `;
        podiumWrapper.appendChild(div);
    });
    
    container.appendChild(podiumWrapper);
}

function renderCopcTable(data) {
    const container = document.getElementById('copcTableContainer');
    let html = `
        <table>
            <thead>
                <tr>
                    <th>Ejecutivo</th>
                    <th>Cuartil</th>
                    <th>KPIs Cumplidos</th>
                    <th>Estado</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.forEach(d => {
        html += `
            <tr>
                <td>${getShortName(d.name)}</td>
                <td><span class="quartile-badge ${d.quartile.toLowerCase()}">${d.quartile}</span></td>
                <td style="font-weight:700; text-align:center;">${d.kpiTotal ?? 0} / ${Object.keys(metas).length}</td>
                <td>${d.quartile === 'Q4' ? 'Crítico ⚠️' : 'Normal'}</td>
            </tr>
        `;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

// ACTIONS (New)
function openDatabase() {
    // DESHABILITADO: Ya no se usa Google Sheets. Datos vienen de FastAPI.
    alert('Esta función está deshabilitada. Los datos ahora provienen de la API interna.');
    console.warn('openDatabase() llamado pero Google Sheets está deshabilitado.');
}

function parseSheetIdFromUrl(text) {
    // LEGACY: Función mantenida por compatibilidad pero no se usa
    return null;
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
    const p = document.getElementById('podiumContainerInline');
    if (bool) {
        if (p) p.innerHTML = '<div class="loader"></div>';
    }
}

let copcEscHandler = null;
let copcOverlayHandler = null;

function toggleCopcModal() {
    const modal = document.getElementById('copcModal');
    if (!modal) return;
    
    if (modal.classList.contains('active')) {
        // Cerrar
        modal.classList.remove('active');
        if (copcEscHandler) document.removeEventListener('keydown', copcEscHandler);
        if (copcOverlayHandler) modal.removeEventListener('click', copcOverlayHandler);
    } else {
        // Abrir
        modal.classList.add('active');
        
        copcEscHandler = function(e) {
            if (e.key === 'Escape') toggleCopcModal();
        };
        copcOverlayHandler = function(e) {
            if (e.target === modal) toggleCopcModal();
        };
        
        document.addEventListener('keydown', copcEscHandler);
        modal.addEventListener('click', copcOverlayHandler);
    }
}

let kpiTrendEscHandler = null;
let kpiTrendOverlayHandler = null;

// Toggle KPI Trend modal (global) — opens modal and renders chart
function toggleKpiTrendModal() {
    const modal = document.getElementById('kpiTrendModal');
    if (!modal) return;
    
    if (modal.classList.contains('active')) {
        // Cerrar
        modal.classList.remove('active');
        if (kpiTrendEscHandler) document.removeEventListener('keydown', kpiTrendEscHandler);
        if (kpiTrendOverlayHandler) modal.removeEventListener('click', kpiTrendOverlayHandler);
    } else {
        // Abrir
        modal.classList.add('active');
        
        kpiTrendEscHandler = function(e) {
            if (e.key === 'Escape') toggleKpiTrendModal();
        };
        kpiTrendOverlayHandler = function(e) {
            if (e.target === modal) toggleKpiTrendModal();
        };
        
        document.addEventListener('keydown', kpiTrendEscHandler);
        modal.addEventListener('click', kpiTrendOverlayHandler);
        
        // Render chart when opening
        try { renderKpiTrendChart(); } catch (e) { console.warn('Error rendering KPI trend on open', e); }
    }
}

// Placeholders for Requested Features
// TEAMS REPORT MODAL LOGIC
let teamsEscHandler = null;
let teamsOverlayHandler = null;

function generateTeamsReport() {
    const modal = document.getElementById('modalTeams');
    if (!modal) return;
    modal.classList.add('active');
    document.body.classList.add('teams-modal-open');
    
    // Handler para tecla ESC
    teamsEscHandler = function(e) {
        if (e.key === 'Escape') cerrarModalTeams();
    };
    
    // Handler para clic fuera del modal (en el overlay)
    teamsOverlayHandler = function(e) {
        if (e.target === modal) cerrarModalTeams();
    };
    
    // Agregar listeners
    document.addEventListener('keydown', teamsEscHandler);
    modal.addEventListener('click', teamsOverlayHandler);
    
    // Delegar a la UI/procedimiento profesional existente más abajo
    if (typeof renderProfessionalTeamsUI === 'function') renderProfessionalTeamsUI();
    if (typeof generarReporteTeamsProfesional === 'function') generarReporteTeamsProfesional();
}

function cerrarModalTeams() {
    const modal = document.getElementById('modalTeams');
    if (modal) {
        modal.classList.remove('active');
        document.body.classList.remove('teams-modal-open');
        // Remover listeners
        if (teamsEscHandler) document.removeEventListener('keydown', teamsEscHandler);
        if (teamsOverlayHandler) modal.removeEventListener('click', teamsOverlayHandler);
    }
}

// -----------------------
// Gráfico: Tendencia KPIs (últimos 3 meses)
// -----------------------
function getLastNMonthNames(n) {
    const monthsEs = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
    const res = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        res.push(monthsEs[d.getMonth()]);
    }
    return res;
}

function renderKpiTrendChart() {
    const canvas = document.getElementById('kpiTrendChart');
    if (!canvas) return;

    const meses = getLastNMonthNames(3).map(l => l.charAt(0) + l.slice(1).toLowerCase());

    // Helper para promediar una propiedad con variantes de nombre
    function avgForKey(rows, variants) {
        const vals = rows.map(r => {
            for (const k of variants) {
                if (r[k] !== undefined && r[k] !== null && r[k] !== '') return Number(r[k]) || 0;
            }
            return null;
        }).filter(v => v !== null && !isNaN(v));
        if (vals.length === 0) return null;
        return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    }

    const labelsRaw = getLastNMonthNames(3);

    const dataTrend = { satSNL: [], satEP: [], epa: [] };

    labelsRaw.forEach((mesName, idx) => {
        const rows = (currentData || []).filter(d => matchMonth(d.mes, mesName));

        // Satisfacción SNL -> posibles keys: satSnl, satSNL, sat_snl
        let vSnl = avgForKey(rows, ['satSnl', 'satSNL', 'sat_snl']);
        // Satisfacción EP -> satEp, satEP
        let vEp = avgForKey(rows, ['satEp', 'satEP', 'sat_ep']);
        // Transferencia EPA -> transfEPA, epa, transfEpa
        let vEpa = avgForKey(rows, ['transfEPA', 'epa', 'transfEpa']);

        // NO usar fallback - si no hay datos, mostrar null
        // El gráfico mostrará gaps donde no hay datos reales
        dataTrend.satSNL.push(vSnl);
        dataTrend.satEP.push(vEp);
        dataTrend.epa.push(vEpa);
    });

    // Destroy previous chart if existe
    if (window.kpiTrendChart instanceof Chart) window.kpiTrendChart.destroy();

    const ctx = document.getElementById('kpiTrendChart').getContext('2d');
    window.kpiTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: meses,
            datasets: [
                {
                    label: 'Satisfacción SNL',
                    data: dataTrend.satSNL,
                    borderWidth: 3,
                    tension: 0.4,
                    borderColor: '#16a34a',
                    backgroundColor: 'rgba(22,163,74,0.06)'
                },
                {
                    label: 'Satisfacción EP',
                    data: dataTrend.satEP,
                    borderWidth: 3,
                    tension: 0.4,
                    borderColor: '#005DAA',
                    backgroundColor: 'rgba(0,93,170,0.06)'
                },
                {
                    label: 'Transferencia a EPA',
                    data: dataTrend.epa,
                    borderWidth: 3,
                    tension: 0.4,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245,158,11,0.06)'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}%` } }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: { callback: v => v + '%' }
                }
            }
        }
    });
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
    if (!fullName) return "---";

    // Si hay una coma (Formato: Apellidos, Nombres)
    if (fullName.includes(',')) {
        const parts = fullName.split(',');
        const apellidos = parts[0].trim().split(' ');
        const nombres = parts[1].trim().split(' ');
        return `${nombres[0]} ${apellidos[0]}`;
    }

    const words = fullName.trim().split(/\s+/);

    // Heurística robusta para formatos comunes:
    // - 4+ tokens: ApellidoP ApellidoM Nombre1 Nombre2... -> Nombre1 ApellidoP
    // - 3 tokens: ApellidoP ApellidoM Nombre1 OR ApellidoP Nombre1 Nombre2 -> tomar token del medio como primer nombre
    // - 2 tokens: Nombre Apellido -> mantener orden Nombre Apellido
    if (words.length >= 4) {
        return `${words[2]} ${words[0]}`;
    }

    if (words.length === 3) {
        return `${words[1]} ${words[0]}`;
    }

    if (words.length === 2) {
        return `${words[0]} ${words[1]}`;
    }

    return fullName;
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
        txt += "──────────────────────\n";
        txt += `👤 ${e.name.toUpperCase()}\n\n`;

        // TMO
        if (selectedMetrics.includes('tmo')) {
            const val = Number(e.tmo) || 0;
            txt += `TMO               ${getStatusIcon(val, metas.tmo, 'lower')} ${formatTMO(val)}\n`;
        }

        // Grupo EP
        if (selectedMetrics.includes('satEP') || selectedMetrics.includes('resEP')) {
            const sVal = Number(e.satEp) || 0;
            const rVal = Number(e.resEp) || 0;
            const sIcon = getStatusIcon(sVal, metas.satEP, 'higher');
            txt += `Sat EP / Res EP   ${sIcon} ${formatPercent(sVal)} / ${formatPercent(rVal)}\n`;
        }

        // Grupo SNL
        if (selectedMetrics.includes('satSNL') || selectedMetrics.includes('resSNL')) {
            const sVal = Number(e.satSnl) || 0;
            const rVal = Number(e.resSnl) || 0;
            const sIcon = getStatusIcon(sVal, metas.satSNL, 'higher');
            txt += `Sat SNL / Res SNL ${sIcon} ${formatPercent(sVal)} / ${formatPercent(rVal)}\n`;
        }

        // Grupo EPA / Tipif
        if (selectedMetrics.includes('transfEPA') || selectedMetrics.includes('tipificaciones')) {
            const eVal = Number(e.transfEPA) || 0;
            const tVal = Number(e.tipificaciones) || 0;
            const eIcon = getStatusIcon(eVal, metas.transfEPA, 'higher');
            txt += `EPA / Tipif.      ${eIcon} ${formatPercent(eVal)} / ${formatPercent(tVal)}\n`;
        }

        txt += "──────────────────────\n\n";
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
    const currentMonthName = currentViewMonths[0] || currentMonth; // Usar variable global, NO 'ENERO' hardcodeado
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
        const avgDisplay = (unit.trim() === '%') ? formatPercent(currentAvg) : formatTMO(currentAvg);
        row.innerHTML = `
            <span>${meta.label}</span>
            <span class="badge-modal" style="color: ${trendColor}">${avgDisplay} ${trendIcon} ${getStatusIcon(currentAvg, meta.target, meta.type)}</span>
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
            div.innerHTML = `<span>🚀 Mejora: ${m.name}</span> <span class="badge-modal">+${Math.round(m.delta)} pts</span>`;
            cont.appendChild(div);
        });

        bottom.forEach(m => {
            const div = document.createElement('div');
            div.className = "report-row bad";
            div.innerHTML = `<span>📉 Declive: ${m.name}</span> <span class="badge-modal">${Math.round(m.delta)} pts</span>`;
            cont.appendChild(div);
        });
    }
}


function generarReporteTeamsActual() {
    const selected = [...document.querySelectorAll("#metricSelector input:checked")]
        .map(i => i.value);

    // Identificar mes actual y anterior
    const currentViewMonths = getSelectedMonths();
    const currentMonthName = currentViewMonths[0] || currentMonth; // Usar variable global, NO 'ENERO' hardcodeado
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
        const displayAvg = (unit.trim() === '%') ? formatPercent(currentAvg) : formatTMO(currentAvg);
        msg += `${meta.label} | ${displayAvg} | ${trendIcon} ${trendStr} | ${statusIcon}\n`;
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
            const diffDisp = (m.bestKpi.unit && m.bestKpi.unit.includes('%')) ? formatPercent(m.bestKpi.diff) : (m.bestKpi.unit && m.bestKpi.unit.includes('min') ? formatTMO(m.bestKpi.diff) : m.bestKpi.diff.toFixed(1) + m.bestKpi.unit);
            msg += `• ${m.name} – ${sign}${diffDisp} en ${m.bestKpi.label}\n`;
        });

        msg += `\n🚨 Tendencia negativa\n`;
        negMovers.forEach(m => {
            const sign = m.bestKpi.diff > 0 ? '+' : '';
            const diffDisp = (m.bestKpi.unit && m.bestKpi.unit.includes('%')) ? formatPercent(m.bestKpi.diff) : (m.bestKpi.unit && m.bestKpi.unit.includes('min') ? formatTMO(m.bestKpi.diff) : m.bestKpi.diff.toFixed(1) + m.bestKpi.unit);
            msg += `• ${m.name} – ${sign}${diffDisp} en ${m.bestKpi.label}\n`;
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
                const rawDiff = currentAvg - prevAvg;
                const diff = (mId === 'tmo') ? rawDiff.toFixed(1) : Math.round(rawDiff);
                const unit = (mId === 'tmo') ? 'm' : '%';
                watch.push(`La ${meta.label} disminuyó ligeramente (${diff}${unit}).`);
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


// Función auxiliar para copiar al portapapeles con fallback
function copyToClipboardFallback(text) {
    return new Promise((resolve, reject) => {
        // Intentar con navigator.clipboard primero
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(resolve)
                .catch(() => {
                    // Fallback si falla clipboard API
                    fallbackCopy(text, resolve, reject);
                });
        } else {
            // Fallback directo si no hay clipboard API
            fallbackCopy(text, resolve, reject);
        }
    });
}

function fallbackCopy(text, resolve, reject) {
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        textarea.setAttribute('readonly', '');
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        
        if (success) {
            resolve();
        } else {
            reject(new Error('execCommand copy failed'));
        }
    } catch (err) {
        reject(err);
    }
}

function copiarReporteTeams() {
    console.log('========================================');
    console.log('🟡 [COPIAR-ANTIGUO] Función copiarReporteTeams() INICIADA');
    
    const textareaElement = document.getElementById("teamsMessage");
    console.log('🟡 [COPIAR-ANTIGUO] teamsMessage encontrado:', !!textareaElement);
    
    const text = textareaElement ? textareaElement.value : '';
    console.log('🟡 [COPIAR-ANTIGUO] Texto obtenido, longitud:', text.length);
    
    if (!text || text.includes("No hay datos")) {
        console.log('🟡 [COPIAR-ANTIGUO] Texto vacío o sin datos');
        return;
    }

    // Intentar copiar con execCommand directamente
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.cssText = 'position:fixed;top:0;left:0;width:2em;height:2em;padding:0;border:none;outline:none;box-shadow:none;background:transparent;';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        
        console.log('🟡 [COPIAR-ANTIGUO] Intentando execCommand...');
        const successful = document.execCommand('copy');
        console.log('🟡 [COPIAR-ANTIGUO] execCommand resultado:', successful);
        document.body.removeChild(textarea);
        
        if (successful) {
            console.log('✅ [COPIAR-ANTIGUO] ÉXITO');
            const btn = document.querySelector('button[onclick="copiarReporteTeams()"]');
            if (btn) {
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i> ¡Copiado!';
                btn.style.background = 'var(--achs-verde)';
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.style.background = '';
                }, 2000);
            }
            // Mostrar notificación de éxito
            mostrarNotificacionCopiado();
            return;
        }
    } catch (err) {
        console.error('🔴 [COPIAR-ANTIGUO] execCommand error:', err);
    }
    
    console.log('🟡 [COPIAR-ANTIGUO] Mostrando modal de copia manual');
    // Fallback: mostrar modal para copiar manualmente
    mostrarModalCopiaManual(text);
    console.log('========================================');
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
                // Normalize after merging cached
                normalizeCurrentDataMonths(currentData);
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

                // Normalize month names after merge
                normalizeCurrentDataMonths(currentData);
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
                lbl.style.color = '#ffffff';
                lbl.style.marginTop = '6px';
                headerEl.appendChild(lbl);
            }
            lbl.style.color = '#ffffff';
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

        // Debug: listar meses disponibles actualmente
        try { console.log('Available months in currentData:', Array.from(new Set(currentData.map(d => d.mes))).sort()); } catch (e) { }

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
        // Use the selected months from the custom multi-select (support multi-select)
        // `getSelectedMonths()` returns an array of values (e.g., ['OCTUBRE','NOVIEMBRE'])
        const selectedMonths = (typeof getSelectedMonths === 'function') ? getSelectedMonths() : [];

        // Normalize selected months to full names; if none selected, use global MONTHS
        let labels;
        if (selectedMonths && selectedMonths.length > 0) {
            labels = selectedMonths.map(m => normalizeMonthName(m));
        } else {
            labels = MONTHS;
        }

        const serieLocal = agruparPorMes(currentData, execValue, resolvedKpi, labels);

        // Construir tabla: si se muestran "Todos" mostramos una columna por ejecutivo con su KPI por mes,
        // si hay un ejecutivo seleccionado mostramos una sola columna con el valor promedio por mes.
        const showingAllExec = (execValue === 'all' || execValue === 'TODOS');

        let tableHtmlLocal = '<table style="width:100%; border-collapse:collapse; margin-bottom:12px;">';
        if (showingAllExec) {
            const execNames = Array.from(new Set(currentData.map(d => d.name).filter(Boolean))).sort();
            tableHtmlLocal += '<thead><tr><th style="text-align:left; padding:6px;">Mes</th>';
            execNames.forEach(n => { 
                // Reducir a Nombre + Apellido (ej: "Astudillo Marin Manuela Soledad" -> "Soledad Astudillo")
                const nameParts = n.trim().split(' ').filter(p => p.length > 0);
                let displayName = n;
                if (nameParts.length >= 2) {
                    // Asumimos: Apellido1 Apellido2 Nombre1 Nombre2 -> Nombre1 Apellido1
                    const firstName = nameParts.length >= 3 ? nameParts[nameParts.length - 2] : nameParts[1];
                    const lastName = nameParts[0];
                    displayName = `${firstName}<br>${lastName}`;
                }
                tableHtmlLocal += `<th style="text-align:right; padding:6px; font-size:0.8rem; max-width:100px; word-wrap:break-word; line-height:1.2;">${displayName}</th>`; 
            });
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

    // Función para cerrar el modal y limpiar listeners
    function closeEvolModal() {
        try { if (evolExecSel && evolExecListener) evolExecSel.removeEventListener('change', evolExecListener); } catch (e) { }
        try { if (evolKpiSel && evolKpiListener) evolKpiSel.removeEventListener('change', evolKpiListener); } catch (e) { }
        try { if (globalExecSel) globalExecSel.removeEventListener('change', onGlobalChange); } catch (e) { }
        try { if (globalKpiSel) globalKpiSel.removeEventListener('change', onGlobalChange); } catch (e) { }
        try { const lbl = modal.querySelector('#evolExecLabel'); if (lbl && lbl.parentNode) lbl.parentNode.removeChild(lbl); } catch (e) { }
        modal.classList.remove('active');
        // Remover listeners de cierre
        document.removeEventListener('keydown', evolEscHandler);
        modal.removeEventListener('click', evolOverlayHandler);
    }

    // Handler para tecla ESC
    function evolEscHandler(e) {
        if (e.key === 'Escape') closeEvolModal();
    }

    // Handler para clic fuera del modal (en el overlay)
    function evolOverlayHandler(e) {
        if (e.target === modal) closeEvolModal();
    }

    // Close handler - botón Cerrar
    const closeBtn = document.getElementById('closeEvol');
    if (closeBtn) closeBtn.onclick = closeEvolModal;

    // Agregar listeners para ESC y clic fuera
    document.addEventListener('keydown', evolEscHandler);
    modal.addEventListener('click', evolOverlayHandler);
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
    // helper formatters
    function formatPercent(value) {
        return Math.round(value) + '%';
    }

    function formatTMO(value) {
        return Math.round(value) + ' min';
    }

    if (kpi === 'tmo') return formatTMO(v);
    return formatPercent(v);
}

let predictEscHandler = null;
let predictOverlayHandler = null;

function showPredictive() {
    // Abrir modal Predictivo usando el layout/clases original (renderPredictiveContent)
    const modal = document.getElementById('predictModal');
    const closeBtn = document.getElementById('closePredict');
    const execSel = document.getElementById('predictExecSelect');
    const kpiSel = document.getElementById('predictKpiSelect');

    if (!modal || !execSel || !kpiSel) {
        alert('Predictivo no disponible (elementos faltantes)');
        return;
    }

    // Poblar selector de ejecutivos (respeta sesi f3n ejecutivo si aplica)
    const session = JSON.parse(localStorage.getItem('userSession'));
    const isEjecutivo = session && session.rol === 'ejecutivo' && session.ejecutivo;

    if (isEjecutivo) {
        execSel.innerHTML = `<option value="${session.ejecutivo}">${session.ejecutivo}</option>`;
        execSel.value = session.ejecutivo;
        execSel.disabled = true;
    } else {
        const names = Array.from(new Set((currentData || []).map(d => d.name).filter(Boolean))).sort();
        execSel.innerHTML = '<option value="all">Todo el Equipo</option>';
        names.forEach(n => { const o = document.createElement('option'); o.value = n; o.innerText = n; execSel.appendChild(o); });
        execSel.disabled = false;
    }

    // Funci f3n para cerrar el modal
    function closePredictModal() {
        modal.classList.remove('active');
        ModalManager.unregister('predictModal');
    }

    // Abrir + registrar para ESC y click fuera (ModalManager)
    modal.classList.add('active');
    ModalManager.register('predictModal', closePredictModal);

    // Render inicial
    renderPredictiveContent();

    // Listeners (mantener simple)
    execSel.onchange = renderPredictiveContent;
    kpiSel.onchange = renderPredictiveContent;

    if (closeBtn) closeBtn.onclick = closePredictModal;
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
    if (kpi === 'tmo') return Math.round(Number(v)) + ' min';
    return Math.round(Number(v)) + '%';

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
    const container = document.getElementById('predictContainer');
    const riskMapContainer = document.getElementById('predictRiskMap');
    if (!container) return;
    container.innerHTML = '';
    
    // Cards de KPIs
    const keys = kpiSelection === 'all' ? Object.keys(metas) : [kpiSelection];
    const riskData = []; // Para el mapa de riesgo
    
    keys.forEach(k => {
        const key = resolveKpiKey(k);
        const series = agruparPorMes(currentData, ejecutivo, key);
        const pred = predictKpi(series, k);
        const estimate = Number(pred.estimate || 0);
        const lastVals = series.filter(v => Number(v) !== 0).slice(-3);
        const last = lastVals.length ? lastVals[lastVals.length - 1] : 0;
        const riskLabel = classifyRisk(estimate, k);
        const cumple = cumpleMeta(k, estimate);
        
        // Guardar para mapa de riesgo
        riskData.push({ kpi: k, estimate, risk: riskLabel, cumple, trend: pred.trend });

        // Determinar clase de riesgo para el borde izquierdo
        let riskClass = '';
        if (riskLabel === 'Alto' || !cumple) riskClass = 'predict-alert';
        else if (riskLabel === 'Medio') riskClass = 'predict-medium';
        
        const card = document.createElement('div'); card.className = 'predict-card ' + riskClass;
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
    
    // Renderizar mapa de riesgo
    if (riskMapContainer) {
        renderRiskMap(riskMapContainer, riskData, ejecutivo);
    }
}

// Renderizar mapa de riesgo visual
function renderRiskMap(container, riskData, ejecutivo) {
    const mesActual = new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
    
    let html = `
        <div style="background: var(--bg-card); border-radius: 12px; padding: 20px; border: 1px solid var(--border-color);">
            <h4 style="margin: 0 0 16px 0; color: var(--achs-azul); display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-exclamation-triangle"></i> Mapa de Riesgo - Próximo Mes
            </h4>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 16px;">
                Proyección para ${ejecutivo === 'TODOS' ? 'todo el equipo' : ejecutivo}
            </p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px;">
    `;
    
    riskData.forEach(item => {
        const bgColor = item.risk === 'Alto' ? 'rgba(220, 38, 38, 0.1)' : 
                        item.risk === 'Medio' ? 'rgba(245, 158, 11, 0.1)' : 
                        'rgba(16, 185, 129, 0.1)';
        const borderColor = item.risk === 'Alto' ? '#DC2626' : 
                           item.risk === 'Medio' ? '#F59E0B' : 
                           '#10B981';
        const emoji = item.risk === 'Alto' ? '🔴' : 
                     item.risk === 'Medio' ? '🟡' : '🟢';
        
        html += `
            <div style="background: ${bgColor}; border-left: 4px solid ${borderColor}; border-radius: 8px; padding: 12px; text-align: center;">
                <div style="font-size: 1.5rem; margin-bottom: 4px;">${emoji}</div>
                <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-main);">${item.kpi}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">${item.trend} ${item.risk}</div>
            </div>
        `;
    });
    
    html += `
            </div>
            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: center; gap: 24px; flex-wrap: wrap;">
                    <span style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--text-secondary);">
                        🟢 Bajo riesgo
                    </span>
                    <span style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--text-secondary);">
                        🟡 Riesgo medio
                    </span>
                    <span style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--text-secondary);">
                        🔴 Alto riesgo
                    </span>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
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

// ============================================
// AUTENTICACIÓN Y PERMISOS MOVIDOS A auth.js
// ============================================
// Las siguientes funciones y constantes ahora están en static/js/auth.js:
// - USERS, PERMISOS, SECCIONES_BLOQUEADAS, MENSAJES_ROL
// - login(), logout(), aplicarRol()
// - updateMobileNavUser(), updateMobileNavVisibility()
// - getCurrentUser(), getForcedExecutive()
// - initAuthSession(), initAuthListeners()
// 
// Todas están expuestas en window.* para compatibilidad global.
// ============================================

// Enviar evento de auditoría a Google Apps Script
function registrarAccesoSheets(user) {
    const ahora = new Date();

    const payload = {
        fecha: ahora.toLocaleDateString("es-CL"),
        hora: ahora.toLocaleTimeString("es-CL"),
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        navegador: navigator.userAgent
    };

    fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: "POST",
        mode: 'no-cors',
        body: JSON.stringify(payload),
        headers: {
            "Content-Type": "application/json"
        }
    })
    .then(res => {
        if (!res) return null;
        if (res.type === 'opaque') {
            console.log("Auditoría enviada (respuesta opaca no-cors)");
            return null;
        }
        return res.json().catch(() => null);
    })
    .then(data => { if (data) console.log("Auditoría OK:", data); })
    .catch(err => console.error("Error auditoría:", err));
}

// Inicializar listeners de coaching (separado de auth)
document.addEventListener('DOMContentLoaded', () => {
    // Coaching Ideas (Supervisor) - abrir/cerrar
    const btnCoaching = document.getElementById('btnCoachingIdeas');
    if (btnCoaching) {
        btnCoaching.addEventListener('click', () => {
            abrirCoachingIdeas();
        });
    }
});

let coachingEscHandler = null;
let coachingOverlayHandler = null;

function abrirCoachingIdeas() {
    const modal = document.getElementById('modalCoachingIdeas');
    if (!modal) return;
    modal.classList.add('active');
    
    // Handler para tecla ESC
    coachingEscHandler = function(e) {
        if (e.key === 'Escape') cerrarCoachingIdeas();
    };
    
    // Handler para clic fuera del modal
    coachingOverlayHandler = function(e) {
        if (e.target === modal) cerrarCoachingIdeas();
    };
    
    // Agregar listeners
    document.addEventListener('keydown', coachingEscHandler);
    modal.addEventListener('click', coachingOverlayHandler);
}

function cerrarCoachingIdeas() {
    const modal = document.getElementById('modalCoachingIdeas');
    if (!modal) return;
    modal.classList.remove('active');
    // Remover listeners
    if (coachingEscHandler) document.removeEventListener('keydown', coachingEscHandler);
    if (coachingOverlayHandler) modal.removeEventListener('click', coachingOverlayHandler);
}

// --- HISTORIAL DE RECOMENDACIONES (Persistence & Management) ---

let historialRecomendaciones = JSON.parse(localStorage.getItem('historialRecomendaciones')) || [];

function limpiarHistorialHuerfanos() {
    // [deprecated] función deshabilitada: USUARIOS_DB eliminado
    console.log('[deprecated] limpiarHistorialHuerfanos deshabilitada');
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
        const willOpen = !modal.classList.contains('active');
        modal.classList.toggle('active');
        
        if (willOpen) {
            ModalManager.register('historialModal', toggleHistorialModal);
            
            // Determinar mes más reciente presente en el historial
            let recent = null;
            for (let i = MONTHS.length - 1; i >= 0; i--) {
                const m = MONTHS[i];
                if (historialRecomendaciones.some(h => matchMonth(h.mes, m))) { recent = m; break; }
            }
            if (!recent && historialRecomendaciones.length > 0) {
                recent = (historialRecomendaciones[historialRecomendaciones.length - 1].mes || currentMonth).toString().toUpperCase();
            }
            if (!recent) recent = currentMonth || getCurrentMonthES();

            const label = document.getElementById('historialMonthLabel');
            if (label) label.innerText = `Mes: ${recent}`;

            renderHistorial(recent);
        } else {
            ModalManager.unregister('historialModal');
        }
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
    const percent = Math.round(Math.abs(((diff / previous) * 100)));

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

// --- L d3GICA PREDICTIVA (NEXT MONTH FORECAST) ---
// Nota: exist edan 2 implementaciones de `showPredictive()`.
// La versi f3n unificada (m e1s arriba en el archivo) ya implementa cierre por ESC y click fuera.
// Esta definici f3n duplicada se elimina para evitar que sobreescriba el comportamiento.

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
            <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 40px; color:var(--text-secondary); text-align: center;">
                <i class="fas fa-info-circle" style="font-size:3rem; margin-bottom:16px; color: var(--achs-azul);"></i>
                <p style="font-size: 1.1rem; margin: 0 0 16px 0;">Se requieren al menos 2 meses de datos cargados para generar predicción.</p>
                <button class="btn btn-primary" onclick="showEvolutionary()" style="margin-top:10px;">Cargar Histórico</button>
            </div>`;
        // Clear risk map too
        const riskMapContainer = document.getElementById('predictRiskMap');
        if (riskMapContainer) riskMapContainer.innerHTML = '';
        return;
    }

    let html = '';

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
            <div class="predict-card" style="background: var(--bg-card); border-radius: 10px; padding: 14px; border-left: 4px solid ${riskInfo.hex}; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 10px;">
                    <h4 style="margin:0; color:var(--achs-azul); font-size: 0.9rem; flex: 1;">${meta.label}</h4>
                    <span style="font-size:0.9rem; font-weight:700; color:${riskInfo.hex}; white-space: nowrap;">${riskInfo.color}</span>
                </div>
                <div style="margin-top: 8px;">
                    <div style="font-size:0.75rem; color:var(--text-secondary);">Riesgo: <strong>${riskInfo.label}</strong></div>
                    <div style="font-size:0.7rem; opacity:0.7;">Score: ${score.toFixed(0)}/100</div>
                </div>
                <div style="margin-top:8px; padding:8px; background:var(--bg-body); border-radius:6px; font-size:0.75rem; line-height: 1.4;">
                    <strong>🧠</strong> ${insight}
                </div>
            </div>`;
    });

    // Si es vista de equipo, añadir el Heatmap al final fuera del grid
    let heatmapHtml = '';
    if (execVal === 'all') {
        heatmapHtml = renderRiskHeatmap();
    }

    container.innerHTML = html;
    
    // Add heatmap in the risk map container
    const riskMapContainer = document.getElementById('predictRiskMap');
    if (riskMapContainer) {
        riskMapContainer.innerHTML = heatmapHtml;
    }
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
            <h3><i class="fas fa-chart-line" style="color: var(--achs-azul);"></i> Mapa de Riesgo Predictivo – Próximo Mes</h3>
            <div style="overflow-x:auto;">
                <table id="riskHeatmap">
                    <thead>
                        <tr>
                            <th style="text-align:left; position:sticky; left:0; z-index:2; background:var(--bg-body);">Ejecutivo</th>
                            ${kpis.map(kpi => `<th style="text-align:center;">${kpi.label}</th>`).join('')}
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
                <td class="risk-cell ${getRiskClass(risk.label)}" style="text-align:center;"
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
            <div style="margin-top:12px; font-size:0.8rem; color:var(--text-secondary); display:flex; gap:15px; justify-content:center; align-items:center;">
                <span style="display:flex; align-items:center; gap:4px;">🟢 Bajo Riesgo</span>
                <span style="display:flex; align-items:center; gap:4px;">🟡 Vigilancia</span>
                <span style="display:flex; align-items:center; gap:4px;">🔴 Intervención</span>
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

    // Handler para tecla ESC
    recEscHandler = function(e) {
        if (e.key === 'Escape') closeRecommendationModal();
    };
    
    // Handler para clic fuera del modal
    recOverlayHandler = function(e) {
        if (e.target === modal) closeRecommendationModal();
    };
    
    // Agregar listeners
    document.addEventListener('keydown', recEscHandler);
    modal.addEventListener('click', recOverlayHandler);

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

let oneOnOneEscHandler = null;
let oneOnOneOverlayHandler = null;

function openOneOnOneModal(executiveName) {
    const modal = document.getElementById('oneOnOneModal');
    if (!modal) return;

    modal.classList.add('active');
    const loading = document.getElementById('oneOnOneLoading');
    const content = document.getElementById('oneOnOneContent');

    if (loading) loading.style.display = 'block';
    if (content) content.innerHTML = '';

    // Handler para tecla ESC
    oneOnOneEscHandler = function(e) {
        if (e.key === 'Escape') closeOneOnOneModal();
    };
    
    // Handler para clic fuera del modal
    oneOnOneOverlayHandler = function(e) {
        if (e.target === modal) closeOneOnOneModal();
    };
    
    // Agregar listeners
    document.addEventListener('keydown', oneOnOneEscHandler);
    modal.addEventListener('click', oneOnOneOverlayHandler);

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
    if (modal) {
        modal.classList.remove('active');
        // Remover listeners
        if (oneOnOneEscHandler) document.removeEventListener('keydown', oneOnOneEscHandler);
        if (oneOnOneOverlayHandler) modal.removeEventListener('click', oneOnOneOverlayHandler);
    }
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
            const currentKpiTotal = data.kpiTotal || 0;
            const prevKpiTotal = prevData.kpiTotal || 0;
            if (currentKpiTotal > prevKpiTotal) trend = "Al alza";
            else if (currentKpiTotal < prevKpiTotal) trend = "A la baja";
        }
    }

    // 3. Previous actions
    const previousActions = historialRecomendaciones
        .filter(h => h.ejecutivo === name && h.estado === "Ejecutada")
        .slice(-2)
        .map(h => h.recomendacion)
        .join(", ") || "Ninguna registrada recientemente";

    return simulateAIOneOnOne(name, kpisValues, riskKPIs, positiveKPIs, trend, previousActions, data.quartile);
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

            <section style="padding: 15px; background: var(--bg-card); border-radius: 8px; border: 1px dashed var(--border-color); box-shadow: var(--shadow-soft);">
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

let recEscHandler = null;
let recOverlayHandler = null;

function closeRecommendationModal() {
    const modal = document.getElementById("recommendationModal");
    if (modal) {
        modal.classList.remove("active");
        if (recEscHandler) document.removeEventListener('keydown', recEscHandler);
        if (recOverlayHandler) modal.removeEventListener('click', recOverlayHandler);
    }
}

// =========================
// Nuevo: Generador de Reporte Teams Profesional
// =========================

// 🎯 BANCO DE TIPS DE COACHING POR KPI
const COACHING_TIPS = {
    tmo: [
        "⏱️ Optimiza tu workspace: Ten todas las herramientas abiertas ANTES de la llamada para evitar búsquedas durante la conversación",
        "🎯 Método 'respuesta sandwich': Saludo breve (5s) + Solución directa + Cierre confirmatorio (5s) = Eficiencia sin perder calidez",
        "📋 Practica el 'tipificado simultáneo': Marca categorías mientras el paciente habla, no después de colgar",
        "🔍 Memoriza las 5 consultas más frecuentes y sus rutas de resolución para responder automáticamente",
        "⚡ Usa atajos de teclado en Genesys - cada segundo cuenta cuando multiplicas por 50 llamadas diarias"
    ],
    satEP: [
        "😊 Los primeros 15 segundos definen el 80% de la satisfacción: Sonríe mientras hablas (se nota en el tono) y usa el nombre del paciente",
        "🎤 Evita el 'lenguaje robótico': Cambia 'El sistema indica que...' por 'Veo aquí que tu situación...' - humaniza la conversación",
        "✅ Técnica de cierre '3C': Confirmar comprensión, Consultar dudas adicionales, Cerrar con nombre personalizado",
        "💬 Valida emociones antes de solucionar: 'Entiendo tu preocupación' + pausa de 2 segundos + solución = Mayor satisfacción percibida",
        "🎯 El 'efecto recuerdo': Las últimas 3 frases son las que más recordarán - haz que cuenten con calidez genuina"
    ],
    resEP: [
        "🎯 Pregunta mágica al inicio: '¿Tienes tu número de caso a mano?' - Reduce un 40% las rellamadas por falta de contexto",
        "📊 Regla del 80/20: El 80% de las consultas tienen solución estándar - crea tu 'cheat sheet' mental de respuestas",
        "🔄 Antes de transferir pregúntate: '¿Intenté las 3 alternativas de la matriz?' - Reduce derivaciones innecesarias en 30%",
        "✋ Técnica 'pausa activa': Si no sabes la respuesta, di 'Voy a verificar el procedimiento exacto' y usa 20s para buscar - no improvises",
        "📝 Post-llamada: Anota casos no resueltos y sus causas - Identificarás patrones y cerrarás brechas de conocimiento"
    ],
    satSNL: [
        "🎭 Tu voz es tu herramienta #1: Varía el tono para mantener atención - monotonía = percepción de desinterés",
        "⏸️ Domina el silencio estratégico: Después de dar información importante, pausa 2-3s para permitir procesamiento",
        "🔊 Control de volumen: Habla 10% más fuerte en la solución principal - resalta lo importante naturalmente",
        "💝 Empatía sin excesos: Una validación emocional al inicio y otra al final - saturar con 'te entiendo' pierde efecto",
        "📞 Técnica espejo: Iguala la velocidad del habla del paciente (±10%) - Genera conexión subconsciente"
    ],
    resSNL: [
        "🎯 Diagnóstico en 30 segundos: Clasifica mentalmente la consulta (Info/Acción/Escalamiento) antes de responder",
        "📚 Construye tu biblioteca mental: 10 respuestas perfectas memorizadas > 100 respuestas improvisadas",
        "⚡ Ofrece alternativas proactivamente: 'Si esto no aplica, también puedes...' - Cierras objeciones futuras",
        "🔍 Verifica comprensión activamente: 'Para confirmar, ¿entendiste que debes...?' - Reduce rellamadas por confusión",
        "📊 Analiza tus transferencias semanales: Si >40% van al mismo destino, necesitas capacitación en ese tema específico"
    ],
    transfEPA: [
        "🎓 Conoce la matriz de derivación: El 60% de transferencias prematuras son por desconocimiento de tu alcance real",
        "💬 Script de oro antes de transferir: 'Para darte la mejor orientación médica, te conectaré con enfermería especializada'",
        "⚖️ Calibra tu criterio: Si transfieres <70% es sobre-retención, >90% es sub-utilización - El balance es 80-85%",
        "🎯 Casos 'zona gris': Si dudas por 5+ segundos, transfiere - La duda prolongada baja satisfacción más que la transferencia",
        "📋 Post-transferencia: Pregunta al paciente 'Antes de transferir, ¿hay algo más que pueda resolver YO?' - Última oportunidad de resolver"
    ],
    tipificaciones: [
        "⚡ Tipifica EN VIVO, no después: Mientras el paciente da contexto, ya tienes 70% de la tipificación lista",
        "🎯 Método de los 3 clicks: Categoria (1) > Subcategoria (2) > Resultado (3) = 10 segundos máximo",
        "🧠 Crea atajos mentales: Las 5 tipificaciones más usadas deben ser automáticas (sin pensar la ruta de clicks)",
        "✅ Verifica SIEMPRE el ✓ verde: El 90% de errores es por 'olvidar dar enter' y que no se guarde",
        "📊 Casos complejos: Si toma >15 segundos elegir categoría, usa 'Consulta general' y anota observación - No pierdas tiempo"
    ]
};

// 🎨 GENERADOR DE VISUALES PROFESIONALES
// Note: The generateTeamsReport function is defined earlier with ESC/click handlers
// This section only provides renderProfessionalTeamsUI and generarReporteTeamsProfesional

function renderProfessionalTeamsUI() {
    const modal = document.getElementById('modalTeams');
    if (!modal) return;
    
    // Actualizar estructura del modal
    const modalContent = modal.querySelector('.modal-content');
    modalContent.innerHTML = `
        <div class="modal-header modal-header-branded" style="padding: 20px 24px;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <i class="fab fa-microsoft" style="font-size: 2rem;"></i>
                <div>
                    <h2 style="margin: 0; font-size: 1.4rem;">Informe Ejecutivo ACHS</h2>
                    <p style="margin: 4px 0 0 0; font-size: 0.85rem; opacity: 0.9;">Reporte para Microsoft Teams</p>
                </div>
            </div>
        </div>

        <div class="modal-body" style="padding: 24px; max-height: 65vh; overflow-y: auto;">
            <!-- Selector de Métricas Mejorado -->
            <section style="background: linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%); padding: 16px; border-radius: 12px; margin-bottom: 20px; border: 2px solid #DBEAFE;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h4 style="margin: 0; color: #005DAA; display: flex; align-items: center; gap: 8px; font-size: 1.1rem;">
                        <i class="fas fa-sliders-h"></i> Configurar Reporte
                    </h4>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="selectAllMetrics(true)" style="padding: 6px 12px; background: white; border: 2px solid #005DAA; color: #005DAA; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.8rem; transition: all 0.2s;">
                            <i class="fas fa-check-double"></i> Todos
                        </button>
                        <button onclick="selectAllMetrics(false)" style="padding: 6px 12px; background: white; border: 2px solid #DC2626; color: #DC2626; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.8rem; transition: all 0.2s;">
                            <i class="fas fa-times"></i> Ninguno
                        </button>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px;">
                    <label style="display: flex; align-items: center; gap: 8px; padding: 10px; background: white; border-radius: 8px; cursor: pointer; border: 2px solid #E2E8F0; transition: all 0.2s;" class="metric-selector-item">
                        <input type="checkbox" value="tmo" checked onchange="generarReporteTeamsProfesional()" style="width: 16px; height: 16px; cursor: pointer; accent-color: #005DAA;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #1E293B; font-size: 0.85rem;">⏱️ TMO</div>
                        </div>
                    </label>
                    
                    <label style="display: flex; align-items: center; gap: 8px; padding: 10px; background: white; border-radius: 8px; cursor: pointer; border: 2px solid #E2E8F0; transition: all 0.2s;" class="metric-selector-item">
                        <input type="checkbox" value="satEP" checked onchange="generarReporteTeamsProfesional()" style="width: 16px; height: 16px; cursor: pointer; accent-color: #005DAA;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #1E293B; font-size: 0.85rem;">⭐ Satisfacción EP</div>
                        </div>
                    </label>
                    
                    <label style="display: flex; align-items: center; gap: 8px; padding: 10px; background: white; border-radius: 8px; cursor: pointer; border: 2px solid #E2E8F0; transition: all 0.2s;" class="metric-selector-item">
                        <input type="checkbox" value="resEP" checked onchange="generarReporteTeamsProfesional()" style="width: 16px; height: 16px; cursor: pointer; accent-color: #005DAA;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #1E293B; font-size: 0.85rem;">✅ Resolución EP</div>
                        </div>
                    </label>
                    
                    <label style="display: flex; align-items: center; gap: 8px; padding: 10px; background: white; border-radius: 8px; cursor: pointer; border: 2px solid #E2E8F0; transition: all 0.2s;" class="metric-selector-item">
                        <input type="checkbox" value="satSNL" checked onchange="generarReporteTeamsProfesional()" style="width: 16px; height: 16px; cursor: pointer; accent-color: #005DAA;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #1E293B; font-size: 0.85rem;">😊 Satisfacción SNL</div>
                        </div>
                    </label>
                    
                    <label style="display: flex; align-items: center; gap: 8px; padding: 10px; background: white; border-radius: 8px; cursor: pointer; border: 2px solid #E2E8F0; transition: all 0.2s;" class="metric-selector-item">
                        <input type="checkbox" value="resSNL" checked onchange="generarReporteTeamsProfesional()" style="width: 16px; height: 16px; cursor: pointer; accent-color: #005DAA;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #1E293B; font-size: 0.85rem;">🎯 Resolución SNL</div>
                        </div>
                    </label>
                    
                    <label style="display: flex; align-items: center; gap: 8px; padding: 10px; background: white; border-radius: 8px; cursor: pointer; border: 2px solid #E2E8F0; transition: all 0.2s;" class="metric-selector-item">
                        <input type="checkbox" value="transfEPA" checked onchange="generarReporteTeamsProfesional()" style="width: 16px; height: 16px; cursor: pointer; accent-color: #005DAA;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #1E293B; font-size: 0.85rem;">🔄 Transfer EPA</div>
                        </div>
                    </label>
                    
                    <label style="display: flex; align-items: center; gap: 8px; padding: 10px; background: white; border-radius: 8px; cursor: pointer; border: 2px solid #E2E8F0; transition: all 0.2s;" class="metric-selector-item">
                        <input type="checkbox" value="tipificaciones" checked onchange="generarReporteTeamsProfesional()" style="width: 16px; height: 16px; cursor: pointer; accent-color: #005DAA;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #1E293B; font-size: 0.85rem;">🏷️ Tipificaciones</div>
                        </div>
                    </label>
                </div>
            </section>

            <!-- Vista Previa del Reporte -->
            <section style="background: #F8FAFC; padding: 16px; border-radius: 12px; border: 1px solid #E2E8F0;">
                <h4 style="margin: 0 0 12px 0; color: #005DAA; display: flex; align-items: center; gap: 8px; font-size: 1.1rem;">
                    <i class="fas fa-file-alt"></i> Vista Previa del Reporte
                </h4>
                <div id="teamsReportPreview" style="background: white; padding: 16px; border-radius: 8px; font-family: 'Courier New', monospace; font-size: 0.85rem; line-height: 1.6; color: #1E293B; max-height: 400px; overflow-y: auto; border: 1px solid #E2E8F0; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);">
                    <!-- Contenido generado dinámicamente -->
                </div>
            </section>
        </div>

        <!-- Footer con botones -->
        <div class="modal-footer" style="padding: 16px 24px; border-top: 1px solid var(--border-color); display: flex; gap: 12px; justify-content: flex-end;">
            <button class="btn btn-secondary" onclick="generarReporteTeamsProfesional()" style="background: white; border: 2px solid #64748B; color: #64748B; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                <i class="fas fa-sync-alt"></i> Actualizar
            </button>
            <button class="btn btn-primary" onclick="copiarReporteTeamsProfesional(event)" style="background: linear-gradient(135deg, #00A859 0%, #007A3D 100%); color: white; padding: 12px 32px; border-radius: 8px; font-weight: 700; cursor: pointer; border: none; box-shadow: 0 4px 12px rgba(0,168,89,0.3); transition: all 0.2s;">
                <i class="fas fa-copy"></i> Copiar para Teams
            </button>
            <button class="btn btn-primary" onclick="cerrarModalTeams()">Cerrar</button>
        </div>
    `;
    
    // Agregar estilos hover a los checkboxes
    const style = document.createElement('style');
    style.textContent = `
        .metric-selector-item:hover {
            border-color: #005DAA !important;
            box-shadow: 0 2px 8px rgba(0, 93, 170, 0.15);
            transform: translateY(-2px);
        }
        .metric-selector-item input:checked + div {
            color: #005DAA;
        }
    `;
    document.head.appendChild(style);
}

function selectAllMetrics(select) {
    document.querySelectorAll('.metric-selector-item input[type="checkbox"]').forEach(cb => {
        cb.checked = select;
    });
    generarReporteTeamsProfesional();
}

function generarReporteTeamsProfesional() {
    const selectedMetrics = Array.from(document.querySelectorAll('.metric-selector-item input:checked')).map(cb => cb.value);
    
    if (selectedMetrics.length === 0) {
        document.getElementById('teamsReportPreview').innerHTML = '<p style="text-align: center; color: #64748B; padding: 40px;">⚠️ Selecciona al menos una métrica para generar el reporte</p>';
        return;
    }
    
    const currentMonthData = currentData.filter(d => matchMonth(d.mes, currentMonth));
    
    if (currentMonthData.length === 0) {
        document.getElementById('teamsReportPreview').innerHTML = '<p style="text-align: center; color: #DC2626; padding: 40px;">❌ No hay datos disponibles para el período seleccionado</p>';
        return;
    }
    
    const report = buildProfessionalReport(currentMonthData, selectedMetrics);
    document.getElementById('teamsReportPreview').innerHTML = `<pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word;">${report}</pre>`;
    
    // Guardar en variable global para copiar
    window.CURRENT_TEAMS_REPORT = report;
}

function buildProfessionalReport(data, metrics) {
    const fecha = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    let report = '';
    
    // 📋 ENCABEZADO PROFESIONAL (sin recuadro)
    report += `📊 INFORME DE DESEMPEÑO OPERACIONAL ACHS\n\n`;
    
    report += `📅 Período: ${currentMonth} 2026\n`;
    report += `📍 Generado: ${fecha}\n`;
    report += `👥 Ejecutivos Evaluados: ${data.length}\n`;
    report += `📊 Métricas Analizadas: ${metrics.length}\n\n`;
    
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // 🏆 TOP 3 EJECUTIVOS
    report += `🏆 TOP 3 - DESEMPEÑO DESTACADO\n\n`;
    
    const top3Global = getTop3Global(data, metrics);
    top3Global.forEach((exec, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
        const cumplidos = contarKPIsCumplidos(exec, metrics);
        
        report += `${medal} ${idx + 1}. ${exec.name}\n`;
        report += `   ├─ KPIs Cumplidos: ${cumplidos}/${metrics.length} ✓\n`;
        report += `   ├─ Cuartil: ${exec.quartile}\n`;
        report += `   └─ Métricas Destacadas:\n`;
        
        metrics.forEach(m => {
            const val = getMetricValue(exec, m);
            const meta = metas[m];
            const cumple = checkMetricCompliance(m, val, meta);
            if (cumple) {
                const icon = '      ✅';
                report += `${icon} ${getMetricName(m)}: ${formatMetricValue(m, val)}\n`;
            }
        });
        report += `\n`;
    });
    
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // 🚨 BOTTOM 4 EJECUTIVOS (Necesitan Soporte)
    report += `🚨 ÁREA DE OPORTUNIDAD - 4 EJECUTIVOS PRIORITARIOS\n\n`;
    
    const bottom4Global = getBottom4Global(data, metrics);
    bottom4Global.forEach((exec, idx) => {
        const cumplidos = contarKPIsCumplidos(exec, metrics);
        const kpisbajos = getFailedMetrics(exec, metrics);
        
        report += `${idx + 1}. ${exec.name}\n`;
        report += `   ├─ KPIs Cumplidos: ${cumplidos}/${metrics.length}\n`;
        report += `   ├─ Cuartil: ${exec.quartile}\n`;
        report += `   └─ Métricas a Mejorar:\n`;
        
        kpisbajos.forEach(m => {
            const val = getMetricValue(exec, m);
            const meta = metas[m];
            const gap = m === 'tmo' ? (val - meta).toFixed(1) : Math.round(meta - val);
            const icon = '      🔴';
            report += `${icon} ${getMetricName(m)}: ${formatMetricValue(m, val)} (Gap: ${gap}${m === 'tmo' ? ' min' : '%'})\n`;
        });
        report += `\n`;
    });
    
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // 💡 COACHING TIPS (Aleatorios y específicos)
    report += `💡 TIPS DE COACHING OPERATIVO\n\n`;
    report += `Basado en el análisis de las métricas con mayor brecha, se recomienda:\n\n`;
    
    const metricasConProblemas = getProblematicMetrics(data, metrics);
    metricasConProblemas.slice(0, 3).forEach((metricData, idx) => {
        const randomTip = COACHING_TIPS[metricData.metric][Math.floor(Math.random() * COACHING_TIPS[metricData.metric].length)];
        report += `${idx + 1}. ${getMetricName(metricData.metric).toUpperCase()}\n`;
        report += `   📊 Ejecutivos afectados: ${metricData.count}/${data.length}\n`;
        report += `   💬 "${randomTip}"\n\n`;
    });
    
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // 📈 RESUMEN ESTADÍSTICO
    report += `📈 RESUMEN ESTADÍSTICO DEL PERÍODO\n\n`;
    
    metrics.forEach(m => {
        const avg = calculateAverage(data, m);
        const meta = metas[m];
        const cumpleEquipo = checkMetricCompliance(m, avg, meta);
        const icon = cumpleEquipo ? '✅' : '⚠️';
        
        report += `${icon} ${getMetricName(m)}\n`;
        report += `   ├─ Promedio Equipo: ${formatMetricValue(m, avg)}\n`;
        report += `   ├─ Meta: ${formatMetricValue(m, meta)}\n`;
        report += `   └─ Estado: ${cumpleEquipo ? 'CUMPLE ✓' : 'REQUIERE ATENCIÓN ⚠️'}\n\n`;
    });
    
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // 🎯 RECOMENDACIONES ESTRATÉGICAS
    report += `🎯 RECOMENDACIONES ESTRATÉGICAS\n\n`;
    
    const kpiPrioritario = metricasConProblemas[0]?.metric;
    if (kpiPrioritario) {
        report += `1. PRIORIDAD MÁXIMA: Implementar plan de mejora en ${getMetricName(kpiPrioritario).toUpperCase()}\n`;
        report += `   → ${metricasConProblemas[0].count} ejecutivos requieren soporte inmediato\n\n`;
    }
    
    report += `2. COACHING DIFERENCIADO: Asignar mentores del Top 3 a ejecutivos prioritarios\n`;
    report += `   → Programa 1:1 semanal por 4 semanas\n\n`;
    
    report += `3. CALIBRACIÓN: Sesión de escucha de llamadas con todo el equipo\n`;
    report += `   → Analizar mejores prácticas de ejecutivos destacados\n\n`;
    
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // 📝 FIRMA
    report += `📝 Reporte generado automáticamente por Dashboard ACHS\n`;
    report += `   Sistema de Análisis Inteligente v2.0\n\n`;
    
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    return report;
}

// 🔧 FUNCIONES AUXILIARES
function getTop3Global(data, metrics) {
    return data.map(exec => ({
        ...exec,
        score: contarKPIsCumplidos(exec, metrics)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function getBottom4Global(data, metrics) {
    return data.map(exec => ({
        ...exec,
        score: contarKPIsCumplidos(exec, metrics)
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 4);
}

function contarKPIsCumplidos(exec, metrics) {
    return metrics.filter(m => {
        const val = getMetricValue(exec, m);
        const meta = metas[m];
        return checkMetricCompliance(m, val, meta);
    }).length;
}

function getFailedMetrics(exec, metrics) {
    return metrics.filter(m => {
        const val = getMetricValue(exec, m);
        const meta = metas[m];
        return !checkMetricCompliance(m, val, meta);
    });
}

function getMetricValue(exec, metric) {
    const keyMap = {
        tmo: 'tmo',
        satEP: 'satEp',
        resEP: 'resEp',
        satSNL: 'satSnl',
        resSNL: 'resSnl',
        transfEPA: 'transfEPA',
        tipificaciones: 'tipificaciones'
    };
    return Number(exec[keyMap[metric]]) || 0;
}

function checkMetricCompliance(metric, value, meta) {
    if (metric === 'tmo') return value <= meta;
    return value >= meta;
}

function getMetricName(metric) {
    const names = {
        tmo: 'TMO',
        satEP: 'Satisfacción EP',
        resEP: 'Resolución EP',
        satSNL: 'Satisfacción SNL',
        resSNL: 'Resolución SNL',
        transfEPA: 'Transferencia EPA',
        tipificaciones: 'Tipificaciones'
    };
    return names[metric] || metric;
}

function formatMetricValue(metric, value) {
    if (metric === 'tmo') return Math.round(value) + ' min';
    return Math.round(value) + '%';
}

// Mostrar / Ocultar modal de Tips y poblar contenido dinámicamente
let tipsEscHandler = null;
let tipsOverlayHandler = null;

function toggleTipsModal() {
    const modal = document.getElementById('tipsModal');
    if (!modal) return;
    const isOpen = modal.classList.contains('active');
    
    if (isOpen) {
        modal.classList.remove('active');
        // Remover listeners
        if (tipsEscHandler) document.removeEventListener('keydown', tipsEscHandler);
        if (tipsOverlayHandler) modal.removeEventListener('click', tipsOverlayHandler);
        return;
    }

    const tipsBody = document.getElementById('tipsBody');
    if (tipsBody) {
        // If the HTML contains user-provided tips (marked with data-user-provided), don't overwrite them
        if (tipsBody.dataset.userProvided === 'true') {
            // leave existing content as-is
        } else {
            tipsBody.innerHTML = '';
            for (const key in tipsKPI) {
                const section = document.createElement('div');
                section.style.marginBottom = '12px';
                section.className = 'tip-block';

                const title = document.createElement('div');
                title.style.fontWeight = '700';
                title.style.marginBottom = '6px';
                title.textContent = getMetricName(key) || key;
                section.appendChild(title);

                const ul = document.createElement('ul');
                ul.style.margin = '0';
                ul.style.paddingLeft = '18px';
                const pool = tipsKPI[key];
                const merged = [].concat(pool.VERDE || [], pool.AMARILLO || [], pool.ROJO || []);
                merged.slice(0, 8).forEach(t => {
                    const li = document.createElement('li');
                    li.textContent = t;
                    ul.appendChild(li);
                });
                section.appendChild(ul);

                tipsBody.appendChild(section);
            }
            tipsBody.dataset.populated = 'true';
        }
    }

    modal.classList.add('active');
    
    // Handler para tecla ESC
    tipsEscHandler = function(e) {
        if (e.key === 'Escape') toggleTipsModal();
    };
    
    // Handler para clic fuera del modal
    tipsOverlayHandler = function(e) {
        if (e.target === modal) toggleTipsModal();
    };
    
    // Agregar listeners
    document.addEventListener('keydown', tipsEscHandler);
    modal.addEventListener('click', tipsOverlayHandler);
}

function calculateAverage(data, metric) {
    const sum = data.reduce((acc, exec) => acc + getMetricValue(exec, metric), 0);
    return sum / data.length;
}

function getProblematicMetrics(data, metrics) {
    const problems = {};
    
    metrics.forEach(m => {
        const failCount = data.filter(exec => {
            const val = getMetricValue(exec, m);
            const meta = metas[m];
            return !checkMetricCompliance(m, val, meta);
        }).length;
        
        if (failCount > 0) {
            problems[m] = failCount;
        }
    });
    
    return Object.entries(problems)
        .map(([metric, count]) => ({ metric, count }))
        .sort((a, b) => b.count - a.count);
}

// ============================================
// FUNCIÓN COPIAR REPORTE TEAMS - NUEVA VERSIÓN
// ============================================
function copiarReporteTeamsProfesional(evt) {
    console.log('========================================');
    console.log('🔵 [COPIAR] Función copiarReporteTeamsProfesional INICIADA');
    console.log('🔵 [COPIAR] Evento recibido:', evt);
    console.log('🔵 [COPIAR] Tipo de evento:', evt ? evt.type : 'sin evento');
    
    // Obtener el texto del reporte desde la vista previa
    const previewElement = document.getElementById('teamsReportPreview');
    console.log('🔵 [COPIAR] previewElement encontrado:', !!previewElement);
    
    const preElement = previewElement ? previewElement.querySelector('pre') : null;
    console.log('🔵 [COPIAR] preElement (pre) encontrado:', !!preElement);
    
    // Usar el texto del elemento pre o de la variable global
    let textoACopiar = '';
    if (preElement && preElement.textContent) {
        textoACopiar = preElement.textContent;
        console.log('🔵 [COPIAR] Usando texto de preElement, longitud:', textoACopiar.length);
    } else if (window.CURRENT_TEAMS_REPORT) {
        textoACopiar = window.CURRENT_TEAMS_REPORT;
        console.log('🔵 [COPIAR] Usando texto de CURRENT_TEAMS_REPORT, longitud:', textoACopiar.length);
    } else {
        console.log('🔴 [COPIAR] NO HAY TEXTO DISPONIBLE');
    }
    
    console.log('🔵 [COPIAR] Primeros 100 chars del texto:', textoACopiar.substring(0, 100));
    
    if (!textoACopiar || textoACopiar.trim() === '') {
        console.log('🔴 [COPIAR] Texto vacío - mostrando alerta');
        alert('⚠️ Primero genera un reporte seleccionando métricas');
        return;
    }
    
    // Obtener referencia al botón para feedback visual
    let boton = null;
    if (evt && evt.currentTarget) {
        boton = evt.currentTarget;
        console.log('🔵 [COPIAR] Botón obtenido de evt.currentTarget');
    } else if (evt && evt.target) {
        boton = evt.target.closest('button');
        console.log('🔵 [COPIAR] Botón obtenido de evt.target.closest');
    }
    console.log('🔵 [COPIAR] Botón encontrado:', !!boton);
    
    const textoOriginalBoton = boton ? boton.innerHTML : '';
    
    // Crear textarea temporal para copiar
    console.log('🔵 [COPIAR] Creando textarea temporal...');
    const textareaTemp = document.createElement('textarea');
    textareaTemp.value = textoACopiar;
    
    // Posicionar fuera de vista pero accesible
    textareaTemp.style.position = 'fixed';
    textareaTemp.style.top = '0';
    textareaTemp.style.left = '0';
    textareaTemp.style.width = '2em';
    textareaTemp.style.height = '2em';
    textareaTemp.style.padding = '0';
    textareaTemp.style.border = 'none';
    textareaTemp.style.outline = 'none';
    textareaTemp.style.boxShadow = 'none';
    textareaTemp.style.background = 'transparent';
    textareaTemp.style.opacity = '0';
    
    document.body.appendChild(textareaTemp);
    console.log('🔵 [COPIAR] Textarea agregado al DOM');
    
    // Seleccionar el texto
    textareaTemp.focus();
    textareaTemp.select();
    textareaTemp.setSelectionRange(0, textareaTemp.value.length);
    console.log('🔵 [COPIAR] Texto seleccionado en textarea');
    
    let copiado = false;
    
    // Intentar copiar con execCommand
    try {
        console.log('🔵 [COPIAR] Intentando document.execCommand("copy")...');
        copiado = document.execCommand('copy');
        console.log('🔵 [COPIAR] execCommand retornó:', copiado);
    } catch (e) {
        console.error('🔴 [COPIAR] execCommand EXCEPCIÓN:', e);
    }
    
    // Limpiar textarea temporal
    document.body.removeChild(textareaTemp);
    console.log('🔵 [COPIAR] Textarea removido del DOM');
    
    if (copiado) {
        console.log('✅ [COPIAR] ÉXITO - Texto copiado correctamente');
        // Éxito - mostrar feedback
        if (boton) {
            boton.innerHTML = '<i class="fas fa-check"></i> ¡Copiado!';
            boton.style.background = '#059669';
            setTimeout(() => {
                boton.innerHTML = textoOriginalBoton;
                boton.style.background = 'linear-gradient(135deg, #00A859 0%, #007A3D 100%)';
            }, 2500);
        }
        
        // Mostrar notificación de éxito
        mostrarNotificacionCopiado();
    } else {
        console.log('🔴 [COPIAR] FALLÓ - Mostrando modal de copia manual');
        // Falló - mostrar modal para copiar manualmente
        mostrarModalCopiaManual(textoACopiar);
    }
    
    console.log('========================================');
}

function mostrarNotificacionCopiado() {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: linear-gradient(135deg, #059669 0%, #047857 100%);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        z-index: 99999;
        display: flex;
        align-items: center;
        gap: 12px;
        font-weight: 600;
        animation: slideIn 0.3s ease;
    `;
    notif.innerHTML = `<i class="fas fa-check-circle" style="font-size: 1.4rem;"></i> ¡Reporte copiado! Pégalo en Teams con Ctrl+V`;
    
    // Agregar animación
    const style = document.createElement('style');
    style.textContent = `@keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`;
    document.head.appendChild(style);
    
    document.body.appendChild(notif);
    
    setTimeout(() => {
        notif.style.opacity = '0';
        notif.style.transform = 'translateX(100px)';
        notif.style.transition = 'all 0.3s ease';
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

function mostrarModalCopiaManual(texto) {
    // Eliminar modal anterior si existe
    const modalAnterior = document.getElementById('modalCopiaManual');
    if (modalAnterior) modalAnterior.remove();
    
    const modal = document.createElement('div');
    modal.id = 'modalCopiaManual';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
    `;
    
    modal.innerHTML = `
        <div style="background: white; padding: 24px; border-radius: 16px; max-width: 700px; width: 100%; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 style="margin: 0; color: #005DAA; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-clipboard"></i> Copia el Reporte Manualmente
                </h3>
                <button onclick="document.getElementById('modalCopiaManual').remove()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #64748B; padding: 4px 8px;">&times;</button>
            </div>
            <p style="margin: 0 0 12px 0; color: #64748B; font-size: 0.9rem;">
                Haz clic en el cuadro, presiona <strong>Ctrl+A</strong> para seleccionar todo y <strong>Ctrl+C</strong> para copiar:
            </p>
            <textarea id="textoCopiaManual" readonly style="flex: 1; min-height: 300px; padding: 16px; border: 2px solid #005DAA; border-radius: 8px; font-family: 'Courier New', monospace; font-size: 0.85rem; line-height: 1.5; resize: none; background: #F8FAFC;">${texto}</textarea>
            <div style="display: flex; gap: 12px; margin-top: 16px; justify-content: flex-end;">
                <button onclick="const ta = document.getElementById('textoCopiaManual'); ta.focus(); ta.select();" style="padding: 12px 24px; background: #005DAA; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-mouse-pointer"></i> Seleccionar Todo
                </button>
                <button onclick="document.getElementById('modalCopiaManual').remove()" style="padding: 12px 24px; background: #64748B; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                    Cerrar
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Seleccionar automáticamente
    setTimeout(() => {
        const ta = document.getElementById('textoCopiaManual');
        if (ta) {
            ta.focus();
            ta.select();
        }
    }, 100);
}

// Función auxiliar para cerrar modal de copia manual con ESC
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const modal = document.getElementById('modalCopiaManual');
        if (modal) modal.remove();
    }
});

function cerrarModalTeams() {
    const modal = document.getElementById('modalTeams');
    if (modal) modal.classList.remove('active');
}

