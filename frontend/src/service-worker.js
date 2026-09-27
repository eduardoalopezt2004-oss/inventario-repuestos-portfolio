/* eslint-disable no-restricted-globals */

// Workbox service worker — generado con CRA + Workbox (Google)
// Provee: caché del app shell, carga offline de la UI

import { clientsClaim, skipWaiting } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from 'workbox-strategies';

// Activa cada nueva versión del service worker de inmediato en lugar de
// dejarla "esperando" hasta que se cierren todas las pestañas del sitio.
skipWaiting();
clientsClaim();

// Precachea todos los assets generados por el build (HTML, JS, CSS, imágenes)
precacheAndRoute(self.__WB_MANIFEST);

// Redirige cualquier navegación al index.html (SPA)
const fileExtensionRegexp = new RegExp('/[^/?]+\\.[^/]+$');
registerRoute(
  ({ request, url }) => {
    if (request.mode !== 'navigate') return false;
    if (url.pathname.startsWith('/_')) return false;
    if (url.pathname.match(fileExtensionRegexp)) return false;
    return true;
  },
  createHandlerBoundToURL(process.env.PUBLIC_URL + '/index.html')
);

// Fuentes e íconos: cache-first (raramente cambian)
registerRoute(
  ({ request }) =>
    request.destination === 'font' ||
    request.url.includes('fontawesome') ||
    request.url.includes('fonts.googleapis'),
  new CacheFirst({
    cacheName: 'fonts-icons',
    plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  })
);

// Imágenes: stale-while-revalidate
registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: 'images',
    plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  })
);

// CSS y JS del build ya están en el precache; aquí cubrimos librerías externas
registerRoute(
  ({ request, url }) =>
    (request.destination === 'script' || request.destination === 'style') &&
    !url.pathname.startsWith('/static/'),
  new StaleWhileRevalidate({ cacheName: 'static-ext' })
);
