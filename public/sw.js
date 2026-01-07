// 1. പതിപ്പ് v2 ആക്കുന്നു (ഇത് മാറ്റുമ്പോൾ ഫോൺ പുതിയത് ഡൗൺലോഡ് ചെയ്യും)
const cacheName = 'mahss-lib-v2';

const assets = [
  './',
  './index.html',
  './manifest.json',
  './icon.png'
];

// 2. Install (ഫയലുകൾ സേവ് ചെയ്യുന്നു)
self.addEventListener('install', (e) => {
  self.skipWaiting(); // കാത്തുനിൽക്കാതെ ഉടനെ ഇൻസ്റ്റാൾ ആകാൻ
  e.waitUntil(
    caches.open(cacheName).then((cache) => {
      return cache.addAll(assets);
    })
  );
});

// 3. Activate (പഴയ വേർഷൻ ക്ലീൻ ചെയ്യുന്നു - ഇതാണ് പ്രധാനം!)
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          // v2 അല്ലാത്ത പഴയ Cache എല്ലാം ഡിലീറ്റ് ചെയ്യുക
          if (key !== cacheName) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// 4. Fetch (നെറ്റ് ഇല്ലെങ്കിലും വർക്ക് ആകാനുള്ള കോഡ്)
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cacheRes) => {
      // Cache-ൽ ഉണ്ടെങ്കിൽ അത് എടുക്കുക, ഇല്ലെങ്കിൽ നെറ്റിൽ നിന്ന്
      return cacheRes || fetch(e.request).catch(() => {
        // സൈറ്റ് കിട്ടിയില്ലെങ്കിൽ (Blank Screen വരാതിരിക്കാൻ) index.html കൊടുക്കും
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});