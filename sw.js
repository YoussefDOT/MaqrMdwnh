// Service worker — PWA installability + static-media caching.
//
// Strategy: CACHE-FIRST, but ONLY for the heavy static media (Sound/, Art/,
// Fonts/, png/jpg icons). These are ~60 MB that used to re-download on every
// visit — including the reload doLogout() triggers, which is why "exiting"
// felt as slow as a cold load. After the first visit they're served instantly
// from disk with zero network use.
//
// Updating a media file: reference it with a bumped query (e.g. `Foo.png?v=3`)
// in the code — a different URL is a different cache entry — or bump
// CACHE_VERSION below to drop everything at once.
//
// Everything else (index.html, game.js, style.css, Firebase, Discord, the
// presence relay) passes straight through to the network — code updates are
// never served stale.
const CACHE_VERSION = 'mdwnh-media-v1';

const MEDIA_PATH = /\/(Sound|Art|Fonts)\//;
const MEDIA_EXT  = /\.(png|jpg|jpeg|webp|gif|mp3|wav|ogg|otf|ttf|woff2?)($|\?)/i;

self.addEventListener('install', (e) => self.skipWaiting());

self.addEventListener('activate', (e) => {
    e.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names.filter(n => n !== CACHE_VERSION).map(n => caches.delete(n)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;
    // Range requests (Safari streams audio with these) must hit the network —
    // answering them from a cached full-body 200 breaks media playback.
    if (req.headers.has('range')) return;

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;                       // same-origin only
    if (!MEDIA_PATH.test(url.pathname) && !MEDIA_EXT.test(url.pathname)) return;

    e.respondWith((async () => {
        const cache = await caches.open(CACHE_VERSION);
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
            const res = await fetch(req);
            if (res && res.ok) cache.put(req, res.clone());
            return res;
        } catch (err) {
            return Response.error();
        }
    })());
});
