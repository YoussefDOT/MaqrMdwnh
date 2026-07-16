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
// EXCEPTION — content-hashed URLs (`?h=…`, the world-art layers; see
// Art/Workspace/manifest.json and the pre-commit hook). Those are IMMUTABLE by
// construction: the URL only exists for that exact byte content, so a cache hit
// can never be stale and revalidating it is pure waste. They get pure cache-first
// with NO background refetch — which is the whole point. Stale-while-revalidate
// meant every single visit quietly re-downloaded ~18 MB of art it already had,
// competing with the requests the page is actually waiting on. When a hashed file
// IS newly cached, every other cached copy of the same path (the old hashes) is
// dropped, so the cache holds exactly one version of each layer.
//
// On localhost this goes further and skips the cache entirely (network-first):
// while developing, "the file I just saved" must win, always. The cache is a
// production load-time optimisation, not a dev-loop one.
//
// Everything else (index.html, game.js, style.css, Firebase, Discord, the
// presence relay) passes straight through to the network — code updates are
// never served stale.
// Bumping this drops every old cache on activate. v4 exists to evict any
// truncated/partial media entries the pre-v4 code could store — those are
// unloadable-forever images that a reload can't clear on its own.
// v5 exists so the old stale-while-revalidate copies of the world art (cached
// under their un-hashed URLs) are evicted rather than lingering forever unread.
const CACHE_VERSION = 'mdwnh-media-v5';

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

// Delete every cached copy of `url`'s path except `url` itself — i.e. the previous
// content hashes of a file we just re-downloaded. Without this the cache would grow
// a new ~3 MB entry per art edit and never shed the old ones.
async function dropOtherVersions(cache, url) {
    const keys = await cache.keys();
    await Promise.all(keys.map(k => {
        const ku = new URL(k.url);
        if (ku.pathname === url.pathname && ku.href !== url.href) return cache.delete(k);
    }));
}

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;
    // Range requests (Safari streams audio with these) must hit the network —
    // answering them from a cached full-body 200 breaks media playback.
    if (req.headers.has('range')) return;

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;                       // same-origin only
    // Manifests live under Art/ but are NOT media — they're the index that decides
    // which media URLs to ask for. Serving a stale one would pin the old art
    // forever (the exact staleness this cache exists to avoid). Straight to the
    // network, always.
    if (/\.json($|\?)/i.test(url.pathname)) return;
    if (!MEDIA_PATH.test(url.pathname) && !MEDIA_EXT.test(url.pathname)) return;

    e.respondWith((async () => {
        const cache = await caches.open(CACHE_VERSION);

        // Dev: always the file on disk, never a cached copy.
        if (IS_LOCAL) {
            try { return await fetch(req, { cache: 'no-store' }); }
            catch (err) { return (await cache.match(req)) || Response.error(); }
        }

        // A retry (`_retry=…`) exists precisely because a previous attempt wedged —
        // it must never be answered from, or written to, the cache.
        if (url.searchParams.has('_retry')) {
            try { return await fetch(req); } catch (err) { return Response.error(); }
        }

        // Content-hashed (immutable) media: cache-first, and that's it. No
        // revalidation — the bytes behind this URL can never change.
        const hashed = url.searchParams.has('h');
        if (hashed) {
            const hit = await cache.match(req);
            if (hit) return hit;
            try {
                const res = await fetch(req);
                if (res && res.status === 200 && res.type === 'basic') {
                    await cache.put(req, res.clone()).catch(() => {});
                    // Drop every other hash of this same file — one version each.
                    e.waitUntil(dropOtherVersions(cache, url));
                }
                return res;
            } catch (err) {
                return Response.error();
            }
        }

        const cached = await cache.match(req);
        // Revalidate in the background whether or not we had a hit. On a hit this
        // costs the user nothing (the cached response is already on its way) and
        // the fresh copy lands in the cache for the next load.
        const fetching = fetch(req).then(res => {
            // Only ever cache a complete, same-origin 200. A 206 (partial) or an
            // opaque/error response stored here would be handed back as if it were
            // the real file on every future load — an unloadable image that a
            // reload can't fix, which is the exact bug this all exists to prevent.
            // Retry URLs (`_retry=…`) are unique per attempt, so caching them would
            // just bloat the cache with copies nothing will ever ask for again.
            if (res && res.status === 200 && res.type === 'basic' && !url.searchParams.has('_retry')) {
                // put() streams the body; if the connection dies mid-copy it
                // rejects rather than storing a truncated entry. Swallow it — the
                // response itself is still fine to hand to the page.
                cache.put(req, res.clone()).catch(() => {});
            }
            return res;
        }).catch(() => null);

        if (cached) {
            e.waitUntil(fetching);   // keep the SW alive until the refetch settles
            return cached;
        }
        return (await fetching) || Response.error();
    })());
});
