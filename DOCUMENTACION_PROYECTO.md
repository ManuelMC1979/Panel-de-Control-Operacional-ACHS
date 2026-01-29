# 📊 Panel de Control Operacional ACHS - Documentación Técnica

## 🎯 Descripción General

Dashboard web para monitorear KPIs operacionales de ejecutivos de call center de ACHS (Asociación Chilena de Seguridad). Permite visualizar, analizar y generar reportes de desempeño individual y grupal.

---

## 🏗️ Arquitectura del Proyecto

### Estructura de Carpetas
```
Panel-de-Control-Operacional-ACHS/
├── app/
│   ├── index.html          # Frontend principal (SPA)
│   ├── main.py             # Backend FastAPI
│   └── static/
│       ├── script.js       # Lógica principal (~6000+ líneas)
│       ├── styles.css      # Estilos CSS (~3300+ líneas)
│       ├── ia.js           # Módulo de IA operacional
│       ├── historial.json  # Historial de recomendaciones
│       └── sw.js           # Service Worker para caché
├── Dockerfile              # Configuración Docker
├── requirements.txt        # Dependencias Python
└── Staticfile              # Config para Heroku/Cloud Foundry
```

### Stack Tecnológico
- **Frontend**: HTML5, CSS3, JavaScript Vanilla (sin frameworks)
- **Backend**: Python FastAPI
- **Base de Datos**: MySQL
- **Hosting Frontend**: https://gtrmanuelmonsalve.cl
- **API Backend**: https://api.gtrmanuelmonsalve.cl/api

---

## 🔐 Sistema de Autenticación y Roles

### Roles Disponibles
1. **Jefatura** - Acceso total, puede cambiar vistas de rol
2. **Supervisor** - Gestión de equipo, genera reportes Teams
3. **Ejecutivo** - Solo ve sus propios KPIs

### Configuración de Permisos (en script.js línea ~3969)
```javascript
const PERMISOS = {
    jefatura: { verRanking: true, enviarTeams: true, editarMetas: true, cambiarRol: true },
    supervisor: { verRanking: true, enviarTeams: true, editarMetas: false, cambiarRol: false },
    ejecutivo: { verRanking: true, enviarTeams: false, editarMetas: false, cambiarRol: false }
};
```

### Usuarios Autorizados
Los usuarios están definidos en dos estructuras:
- `USUARIOS_PERMITIDOS` (array) - Para login con contraseña
- `USUARIOS_DB` (objeto) - Mapeo email → rol/nombre

**Ubicación**: `script.js` líneas ~3905-3967

### Función de Login
- `login()` - Valida credenciales contra `USUARIOS_PERMITIDOS`
- `aplicarRol(rol)` - Aplica permisos según el rol

---

## 📈 KPIs Monitoreados

### Métricas Principales
| KPI | Meta | Descripción |
|-----|------|-------------|
| satEP | ≥95% | Satisfacción Encuesta Paciente |
| resEP | ≥90% | Resolución Encuesta Paciente |
| satSNL | ≥95% | Satisfacción SNL |
| resSNL | ≥90% | Resolución SNL |
| TMO | ≤5 min | Tiempo Medio Operación |
| transfEPA | ≥85% | Transferencia EPA |
| tipificaciones | ≥95% | Tipificaciones correctas |

### Metas Globales (script.js línea ~28)
```javascript
const metas = {
    tmo: 5, satEP: 95, resEP: 90, satSNL: 95, resSNL: 90, transfEPA: 85, tipificaciones: 95
};
```

---

## 🌐 API Endpoints (Backend FastAPI)

### Base URL
- **Desarrollo**: `http://127.0.0.1:8000/api`
- **Producción**: `https://api.gtrmanuelmonsalve.cl/api`

### Endpoints Principales
```
GET  /api/kpis/{mes}           # Obtener KPIs de un mes específico
POST /api/upload-kpis          # Subir archivos Excel de KPIs
GET  /api/health               # Health check
```

### Meses Disponibles
```javascript
const MONTHS = ['OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE', 'ENERO'];
```

---

## 🎨 Sistema de Temas

### Temas Disponibles
- **Light** (claro)
- **Dark** (oscuro)

### Variables CSS Principales
```css
--achs-azul: #005DAA;
--achs-verde: #00A859;
--achs-red: #DC2626;
--bg-body, --bg-card, --text-main, --text-secondary
```

### Toggle de Tema
- Botón en header con id `themeToggle`
- Función `toggleTheme()` en script.js
- Persiste en `localStorage`

---

## 📱 Funcionalidades Principales

### 1. Dashboard Principal
- Tarjetas de KPI por ejecutivo
- Indicadores de semáforo (verde/amarillo/rojo)
- Filtro por ejecutivo y mes

### 2. Podium/Ranking
- Top 3 ejecutivos por KPI seleccionado
- **Importante**: Visible para todos los roles (data-rol="jefatura supervisor ejecutivo")
- Ubicación HTML: `#executiveSummaryWrapper` línea ~278 en index.html

### 3. Reporte para Microsoft Teams
- Modal profesional para generar reportes
- Selección de métricas a incluir
- **Función de copiado**: `copiarReporteTeamsProfesional(evt)` (línea ~5831)
- Vista previa en elemento `#teamsReportPreview`
- Variable global: `window.CURRENT_TEAMS_REPORT`

### 4. Modal Evolutivo
- Gráfico de tendencia por ejecutivo
- Histórico multi-mes
- Usa Chart.js

### 5. Modal Predictivo
- Proyecciones de KPI
- Alertas de riesgo futuro

### 6. Ideas de Coaching (Solo Supervisores)
- Botón `#btnCoachingIdeas`
- Sugerencias basadas en KPIs críticos

---

## ⚠️ Problemas Conocidos y Soluciones

### 1. Git no está en PATH
**Problema**: Scripts PowerShell fallan porque git no está en PATH
**Solución**: Usar ruta completa
```powershell
$GitPath = "C:\Users\mamonsalvec\AppData\Local\Programs\Git\cmd\git.exe"
```

### 2. Copiar al Portapapeles
**Problema**: `navigator.clipboard.writeText()` falla en ciertos contextos
**Solución Implementada** (línea ~5831):
1. Usar `document.execCommand('copy')` con textarea temporal
2. Si falla, mostrar modal `mostrarModalCopiaManual(texto)` para copia manual

### 3. Caracteres Especiales en Rutas
**Problema**: Rutas con "ó" (Asociación) causan errores en git
**Solución**: Usar `Push-Location` / `Pop-Location` en lugar de `-C` flag

---

## 🔧 Scripts de Utilidad

### push_commit.ps1
Ubicación: `Dashboard KPI\push_commit.ps1`
```powershell
.\push_commit.ps1 "mensaje del commit"
```
- Detecta Git automáticamente en ubicaciones conocidas
- Usa rutas relativas para evitar problemas de encoding
- Hace add, commit y push en un solo comando

### clone_repo.ps1
Para clonar el repositorio desde GitHub.

---

## 🗄️ Base de Datos MySQL

### Configuración (main.py)
```python
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'database': os.getenv('DB_NAME', 'kpi_db'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', '')
}
```

### Estructura de Datos KPI
Los datos se normalizan desde archivos Excel con estructura:
- Columna 1: Nombre ejecutivo
- Columna 2+: Valores de KPI

---

## 🧠 Módulo IA (ia.js)

### Funciones Principales
```javascript
IA.analizar(ejecutivo)        // Evalúa estado de KPIs
IA.detectarRiesgos(estado)    // Identifica KPIs en riesgo
IA.recomendar(riesgos)        // Genera recomendaciones
IA.generarCoaching(riesgos)   // Tips de coaching
IA.predecir(historial)        // Proyecciones futuras
```

---

## 📋 Atributo data-rol para Visibilidad

### Uso en HTML
```html
<section data-rol="jefatura supervisor">...</section>  <!-- Solo jefatura y supervisor -->
<section data-rol="jefatura supervisor ejecutivo">...</section>  <!-- Todos los roles -->
```

### Función que Aplica Visibilidad
```javascript
function aplicarRol(rol) {
    document.querySelectorAll("[data-rol]").forEach(el => {
        const allowed = el.getAttribute("data-rol").split(" ");
        el.style.display = allowed.includes(rol) ? "" : "none";
    });
}
```

---

## 🔄 Caché y Service Worker

### SheetCache (script.js)
Sistema de caché en memoria para datos de hojas:
```javascript
const SheetCache = {
    data: {},
    get(month) { ... },
    set(month, data) { ... },
    clear() { ... }
};
```

### Service Worker (sw.js)
- Registrado en: `/static/sw.js`
- Versión actual: `v=20260129-3`
- Maneja caché de recursos estáticos

---

## 📞 Contacto y Repositorio

- **GitHub**: https://github.com/ManuelMC1979/Panel-de-Control-Operacional-ACHS
- **Dominio Frontend**: https://gtrmanuelmonsalve.cl
- **API**: https://api.gtrmanuelmonsalve.cl

---

## 📝 Notas para Futuras IAs

1. **El archivo principal es `script.js`** con ~6000+ líneas - usar grep_search para encontrar funciones específicas
2. **Los usuarios y permisos** están hardcodeados en script.js (buscar `USUARIOS_PERMITIDOS`)
3. **Para problemas de git**, usar la ruta completa: `C:\Users\mamonsalvec\AppData\Local\Programs\Git\cmd\git.exe`
4. **El script `push_commit.ps1`** ya está configurado para funcionar sin git en PATH
5. **Las funciones de copiado** deben usar `execCommand('copy')` con fallback manual
6. **La visibilidad por rol** se controla con el atributo `data-rol` en los elementos HTML

---

*Última actualización: 29 de enero de 2026*
