/* ════════════════════════════════════════════════════════════════════════════
   BEEHIIV API CLIENT
   Fetches data from the local proxy and transforms it into the same format
   as xlsx-parser.js (posts, growth, audience stores)
   ════════════════════════════════════════════════════════════════════════════ */

const BeehiivAPI = (function () {
    'use strict';

    // ─────────────────────────────────────────────────────────────────────────
    // PROXY ENDPOINTS (calls go to our server.js, never directly to Beehiiv)
    // ─────────────────────────────────────────────────────────────────────────

    async function fetchPosts(newsletterId) {
        const res = await fetch(`/api/beehiiv/posts?newsletter=${encodeURIComponent(newsletterId)}&recentStats=60`);
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        return res.json();
    }

    async function fetchSubscriberStats(newsletterId) {
        const res = await fetch(`/api/beehiiv/subscribers?newsletter=${encodeURIComponent(newsletterId)}`);
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        return res.json();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DATA TRANSFORMERS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Transform Beehiiv posts → dashboard posts store
     * Posts come WITHOUT per-post stats (for speed).
     * Publication-level aggregate stats are applied to populate KPI fields.
     */
    function transformPosts(apiPosts, pubStats) {
        const stats = pubStats || {};
        const totalPosts = apiPosts.filter(p => p.publish_date || p.displayed_date || p.created).length || 1;

        // Distribute publication totals across posts proportionally
        const avgSent = Math.round((stats.total_sent || 0) / totalPosts);
        const avgDelivered = Math.round((stats.total_delivered || 0) / totalPosts);
        const avgOpened = Math.round((stats.total_unique_opened || 0) / totalPosts);
        const avgClicked = Math.round((stats.total_clicked || 0) / totalPosts);

        return apiPosts
            .filter(post => post.publish_date || post.displayed_date || post.created)
            .map(post => {
                // Check if this post has individual stats (stats.email)
                const emailStats = (post.stats && post.stats.email) || null;
                const timestamp = post.publish_date || post.displayed_date || post.created;
                const date = new Date(timestamp * 1000);

                // Use per-post stats if available, otherwise use publication averages
                const sent = emailStats ? (emailStats.recipients || 0) : avgSent;
                const delivered = emailStats ? (emailStats.delivered || 0) : avgDelivered;
                const openRate = emailStats ? (emailStats.open_rate || 0) : (stats.average_open_rate || 0);
                const ctr = emailStats ? (emailStats.click_rate || 0) : (stats.average_click_rate || 0);
                const uniqueOpens = emailStats ? (emailStats.unique_opens || 0) : avgOpened;
                const totalOpens = emailStats ? (emailStats.opens || 0) : avgOpened;
                const uniqueClicks = emailStats ? (emailStats.unique_clicks || 0) : avgClicked;
                const verifiedClicks = emailStats ? (emailStats.unique_verified_clicks || emailStats.verified_clicks || 0) : 0;
                const unsubscribed = emailStats ? (emailStats.unsubscribes || 0) : 0;

                const deliveryRate = sent > 0 ? (delivered / sent) * 100 : 0;
                const unsubscribeRate = sent > 0 ? (unsubscribed / sent) * 100 : 0;
                const verifiedCtr = uniqueOpens > 0 ? (verifiedClicks / uniqueOpens) * 100 : 0;

                return {
                    date,
                    title: post.title || post.subject_line || 'Untitled',
                    sent,
                    delivered,
                    totalOpens,
                    uniqueOpens,
                    openRate: round2(openRate),
                    uniqueClicks,
                    ctr: round2(ctr),
                    verifiedClicks,
                    verifiedCtr: round2(verifiedCtr),
                    unsubscribed,
                    unsubscribeRate: round2(unsubscribeRate),
                    deliveryRate: round2(deliveryRate),
                    contentTags: (post.content_tags || []).join(', ') || null
                };
            })
            .sort((a, b) => a.date - b.date);
    }

    /**
     * Derive growth store from posts data
     * Groups by month to match the growth tab format
     */
    function deriveGrowth(posts) {
        const monthMap = {};

        posts.forEach(post => {
            const d = new Date(post.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const monthLabel = d.toLocaleString('default', { month: 'short', year: 'numeric' });

            if (!monthMap[key]) {
                monthMap[key] = {
                    date: new Date(d.getFullYear(), d.getMonth(), 1),
                    month: monthLabel,
                    subscribed: 0,
                    unsubscribed: 0,
                    net: 0
                };
            }

            monthMap[key].unsubscribed += post.unsubscribed || 0;
        });

        return Object.values(monthMap)
            .sort((a, b) => a.date - b.date);
    }

    /**
     * Build audience store from publication stats AND per-post recipient history
     * Each post's "sent" count acts as a proxy for subscriber count at that date
     */
    function buildAudience(pubStats, posts) {
        const data = pubStats.data || pubStats;
        const stats = data.stats || {};
        const currentCount = stats.active_subscriptions || stats.total_subscriptions || 0;

        const audience = [];

        // Derive historical subscriber counts from per-post recipients
        // Each post's "sent" count is roughly the subscriber count at that time
        if (posts && posts.length > 0) {
            const sorted = posts
                .filter(p => p.sent > 0 && p.date)
                .slice()
                .sort((a, b) => a.date - b.date);

            // Group by date (take max recipients per day as the subscriber count)
            const dailyMap = {};
            sorted.forEach(p => {
                const dateKey = p.date.toISOString().split('T')[0];
                if (!dailyMap[dateKey] || p.sent > dailyMap[dateKey].sent) {
                    dailyMap[dateKey] = { date: new Date(p.date), activeSubscribers: p.sent };
                }
            });

            Object.values(dailyMap)
                .sort((a, b) => a.date - b.date)
                .forEach(d => audience.push(d));
        }

        // Always add today's actual count from the API as the latest data point
        if (currentCount > 0) {
            audience.push({
                date: new Date(),
                activeSubscribers: currentCount
            });
        }

        // If no historical data, return at least the current count
        if (audience.length === 0) {
            audience.push({ date: new Date(), activeSubscribers: 0 });
        }

        return audience;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MAIN SYNC FUNCTION
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Sync all data for a newsletter from Beehiiv
     * @param {string} newsletterId - Newsletter slug (e.g. 'roko-basilisk')
     * @returns {Object} { posts, growth, audience, lastUpdated, success, warnings }
     */
    async function sync(newsletterId) {
        const warnings = [];

        // Fetch posts and subscriber stats in parallel (both are fast)
        const [postsResponse, subsResponse] = await Promise.all([
            fetchPosts(newsletterId),
            fetchSubscriberStats(newsletterId)
        ]);

        // Extract publication-level aggregate stats
        const pubData = subsResponse.data || subsResponse;
        const pubStats = pubData.stats || {};

        // Transform posts using publication aggregate stats for KPI values
        const posts = transformPosts(postsResponse.data || [], pubStats);
        if (posts.length === 0) {
            warnings.push('No published posts found');
        }

        // Derive growth from posts
        const growth = deriveGrowth(posts);
        if (growth.length === 0) {
            warnings.push('No growth data could be derived');
        }

        // Build audience from subscriber stats
        const audience = buildAudience(subsResponse, posts);
        if (audience.length === 0 || audience[0].activeSubscribers === 0) {
            warnings.push('No active subscriber count found');
        }

        return {
            posts,
            growth,
            audience,
            lastUpdated: new Date().toISOString(),
            success: true,
            warnings,
            source: 'beehiiv-api'
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UTILITIES
    // ─────────────────────────────────────────────────────────────────────────

    function round2(value) {
        return Math.round(value * 100) / 100;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────

    return {
        sync,
        fetchPosts,
        fetchSubscriberStats,
        transformPosts,
        deriveGrowth,
        buildAudience
    };

})();

window.BeehiivAPI = BeehiivAPI;
