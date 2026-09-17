/**
 * @file sw.js
 * @summary The service worker: keeps a copy of the app on the phone, so it opens fast and works offline.
 *
 * WHAT IT DOES : A service worker sits between the app and the internet. After the first
 *                visit, it answers requests from the copy saved on the phone (a few
 *                milliseconds) instead of waiting for the network:
 *                  - our own files (html, js, css, config.yml, data/): answered from the
 *                    saved copy at once, and quietly refreshed in the background, so an
 *                    update shows the next time the app opens ("stale while revalidate"),
 *                  - libraries and fonts from CDNs: the same,
 *                  - map tiles: the same, keeping at most MAX_TILES of them for a week, so
 *                    the phone's storage doesn't fill up.
 *                Google's Workbox library does the caching work.
 * DEPENDS ON   : Workbox (loaded from Google's CDN below).
 * USED BY      : js/core/offline.js (registers it)
 *
 * NOTE: this file must stay in the top folder, so it can look after every file of the app.
 */

importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js');

const MAX_TILES = 1500; // map tiles kept on the phone
const TILE_DAYS = 7; // how long a saved tile is used before it's downloaded again
const LIBRARY_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'storage.googleapis.com'];

// Only answers with good responses are saved. Status 0 is a font or script from another site
// that the browser won't let us read ("opaque"); it's still fine to save and reuse.
const goodAnswers = new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] });

// 1. Our own files.
workbox.routing.registerRoute(
  ({ url }) => url.origin === self.location.origin,
  new workbox.strategies.StaleWhileRevalidate({ cacheName: 'app-files', plugins: [goodAnswers] }),
);

// 2. Libraries and fonts from CDNs.
workbox.routing.registerRoute(
  ({ url }) => LIBRARY_HOSTS.includes(url.hostname),
  new workbox.strategies.StaleWhileRevalidate({ cacheName: 'libraries', plugins: [goodAnswers] }),
);

// 3. The map (OpenFreeMap style, tiles, fonts, icons).
workbox.routing.registerRoute(
  ({ url }) => url.hostname === 'tiles.openfreemap.org',
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'map-tiles',
    plugins: [
      goodAnswers,
      new workbox.expiration.ExpirationPlugin({ maxEntries: MAX_TILES, maxAgeSeconds: TILE_DAYS * 24 * 60 * 60 }),
    ],
  }),
);

// A new version of this file takes over straight away, instead of waiting for every tab to close.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
