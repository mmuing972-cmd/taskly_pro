// Taskly Pro Service Worker - Offline Support
const CACHE_NAME = 'taskly-pro-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    '/icon-192.png'
];

// Install - Cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate - Clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys
                .filter(key => key !== CACHE_NAME)
                .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch - Serve from cache, fallback to network
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip external requests (audio URLs, fonts, etc.)
    if (!event.request.url.startsWith(self.location.origin)) return;

    event.respondWith(
        caches.match(event.request)
            .then(cached => {
                // Return cached version or fetch from network
                return cached || fetch(event.request)
                    .then(response => {
                        // Cache successful responses
                        if (response.status === 200) {
                            const clone = response.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => cache.put(event.request, clone));
                        }
                        return response;
                    });
            })
            .catch(() => {
                // Offline fallback for navigation
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
            })
    );
});

// Handle messages from main thread
self.addEventListener('message', event => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
