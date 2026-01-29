// Service Worker v20260129-2 - Network-only para archivos críticos

const BYPASS_CACHE_PATTERNS = [
  '/static/script.js',
  '/static/styles.css',
  'index.html',
  '/api/'
];

self.addEventListener('install', event => {
  console.log('SW v20260129-2 instalado');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('SW v20260129-2 activado');
  event.waitUntil((async () => {
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
