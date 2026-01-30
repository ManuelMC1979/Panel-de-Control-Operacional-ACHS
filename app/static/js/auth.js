/**
 * auth.js - Módulo de autenticación y permisos ACHS
 * Extraído de script.js para mejor organización
 * Versión: 20260130-1
 */

// ============================================
// BASE DE USUARIOS (credenciales para demo)
// ============================================
const USERS = [
    { nombre: "Astudillo Marin Manuela Soledad", email: "msastudillom@ext.achs.cl", rol: "Ejecutivo", password: "Achs01" },
    { nombre: "Castro Cáceres Marcia Nicole", email: "mncastroc@ext.achs.cl", rol: "Ejecutivo", password: "Achs02" },
    { nombre: "Chacón Avilés Alejandra Daniela", email: "adchacona@ext.achs.cl", rol: "Ejecutivo", password: "Achs03" },
    { nombre: "Garcia Velasco Ataly Tatiana", email: "atgarciav@ext.achs.cl", rol: "Ejecutivo", password: "Achs04" },
    { nombre: "Góngora Zuleta Elsa Susana", email: "esgongoraz@ext.achs.cl", rol: "Ejecutivo", password: "Achs05" },
    { nombre: "Hald Tello Katia Liza", email: "klhaldt@ext.achs.cl", rol: "Ejecutivo", password: "Achs06" },
    { nombre: "Llancapichun Soto Johana Angelica", email: "jallancapich@ext.achs.cl", rol: "Ejecutivo", password: "Achs06" },
    { nombre: "Méndez Pérez Nanci Zobeida", email: "nzmendezp@ext.achs.cl", rol: "Ejecutivo", password: "Achs07" },
    { nombre: "Monsalve Corvacho Manuel Alejandro", email: "mamonsalvec@achs.cl", rol: "Ejecutivo", password: "Achs08" },
    { nombre: "Olivares González Maximiliano Alfonso", email: "malolivaresg@ext.achs.cl", rol: "Ejecutivo", password: "Achs09" },
    { nombre: "Orellana Mallea Ema Alejandra", email: "eorellanam@ext.achs.cl", rol: "Ejecutivo", password: "Achs10" },
    { nombre: "Penailillo Cartagena Alejandro Patricio", email: "appenailillc@ext.achs.cl", rol: "Ejecutivo", password: "Achs11" },
    { nombre: "Rodriguez Fernandez Daniela Paz", email: "dprodriguezf@ext.achs.cl", rol: "Ejecutivo", password: "Achs12" },
    { nombre: "Rodríguez Zenteno José Manuel", email: "jmrodriguezz@ext.achs.cl", rol: "Ejecutivo", password: "Achs13" },
    { nombre: "Salgado Tobar Melissa Aracelli", email: "masalgadot@ext.achs.cl", rol: "Ejecutivo", password: "Achs014" },
    { nombre: "Velasquez Perez María Loreto", email: "mlvelasquezp@ext.achs.cl", rol: "Ejecutivo", password: "Achs015" },
    { nombre: "Berra Fernandez Renzo Gabriel", email: "rgberraf@achs.cl", rol: "Jefatura", password: "AchsRenzo" },
    { nombre: "Garcia Cabello Luz Patricia", email: "lpgarciac@ext.achs.cl", rol: "Supervisor", password: "AchsLuz" },
    { nombre: "Diaz Amell Barbara Victoria", email: "bvdiaza@ext.achs.cl", rol: "Supervisor", password: "AchsBarbara" },
    { nombre: "Santander Hernández Luis Alberto", email: "lsantander@ext.achs.cl", rol: "Jefatura", password: "AchsLuis" }
];

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

// ============================================
// PERMISOS Y CONFIGURACIÓN DE ROLES
// ============================================
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
    ejecutivo: [],
    supervisor: [],
    jefatura: []
};

const MENSAJES_ROL = {
    jefatura: "Visión estratégica del desempeño operacional.",
    supervisor: "Gestión activa y control diario de plataforma.",
    ejecutivo: "Tu desempeño actual y acciones de mejora sugeridas."
};

// Variable para manejar race condition en aplicación de rol
let forcedExecutive = null;

// ============================================
// FUNCIONES DE NAVEGACIÓN MÓVIL
// ============================================
function updateMobileNavUser(userName) {
    const mobileUserName = document.getElementById('mobileUserName');
    if (mobileUserName && userName) {
        mobileUserName.textContent = userName;
    }
}

function updateMobileNavVisibility(rol) {
    // Show/hide coaching button based on role
    const coachingBtn = document.getElementById('mobileCoachingBtn');
    if (coachingBtn) {
        coachingBtn.style.display = (rol === 'supervisor') ? 'flex' : 'none';
    }
    
    // Show/hide Teams button based on role
    const mobileNavItems = document.querySelectorAll('.mobile-nav-item[data-rol]');
    mobileNavItems.forEach(item => {
        const roles = item.getAttribute('data-rol');
        if (roles) {
            item.style.display = roles.includes(rol) ? 'flex' : 'none';
        }
    });
}

// ============================================
// FUNCIÓN DE LOGIN
// ============================================
function login() {
    const email = (document.getElementById("emailLogin").value || '').trim().toLowerCase();
    const errorEl = document.getElementById("loginError");

    // Buscar en la base simple `USERS`
    const found = USERS.find(u => (u.email || '').toLowerCase() === email);

    const password = (document.getElementById('passwordLogin') && document.getElementById('passwordLogin').value) ? document.getElementById('passwordLogin').value : '';

    if (!found) {
        if (errorEl) {
            errorEl.innerText = 'Usuario no autorizado';
            errorEl.style.display = 'block';
        } else {
            alert('Usuario no autorizado');
        }
        return;
    }

    // Validar clave
    if (!password || (found.password || '') !== password) {
        if (errorEl) {
            errorEl.innerText = 'Credenciales inválidas';
            errorEl.style.display = 'block';
        } else {
            alert('Credenciales inválidas');
        }
        return;
    }

    if (errorEl) errorEl.style.display = 'none';

    // Guardar la sesión simple (según petición)
    localStorage.setItem('user', JSON.stringify(found));

    // También mantener la compatibilidad con el resto del sistema usando `userSession`
    const session = {
        rol: (found.rol || '').toLowerCase(),
        ejecutivo: found.rol === 'Ejecutivo' ? found.nombre : null,
        name: found.nombre.split(' ')[0] // Solo primer nombre
    };
    localStorage.setItem('userSession', JSON.stringify(session));

    // Ocultar Overlay y configurar UI como antes
    const overlay = document.getElementById('loginOverlay');
    if (overlay) overlay.style.display = 'none';
    const userNameTxt = document.getElementById('userNameTxt');
    if (userNameTxt) userNameTxt.innerText = session.name;
    const userInfo = document.getElementById('userInfo');
    if (userInfo) userInfo.style.display = 'block';
    
    // Update mobile navigation
    updateMobileNavUser(session.name);

    // Aplicar rol y permisos
    aplicarRol(session.rol);
}

// ============================================
// FUNCIÓN DE LOGOUT
// ============================================
function logout() {
    localStorage.removeItem("userSession");
    location.reload();
}

// ============================================
// FUNCIÓN PARA APLICAR ROL Y PERMISOS
// ============================================
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
        const podio = document.getElementById("podiumContainerInline");
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

    // Mostrar/ocultar botón de volver a Jefatura si la sesión original tiene permiso de cambio
    const returnBtn = document.getElementById('btnReturnJefatura');
    if (returnBtn) {
        let canReturn = false;
        try {
            const session = JSON.parse(localStorage.getItem('userSession') || '{}');
            if (session && session.rol && session.rol.toLowerCase() === 'jefatura') canReturn = true;
        } catch (e) { canReturn = false; }

        if (rol !== 'jefatura' && canReturn) {
            returnBtn.style.display = 'inline-flex';
        } else {
            returnBtn.style.display = 'none';
        }
    }

    // Mostrar botón 'Ideas de Coaching' sólo para rol supervisor
    const coachingBtn = document.getElementById('btnCoachingIdeas');
    if (coachingBtn) {
        if (rol === 'supervisor') coachingBtn.style.display = 'inline-flex';
        else coachingBtn.style.display = 'none';
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
    
    // Update mobile navigation visibility based on role
    updateMobileNavVisibility(rol);
    
    // Llamar a renderDashboard si está disponible (definida en script.js)
    if (typeof renderDashboard === 'function') {
        renderDashboard();
    }
}

// ============================================
// FUNCIÓN PARA OBTENER USUARIO ACTUAL
// ============================================
function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('userSession'));
    } catch (e) {
        return null;
    }
}

// ============================================
// FUNCIÓN PARA OBTENER EJECUTIVO FORZADO
// ============================================
function getForcedExecutive() {
    return forcedExecutive;
}

// ============================================
// INICIALIZACIÓN DE SESIÓN AL CARGAR
// ============================================
function initAuthSession() {
    const session = JSON.parse(localStorage.getItem('userSession'));
    const loginOverlay = document.getElementById('loginOverlay');

    if (session) {
        if (loginOverlay) loginOverlay.style.display = "none";
        const userNameTxt = document.getElementById("userNameTxt");
        if (userNameTxt) userNameTxt.innerText = session.name;
        const userInfo = document.getElementById("userInfo");
        if (userInfo) userInfo.style.display = "block";
        // Update mobile navigation
        updateMobileNavUser(session.name);
        aplicarRol(session.rol);
    } else {
        if (loginOverlay) loginOverlay.style.display = "flex";
    }
}

// ============================================
// LISTENERS DE ROL Y AUTENTICACIÓN
// ============================================
function initAuthListeners() {
    const selector = document.getElementById('rolSelector');
    if (selector) {
        selector.addEventListener('change', (e) => {
            aplicarRol(e.target.value);
        });
    }

    // Handler para volver a jefatura
    const returnBtn = document.getElementById('btnReturnJefatura');
    if (returnBtn) {
        returnBtn.addEventListener('click', () => {
            const selector = document.getElementById('rolSelector');
            if (selector) selector.value = 'jefatura';
            aplicarRol('jefatura');
        });
    }
}

// ============================================
// EXPONER FUNCIONES EN WINDOW PARA USO GLOBAL
// ============================================
window.USERS = USERS;
window.USUARIOS_DB = USUARIOS_DB;
window.PERMISOS = PERMISOS;
window.SECCIONES_BLOQUEADAS = SECCIONES_BLOQUEADAS;
window.MENSAJES_ROL = MENSAJES_ROL;
window.forcedExecutive = forcedExecutive;

window.login = login;
window.logout = logout;
window.aplicarRol = aplicarRol;
window.getCurrentUser = getCurrentUser;
window.getForcedExecutive = getForcedExecutive;
window.updateMobileNavUser = updateMobileNavUser;
window.updateMobileNavVisibility = updateMobileNavVisibility;
window.initAuthSession = initAuthSession;
window.initAuthListeners = initAuthListeners;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    initAuthListeners();
});

console.log('[auth.js] Módulo de autenticación cargado');
