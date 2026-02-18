/* ════════════════════════════════════════════════════════════════════════════
   INSIGHT ENGINE — Newsletter Analytics Dashboard
   Generates auto-insights from CSV data: baselines, rankings, trends, anomalies
   ════════════════════════════════════════════════════════════════════════════ */

const InsightEngine = (function () {
    'use strict';

    // ─────────────────────────────────────────────────────────────────────────
    // BASELINE CALCULATIONS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Calculate rolling baselines for key metrics
     * @param {Array} rows - Sorted array of data rows (oldest to newest)
     * @param {number} days - Number of days for baseline (7, 30, 90)
     * @returns {Object} Baseline metrics
     */
    function calculateBaselines(rows, days = 30) {
        if (!rows || rows.length === 0) return null;

        // Filter to last N days
        const now = new Date();
        const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const recentRows = rows.filter(r => r.date >= cutoff);

        if (recentRows.length === 0) return null;

        return {
            openRate: average(recentRows.map(r => r.openRate).filter(Boolean)),
            ctr: average(recentRows.map(r => r.ctr).filter(Boolean)),
            verifiedCtr: average(recentRows.map(r => r.verifiedCtr).filter(Boolean)),
            deliveryRate: average(recentRows.map(r => r.deliveryRate).filter(Boolean)),
            uniqueClicks: average(recentRows.map(r => r.uniqueClicks).filter(Boolean)),
            delivered: average(recentRows.map(r => r.delivered).filter(Boolean)),
            period: days,
            dataPoints: recentRows.length
        };
    }

    /**
     * Calculate all baseline periods
     */
    function calculateAllBaselines(rows) {
        return {
            '7d': calculateBaselines(rows, 7),
            '30d': calculateBaselines(rows, 30),
            '90d': calculateBaselines(rows, 90)
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EDITION RANKING
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Rank editions by a specific metric
     * @param {Array} rows - Data rows
     * @param {string} metric - Metric to rank by (ctr, openRate, etc.)
     * @param {string} order - 'desc' (highest first) or 'asc'
     * @returns {Array} Ranked rows with rank property
     */
    function rankEditions(rows, metric = 'ctr', order = 'desc') {
        if (!rows || rows.length === 0) return [];

        const sorted = [...rows]
            .filter(r => r[metric] !== undefined && r[metric] !== null)
            .sort((a, b) => order === 'desc' ? b[metric] - a[metric] : a[metric] - b[metric]);

        return sorted.map((row, index) => ({
            ...row,
            rank: index + 1,
            rankMetric: metric
        }));
    }

    /**
     * Get top and bottom performers
     */
    function getPerformanceExtremes(rows, metric = 'ctr', count = 3) {
        const ranked = rankEditions(rows, metric, 'desc');
        return {
            top: ranked.slice(0, count),
            bottom: ranked.slice(-count).reverse()
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TREND ANALYSIS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Calculate trend direction using simple linear regression
     * @param {Array} values - Array of numeric values (time-ordered)
     * @returns {Object} { slope, direction, strength }
     */
    function calculateTrend(values) {
        if (!values || values.length < 2) {
            return { slope: 0, direction: 'neutral', strength: 'none' };
        }

        const n = values.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += values[i];
            sumXY += i * values[i];
            sumX2 += i * i;
        }

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const avgValue = sumY / n;
        const normalizedSlope = avgValue !== 0 ? (slope / avgValue) * 100 : 0;

        let direction = 'neutral';
        if (normalizedSlope > 1) direction = 'up';
        else if (normalizedSlope < -1) direction = 'down';

        let strength = 'weak';
        if (Math.abs(normalizedSlope) > 5) strength = 'strong';
        else if (Math.abs(normalizedSlope) > 2) strength = 'moderate';

        return { slope: normalizedSlope, direction, strength };
    }

    /**
     * Detect trend acceleration (is recent trend steeper than historical?)
     */
    function detectAcceleration(rows, metric = 'ctr') {
        if (!rows || rows.length < 14) return null;

        const values = rows.map(r => r[metric]).filter(Boolean);
        const recentValues = values.slice(-7);
        const historicalValues = values.slice(-30, -7);

        const recentTrend = calculateTrend(recentValues);
        const historicalTrend = calculateTrend(historicalValues);

        const acceleration = recentTrend.slope - historicalTrend.slope;

        return {
            recent: recentTrend,
            historical: historicalTrend,
            acceleration,
            status: acceleration > 1 ? 'accelerating' : acceleration < -1 ? 'decelerating' : 'steady'
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ANOMALY DETECTION
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Detect anomalies using standard deviation
     * @param {Array} rows - Data rows
     * @param {string} metric - Metric to analyze
     * @param {number} threshold - Standard deviations from mean (default 1.5)
     * @returns {Array} Rows with anomaly flags
     */
    function detectAnomalies(rows, metric = 'ctr', threshold = 1.5) {
        if (!rows || rows.length < 5) return rows;

        const values = rows.map(r => r[metric]).filter(v => v !== undefined && v !== null);
        const mean = average(values);
        const stdDev = standardDeviation(values);

        return rows.map(row => {
            const value = row[metric];
            if (value === undefined || value === null) return row;

            const zScore = (value - mean) / stdDev;
            const isAnomaly = Math.abs(zScore) > threshold;

            return {
                ...row,
                anomalies: {
                    ...row.anomalies,
                    [metric]: isAnomaly ? {
                        type: zScore > 0 ? 'high' : 'low',
                        zScore,
                        deviation: ((value - mean) / mean * 100).toFixed(1)
                    } : null
                }
            };
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INSIGHT GENERATION
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Generate the primary insight for the insight bar
     * @param {Array} rows - Data rows
     * @param {Object} baselines - Baseline calculations
     * @returns {Object} { text, type, icon }
     */
    function generatePrimaryInsight(rows, baselines) {
        if (!rows || rows.length === 0) {
            return {
                text: 'Import data to see insights',
                type: 'neutral',
                icon: '📊'
            };
        }

        const insights = [];
        const baseline30d = baselines?.['30d'];
        const latest = rows[rows.length - 1];

        // Check latest edition vs baseline
        if (latest && baseline30d) {
            // Only compare if we have valid data
            if (isValid(latest.ctr) && isValid(baseline30d.ctr) && baseline30d.ctr > 0) {
                const ctrDiff = ((latest.ctr - baseline30d.ctr) / baseline30d.ctr * 100);

                if (Math.abs(ctrDiff) > 15) {
                    insights.push({
                        text: ctrDiff > 0
                            ? `Latest edition CTR is ${Math.abs(ctrDiff).toFixed(0)}% above your 30-day average`
                            : `Latest edition CTR is ${Math.abs(ctrDiff).toFixed(0)}% below your 30-day average`,
                        type: ctrDiff > 0 ? 'positive' : 'warning',
                        icon: ctrDiff > 0 ? '📈' : '📉',
                        priority: Math.abs(ctrDiff)
                    });
                }
            }

            if (isValid(latest.openRate) && isValid(baseline30d.openRate) && baseline30d.openRate > 0) {
                const openDiff = ((latest.openRate - baseline30d.openRate) / baseline30d.openRate * 100);

                if (Math.abs(openDiff) > 10) {
                    insights.push({
                        text: openDiff > 0
                            ? `Open rate trending ${Math.abs(openDiff).toFixed(0)}% higher than usual`
                            : `Open rate is ${Math.abs(openDiff).toFixed(0)}% lower than your baseline`,
                        type: openDiff > 0 ? 'positive' : 'warning',
                        icon: openDiff > 0 ? '✨' : '⚠️',
                        priority: Math.abs(openDiff)
                    });
                }
            }
        }

        // Check trend (only if we have enough data)
        const ctrValues = rows.slice(-7).map(r => r.ctr).filter(isValid);
        if (ctrValues.length >= 2) {
            const ctrTrend = calculateTrend(ctrValues);
            if (ctrTrend.strength === 'strong') {
                insights.push({
                    text: ctrTrend.direction === 'up'
                        ? 'CTR is trending strongly upward over the past week'
                        : 'CTR has been declining over the past week',
                    type: ctrTrend.direction === 'up' ? 'positive' : 'warning',
                    icon: ctrTrend.direction === 'up' ? '🚀' : '📉',
                    priority: 20
                });
            }
        }

        // Find best performer
        const extremes = getPerformanceExtremes(rows.slice(-30), 'ctr', 1);
        if (extremes.top.length > 0 && rows.length >= 5) {
            const best = extremes.top[0];
            // Verify best.ctr is a number before using it
            if (isValid(best.ctr)) {
                insights.push({
                    text: `"${truncate(best.title, 40)}" had the best CTR this month at ${Number(best.ctr).toFixed(1)}%`,
                    type: 'info',
                    icon: '🏆',
                    priority: 10
                });
            }
        }

        // Sort by priority and return top insight
        insights.sort((a, b) => (b.priority || 0) - (a.priority || 0));

        return insights.length > 0 ? insights[0] : {
            text: `Analyzing ${rows.length} editions with ${baseline30d?.dataPoints || 0} in the last 30 days`,
            type: 'neutral',
            icon: '📊'
        };
    }

    /**
     * Generate comparison metrics for period-over-period
     */
    function generateComparison(rows, period = '30d') {
        const days = parseInt(period) || 30;
        const now = new Date();
        const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const previousCutoff = new Date(cutoff.getTime() - days * 24 * 60 * 60 * 1000);

        const currentPeriod = rows.filter(r => r.date >= cutoff);
        const previousPeriod = rows.filter(r => r.date >= previousCutoff && r.date < cutoff);

        const current = {
            openRate: average(currentPeriod.map(r => r.openRate).filter(Boolean)),
            ctr: average(currentPeriod.map(r => r.ctr).filter(Boolean)),
            verifiedCtr: average(currentPeriod.map(r => r.verifiedCtr).filter(Boolean)),
            delivered: sum(currentPeriod.map(r => r.delivered).filter(Boolean)),
            editions: currentPeriod.length
        };

        const previous = {
            openRate: average(previousPeriod.map(r => r.openRate).filter(Boolean)),
            ctr: average(previousPeriod.map(r => r.ctr).filter(Boolean)),
            verifiedCtr: average(previousPeriod.map(r => r.verifiedCtr).filter(Boolean)),
            delivered: sum(previousPeriod.map(r => r.delivered).filter(Boolean)),
            editions: previousPeriod.length
        };

        const delta = (curr, prev) => prev ? ((curr - prev) / prev * 100) : 0;

        return {
            current,
            previous,
            deltas: {
                openRate: delta(current.openRate, previous.openRate),
                ctr: delta(current.ctr, previous.ctr),
                verifiedCtr: delta(current.verifiedCtr, previous.verifiedCtr),
                delivered: delta(current.delivered, previous.delivered)
            },
            period
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UTILITY FUNCTIONS
    // ─────────────────────────────────────────────────────────────────────────

    function isValid(n) {
        return typeof n === 'number' && !isNaN(n);
    }

    function average(arr) {
        if (!arr || arr.length === 0) return 0;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    function sum(arr) {
        if (!arr || arr.length === 0) return 0;
        return arr.reduce((a, b) => a + b, 0);
    }

    function standardDeviation(arr) {
        if (!arr || arr.length < 2) return 0;
        const mean = average(arr);
        const squareDiffs = arr.map(value => Math.pow(value - mean, 2));
        return Math.sqrt(average(squareDiffs));
    }

    function truncate(str, maxLength = 50) {
        if (!str) return '';
        return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────

    return {
        calculateBaselines,
        calculateAllBaselines,
        rankEditions,
        getPerformanceExtremes,
        calculateTrend,
        detectAcceleration,
        detectAnomalies,
        generatePrimaryInsight,
        generateComparison
    };

})();

window.InsightEngine = InsightEngine;
