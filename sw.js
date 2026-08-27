// =====================================================
// SERVICE WORKER COMPARTIDO DE TODAS LAS PWAs
// Estrategia: red primero, caché como respaldo offline.
// Esto evita el problema de contenido obsoleto.
// =====================================================

const CACHE_NAME = 'rootgpt-shell-v1';
const CORE_ASSETS = ['/', '/index.html', '/secret.html', '/map.html'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(CORE_ASSETS))
            .catch(err => console.log('Precarga parcial:', err))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET') return;
    // Solo mismo origen: no interferir con Firebase, Pollinations, Wikipedia ni CDNs
    if (url.origin !== self.location.origin) return;

    // Navegaciones: red primero, fallback offline al shell
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(res => {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                    return res;
                })
                .catch(() => caches.match(event.request).then(r => r || caches.match('/index.html')))
        );
        return;
    }

    // Estáticos propios: red primero, caché como respaldo
    event.respondWith(
        fetch(event.request)
            .then(res => {
                const copy = res.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                return res;
            })
            .catch(() => caches.match(event.request))
    );
});