/*
 * TatNat service worker.
 *
 * Deliberately conservative. This app is mostly signed-in, personal data on
 * devices that get shared and handed around, so:
 *
 *   * HTML is never cached. Navigations go to the network, and only fall back
 *     to a static offline page. Caching a rendered page would leave one
 *     customer's bookings on disk for the next person to open the app.
 *   * Only fingerprinted build output and static icons are cached, and those
 *     are immutable by construction.
 *   * Anything that is not a same-origin GET is passed straight through:
 *     Supabase calls, Server Actions and auth redirects must never be served
 *     from a cache.
 */

const VERSION = "bookly-v1";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline";

const PRECACHE = [OFFLINE_URL, "/icons/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      // A failed precache must not wedge the install; the app works without it.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isCacheableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept the auth callback or any Server Action round trip.
  if (url.pathname.startsWith("/auth/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        return (
          (await cache.match(OFFLINE_URL)) ??
          new Response("You are offline.", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          })
        );
      }),
    );
    return;
  }

  if (!isCacheableAsset(url)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
