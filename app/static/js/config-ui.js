/**
 * config-ui.js - Módulo de Configuración para Administradores
 * Panel de Control Operacional ACHS
 * Versión: 20260201-4
 */

(function() {
    'use strict';

    let isConfigViewActive = false;

    // ============================================
    // HELPERS Y MAPEOS
    // ============================================
    
    // Mapeo de rol (string) a role_id (int) que espera el backend
    const ROLE_ID_MAP = {
        'ejecutivo': 1,
        'supervisor': 2,
        'jefatura': 3,
        'admin': 99
    };

    // Mapeo inverso: role_id -> rol (para mostrar en UI)
    const ROLE_NAME_MAP = {
        1: 'ejecutivo',
        2: 'supervisor',
        3: 'jefatura',
        99: 'admin'
    };

    // Ruta para endpoints de admin (API_BASE ya incluye /api)
    const ADMIN_USERS_PATH = '/admin/users';

    // ============================================
    // INICIALIZACIÓN
    // ============================================
    function initAdminConfig() {
        const userRaw = localStorage.getItem('auth_user');
        let user = null;
        try { user = userRaw ? JSON.parse(userRaw) : null; } catch { user = null; }

        const rol = user && user.rol ? String(user.rol).toLowerCase() : '';

        // Actualizar nombre mostrado con nombre_mostrar si existe
        updateDisplayName(user);

        // Si no es admin, ocultar botones de config
        if (rol !== 'admin') {
            hideConfigButtons();
            return;
        }

        // Es admin: mostrar botones de configuración pero NO el panel aún
        showConfigButtons();
        
        // Inicializar tabs
        initTabs();

        console.log('[config-ui] Admin config inicializado');
    }

    // ============================================
    // MOSTRAR/OCULTAR BOTONES DE CONFIG
    // ============================================
    function showConfigButtons() {
        const btnConfig = document.getElementById('btnConfigAdmin');
        if (btnConfig) btnConfig.style.display = 'inline-flex';
        
        const mobileConfigBtn = document.getElementById('mobileConfigBtn');
        if (mobileConfigBtn) mobileConfigBtn.style.display = 'flex';
    }

    function hideConfigButtons() {
        const btnConfig = document.getElementById('btnConfigAdmin');
        if (btnConfig) btnConfig.style.display = 'none';
        
        const mobileConfigBtn = document.getElementById('mobileConfigBtn');
        if (mobileConfigBtn) mobileConfigBtn.style.display = 'none';
        
        const configRoot = document.getElementById('adminConfigRoot');
        if (configRoot) configRoot.style.display = 'none';
    }

    // ============================================
    // TOGGLE VISTA DE CONFIGURACIÓN
    // ============================================
    function toggleConfigView() {
        isConfigViewActive = !isConfigViewActive;

        const configRoot = document.getElementById('adminConfigRoot');
        const btnConfig = document.getElementById('btnConfigAdmin');
        
        // Selectores de TODAS las secciones del dashboard
        const dashboardSelectors = [
            '.filters-container',           // Filtros de mes/supervisor
            '#executiveSummaryWrapper',     // Resumen ejecutivo + podium
            '.main-wrapper',                // Contenedor principal (alertas + grid KPIs)
            '.team-kpi-summary',            // Resumen KPI del equipo
            '.ejecutivo-detail-section',    // Detalle de ejecutivo
            '.dashboard-grid'               // Grid de KPIs
        ];

        if (isConfigViewActive) {
            // Mostrar config, ocultar TODO el dashboard
            dashboardSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => el.style.display = 'none');
            });
            
            if (configRoot) {
                configRoot.style.display = 'block';
                loadUsers(); // Cargar usuarios al abrir
            }
            if (btnConfig) {
                btnConfig.innerHTML = '<i class="fas fa-arrow-left"></i> Volver al Dashboard';
                btnConfig.classList.add('btn-active');
            }
        } else {
            // Ocultar config, mostrar dashboard
            if (configRoot) configRoot.style.display = 'none';
            
            dashboardSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => el.style.display = '');
            });
            
            if (btnConfig) {
                btnConfig.innerHTML = '<i class="fas fa-cog"></i> Configuración';
                btnConfig.classList.remove('btn-active');
            }
        }
    }

    // ============================================
    // ACTUALIZAR NOMBRE MOSTRADO EN UI
    // ============================================
    function updateDisplayName(user) {
        if (!user) return;
        const displayName = user.nombre_mostrar || user.nombre || '';
        if (!displayName) return;

        // Actualizar header principal
        const userNameTxt = document.getElementById('userNameTxt');
        if (userNameTxt) {
            userNameTxt.innerText = displayName.split(' ')[0];
        }

        // Actualizar navegación móvil
        const mobileUserName = document.getElementById('mobileUserName');
        if (mobileUserName) {
            mobileUserName.textContent = displayName.split(' ')[0];
        }
    }

    // ============================================
    // SISTEMA DE TABS
    // ============================================
    function initTabs() {
        const tabBtns = document.querySelectorAll('#adminConfigRoot .tab-btn');
        const tabPanels = document.querySelectorAll('#adminConfigRoot .tab-panel');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.getAttribute('data-tab');

                // Quitar active de todos
                tabBtns.forEach(b => b.classList.remove('active'));
                tabPanels.forEach(p => p.classList.remove('active'));

                // Activar el seleccionado
                btn.classList.add('active');
                const panel = document.getElementById('tab-' + tabId);
                if (panel) panel.classList.add('active');

                // Cargar contenido según tab
                if (tabId === 'users') loadUsers();
            });
        });
    }

    // ============================================
    // GESTIÓN DE USUARIOS
    // ============================================
    async function loadUsers() {
        const container = document.getElementById('tab-users');
        if (!container) return;

        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 style="margin: 0; color: var(--text-main);">👥 Gestión de Usuarios</h3>
                <button class="btn btn-primary" onclick="window.adminConfig.openUserModal()">
                    <i class="fas fa-plus"></i> Nuevo Usuario
                </button>
            </div>
            <div id="usersTableContainer">
                <p style="color: var(--text-secondary);">Cargando usuarios...</p>
            </div>
        `;

        try {
            console.log('[config-ui] Cargando usuarios desde:', ADMIN_USERS_PATH);
            const res = await window.apiFetch(ADMIN_USERS_PATH, {
                method: 'GET'
            });

            if (res.status === 401 || res.status === 403) {
                showSessionError(container);
                return;
            }

            if (!res.ok) {
                throw new Error('Error al cargar usuarios');
            }

            const users = await res.json();
            console.log('[config-ui] Usuarios cargados:', users.length);
            renderUsersTable(users);

        } catch (e) {
            console.error('[config-ui] Error cargando usuarios:', e);
            document.getElementById('usersTableContainer').innerHTML = `
                <p style="color: var(--achs-red);">Error al cargar usuarios: ${e.message}</p>
            `;
        }
    }

    function renderUsersTable(users) {
        const container = document.getElementById('usersTableContainer');
        if (!container) return;

        if (!users || users.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">No hay usuarios registrados.</p>';
            return;
        }

        const tableHTML = `
            <div class="table-container" style="overflow-x: auto;">
                <table class="config-table" style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                    <thead>
                        <tr style="background: var(--bg-card); border-bottom: 2px solid var(--border-color);">
                            <th style="padding: 12px; text-align: left;">ID</th>
                            <th style="padding: 12px; text-align: left;">RUT</th>
                            <th style="padding: 12px; text-align: left;">Nombre</th>
                            <th style="padding: 12px; text-align: left;">Nombre Mostrar</th>
                            <th style="padding: 12px; text-align: left;">Correo</th>
                            <th style="padding: 12px; text-align: left;">Rol</th>
                            <th style="padding: 12px; text-align: center;">Activo</th>
                            <th style="padding: 12px; text-align: center;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(u => {
                            // Obtener rol desde rol (string) o role_id (int)
                            const rolStr = u.rol || ROLE_NAME_MAP[u.role_id] || '-';
                            // is_active puede venir como boolean o int
                            const isActive = u.is_active === true || u.is_active === 1;
                            return `
                            <tr style="border-bottom: 1px solid var(--border-color);">
                                <td style="padding: 10px;">${u.id}</td>
                                <td style="padding: 10px;">${escapeHtml(u.rut || '-')}</td>
                                <td style="padding: 10px;">${escapeHtml(u.nombre || '')}</td>
                                <td style="padding: 10px;">${escapeHtml(u.nombre_mostrar || '-')}</td>
                                <td style="padding: 10px;">${escapeHtml(u.correo || '')}</td>
                                <td style="padding: 10px;">
                                    <span class="role-badge role-${rolStr.toLowerCase()}">${rolStr}</span>
                                </td>
                                <td style="padding: 10px; text-align: center;">
                                    ${isActive ? '<span style="color: var(--achs-verde);">✓</span>' : '<span style="color: var(--achs-red);">✗</span>'}
                                </td>
                                <td style="padding: 10px; text-align: center;">
                                    <button class="btn-icon" onclick="window.adminConfig.openUserModal(${u.id})" title="Editar">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    ${isActive ? `
                                        <button class="btn-icon btn-danger" onclick="window.adminConfig.deactivateUser(${u.id})" title="Desactivar">
                                            <i class="fas fa-user-slash"></i>
                                        </button>
                                    ` : `
                                        <button class="btn-icon btn-success" onclick="window.adminConfig.activateUser(${u.id})" title="Activar">
                                            <i class="fas fa-user-check"></i>
                                        </button>
                                    `}
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = tableHTML;
    }

    // ============================================
    // MODAL DE USUARIO
    // ============================================
    let currentEditUserId = null;

    async function openUserModal(userId = null) {
        currentEditUserId = userId;
        let user = null;

        if (userId) {
            // Cargar datos del usuario para editar
            try {
                console.log('[config-ui] Cargando usuario para editar, id:', userId);
                const res = await window.apiFetch(ADMIN_USERS_PATH, {
                    method: 'GET'
                });
                if (res.ok) {
                    const users = await res.json();
                    user = users.find(u => u.id === userId);
                    // Normalizar: si tiene role_id pero no rol, convertir
                    if (user && user.role_id && !user.rol) {
                        user.rol = ROLE_NAME_MAP[user.role_id] || 'ejecutivo';
                    }
                    // Normalizar is_active a boolean para el checkbox
                    if (user) {
                        user.is_active = user.is_active === true || user.is_active === 1;
                    }
                    console.log('[config-ui] Usuario para editar:', user);
                }
            } catch (e) {
                console.error('[config-ui] Error cargando usuario:', e);
            }
        }

        // Crear modal con estilos inline completos para evitar conflictos con CSS global
        const modalHTML = `
            <div id="adminUserModal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); z-index: 99999; display: flex; justify-content: center; align-items: center; opacity: 1; pointer-events: all;">
                <div style="max-width: 500px; width: 95%; background: #fff; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); overflow: hidden; max-height: 90vh; display: flex; flex-direction: column;">
                    <div style="padding: 20px 24px; background: linear-gradient(135deg, #1976d2, #1565c0); color: white; display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <i class="fas fa-user-cog" style="font-size: 1.8rem;"></i>
                            <div>
                                <h2 style="margin: 0; font-size: 1.4rem;">${userId ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
                                <p style="margin: 4px 0 0 0; font-size: 0.85rem; opacity: 0.9;">Gestión de credenciales</p>
                            </div>
                        </div>
                        <button onclick="window.adminConfig.closeUserModal()" style="background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer; padding: 5px; line-height: 1;">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div style="padding: 24px; overflow-y: auto; flex: 1;">
                        <form id="adminUserForm" onsubmit="event.preventDefault(); window.adminConfig.saveUser();">
                            <div style="margin-bottom: 16px;">
                                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #333;">RUT *</label>
                                <input type="text" id="adminUserRut" required
                                    value="${escapeHtml(user?.rut || '')}"
                                    placeholder="12345678-9"
                                    style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; background: #fff; color: #333; box-sizing: border-box; font-size: 1rem;">
                            </div>
                            <div style="margin-bottom: 16px;">
                                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #333;">Nombre completo *</label>
                                <input type="text" id="adminUserNombre" required
                                    value="${escapeHtml(user?.nombre || '')}"
                                    style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; background: #fff; color: #333; box-sizing: border-box; font-size: 1rem;">
                            </div>
                            <div style="margin-bottom: 16px;">
                                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #333;">Nombre a mostrar</label>
                                <input type="text" id="adminUserNombreMostrar"
                                    value="${escapeHtml(user?.nombre_mostrar || '')}"
                                    placeholder="Ej: Juan Pérez"
                                    style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; background: #fff; color: #333; box-sizing: border-box; font-size: 1rem;">
                                <small style="color: #666; font-size: 0.8rem;">Si está vacío, se usará el nombre completo</small>
                            </div>
                            <div style="margin-bottom: 16px;">
                                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #333;">Correo *</label>
                                <input type="email" id="adminUserCorreo" required
                                    value="${escapeHtml(user?.correo || '')}"
                                    style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; background: #fff; color: #333; box-sizing: border-box; font-size: 1rem;">
                            </div>
                            <div style="margin-bottom: 16px;">
                                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #333;">Rol *</label>
                                <select id="adminUserRol" required
                                    style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; background: #fff; color: #333; box-sizing: border-box; font-size: 1rem;">
                                    <option value="ejecutivo" ${user?.rol === 'ejecutivo' ? 'selected' : ''}>Ejecutivo</option>
                                    <option value="supervisor" ${user?.rol === 'supervisor' ? 'selected' : ''}>Supervisor</option>
                                    <option value="jefatura" ${user?.rol === 'jefatura' ? 'selected' : ''}>Jefatura</option>
                                    <option value="admin" ${user?.rol === 'admin' ? 'selected' : ''}>Administrador</option>
                                </select>
                            </div>
                            <div style="margin-bottom: 16px;">
                                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #333;">
                                    Contraseña ${userId ? '(dejar vacío para no cambiar)' : '*'}
                                </label>
                                <input type="password" id="adminUserPassword" ${userId ? '' : 'required'}
                                    placeholder="${userId ? 'Sin cambios' : 'Ingrese contraseña'}"
                                    style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; background: #fff; color: #333; box-sizing: border-box; font-size: 1rem;">
                            </div>
                            <div style="margin-bottom: 16px;">
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                    <input type="checkbox" id="adminUserActivo" ${user?.is_active !== false ? 'checked' : ''}>
                                    <span style="color: #333;">Usuario activo</span>
                                </label>
                            </div>
                            <div id="adminUserFormError" style="color: #e74c3c; margin-bottom: 12px; display: none; padding: 10px; background: #ffeaea; border-radius: 6px;"></div>
                        </form>
                    </div>
                    <div style="padding: 16px 24px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 12px; background: #f9f9f9;">
                        <button onclick="window.adminConfig.closeUserModal()" style="padding: 10px 20px; border-radius: 8px; cursor: pointer; background: #e0e0e0; border: none; font-size: 1rem;">Cancelar</button>
                        <button onclick="window.adminConfig.saveUser()" style="padding: 10px 20px; border-radius: 8px; cursor: pointer; background: #1976d2; color: white; border: none; font-size: 1rem;">
                            <i class="fas fa-save"></i> Guardar
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Remover modal anterior si existe
        const existingModal = document.getElementById('adminUserModal');
        if (existingModal) existingModal.remove();

        // Insertar nuevo modal
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Focus en primer campo
        setTimeout(() => {
            const nombreInput = document.getElementById('adminUserNombre');
            if (nombreInput) nombreInput.focus();
        }, 100);
        
        console.log('[config-ui] Modal insertado y visible');
    }

    function closeUserModal() {
        const modal = document.getElementById('adminUserModal');
        if (modal) modal.remove();
        currentEditUserId = null;
    }

    async function saveUser() {
        const rut = document.getElementById('adminUserRut').value.trim();
        const nombre = document.getElementById('adminUserNombre').value.trim();
        const nombre_mostrar = document.getElementById('adminUserNombreMostrar').value.trim();
        const correo = document.getElementById('adminUserCorreo').value.trim();
        const rol = document.getElementById('adminUserRol').value;
        const password = document.getElementById('adminUserPassword').value;
        const is_active = document.getElementById('adminUserActivo').checked;
        const errorEl = document.getElementById('adminUserFormError');

        // Validación
        if (!rut || !nombre || !correo || !rol) {
            errorEl.innerText = 'Complete todos los campos requeridos (RUT, nombre, correo, rol)';
            errorEl.style.display = 'block';
            return;
        }

        if (!currentEditUserId && !password) {
            errorEl.innerText = 'La contraseña es requerida para nuevos usuarios';
            errorEl.style.display = 'block';
            return;
        }

        // Construir payload con role_id (int) e is_active (0/1) que espera el backend
        const role_id = ROLE_ID_MAP[rol.toLowerCase()] || 1;
        const payload = {
            rut,
            nombre,
            nombre_mostrar: nombre_mostrar || null,
            correo: correo || null,
            role_id: role_id,
            is_active: is_active ? 1 : 0
        };

        // Solo incluir password si tiene valor
        if (password) {
            payload.password = password;
        }

        console.log('[config-ui] saveUser payload:', payload);

        try {
            let res;
            if (currentEditUserId) {
                // PUT para editar
                console.log('[config-ui] PUT usuario:', currentEditUserId);
                res = await window.apiFetch(`${ADMIN_USERS_PATH}/${currentEditUserId}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
            } else {
                // POST para crear
                console.log('[config-ui] POST nuevo usuario');
                res = await window.apiFetch(ADMIN_USERS_PATH, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
            }

            if (res.status === 401 || res.status === 403) {
                errorEl.innerText = 'Sesión expirada o sin permisos';
                errorEl.style.display = 'block';
                return;
            }

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.detail || data.message || 'Error al guardar usuario');
            }

            console.log('[config-ui] Usuario guardado exitosamente');
            closeUserModal();
            loadUsers();

        } catch (e) {
            console.error('[config-ui] Error guardando usuario:', e);
            errorEl.innerText = e.message;
            errorEl.style.display = 'block';
        }
    }

    // ============================================
    // ACTIVAR/DESACTIVAR USUARIO
    // ============================================
    async function deactivateUser(userId) {
        if (!confirm('¿Está seguro de desactivar este usuario?')) return;

        try {
            console.log('[config-ui] Desactivando usuario:', userId);
            const res = await window.apiFetch(`${ADMIN_USERS_PATH}/${userId}`, {
                method: 'DELETE'
            });

            if (res.status === 401 || res.status === 403) {
                alert('Sesión expirada o sin permisos');
                return;
            }

            if (!res.ok) {
                throw new Error('Error al desactivar usuario');
            }

            console.log('[config-ui] Usuario desactivado exitosamente');
            loadUsers();

        } catch (e) {
            console.error('[config-ui] Error desactivando usuario:', e);
            alert('Error: ' + e.message);
        }
    }

    async function activateUser(userId) {
        try {
            console.log('[config-ui] Activando usuario:', userId);
            const res = await window.apiFetch(`${ADMIN_USERS_PATH}/${userId}`, {
                method: 'PUT',
                body: JSON.stringify({ is_active: 1 })
            });

            if (res.status === 401 || res.status === 403) {
                alert('Sesión expirada o sin permisos');
                return;
            }

            if (!res.ok) {
                throw new Error('Error al activar usuario');
            }

            console.log('[config-ui] Usuario activado exitosamente');
            loadUsers();

        } catch (e) {
            console.error('[config-ui] Error activando usuario:', e);
            alert('Error: ' + e.message);
        }
    }

    // ============================================
    // UTILIDADES
    // ============================================
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function showSessionError(container) {
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 40px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--achs-red); margin-bottom: 16px;"></i>
                <h3 style="color: var(--text-main); margin-bottom: 12px;">Sesión expirada o sin permisos</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">No tiene acceso a esta sección o su sesión ha expirado.</p>
                <button class="btn btn-primary" onclick="window.logout()" style="margin: 0 auto;">
                    <i class="fas fa-sign-out-alt"></i> Cerrar Sesión
                </button>
            </div>
        `;
    }

    // ============================================
    // EXPONER API GLOBAL
    // ============================================
    window.adminConfig = {
        init: initAdminConfig,
        toggleConfigView,
        loadUsers,
        openUserModal,
        closeUserModal,
        saveUser,
        deactivateUser,
        activateUser
    };

    // ============================================
    // INICIALIZACIÓN AL CARGAR DOM
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initAdminConfig, 100); // Esperar a que auth.js termine
        });
    } else {
        setTimeout(initAdminConfig, 100);
    }

    console.log('[config-ui] Módulo de configuración cargado');

})();
