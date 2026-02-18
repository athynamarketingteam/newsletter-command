/* ════════════════════════════════════════════════════════════════════════════
   MAIN — Newsletter Analytics Dashboard
   Application entry point and initialization
   ════════════════════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    // ─────────────────────────────────────────────────────────────────────────
    // APPLICATION STATE
    // ─────────────────────────────────────────────────────────────────────────

    const AppState = {
        newsletter: 'roko-basilisk',
        dateRange: '90d',
        chartPeriod: 'monthly'
    };
    window.AppState = AppState;

    // ─────────────────────────────────────────────────────────────────────────
    // INITIALIZATION
    // ─────────────────────────────────────────────────────────────────────────

    function init() {
        console.log('📊 Newsletter Analytics Dashboard initializing...');

        // Initialize Newsletter Manager first
        NewsletterManager.init();

        // Initialize Theme Manager
        ThemeManager.init();

        // Parse URL params for initial state
        parseUrlParams();

        // Initialize UI components
        Components.initAll();

        // Initialize modals
        ImportModal.init();
        AddNewsletterModal.init();
        SettingsModal.init();
        DatePicker.init();

        // Initialize charts
        Charts.init();

        // Initialize KPI detail modal (after charts so cards exist)
        KPIDetailModal.init();

        // Initialize export modal
        ExportModal.init();

        // Initialize posts table
        PostsTable.init();

        // Initialize insight bar
        if (window.InsightBar) {
            InsightBar.init();
        }

        // Initialize performance highlights
        if (window.PerformanceHighlights) {
            PerformanceHighlights.init();
        }

        // Initialize keyboard shortcuts
        KeyboardShortcuts.init();

        // Setup event listeners
        setupEventListeners();

        // Update URL with current state
        updateUrl();

        // Don't auto-restore data on page load - show zeros until explicit import
        // loadImportedData();

        console.log('✅ Dashboard ready (Press ? for keyboard shortcuts)');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // URL STATE MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────

    function parseUrlParams() {
        const params = new URLSearchParams(window.location.search);

        if (params.has('range')) {
            AppState.dateRange = params.get('range');
        }
        if (params.has('period')) {
            AppState.chartPeriod = params.get('period');
        }
        if (params.has('newsletter')) {
            AppState.newsletter = params.get('newsletter');
            NewsletterManager.setActive(AppState.newsletter);
        }

        // Update UI to match state
        const dateToggle = document.getElementById('date-range-toggle');
        if (dateToggle) {
            Components.PillToggle.setValue(dateToggle, AppState.dateRange);
        }
    }

    function updateUrl() {
        const params = new URLSearchParams();
        params.set('range', AppState.dateRange);
        params.set('period', AppState.chartPeriod);
        params.set('newsletter', AppState.newsletter);

        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, '', newUrl);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT LISTENERS
    // ─────────────────────────────────────────────────────────────────────────

    function setupEventListeners() {
        // Import button
        const importBtn = document.getElementById('import-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => ImportModal.open());
        }

        // Beehiiv Sync button
        const syncBtn = document.getElementById('beehiiv-sync-btn');
        if (syncBtn) {
            syncBtn.addEventListener('click', handleBeehiivSync);
        }

        // Add Newsletter button
        const addBtn = document.getElementById('add-newsletter-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => AddNewsletterModal.open());
        }

        // Export button
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => ExportModal.open());
        }

        // Date range toggle
        const dateToggle = document.getElementById('date-range-toggle');
        if (dateToggle) {
            dateToggle.addEventListener('toggle:change', (e) => {
                const value = e.detail.value;
                AppState.dateRange = value;
                updateUrl();
                refreshDashboard();
            });
        }

        // Date range edit button
        const dateEditBtn = document.getElementById('date-range-edit');
        if (dateEditBtn) {
            dateEditBtn.addEventListener('click', () => {
                DatePicker.open(handleCustomDateRange, AppState.customRange);
            });
        }

        // Newsletter dropdown
        const newsletterDropdown = document.getElementById('newsletter-dropdown');
        if (newsletterDropdown) {
            newsletterDropdown.addEventListener('dropdown:change', (e) => {
                console.log('Newsletter changed:', e.detail.value);
            });
        }

        // Chart period toggles (Weekly/Monthly) — keep all in sync
        document.querySelectorAll('.chart-container .pill-toggle').forEach(toggle => {
            toggle.addEventListener('toggle:change', (e) => {
                AppState.chartPeriod = e.detail.value;

                // Visually sync ALL chart period toggles to the same value
                document.querySelectorAll('.chart-container .pill-toggle').forEach(otherToggle => {
                    otherToggle.querySelectorAll('.pill-toggle__item').forEach(btn => {
                        const btnValue = btn.dataset.period || btn.dataset.range;
                        if (btnValue === e.detail.value) {
                            btn.classList.add('is-active');
                            btn.setAttribute('aria-selected', 'true');
                        } else {
                            btn.classList.remove('is-active');
                            btn.setAttribute('aria-selected', 'false');
                        }
                    });
                });

                updateUrl();
                refreshDashboard();
            });
        });

        // Window resize handler for responsive charts
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                Components.KPICards.init();
                Components.HeroMetric.init();
            }, 250);
        });

        // Section tabs (Overview / Engagement / Growth)
        const sectionTabs = document.getElementById('section-tabs');
        if (sectionTabs) {
            sectionTabs.addEventListener('click', (e) => {
                const btn = e.target.closest('.section-tabs__item');
                if (!btn || btn.classList.contains('is-active')) return;

                const tabName = btn.dataset.tab;

                // Update active tab button
                sectionTabs.querySelectorAll('.section-tabs__item').forEach(t => t.classList.remove('is-active'));
                btn.classList.add('is-active');

                // Update active tab panel
                document.querySelectorAll('.tab-panel').forEach(panel => {
                    panel.classList.remove('tab-panel--active');
                });
                const targetPanel = document.getElementById('tab-' + tabName);
                if (targetPanel) {
                    targetPanel.classList.add('tab-panel--active');
                }

                // Re-render charts for the newly visible tab (Chart.js needs visible canvas)
                if (tabName === 'engagement') {
                    Charts.renderEngagementCharts();
                } else if (tabName === 'growth') {
                    Charts.renderGrowthChart();
                    if (Charts.renderAudienceChart) Charts.renderAudienceChart();
                } else if (tabName === 'overview') {
                    Charts.renderPerformanceChart();
                }
            });
        }

        // Mobile navigation handlers
        setupMobileNav();
    }

    /**
     * Setup mobile bottom navigation handlers
     */
    function setupMobileNav() {
        const mobileExport = document.getElementById('mobile-nav-export');
        const mobileImport = document.getElementById('mobile-nav-import');
        const mobileTheme = document.getElementById('mobile-nav-theme');

        if (mobileExport) {
            mobileExport.addEventListener('click', () => ExportModal.open());
        }

        if (mobileImport) {
            mobileImport.addEventListener('click', () => ImportModal.open());
        }

        if (mobileTheme) {
            mobileTheme.addEventListener('click', () => {
                ThemeManager.toggle();
                updateMobileThemeIcon();
            });
        }

        // Initial theme icon update
        updateMobileThemeIcon();
    }

    /**
     * Update mobile nav theme icon based on current theme
     */
    function updateMobileThemeIcon() {
        const themeBtn = document.getElementById('mobile-nav-theme');
        if (!themeBtn) return;

        const icon = themeBtn.querySelector('.mobile-nav__icon');
        const label = themeBtn.querySelector('.mobile-nav__label');
        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

        if (icon) icon.textContent = isDark ? '☀️' : '🌙';
        if (label) label.textContent = isDark ? 'Light' : 'Dark';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BEEHIIV API SYNC
    // ─────────────────────────────────────────────────────────────────────────

    async function handleBeehiivSync() {
        const syncBtn = document.getElementById('beehiiv-sync-btn');
        const syncIcon = document.getElementById('beehiiv-sync-icon');
        const syncLabel = document.getElementById('beehiiv-sync-label');

        if (!syncBtn || syncBtn.disabled) return;

        const newsletter = NewsletterManager.getActive();
        if (!newsletter) {
            console.warn('No active newsletter to sync');
            return;
        }

        // Show loading state
        syncBtn.disabled = true;
        syncBtn.classList.add('is-syncing');
        if (syncIcon) syncIcon.textContent = '⏳';
        if (syncLabel) syncLabel.textContent = 'Syncing…';

        try {
            console.log(`🔄 Syncing "${newsletter.name}" from Beehiiv API…`);

            const result = await BeehiivAPI.sync(newsletter.id);

            // Log any warnings
            if (result.warnings && result.warnings.length > 0) {
                console.warn('Beehiiv sync warnings:', result.warnings);
            }

            // Store using the same path as XLSX import
            NewsletterManager.setXLSXData(newsletter.id, {
                posts: result.posts,
                growth: result.growth,
                audience: result.audience,
                lastUpdated: result.lastUpdated
            });

            // Refresh dashboard
            refreshDashboard();

            // Show success
            if (syncIcon) syncIcon.textContent = '✅';
            if (syncLabel) syncLabel.textContent = `${result.posts.length} posts`;
            console.log(`✅ Synced ${result.posts.length} posts, ${result.audience[0]?.activeSubscribers?.toLocaleString() || 0} subscribers`);

            // Reset button after 3 seconds
            setTimeout(() => {
                if (syncIcon) syncIcon.textContent = '🔄';
                if (syncLabel) syncLabel.textContent = 'Sync';
                syncBtn.disabled = false;
                syncBtn.classList.remove('is-syncing');
            }, 3000);

        } catch (error) {
            console.error('Beehiiv sync failed:', error);

            // Show error state
            if (syncIcon) syncIcon.textContent = '❌';
            if (syncLabel) syncLabel.textContent = 'Failed';

            // Reset after 3 seconds
            setTimeout(() => {
                if (syncIcon) syncIcon.textContent = '🔄';
                if (syncLabel) syncLabel.textContent = 'Sync';
                syncBtn.disabled = false;
                syncBtn.classList.remove('is-syncing');
            }, 3000);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CUSTOM DATE RANGE HANDLING
    // ─────────────────────────────────────────────────────────────────────────

    function handleCustomDateRange({ startDate, endDate }) {
        console.log('📅 Custom date range selected:', startDate, '-', endDate);

        AppState.dateRange = 'custom';
        AppState.customRange = { startDate, endDate };

        // Update the pill toggle to show custom is selected
        const dateToggle = document.getElementById('date-range-toggle');
        if (dateToggle) {
            Components.PillToggle.setValue(dateToggle, 'custom');
        }

        // Show and update the date range display
        updateDateRangeDisplay();

        updateUrl();
        refreshDashboard();
    }

    /**
     * Show/hide the date range display based on current state
     * Also updates chart period toggles
     */
    function updateDateRangeDisplay() {
        const display = document.getElementById('date-range-display');
        const text = document.getElementById('date-range-text');

        if (!display || !text) return;

        if (AppState.dateRange === 'custom' && AppState.customRange) {
            const start = formatDisplayDate(AppState.customRange.startDate);
            const end = formatDisplayDate(AppState.customRange.endDate);
            const rangeText = `${start} — ${end}`;
            text.textContent = rangeText;
            display.style.display = 'flex';

            // Update chart period toggles to show Custom
            updateChartPeriodToggles(true, rangeText);
        } else {
            display.style.display = 'none';

            // Hide Custom option from chart period toggles
            updateChartPeriodToggles(false);
        }
    }

    /**
     * Update the chart period toggles to show/hide Custom option
     * @param {boolean} showCustom - Whether to show the custom option
     * @param {string} rangeText - The date range text to display
     */
    function updateChartPeriodToggles(showCustom, rangeText = '') {
        const chartToggles = document.querySelectorAll('.chart-period-toggle');

        chartToggles.forEach(toggle => {
            const customBtn = toggle.querySelector('[data-period="custom"]');
            const weeklyBtn = toggle.querySelector('[data-period="weekly"]');
            const monthlyBtn = toggle.querySelector('[data-period="monthly"]');

            if (!customBtn) return;

            if (showCustom) {
                // Show custom button with date range
                customBtn.textContent = rangeText;
                customBtn.style.display = '';

                // Select custom and deselect others
                customBtn.classList.add('is-active');
                weeklyBtn?.classList.remove('is-active');
                monthlyBtn?.classList.remove('is-active');
            } else {
                // Hide custom button
                customBtn.style.display = 'none';
                customBtn.classList.remove('is-active');

                // Restore selection based on current state
                Components.PillToggle.setValue(toggle, AppState.chartPeriod);
            }
        });
    }

    /**
     * Format a date for display
     */
    function formatDisplayDate(date) {
        const d = new Date(date);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DATA LOADING
    // ─────────────────────────────────────────────────────────────────────────

    function loadImportedData() {
        const newsletter = NewsletterManager.getActive();
        if (!newsletter) return;

        // Check for XLSX data first (Mariana Protocol)
        const xlsxData = NewsletterManager.getXLSXData(newsletter.id);
        if (xlsxData) {
            console.log('📊 Loading XLSX data for', newsletter.name);
            updateDashboardWithXLSXData(xlsxData);
            return;
        }

        // Fallback to legacy CSV data
        const data = NewsletterManager.getData(newsletter.id);
        if (data) {
            console.log('📈 Loading CSV data for', newsletter.name);
            updateDashboardWithData(data);
        }
    }

    function updateDashboardWithData(data) {
        // Update KPI values in DOM
        if (data.current) {
            updateKPIDisplay(data.current, data.deltas);
        }

        // Update charts with new time series
        if (data.timeSeries) {
            // Charts will get data from DataService, so we update that
            DataService.setImportedData(data);
        }

        // Load posts into table
        if (data.rawRows && PostsTable) {
            PostsTable.loadData(data.rawRows);
        }

        // Update insight bar with auto-generated insights
        if (data.rawRows && window.InsightEngine && window.InsightBar) {
            const baselines = InsightEngine.calculateAllBaselines(data.rawRows);
            InsightBar.update(data.rawRows, baselines);

            // Store baselines for other components
            AppState.baselines = baselines;

            // Update performance highlights (best/worst, trends)
            if (window.PerformanceHighlights) {
                PerformanceHighlights.update(data.rawRows, baselines);
            }
        }

        // Update last updated indicator
        updateLastUpdated();

        // Refresh all visualizations
        Charts.update(AppState);
        Components.KPICards.init();
        Components.HeroMetric.init();
    }

    /**
     * Update dashboard with XLSX data (Mariana Protocol - 3 separate stores)
     */
    function updateDashboardWithXLSXData(xlsxData) {
        console.log('📊 Updating dashboard with XLSX data (Mariana Protocol)');

        // Store XLSX data in AppState for other components
        AppState.xlsxData = xlsxData;

        // HERO METRIC: Use audience store (Mariana Protocol)
        let latestAudience = 0;
        if (xlsxData.audience && xlsxData.audience.length > 0) {
            latestAudience = XLSXParser.getLatestSubscriberCount(xlsxData.audience) || 0;
            const heroValue = document.getElementById('hero-subscribers');
            if (heroValue && latestAudience) {
                heroValue.textContent = latestAudience.toLocaleString();
            }
        }

        // KPI METRICS: Aggregate from posts store  
        if (xlsxData.posts && xlsxData.posts.length > 0) {
            // Get filtered posts based on current date range
            const filteredPosts = getFilteredPosts(xlsxData.posts);
            const aggregated = XLSXParser.aggregatePosts(filteredPosts);

            // Compute deltas by comparing first half vs second half of data
            const xlsxDeltas = computeXLSXDeltas(filteredPosts, xlsxData.audience);

            // Update KPI cards with values AND deltas
            updateKPIDisplay({
                openRate: aggregated.openRate,
                ctr: aggregated.ctr,
                verifiedCtr: aggregated.verifiedCtr,
                deliveryRate: aggregated.deliveryRate,
                uniqueClicks: aggregated.uniqueClicks,
                verifiedClicks: aggregated.verifiedClicks,
                activeSubscribers: latestAudience
            }, xlsxDeltas);

            // Load posts into table
            if (PostsTable) {
                PostsTable.loadData(filteredPosts);
            }

            // Update insight bar
            if (window.InsightEngine && window.InsightBar) {
                const baselines = InsightEngine.calculateAllBaselines(filteredPosts);
                InsightBar.update(filteredPosts, baselines);
                AppState.baselines = baselines;

                if (window.PerformanceHighlights) {
                    PerformanceHighlights.update(filteredPosts, baselines);
                }
            }
        }

        // Pass all stores to DataService for chart rendering (dates get converted to real Date objects here)
        DataService.setXLSXData(xlsxData);

        // CHARTS: Set date range filter AFTER setXLSXData so dates are properly converted
        const chartEnd = new Date();
        const chartStart = new Date();
        switch (AppState.dateRange) {
            case '30d':
                chartStart.setDate(chartEnd.getDate() - 30);
                DataService.setDateRange(chartStart, chartEnd);
                break;
            case '90d':
                chartStart.setDate(chartEnd.getDate() - 90);
                DataService.setDateRange(chartStart, chartEnd);
                break;
            default:
                DataService.clearDateRange();
        }

        // Update last updated indicator
        updateLastUpdated();

        // Refresh charts with XLSX awareness
        Charts.update({ ...AppState, hasXLSX: true });
        Components.KPICards.init();
        Components.HeroMetric.init();
    }

    /**
     * Filter posts by the current date range state
     */
    function getFilteredPosts(posts) {
        if (!posts || posts.length === 0) return [];

        let startDate, endDate;
        endDate = new Date();
        startDate = new Date();

        switch (AppState.dateRange) {
            case '30d':
                startDate.setDate(endDate.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(endDate.getDate() - 90);
                break;
            default:
                // Return all posts if no range specified
                return posts;
        }

        return XLSXParser.filterByDateRange(posts, startDate, endDate);
    }

    /**
     * Update the "Last Updated" indicator in the header
     */
    function updateLastUpdated() {
        const container = document.getElementById('last-updated');
        const timeEl = document.getElementById('last-updated-time');

        if (!container || !timeEl) return;

        const newsletter = NewsletterManager.getActive();
        if (newsletter) {
            const now = new Date();
            timeEl.textContent = formatRelativeTime(now);
            container.style.display = 'inline';

            // Store timestamp for persistence
            localStorage.setItem(`lastUpdated_${newsletter.id}`, now.toISOString());
        } else {
            container.style.display = 'none';
        }
    }

    /**
     * Format a relative time (e.g., "just now", "5 mins ago")
     */
    function formatRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

        return formatDisplayDate(date);
    }

    /**
     * Compute deltas for XLSX data by comparing first-half vs second-half periods
     */
    function computeXLSXDeltas(posts, audience) {
        const sorted = posts.slice().sort((a, b) => {
            const dA = a.date instanceof Date ? a.date : new Date(a.date);
            const dB = b.date instanceof Date ? b.date : new Date(b.date);
            return dA - dB;
        });

        const mid = Math.floor(sorted.length / 2);
        const firstHalf = sorted.slice(0, mid);
        const secondHalf = sorted.slice(mid);

        const aggFirst = XLSXParser.aggregatePosts(firstHalf);
        const aggSecond = XLSXParser.aggregatePosts(secondHalf);

        function makeDelta(key, isAbsolute) {
            const prev = aggFirst[key] || 0;
            const curr = aggSecond[key] || 0;
            const diff = curr - prev;
            const value = isAbsolute ? diff : (prev ? (diff / prev * 100) : 0);
            return {
                value,
                direction: diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral',
                isAbsolute: !!isAbsolute
            };
        }

        const deltas = {
            openRate: makeDelta('openRate'),
            ctr: makeDelta('ctr'),
            verifiedCtr: makeDelta('verifiedCtr'),
            deliveryRate: makeDelta('deliveryRate'),
            uniqueClicks: makeDelta('uniqueClicks', true),
            verifiedClicks: makeDelta('verifiedClicks', true)
        };

        // Active subscribers delta from audience data
        if (audience && audience.length >= 2) {
            const sortedAud = audience.slice().sort((a, b) => {
                const dA = a.date instanceof Date ? a.date : new Date(a.date);
                const dB = b.date instanceof Date ? b.date : new Date(b.date);
                return dA - dB;
            });
            const earliest = sortedAud[0].activeSubscribers || 0;
            const latest = sortedAud[sortedAud.length - 1].activeSubscribers || 0;
            const diff = latest - earliest;
            deltas.activeSubscribers = {
                value: earliest ? (diff / earliest * 100) : 0,
                direction: diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral',
                isAbsolute: false
            };
        } else {
            deltas.activeSubscribers = { value: 0, direction: 'neutral', isAbsolute: false };
        }

        return deltas;
    }

    function updateKPIDisplay(current, deltas) {
        // Update hero metric
        const heroValue = document.getElementById('hero-subscribers');
        if (heroValue && current.activeSubscribers) {
            heroValue.textContent = Math.round(current.activeSubscribers).toLocaleString();
        }

        // Update hero delta pill and comparison text
        const heroDelta = deltas?.activeSubscribers;
        if (heroDelta) {
            const heroSection = document.querySelector('.hero-metric');
            if (heroSection) {
                const pill = heroSection.querySelector('.delta-pill');
                const comparison = heroSection.querySelector('.hero-metric__comparison');
                if (pill) {
                    updateDeltaPill(pill, heroDelta);
                }
                if (comparison) {
                    if (heroDelta.direction === 'neutral' && heroDelta.value === 0) {
                        comparison.textContent = 'No change vs. previous period';
                    } else {
                        comparison.textContent = 'vs. previous period';
                    }
                }
            }
        }

        // Update KPI cards
        const kpiMap = {
            'Open Rate': { value: current.openRate, delta: deltas?.openRate, format: 'percent' },
            'Click-Through Rate': { value: current.ctr, delta: deltas?.ctr, format: 'percent' },
            'Verified CTR': { value: current.verifiedCtr, delta: deltas?.verifiedCtr, format: 'percent' },
            'Delivery Rate': { value: current.deliveryRate, delta: deltas?.deliveryRate, format: 'percent' },
            'Unique Clicks': { value: current.uniqueClicks, delta: deltas?.uniqueClicks, format: 'number' },
            'Verified Clicks': { value: current.verifiedClicks, delta: deltas?.verifiedClicks, format: 'number' }
        };

        document.querySelectorAll('.kpi-card').forEach(card => {
            const label = card.querySelector('.kpi-card__label')?.textContent;
            const data = kpiMap[label];
            if (data) {
                // Update main value
                const valueEl = card.querySelector('.kpi-card__value');
                if (valueEl) {
                    if (data.value === null || data.value === undefined || isNaN(data.value)) {
                        valueEl.textContent = 'N/A';
                    } else {
                        valueEl.textContent = data.format === 'percent'
                            ? data.value.toFixed(1) + '%'
                            : Math.round(data.value).toLocaleString();
                    }
                }

                // Update delta pill
                const pill = card.querySelector('.delta-pill');
                if (pill && data.delta) {
                    updateDeltaPill(pill, data.delta);
                }
            }
        });
    }

    /**
     * Update a delta pill DOM element with direction + value
     */
    function updateDeltaPill(pillEl, delta) {
        // Determine direction and class
        const dir = delta.direction || 'neutral';
        pillEl.className = 'delta-pill delta-pill--' + dir;

        // Format the value text
        let text;
        if (delta.isAbsolute) {
            const v = Math.round(delta.value);
            text = (v > 0 ? '+' : '') + v.toLocaleString();
        } else {
            const v = Math.abs(delta.value).toFixed(1);
            text = (delta.value > 0 ? '+' : delta.value < 0 ? '-' : '') + v + '%';
        }

        // Arrow SVG based on direction
        let arrowPath;
        if (dir === 'positive') {
            arrowPath = 'M6 2v8M6 2l3 3M6 2L3 5';  // up arrow
        } else if (dir === 'negative') {
            arrowPath = 'M6 10V2M6 10l3-3M6 10L3 7';  // down arrow
        } else {
            arrowPath = 'M6 2v8';  // neutral vertical line
        }

        pillEl.innerHTML = `
            <svg class="delta-pill__arrow" viewBox="0 0 12 12" width="12" height="12">
                <path d="${arrowPath}" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
            </svg>
            ${text}
        `;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DASHBOARD REFRESH
    // ─────────────────────────────────────────────────────────────────────────

    function refreshDashboard() {
        console.log('🔄 Refreshing dashboard with filters:', AppState);

        const newsletter = NewsletterManager.getActive();
        if (!newsletter) {
            // Use mock data
            Charts.update(AppState);
            Components.KPICards.init();
            Components.HeroMetric.init();
            return;
        }

        // Check for XLSX data first (Mariana Protocol)
        const xlsxData = NewsletterManager.getXLSXData(newsletter.id);
        if (xlsxData) {
            updateDashboardWithXLSXData(xlsxData);
            return;
        }

        // Fallback to legacy CSV data
        const rawData = NewsletterManager.getData(newsletter.id);
        if (rawData && rawData.rawRows) {
            // Re-transform data with current date range filter
            const filterOptions = {
                period: AppState.chartPeriod
            };

            filterOptions.endDate = new Date();
            filterOptions.startDate = new Date();

            switch (AppState.dateRange) {
                case '30d':
                    filterOptions.startDate.setDate(filterOptions.endDate.getDate() - 30);
                    break;
                case '90d':
                    filterOptions.startDate.setDate(filterOptions.endDate.getDate() - 90);
                    break;
            }

            const filteredData = CSVParser.transformToDashboardData(rawData.rawRows, filterOptions);
            console.log('📅 Filtered to', filteredData.rawRows?.length || 0, 'posts in range');
            updateDashboardWithData(filteredData);
        } else if (rawData) {
            updateDashboardWithData(rawData);
        } else {
            // Use mock data
            Charts.update(AppState);
            Components.KPICards.init();
            Components.HeroMetric.init();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DOM READY
    // ─────────────────────────────────────────────────────────────────────────

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose for debugging and external access
    window.Dashboard = {
        state: AppState,
        refresh: refreshDashboard,
        Components,
        Charts,
        DataService,
        NewsletterManager,
        ImportModal,
        AddNewsletterModal,
        ThemeManager,
        DatePicker,
        KPIDetailModal,
        ExportModal,
        PostsTable,
        KeyboardShortcuts
    };

})();

