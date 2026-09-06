/**
 * Service Worker - cache các model face-api.js (và chính thư viện face-api.js)
 * sau lần tải đầu tiên, để những lần mở app sau không phải tải lại từ CDN.
 * Không cache các request gọi tới Google Apps Script (dữ liệu chấm công/nhân viên
 * phải luôn lấy mới nhất từ mạng).
 */
const CACHE_NAME = 'cham-cong-ids-models-v1';

function laDuongDanCanCache(url) {
  return url.includes('jsdelivr.net/npm/face-api.js') ||
         url.includes('jsdelivr.net/gh/justadudewhohacks/face-api.js');
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  if (!laDuongDanCanCache(url)) return; // để trình duyệt xử lý bình thường (kể cả gọi Apps Script)

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      try {
        const res = await fetch(event.request);
        if (res && (res.ok || res.type === 'opaque')) {
          cache.put(event.request, res.clone());
        }
        return res;
      } catch (err) {
        if (cached) return cached;
        throw err;
      }
    })
  );
});
