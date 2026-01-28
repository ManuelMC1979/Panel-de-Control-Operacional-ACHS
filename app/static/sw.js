self.addEventListener('fetch', event => {
  event.respondWith(async function () {
    const preloadResponse = await event.preloadResponse;
    if (preloadResponse) {
      return preloadResponse;
    }
    return fetch(event.request);
  }());
});

// Habilitar navigation preload al activar el service worker
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
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
