const CACHE = 'stockflow-v2';
const STATIC = ['/', './index.html', './style.css', './app.js'];

// Instala: pré-carrega os arquivos estáticos em cache
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC))
  );
  self.skipWaiting();
});

// Ativa: limpa caches de versões antigas
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Não intercepta requests externos (Firebase, CDN, etc.)
  if (url.origin !== self.location.origin) return;

  // HTML: network first (garante versão mais recente sempre)
  if (url.pathname.endsWith('.html') || url.pathname === '/') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // CSS e JS: cache first com revalidação em background (stale-while-revalidate)
  // Carrega instantâneo do cache, atualiza em background para próxima visita
  if (url.pathname.endsWith('.css') || url.pathname.endsWith('.js')) {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          const fetchPromise = fetch(e.request).then(res => {
            cache.put(e.request, res.clone());
            return res;
          });
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // Demais requests: network com fallback para cache
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
