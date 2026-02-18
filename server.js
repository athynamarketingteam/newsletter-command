require('dotenv').config();
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const BEEHIIV_BASE = 'https://api.beehiiv.com/v2';

// Map newsletter slug PREFIXES → .env Publication ID keys
// Newsletter IDs are generated as: name-slug + random-suffix (e.g. 'open-source-ceo-by-bill-kerr-lq3abc5')
// We match by prefix so the random suffix doesn't matter
const PUB_PREFIX_MAP = [
    { prefix: 'roko-basilisk', pubId: process.env.BEEHIIV_PUB_ROKO, isDefault: true },
    { prefix: 'memorandum', pubId: process.env.BEEHIIV_PUB_MEMORANDUM, isDefault: true },
    { prefix: 'open-source-ceo-by-bill-kerr', pubId: process.env.BEEHIIV_PUB_OPENSOURCE, isDefault: true },
];

// ─────────────────────────────────────────────────────────────────────────────
// USER-CONFIGURED NEWSLETTERS (from newsletters.json)
// ─────────────────────────────────────────────────────────────────────────────

const NEWSLETTERS_FILE = path.join(__dirname, 'newsletters.json');

function loadUserNewsletters() {
    try {
        if (fs.existsSync(NEWSLETTERS_FILE)) {
            const data = JSON.parse(fs.readFileSync(NEWSLETTERS_FILE, 'utf8'));
            return Array.isArray(data) ? data : [];
        }
    } catch (e) {
        console.warn('[SETTINGS] Failed to load newsletters.json:', e.message);
    }
    return [];
}

function saveUserNewsletters(newsletters) {
    try {
        fs.writeFileSync(NEWSLETTERS_FILE, JSON.stringify(newsletters, null, 2), 'utf8');
        console.log(`[SETTINGS] Saved ${newsletters.length} user newsletter(s) to newsletters.json`);
        return true;
    } catch (e) {
        console.error('[SETTINGS] Failed to save newsletters.json:', e.message);
        return false;
    }
}

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon'
};

// ─────────────────────────────────────────────────────────────────────────────
// BEEHIIV PROXY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function beehiivFetch(apiPath) {
    return new Promise((resolve, reject) => {
        console.log(`[PROXY] → GET https://api.beehiiv.com${apiPath}`);

        const options = {
            hostname: 'api.beehiiv.com',
            path: apiPath,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.BEEHIIV_API_KEY}`,
                'Content-Type': 'application/json'
            }
        };

        const apiReq = https.request(options, (apiRes) => {
            let body = '';
            apiRes.on('data', chunk => body += chunk);
            apiRes.on('end', () => {
                console.log(`[PROXY] ← ${apiRes.statusCode} (${body.length} bytes)`);
                if (apiRes.statusCode !== 200) {
                    console.log(`[PROXY] Error body: ${body.substring(0, 500)}`);
                }
                resolve({ statusCode: apiRes.statusCode, body });
            });
        });

        apiReq.on('error', (err) => {
            console.error(`[PROXY] Request error:`, err.message);
            reject(err);
        });
        apiReq.end();
    });
}

function resolvePublicationId(newsletter) {
    // Try .env defaults first (exact match, then prefix match)
    const match = PUB_PREFIX_MAP.find(entry =>
        newsletter === entry.prefix || newsletter.startsWith(entry.prefix)
    );
    if (match && match.pubId) return match.pubId;

    // Then check user-configured newsletters from newsletters.json
    const userNewsletters = loadUserNewsletters();
    const userMatch = userNewsletters.find(entry =>
        newsletter === entry.slug || newsletter.startsWith(entry.slug)
    );
    return userMatch ? userMatch.pubId : null;
}

/**
 * Fetch stats for individual posts in controlled batches
 * The single-post endpoint with expand[]=stats returns ~5KB (safe),
 * unlike the list endpoint which can return 20MB+ causing 500 errors.
 */
async function fetchPostStatsInBatches(pubId, posts, concurrency = 3) {
    const results = [...posts]; // clone
    let completed = 0;

    // Process in batches of `concurrency`
    for (let i = 0; i < posts.length; i += concurrency) {
        const batch = posts.slice(i, i + concurrency);
        const promises = batch.map(async (post, batchIdx) => {
            const idx = i + batchIdx;
            try {
                const result = await beehiivFetch(
                    `/v2/publications/${pubId}/posts/${post.id}?expand[]=stats`
                );
                if (result.statusCode === 200) {
                    const detailed = JSON.parse(result.body);
                    results[idx] = detailed.data || detailed;
                }
            } catch (err) {
                // Keep original post without stats on failure
                console.log(`[PROXY] Stats fetch failed for post ${post.id}: ${err.message}`);
            }
            completed++;
        });
        await Promise.all(promises);

        // Log progress every 10 posts
        if (completed % 10 === 0 || completed === posts.length) {
            console.log(`[PROXY] Stats progress: ${completed}/${posts.length}`);
        }
    }

    return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

async function handleApiRoute(req, res, parsed) {
    const apiPath = parsed.pathname;
    const params = new URLSearchParams(parsed.query || '');

    // Set CORS headers for local dev
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    try {
        // GET /api/beehiiv/posts?newsletter=roko-basilisk&recentStats=15
        if (apiPath === '/api/beehiiv/posts') {
            const newsletter = params.get('newsletter');
            const recentStatsCount = parseInt(params.get('recentStats') || '0', 10);
            const pubId = resolvePublicationId(newsletter);
            if (!pubId) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: `Unknown newsletter: ${newsletter}` }));
                return;
            }

            // Step 1: Fast bulk fetch — posts WITHOUT expand (~2s)
            let allPosts = [];
            let page = 1;
            let hasMore = true;

            console.log(`[PROXY] Fetching posts for "${newsletter}" (lightweight mode)…`);
            while (hasMore) {
                const result = await beehiivFetch(
                    `/v2/publications/${pubId}/posts?limit=100&page=${page}`
                );

                if (result.statusCode !== 200) {
                    if (allPosts.length > 0) break;
                    res.writeHead(result.statusCode);
                    res.end(result.body);
                    return;
                }

                const json = JSON.parse(result.body);
                allPosts = allPosts.concat(json.data || []);
                console.log(`[PROXY] Page ${page}/${json.total_pages || '?'} — ${allPosts.length} posts`);

                if (json.total_pages && page < json.total_pages) {
                    page++;
                } else {
                    hasMore = false;
                }
            }

            console.log(`[PROXY] ✅ ${allPosts.length} posts fetched in ${page} API call(s)`);

            // Step 2: Hybrid stats — fetch real stats for N most recent posts (~10s)
            if (recentStatsCount > 0 && allPosts.length > 0) {
                // Sort by publish_date descending to find most recent
                const sorted = [...allPosts]
                    .filter(p => p.publish_date)
                    .sort((a, b) => b.publish_date - a.publish_date);

                const toFetch = sorted.slice(0, recentStatsCount);
                const toFetchIds = new Set(toFetch.map(p => p.id));

                console.log(`[PROXY] Fetching real stats for ${toFetch.length} recent posts…`);

                // Fetch in parallel batches of 5 to stay within rate limits
                const BATCH = 5;
                const statsMap = {};

                for (let i = 0; i < toFetch.length; i += BATCH) {
                    const batch = toFetch.slice(i, i + BATCH);
                    const results = await Promise.all(batch.map(async (post) => {
                        try {
                            const r = await beehiivFetch(
                                `/v2/publications/${pubId}/posts/${post.id}?expand[]=stats`
                            );
                            if (r.statusCode === 200) {
                                const d = JSON.parse(r.body);
                                const fullPost = d.data || d;
                                // Only keep stats.email and stats.web, drop stats.clicks (heavy)
                                return {
                                    id: post.id,
                                    stats: {
                                        email: (fullPost.stats && fullPost.stats.email) || {},
                                        web: (fullPost.stats && fullPost.stats.web) || {}
                                    }
                                };
                            }
                        } catch (err) {
                            console.log(`[PROXY] Stats failed for ${post.id}: ${err.message}`);
                        }
                        return null;
                    }));

                    results.filter(Boolean).forEach(r => { statsMap[r.id] = r.stats; });
                    console.log(`[PROXY] Stats batch ${Math.ceil((i + 1) / BATCH)}/${Math.ceil(toFetch.length / BATCH)} done`);
                }

                // Merge stats into posts
                allPosts = allPosts.map(post => {
                    if (statsMap[post.id]) {
                        return { ...post, stats: statsMap[post.id] };
                    }
                    return post;
                });

                console.log(`[PROXY] ✅ Merged real stats for ${Object.keys(statsMap).length} posts`);
            }

            res.writeHead(200);
            res.end(JSON.stringify({ data: allPosts, total: allPosts.length }));
            return;
        }

        // GET /api/beehiiv/subscribers?newsletter=roko-basilisk
        if (apiPath === '/api/beehiiv/subscribers') {
            const newsletter = params.get('newsletter');
            const pubId = resolvePublicationId(newsletter);
            if (!pubId) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: `Unknown newsletter: ${newsletter}` }));
                return;
            }

            // Fetch subscriber count using publication stats
            const result = await beehiivFetch(
                `/v2/publications/${pubId}?expand[]=stats`
            );

            if (result.statusCode !== 200) {
                res.writeHead(result.statusCode);
                res.end(result.body);
                return;
            }

            res.writeHead(200);
            res.end(result.body);
            return;
        }

        // GET /api/beehiiv/publications — list all publications (useful for discovery)
        if (apiPath === '/api/beehiiv/publications') {
            const result = await beehiivFetch('/v2/publications');

            res.writeHead(result.statusCode);
            res.end(result.body);
            return;
        }

        // ─── SETTINGS ENDPOINTS ──────────────────────────────────────────

        // GET /api/settings/newsletters — return all configured newsletters
        if (apiPath === '/api/settings/newsletters' && req.method === 'GET') {
            const userNewsletters = loadUserNewsletters();

            // Build combined list: defaults from .env + user-added from newsletters.json
            const allNewsletters = PUB_PREFIX_MAP.map(entry => ({
                slug: entry.prefix,
                pubId: entry.pubId ? ('***' + entry.pubId.slice(-6)) : '',
                hasPubId: !!entry.pubId,
                isDefault: true
            }));

            // Add user-configured newsletters (not already in defaults)
            userNewsletters.forEach(entry => {
                const alreadyDefault = PUB_PREFIX_MAP.some(d =>
                    entry.slug === d.prefix || entry.slug.startsWith(d.prefix)
                );
                if (!alreadyDefault) {
                    allNewsletters.push({
                        slug: entry.slug,
                        pubId: entry.pubId ? ('***' + entry.pubId.slice(-6)) : '',
                        hasPubId: !!entry.pubId,
                        isDefault: false
                    });
                }
            });

            res.writeHead(200);
            res.end(JSON.stringify({ newsletters: allNewsletters }));
            return;
        }

        // POST /api/settings/newsletters — save a newsletter's publication ID
        if (apiPath === '/api/settings/newsletters' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { slug, pubId } = JSON.parse(body);
                    if (!slug || !pubId) {
                        res.writeHead(400);
                        res.end(JSON.stringify({ error: 'slug and pubId are required' }));
                        return;
                    }

                    // Don't allow overriding .env defaults
                    const isDefault = PUB_PREFIX_MAP.some(d =>
                        slug === d.prefix || slug.startsWith(d.prefix)
                    );
                    if (isDefault) {
                        res.writeHead(400);
                        res.end(JSON.stringify({ error: 'Cannot override default newsletter — edit .env instead' }));
                        return;
                    }

                    // Load, update, save
                    const userNewsletters = loadUserNewsletters();
                    const existing = userNewsletters.findIndex(n => n.slug === slug);
                    if (existing !== -1) {
                        userNewsletters[existing].pubId = pubId;
                    } else {
                        userNewsletters.push({ slug, pubId });
                    }

                    if (saveUserNewsletters(userNewsletters)) {
                        res.writeHead(200);
                        res.end(JSON.stringify({ success: true, message: `Publication ID saved for ${slug}` }));
                    } else {
                        res.writeHead(500);
                        res.end(JSON.stringify({ error: 'Failed to save newsletters.json' }));
                    }
                } catch (e) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
                }
            });
            return;
        }

        // DELETE /api/settings/newsletters?slug=xxx — remove a user-configured newsletter
        if (apiPath === '/api/settings/newsletters' && req.method === 'DELETE') {
            const slug = params.get('slug');
            if (!slug) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'slug parameter is required' }));
                return;
            }

            const userNewsletters = loadUserNewsletters();
            const filtered = userNewsletters.filter(n => n.slug !== slug);
            saveUserNewsletters(filtered);

            res.writeHead(200);
            res.end(JSON.stringify({ success: true }));
            return;
        }

        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Unknown API route' }));

    } catch (err) {
        console.error('Beehiiv proxy error:', err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Proxy request failed', details: err.message }));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SERVER
// ─────────────────────────────────────────────────────────────────────────────

http.createServer(async (req, res) => {
    const parsed = url.parse(req.url);
    const pathname = parsed.pathname;

    // Route API requests to the proxy handler
    if (pathname.startsWith('/api/')) {
        return handleApiRoute(req, res, parsed);
    }

    // Static file serving (original behavior)
    const filePath = path.join(__dirname, pathname === '/' ? '/index.html' : pathname);

    fs.readFile(filePath, (err, data) => {
        if (err) {
            // SPA fallback: serve index.html for any path that isn't a real file
            fs.readFile(path.join(__dirname, 'index.html'), (err2, indexData) => {
                if (err2) {
                    res.writeHead(404);
                    res.end('Not found');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(indexData);
                }
            });
        } else {
            const ext = path.extname(filePath);
            res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
            res.end(data);
        }
    });
}).listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);

    // Verify Beehiiv config on startup
    if (!process.env.BEEHIIV_API_KEY || process.env.BEEHIIV_API_KEY === 'PASTE_YOUR_API_KEY_HERE') {
        console.log('⚠️  Beehiiv API key not configured — edit .env to enable API sync');
    } else {
        const count = PUB_PREFIX_MAP.filter(e => e.pubId).length;
        console.log(`✅ Beehiiv API configured with ${count} publication(s)`);
    }
});
