/* ════════════════════════════════════════════════════════════════════════════
   COMPONENTS MODULE — Newsletter Analytics Dashboard
   Interactive UI component behaviors
   ════════════════════════════════════════════════════════════════════════════ */

const Components = (function () {
    'use strict';

    // ─────────────────────────────────────────────────────────────────────────
    // DROPDOWN
    // ─────────────────────────────────────────────────────────────────────────

    const Dropdown = {
        init: function (element) {
            if (!element) return;

            const trigger = element.querySelector('.dropdown__trigger');
            const menu = element.querySelector('.dropdown__menu');
            const items = element.querySelectorAll('.dropdown__item');

            // Toggle on trigger click
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = element.classList.contains('is-open');
                this.closeAll();
                if (!isOpen) {
                    element.classList.add('is-open');
                    trigger.setAttribute('aria-expanded', 'true');
                }
            });

            // Handle item selection
            items.forEach(item => {
                if (item.disabled) return;
                item.addEventListener('click', () => {
                    items.forEach(i => i.classList.remove('is-active'));
                    item.classList.add('is-active');
                    trigger.querySelector('span').textContent = item.textContent;
                    element.classList.remove('is-open');
                    trigger.setAttribute('aria-expanded', 'false');

                    // Dispatch custom event
                    element.dispatchEvent(new CustomEvent('dropdown:change', {
                        detail: { value: item.textContent }
                    }));
                });
            });

            // Close on outside click
            document.addEventListener('click', () => this.closeAll());
        },

        closeAll: function () {
            document.querySelectorAll('.dropdown.is-open').forEach(d => {
                d.classList.remove('is-open');
                d.querySelector('.dropdown__trigger').setAttribute('aria-expanded', 'false');
            });
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // PILL TOGGLE
    // ─────────────────────────────────────────────────────────────────────────

    const PillToggle = {
        init: function (element, onChange) {
            if (!element) return;

            const items = element.querySelectorAll('.pill-toggle__item');

            items.forEach(item => {
                item.addEventListener('click', () => {
                    // Update active state
                    items.forEach(i => {
                        i.classList.remove('is-active');
                        i.setAttribute('aria-selected', 'false');
                    });
                    item.classList.add('is-active');
                    item.setAttribute('aria-selected', 'true');

                    // Get value from data attribute
                    const value = item.dataset.range || item.dataset.period;

                    // Dispatch custom event
                    element.dispatchEvent(new CustomEvent('toggle:change', {
                        detail: { value: value }
                    }));

                    // Callback if provided
                    if (typeof onChange === 'function') {
                        onChange(value);
                    }
                });
            });
        },

        getValue: function (element) {
            const active = element.querySelector('.pill-toggle__item.is-active');
            return active ? (active.dataset.range || active.dataset.period) : null;
        },

        setValue: function (element, value) {
            const items = element.querySelectorAll('.pill-toggle__item');
            items.forEach(item => {
                const itemValue = item.dataset.range || item.dataset.period;
                if (itemValue === value) {
                    item.classList.add('is-active');
                    item.setAttribute('aria-selected', 'true');
                } else {
                    item.classList.remove('is-active');
                    item.setAttribute('aria-selected', 'false');
                }
            });
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // SPARKLINE (SVG-based)
    // ─────────────────────────────────────────────────────────────────────────

    const Sparkline = {
        /**
         * Render a sparkline into a container
         * @param {HTMLElement} container - Target container
         * @param {Array} data - Array of numeric values
         * @param {Object} options - { color, showArea, showLastDot }
         */
        render: function (container, data, options = {}) {
            if (!container || !data || !data.length) return;

            const {
                color = getComputedStyle(document.documentElement).getPropertyValue('--color-chart-primary').trim() || '#C2EE6B',
                showArea = true,
                showLastDot = true,
                height = container.offsetHeight || 32,
                width = container.offsetWidth || 120
            } = options;

            // Calculate points
            const min = Math.min(...data);
            const max = Math.max(...data);
            const range = max - min || 1;
            const padding = 4;
            const effectiveHeight = height - padding * 2;
            const effectiveWidth = width - padding * 2;
            const step = data.length > 1 ? effectiveWidth / (data.length - 1) : 0;

            const points = data.map((value, index) => ({
                x: padding + index * step,
                y: padding + effectiveHeight - ((value - min) / range) * effectiveHeight
            }));

            // Build path
            const linePath = points.map((p, i) =>
                `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
            ).join(' ');

            // Area path (close to bottom)
            const areaPath = showArea ?
                `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height - padding} L ${padding} ${height - padding} Z` : '';

            // Last point
            const lastPoint = points[points.length - 1];

            // Generate SVG
            const svg = `
                <svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                    ${showArea ? `<path class="sparkline__area" d="${areaPath}" fill="url(#sparkline-gradient)" />` : ''}
                    <path class="sparkline__line" d="${linePath}" stroke="${color}" />
                    ${showLastDot ? `<circle class="sparkline__dot sparkline__dot--last" cx="${lastPoint.x}" cy="${lastPoint.y}" r="4" fill="${color}" />` : ''}
                </svg>
            `;

            container.innerHTML = svg;
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // KPI CARDS
    // ─────────────────────────────────────────────────────────────────────────

    const KPICards = {
        /**
         * Initialize all KPI cards with sparklines
         */
        init: function () {
            const sparklineContainers = document.querySelectorAll('.kpi-card__sparkline');

            sparklineContainers.forEach(container => {
                const metric = container.dataset.metric;
                if (metric) {
                    // Determine current period from the card's own toggle
                    const card = container.closest('.kpi-card');
                    const toggle = card ? card.querySelector('.kpi-period-toggle') : null;
                    const activeBtn = toggle ? toggle.querySelector('.pill-toggle__item.is-active') : null;
                    const period = activeBtn ? (activeBtn.dataset.period || 'monthly') : 'monthly';

                    const data = DataService.getSparkline(this.metricKeyMap(metric), period);
                    if (data && data.length) {
                        Sparkline.render(container, data, {
                            height: 32,
                            showArea: true
                        });
                    }
                }
            });

            // Wire up per-card period toggles
            this._initKPIToggles();
        },

        /**
         * Initialize per-card M/W period toggles
         */
        _initKPIToggles: function () {
            const self = this;
            document.querySelectorAll('.kpi-period-toggle').forEach(toggle => {
                // Skip if already wired
                if (toggle.dataset.wired) return;
                toggle.dataset.wired = 'true';

                toggle.querySelectorAll('.pill-toggle__item').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation(); // Don't trigger card click / KPI detail modal

                        const period = btn.dataset.period || 'monthly';

                        // Sync ALL KPI toggles (both .kpi-period-toggle and .hero-period-toggle)
                        document.querySelectorAll('.kpi-period-toggle, .hero-period-toggle').forEach(otherToggle => {
                            otherToggle.querySelectorAll('.pill-toggle__item').forEach(b => {
                                if ((b.dataset.period || 'monthly') === period) {
                                    b.classList.add('is-active');
                                    b.setAttribute('aria-selected', 'true');
                                } else {
                                    b.classList.remove('is-active');
                                    b.setAttribute('aria-selected', 'false');
                                }
                            });
                        });

                        // Re-render ALL KPI card sparklines with the new period
                        document.querySelectorAll('.kpi-card__sparkline[data-metric]').forEach(container => {
                            const metric = container.dataset.metric;
                            const data = DataService.getSparkline(self.metricKeyMap(metric), period);
                            if (data && data.length) {
                                Sparkline.render(container, data, {
                                    height: 32,
                                    showArea: true
                                });
                            }
                        });

                        // Also re-render the hero sparkline
                        const heroContainer = document.getElementById('hero-sparkline');
                        if (heroContainer) {
                            const data = DataService.getSparkline('activeSubscribers', period);
                            if (data && data.length) {
                                Sparkline.render(heroContainer, data, {
                                    height: 60,
                                    showArea: true,
                                    showLastDot: true
                                });
                            }
                        }
                    });
                });
            });
        },

        /**
         * Map hyphenated metric names to camelCase keys
         */
        metricKeyMap: function (metric) {
            const map = {
                'open-rate': 'openRate',
                'ctr': 'ctr',
                'verified-ctr': 'verifiedCtr',
                'delivery-rate': 'deliveryRate',
                'unique-clicks': 'uniqueClicks',
                'verified-clicks': 'verifiedClicks'
            };
            return map[metric] || metric;
        },

        /**
         * Update KPI card values
         */
        update: function (kpiData) {
            // Implementation for dynamic updates
            // Would update DOM elements with new values
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // HERO METRIC
    // ─────────────────────────────────────────────────────────────────────────

    const HeroMetric = {
        init: function (period) {
            const sparklineContainer = document.getElementById('hero-sparkline');
            if (sparklineContainer) {
                // Get period from hero toggle if not explicitly provided
                if (!period) {
                    const heroToggle = document.querySelector('.hero-period-toggle');
                    const activeBtn = heroToggle ? heroToggle.querySelector('.pill-toggle__item.is-active') : null;
                    period = activeBtn ? (activeBtn.dataset.period || 'monthly') : 'monthly';
                }
                const data = DataService.getSparkline('activeSubscribers', period);
                Sparkline.render(sparklineContainer, data, {
                    height: 60,
                    showArea: true,
                    showLastDot: true
                });
            }

            // Wire up hero toggle clicks (syncs with KPI toggles)
            this._initHeroToggle();
        },

        _initHeroToggle: function () {
            const heroToggle = document.querySelector('.hero-period-toggle');
            if (!heroToggle || heroToggle.dataset.wired) return;
            heroToggle.dataset.wired = 'true';

            heroToggle.querySelectorAll('.pill-toggle__item').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();

                    const period = btn.dataset.period || 'monthly';

                    // Sync ALL KPI toggles + hero toggle
                    document.querySelectorAll('.kpi-period-toggle, .hero-period-toggle').forEach(otherToggle => {
                        otherToggle.querySelectorAll('.pill-toggle__item').forEach(b => {
                            if ((b.dataset.period || 'monthly') === period) {
                                b.classList.add('is-active');
                                b.setAttribute('aria-selected', 'true');
                            } else {
                                b.classList.remove('is-active');
                                b.setAttribute('aria-selected', 'false');
                            }
                        });
                    });

                    // Re-render hero sparkline
                    const heroContainer = document.getElementById('hero-sparkline');
                    if (heroContainer) {
                        const data = DataService.getSparkline('activeSubscribers', period);
                        if (data && data.length) {
                            Sparkline.render(heroContainer, data, {
                                height: 60,
                                showArea: true,
                                showLastDot: true
                            });
                        }
                    }

                    // Re-render ALL KPI card sparklines
                    document.querySelectorAll('.kpi-card__sparkline[data-metric]').forEach(container => {
                        const metric = container.dataset.metric;
                        const data = DataService.getSparkline(KPICards.metricKeyMap(metric), period);
                        if (data && data.length) {
                            Sparkline.render(container, data, {
                                height: 32,
                                showArea: true
                            });
                        }
                    });
                });
            });
        },

        update: function (value, delta) {
            const valueEl = document.getElementById('hero-subscribers');
            if (valueEl) {
                valueEl.textContent = value.toLocaleString();
            }
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // CHART CONTAINER
    // ─────────────────────────────────────────────────────────────────────────

    const ChartContainer = {
        init: function () {
            document.querySelectorAll('.chart-container__header').forEach(header => {
                header.addEventListener('click', (e) => {
                    // Ignore clicks on buttons/toggles inside the header
                    if (e.target.closest('button') || e.target.closest('.pill-toggle')) {
                        return;
                    }

                    const container = header.closest('.chart-container');
                    if (container) {
                        container.classList.toggle('is-collapsed');
                    }
                });
            });
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────

    return {
        Dropdown,
        PillToggle,
        Sparkline,
        KPICards,
        HeroMetric,
        ChartContainer,

        /**
         * Initialize all components
         */
        initAll: function () {
            // Initialize dropdowns
            document.querySelectorAll('.dropdown').forEach(el => Dropdown.init(el));

            // Initialize pill toggles (exclude KPI card toggles — they have their own handlers)
            document.querySelectorAll('.pill-toggle:not(.kpi-period-toggle):not(.hero-period-toggle)').forEach(el => PillToggle.init(el));

            // Initialize KPI cards
            KPICards.init();

            // Initialize hero metric
            HeroMetric.init();

            // Initialize chart containers (collapsible)
            ChartContainer.init();
        }
    };
})();

// Export for use in other modules
window.Components = Components;
