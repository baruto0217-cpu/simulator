/* =============================================================
   sw.js  –  Service Worker（オフライン対応）
   キャッシュ戦略: Network First
     → オンライン時は常に最新をネットワークから取得してキャッシュ更新
     → オフライン時はキャッシュから返す
   注意: baruto0217-cpu.github.io の他のアプリと同じ場所（オリジン）にあるので、
         消すのは自分のキャッシュ（ems-sim-）だけにする
   ============================================================= */

const CACHE_PREFIX = 'ems-sim-';
const CACHE_NAME = CACHE_PREFIX + 'v3';

const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json'
];

/* ── インストール: 全アセットを事前キャッシュ ── */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ── アクティベート: 自分の古いキャッシュだけを削除 ── */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── フェッチ: Network First ── */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;

  // sw.js 自体はキャッシュしない（常にサーバーから取得）
  if (e.request.url.endsWith('sw.js')) return;

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // ネットワーク成功 → キャッシュを更新して返す
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      })
      .catch(() => {
        // オフライン → 自分のキャッシュから返す
        return caches.open(CACHE_NAME).then((cache) =>
          cache.match(e.request, { ignoreSearch: true })
            .then((cached) => cached || cache.match('./index.html')));
      })
  );
});
