/**
 * Service Worker for Voice Translator PWA
 * - オフライン対応とキャッシュ管理
 */

const CACHE_NAME = 'voice-translator-cache-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './images/icons/apple-touch-icon-180x180.png',
  './images/icons/icon-120x120.png',
  './images/icons/icon-152x152.png',
  './images/icons/icon-167x167.png',
  './images/icons/icon-192x192.png',
  './images/icons/icon-512x512.png'
];

// インストール時に静的アセットをキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('静的アセットをキャッシュしています');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// 古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          console.log('古いキャッシュを削除:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ネットワークリクエストを処理
self.addEventListener('fetch', event => {
  // OpenAI API呼び出しは特別処理
  if (event.request.url.includes('api.openai.com')) {
    event.respondWith(
      fetch(event.request)
        .catch(error => {
          // API呼び出しが失敗した場合、オフラインであることを示すレスポンスを返す
          return new Response(
            JSON.stringify({
              error: 'offline',
              message: 'ネットワーク接続がありません。オンラインになってから再試行してください。'
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // キャッシュがあればそれを返す
        if (cachedResponse) {
          return cachedResponse;
        }

        // キャッシュがなければネットワークに取りに行く
        return fetch(event.request)
          .then(response => {
            // 有効なレスポンスのみキャッシュ
            if (!response || response.status !== 200) {
              return response;
            }

            // レスポンスをクローンしてキャッシュ（レスポンスは一度しか使用できないため）
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(error => {
            console.log('フェッチに失敗:', error);
            // オフライン時のフォールバックを返す
            return new Response(
              '<html><body><h1>オフラインです</h1><p>インターネット接続がありません。</p></body></html>',
              {
                headers: { 'Content-Type': 'text/html' }
              }
            );
          });
      })
  );
});

// プッシュ通知機能（将来実装予定）
self.addEventListener('push', event => {
  // 現在は実装なし
});

// 通知クリック時の処理（将来実装予定）
self.addEventListener('notificationclick', event => {
  // 現在は実装なし
});