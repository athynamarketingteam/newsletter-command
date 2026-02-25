/* ════════════════════════════════════════════════════════════════════════════
   XLSX PARSER — Newsletter Analytics Dashboard
   Parses multi-tab Excel files for the Mariana Protocol data model
   ════════════════════════════════════════════════════════════════════════════ */

const XLSXParser = (function () {
    'use strict';

    // ─────────────────────────────────────────────────────────────────────────
    // TAB NAME MAPPING (case-insensitive)
    // ─────────────────────────────────────────────────────────────────────────

    const TAB_ALIASES = {
        posts: ['posts', 'post', 'campaigns', 'campaign'],
        growth: ['subscriber monthly', 'subscribers monthly', 'monthly', 'growth'],
        audience: ['current subscribers', 'active subscribers', 'subscribers', 'audience']
    };

    // ─────────────────────────────────────────────────────────────────────────
    // UTILITY FUNCTIONS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Convert Excel serial date to JavaScript Date
     * Excel dates are days since 1900-01-01 (with leap year bug)
     */
    function excelDateToJS(serial) {
        if (!serial || typeof serial !== 'number') return null;
        // Excel epoch is 1900-01-01, but with a leap year bug
        // 25569 = days between 1900-01-01 and 1970-01-01
        // +12h (43200000ms) to place at noon UTC — prevents timezone shifts 
        // from changing the calendar day in any timezone (UTC-12 to UTC+14)
        return new Date((serial - 25569) * 86400 * 1000 + 43200000);
    }

    /**
     * Find a sheet by name with case-insensitive matching
     */
    function findSheet(workbook, aliases) {
        const sheetNames = workbook.SheetNames.map(name => name.toLowerCase().trim());

        for (const alias of aliases) {
            const index = sheetNames.indexOf(alias.toLowerCase());
            if (index !== -1) {
                return workbook.Sheets[workbook.SheetNames[index]];
            }
        }
        return null;
    }

    /**
     * Convert sheet to JSON with header normalization
     */
    function sheetToJSON(sheet) {
        if (!sheet) return [];
        return XLSX.utils.sheet_to_json(sheet, { defval: null });
    }

    /**
     * Normalize column name for consistent access
     */
    function normalizeColumnName(name) {
        if (!name) return '';
        return name.toString().toLowerCase().trim().replace(/[\s-]+/g, '_');
    }

    /**
     * Get value from row with multiple possible column names
     */
    function getColumn(row, ...possibleNames) {
        for (const name of possibleNames) {
            for (const key of Object.keys(row)) {
                if (normalizeColumnName(key) === normalizeColumnName(name)) {
                    return row[key];
                }
            }
        }
        return null;
    }

    /**
     * Convert decimal rate (0-1) to percentage (0-100)
     */
    function toPercentage(value) {
        if (value === null || value === undefined) return null;
        const num = parseFloat(value);
        if (isNaN(num)) return null;
        // If already looks like a percentage (> 1), return as-is
        return num <= 1 ? num * 100 : num;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PARSERS FOR EACH TAB
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Parse the 'posts' tab (Campaign Performance)
     */
    function parsePosts(sheet) {
        const raw = sheetToJSON(sheet);

        return raw
            .filter(row => getColumn(row, 'date') !== null)
            .map(row => {
                const date = excelDateToJS(getColumn(row, 'date'));
                if (!date) return null;

                return {
                    date,
                    title: getColumn(row, 'subject_or_title', 'subject', 'title') || 'Untitled',
                    sent: parseInt(getColumn(row, 'sent')) || 0,
                    delivered: parseInt(getColumn(row, 'delivered')) || 0,
                    totalOpens: parseInt(getColumn(row, 'total_opens')) || 0,
                    uniqueOpens: parseInt(getColumn(row, 'unique_opens')) || 0,
                    openRate: toPercentage(getColumn(row, 'open_rate')),
                    uniqueClicks: parseInt(getColumn(row, 'unique_clicks')) || 0,
                    ctr: toPercentage(getColumn(row, 'click_through_rate', 'click-through_rate', 'ctr')),
                    verifiedClicks: parseInt(getColumn(row, 'verified_unique_clicks')) || 0,
                    verifiedCtr: toPercentage(getColumn(row, 'verified_click_through_rate', 'verified_click-through_rate')),
                    unsubscribed: parseInt(getColumn(row, 'unsubscribed')) || 0,
                    unsubscribeRate: toPercentage(getColumn(row, 'unsubscribe_rate')),
                    deliveryRate: toPercentage(getColumn(row, 'delivery_rate')),
                    contentTags: getColumn(row, 'content_tags') || null
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.date - b.date);
    }

    /**
     * Parse the 'subscriber monthly' tab (Growth Analysis)
     */
    function parseGrowth(sheet) {
        const raw = sheetToJSON(sheet);

        return raw
            .filter(row => getColumn(row, 'date') !== null)
            .map(row => {
                const date = excelDateToJS(getColumn(row, 'date'));
                if (!date) return null;

                return {
                    date,
                    month: date.toLocaleString('default', { month: 'short', year: 'numeric' }),
                    subscribed: parseInt(getColumn(row, 'subscribed', 'new_subscribers', 'new')) || 0,
                    unsubscribed: parseInt(getColumn(row, 'unsubscribed', 'unsubscribes')) || 0,
                    net: parseInt(getColumn(row, 'net', 'net_growth')) || 0
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.date - b.date);
    }

    /**
     * Parse the 'current subscribers' tab (Audience History)
     */
    function parseAudience(sheet) {
        const raw = sheetToJSON(sheet);

        return raw
            .filter(row => getColumn(row, 'date') !== null)
            .map(row => {
                const date = excelDateToJS(getColumn(row, 'date'));
                if (!date) return null;

                return {
                    date,
                    activeSubscribers: parseInt(getColumn(row, 'active_subscribers', 'total_active_subscribers', 'subscribers')) || 0
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.date - b.date);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MAIN PARSER
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Parse an XLSX file and return the three data stores
     * @param {ArrayBuffer} data - File data from FileReader
     * @returns {Object} { posts, growth, audience, warnings, success }
     */
    function parseXLSX(data) {
        const result = {
            posts: null,
            growth: null,
            audience: null,
            warnings: [],
            success: false
        };

        try {
            const workbook = XLSX.read(data, { type: 'array' });

            // Find and parse each tab
            const postsSheet = findSheet(workbook, TAB_ALIASES.posts);
            const growthSheet = findSheet(workbook, TAB_ALIASES.growth);
            const audienceSheet = findSheet(workbook, TAB_ALIASES.audience);

            // Parse posts tab
            if (postsSheet) {
                result.posts = parsePosts(postsSheet);
                console.log(`[XLSXParser] Parsed ${result.posts.length} posts`);
            } else {
                result.warnings.push('Missing "posts" tab — Campaign performance data unavailable');
            }

            // Parse growth tab
            if (growthSheet) {
                result.growth = parseGrowth(growthSheet);
                console.log(`[XLSXParser] Parsed ${result.growth.length} growth records`);
            } else {
                result.warnings.push('Missing "subscriber monthly" tab — Growth chart unavailable');
            }

            // Parse audience tab
            if (audienceSheet) {
                result.audience = parseAudience(audienceSheet);
                console.log(`[XLSXParser] Parsed ${result.audience.length} audience records`);
            } else {
                result.warnings.push('Missing "current subscribers" tab — Hero metric unavailable');
            }

            // Success if we have at least one data source
            result.success = result.posts || result.growth || result.audience;

        } catch (error) {
            console.error('[XLSXParser] Error parsing file:', error);
            result.warnings.push(`Parse error: ${error.message}`);
            result.success = false;
        }

        return result;
    }

    /**
     * Read file and parse XLSX
     * @param {File} file - File object from input
     * @returns {Promise<Object>} Parsed data
     */
    async function parseFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const data = new Uint8Array(e.target.result);
                const result = parseXLSX(data);
                resolve(result);
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsArrayBuffer(file);
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AGGREGATION UTILITIES (for date range filtering)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Filter posts by date range
     */
    function filterByDateRange(data, startDate, endDate) {
        if (!data || !Array.isArray(data)) return [];
        return data.filter(row => {
            const d = row.date;
            return d >= startDate && d <= endDate;
        });
    }

    /**
     * Aggregate posts data with proper averaging for rates
     * (Implements The Mariana Protocol: average rates, sum counts)
     */
    function aggregatePosts(posts) {
        if (!posts || posts.length === 0) {
            return {
                sent: 0,
                delivered: 0,
                totalOpens: 0,
                uniqueOpens: 0,
                uniqueClicks: 0,
                verifiedClicks: 0,
                unsubscribed: 0,
                openRate: null,
                ctr: null,
                verifiedCtr: null,
                deliveryRate: null,
                count: 0
            };
        }

        // Sum counts
        const summed = {
            sent: posts.reduce((sum, p) => sum + (p.sent || 0), 0),
            delivered: posts.reduce((sum, p) => sum + (p.delivered || 0), 0),
            totalOpens: posts.reduce((sum, p) => sum + (p.totalOpens || 0), 0),
            uniqueOpens: posts.reduce((sum, p) => sum + (p.uniqueOpens || 0), 0),
            uniqueClicks: posts.reduce((sum, p) => sum + (p.uniqueClicks || 0), 0),
            verifiedClicks: posts.reduce((sum, p) => sum + (p.verifiedClicks || 0), 0),
            unsubscribed: posts.reduce((sum, p) => sum + (p.unsubscribed || 0), 0),
            count: posts.length
        };

        // Weighted rates (matching Beehiiv methodology):
        // Open Rate = total unique opens / total delivered
        // CTR = total unique clicks / total unique opens  
        // Verified CTR = total verified clicks / total unique opens
        // Delivery Rate = total delivered / total sent
        summed.openRate = summed.delivered > 0
            ? Math.round((summed.uniqueOpens / summed.delivered) * 10000) / 100
            : null;
        summed.ctr = summed.uniqueOpens > 0
            ? Math.round((summed.uniqueClicks / summed.uniqueOpens) * 10000) / 100
            : null;
        summed.verifiedCtr = summed.uniqueOpens > 0
            ? Math.round((summed.verifiedClicks / summed.uniqueOpens) * 10000) / 100
            : null;
        summed.deliveryRate = summed.sent > 0
            ? Math.round((summed.delivered / summed.sent) * 10000) / 100
            : null;

        // Per-post averages for click metrics (Mariana Protocol: average, not sum)
        summed.avgUniqueClicks = summed.count > 0
            ? Math.round((summed.uniqueClicks / summed.count) * 100) / 100
            : 0;
        summed.avgVerifiedClicks = summed.count > 0
            ? Math.round((summed.verifiedClicks / summed.count) * 100) / 100
            : 0;

        return summed;
    }

    /**
     * Get the latest active subscriber count (Mariana Protocol)
     */
    function getLatestSubscriberCount(audience) {
        if (!audience || audience.length === 0) return null;
        return audience[audience.length - 1].activeSubscribers;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────

    return {
        parseFile,
        parseXLSX,
        filterByDateRange,
        aggregatePosts,
        getLatestSubscriberCount,
        // Expose for testing
        excelDateToJS,
        toPercentage
    };

})();

// Make available globally
window.XLSXParser = XLSXParser;
