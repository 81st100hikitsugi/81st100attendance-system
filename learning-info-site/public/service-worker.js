const CACHE_NAME = "learning-info-site-v1";

const APP_FILES = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/assets/icon.svg"
];

// インストール時に基本ファイルを保存
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

// 古いキャッシュを整理
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// トップページはオンライン優先、通信できない場合は保存済みファイルを使用
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // GET以外と外部サイトへの通信には介入しない
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // ページ移動の場合
  if (request.mode === "navigate") {
    const isHome =
      url.pathname === "/" ||
      url.pathname === "/index.html";

    if (!isHome) return;

    event.respondWith(
      fetch(request)
        .catch(() => caches.match("/index.html"))
    );
  }
});