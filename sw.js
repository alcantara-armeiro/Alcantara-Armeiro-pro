const CACHE_NAME = 'alcantara-offline-v19-logo-retirada-pdf';
const RUNTIME_CACHE = 'alcantara-runtime-v19-logo-retirada-pdf';

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
  'https://fonts.googleapis.com/css2?family=Black+Ops+One&family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap',
];

async function addToCache(cache, url, external = false) {
  try {
    const request = external
      ? new Request(url, { mode: 'no-cors', credentials: 'omit', cache: 'reload' })
      : new Request(url, { cache: 'reload' });
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) {
      await cache.put(request, response.clone());
    }
  } catch (error) {
    console.warn('[SW] não cacheou:', url, error);
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(CORE_ASSETS.map(url => addToCache(cache, url, false)));
    await Promise.allSettled(EXTERNAL_ASSETS.map(url => addToCache(cache, url, true)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => ![CACHE_NAME, RUNTIME_CACHE].includes(key)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

async function indexFallback() {
  return (await caches.match('./index.html', { ignoreSearch: true })) ||
         (await caches.match('./', { ignoreSearch: true })) ||
         new Response('<!doctype html><html><body style="background:#050505;color:#d4af37;font-family:sans-serif;padding:24px">Abra o app uma vez com internet para ativar o modo offline.</body></html>', { headers: { 'Content-Type': 'text/html; charset=utf-8' }});
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, response.clone()).catch(() => {});
        }
        return response;
      } catch (_) {
        return indexFallback();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && (response.ok || response.type === 'opaque')) {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch (_) {
      if (request.destination === 'document') return indexFallback();
      if (request.destination === 'image') return new Response('', { status: 204 });
      if (request.destination === 'style') return new Response('', { headers: { 'Content-Type': 'text/css' }});
      if (request.destination === 'script') return new Response('', { headers: { 'Content-Type': 'application/javascript' }});
      return Response.error();
    }
  })());
});
