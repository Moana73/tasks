// Service Worker：アプリ本体をキャッシュして、2回目以降は電波がなくても一瞬で開く
const VERSION = '__VERSION__';
const CACHE = `tasks-${VERSION}`;
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tasks-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // API・認証は常にネットワーク（キャッシュしない）
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

  // 画面遷移：キャッシュ済みのシェルを即返し、裏で最新を取得（stale-while-revalidate）
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match('/');
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put('/', res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }

  // ハッシュ付きアセット・アイコン：キャッシュ優先
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/'))) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
