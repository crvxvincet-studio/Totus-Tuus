// ============================================================================
// SERVICE WORKER v3.0.0 — MODO OFFLINE COMPLETO Y ACTUALIZACIÓN INMEDIATA
// ============================================================================
const CACHE_NAME = "totus-tuus-pwa-v3.0.0";
const OFFLINE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800"><rect width="600" height="800" fill="#18120B"/><rect x="24" y="24" width="552" height="752" rx="18" fill="none" stroke="#C8A96A" stroke-width="3"/><circle cx="300" cy="310" r="105" fill="#23190E" stroke="#DEC07A" stroke-width="3"/><text x="300" y="305" text-anchor="middle" fill="#F5E1A4" font-family="Georgia,serif" font-size="48" font-weight="bold">✠ M ✠</text><text x="300" y="348" text-anchor="middle" fill="#DEC07A" font-family="Georgia,serif" font-size="18">TOTUS TUUS</text><text x="300" y="500" text-anchor="middle" fill="#FFF8E7" font-family="Georgia,serif" font-size="22" font-weight="bold">Santa María · Ora pro nobis</text><text x="300" y="540" text-anchor="middle" fill="#C8A96A" font-family="Georgia,serif" font-style="italic" font-size="16">Modo sin conexión activo</text></svg>`;

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/css/styles.css",
  "./assets/js/data.js",
  "./assets/js/db.js",
  "./assets/js/app.js",
  "./assets/img/consagracion.webp",
  "./assets/img/consagracion.jpg",
  "./assets/img/dogmas.webp",
  "./assets/img/dogmas.jpg",
  "./assets/img/advocaciones.webp",
  "./assets/img/advocaciones.jpg",
  "./assets/img/apple-touch-icon.png",
  "./assets/img/icon-192.png",
  "./assets/img/icon-512.png",
  "./assets/img/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== "totus-tuus-state-cache-v2") {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const reqUrl = new URL(event.request.url);

  // Estrategia Network-First para HTML/JS/CSS locales (garantiza que los cambios se actualicen en teléfonos)
  if (reqUrl.origin === self.location.origin && (reqUrl.pathname.endsWith(".html") || reqUrl.pathname.endsWith(".js") || reqUrl.pathname.endsWith(".css") || reqUrl.pathname.endsWith("/"))) {
    event.respondWith(
      fetch(event.request)
        .then((networkResp) => {
          if (networkResp && networkResp.status === 200) {
            const copy = networkResp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResp;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  // Estrategia Cache-First con guardado dinámico y respaldo SVG offline para imágenes
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((networkResp) => {
          if (networkResp && (networkResp.status === 200 || networkResp.type === "opaque")) {
            const copy = networkResp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResp;
        })
        .catch(() => {
          if (event.request.destination === "image" || reqUrl.pathname.match(/\.(jpg|jpeg|png|webp|svg)$/i)) {
            return new Response(OFFLINE_SVG, { headers: { "Content-Type": "image/svg+xml" } });
          }
          return caches.match("./index.html");
        });
    })
  );
});
