
const CACHE_NAME = "attendance-system-v1";

// Service Workerのインストール
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Service Workerの有効化
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) =>
            name.startsWith("attendance-system-") &&
            name !== CACHE_NAME
          )
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});
