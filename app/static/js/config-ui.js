/**
 * config-ui.js - Módulo de Configuración para Administradores
 * Panel de Control Operacional ACHS
 * Versión: 20260201-1
 */

(function() {
    'use strict';

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

        // Si no es admin, no mostrar configuración
        if (rol !== 'admin') {
            const configRoot = document.getElementById('adminConfigRoot');
            if (configRoot) configRoot.style.display = 'none';
            return;
        }

        // Es admin: mostrar sección de configuración
        const configRoot = document.getElementById('adminConfigRoot');
        if (configRoot) {
            configRoot.style.display = 'block';
            initTabs();
            loadUsers();
        }

        console.log('[config-ui] Admin config inicializado');
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
            const res = await window.apiFetch('/admin/users', {
                method: 'GET',
                headers: window.getAuthHeaders ? window.getAuthHeaders() : {}
            });

            if (res.status === 401 || res.status === 403) {
                showSessionError(container);
                return;
            }

            if (!res.ok) {
                throw new Error('Error al cargar usuarios');
            }

            const users = await res.json();
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
                            <th style="padding: 12px; text-align: left;">Nombre</th>
                            <th style="padding: 12px; text-align: left;">Nombre Mostrar</th>
                            <th style="padding: 12px; text-align: left;">Correo</th>
                            <th style="padding: 12px; text-align: left;">Rol</th>
                            <th style="padding: 12px; text-align: center;">Activo</th>
                            <th style="padding: 12px; text-align: center;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(u => `
                            <tr style="border-bottom: 1px solid var(--border-color);">
                                <td style="padding: 10px;">${u.id}</td>
                                <td style="padding: 10px;">${escapeHtml(u.nombre || '')}</td>
                                <td style="padding: 10px;">${escapeHtml(u.nombre_mostrar || '-')}</td>
                                <td style="padding: 10px;">${escapeHtml(u.correo || '')}</td>
                                <td style="padding: 10px;">
                                    <span class="role-badge role-${(u.rol || '').toLowerCase()}">${u.rol || '-'}</span>
                                </td>
                                <td style="padding: 10px; text-align: center;">
                                    ${u.is_active ? '<span style="color: var(--achs-verde);">✓</span>' : '<span style="color: var(--achs-red);">✗</span>'}
                                </td>
                                <td style="padding: 10px; text-align: center;">
                                    <button class="btn-icon" onclick="window.adminConfig.openUserModal(${u.id})" title="Editar">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    ${u.is_active ? `
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
                        `).join('')}
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
                const res = await window.apiFetch('/admin/users', {
                    method: 'GET',
                    headers: window.getAuthHeaders ? window.getAuthHeaders() : {}
                });
                if (res.ok) {
                    const users = await res.json();
                    user = users.find(u => u.id === userId);
                }
            } catch (e) {
                console.error('[config-ui] Error cargando usuario:', e);
            }
        }

        const modalHTML = `
            <div class="modal-overlay" id="userModal" style="display: flex; z-index: 3000;">
                <div class="modal-content" style="max-width: 500px; width: 95%;">
                    <div class="modal-header modal-header-branded" style="padding: 20px 24px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <i class="fas fa-user-cog" style="font-size: 1.8rem;"></i>
                            <div>
                                <h2 style="margin: 0; font-size: 1.4rem;">${userId ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
                                <p style="margin: 4px 0 0 0; font-size: 0.85rem; opacity: 0.9;">Gestión de credenciales</p>
                            </div>
                        </div>
                        <button class="close-modal" onclick="window.adminConfig.closeUserModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body" style="padding: 24px;">
                        <form id="userForm">
                            <div class="form-group" style="margin-bottom: 16px;">
                                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--text-main);">Nombre completo *</label>
                                <input type="text" id="userNombre" class="form-input" required
                                    value="${escapeHtml(user?.nombre || '')}"
                                    style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-card); color: var(--text-main);">
                            </div>
                            <div class="form-group" style="margin-bottom: 16px;">
                                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--text-main);">Nombre a mostrar</label>
                                <input type="text" id="userNombreMostrar" class="form-input"
                                    value="${escapeHtml(user?.nombre_mostrar || '')}"
                                    placeholder="Ej: Juan Pérez"
                                    style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-card); color: var(--text-main);">
                                <small style="color: var(--text-secondary); font-size: 0.8rem;">Si está vacío, se usará el nombre completo</small>
                            </div>
                            <div class="form-group" style="margin-bottom: 16px;">
                                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--text-main);">Correo *</label>
                                <input type="email" id="userCorreo" class="form-input" required
                                    value="${escapeHtml(user?.correo || '')}"
                                    style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-card); color: var(--text-main);">
                            </div>
                            <div class="form-group" style="margin-bottom: 16px;">
                                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--text-main);">Rol *</label>
                                <select id="userRol" class="form-input" required
                                    style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-card); color: var(--text-main);">
                                    <option value="ejecutivo" ${user?.rol === 'ejecutivo' ? 'selected' : ''}>Ejecutivo</option>
                                    <option value="supervisor" ${user?.rol === 'supervisor' ? 'selected' : ''}>Supervisor</option>
                                    <option value="jefatura" ${user?.rol === 'jefatura' ? 'selected' : ''}>Jefatura</option>
                                    <option value="admin" ${user?.rol === 'admin' ? 'selected' : ''}>Administrador</option>
                                </select>
                            </div>
                            <div class="form-group" style="margin-bottom: 16px;">
                                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--text-main);">
                                    Contraseña ${userId ? '(dejar vacío para no cambiar)' : '*'}
                                </label>
                                <input type="password" id="userPassword" class="form-input" ${userId ? '' : 'required'}
                                    placeholder="${userId ? 'Sin cambios' : 'Ingrese contraseña'}"
                                    style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-card); color: var(--text-main);">
                            </div>
                            <div class="form-group" style="margin-bottom: 16px;">
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                    <input type="checkbox" id="userActivo" ${user?.is_active !== false ? 'checked' : ''}>
                                    <span style="color: var(--text-main);">Usuario activo</span>
                                </label>
                            </div>
                            <div id="userFormError" style="color: var(--achs-red); margin-bottom: 12px; display: none;"></div>
                        </form>
                    </div>
                    <div class="modal-footer" style="padding: 16px 24px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 12px;">
                        <button class="btn btn-secondary" onclick="window.adminConfig.closeUserModal()">Cancelar</button>
                        <button class="btn btn-primary" onclick="window.adminConfig.saveUser()">
                            <i class="fas fa-save"></i> Guardar
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Remover modal anterior si existe
        const existingModal = document.getElementById('userModal');
        if (existingModal) existingModal.remove();

        // Insertar nuevo modal
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    function closeUserModal() {
        const modal = document.getElementById('userModal');
        if (modal) modal.remove();
        currentEditUserId = null;
    }

    async function saveUser() {
        const nombre = document.getElementById('userNombre').value.trim();
        const nombre_mostrar = document.getElementById('userNombreMostrar').value.trim();
        const correo = document.getElementById('userCorreo').value.trim();
        const rol = document.getElementById('userRol').value;
        const password = document.getElementById('userPassword').value;
        const is_active = document.getElementById('userActivo').checked;
        const errorEl = document.getElementById('userFormError');

        // Validación
        if (!nombre || !correo || !rol) {
            errorEl.innerText = 'Complete todos los campos requeridos';
            errorEl.style.display = 'block';
            return;
        }

        if (!currentEditUserId && !password) {
            errorEl.innerText = 'La contraseña es requerida para nuevos usuarios';
            errorEl.style.display = 'block';
            return;
        }

        const payload = {
            nombre,
            nombre_mostrar: nombre_mostrar || null,
            correo,
            rol,
            is_active
        };

        if (password) {
            payload.password = password;
        }

        try {
            let res;
            if (currentEditUserId) {
                // PUT para editar
                res = await window.apiFetch(`/admin/users/${currentEditUserId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(window.getAuthHeaders ? window.getAuthHeaders() : {})
                    },
                    body: JSON.stringify(payload)
                });
            } else {
                // POST para crear
                res = await window.apiFetch('/admin/users', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(window.getAuthHeaders ? window.getAuthHeaders() : {})
                    },
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
            const res = await window.apiFetch(`/admin/users/${userId}`, {
                method: 'DELETE',
                headers: window.getAuthHeaders ? window.getAuthHeaders() : {}
            });

            if (res.status === 401 || res.status === 403) {
                alert('Sesión expirada o sin permisos');
                return;
            }

            if (!res.ok) {
                throw new Error('Error al desactivar usuario');
            }

            loadUsers();

        } catch (e) {
            console.error('[config-ui] Error desactivando usuario:', e);
            alert('Error: ' + e.message);
        }
    }

    async function activateUser(userId) {
        try {
            const res = await window.apiFetch(`/admin/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(window.getAuthHeaders ? window.getAuthHeaders() : {})
                },
                body: JSON.stringify({ is_active: true })
            });

            if (res.status === 401 || res.status === 403) {
                alert('Sesión expirada o sin permisos');
                return;
            }

            if (!res.ok) {
                throw new Error('Error al activar usuario');
            }

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
            <div style="text-align: center; padding: 40px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--achs-red); margin-bottom: 16px;"></i>
                <h3 style="color: var(--text-main); margin-bottom: 12px;">Sesión expirada o sin permisos</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">No tiene acceso a esta sección o su sesión ha expirado.</p>
                <button class="btn btn-primary" onclick="window.logout()">
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
