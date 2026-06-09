/* FIELDOPS ATLAS SERVICE WORKER v1.1.1-profile
   Keeps the browser prototype usable offline where possible.
   Map remains the main fallback page.
*/
const CACHE_NAME = "fieldops-atlas-v1.1.1-profile";
const MAP_FALLBACK = "./FieldOpsAtlas/Features/Map/index.html";

const CORE_FILES = [
  "./",
  "./index.html",
  MAP_FALLBACK,
  "./FieldOpsAtlas/Features/Profile/index.html",
  "./FieldOpsAtlas/Features/RF/index.html",
  "./FieldOpsAtlas/Features/RF/sites.html",
  "./FieldOpsAtlas/Features/RF/dtt.html",
  "./FieldOpsAtlas/Features/RF/dab.html",
  "./FieldOpsAtlas/Features/RF/fm.html",
  "./FieldOpsAtlas/Features/RF/services.html",
  "./FieldOpsAtlas/Features/RF/equipment.html",
  "./FieldOpsAtlas/Features/RF/paths.html",
  "./FieldOpsAtlas/Features/RF/settings.html",
  "./FieldOpsAtlas/Features/RF/shell.css?v=1.1.1",
  "./FieldOpsAtlas/Features/RF/shell.css?v=1.1.1-profile",
  "./FieldOpsAtlas/Features/RF/shell.js?v=1.1.1",
  "./FieldOpsAtlas/Features/RF/shell.js?v=1.1.1-profile",
  "./FieldOpsAtlas/Features/RF/page.css?v=1.1.1",
  "./FieldOpsAtlas/Features/RF/page.css?v=1.1.1-profile",
  "./FieldOpsAtlas/Features/RF/rf.css?v=1.1.1",
  "./FieldOpsAtlas/Features/RF/rf.css?v=1.1.1-profile",
  "./FieldOpsAtlas/Features/RF/rf-demo-map.js",
  "./FieldOpsAtlas/Features/Network/index.html",
  "./FieldOpsAtlas/Features/Docs/index.html",
  "./FieldOpsAtlas/Features/Tools/index.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_FILES))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => {
        return caches.match(event.request, { ignoreSearch: true })
          .then((cached) => cached || caches.match(MAP_FALLBACK) || caches.match("./index.html"));
      })
  );
});
