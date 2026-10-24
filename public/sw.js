/*
 * Stanzy service worker — app-shell runtime caching.
 *
 * Scaffolding-grade PWA support (ticket #2): installable + an offline-resilient
 * app shell. Strategy:
 *   - static build assets (/_next/static, icons): cache-first, since they are
 *     content-hashed and immutable.
 *   - navigations (HTML): network-first, falling back to the last cached copy
 *     so a previously visited page still opens offline.
 *
 * The free calculators' full offline behaviour (epic #1) is layered on by their
 * own tickets; this is the shell they cache into.
 */

const CACHE_VERSION = 'v4';
const SHELL_CACHE = `stanzy-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `stanzy-assets-${CACHE_VERSION}`;
// Derniers tirages data (tRPC `draws.*` queries), so the page still shows the
// last loaded draws offline (#49).
const DATA_CACHE = `stanzy-data-${CACHE_VERSION}`;

// The calculators compute in the browser, so their pages are precached too:
// once installed, they open and score offline (#5, #6).
const PRECACHE_URLS = [
  '/fr',
  '/en',
  '/fr/outils/crs',
  '/en/outils/crs',
  '/fr/outils/67-points',
  '/en/outils/67-points',
  // Derniers tirages (#49): the last loaded page opens offline.
  '/fr/outils/dernier-tirage',
  '/en/outils/dernier-tirage',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {
        // A failed precache (e.g. offline at install) must not block activation.
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![SHELL_CACHE, ASSET_CACHE, DATA_CACHE].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first for immutable build assets and icons.
  if (
    url.pathname.startsWith('/_next/static') ||
    url.pathname.startsWith('/icons')
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Network-first for page navigations.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  // Network-first for the public draws queries, alone in their batch, so
  // nothing tied to a signed-in Account is ever cached.
  if (isDrawsQuery(url)) {
    event.respondWith(networkFirst(request, DATA_CACHE));
  }
});

function isDrawsQuery(url) {
  if (!url.pathname.startsWith('/api/trpc/')) return false;
  const procedures = decodeURIComponent(url.pathname.slice('/api/trpc/'.length)).split(',');
  return procedures.every((name) => /^draws\.(list|latest)$/.test(name));
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

// ─── Alertes tirages (#49) ───────────────────────────────────────────────────
// The server sends { title, body, url, tag } for each new Tirage. `tag` makes
// a repeated alert replace the first instead of stacking.

self.addEventListener('push', (event) => {
  let alert = null;
  try {
    alert = event.data ? event.data.json() : null;
  } catch {
    alert = null;
  }
  // Every push must show something (userVisibleOnly): fall back to a plain
  // "new draw" notice when the payload is unreadable.
  const title = alert?.title || 'Stanzy · Nouveau tirage Entrée Express';

  event.waitUntil(
    self.registration.showNotification(title, {
      body: alert?.body || '',
      tag: alert?.tag || 'draw',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: alert?.url || '/fr/outils/dernier-tirage' },
    }),
  );
});

// Tapping the alert focuses an open Stanzy window on the draws page, or opens one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/fr/outils/dernier-tirage', self.location.origin);
  if (target.origin !== self.location.origin) return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).origin === target.origin);
      if (open) {
        return open.focus().then((client) => client.navigate(target.href));
      }
      return self.clients.openWindow(target.href);
    }),
  );
});
