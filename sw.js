/* =============================================================
   sw.js  –  Service Worker（オフライン対応）
   キャッシュ戦略: Cache First（初回以降はキャッシュから即座に返す）
   ============================================================= */

const CACHE_NAME = 'ems-sim-v1';

// キャッシュするファイル一覧
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './config.js',
  './manifest.json'
];

// インストール時: 全アセットをキャッシュ
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// アクティベート時: 古いキャッシュを削除
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// フェッチ時: キャッシュ優先、なければネットワーク
self.addEventListener('fetch', (e) => {
  // chrome-extension や POST などは無視
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith('http')) return;

  // Supabase への通信はキャッシュしない（常にネットワーク）
  if (e.request.url.includes('supabase.co')) return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((response) => {
        // 正常レスポンスのみキャッシュに追加
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        // ネットワークもキャッシュも失敗した場合はindex.htmlを返す
        return caches.match('./index.html');
      });
    })
  );
});
