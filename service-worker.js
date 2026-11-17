const CACHE_NAME = "attendance-system-v4";
const FIREBASE_SDK_ASSETS = [
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js",
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js",
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
];

const CORE_ASSETS = [
  "./index.html",
  "./home.html",
  "./admin_home.html",
  "./employee_home.html",
  "./admin_work_plans.html",
  "./wood/index.html",
  "./wood/detail.html",
  "./learning/index.html",
  "./learning/subjects/subject.html",
  "./learning/admin/dictionary.html",
  "./learning/admin/migrate.html",
  "./learning/css/learning.css",
  "./learning/js/index.js",
  "./learning/js/subject.js",
  "./learning/js/dictionary.js",
  "./learning/js/migrate.js",
  "./shared/app-shell.css",
  "./shared/app-shell.js",
  "./shared/auth.js",
  "./shared/firebase.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        await cache.addAll(CORE_ASSETS);
        await Promise.all(FIREBASE_SDK_ASSETS.map(async (url) => {
          try {
            const response = await fetch(url, { mode: "cors" });
            if (response.ok) await cache.put(url, response);
          } catch (error) {
            console.warn("Firebase SDK pre-cache skipped:", url, error);
          }
        }));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames
        .filter((name) => name.startsWith("attendance-system-") && name !== CACHE_NAME)
        .map((name) => caches.delete(name))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const isFirebaseSdk = url.origin === "https://www.gstatic.com" && url.pathname.startsWith("/firebasejs/10.7.1/");
  if (url.origin !== self.location.origin && !isFirebaseSdk) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then(async (response) => {
        if (response && response.ok) {
          const copy = response.clone();
          await caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(async () => {
        const fallback = await caches.match(request, { ignoreSearch: true });
        if (fallback) return fallback;
        return new Response("オフラインです。このページはまだキャッシュされていません。", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      });
    })
  );
});
