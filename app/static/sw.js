// Service Worker v20260201-3 - Network-only para archivos críticos
// IMPORTANTE: Cambiar la versión aquí Y en index.html BUILD para invalidar caché

const SW_VERSION = '20260201-3';
const CACHE_NAME = `achs-cache-v${SW_VERSION}`;

const BYPASS_CACHE_PATTERNS = [
  '/static/script.js',
  '/static/js/auth.js',
  '/static/js/config-ui.js',
  '/static/styles.css',
  'index.html',
  '/api/'
];

self.addEventListener('install', event => {
  console.log(`SW v${SW_VERSION} instalado`);
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log(`SW v${SW_VERSION} activado`);
  event.waitUntil((async () => {
    // Limpiar caches antiguos
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(name => name.startsWith('achs-cache-') && name !== CACHE_NAME)
        .map(name => {
          console.log(`SW: Eliminando cache antiguo: ${name}`);
          return caches.delete(name);
        })
    );
    
    await self.clients.claim();
    if (self.registration && self.registration.navigationPreload) {
      try {
        await self.registration.navigationPreload.enable();
        console.log('Navigation preload habilitado');
      } catch (err) {
        console.warn('No se pudo habilitar navigation preload:', err);
      }
    }
  })());
});

self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // Forzar network-only para archivos críticos (sin cache)
  const shouldBypass = BYPASS_CACHE_PATTERNS.some(pattern => url.includes(pattern));
  
  if (shouldBypass) {
    event.respondWith(fetch(event.request).catch(() => {
      console.warn('SW: fetch falló para', url);
      return new Response('Error de red', { status: 503 });
    }));
    return;
  }

  // Para otros recursos, usar navigation preload si está disponible
  event.respondWith((async () => {
    const preloadResponse = await event.preloadResponse;
    if (preloadResponse) {
      return preloadResponse;
    }
    return fetch(event.request);
  })());
});

// Mensaje para forzar actualización desde el cliente
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
