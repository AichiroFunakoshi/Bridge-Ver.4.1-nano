/**
 * Service Worker for Voice Translator PWA
 * - オフライン対応とキャッシュ管理
 * - モバイル最適化とUX改善
 * - バージョン: 2.0 (2025-05-13)
 */

const CACHE_NAME = 'voice-translator-cache-v2';
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

  // Stale-While-Revalidate戦略に改善（アプリ高速表示と自動更新）
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // クローンされたリクエストを用意
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            // 有効なレスポンスのみキャッシュ
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  // 新しいバージョンをキャッシュに保存
                  cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
          })
          .catch(error => {
            console.log('ネットワークフェッチに失敗:', error);
            // HTML要求の場合は専用のオフラインページを提供
            if (event.request.headers.get('Accept').includes('text/html')) {
              return new Response(
                `<!DOCTYPE html>
                <html lang="ja">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>オフラインモード</title>
                  <style>
                    body {
                      font-family: -apple-system, sans-serif;
                      background: #0d0d0d;
                      color: #f4f4f4;
                      margin: 0;
                      padding: 20px;
                      display: flex;
                      flex-direction: column;
                      align-items: center;
                      justify-content: center;
                      min-height: 100vh;
                      text-align: center;
                    }
                    h1 { font-size: 1.5rem; margin-bottom: 1rem; }
                    p { line-height: 1.5; margin-bottom: 1.5rem; }
                    .icon { font-size: 3rem; margin-bottom: 1rem; }
                    .retry-btn {
                      background: #444;
                      color: white;
                      border: none;
                      padding: 12px 20px;
                      border-radius: 8px;
                      font-size: 1rem;
                    }
                  </style>
                </head>
                <body>
                  <div class="icon">📶</div>
                  <h1>オフラインモード</h1>
                  <p>インターネット接続が見つかりません。<br>接続が復旧したら自動的に再接続します。</p>
                  <button class="retry-btn" onclick="window.location.reload()">再試行</button>
                </body>
                </html>`,
                {
                  headers: { 'Content-Type': 'text/html; charset=utf-8' }
                }
              );
            }
            // 他のリソースの場合はエラーを伝播
            throw error;
          });

        // キャッシュにあればそれをまず返す（高速表示）
        // そして並行してネットワークからの取得も試みる（バックグラウンド更新）
        return cachedResponse || fetchPromise;
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