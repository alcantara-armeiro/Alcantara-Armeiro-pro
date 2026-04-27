const CACHE_NAME = 'alcantara-offline-v15-2';
const RUNTIME_CACHE = 'alcantara-runtime-v15-2';

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
  './icons/icon-512x512.png'
];

const EXTERNAL_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://unpkg.com/lucide@latest',
  'https://fonts.googleapis.com/css2?family=Black+Ops+One&family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap',
  'https://i.ibb.co/LFtsfFp/logo.jpg'
];

async function safeCachePut(cache, url) {
  try {
    const isExternal = /^https?:\/\//i.test(url) && !url.startsWith(self.location.origin);
    const request = new Request(url, {
      mode: isExternal ? 'no-cors' : 'same-origin',
      credentials: isExternal ? 'omit' : 'same-origin',
      cache: 'reload'
    });
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque' || response.type === 'basic')) {
      await cache.put(request, response.clone());
      if (typeof url === 'string') {
        await cache.put(url, response.clone()).catch(() => {});
      }
    }
  } catch (error) {
    console.warn('[SW] Falha ao cachear:', url, error);
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled([...CORE_ASSETS, ...EXTERNAL_ASSETS].map(url => safeCachePut(cache, url)));
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

async function fromCache(request) {
  return (
    await caches.match(request, { ignoreSearch: true }) ||
    await caches.match('./index.html', { ignoreSearch: true }) ||
    await caches.match('./', { ignoreSearch: true })
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;

  const response = await fetch(request);
  const cache = await caches.open(RUNTIME_CACHE);
  if (response && (response.ok || response.type === 'opaque' || response.type === 'basic')) {
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    if (response && (response.ok || response.type === 'opaque' || response.type === 'basic')) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    const cached = await fromCache(request);
    if (cached) return cached;
    return new Response('Alcantara Armeiro offline: abra o app uma vez com internet para gerar o cache.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
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
    event.respondWith(cacheFirst(request).catch(() => fromCache(request)));
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
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('i.ibb.co')
  ) {
    event.respondWith(cacheFirst(request).catch(() => fromCache(request)));
  }
});
