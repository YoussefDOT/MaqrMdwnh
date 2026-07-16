// Service worker — PWA installability + static-media caching.
//
// Strategy: CACHE-FIRST, but ONLY for the heavy static media (Sound/, Art/,
// Fonts/, png/jpg icons). These are ~60 MB that used to re-download on every
// visit — including the reload doLogout() triggers, which is why "exiting"
// felt as slow as a cold load. After the first visit they're served instantly
// from disk with zero network use.
//
// Freshness: media is served from cache but ALSO re-fetched in the background on
// every hit (stale-while-revalidate), so replacing an art/sound file shows up on
// the next reload with no bumped `?v=` and no hard refresh. The old pure
// cache-first behaviour pinned a file forever until its URL or CACHE_VERSION
// changed — which meant every art tweak needed a hard refresh to see.
//
// On localhost this goes further and skips the cache entirely (network-first):
// while developing, "the file I just saved" must win, always. The cache is a
// production load-time optimisation, not a dev-loop one.
//
// Everything else (index.html, game.js, style.css, Firebase, Discord, the
// presence relay) passes straight through to the network — code updates are
// never served stale.
const CACHE_VERSION = 'mdwnh-media-v3';

const IS_LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|.*\.local)$/.test(self.location.hostname)
    || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(self.location.hostname);   // LAN phone testing

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

        // Dev: always the file on disk, never a cached copy.
        if (IS_LOCAL) {
            try { return await fetch(req, { cache: 'no-store' }); }
            catch (err) { return (await cache.match(req)) || Response.error(); }
        }

        const cached = await cache.match(req);
        // Revalidate in the background whether or not we had a hit. On a hit this
        // costs the user nothing (the cached response is already on its way) and
        // the fresh copy lands in the cache for the next load.
        const fetching = fetch(req).then(res => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
        }).catch(() => null);

        if (cached) {
            e.waitUntil(fetching);   // keep the SW alive until the refetch settles
            return cached;
        }
        return (await fetching) || Response.error();
    })());
});
