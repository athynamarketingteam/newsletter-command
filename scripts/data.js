/* ════════════════════════════════════════════════════════════════════════════
   DATA MODULE — Newsletter Analytics Dashboard
   Mock data and data service layer
   ════════════════════════════════════════════════════════════════════════════ */

const DataService = (function () {
    'use strict';

    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    /** Return ISO week number and year for a Date, e.g. { year:2025, week:3 } */
    function getISOWeek(d) {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
        return { year: date.getUTCFullYear(), week: weekNo };
    }

    /** Build a sortable key + short label for a week, e.g. "2025-W03" → "W3 Jan" */
    function weekKey(d) {
        const { year, week } = getISOWeek(d);
        return `${year}-W${String(week).padStart(2, '0')}`;
    }
    function weekLabel(key) {
        // key = "2025-W03"  →  "Jan 13" (Monday of that ISO week)
        const parts = key.split('-W');
        const year = parseInt(parts[0], 10);
        const week = parseInt(parts[1], 10);
        // ISO week 1 contains Jan 4; Monday of week 1
        const jan4 = new Date(Date.UTC(year, 0, 4));
        const dayOfWeek = jan4.getUTCDay() || 7; // Mon=1..Sun=7
        const monday = new Date(jan4);
        monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (week - 1) * 7);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[monday.getUTCMonth()]} ${monday.getUTCDate()}`;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // IMPORTED DATA (from CSV or XLSX)
    // ─────────────────────────────────────────────────────────────────────────

    let importedData = null;
    let xlsxData = null;  // 3-store model: { posts, growth, audience }
    let dateRangeFilter = null;  // { startDate: Date, endDate: Date } or null = show all

    /** Filter an array of objects with .date by the current date range */
    function filterByDateRange(items) {
        if (!dateRangeFilter || !items) return items;
        const { startDate, endDate } = dateRangeFilter;
        return items.filter(item => {
            if (!item.date) return false;
            // Dates from localStorage may be ISO strings — ensure proper Date comparison
            const d = (item.date instanceof Date) ? item.date : new Date(item.date);
            return !isNaN(d.getTime()) && d >= startDate && d <= endDate;
        });
    }

    /**
     * Filter for monthly aggregate data. Snaps the start date to the 1st of
     * its month so that months partially overlapping the range are included.
     * E.g., 90d from Feb 12 = Nov 14 → snapped to Nov 1, so Nov is included.
     */
    function filterByDateRangeMonthly(items) {
        if (!dateRangeFilter || !items) return items;
        const { startDate, endDate } = dateRangeFilter;
        // Snap start to 1st of month
        const snappedStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        return items.filter(item => {
            if (!item.date) return false;
            const d = (item.date instanceof Date) ? item.date : new Date(item.date);
            return !isNaN(d.getTime()) && d >= snappedStart && d <= endDate;
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DEFAULT DATA (no file imported = all zeros)
    // ─────────────────────────────────────────────────────────────────────────

    const defaultData = {
        newsletter: {
            id: 'default',
            name: "No Data Imported",
            slug: 'default'
        },
        current: {
            activeSubscribers: 0,
            openRate: 0,
            ctr: 0,
            verifiedCtr: 0,
            deliveryRate: 0,
            uniqueClicks: 0,
            verifiedClicks: 0
        },
        deltas: {
            activeSubscribers: { value: 0, direction: 'neutral' },
            openRate: { value: 0, direction: 'neutral' },
            ctr: { value: 0, direction: 'neutral' },
            verifiedCtr: { value: 0, direction: 'neutral' },
            deliveryRate: { value: 0, direction: 'neutral' },
            uniqueClicks: { value: 0, direction: 'neutral', isAbsolute: true },
            verifiedClicks: { value: 0, direction: 'neutral', isAbsolute: true }
        },
        timeSeries: {
            labels: [],
            verifiedClicks: [],
            subscribed: [],
            unsubscribed: [],
            netGrowth: [],
            activeSubscribers: []
        },
        sparklines: {
            openRate: [],
            ctr: [],
            verifiedCtr: [],
            deliveryRate: [],
            uniqueClicks: [],
            verifiedClicks: [],
            activeSubscribers: []
        },
        annotations: []
    };

    // Helper to get current data source
    function getData() {
        return importedData || defaultData;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────

    return {
        setImportedData: function (data) {
            importedData = data;
            console.log('📊 DataService: Imported CSV data set');
        },

        setXLSXData: function (data) {
            // Ensure all date fields are actual Date objects (not ISO strings from localStorage)
            if (data) {
                const ensureDate = (d) => (d instanceof Date) ? d : new Date(d);
                if (data.posts) {
                    data.posts.forEach(p => { if (p.date) p.date = ensureDate(p.date); });
                }
                if (data.growth) {
                    data.growth.forEach(g => { if (g.date) g.date = ensureDate(g.date); });
                }
                if (data.audience) {
                    data.audience.forEach(a => { if (a.date) a.date = ensureDate(a.date); });
                }
            }
            xlsxData = data;
            console.log('📊 DataService: Imported XLSX data set (Mariana Protocol)');
        },

        getXLSXData: function () {
            return xlsxData;
        },

        hasXLSXData: function () {
            return xlsxData !== null && (xlsxData.posts || xlsxData.growth || xlsxData.audience);
        },

        clearImportedData: function () {
            importedData = null;
            xlsxData = null;
        },

        hasImportedData: function () {
            return importedData !== null || xlsxData !== null;
        },

        getDashboardData: function (filters) {
            return { ...getData(), filters };
        },

        getKPIs: function () {
            const data = getData();
            return { values: data.current, deltas: data.deltas };
        },

        getTimeSeries: function (metric, period) {
            // Check XLSX posts data first for clicks metrics
            if (xlsxData && xlsxData.posts && xlsxData.posts.length > 0) {
                const posts = filterByDateRange(xlsxData.posts);
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

                const buckets = {};

                posts.forEach(post => {
                    const date = post.date;
                    let key, label;

                    if (period === 'weekly') {
                        key = weekKey(date);
                        label = weekLabel(key);
                    } else {
                        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                        label = months[date.getMonth()];
                    }

                    if (!buckets[key]) {
                        buckets[key] = { label, sum: 0, count: 0 };
                    }

                    // Map metric names to post fields
                    const metricMap = {
                        'verifiedClicks': 'verifiedClicks',
                        'uniqueClicks': 'uniqueClicks'
                    };
                    const field = metricMap[metric] || metric;
                    const val = post[field];
                    if (val !== undefined && !isNaN(val)) {
                        buckets[key].sum += val;
                        buckets[key].count++;
                    }
                });

                const sorted = Object.keys(buckets).sort();
                return {
                    labels: sorted.map(k => buckets[k].label),
                    data: sorted.map(k => buckets[k].sum)
                };
            }

            // Fallback to CSV/mock data
            const data = getData();
            const series = data.timeSeries?.[metric];
            if (!series) {
                console.warn(`No time series data for metric: ${metric}`);
                return { labels: [], data: [] };
            }
            return { labels: data.timeSeries.labels, data: series };
        },

        getSparkline: function (metric, period) {
            // Special case: activeSubscribers uses audience data
            if (metric === 'activeSubscribers' && xlsxData && xlsxData.audience && xlsxData.audience.length > 0) {
                const audience = xlsxData.audience.slice().sort((a, b) => a.date - b.date);

                if (period === 'weekly') {
                    // Aggregate audience by week (take last reading per week)
                    const weekBuckets = {};
                    audience.forEach(a => {
                        const wk = weekKey(a.date);
                        weekBuckets[wk] = a.activeSubscribers;
                    });
                    const sorted = Object.keys(weekBuckets).sort();
                    const values = sorted.map(k => weekBuckets[k]).filter(v => v !== undefined && !isNaN(v));
                    return values.slice(-Math.min(16, values.length));
                }

                const values = audience.map(a => a.activeSubscribers).filter(v => v !== undefined && !isNaN(v));
                return values.slice(-Math.min(12, values.length));
            }

            // Generate sparklines from XLSX posts data
            if (xlsxData && xlsxData.posts && xlsxData.posts.length > 0) {
                const posts = filterByDateRange(xlsxData.posts).slice().sort((a, b) => a.date - b.date);

                // Map sparkline metric names to post fields
                const metricMap = {
                    'openRate': 'openRate',
                    'open-rate': 'openRate',
                    'ctr': 'ctr',
                    'verified-ctr': 'verifiedCtr',
                    'verifiedCtr': 'verifiedCtr',
                    'delivery-rate': 'deliveryRate',
                    'deliveryRate': 'deliveryRate',
                    'unique-clicks': 'uniqueClicks',
                    'uniqueClicks': 'uniqueClicks',
                    'verified-clicks': 'verifiedClicks',
                    'verifiedClicks': 'verifiedClicks'
                };

                const field = metricMap[metric] || metric;

                if (period === 'weekly') {
                    // Aggregate per-post data by ISO week
                    const isRate = ['openRate', 'ctr', 'verifiedCtr', 'deliveryRate'].includes(field);
                    const weekBuckets = {};
                    posts.forEach(p => {
                        const wk = weekKey(p.date);
                        const val = p[field];
                        if (val !== undefined && !isNaN(val)) {
                            if (!weekBuckets[wk]) weekBuckets[wk] = { sum: 0, count: 0 };
                            weekBuckets[wk].sum += val;
                            weekBuckets[wk].count++;
                        }
                    });
                    const sorted = Object.keys(weekBuckets).sort();
                    const values = sorted.map(k => isRate
                        ? weekBuckets[k].sum / weekBuckets[k].count
                        : weekBuckets[k].sum
                    );
                    return values.slice(-Math.min(16, values.length));
                }

                const values = posts.map(p => p[field]).filter(v => v !== undefined && !isNaN(v));

                // Return last 6-12 data points for sparkline
                return values.slice(-Math.min(12, values.length));
            }

            const data = getData();
            return data.sparklines?.[metric] || [];
        },

        getGrowthData: function (period) {
            // Prefer XLSX growth data if available
            if (xlsxData && xlsxData.growth && xlsxData.growth.length > 0) {
                const growthRows = filterByDateRangeMonthly(xlsxData.growth);
                if (period === 'weekly' && growthRows.length > 1 && growthRows[0]?.date) {
                    // Check if data has enough granularity for weekly view.
                    // If data is monthly (one record per month), weekly bucketing
                    // just relabels the same bars — fall through to monthly view.
                    const ensureD = d => (d instanceof Date) ? d : new Date(d);
                    const first = ensureD(growthRows[0].date);
                    const last = ensureD(growthRows[growthRows.length - 1].date);
                    const spanDays = (last - first) / (1000 * 60 * 60 * 24);
                    const hasWeeklyGranularity = growthRows.length > (spanDays / 20);

                    if (hasWeeklyGranularity) {
                        // Aggregate growth rows by ISO week
                        const weekBuckets = {};
                        growthRows.forEach(g => {
                            const wk = weekKey(g.date);
                            if (!weekBuckets[wk]) weekBuckets[wk] = { label: weekLabel(wk), subscribed: 0, unsubscribed: 0, net: 0 };
                            weekBuckets[wk].subscribed += (g.subscribed || 0);
                            weekBuckets[wk].unsubscribed += Math.abs(g.unsubscribed || 0);
                            weekBuckets[wk].net += (g.net || 0);
                        });
                        const sorted = Object.keys(weekBuckets).sort();
                        return {
                            labels: sorted.map(k => weekBuckets[k].label),
                            subscribed: sorted.map(k => weekBuckets[k].subscribed),
                            unsubscribed: sorted.map(k => weekBuckets[k].unsubscribed),
                            netGrowth: sorted.map(k => weekBuckets[k].net)
                        };
                    }
                    // Fall through to monthly labels if data lacks weekly granularity
                }
                return {
                    labels: growthRows.map(g => g.month),
                    subscribed: growthRows.map(g => g.subscribed),
                    unsubscribed: growthRows.map(g => Math.abs(g.unsubscribed)),
                    netGrowth: growthRows.map(g => g.net)
                };
            }

            const data = getData();
            return {
                labels: data.timeSeries?.labels || [],
                subscribed: data.timeSeries?.subscribed || [],
                unsubscribed: data.timeSeries?.unsubscribed || [],
                netGrowth: data.timeSeries?.netGrowth || []
            };
        },

        getAudienceData: function (period) {
            // Prefer XLSX audience data if available
            if (xlsxData && xlsxData.audience && xlsxData.audience.length > 0) {
                const audienceRows = filterByDateRangeMonthly(xlsxData.audience);
                if (period === 'weekly') {
                    // Take last-reading-per-week for audience
                    const weekBuckets = {};
                    const sorted = audienceRows.slice().sort((a, b) => a.date - b.date);
                    sorted.forEach(a => {
                        const wk = weekKey(a.date);
                        weekBuckets[wk] = a.activeSubscribers; // last value wins
                    });
                    const weeks = Object.keys(weekBuckets).sort();
                    return {
                        labels: weeks.map(k => weekLabel(k)),
                        activeSubscribers: weeks.map(k => weekBuckets[k])
                    };
                }
                return {
                    labels: audienceRows.map(a => {
                        const d = a.date;
                        return `${d.getMonth() + 1}/${d.getDate()}`;
                    }),
                    activeSubscribers: audienceRows.map(a => a.activeSubscribers)
                };
            }

            const data = getData();
            return {
                labels: data.timeSeries?.labels || [],
                activeSubscribers: data.timeSeries?.activeSubscribers || []
            };
        },

        getAnnotations: function () {
            const data = getData();
            return data.annotations || [];
        },

        getNewsletterInfo: function () {
            const data = getData();
            return data.newsletter || mockData.newsletter;
        },

        setDateRange: function (startDate, endDate) {
            dateRangeFilter = { startDate, endDate };
        },

        clearDateRange: function () {
            dateRangeFilter = null;
        }
    };
})();

window.DataService = DataService;

