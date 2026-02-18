/* ════════════════════════════════════════════════════════════════════════════
   CSV PARSER — Newsletter Analytics Dashboard
   Parse and transform Beehiiv CSV exports
   ════════════════════════════════════════════════════════════════════════════ */

const CSVParser = (function () {
    'use strict';

    // ─────────────────────────────────────────────────────────────────────────
    // COLUMN MAPPING (Beehiiv export format)
    // ─────────────────────────────────────────────────────────────────────────

    const COLUMN_MAP = {
        'Date': 'date',
        'Subject or Title': 'title',
        'Sent': 'sent',
        'Delivered': 'delivered',
        'Total Opens': 'totalOpens',
        'Unique Opens': 'uniqueOpens',
        'Open Rate': 'openRate',
        'Unique Clicks': 'uniqueClicks',
        'Click-Through Rate': 'ctr',
        'Verified Unique Clicks': 'verifiedClicks',
        'Verified Click-Through Rate': 'verifiedCtr',
        'Unsubscribed': 'unsubscribed',
        'Unsubscribe Rate': 'unsubscribeRate',
        'Spam Reported': 'spamReported',
        'Spam Reported Rate': 'spamRate',
        'Web Views': 'webViews',
        'Web Clicks Unique': 'webClicks',
        'Web Click Rate': 'webClickRate',
        'Post ID': 'postId',
        'Content Tags': 'tags',
        'Delivery Rate': 'deliveryRate'
    };

    const REQUIRED_COLUMNS = ['Date'];

    // ─────────────────────────────────────────────────────────────────────────
    // PARSING FUNCTIONS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Parse CSV string into array of objects
     * @param {string} csvText - Raw CSV content
     * @returns {Object} { headers, rows, errors }
     */
    function parse(csvText) {
        const lines = csvText.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) {
            return { headers: [], rows: [], errors: ['CSV file is empty or has no data rows'] };
        }

        const headers = parseCSVLine(lines[0]);
        const errors = validateHeaders(headers);

        if (errors.length > 0) {
            return { headers, rows: [], errors };
        }

        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            try {
                const values = parseCSVLine(lines[i]);
                const row = mapRowToObject(headers, values);
                if (row) rows.push(row);
            } catch (e) {
                errors.push(`Error parsing row ${i + 1}: ${e.message}`);
            }
        }

        return { headers, rows, errors };
    }

    /**
     * Parse a single CSV line, handling quoted fields
     */
    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());

        return result;
    }

    /**
     * Validate required columns exist
     */
    function validateHeaders(headers) {
        const errors = [];
        const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

        REQUIRED_COLUMNS.forEach(col => {
            const normalized = col.toLowerCase();
            if (!normalizedHeaders.some(h => h.includes(normalized) || normalized.includes(h))) {
                errors.push(`Missing required column: "${col}"`);
            }
        });

        return errors;
    }

    /**
     * Map CSV row values to normalized object
     */
    function mapRowToObject(headers, values) {
        const obj = {};

        // Percentage columns (by original header name)
        const percentageColumns = [
            'Open Rate', 'Click-Through Rate', 'Verified Click-Through Rate',
            'Unsubscribe Rate', 'Spam Reported Rate', 'Web Click Rate', 'Delivery Rate'
        ];

        // Number columns (by mapped key)
        const numberKeys = ['sent', 'delivered', 'uniqueOpens', 'uniqueClicks',
            'verifiedClicks', 'unsubscribed', 'totalOpens', 'webViews', 'webClicks', 'spamReported'];

        headers.forEach((header, index) => {
            const key = COLUMN_MAP[header] || header.toLowerCase().replace(/\s+/g, '_');
            let value = values[index] || '';

            // Parse different value types
            if (key === 'date') {
                value = parseDate(value);
            } else if (percentageColumns.includes(header)) {
                value = parsePercentage(value);
            } else if (numberKeys.includes(key)) {
                value = parseNumber(value);
            }

            obj[key] = value;
        });

        // Skip rows with no valid date
        if (!obj.date) return null;

        return obj;
    }

    /**
     * Parse date string like "May 28, 2025"
     */
    function parseDate(str) {
        if (!str) return null;
        const date = new Date(str);
        return isNaN(date.getTime()) ? null : date;
    }

    /**
     * Parse percentage string like "68.2%" to number
     */
    function parsePercentage(str) {
        if (!str || str === '#DIV/0!' || str === '') return null;
        const num = parseFloat(str.replace('%', '').replace(',', ''));
        return isNaN(num) ? null : num;
    }

    /**
     * Parse number string with commas like "1,234"
     */
    function parseNumber(str) {
        if (!str || str === '') return null;
        const num = parseInt(str.replace(/,/g, ''), 10);
        return isNaN(num) ? null : num;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AGGREGATION FUNCTIONS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Aggregate rows by time period
     * @param {Array} rows - Parsed data rows
     * @param {string} period - 'daily', 'weekly', 'monthly'
     * @returns {Array} Aggregated data
     */
    function aggregateByPeriod(rows, period = 'monthly') {
        const groups = {};

        rows.forEach(row => {
            if (!row.date) return;

            const key = getPeriodKey(row.date, period);
            if (!groups[key]) {
                groups[key] = {
                    label: key,
                    date: row.date,
                    posts: 0,
                    sent: 0,
                    delivered: 0,
                    uniqueOpens: 0,
                    uniqueClicks: 0,
                    verifiedClicks: 0,
                    unsubscribed: 0,
                    openRates: [],
                    ctrs: [],
                    verifiedCtrs: [],
                    deliveryRates: []
                };
            }

            const g = groups[key];
            g.posts++;
            g.sent += row.sent || 0;
            g.delivered += row.delivered || 0;
            g.uniqueOpens += row.uniqueOpens || 0;
            g.uniqueClicks += row.uniqueClicks || 0;
            g.verifiedClicks += row.verifiedClicks || 0;
            g.unsubscribed += row.unsubscribed || 0;

            if (row.openRate) g.openRates.push(row.openRate);
            if (row.ctr) g.ctrs.push(row.ctr);
            if (row.verifiedCtr) g.verifiedCtrs.push(row.verifiedCtr);
            if (row.deliveryRate) g.deliveryRates.push(row.deliveryRate);
        });

        // Calculate averages
        return Object.values(groups).map(g => ({
            ...g,
            openRate: average(g.openRates),
            ctr: average(g.ctrs),
            verifiedCtr: average(g.verifiedCtrs),
            deliveryRate: average(g.deliveryRates)
        })).sort((a, b) => a.date - b.date);
    }

    function getPeriodKey(date, period) {
        const d = new Date(date);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        switch (period) {
            case 'daily':
                return `${months[d.getMonth()]} ${d.getDate()}`;
            case 'weekly':
                const weekStart = new Date(d);
                weekStart.setDate(d.getDate() - d.getDay());
                return `${months[weekStart.getMonth()]} ${weekStart.getDate()}`;
            case 'monthly':
            default:
                return months[d.getMonth()];
        }
    }

    function average(arr) {
        if (!arr || arr.length === 0) return null;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DATA TRANSFORMATION
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Transform parsed CSV data to dashboard format
     * @param {Array} rows - Parsed CSV rows
     * @param {Object} options - { dateRange, period }
     * @returns {Object} Dashboard-ready data
     */
    function transformToDashboardData(rows, options = {}) {
        const { startDate, endDate, period = 'monthly' } = options;

        // Filter by date range
        let filtered = rows;
        if (startDate) {
            filtered = filtered.filter(r => r.date >= startDate);
        }
        if (endDate) {
            filtered = filtered.filter(r => r.date <= endDate);
        }

        // Sort by date
        filtered.sort((a, b) => a.date - b.date);

        // Aggregate
        const aggregated = aggregateByPeriod(filtered, period);

        // Calculate current KPIs (latest data or period average)
        const current = calculateCurrentKPIs(filtered);
        const deltas = calculateDeltas(filtered);
        const timeSeries = buildTimeSeries(aggregated);
        const sparklines = buildSparklines(aggregated);

        return {
            current,
            deltas,
            timeSeries,
            sparklines,
            rawRows: filtered,
            aggregated,
            lastUpdated: new Date()
        };
    }

    function calculateCurrentKPIs(rows) {
        if (rows.length === 0) return {};

        // Use most recent data for snapshot metrics
        const latest = rows[rows.length - 1];

        // Calculate period totals and averages
        const totalDelivered = rows.reduce((sum, r) => sum + (r.delivered || 0), 0);
        const totalClicks = rows.reduce((sum, r) => sum + (r.uniqueClicks || 0), 0);
        const totalVerifiedClicks = rows.reduce((sum, r) => sum + (r.verifiedClicks || 0), 0);
        const avgOpenRate = average(rows.map(r => r.openRate).filter(v => v != null));
        const avgCtr = average(rows.map(r => r.ctr).filter(v => v != null));
        const avgVerifiedCtr = average(rows.map(r => r.verifiedCtr).filter(v => v != null));
        const avgDeliveryRate = average(rows.map(r => r.deliveryRate).filter(v => v != null));

        return {
            activeSubscribers: latest.delivered || totalDelivered / rows.length,
            openRate: avgOpenRate,
            ctr: avgCtr,
            verifiedCtr: avgVerifiedCtr,
            deliveryRate: avgDeliveryRate,
            uniqueClicks: totalClicks,
            verifiedClicks: totalVerifiedClicks
        };
    }

    function calculateDeltas(rows) {
        // Split into two halves for comparison
        const midpoint = Math.floor(rows.length / 2);
        const firstHalf = rows.slice(0, midpoint);
        const secondHalf = rows.slice(midpoint);

        const first = calculateCurrentKPIs(firstHalf);
        const second = calculateCurrentKPIs(secondHalf);

        function delta(key, isAbsolute = false) {
            const diff = (second[key] || 0) - (first[key] || 0);
            return {
                value: isAbsolute ? diff : (first[key] ? (diff / first[key] * 100) : 0),
                direction: diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral',
                isAbsolute
            };
        }

        return {
            activeSubscribers: delta('activeSubscribers'),
            openRate: delta('openRate'),
            ctr: delta('ctr'),
            verifiedCtr: delta('verifiedCtr'),
            deliveryRate: delta('deliveryRate'),
            uniqueClicks: delta('uniqueClicks', true),
            verifiedClicks: delta('verifiedClicks', true)
        };
    }

    function buildTimeSeries(aggregated) {
        return {
            labels: aggregated.map(a => a.label),
            verifiedClicks: aggregated.map(a => a.verifiedClicks),
            uniqueClicks: aggregated.map(a => a.uniqueClicks),
            unsubscribed: aggregated.map(a => a.unsubscribed),
            // For subscriber growth we need external data, use placeholder
            subscribed: aggregated.map(() => 0),
            netGrowth: aggregated.map(a => -a.unsubscribed),
            activeSubscribers: aggregated.map(a => a.delivered)
        };
    }

    function buildSparklines(aggregated) {
        // Take last 6 periods for sparklines
        const recent = aggregated.slice(-6);

        return {
            openRate: recent.map(a => a.openRate),
            ctr: recent.map(a => a.ctr),
            verifiedCtr: recent.map(a => a.verifiedCtr),
            deliveryRate: recent.map(a => a.deliveryRate),
            uniqueClicks: recent.map(a => a.uniqueClicks),
            verifiedClicks: recent.map(a => a.verifiedClicks),
            activeSubscribers: recent.map(a => a.delivered)
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FILE READING
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Read file and parse CSV
     * @param {File} file - File object from input
     * @returns {Promise<Object>} Parsed data
     */
    function readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const text = e.target.result;
                const parsed = parse(text);

                if (parsed.errors.length > 0 && parsed.rows.length === 0) {
                    reject(new Error(parsed.errors.join('\n')));
                } else {
                    resolve(parsed);
                }
            };

            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────

    return {
        parse,
        readFile,
        aggregateByPeriod,
        transformToDashboardData,
        REQUIRED_COLUMNS
    };
})();

window.CSVParser = CSVParser;
