// Service worker: keeps the Learning Assistant working offline
const CACHE = "learning-assistant-v1";   // change the number when you update files
const FILES = [
  "./",
  "index.html",
  "about.html",
  "style.css",
  "script.js",
  "audio/manifest.json",
  "audio/am_0d33af4cb8.mp3",
  "audio/am_0dd7bcfc1e.mp3",
  "audio/am_0e90b1483f.mp3",
  "audio/am_1251b24650.mp3",
  "audio/am_18487ab50c.mp3",
  "audio/am_2d5634a36e.mp3",
  "audio/am_33e436b433.mp3",
  "audio/am_383ce8f261.mp3",
  "audio/am_3c80f7b111.mp3",
  "audio/am_402362b6d9.mp3",
  "audio/am_44050d1731.mp3",
  "audio/am_440f606f38.mp3",
  "audio/am_46570d6aca.mp3",
  "audio/am_49a5a67c0c.mp3",
  "audio/am_4cb11bd982.mp3",
  "audio/am_4e82f26819.mp3",
  "audio/am_56de2aed58.mp3",
  "audio/am_58cf03accc.mp3",
  "audio/am_5c029aa9e4.mp3",
  "audio/am_6430cd42a6.mp3",
  "audio/am_73831b1af6.mp3",
  "audio/am_805a920551.mp3",
  "audio/am_807027d6c7.mp3",
  "audio/am_861c2a4da4.mp3",
  "audio/am_86570aa9d4.mp3",
  "audio/am_8bcf56b199.mp3",
  "audio/am_906a1afb5b.mp3",
  "audio/am_933e0bc3ad.mp3",
  "audio/am_9419f45087.mp3",
  "audio/am_9456d7cddb.mp3",
  "audio/am_99ac9fd4a2.mp3",
  "audio/am_a9cf57fa19.mp3",
  "audio/am_b193d6556e.mp3",
  "audio/am_bf51ed60ea.mp3",
  "audio/am_c35361212d.mp3",
  "audio/am_c70b64a31c.mp3",
  "audio/am_cb243d6739.mp3",
  "audio/am_cdb3b3976a.mp3",
  "audio/am_d00288109e.mp3",
  "audio/am_f0497a87f4.mp3",
  "audio/am_fedbce3dec.mp3",
  "audio/en_06a3ee9305.mp3",
  "audio/en_0c148ff700.mp3",
  "audio/en_0d2f828ddd.mp3",
  "audio/en_103160276f.mp3",
  "audio/en_131ea209fa.mp3",
  "audio/en_13fe6699b0.mp3",
  "audio/en_1faae6fb43.mp3",
  "audio/en_20292bd9ba.mp3",
  "audio/en_2a9179abed.mp3",
  "audio/en_2bc5c5628e.mp3",
  "audio/en_326167d8d7.mp3",
  "audio/en_327191c44e.mp3",
  "audio/en_32cda4cf92.mp3",
  "audio/en_3d9b32d5dd.mp3",
  "audio/en_40859b5c9f.mp3",
  "audio/en_4ce0f4261a.mp3",
  "audio/en_530fa5009f.mp3",
  "audio/en_56e3dc4ca1.mp3",
  "audio/en_6028c207c1.mp3",
  "audio/en_60f946a8ea.mp3",
  "audio/en_70cbc1082b.mp3",
  "audio/en_79dd27b900.mp3",
  "audio/en_8377895d36.mp3",
  "audio/en_85e2a9ff0b.mp3",
  "audio/en_861d321198.mp3",
  "audio/en_86648a8c8e.mp3",
  "audio/en_905872289d.mp3",
  "audio/en_a47e990df0.mp3",
  "audio/en_a599d9e3de.mp3",
  "audio/en_b6f389c164.mp3",
  "audio/en_b7000b714b.mp3",
  "audio/en_bc3ec78b31.mp3",
  "audio/en_bc8f531b4f.mp3",
  "audio/en_bf8448757f.mp3",
  "audio/en_c14047f6f3.mp3",
  "audio/en_c48296305b.mp3",
  "audio/en_d9366dcecc.mp3",
  "audio/en_da1ff9497f.mp3",
  "audio/en_da6e2d7a5f.mp3",
  "audio/en_f793db5f69.mp3",
  "audio/en_fbf1ebb643.mp3"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      // add files one by one so one missing file (e.g. about.html) does not break everything
      Promise.all(FILES.map(f => cache.add(f).catch(() => console.warn("not cached:", f))))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);
  // Only handle our own files (Wikipedia, Google voice etc. go to the internet)
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Audio clips: cache first (fast + offline)
  if (url.pathname.includes("/audio/")) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    })));
    return;
  }

  // Pages, CSS, JS: try internet first (get updates), fall back to saved copy offline
  event.respondWith(
    fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match("index.html")))
  );
});
