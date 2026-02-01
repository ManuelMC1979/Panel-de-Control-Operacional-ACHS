function initAuthListeners() {
    // Solo enganchar el botón/submit del login si existen.
    const form = document.getElementById("loginForm");
    if (form && !form.__authBound) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            if (typeof window.login === "function") window.login();
        });
        form.__authBound = true;
    }

    const btn = document.getElementById("loginBtn");
    if (btn && !btn.__authBound) {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            if (typeof window.login === "function") window.login();
        });
        btn.__authBound = true;
    }

    console.log("[auth] initAuthListeners: listeners OK");
}

window.initAuthListeners = initAuthListeners;
function initAuthSession() {
    const token = localStorage.getItem("auth_token");
    const userRaw = localStorage.getItem("auth_user");

    const loginOverlay = document.getElementById("loginOverlay");
    const userInfo = document.getElementById("userInfo");

    // Si no hay token -> mantener overlay
    if (!token) {
        if (loginOverlay) loginOverlay.style.display = "flex";
        if (userInfo) userInfo.style.display = "none";
        console.log("[auth] initAuthSession: no autenticado (overlay visible)");
        return;
    }

    // Hay token -> ocultar overlay y mostrar app
    if (loginOverlay) loginOverlay.style.display = "none";
    if (userInfo) userInfo.style.display = "block";

    // Cargar usuario (si existe) para nombre + rol
    let user = null;
    try { user = userRaw ? JSON.parse(userRaw) : null; } catch { user = null; }

    const userNameTxt = document.getElementById("userNameTxt");
    const nombre = user && user.nombre ? String(user.nombre) : "";
    if (userNameTxt && nombre) userNameTxt.innerText = nombre.split(" ")[0];

    if (nombre && typeof updateMobileNavUser === "function") {
        updateMobileNavUser(nombre.split(" ")[0]);
    }

    const rol = user && user.rol ? String(user.rol) : "";
    if (rol && typeof aplicarRol === "function") {
        aplicarRol(rol);
    }

    console.log("[auth] initAuthSession: autenticado (overlay oculto)");
}

// ============================================
// getAuthHeaders - DEBE estar FUERA de initAuthSession para estar disponible globalmente
// ============================================
function getAuthHeaders() {
    // Buscar token en múltiples claves para compatibilidad
    const token = localStorage.getItem("auth_token") 
               || localStorage.getItem("token") 
               || localStorage.getItem("authToken");
    if (token) {
        return { "Authorization": `Bearer ${token}` };
    }
    return {};
}
window.getAuthHeaders = getAuthHeaders;

// ============================================
// getAuthToken - Obtener token raw para uso externo (ej: abrir backend con token)
// ============================================
function getAuthToken() {
    // Probar claves en orden de prioridad
    const token = localStorage.getItem("auth_token") 
               || localStorage.getItem("token") 
               || localStorage.getItem("authToken");
    
    // También verificar si hay un objeto de sesión con token
    if (!token) {
        try {
            const session = localStorage.getItem("userSession");
            if (session) {
                const parsed = JSON.parse(session);
                if (parsed && parsed.token) return parsed.token;
            }
        } catch (e) {
            // Ignorar errores de parsing
        }
    }
    
    return token || null;
}
window.getAuthToken = getAuthToken;

window.initAuthSession = initAuthSession;
/**
 * auth.js - Módulo de autenticación y permisos ACHS
 * Extraído de script.js para mejor organización
 * Versión: 20260130-1
 */
// Variable placeholder para compatibilidad (puede usarse en otros módulos)
let forcedExecutive = null;

// ============================================
// API BASE URL: Debe estar definido UNA SOLA VEZ en window.API_BASE (por ejemplo, en config.js o index.html)
// Este archivo solo usa window.API_BASE y NO lo declara.

// ============================================
// FUNCIONES DE NAVEGACIÓN MÓVIL
// ============================================
function updateMobileNavUser(userName) {
    // Si existe el elemento, actualiza el nombre en la navegación móvil
    const mobileUserName = document.getElementById('mobileUserName');
    if (mobileUserName && userName) {
        mobileUserName.textContent = userName;
    }
}

function updateMobileNavVisibility(rol) {
    // Si existe el botón de coaching, mostrar solo para supervisor
    const coachingBtn = document.getElementById('mobileCoachingBtn');
    if (coachingBtn) {
        coachingBtn.style.display = (rol === 'supervisor') ? 'flex' : 'none';
    }
    // Mostrar/ocultar ítems de navegación móvil según data-rol
    const mobileNavItems = document.querySelectorAll('.mobile-nav-item[data-rol]');
    mobileNavItems.forEach(item => {
        const roles = item.getAttribute('data-rol');
        if (roles) {
            item.style.display = roles.includes(rol) ? 'flex' : 'none';
        }
    });
}

// ============================================


// ============================================
// FUNCIÓN DE LOGOUT
// ============================================
function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    // Volver al estado de login (igual que antes)
    location.reload();
}

// ============================================
// FUNCIÓN PARA APLICAR ROL Y PERMISOS
// ============================================
function aplicarRol(rol) {
    // 1) Normalizar rol a minúsculas y guardar
    const rolNormalizado = (rol || '').toString().trim().toLowerCase();
    window.__rolActivo = rolNormalizado;

    // 2) Mostrar/ocultar elementos con data-rol
    const elementos = document.querySelectorAll('[data-rol]');
    elementos.forEach(el => {
        let roles = el.getAttribute('data-rol');
        if (!roles) return;
        // Separar por coma o espacio, limpiar espacios
        roles = roles.split(/[,\s]+/).map(r => r.trim().toLowerCase()).filter(Boolean);
        if (roles.includes(rolNormalizado)) {
            // Si es mobile-nav-item, usar flex; si no, resetear
            if (el.classList && el.classList.contains('mobile-nav-item')) {
                el.style.display = 'flex';
            } else {
                el.style.display = '';
            }
        } else {
            el.style.display = 'none';
        }
    });

    // (No async logic here; aplicarRol is synchronous)
        if (typeof updateMobileNavVisibility === "function") {
            updateMobileNavVisibility(rolNormalizado);
        }
        console.log("[auth] Aplicando permisos para:", rolNormalizado);
    }

function mostrarError(msg) {
    const errorEl = document.getElementById("loginError");
    if (errorEl) {
        errorEl.innerText = msg;
        errorEl.style.display = "block";
    } else {
        alert(msg);
    }
}

async function login() {
    const emailInput = document.getElementById("emailLogin");
    const passwordInput = document.getElementById("passwordLogin");
    const errorEl = document.getElementById("loginError");

    const email = emailInput ? (emailInput.value || "").trim().toLowerCase() : "";
    const password = passwordInput ? (passwordInput.value || "") : "";

    if (!email || !password) {
        mostrarError("Debe ingresar correo y clave");
        return false;
    }

    try {
        if (!window.API_BASE) {
            mostrarError("API_BASE no está definido en window.");
            return false;
        }
        const res = await fetch(`${window.API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        const raw = await res.text();
        let result = null;
        try { result = raw ? JSON.parse(raw) : null; } catch { result = null; }

        console.log("[auth] login response", "status=", res.status, "raw=", raw);

        if (!res.ok) {
            const msg = result?.detail || result?.message || "Error de autenticación";
            mostrarError(msg);
            return false;
        }

        const token = result?.token;
        const usuario = result?.usuario;

        if (!token) {
            mostrarError("Respuesta inválida del servidor (sin token)");
            return false;
        }

                localStorage.setItem("auth_token", token);

                if (usuario && typeof usuario === "object") {
                        const safeUser = {};
                        if ("id" in usuario) safeUser.id = usuario.id;
                        if ("nombre" in usuario) safeUser.nombre = usuario.nombre;
                        if ("correo" in usuario) safeUser.correo = usuario.correo;
                        if ("rol" in usuario) safeUser.rol = usuario.rol;
                        localStorage.setItem("auth_user", JSON.stringify(safeUser));
                } else {
                        localStorage.setItem("auth_user", JSON.stringify({}));
                }

                const overlay = document.getElementById("loginOverlay");
                if (overlay) overlay.style.display = "none";

                const userInfo = document.getElementById("userInfo");
                if (userInfo) userInfo.style.display = "block";

                const userNameTxt = document.getElementById("userNameTxt");
                const nombre = usuario && usuario.nombre ? String(usuario.nombre) : "";
                if (userNameTxt && nombre) userNameTxt.innerText = nombre.split(" ")[0];

                if (nombre) updateMobileNavUser(nombre.split(" ")[0]);

                if (usuario && usuario.rol && typeof aplicarRol === "function") {
                        aplicarRol(usuario.rol);
                }

                if (errorEl) errorEl.style.display = "none";

                // Forzar reinicio del flujo de carga con sesión ya persistida
                try {
                    console.log("[auth] login ok -> recargando para inicializar app con sesión");
                    setTimeout(() => {
                        // reload "limpio" sin duplicar historial
                        window.location.replace(window.location.href);
                    }, 50);
                } catch (e) {
                    // fallback seguro
                    window.location.reload();
                }
                return true;
    } catch (e) {
        mostrarError("Error de conexión con el servidor");
        return false;
    }
window.login = login;
window.logout = logout;
window.aplicarRol = aplicarRol;
window.initAuthSession = initAuthSession;
window.initAuthListeners = initAuthListeners;
window.updateMobileNavUser = updateMobileNavUser;
window.updateMobileNavVisibility = updateMobileNavVisibility;
}
document.addEventListener('DOMContentLoaded', () => {
    initAuthSession();
    initAuthListeners();
});

console.log('[auth.js] Módulo de autenticación cargado (login real backend)');
