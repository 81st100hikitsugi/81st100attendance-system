const CACHE_NAME = "attendance-system-v59";
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
  "./employee_attendance.html",
  "./employee_shift.html",
  "./employee_history.html",
  "./employee_notifications.html",
  "./admin_shift_create.html",
  "./admin_students.html",
  "./admin_shift_attendance_all.html",
  "./admin_notifications_create.html",
  "./tablet.html",
  "./admin_work_plans.html",
  "./wood/index.html",
  "./wood/detail.html",
  "./learning/index.html",
  "./learning/subjects/subject.html",
  "./learning/admin/dictionary.html",
  "./learning/css/learning.css",
  "./learning-info-site/public/css/subject.css",
  "./learning-info-site/public/css/common.css",
  "./learning-info-site/public/css/admin.css",
  "./learning-info-site/public/css/dictionary.css",
  "./learning/js/index.js",
  "./learning/js/subject.js",
  "./learning/js/dictionary.js",
  "./manifest.json",
  "./shared/app-shell.css",
  "./shared/design-system.css",
  "./shared/app-shell.js",
  "./shared/auth.js",
  "./shared/firebase.js",
  "./assets/icons/home.svg",
  "./assets/icons/attendance.svg",
  "./assets/icons/learning.svg",
  "./assets/icons/wood.svg"
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

  // ナビゲーションアイコンはオンライン時に最新ファイルを優先し、古い画像キャッシュを再利用しない。
  if (url.origin === self.location.origin && /\/assets\/icons\/[^/]+\.svg$/.test(url.pathname)) {
    event.respondWith(
      fetch(request, { cache: "no-store" }).then(async (response) => {
        if (response && response.ok) {
          const copy = response.clone();
          await caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(async () => {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        return new Response("オフラインです。アイコンを取得できませんでした。", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      })
    );
    return;
  }

  // 共通ヘッダーのCSS・JavaScriptは古いクエリ付きURLのキャッシュが残っていても、
  // オンライン時は必ず最新ファイルを取得する。
  if (url.origin === self.location.origin && /\/shared\/app-shell\.(css|js)$/.test(url.pathname)) {
    event.respondWith(
      fetch(request, { cache: "no-store" }).then(async (response) => {
        if (response && response.ok) {
          const copy = response.clone();
          await caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response("オフラインです。共通スタイルを取得できませんでした。", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      })
    );
    return;
  }

  // HTMLページの切り替えは、クエリ文字列が異なっても同じHTMLを再利用する。
  // 教科ページは ?subject=... で内容を切り替えるため、検索文字列を無視してキャッシュを探す。
  if (request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) {
        // GitHub PagesのHTMLはデプロイ時にキャッシュ世代を更新するため、保存済みHTMLをすぐ返す。
        return cached;
      }
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const copy = response.clone();
          await caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      } catch (error) {
        return new Response("オフラインです。このページはまだキャッシュされていません。", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
    })());
    return;
  }

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
