// Service Worker - Cache Buster
// La versión se pasa via URL param desde index.html

const CACHE_PREFIX = 'kpi-cache-';

// Patrones que NUNCA se cachean (siempre network)
const NO_CACHE_PATTERNS = [
  '.js',
  '.css',
  'index.html',
  '/api/',
  '.html'
];

// Obtener versión desde URL de registro
const SW_URL = new URL(self.location);
const BUILD_VERSION = SW_URL.searchParams.get('v') || 'unknown';
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_VERSION}`;

console.log(`[SW] Iniciando v${BUILD_VERSION}`);

self.addEventListener('install', event => {
  console.log(`[SW] Install - BUILD: ${BUILD_VERSION}`);
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log(`[SW] Activate - BUILD: ${BUILD_VERSION}`);
  event.waitUntil((async () => {
    // Eliminar TODOS los caches antiguos
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
        .map(name => {
          console.log(`[SW] Eliminando cache antiguo: ${name}`);
          return caches.delete(name);
        })
    );
    
    // También eliminar caches con prefijo antiguo
    await Promise.all(
      cacheNames
        .filter(name => name.startsWith('achs-cache-'))
        .map(name => {
          console.log(`[SW] Eliminando cache legacy: ${name}`);
          return caches.delete(name);
        })
    );
    
    await self.clients.claim();
    console.log(`[SW] Activado y controlando clientes`);
  })());
});

self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // NO cachear JS, CSS, HTML, API - siempre network
  const shouldBypass = NO_CACHE_PATTERNS.some(pattern => url.includes(pattern));
  
  if (shouldBypass) {
    // Network-only para archivos críticos
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
