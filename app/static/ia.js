/* ===============================
   IA OPERACIONAL – CEREBRO (external)
================================ */

const IA = {
  analizar,
  detectarRiesgos,
  recomendar,
  generarCoaching,
  // predecir delega a window.predecir si está disponible (predecir se implementa en script.js),
  // si no, intenta una proyección básica usando funciones globales si existen
  predecir: (hist) => {
    if (typeof window.predecir === 'function') return window.predecir(hist);
    // Fallback: si existen proyectarSiguiente y riesgoFuturo en global, úsalas
    const out = {};
    for (const k in hist) {
      try {
        const valores = hist[k];
        const proy = (typeof window.proyectarSiguiente === 'function') ? window.proyectarSiguiente(valores) : Math.round((valores[valores.length-1]||0));
        const estado = (typeof window.riesgoFuturo === 'function') ? window.riesgoFuturo(k, proy) : 'ok';
        out[k] = { valor: proy, estado };
      } catch (e) {
        out[k] = { valor: 0, estado: 'ok' };
      }
    }
    return out;
  }
};

// Añadir un wrapper para priorizarRiesgo que delega a la implementación en `script.js` si existe
IA.priorizarRiesgo = function(hist) {
  if (typeof window.priorizarRiesgo === 'function') return window.priorizarRiesgo(hist);
  return null;
};

function analizar(e) {
  return {
    satSNL: e.satSNL >= 95 ? "ok" : "riesgo",
    resSNL: e.resSNL >= 90 ? "ok" : "riesgo",
    satEP: e.satEP >= 95 ? "ok" : "riesgo",
    resEP: e.resEP >= 90 ? "ok" : "riesgo",
    tmo: e.tmo <= 5 ? "ok" : "riesgo",
    epa: e.epa >= 85 ? "ok" : "riesgo",
    tip: e.tip >= 95 ? "ok" : "riesgo"
  };
}

function detectarRiesgos(estado) {
  return Object.keys(estado).filter(kpi => estado[kpi] === "riesgo");
}

function recomendar(riesgos) {
  if (riesgos.includes("resEP")) {
    return "Recomendación prioritaria: mejorar el cierre de llamadas EP.";
  }

  if (riesgos.includes("tmo") && riesgos.includes("satEP")) {
    return "Recomendación prioritaria: reducir TMO sin afectar calidad.";
  }

  if (riesgos.includes("epa")) {
    return "Recomendación prioritaria: reforzar ofrecimiento de encuesta EPA.";
  }

  if (riesgos.length >= 3) {
    return "Recomendación prioritaria: coaching focalizado en múltiples KPIs.";
  }

  return "Buen desempeño general. Mantener prácticas actuales.";
}

function generarCoaching(riesgos) {
  const tips = [];

  if (riesgos.includes("satSNL") || riesgos.includes("satEP")) {
    tips.push("Refuerza empatía, tono cercano y cierre positivo.");
  }

  if (riesgos.includes("resSNL") || riesgos.includes("resEP")) {
    tips.push("Confirma siempre la resolución antes de cerrar la llamada.");
  }

  if (riesgos.includes("tmo")) {
    tips.push("Evita explicaciones largas, estructura la llamada.");
  }

  if (riesgos.includes("epa")) {
    tips.push("Usa guion corto y claro para ofrecer la encuesta.");
  }

  if (riesgos.includes("tip")) {
    tips.push("Tipifica inmediatamente al terminar la llamada.");
  }

  return tips;
}

// Exponer `IA` globalmente
// Añadir wrapper para generarAccionPreventiva si existe en el scope global
IA.generarAccionPreventiva = function(riesgo) {
  if (typeof window.generarAccionPreventiva === 'function') return window.generarAccionPreventiva(riesgo);
  return null;
};

window.IA = IA;
