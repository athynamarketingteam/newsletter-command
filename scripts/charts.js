/* ════════════════════════════════════════════════════════════════════════════
   CHARTS MODULE — Newsletter Analytics Dashboard
   Chart.js configurations and rendering
   ════════════════════════════════════════════════════════════════════════════ */

const Charts = (function () {
    'use strict';

    // ─────────────────────────────────────────────────────────────────────────
    // THEME-AWARE COLOR HELPER
    // ─────────────────────────────────────────────────────────────────────────

    function getThemeColor(varName, fallback) {
        const val = getComputedStyle(document.documentElement)
            .getPropertyValue(varName).trim();
        return val || fallback;
    }

    function isLightTheme() {
        return document.documentElement.getAttribute('data-theme') === 'light';
    }

    /**
     * Get posts filtered by the current AppState.dateRange (30d / 90d).
     * Mirrors the getFilteredPosts logic from main.js so engagement charts
     * respect the date toggle.
     */
    function getDateFilteredPosts() {
        if (!window.AppState || !window.AppState.xlsxData || !window.AppState.xlsxData.posts) return [];
        const posts = window.AppState.xlsxData.posts;
        const range = (window.AppState && window.AppState.dateRange) || '90d';

        const now = new Date();
        let start = new Date();
        switch (range) {
            case '30d': start.setDate(now.getDate() - 30); break;
            case '90d': start.setDate(now.getDate() - 90); break;
            default: return posts; // no filter
        }

        return posts.filter(p => {
            if (!p.date) return false;
            const d = (p.date instanceof Date) ? p.date : new Date(p.date);
            return d >= start && d <= now;
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHART.JS GLOBAL DEFAULTS
    // ─────────────────────────────────────────────────────────────────────────

    function setGlobalDefaults() {
        const light = isLightTheme();
        Chart.defaults.color = light ? 'rgba(28, 30, 27, 0.48)' : 'rgba(255, 255, 255, 0.5)';
        Chart.defaults.borderColor = light ? 'rgba(28, 30, 27, 0.06)' : 'rgba(255, 255, 255, 0.08)';
        Chart.defaults.font.family = "'Inter', -apple-system, sans-serif";
        Chart.defaults.font.size = 12;
        Chart.defaults.plugins.legend.display = false;
        Chart.defaults.plugins.tooltip.backgroundColor = light ? 'rgba(255, 255, 255, 0.96)' : 'rgba(122, 27, 92, 0.95)';
        Chart.defaults.plugins.tooltip.titleColor = light ? '#1C1E1B' : '#FFFFFF';
        Chart.defaults.plugins.tooltip.bodyColor = light ? '#1C1E1B' : '#FFFFFF';
        Chart.defaults.plugins.tooltip.borderColor = light ? 'rgba(110, 53, 203, 0.18)' : 'rgba(194, 238, 107, 0.3)';
        Chart.defaults.plugins.tooltip.borderWidth = 1;
        Chart.defaults.plugins.tooltip.cornerRadius = 8;
        Chart.defaults.plugins.tooltip.padding = 12;
        Chart.defaults.plugins.tooltip.titleFont = { weight: '600' };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHART INSTANCES (for cleanup/updates)
    // ─────────────────────────────────────────────────────────────────────────

    let performanceChart = null;
    let growthChart = null;
    let audienceChart = null;
    let engagementDonut = null;
    let clicksBarChart = null;
    let currentPeriod = 'monthly';

    // ─────────────────────────────────────────────────────────────────────────
    // PERFORMANCE BAR CHART
    // Verified Unique Clicks over time
    // ─────────────────────────────────────────────────────────────────────────

    function renderPerformanceChart() {
        const canvas = document.getElementById('performance-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const data = DataService.getTimeSeries('verifiedClicks', currentPeriod);

        // Destroy existing chart if present
        if (performanceChart) {
            performanceChart.destroy();
        }

        // Create gradient (theme-aware)
        const primaryColor = getThemeColor('--color-chart-primary', '#C2EE6B');
        const gradient = ctx.createLinearGradient(0, 0, 0, 280);
        gradient.addColorStop(0, primaryColor);
        gradient.addColorStop(0.7, primaryColor + 'B3');
        gradient.addColorStop(1, primaryColor + '66');

        const light = isLightTheme();
        const axisColor = light ? 'rgba(28, 30, 27, 0.48)' : 'rgba(255, 255, 255, 0.5)';
        const gridColor = light ? 'rgba(28, 30, 27, 0.06)' : 'rgba(255, 255, 255, 0.08)';

        performanceChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.data,
                    backgroundColor: gradient,
                    borderRadius: 6,
                    borderSkipped: false,
                    barThickness: 'flex',
                    maxBarThickness: 48
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: (items) => items[0].label,
                            label: (item) => `Verified Clicks: ${item.raw.toLocaleString()}`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: axisColor
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: gridColor
                        },
                        ticks: {
                            color: axisColor,
                            callback: (value) => value >= 1000 ? (value / 1000) + 'k' : value
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GROWTH STACKED CHART
    // Subscribed vs Unsubscribed with Net Growth line
    // ─────────────────────────────────────────────────────────────────────────

    function renderGrowthChart() {
        const canvas = document.getElementById('growth-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const data = DataService.getGrowthData(currentPeriod);

        // Destroy existing chart if present
        if (growthChart) {
            growthChart.destroy();
        }

        // Negative values for unsubscribed (for diverging effect)
        const unsubscribedNegative = data.unsubscribed.map(v => -v);

        const light = isLightTheme();
        const axisColor = light ? 'rgba(28, 30, 27, 0.48)' : 'rgba(255, 255, 255, 0.5)';
        const gridColor = light ? 'rgba(28, 30, 27, 0.06)' : 'rgba(255, 255, 255, 0.08)';

        growthChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: 'Subscribed',
                        data: data.subscribed,
                        backgroundColor: getThemeColor('--color-chart-primary', '#C2EE6B'),
                        borderRadius: { topLeft: 6, topRight: 6 },
                        borderSkipped: false,
                        barThickness: 'flex',
                        maxBarThickness: 32,
                        stack: 'stack1'
                    },
                    {
                        label: 'Unsubscribed',
                        data: unsubscribedNegative,
                        backgroundColor: 'rgba(255, 107, 107, 0.7)',
                        borderRadius: { bottomLeft: 6, bottomRight: 6 },
                        borderSkipped: false,
                        barThickness: 'flex',
                        maxBarThickness: 32,
                        stack: 'stack1'
                    },
                    {
                        label: 'Net Growth',
                        data: data.netGrowth,
                        type: 'line',
                        borderColor: light ? 'rgba(28, 30, 27, 0.4)' : 'rgba(255, 255, 255, 0.6)',
                        borderDash: [6, 4],
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        pointHoverBackgroundColor: light ? '#1C1E1B' : '#fff',
                        tension: 0.3,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (item) => {
                                const value = Math.abs(item.raw);
                                return `${item.dataset.label}: ${value.toLocaleString()}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: axisColor
                        }
                    },
                    y: {
                        grid: {
                            color: gridColor
                        },
                        ticks: {
                            color: axisColor
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AUDIENCE AREA CHART
    // Active Subscribers over time with gradient fill
    // ─────────────────────────────────────────────────────────────────────────

    function renderAudienceChart() {
        const canvas = document.getElementById('audience-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const audienceData = DataService.getAudienceData(currentPeriod);
        const data = {
            labels: audienceData.labels || [],
            data: audienceData.activeSubscribers || []
        };

        // Destroy existing chart if present
        if (audienceChart) {
            audienceChart.destroy();
        }

        // Create gradient for area fill (theme-aware)
        const lineColor = getThemeColor('--color-chart-primary', '#C2EE6B');
        const light = isLightTheme();
        const areaGradient = ctx.createLinearGradient(0, 0, 0, 280);
        areaGradient.addColorStop(0, lineColor + (light ? '1F' : '4D'));
        areaGradient.addColorStop(1, lineColor + '00');

        audienceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.data,
                    borderColor: lineColor,
                    borderWidth: 3,
                    backgroundColor: areaGradient,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: lineColor,
                    pointBorderColor: light ? '#FFFFFF' : '#111111',
                    pointBorderWidth: 2,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: lineColor,
                    pointHoverBorderColor: light ? '#1E1036' : '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: (items) => items[0].label,
                            label: (item) => `Subscribers: ${item.raw.toLocaleString()}`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: light ? 'rgba(28, 30, 27, 0.48)' : 'rgba(255, 255, 255, 0.5)'
                        }
                    },
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: light ? 'rgba(28, 30, 27, 0.06)' : 'rgba(255, 255, 255, 0.08)'
                        },
                        ticks: {
                            color: light ? 'rgba(28, 30, 27, 0.48)' : 'rgba(255, 255, 255, 0.5)',
                            callback: (value) => value >= 1000 ? (value / 1000) + 'k' : value
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ENGAGEMENT DONUT CHART
    // ─────────────────────────────────────────────────────────────────────────

    function renderEngagementDonut() {
        const canvas = document.getElementById('engagement-donut-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (engagementDonut) engagementDonut.destroy();

        // Calculate open rate from date-filtered posts
        const posts = getDateFilteredPosts();
        let openRate = 0;
        if (posts.length > 0) {
            const totalSent = posts.reduce((s, p) => s + (p.sent || p.delivered || 0), 0);
            const totalOpens = posts.reduce((s, p) => s + (p.uniqueOpens || p.totalOpens || 0), 0);
            if (totalSent > 0 && totalOpens > 0) {
                openRate = (totalOpens / totalSent) * 100;
            } else {
                const rates = posts.filter(p => p.openRate > 0).map(p => p.openRate);
                openRate = rates.length > 0 ? rates.reduce((s, r) => s + r, 0) / rates.length : 0;
            }
        }

        const opened = Math.round(openRate * 10) / 10;
        const unopened = Math.round((100 - opened) * 10) / 10;

        const centerVal = document.getElementById('donut-center-value');
        const openedPct = document.getElementById('donut-opened-pct');
        const unopenedPct = document.getElementById('donut-unopened-pct');
        if (centerVal) centerVal.textContent = opened.toFixed(1) + '%';
        if (openedPct) openedPct.textContent = opened.toFixed(1) + '%';
        if (unopenedPct) unopenedPct.textContent = unopened.toFixed(1) + '%';

        const light = isLightTheme();
        const primaryColor = getThemeColor('--color-chart-primary', '#C2EE6B');
        const emptyColor = light ? 'rgba(28, 30, 27, 0.08)' : 'rgba(255, 255, 255, 0.08)';

        engagementDonut = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Opened', 'Unopened'],
                datasets: [{
                    data: [opened, unopened],
                    backgroundColor: [primaryColor, emptyColor],
                    borderWidth: 0,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '72%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (item) {
                                return item.label + ': ' + item.raw.toFixed(1) + '%';
                            }
                        }
                    }
                },
                animation: {
                    animateRotate: true,
                    duration: 800
                }
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LEADERBOARD (Top Posts by Open Rate)
    // ─────────────────────────────────────────────────────────────────────────

    function renderLeaderboard() {
        const container = document.getElementById('leaderboard');
        if (!container) return;

        let posts = [];
        if (window.AppState && window.AppState.xlsxData && window.AppState.xlsxData.posts) {
            posts = window.AppState.xlsxData.posts;
        }

        if (!posts.length) {
            container.innerHTML = `
                <div class="leaderboard__empty">
                    <span class="leaderboard__empty-icon">📭</span>
                    <span class="leaderboard__empty-text">Import data to see top posts</span>
                </div>`;
            return;
        }

        // Calculate open rate per post and sort
        const ranked = posts
            .filter(p => (p.sent || p.delivered || 0) > 0 || p.openRate > 0)
            .map(p => {
                const sent = p.sent || p.delivered || 0;
                const opens = p.uniqueOpens || p.totalOpens || 0;
                // Use stored openRate if available, otherwise calculate
                const rate = p.openRate > 0 ? p.openRate : (sent > 0 ? (opens / sent) * 100 : 0);
                return {
                    title: p.title || p.subject || 'Untitled',
                    date: p.date ? new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
                    openRate: rate,
                    recipients: sent
                };
            })
            .filter(p => p.openRate > 0)
            .sort((a, b) => b.openRate - a.openRate)
            .slice(0, 7);

        const maxRate = ranked.length > 0 ? ranked[0].openRate : 100;

        container.innerHTML = ranked.map((post, i) => `
            <div class="leaderboard__item">
                <span class="leaderboard__rank">${i + 1}</span>
                <div class="leaderboard__info">
                    <div class="leaderboard__title" title="${post.title}">${post.title}</div>
                    <div class="leaderboard__meta">${post.date} · ${post.recipients.toLocaleString()} recipients</div>
                </div>
                <span class="leaderboard__value">${post.openRate.toFixed(1)}%</span>
                <div class="leaderboard__bar">
                    <div class="leaderboard__bar-fill" style="width: ${(post.openRate / maxRate * 100).toFixed(1)}%"></div>
                </div>
            </div>
        `).join('');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CLICKS BAR CHART (Horizontal — Top 10 posts by clicks)
    // ─────────────────────────────────────────────────────────────────────────

    function renderClicksBarChart() {
        const canvas = document.getElementById('clicks-bar-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (clicksBarChart) clicksBarChart.destroy();

        let posts = getDateFilteredPosts();

        // Get top 10 posts by clicks — prefer uniqueClicks over verifiedClicks 
        // because verifiedClicks can be 0 or averaged out from publication totals
        const getClicks = (p) => {
            // Use uniqueClicks first (always present), then verifiedClicks, then totalOpens as fallback
            return p.uniqueClicks || p.verifiedClicks || 0;
        };

        const topPosts = posts
            .filter(p => getClicks(p) > 0)
            .sort((a, b) => getClicks(b) - getClicks(a))
            .slice(0, 10)
            .reverse();

        const labels = topPosts.map(p => {
            const title = p.title || p.subject || 'Untitled';
            return title.length > 35 ? title.substring(0, 32) + '...' : title;
        });
        const data = topPosts.map(p => getClicks(p));

        const light = isLightTheme();
        const primaryColor = getThemeColor('--color-chart-primary', '#C2EE6B');
        const axisColor = light ? 'rgba(28, 30, 27, 0.48)' : 'rgba(255, 255, 255, 0.5)';
        const gridColor = light ? 'rgba(28, 30, 27, 0.06)' : 'rgba(255, 255, 255, 0.08)';

        clicksBarChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: primaryColor + 'CC',
                    hoverBackgroundColor: primaryColor,
                    borderRadius: 6,
                    borderSkipped: false,
                    barThickness: 18
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: function (items) { return items[0].label; },
                            label: function (item) { return item.raw.toLocaleString() + ' clicks'; }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: gridColor, drawBorder: false },
                        ticks: { color: axisColor, font: { size: 11 } }
                    },
                    y: {
                        grid: { display: false },
                        ticks: {
                            color: axisColor,
                            font: { size: 11, weight: '500' },
                            crossAlign: 'far'
                        }
                    }
                }
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ENGAGEMENT SUMMARY STATS
    // ─────────────────────────────────────────────────────────────────────────

    function updateEngagementStats() {
        const posts = getDateFilteredPosts();
        if (!posts.length) return;
        const totalOpens = posts.reduce((s, p) => s + (p.uniqueOpens || p.totalOpens || 0), 0);
        const totalClicks = posts.reduce((s, p) => s + (p.uniqueClicks || p.verifiedClicks || 0), 0);

        const elOpens = document.getElementById('engagement-total-opens');
        const elClicks = document.getElementById('engagement-total-clicks');
        const elPosts = document.getElementById('engagement-total-posts');

        if (elOpens) elOpens.textContent = totalOpens.toLocaleString();
        if (elClicks) elClicks.textContent = totalClicks.toLocaleString();
        if (elPosts) elPosts.textContent = posts.length.toLocaleString();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER ALL ENGAGEMENT CHARTS
    // ─────────────────────────────────────────────────────────────────────────

    function renderEngagementCharts() {
        updateEngagementStats();
        renderEngagementDonut();
        renderLeaderboard();
        renderClicksBarChart();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────

    return {
        /**
         * Initialize all charts
         */
        init: function () {
            // Set global Chart.js defaults
            setGlobalDefaults();

            // Render all charts
            renderPerformanceChart();
            renderGrowthChart();
            renderAudienceChart();
            renderEngagementCharts();
        },

        /**
         * Update charts with new data (for filter changes)
         */
        update: function (filters) {
            if (filters && filters.chartPeriod) {
                currentPeriod = filters.chartPeriod;
            }
            // Re-render charts with new data
            this.init();
        },

        /**
         * Set the aggregation period and re-render
         */
        setPeriod: function (period) {
            currentPeriod = period;
            renderPerformanceChart();
            renderGrowthChart();
            renderAudienceChart();
        },

        /**
         * Get the current period
         */
        getPeriod: function () {
            return currentPeriod;
        },

        /**
         * Destroy all chart instances
         */
        destroy: function () {
            if (performanceChart) performanceChart.destroy();
            if (growthChart) growthChart.destroy();
            if (audienceChart) audienceChart.destroy();
            if (engagementDonut) engagementDonut.destroy();
            if (clicksBarChart) clicksBarChart.destroy();
        },

        // Expose individual render functions for partial updates
        renderPerformanceChart,
        renderGrowthChart,
        renderAudienceChart,
        renderEngagementCharts
    };
})();

// Export for use in other modules
window.Charts = Charts;
