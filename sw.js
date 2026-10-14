/* Dolcan Rota servis çalışanı.
   Sayfa her açılışta önce internetten taze alınır; bağlantı yoksa son kaydedilen hâli açılır.
   Gezdiğin harita alanları, fotoğraflar ve kütüphaneler de saklanır, böylece metroda ya da
   zayıf bağlantıda daha önce baktığın yerler boş görünmez. Canlı veri her zaman önceliklidir. */
const V = "dolcanrota-v6";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png"];
const MAX_TILES = 1500;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => !k.startsWith(V)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim(name, max){
  const c = await caches.open(name), keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}
async function networkFirst(req, name){
  const c = await caches.open(name);
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await c.match(req, {ignoreSearch: req.mode === "navigate"});
    if (hit) return hit;
    if (req.mode === "navigate") return c.match("./index.html");
    throw err;
  }
}
async function cacheFirst(req, name){
  const c = await caches.open(name), hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  // Konum, yönlendirme ve Wikipedia sorguları her zaman canlı; yalnızca bağlantı yoksa son cevap.
  if (u.origin === location.origin) return e.respondWith(networkFirst(req, V));
  if (u.hostname === "unpkg.com" || u.hostname.endsWith("gstatic.com") || u.hostname === "fonts.googleapis.com")
    return e.respondWith(cacheFirst(req, V + "-lib"));
  if (u.hostname.endsWith("openfreemap.org")) {
    if (/\.(pbf|png|webp|json)$/.test(u.pathname) || u.pathname.includes("/styles/"))
      return e.respondWith(networkFirst(req, V + "-tiles").finally(() => trim(V + "-tiles", MAX_TILES)));
  }
  if (u.hostname.endsWith("wikimedia.org") || u.hostname.endsWith("wikipedia.org") || u.hostname.includes("routing.openstreetmap"))
    return e.respondWith(networkFirst(req, V + "-data"));
});
