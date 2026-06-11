/* ============================================================
   Service Worker — 长期缓存策略
   版本更新时自动清除旧缓存
   ============================================================ */
const CACHE_VERSION = 'v7';
const STATIC_CACHE  = 'portfolio-static-' + CACHE_VERSION;
const IMAGE_CACHE   = 'portfolio-images-' + CACHE_VERSION;
const FONT_CACHE    = 'portfolio-fonts-' + CACHE_VERSION;

// 预缓存的核心文件（首次安装即缓存）
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/admin.html',
  '/styles.css',
  '/gallery.css',
  '/gallery.js',
  '/render.js',
  '/main.js',
  '/data.json',
];

// ── 安装：预缓存核心资源 ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(() => {})
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── 激活：清除旧版本缓存 ──────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => {
          return key.startsWith('portfolio-') &&
                 key !== STATIC_CACHE &&
                 key !== IMAGE_CACHE &&
                 key !== FONT_CACHE;
        }).map(key => {
          return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ── 请求拦截：不同资源不同策略 ────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Google Fonts — Network First + 缓存
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(fontStrategy(event.request));
    return;
  }

  // 图片 — Network First, 失败后使用缓存
  if (url.pathname.match(/\.(webp|jpg|jpeg|png|gif|svg|ico)$/i)) {
    event.respondWith(imageStrategy(event.request));
    return;
  }

  // JS / CSS / HTML / JSON — Cache First, 网络更新
  if (event.request.method === 'GET') {
    event.respondWith(staticStrategy(event.request));
    return;
  }
});

// ── 字体策略：Network First ───────────────────────
function fontStrategy(request) {
  return fetch(request).then(response => {
    if (response.ok) {
      const clone = response.clone();
      caches.open(FONT_CACHE).then(cache => cache.put(request, clone));
    }
    return response;
  }).catch(() => caches.match(request));
}

// ── 图片策略：Network First，失败回退缓存 ─────────
function imageStrategy(request) {
  return fetch(request).then(response => {
    if (response.ok) {
      const clone = response.clone();
      caches.open(IMAGE_CACHE).then(cache => cache.put(request, clone));
    }
    return response;
  }).catch(() => {
    return caches.match(request).then(cached => {
      return cached || new Response('', { status: 503 });
    });
  });
}

// ── 静态资源策略：Cache First，后台更新 ───────────
function staticStrategy(request) {
  return caches.match(request).then(cached => {
    // 后台发起网络请求更新缓存
    const fetchPromise = fetch(request).then(response => {
      if (response.ok) {
        caches.open(STATIC_CACHE).then(cache => cache.put(request, response.clone()));
      }
      return response;
    }).catch(() => null);

    // 如果有缓存，立即返回；同时后台更新
    if (cached) {
      return cached;
    }
    // 无缓存，等待网络
    return fetchPromise.then(r => r || new Response('网络错误', { status: 503 }));
  });
}
