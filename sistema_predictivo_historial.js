/**
 * SISTEMA PREDICTIVO BASADO EN HISTORIAL DE MÉTRICAS
 * ===================================================
 * 
 * Este sistema analiza el historial de métricas de cada ejecutivo y:
 * 1. Calcula tendencias (mejorando, estable, empeorando)
 * 2. Predice si cumplirá o no las metas
 * 3. Aplica alertas visuales automáticamente
 * 4. Genera recomendaciones de acción
 */

(function () {
  'use strict';

  // ============================================================================
  // CONFIGURACIÓN
  // ============================================================================

  const CONFIG = {
    // Clave de almacenamiento en localStorage
    STORAGE_KEY: 'dashboard_metricas_historial',

    // Número de registros históricos a mantener por ejecutivo
    MAX_HISTORY_RECORDS: 30,

    // Días para considerar en el análisis de tendencia (180 días = ~6 meses)
    TREND_ANALYSIS_DAYS: 180,

    // Umbral de cambio para considerar una tendencia significativa (%)
    TREND_THRESHOLD: 2,

    // Configuración de KPIs
    KPIS: {
      'satisfaccion_snl': {
        nombre: 'Satisfacción SNL',
        tipo: 'porcentaje',
        sentido: 'mayor', // mayor es mejor
        umbrales: { verde: 95, amarillo: 90, rojo: 90 }
      },
      'satisfaccion_ep': {
        nombre: 'Satisfacción EP',
        tipo: 'porcentaje',
        sentido: 'mayor',
        umbrales: { verde: 95, amarillo: 90, rojo: 90 }
      },
      'resolucion_snl': {
        nombre: 'Resolución SNL',
        tipo: 'porcentaje',
        sentido: 'mayor',
        umbrales: { verde: 90, amarillo: 85, rojo: 85 }
      },
      'resolucion_ep': {
        nombre: 'Resolución EP',
        tipo: 'porcentaje',
        sentido: 'mayor',
        umbrales: { verde: 90, amarillo: 85, rojo: 85 }
      },
      'tmo': {
        nombre: 'TMO',
        tipo: 'minutos',
        sentido: 'menor', // menor es mejor
        umbrales: { verde: 5.00, amarillo: 6.00, rojo: 6.00 }
      },
      'epa': {
        nombre: 'Transferencia EPA',
        tipo: 'porcentaje',
        sentido: 'mayor',
        umbrales: { verde: 85, amarillo: 75, rojo: 75 }
      },
      'tipificaciones': {
        nombre: 'Tipificaciones',
        tipo: 'porcentaje',
        sentido: 'mayor',
        umbrales: { verde: 95, amarillo: 90, rojo: 90 }
      }
    }
  };

  // ============================================================================
  // GESTIÓN DE DATOS
  // ============================================================================

  class HistorialMetricas {
    constructor() {
      this.datos = this.cargarDatos();
    }

    /**
     * Carga los datos del localStorage
     */
    cargarDatos() {
      try {
        const datos = localStorage.getItem(CONFIG.STORAGE_KEY);
        return datos ? JSON.parse(datos) : {};
      } catch (error) {
        console.error('Error al cargar historial:', error);
        return {};
      }
    }

    /**
     * Guarda los datos en localStorage
     */
    guardarDatos() {
      try {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(this.datos));
      } catch (error) {
        console.error('Error al guardar historial:', error);
      }
    }

    /**
     * Registra una métrica para un ejecutivo
     * @param {string} ejecutivo - Nombre del ejecutivo
     * @param {string} kpi - ID del KPI
     * @param {number} valor - Valor de la métrica
     */
    registrarMetrica(ejecutivo, kpi, valor) {
      this.registrarMetricaConFecha(ejecutivo, kpi, valor, new Date().toISOString());
    }

    /**
     * Registra una métrica con una fecha específica
     */
    registrarMetricaConFecha(ejecutivo, kpi, valor, fechaIso) {
      if (!this.datos[ejecutivo]) {
        this.datos[ejecutivo] = {};
      }

      if (!this.datos[ejecutivo][kpi]) {
        this.datos[ejecutivo][kpi] = [];
      }

      const fecha = new Date(fechaIso);
      const registro = {
        fecha: fechaIso,
        valor: valor,
        timestamp: fecha.getTime()
      };

      // Verificar si ya existe un registro para ese KPI en ese ejecutivo EXACTAMENTE con esa fecha/valor
      // (Para evitar duplicados en cada carga de página si no ha cambiado)
      const existe = this.datos[ejecutivo][kpi].find(r => r.fecha === fechaIso && r.valor === valor);
      if (existe) return;

      this.datos[ejecutivo][kpi].push(registro);

      // Ordenar por fecha por si acaso
      this.datos[ejecutivo][kpi].sort((a, b) => a.timestamp - b.timestamp);

      // Mantener solo los últimos N registros
      if (this.datos[ejecutivo][kpi].length > CONFIG.MAX_HISTORY_RECORDS) {
        this.datos[ejecutivo][kpi] = this.datos[ejecutivo][kpi].slice(-CONFIG.MAX_HISTORY_RECORDS);
      }

      this.guardarDatos();
    }

    /**
     * Elimina del historial a los ejecutivos que no están en la lista permitida
     * @param {Array} ejecutivosValidos - Lista de nombres de ejecutivos activos
     */
    depurarHistorial(ejecutivosValidos) {
      if (!ejecutivosValidos || !Array.isArray(ejecutivosValidos)) return;

      const setValidos = new Set(ejecutivosValidos.map(n => n.trim()));
      let cambios = false;

      Object.keys(this.datos).forEach(nombre => {
        if (!setValidos.has(nombre.trim())) {
          delete this.datos[nombre];
          cambios = true;
          console.log(`🗑️ Historial eliminado para ejecutivo no activo: ${nombre}`);
        }
      });

      if (cambios) {
        this.guardarDatos();
      }
    }

    /**
     * Obtiene el historial de un KPI para un ejecutivo
     * @param {string} ejecutivo - Nombre del ejecutivo
     * @param {string} kpi - ID del KPI
     * @returns {Array} Historial de registros
     */
    obtenerHistorial(ejecutivo, kpi) {
      return this.datos[ejecutivo]?.[kpi] || [];
    }

    /**
     * Obtiene todos los KPIs de un ejecutivo
     * @param {string} ejecutivo - Nombre del ejecutivo
     * @returns {Object} Objeto con todos los KPIs
     */
    obtenerKpisEjecutivo(ejecutivo) {
      return this.datos[ejecutivo] || {};
    }
  }

  // ============================================================================
  // ANÁLISIS DE TENDENCIAS
  // ============================================================================

  class AnalizadorTendencias {
    /**
     * Calcula la tendencia de un KPI basándose en su historial
     * @param {Array} historial - Array de registros históricos
     * @param {Object} configKpi - Configuración del KPI
     * @returns {Object} Objeto con información de la tendencia
     */
    static calcularTendencia(historial, configKpi) {
      if (!historial || historial.length < 2) {
        return {
          tipo: 'sin-datos',
          direccion: 'neutral',
          cambio: 0,
          confianza: 0,
          mensaje: 'Sin datos suficientes para calcular tendencia'
        };
      }

      // Filtrar registros recientes (últimos N días)
      const fechaLimite = Date.now() - (CONFIG.TREND_ANALYSIS_DAYS * 24 * 60 * 60 * 1000);
      const registrosRecientes = historial.filter(r => r.timestamp >= fechaLimite);

      if (registrosRecientes.length < 2) {
        return {
          tipo: 'sin-datos',
          direccion: 'neutral',
          cambio: 0,
          confianza: 0,
          mensaje: 'Sin datos recientes suficientes'
        };
      }

      // Calcular regresión lineal simple
      const n = registrosRecientes.length;
      const valores = registrosRecientes.map(r => r.valor);
      const indices = registrosRecientes.map((_, i) => i);

      const sumaX = indices.reduce((a, b) => a + b, 0);
      const sumaY = valores.reduce((a, b) => a + b, 0);
      const sumaXY = indices.reduce((sum, x, i) => sum + x * valores[i], 0);
      const sumaX2 = indices.reduce((sum, x) => sum + x * x, 0);

      const pendiente = (n * sumaXY - sumaX * sumaY) / (n * sumaX2 - sumaX * sumaX);
      const intercepto = (sumaY - pendiente * sumaX) / n;

      // Calcular cambio porcentual
      const valorInicial = registrosRecientes[0].valor;
      const valorFinal = registrosRecientes[registrosRecientes.length - 1].valor;
      const cambioAbsoluto = valorFinal - valorInicial;
      const cambioPorcentual = valorInicial !== 0 ? (cambioAbsoluto / valorInicial) * 100 : 0;

      // Determinar dirección de la tendencia
      let direccion = 'neutral';
      let tipo = 'estable';

      if (Math.abs(cambioPorcentual) >= CONFIG.TREND_THRESHOLD) {
        if (configKpi.sentido === 'mayor') {
          // Para KPIs donde mayor es mejor
          if (cambioPorcentual > 0) {
            direccion = 'mejorando';
            tipo = 'mejorando';
          } else {
            direccion = 'empeorando';
            tipo = 'empeorando';
          }
        } else {
          // Para KPIs donde menor es mejor (como TMO)
          if (cambioPorcentual < 0) {
            direccion = 'mejorando';
            tipo = 'mejorando';
          } else {
            direccion = 'empeorando';
            tipo = 'empeorando';
          }
        }
      }

      // Calcular confianza (basada en consistencia de la tendencia)
      const desviacion = this.calcularDesviacionEstandar(valores);
      const promedio = sumaY / n;
      const coeficienteVariacion = promedio !== 0 ? (desviacion / promedio) * 100 : 0;
      const confianza = Math.max(0, Math.min(100, 100 - coeficienteVariacion));

      return {
        tipo,
        direccion,
        cambio: cambioPorcentual,
        cambioAbsoluto,
        pendiente,
        confianza,
        valorActual: valorFinal,
        valorAnterior: valorInicial,
        mensaje: this.generarMensajeTendencia(tipo, cambioPorcentual, configKpi)
      };
    }

    /**
     * Calcula la desviación estándar de un array de valores
     */
    static calcularDesviacionEstandar(valores) {
      const n = valores.length;
      if (n === 0) return 0;

      const promedio = valores.reduce((a, b) => a + b, 0) / n;
      const varianza = valores.reduce((sum, val) => sum + Math.pow(val - promedio, 2), 0) / n;
      return Math.sqrt(varianza);
    }

    /**
     * Genera un mensaje descriptivo de la tendencia
     */
    static generarMensajeTendencia(tipo, cambio, configKpi) {
      const cambioAbs = Math.abs(cambio).toFixed(1);

      if (tipo === 'mejorando') {
        return `📈 Mejorando: ${cambioAbs}% en los últimos ${CONFIG.TREND_ANALYSIS_DAYS} días`;
      } else if (tipo === 'empeorando') {
        return `📉 Empeorando: ${cambioAbs}% en los últimos ${CONFIG.TREND_ANALYSIS_DAYS} días`;
      } else {
        return `➡️ Estable: Variación menor al ${CONFIG.TREND_THRESHOLD}%`;
      }
    }

    /**
     * Predice si cumplirá la meta basándose en la tendencia
     */
    static predecirCumplimiento(tendencia, configKpi) {
      const { valorActual, pendiente } = tendencia;
      const { umbrales, sentido } = configKpi;

      // Proyectar valor futuro (próximos 7 días)
      const diasProyeccion = 7;
      const valorProyectado = valorActual + (pendiente * diasProyeccion);

      let cumplira = false;
      let nivelRiesgo = 'alto';

      if (sentido === 'mayor') {
        cumplira = valorProyectado >= umbrales.verde;
        if (valorProyectado >= umbrales.verde) {
          nivelRiesgo = 'bajo';
        } else if (valorProyectado >= umbrales.amarillo) {
          nivelRiesgo = 'medio';
        }
      } else {
        cumplira = valorProyectado <= umbrales.verde;
        if (valorProyectado <= umbrales.verde) {
          nivelRiesgo = 'bajo';
        } else if (valorProyectado <= umbrales.amarillo) {
          nivelRiesgo = 'medio';
        }
      }

      return {
        cumplira,
        nivelRiesgo,
        valorProyectado,
        diasProyeccion,
        mensaje: this.generarMensajePrediccion(cumplira, nivelRiesgo, valorProyectado, configKpi)
      };
    }

    /**
     * Genera mensaje de predicción
     */
    static generarMensajePrediccion(cumplira, nivelRiesgo, valorProyectado, configKpi) {
      const valor = configKpi.tipo === 'minutos'
        ? this.formatearMinutos(valorProyectado)
        : `${valorProyectado.toFixed(1)}%`;

      if (cumplira) {
        return `✅ Proyección positiva: ${valor} en 7 días`;
      } else {
        if (nivelRiesgo === 'alto') {
          return `🚨 Alerta crítica: Proyección ${valor} - Requiere acción inmediata`;
        } else {
          return `⚠️ Advertencia: Proyección ${valor} - Monitoreo cercano`;
        }
      }
    }

    /**
     * Formatea minutos a formato MM:SS
     */
    static formatearMinutos(minutos) {
      const mins = Math.floor(minutos);
      const segs = Math.round((minutos - mins) * 60);
      return `${mins}:${segs.toString().padStart(2, '0')}`;
    }
  }

  // ============================================================================
  // SISTEMA PREDICTIVO PRINCIPAL
  // ============================================================================

  class SistemaPredictivo {
    constructor() {
      this.historial = new HistorialMetricas();
      this.analizador = AnalizadorTendencias;
    }

    /**
     * Analiza un ejecutivo completo
     * @param {string} nombreEjecutivo - Nombre del ejecutivo
     * @param {Object} metricas - Objeto con las métricas actuales
     * @returns {Object} Análisis completo
     */
    analizarEjecutivo(nombreEjecutivo, metricas) {
      const analisis = {
        ejecutivo: nombreEjecutivo,
        fecha: new Date().toISOString(),
        kpis: {},
        resumen: {
          kpisEnRiesgo: 0,
          kpisCriticos: 0,
          tendenciaGeneral: 'neutral',
          requiereAccion: false
        }
      };

      let kpisMejorando = 0;
      let kpisEmpeorando = 0;

      // Analizar cada KPI
      for (const [kpiId, config] of Object.entries(CONFIG.KPIS)) {
        if (metricas[kpiId] !== undefined) {
          // Registrar métrica actual
          this.historial.registrarMetrica(nombreEjecutivo, kpiId, metricas[kpiId]);

          // Obtener historial
          const historialKpi = this.historial.obtenerHistorial(nombreEjecutivo, kpiId);

          // Calcular tendencia
          const tendencia = this.analizador.calcularTendencia(historialKpi, config);

          // Predecir cumplimiento
          const prediccion = this.analizador.predecirCumplimiento(tendencia, config);

          // Evaluar estado actual
          const estadoActual = this.evaluarEstado(metricas[kpiId], config);

          analisis.kpis[kpiId] = {
            nombre: config.nombre,
            valorActual: metricas[kpiId],
            estadoActual,
            tendencia,
            prediccion,
            historial: historialKpi
          };

          // Contabilizar para resumen
          if (prediccion.nivelRiesgo === 'alto') {
            analisis.resumen.kpisCriticos++;
          } else if (prediccion.nivelRiesgo === 'medio') {
            analisis.resumen.kpisEnRiesgo++;
          }

          if (tendencia.tipo === 'mejorando') kpisMejorando++;
          if (tendencia.tipo === 'empeorando') kpisEmpeorando++;
        }
      }

      // Determinar tendencia general
      if (kpisMejorando > kpisEmpeorando) {
        analisis.resumen.tendenciaGeneral = 'mejorando';
      } else if (kpisEmpeorando > kpisMejorando) {
        analisis.resumen.tendenciaGeneral = 'empeorando';
      }

      // Determinar si requiere acción
      analisis.resumen.requiereAccion =
        analisis.resumen.kpisCriticos > 0 ||
        analisis.resumen.kpisEnRiesgo >= 2;

      return analisis;
    }

    /**
     * Evalúa el estado actual de un KPI
     */
    evaluarEstado(valor, config) {
      const { umbrales, sentido } = config;

      if (sentido === 'mayor') {
        if (valor >= umbrales.verde) return 'verde';
        if (valor >= umbrales.amarillo) return 'amarillo';
        return 'rojo';
      } else {
        if (valor <= umbrales.verde) return 'verde';
        if (valor <= umbrales.amarillo) return 'amarillo';
        return 'rojo';
      }
    }

    /**
     * Aplica alertas visuales a las filas de la tabla
     * @param {HTMLElement} fila - Elemento TR de la tabla
     * @param {Object} analisis - Análisis del ejecutivo
     */
    aplicarAlertasVisuales(fila, analisis) {
      // Limpiar clases previas
      fila.classList.remove('predictivo-fail', 'predictivo-fail-both');

      const { kpisCriticos, kpisEnRiesgo } = analisis.resumen;

      if (kpisCriticos >= 2) {
        // Alerta crítica: 2 o más KPIs críticos
        fila.classList.add('predictivo-fail-both');
        fila.setAttribute('data-alerta', 'critica');
        fila.setAttribute('title', `🚨 Alerta Crítica: ${kpisCriticos} KPIs en riesgo alto`);
      } else if (kpisCriticos >= 1 || kpisEnRiesgo >= 2) {
        // Alerta moderada: 1 KPI crítico o 2+ en riesgo medio
        fila.classList.add('predictivo-fail');
        fila.setAttribute('data-alerta', 'moderada');
        fila.setAttribute('title', `⚠️ Alerta: ${kpisCriticos} críticos, ${kpisEnRiesgo} en riesgo`);
      }
    }

    /**
     * Genera recomendaciones de acción
     * @param {Object} analisis - Análisis del ejecutivo
     * @returns {Array} Array de recomendaciones
     */
    generarRecomendaciones(analisis) {
      const recomendaciones = [];

      for (const [kpiId, datos] of Object.entries(analisis.kpis)) {
        if (datos.prediccion.nivelRiesgo === 'alto') {
          recomendaciones.push({
            prioridad: 'alta',
            kpi: datos.nombre,
            accion: this.obtenerAccionRecomendada(kpiId, datos),
            plazo: 'inmediato'
          });
        } else if (datos.prediccion.nivelRiesgo === 'medio') {
          recomendaciones.push({
            prioridad: 'media',
            kpi: datos.nombre,
            accion: this.obtenerAccionRecomendada(kpiId, datos),
            plazo: '3-5 días'
          });
        }
      }

      return recomendaciones.sort((a, b) => {
        const prioridades = { alta: 3, media: 2, baja: 1 };
        return prioridades[b.prioridad] - prioridades[a.prioridad];
      });
    }

    /**
     * Obtiene acción recomendada para un KPI específico
     */
    obtenerAccionRecomendada(kpiId, datos) {
      const acciones = {
        'satisfaccion_snl': 'Revisar calidad de atención y feedback de clientes SNL',
        'satisfaccion_ep': 'Analizar casos de insatisfacción en EP y mejorar protocolos',
        'resolucion_snl': 'Capacitación en resolución de casos SNL complejos',
        'resolucion_ep': 'Reforzar conocimiento de procedimientos EP',
        'tmo': 'Optimizar procesos de atención para reducir tiempo promedio',
        'epa': 'Mejorar criterios de transferencia y capacitación EPA',
        'tipificaciones': 'Reforzar capacitación en tipificación correcta de casos'
      };

      return acciones[kpiId] || 'Revisar y mejorar desempeño en este indicador';
    }

    /**
     * Genera una configuración de Chart.js para visualizar la tendencia de un KPI
     * @param {string} ejecutivo Nombre del ejecutivo
     * @param {string} kpiId ID del KPI
     * @returns {Object} Objeto de configuración para Chart.js
     */
    obtenerConfiguracionGrafico(ejecutivo, kpiId) {
      const registros = this.historial.obtenerHistorial(ejecutivo, kpiId);
      if (registros.length < 2) return null;

      const def = this.CONFIG.KPIS[kpiId];
      if (!def) return null;

      const analisis = this.analizarEjecutivo(ejecutivo, { [kpiId]: registros[registros.length - 1].valor });
      const kpiAnalisis = analisis.kpis[kpiId];

      // Datos históricos
      const labels = registros.map(r => new Date(r.fecha).toLocaleDateString());
      const dataHist = registros.map(r => r.valor);

      // Proyección (último punto + proyectado)
      const proyeccion = Array(registros.length - 1).fill(null);
      proyeccion.push(registros[registros.length - 1].valor);
      proyeccion.push(kpiAnalisis.prediccion.valorProyectado);

      // Agregar label para la proyección
      labels.push("Proyección (7d)");

      return {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Historial Real',
              data: dataHist,
              borderColor: '#667eea',
              backgroundColor: 'rgba(102, 126, 234, 0.1)',
              tension: 0.3,
              fill: true,
              pointRadius: 4
            },
            {
              label: 'Proyección',
              data: proyeccion,
              borderColor: '#f5576c',
              borderDash: [5, 5],
              pointStyle: 'star',
              pointRadius: 8,
              tension: 0,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: false,
              title: {
                display: true,
                text: def.tipo === 'minutos' ? 'Minutos' : '%'
              }
            }
          },
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 12,
                font: { size: 11 }
              }
            }
          }
        }
      };
    }

    /**
     * Exporta el historial completo
     */
    exportarHistorial() {
      return this.historial.datos;
    }

    /**
     * Importa historial desde un objeto
     */
    importarHistorial(datos) {
      this.historial.datos = datos;
      this.historial.guardarDatos();
    }

    /**
     * Limpia el historial de un ejecutivo
     */
    limpiarHistorialEjecutivo(nombreEjecutivo) {
      delete this.historial.datos[nombreEjecutivo];
      this.historial.guardarDatos();
    }

    /**
     * Limpia todo el historial
     */
    limpiarTodoHistorial() {
      this.historial.datos = {};
      this.historial.guardarDatos();
    }
  }

  // ============================================================================
  // EXPORTAR AL SCOPE GLOBAL
  // ============================================================================

  window.SistemaPredictivo = SistemaPredictivo;
  window.HistorialMetricas = HistorialMetricas;
  window.AnalizadorTendencias = AnalizadorTendencias;

  // Crear instancia global
  window.sistemaPredictivo = new SistemaPredictivo();

  console.log('✅ Sistema Predictivo basado en Historial de Métricas cargado correctamente');

})();
