const cacheName = 'mahss-lib-v6'; // വേർഷൻ 4

const assets = [
  './',
  './index.html',
  './manifest.json',
  './icon.png'
];

// 1. Install Event (ഫയലുകൾ സേവ് ചെയ്യുന്നു)
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(cacheName).then((cache) => {
      return cache.addAll(assets);
    })
  );
});

// 2. Activate Event (പഴയ വേർഷൻ ക്ലീൻ ചെയ്യുന്നു)
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== cacheName) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// 3. Fetch Event (ഇതാണ് പ്രധാനം)
self.addEventListener('fetch', (e) => {
  e.respondWith(
    // ആദ്യം ഇന്റർനെറ്റിൽ നിന്ന് എടുക്കാൻ ശ്രമിക്കും (Network First)
    fetch(e.request)
      .then((res) => {
        return res; // നെറ്റ് ഉണ്ടെങ്കിൽ അത് തന്നെ കൊടുക്കും
      })
      .catch(() => {
        // നെറ്റ് ഇല്ലെങ്കിൽ എറർ വരും. അപ്പോൾ നമ്മൾ ഇവിടെ പിടിക്കും (Catch)
        return caches.match(e.request).then((cacheRes) => {
          // 1. നമ്മൾ ചോദിച്ച ഫയൽ Cache-ൽ ഉണ്ടെങ്കിൽ അത് കൊടുക്കും
          if (cacheRes) return cacheRes;

          // 2. ഇനി Cache-ലും ഇല്ലെങ്കിൽ, അത് ഒരു പേജ് ലോഡിംഗ് ആണോ എന്ന് നോക്കും.
          // (ഉദാഹരണത്തിന് ആപ്പ് തുറക്കുന്നത്). അങ്ങനെയാണെങ്കിൽ index.html കൊടുക്കും.
          if (e.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});