const CACHE_NAME = 'alcantara-v7-1-1-premium';
const RUNTIME_CACHE = 'alcantara-runtime-v7-1-1-premium';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-16x16.png',
  './icons/icon-32x32.png',
  './icons/icon-72x72.png',
  './icons/icon-96x96.png',
  './icons/icon-128x128.png',
  './icons/icon-144x144.png',
  './icons/icon-152x152.png',
  './icons/icon-192x192.png',
  './icons/icon-384x384.png',
  './icons/icon-512x512.png',
  './icons/logo.jpg'
];

const EXTERNAL_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://unpkg.com/lucide@latest',
  'https://fonts.googleapis.com/css2?family=Black+Ops+One&family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);

    await Promise.allSettled(
      EXTERNAL_ASSETS.map(async (url) => {
        try {
          const request = new Request(url, { mode: 'no-cors', credentials: 'omit' });
          const response = await fetch(request);
          await cache.put(request, response);
        } catch (error) {
          console.warn('Falha ao pré-cachear asset externo:', url, error);
        }
      })
    );

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => ![CACHE_NAME, RUNTIME_CACHE].includes(key))
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: false });
  if (cached) return cached;

  const response = await fetch(request);
  const cache = await caches.open(RUNTIME_CACHE);
  cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    return caches.match('./index.html');
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isNavigation = request.mode === 'navigate';

  if (isNavigation) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isSameOrigin) {
    event.respondWith((async () => {
      try {
        return await cacheFirst(request);
      } catch (error) {
        const fallback = await caches.match(request, { ignoreSearch: true });
        return fallback || Response.error();
      }
    })());
    return;
  }

  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    request.destination === 'image' ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('cdn.tailwindcss.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith((async () => {
      const cached = await caches.match(request, { ignoreSearch: false });
      if (cached) return cached;

      try {
        const response = await fetch(request, { mode: request.mode === 'navigate' ? 'cors' : request.mode, credentials: 'omit' });
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, response.clone());
        return response;
      } catch (error) {
        const fallback = await caches.match(request, { ignoreSearch: true });
        return fallback || Response.error();
      }
    })());
  }
});
