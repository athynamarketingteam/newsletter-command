/* ════════════════════════════════════════════════════════════════════════════
   KPI DETAIL MODAL — Newsletter Analytics Dashboard
   Expandable detail views for KPI cards
   ════════════════════════════════════════════════════════════════════════════ */

const KPIDetailModal = (function () {
    'use strict';

    let overlay = null;
    let detailChart = null;

    // ─────────────────────────────────────────────────────────────────────────
    // KPI CONFIGURATIONS
    // ─────────────────────────────────────────────────────────────────────────

    const KPI_CONFIG = {
        'Open Rate': {
            icon: '📬',
            description: 'Percentage of delivered emails that were opened by recipients.',
            color: null,
            dataKey: 'openRate',
            format: 'percent',
            tips: [
                'Industry average: 20-25%',
                'Subject lines impact open rates significantly',
                'Send time optimization can improve opens'
            ]
        },
        'Click-Through Rate': {
            icon: '🖱️',
            description: 'Percentage of openers who clicked at least one link.',
            color: '#00D4AA',
            dataKey: 'ctr',
            format: 'percent',
            tips: [
                'Industry average: 2-5%',
                'Clear CTAs improve click rates',
                'Link placement affects engagement'
            ]
        },
        'Verified CTR': {
            icon: '✅',
            description: 'Click-through rate excluding bot clicks and prefetches.',
            color: '#7C4DFF',
            dataKey: 'verifiedCtr',
            format: 'percent',
            tips: [
                'More accurate than standard CTR',
                'Filters out automated clicks',
                'Better for true engagement measurement'
            ]
        },
        'Delivery Rate': {
            icon: '📨',
            description: 'Percentage of sent emails successfully delivered.',
            color: '#4FC3F7',
            dataKey: 'deliveryRate',
            format: 'percent',
            tips: [
                'Target: 95%+ delivery rate',
                'Clean your list regularly',
                'Monitor bounce rates'
            ]
        },
        'Unique Clicks': {
            icon: '👆',
            description: 'Average unique subscribers who clicked per post.',
            color: '#FFB74D',
            dataKey: 'uniqueClicks',
            format: 'number',
            tips: [
                'Tracks individual engagement',
                'Multiple clicks counted once per user',
                'Key metric for content interest'
            ]
        },
        'Verified Clicks': {
            icon: '🔐',
            description: 'Average verified human clicks per post.',
            color: '#E91E63',
            dataKey: 'verifiedClicks',
            format: 'number',
            tips: [
                'Most accurate click metric',
                'Excludes email prefetching',
                'Use for true performance analysis'
            ]
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // INITIALIZATION
    // ─────────────────────────────────────────────────────────────────────────

    function init() {
        createModal();
        setupCardListeners();
    }

    function createModal() {
        // Remove existing modal if present (ensures fresh HTML)
        const existing = document.getElementById('kpi-detail-modal');
        if (existing) {
            existing.remove();
        }

        const html = `
            <div class="modal-overlay" id="kpi-detail-modal">
                <div class="modal kpi-detail-modal">
                    <div class="modal__header">
                        <div class="kpi-detail-modal__title-wrap">
                            <span class="kpi-detail-modal__icon"></span>
                            <h2 class="modal__title kpi-detail-modal__title"></h2>
                        </div>
                        <button class="modal__close" data-action="close">×</button>
                    </div>
                    <div class="modal__body">
                        <div class="kpi-detail-modal__hero">
                            <div class="kpi-detail-modal__value"></div>
                            <div class="kpi-detail-modal__delta"></div>
                        </div>
                        <p class="kpi-detail-modal__description"></p>
                        
                        <div class="kpi-detail-modal__chart-section">
                            <div class="kpi-detail-modal__chart-header">
                                <h3>Monthly Trend</h3>
                            </div>
                            <div class="kpi-detail-modal__chart">
                                <canvas id="kpi-detail-chart"></canvas>
                            </div>
                        </div>
                        
                        <div class="kpi-detail-modal__insights">
                            <h3>💡 Insights & Tips</h3>
                            <ul class="kpi-detail-modal__tips"></ul>
                        </div>
                        
                        <div class="kpi-detail-modal__stats">
                            <div class="kpi-detail-modal__stat">
                                <span class="kpi-detail-modal__stat-label">Period High</span>
                                <span class="kpi-detail-modal__stat-value kpi-detail-modal__stat-value--high"></span>
                            </div>
                            <div class="kpi-detail-modal__stat">
                                <span class="kpi-detail-modal__stat-label">Period Low</span>
                                <span class="kpi-detail-modal__stat-value kpi-detail-modal__stat-value--low"></span>
                            </div>
                            <div class="kpi-detail-modal__stat">
                                <span class="kpi-detail-modal__stat-label">Average</span>
                                <span class="kpi-detail-modal__stat-value kpi-detail-modal__stat-value--avg"></span>
                            </div>
                            <div class="kpi-detail-modal__stat">
                                <span class="kpi-detail-modal__stat-label">Data Points</span>
                                <span class="kpi-detail-modal__stat-value kpi-detail-modal__stat-value--count"></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);
        overlay = document.getElementById('kpi-detail-modal');

        // Setup event listeners
        overlay.querySelector('[data-action="close"]').addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });

        // Period toggle removed - using monthly only

        // Keyboard shortcut
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('is-open')) {
                close();
            }
        });
    }

    function setupCardListeners() {
        // Make KPI cards clickable
        document.querySelectorAll('.kpi-card').forEach(card => {
            card.style.cursor = 'pointer';
            card.addEventListener('click', (e) => {
                // Don't open modal when clicking the period toggle
                if (e.target.closest('.kpi-period-toggle')) return;
                const label = card.querySelector('.kpi-card__label')?.textContent;
                if (label && KPI_CONFIG[label]) {
                    // Read period from this card's toggle
                    const toggle = card.querySelector('.kpi-period-toggle');
                    const activeBtn = toggle ? toggle.querySelector('.pill-toggle__item.is-active') : null;
                    const period = activeBtn ? (activeBtn.dataset.period || 'monthly') : 'monthly';
                    open(label, period);
                }
            });
        });

        // Also make hero metric clickable
        const heroMetric = document.querySelector('.hero-metric .glass-card');
        if (heroMetric) {
            heroMetric.style.cursor = 'pointer';
            heroMetric.addEventListener('click', (e) => {
                // Don't open modal when clicking the period toggle
                if (e.target.closest('.hero-period-toggle')) return;
                // Read period from hero toggle
                const heroToggle = document.querySelector('.hero-period-toggle');
                const activeBtn = heroToggle ? heroToggle.querySelector('.pill-toggle__item.is-active') : null;
                const period = activeBtn ? (activeBtn.dataset.period || 'monthly') : 'monthly';
                openHeroDetail(period);
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MODAL OPERATIONS
    // ─────────────────────────────────────────────────────────────────────────

    let currentKPI = null;
    let currentData = null;

    function open(kpiName, period) {
        if (!overlay || !KPI_CONFIG[kpiName]) return;

        currentKPI = kpiName;
        const config = KPI_CONFIG[kpiName];

        // Get current data (XLSX first, then CSV fallback)
        const newsletter = window.NewsletterManager?.getActive();
        const xlsxData = newsletter ? window.NewsletterManager.getXLSXData(newsletter.id) : null;
        currentData = xlsxData ? { xlsxData, isXLSX: true } : (newsletter ? window.NewsletterManager.getData(newsletter.id) : null);

        // Update modal content
        overlay.querySelector('.kpi-detail-modal__icon').textContent = config.icon;
        overlay.querySelector('.kpi-detail-modal__title').textContent = kpiName;
        overlay.querySelector('.kpi-detail-modal__description').textContent = config.description;

        // Determine best chart period based on date range and card toggle
        const range = window.AppState?.dateRange || '90d';
        // For 30d: weekly gives ~4-5 data points; monthly only gives 2
        // For 90d: monthly gives ~3 data points; weekly gives ~13
        const bestPeriod = period || (range === '30d' ? 'weekly' : 'monthly');

        // Update chart section title based on period
        const chartHeader = overlay.querySelector('.kpi-detail-modal__chart-header h3');
        if (chartHeader) {
            chartHeader.textContent = bestPeriod === 'weekly' ? 'Weekly Trend' : 'Monthly Trend';
        }

        // Update current value
        const value = getCurrentValue(config.dataKey, config.format);
        overlay.querySelector('.kpi-detail-modal__value').textContent = value;

        // Update delta
        const delta = getDelta(config.dataKey);
        const deltaEl = overlay.querySelector('.kpi-detail-modal__delta');
        deltaEl.className = 'kpi-detail-modal__delta';
        deltaEl.classList.add(delta.direction === 'positive' ? 'delta--positive' :
            delta.direction === 'negative' ? 'delta--negative' : 'delta--neutral');
        deltaEl.textContent = delta.text;

        // Update tips
        const tipsList = overlay.querySelector('.kpi-detail-modal__tips');
        tipsList.innerHTML = config.tips.map(tip => `<li>${tip}</li>`).join('');

        // Update stats
        updateStats(config);

        // Set theme color
        overlay.style.setProperty('--kpi-color', config.color);

        // Show modal
        overlay.classList.add('is-open');

        // Initialize chart with the best period
        setTimeout(() => updateChart(bestPeriod), 100);
    }

    function openHeroDetail(period) {
        if (!overlay) return;

        const cardPeriod = period || 'monthly';
        currentKPI = 'Active Subscribers';

        // Get current data (XLSX first, then CSV fallback)
        const newsletter = window.NewsletterManager?.getActive();
        const xlsxData = newsletter ? window.NewsletterManager.getXLSXData(newsletter.id) : null;
        currentData = xlsxData ? { xlsxData, isXLSX: true } : (newsletter ? window.NewsletterManager.getData(newsletter.id) : null);

        // Update modal content
        overlay.querySelector('.kpi-detail-modal__icon').textContent = '👥';
        overlay.querySelector('.kpi-detail-modal__title').textContent = 'Active Subscribers';
        overlay.querySelector('.kpi-detail-modal__description').textContent =
            'Total number of active subscribers receiving your newsletter.';

        // Update chart section title based on period
        const chartHeader = overlay.querySelector('.kpi-detail-modal__chart-header h3');
        if (chartHeader) {
            chartHeader.textContent = cardPeriod === 'weekly' ? 'Weekly Trend' : 'Monthly Trend';
        }

        // Update current value - prioritize XLSX audience data
        let value = 0;
        if (currentData?.isXLSX && currentData.xlsxData?.audience?.length > 0) {
            // Get latest subscriber count from audience array
            const audience = currentData.xlsxData.audience;
            value = audience[audience.length - 1].activeSubscribers || 0;
        } else if (currentData?.current?.activeSubscribers) {
            value = currentData.current.activeSubscribers;
        } else {
            const heroEl = document.getElementById('hero-subscribers');
            value = heroEl ? parseInt(heroEl.textContent.replace(/,/g, ''), 10) || 0 : 0;
        }
        overlay.querySelector('.kpi-detail-modal__value').textContent =
            typeof value === 'number' ? Math.round(value).toLocaleString() : value;

        // Update delta
        const deltaEl = overlay.querySelector('.kpi-detail-modal__delta');
        deltaEl.className = 'kpi-detail-modal__delta delta--positive';
        deltaEl.textContent = 'Based on delivered emails';

        // Update tips
        const tipsList = overlay.querySelector('.kpi-detail-modal__tips');
        tipsList.innerHTML = `
            <li>Subscriber count based on delivery data</li>
            <li>Connect Beehiiv API for accurate subscriber metrics</li>
            <li>Track growth over time to measure newsletter health</li>
        `;

        // Update stats from XLSX audience data
        if (currentData?.isXLSX && currentData.xlsxData?.audience) {
            const audience = currentData.xlsxData.audience;
            const values = audience.map(a => a.activeSubscribers).filter(v => !isNaN(v));
            if (values.length > 0) {
                const high = Math.max(...values);
                const low = Math.min(...values);
                const avg = values.reduce((a, b) => a + b, 0) / values.length;
                overlay.querySelector('.kpi-detail-modal__stat-value--high').textContent = high.toLocaleString();
                overlay.querySelector('.kpi-detail-modal__stat-value--low').textContent = low.toLocaleString();
                overlay.querySelector('.kpi-detail-modal__stat-value--avg').textContent = Math.round(avg).toLocaleString();
                overlay.querySelector('.kpi-detail-modal__stat-value--count').textContent = values.length;
            } else {
                overlay.querySelector('.kpi-detail-modal__stat-value--high').textContent = '--';
                overlay.querySelector('.kpi-detail-modal__stat-value--low').textContent = '--';
                overlay.querySelector('.kpi-detail-modal__stat-value--avg').textContent = '--';
                overlay.querySelector('.kpi-detail-modal__stat-value--count').textContent = '0';
            }
        } else {
            overlay.querySelector('.kpi-detail-modal__stat-value--high').textContent = '--';
            overlay.querySelector('.kpi-detail-modal__stat-value--low').textContent = '--';
            overlay.querySelector('.kpi-detail-modal__stat-value--avg').textContent = '--';
            overlay.querySelector('.kpi-detail-modal__stat-value--count').textContent =
                currentData?.rawRows?.length || '0';
        }

        // Set theme color
        // kpi-color is handled by CSS per theme, no JS override needed

        // Show modal
        overlay.classList.add('is-open');

        // Initialize chart with the selected period
        setTimeout(() => updateChart(cardPeriod), 100);
    }

    function close() {
        if (overlay) {
            overlay.classList.remove('is-open');
        }
        if (detailChart) {
            detailChart.destroy();
            detailChart = null;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DATA HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Get filtered posts respecting the current date range
     */
    function getFilteredModalPosts() {
        if (!currentData?.isXLSX || !currentData.xlsxData?.posts) return null;
        const allPosts = currentData.xlsxData.posts;
        // Use the same date range as the main dashboard
        const appState = window.AppState || {};
        const range = appState.dateRange;
        if (range && window.XLSXParser) {
            const endDate = new Date();
            const startDate = new Date();
            if (range === '30d') startDate.setDate(endDate.getDate() - 30);
            else if (range === '90d') startDate.setDate(endDate.getDate() - 90);
            else return allPosts;
            return XLSXParser.filterByDateRange(allPosts, startDate, endDate);
        }
        return allPosts;
    }

    function getCurrentValue(dataKey, format) {
        // XLSX data: aggregate from date-filtered posts using weighted averages
        if (currentData?.isXLSX && currentData.xlsxData?.posts) {
            const posts = getFilteredModalPosts();
            if (!posts || posts.length === 0) return 'N/A';

            // Use the same weighted aggregation as the KPI cards
            if (window.XLSXParser) {
                const aggregated = XLSXParser.aggregatePosts(posts);
                const value = aggregated[dataKey];
                if (value === null || value === undefined) return 'N/A';
                // For click count metrics, show per-post average (Mariana Protocol)
                const isClickMetric = dataKey === 'uniqueClicks' || dataKey === 'verifiedClicks';
                if (isClickMetric) {
                    const avgValue = aggregated.count > 0 ? aggregated[dataKey] / aggregated.count : 0;
                    return Math.round(avgValue).toLocaleString() + ' avg/post';
                }
                return format === 'percent' ? value.toFixed(1) + '%' : Math.round(value).toLocaleString();
            }

            // Fallback: simple computation
            const values = posts.map(p => p[dataKey]).filter(v => v !== undefined && v !== null && !isNaN(v));
            if (values.length === 0) return 'N/A';
            const isRate = format === 'percent';
            const value = isRate
                ? values.reduce((a, b) => a + b, 0) / values.length
                : values.reduce((a, b) => a + b, 0);
            return format === 'percent' ? value.toFixed(1) + '%' : Math.round(value).toLocaleString();
        }

        // CSV data
        if (!currentData?.current) return 'N/A';
        const value = currentData.current[dataKey];
        if (value === undefined) return 'N/A';
        return format === 'percent' ? value.toFixed(1) + '%' : Math.round(value).toLocaleString();
    }

    function getDelta(dataKey) {
        // XLSX data: compute trend from date-filtered posts
        if (currentData?.isXLSX && currentData.xlsxData?.posts) {
            const posts = getFilteredModalPosts();
            if (!posts || posts.length < 2) {
                return { direction: 'neutral', text: 'Not enough data for trend' };
            }

            // Compare first half vs second half
            const mid = Math.floor(posts.length / 2);
            const firstHalf = posts.slice(0, mid);
            const secondHalf = posts.slice(mid);

            const getAvg = (arr) => {
                const vals = arr.map(p => p[dataKey]).filter(v => v !== undefined && !isNaN(v));
                return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
            };

            const firstAvg = getAvg(firstHalf);
            const secondAvg = getAvg(secondHalf);
            const diff = secondAvg - firstAvg;

            if (Math.abs(diff) < 0.1) {
                return { direction: 'neutral', text: 'No significant change' };
            }

            const direction = diff > 0 ? 'positive' : 'negative';
            const text = (diff >= 0 ? '+' : '') + diff.toFixed(1) + '% trend';
            return { direction, text };
        }

        // CSV data
        if (!currentData?.deltas?.[dataKey]) {
            return { direction: 'neutral', text: 'No comparison data' };
        }
        const delta = currentData.deltas[dataKey];
        const value = delta.value;
        const direction = delta.direction;
        const text = delta.isAbsolute
            ? (value >= 0 ? '+' : '') + Math.round(value).toLocaleString() + ' vs previous period'
            : (value >= 0 ? '+' : '') + value.toFixed(1) + '% vs previous period';
        return { direction, text };
    }

    function updateStats(config) {
        // Use date-filtered posts for consistent data
        const rawRows = currentData?.isXLSX ? getFilteredModalPosts() : currentData?.rawRows;

        if (!rawRows || rawRows.length === 0) {
            overlay.querySelector('.kpi-detail-modal__stat-value--high').textContent = 'N/A';
            overlay.querySelector('.kpi-detail-modal__stat-value--low').textContent = 'N/A';
            overlay.querySelector('.kpi-detail-modal__stat-value--avg').textContent = 'N/A';
            overlay.querySelector('.kpi-detail-modal__stat-value--count').textContent = '0';
            return;
        }

        const values = rawRows
            .map(r => r[config.dataKey])
            .filter(v => v !== undefined && v !== null && !isNaN(v));

        if (values.length === 0) {
            overlay.querySelector('.kpi-detail-modal__stat-value--high').textContent = 'N/A';
            overlay.querySelector('.kpi-detail-modal__stat-value--low').textContent = 'N/A';
            overlay.querySelector('.kpi-detail-modal__stat-value--avg').textContent = 'N/A';
            overlay.querySelector('.kpi-detail-modal__stat-value--count').textContent = '0';
            return;
        }

        const isClickMetric = config.dataKey === 'uniqueClicks' || config.dataKey === 'verifiedClicks';

        const high = Math.max(...values);
        const low = Math.min(...values);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const total = values.reduce((a, b) => a + b, 0);

        const format = (v) => config.format === 'percent'
            ? v.toFixed(1) + '%'
            : Math.round(v).toLocaleString();

        overlay.querySelector('.kpi-detail-modal__stat-value--high').textContent = format(high);
        overlay.querySelector('.kpi-detail-modal__stat-value--low').textContent = format(low);

        // For click metrics: show Total in the 'Average' slot (since avg is the hero)
        const avgLabelEl = overlay.querySelectorAll('.kpi-detail-modal__stat-label')[2];
        const avgValueEl = overlay.querySelector('.kpi-detail-modal__stat-value--avg');
        if (isClickMetric) {
            if (avgLabelEl) avgLabelEl.textContent = 'Total';
            avgValueEl.textContent = Math.round(total).toLocaleString();
        } else {
            if (avgLabelEl) avgLabelEl.textContent = 'Average';
            avgValueEl.textContent = format(avg);
        }
        overlay.querySelector('.kpi-detail-modal__stat-value--count').textContent = values.length;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHART
    // ─────────────────────────────────────────────────────────────────────────

    function updateChart(period = 'monthly') {
        const canvas = document.getElementById('kpi-detail-chart');
        if (!canvas) return;

        if (detailChart) {
            detailChart.destroy();
        }

        const config = KPI_CONFIG[currentKPI];
        if (!config && currentKPI !== 'Active Subscribers') return;

        // Get aggregated data - support both XLSX and CSV
        let chartData = { labels: [], values: [] };

        // Handle Active Subscribers with XLSX audience data
        if (currentKPI === 'Active Subscribers' && currentData?.isXLSX && currentData.xlsxData?.audience) {
            const audience = currentData.xlsxData.audience.slice().sort((a, b) => a.date - b.date);

            if (period === 'weekly') {
                // Aggregate by ISO week — take last reading per week
                const weekBuckets = {};
                audience.forEach(a => {
                    const d = a.date;
                    const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
                    dt.setUTCDate(dt.getUTCDate() + 4 - (dt.getUTCDay() || 7));
                    const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
                    const weekNo = Math.ceil(((dt - yearStart) / 86400000 + 1) / 7);
                    const year = dt.getUTCFullYear();
                    const key = `${year}-W${String(weekNo).padStart(2, '0')}`;
                    // Compute Monday of this ISO week
                    const jan4 = new Date(Date.UTC(year, 0, 4));
                    const dow = jan4.getUTCDay() || 7;
                    const mon = new Date(jan4);
                    mon.setUTCDate(jan4.getUTCDate() - dow + 1 + (weekNo - 1) * 7);
                    const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const label = `${mNames[mon.getUTCMonth()]} ${mon.getUTCDate()}`;
                    weekBuckets[key] = { label, value: a.activeSubscribers };
                });
                const sorted = Object.keys(weekBuckets).sort();
                chartData.labels = sorted.map(k => weekBuckets[k].label);
                chartData.values = sorted.map(k => weekBuckets[k].value);
            } else {
                // Monthly: aggregate by month — take last reading per month
                const monthBuckets = {};
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                audience.forEach(a => {
                    const d = a.date;
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    const label = months[d.getMonth()] + ' ' + d.getFullYear();
                    monthBuckets[key] = { label, value: a.activeSubscribers };
                });
                const sorted = Object.keys(monthBuckets).sort();
                chartData.labels = sorted.map(k => monthBuckets[k].label);
                chartData.values = sorted.map(k => monthBuckets[k].value);
            }
        }
        // Handle KPI metrics with XLSX posts data
        else if (currentData?.isXLSX && currentData.xlsxData?.posts) {
            const posts = getFilteredModalPosts() || [];
            const dataKey = config?.dataKey || 'openRate';
            const isRate = config?.format === 'percent';

            if (period === 'weekly') {
                // Aggregate by ISO week — use DataService helpers if available
                const buckets = {};
                posts.forEach(post => {
                    const date = post.date;
                    // ISO week calculation
                    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
                    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
                    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
                    const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
                    const year = d.getUTCFullYear();
                    const key = `${year}-W${String(weekNo).padStart(2, '0')}`;
                    const label = (() => {
                        const jan4 = new Date(Date.UTC(year, 0, 4));
                        const dow = jan4.getUTCDay() || 7;
                        const mon = new Date(jan4);
                        mon.setUTCDate(jan4.getUTCDate() - dow + 1 + (weekNo - 1) * 7);
                        const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        return `${mNames[mon.getUTCMonth()]} ${mon.getUTCDate()}`;
                    })();

                    if (!buckets[key]) buckets[key] = { label, sum: 0, count: 0 };
                    const val = post[dataKey];
                    if (val !== undefined && val !== null && !isNaN(val)) {
                        buckets[key].sum += val;
                        buckets[key].count++;
                    }
                });
                const sorted = Object.keys(buckets).sort();
                chartData.labels = sorted.map(k => buckets[k].label);
                chartData.values = sorted.map(k => {
                    const b = buckets[k];
                    return isRate ? (b.count > 0 ? b.sum / b.count : 0) : b.sum;
                });
            } else {
                // Aggregate by month
                const monthlyData = {};
                posts.forEach(post => {
                    const date = post.date;
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const label = months[date.getMonth()] + ' ' + date.getFullYear();

                    if (!monthlyData[monthKey]) {
                        monthlyData[monthKey] = { label, values: [], sum: 0, count: 0 };
                    }
                    const val = post[dataKey];
                    if (val !== undefined && val !== null && !isNaN(val)) {
                        monthlyData[monthKey].values.push(val);
                        monthlyData[monthKey].sum += val;
                        monthlyData[monthKey].count++;
                    }
                });

                const sortedMonths = Object.keys(monthlyData).sort();
                chartData.labels = sortedMonths.map(k => monthlyData[k].label);
                chartData.values = sortedMonths.map(k => {
                    const d = monthlyData[k];
                    return isRate ? (d.count > 0 ? d.sum / d.count : 0) : d.sum;
                });
            }
        }
        // Fallback to CSV data
        else if (currentData?.rawRows && currentData.rawRows.length > 0) {
            const aggregated = window.CSVParser?.aggregateByPeriod(currentData.rawRows, period) || [];
            const dataKey = config?.dataKey || 'delivered';
            chartData.labels = aggregated.map(a => a.label);
            chartData.values = aggregated.map(a => a[dataKey] || 0);
        }

        if (chartData.labels.length === 0) {
            chartData = {
                labels: ['No data'],
                values: [0]
            };
        }

        const ctx = canvas.getContext('2d');
        const color = config?.color || getComputedStyle(document.documentElement).getPropertyValue('--color-chart-primary').trim() || '#C2EE6B';
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const tickColor = isLight ? 'rgba(28, 30, 27, 0.6)' : 'rgba(255,255,255,0.6)';
        const gridColor = isLight ? 'rgba(28, 30, 27, 0.1)' : 'rgba(255,255,255,0.1)';

        detailChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: currentKPI,
                    data: chartData.values,
                    borderColor: color,
                    backgroundColor: color + '20',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: color,
                    pointBorderColor: isLight ? '#fff' : '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        padding: 12,
                        titleFont: { size: 14 },
                        bodyFont: { size: 13 }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: tickColor }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: { color: tickColor }
                    }
                }
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────

    return {
        init,
        open,
        close
    };
})();

window.KPIDetailModal = KPIDetailModal;
