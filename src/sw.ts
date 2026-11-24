/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

// Precache static assets injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST || []);

// 1. MapmyIndia & Vector Tiles — CacheFirst with 30-day retention
registerRoute(
  ({ url }) =>
    url.hostname.includes('mappls.com') && url.pathname.includes('/base_tile/'),
  new CacheFirst({
    cacheName: 'pitstop-mappls-tiles',
  })
);

// Fallback Map Tiles (CartoDB / Open Base)
registerRoute(
  ({ url }) => url.hostname.includes('basemaps.cartocdn.com'),
  new CacheFirst({
    cacheName: 'pitstop-base-tiles',
  })
);

// 2. MapmyIndia Places & AutoSuggest — NetworkFirst with 2-hour cache fallback
registerRoute(
  ({ url }) => url.hostname.includes('atlas.mappls.com'),
  new NetworkFirst({
    cacheName: 'pitstop-mappls-places',
    networkTimeoutSeconds: 4,
  })
);

// 3. MapmyIndia Direction & Routing — NetworkFirst with 24-hour cache fallback
registerRoute(
  ({ url }) =>
    url.hostname.includes('apis.mappls.com') && url.pathname.includes('/route_adv/'),
  new NetworkFirst({
    cacheName: 'pitstop-mappls-routes',
    networkTimeoutSeconds: 5,
  })
);

// 4. MapmyIndia POI / Corridor Search — StaleWhileRevalidate with 12-hour fallback
registerRoute(
  ({ url }) =>
    url.hostname.includes('mappls.com') && url.pathname.includes('/places/nearby/'),
  new StaleWhileRevalidate({
    cacheName: 'pitstop-mappls-pois',
  })
);

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
