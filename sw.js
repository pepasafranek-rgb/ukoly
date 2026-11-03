// Úkoly – offline start appky. Data řeší Firestore sám (offline fronta), tady se ukládá jen appka.
const VERZE = "ukoly-v13";
const SOUBORY = ["./", "index.html", "config.js", "manifest.webmanifest", "icon-192.png", "icon-512.png",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERZE).then(c => c.addAll(SOUBORY)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERZE).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  const vlastni = u.origin === self.location.origin;
  const sdk = u.hostname === "www.gstatic.com" && u.pathname.startsWith("/firebasejs/");
  if (!vlastni && !sdk && u.hostname !== "fonts.googleapis.com" && u.hostname !== "fonts.gstatic.com") return;   // Firestore a přihlášení jdou vždy na síť
  if (vlastni) {
    // appka: nejdřív síť (ať se nová verze projeví hned); při slabém signálu nejvýš 2,5 s, pak z mezipaměti (síť se dál uloží na příště)
    const sit = fetch(e.request).then(r => { if (r && r.ok && !r.redirected && r.type === "basic") { const k = r.clone(); caches.open(VERZE).then(c => c.put(e.request, k)); } return r; });
    const zCache = () => caches.match(e.request).then(r => r || caches.match("index.html"));
    e.respondWith(new Promise(ok => {
      let hotovo = false;
      const t = setTimeout(() => zCache().then(r => { if (!hotovo && r) { hotovo = true; ok(r); } }), 2500);
      // chybová stránka serveru (404, 503) nesmí nahradit funkční appku z mezipaměti
      sit.then(r => (r && r.ok) ? r : zCache().then(c => c || r))
         .then(r => { if (!hotovo) { hotovo = true; clearTimeout(t); ok(r); } })
         .catch(() => zCache().then(r => { if (!hotovo) { hotovo = true; clearTimeout(t); ok(r || Response.error()); } }));
    }));
    e.waitUntil(sit.catch(() => {}));
  } else {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(r2 => { if (r2.ok) { const k = r2.clone(); caches.open(VERZE).then(c => c.put(e.request, k)); } return r2; })));
  }
});
