const { beehiivFetch, resolvePublicationId, setCorsHeaders } = require('../_helpers');

module.exports = async function handler(req, res) {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    const { newsletter, recentStats } = req.query;
    const recentStatsCount = parseInt(recentStats || '0', 10);
    const pubId = resolvePublicationId(newsletter);

    if (!pubId) {
        return res.status(400).json({ error: `Unknown newsletter: ${newsletter}` });
    }

    try {
        // Step 1: Fast bulk fetch — posts WITHOUT expand
        let allPosts = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const result = await beehiivFetch(
                `/v2/publications/${pubId}/posts?limit=100&page=${page}`
            );

            if (result.statusCode !== 200) {
                if (allPosts.length > 0) break;
                return res.status(result.statusCode).end(result.body);
            }

            const json = JSON.parse(result.body);
            allPosts = allPosts.concat(json.data || []);

            if (json.total_pages && page < json.total_pages) {
                page++;
            } else {
                hasMore = false;
            }
        }

        // Step 2: Hybrid stats — fetch real stats for N most recent posts
        if (recentStatsCount > 0 && allPosts.length > 0) {
            const sorted = [...allPosts]
                .filter(p => p.publish_date)
                .sort((a, b) => b.publish_date - a.publish_date);

            const toFetch = sorted.slice(0, recentStatsCount);

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
                            return {
                                id: post.id,
                                stats: {
                                    email: (fullPost.stats && fullPost.stats.email) || {},
                                    web: (fullPost.stats && fullPost.stats.web) || {}
                                }
                            };
                        }
                    } catch (err) {
                        // silently skip
                    }
                    return null;
                }));

                results.filter(Boolean).forEach(r => { statsMap[r.id] = r.stats; });
            }

            // Merge stats into posts
            allPosts = allPosts.map(post => {
                if (statsMap[post.id]) {
                    return { ...post, stats: statsMap[post.id] };
                }
                return post;
            });
        }

        return res.status(200).json({ data: allPosts, total: allPosts.length });

    } catch (err) {
        return res.status(500).json({ error: 'Proxy request failed', details: err.message });
    }
};
