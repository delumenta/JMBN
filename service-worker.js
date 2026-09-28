const CACHE_NAME = "travel-shell-v3";

const APP_SHELL = [
  "/onthego/",
  "/onthego/index.html",
  "/onthego/schedule.html",
  "/onthego/food.html",
  "/onthego/bookings.html",
  "/onthego/places.html",
  "/onthego/expenses.html",
  "/onthego/manifest.webmanifest",
  "/onthego/pwa.js",
  "/onthego/footer.js",
  "/onthego/supabase.js",
  "/onthego/countries.js",
  "/onthego/icons/icon-192.png",
  "/onthego/icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async cache => {
        await Promise.allSettled(
          APP_SHELL.map(url => cache.add(url))
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if(event.data === "SKIP_WAITING"){
    self.skipWaiting();
  }
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if(request.method !== "GET"){
    return;
  }

  const url = new URL(request.url);

  if(url.origin !== self.location.origin){
    return;
  }

  if(request.mode === "navigate"){
    event.respondWith(networkFirst(request, true));
    return;
  }

  event.respondWith(networkFirst(request, false));
});

async function networkFirst(request, isNavigation){
  const cache = await caches.open(CACHE_NAME);

  try{
    const response = await fetch(request);

    if(response && response.ok){
      cache.put(request, response.clone());
    }

    return response;
  }
  catch(error){
    const cached = await cache.match(request);

    if(cached){
      return cached;
    }

    if(isNavigation){
      return (
        await cache.match("/onthego/index.html")
        || Response.error()
      );
    }

    return Response.error();
  }
}
