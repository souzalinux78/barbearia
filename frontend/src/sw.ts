/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";
import { registerRoute, setCatchHandler } from "workbox-routing";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { url: string; revision: string | null }>;
};

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  ({ request }) => request.mode === "navigate",
  new NetworkFirst({
    cacheName: "page-cache",
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30 })
    ]
  })
);

registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith("/api/v1/") &&
    request.method === "GET" &&
    !request.headers.has("authorization"),
  new StaleWhileRevalidate({
    cacheName: "api-cache",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 })
    ]
  })
);

registerRoute(
  ({ request }) =>
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "worker",
  new CacheFirst({
    cacheName: "asset-cache",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 })
    ]
  })
);

registerRoute(
  ({ request }) => request.destination === "font" || request.destination === "image",
  new CacheFirst({
    cacheName: "media-cache",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 90 })
    ]
  })
);

setCatchHandler(async ({ request }) => {
  if (request.destination === "document") {
    const offlineResponse = await caches.match("/offline.html");
    if (offlineResponse) {
      return offlineResponse;
    }
  }
  return Response.error();
});

self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  const payload = event.data.json() as {
    title?: string;
    body?: string;
    icon?: string;
    badge?: string;
    route?: string;
  };

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Barbearia Premium", {
      body: payload.body ?? "Voce recebeu uma nova atualizacao.",
      icon: payload.icon ?? "/pwa-192.svg",
      badge: payload.badge ?? "/pwa-192.svg",
      data: {
        route: payload.route ?? "/dashboard"
      }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetRoute = String((event.notification.data as { route?: string } | undefined)?.route ?? "/dashboard");

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.postMessage({ type: "PUSH_NAVIGATE", route: targetRoute });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetRoute);
      }
      return Promise.resolve(undefined);
    })
  );
});
