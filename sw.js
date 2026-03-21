/* =============================================================
   sw.js  –  Service Worker（オフライン対応）
   キャッシュ戦略: Network First
     → オンライン時は常に最新をネットワークから取得してキャッシュ更新
     → オフライン時はキャッシュから返す
   ============================================================= */

const CACHE_NAME = 'ems-sim-v2';

const ASSETS = [
  './',
  './index.html',
  './app.js',
  './config.js',
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

/* ── アクティベート: 古いキャッシュを削除 ── */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── フェッチ: Network First ── */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith('http')) return;

  // sw.js 自体はキャッシュしない（常にサーバーから取得）
  if (e.request.url.endsWith('sw.js')) return;

  // Supabase API はキャッシュしない
  if (e.request.url.includes('supabase.co')) return;

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
        // オフライン → キャッシュから返す
        return caches.match(e.request)
          .then((cached) => cached || caches.match('./index.html'));
      })
  );
});
