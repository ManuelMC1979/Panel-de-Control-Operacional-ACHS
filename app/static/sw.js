// Service Worker - Cache Buster
// La versión se pasa via URL param desde index.html

const CACHE_PREFIX = 'kpi-cache-';

// Extensiones y paths que NUNCA se cachean (siempre network)
const NO_CACHE_EXTENSIONS = ['.js', '.css', '.html'];
const NO_CACHE_PATHS = ['/api/'];

// Obtener versión desde URL de registro
const SW_URL = new URL(self.location.href);
const BUILD_VERSION = SW_URL.searchParams.get('v') || 'unknown';
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_VERSION}`;

console.log(`[SW] Iniciando v${BUILD_VERSION}, CACHE_NAME=${CACHE_NAME}`);

// Evaluar si debe bypassear cache basado en pathname
function shouldBypassCache(url) {
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname.toLowerCase();
    
    // Verificar extensiones
    for (const ext of NO_CACHE_EXTENSIONS) {
      if (pathname.endsWith(ext)) return true;
    }
    
    // Verificar paths
    for (const path of NO_CACHE_PATHS) {
      if (pathname.includes(path)) return true;
    }
    
    return false;
  } catch (e) {
    return true; // En caso de error, no cachear
  }
}

self.addEventListener('install', event => {
  console.log(`[SW] Install - BUILD: ${BUILD_VERSION}`);
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log(`[SW] Activate - BUILD: ${BUILD_VERSION}`);
  event.waitUntil((async () => {
    // Eliminar SOLO caches con CACHE_PREFIX que no sean el actual
    const cacheNames = await caches.keys();
    const deletions = cacheNames
      .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => {
        console.log(`[SW] Eliminando cache: ${name}`);
        return caches.delete(name);
      });
    
    await Promise.all(deletions);
    console.log(`[SW] Caches limpiados. Solo queda: ${CACHE_NAME}`);
    
    await self.clients.claim();
    console.log(`[SW] Activado y controlando clientes`);
  })());
});

self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // NO cachear JS, CSS, HTML, API - siempre network-only
  if (shouldBypassCache(url)) {
    event.respondWith(
      fetch(event.request).catch(err => {
        console.warn(`[SW] Network error for ${url}:`, err);
        return new Response('Network error', { status: 503 });
      })
    );
    return;
  }
  
  // Para otros recursos (fonts, imágenes): cache-first
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(event.request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    try {
      const networkResponse = await fetch(event.request);
      if (networkResponse.ok) {
        cache.put(event.request, networkResponse.clone());
      }
      return networkResponse;
    } catch (err) {
      console.warn(`[SW] Fetch failed for ${url}`);
      return new Response('Resource unavailable', { status: 503 });
    }
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    console.log('[SW] Recibido SKIP_WAITING, activando inmediatamente');
    self.skipWaiting();
  }
});
