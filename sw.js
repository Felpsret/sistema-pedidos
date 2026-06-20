const CACHE = 'stockflow-v1';
const ARQUIVOS = ['/', './index.html', './style.css', './app.js'];

// Instala e faz cache dos arquivos principais
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ARQUIVOS))
  );
  self.skipWaiting();
});

// Ativa e limpa caches antigos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  e.waitUntil(self.clients.claim());
});

// Network first para JS/CSS (sempre busca versão mais nova),
// Cache fallback para não ficar em branco offline
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Só intercepta requests do mesmo origin
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Atualiza cache com versão mais nova
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
