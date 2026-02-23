/* ════════════════════════════════════════════════════════════════════════════
   NEWSLETTER MANAGER — Newsletter Analytics Dashboard
   Multi-newsletter registry and configuration
   ════════════════════════════════════════════════════════════════════════════ */

const NewsletterManager = (function () {
    'use strict';

    const STORAGE_KEY = 'newsletter_registry';

    // ─────────────────────────────────────────────────────────────────────────
    // DEFAULT THEMES
    // ─────────────────────────────────────────────────────────────────────────

    const THEMES = {
        basilisk: {
            name: 'Basilisk',
            primary: '#C2EE6B',
            background: '#111111',
            accent: '#9B59B6'
        },
        ocean: {
            name: 'Ocean',
            primary: '#00D9FF',
            background: '#0A1929',
            accent: '#2196F3'
        },
        sunset: {
            name: 'Sunset',
            primary: '#FF6B6B',
            background: '#2D1B1B',
            accent: '#FF9800'
        },
        forest: {
            name: 'Forest',
            primary: '#4CAF50',
            background: '#1B2D1B',
            accent: '#8BC34A'
        },
        royal: {
            name: 'Royal',
            primary: '#9C27B0',
            background: '#1A1A2E',
            accent: '#E91E63'
        },
        gold: {
            name: 'Gold',
            primary: '#FFD700',
            background: '#2D2612',
            accent: '#FFA000'
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // STATE
    // ─────────────────────────────────────────────────────────────────────────

    let newsletters = [];
    let activeNewsletterIndex = 0;

    // ─────────────────────────────────────────────────────────────────────────
    // INITIALIZATION
    // ─────────────────────────────────────────────────────────────────────────

    // Default newsletters that ship with the dashboard
    const DEFAULTS = [
        { id: 'roko-basilisk', name: "Roko's Basilisk", theme: 'basilisk' },
        { id: 'memorandum', name: 'Memorandum', theme: 'royal' },
        { id: 'open-source-ceo-by-bill-kerr', name: 'Open Source CEO by Bill Kerr', theme: 'ocean' },
    ];

    function init() {
        load();

        // Ensure all defaults exist (first run or if user cleared storage)
        let changed = false;
        DEFAULTS.forEach(def => {
            const exists = newsletters.some(n =>
                n.id === def.id || n.id.startsWith(def.id)
            );
            if (!exists) {
                newsletters.push({
                    id: def.id,
                    name: def.name,
                    theme: def.theme,
                    isDefault: true,
                    dataSource: { type: 'api' },
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                });
                changed = true;
            }
        });

        if (changed) save();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CRUD OPERATIONS
    // ─────────────────────────────────────────────────────────────────────────

    function add(config) {
        const newsletter = {
            id: generateId(config.name),
            name: config.name,
            theme: config.theme || 'basilisk',
            dataSource: { type: 'csv' },
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            data: null
        };

        newsletters.push(newsletter);
        save();

        return newsletter;
    }

    function update(id, updates) {
        const index = newsletters.findIndex(n => n.id === id);
        if (index === -1) return null;

        newsletters[index] = {
            ...newsletters[index],
            ...updates,
            lastUpdated: new Date().toISOString()
        };

        save();
        return newsletters[index];
    }

    function remove(id) {
        const index = newsletters.findIndex(n => n.id === id);
        if (index === -1) return false;

        newsletters.splice(index, 1);
        save();

        // Adjust active index if needed
        if (activeNewsletterIndex >= newsletters.length) {
            activeNewsletterIndex = Math.max(0, newsletters.length - 1);
        }

        return true;
    }

    function get(id) {
        return newsletters.find(n => n.id === id);
    }

    function getAll() {
        return [...newsletters];
    }

    function getActive() {
        return newsletters[activeNewsletterIndex] || newsletters[0];
    }

    function setActive(id) {
        const index = newsletters.findIndex(n => n.id === id);
        if (index !== -1) {
            activeNewsletterIndex = index;
            save();
            applyTheme(newsletters[index].theme);
            // Apply custom color override if set
            const nl = newsletters[index];
            if (nl.customColor) {
                const root = document.documentElement;
                const isLight = root.getAttribute('data-theme') === 'light';
                if (!isLight) {
                    root.style.setProperty('--color-primary', nl.customColor);
                    root.style.setProperty('--color-positive', nl.customColor);
                    root.style.setProperty('--color-chart-primary', nl.customColor);
                    root.style.setProperty('--color-surface-border', nl.customColor + '26');
                    root.style.setProperty('--color-glow', nl.customColor + '80');
                }
            }
            return newsletters[index];
        }
        return null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DATA MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────

    function setData(id, data) {
        const newsletter = get(id);
        if (!newsletter) return false;

        newsletter.data = data;
        newsletter.dataSource.lastUpdated = new Date().toISOString();
        newsletter.lastUpdated = new Date().toISOString();

        // Store separately due to size
        try {
            localStorage.setItem(`newsletter_data_${id}`, JSON.stringify(data));
        } catch (e) {
            console.warn('Data too large for localStorage, keeping in memory only');
        }

        save();
        return true;
    }

    function getData(id) {
        const newsletter = get(id);
        if (!newsletter) return null;

        // Try to load from storage if not in memory
        if (!newsletter.data) {
            try {
                const stored = localStorage.getItem(`newsletter_data_${id}`);
                if (stored) {
                    newsletter.data = JSON.parse(stored);
                }
            } catch (e) {
                console.warn('Failed to load stored data');
            }
        }

        return newsletter.data;
    }

    /**
     * Store XLSX data with 3 separate stores (Mariana Protocol)
     * @param {string} id - Newsletter ID
     * @param {Object} xlsxData - { posts, growth, audience, lastUpdated }
     */
    function setXLSXData(id, xlsxData) {
        const newsletter = get(id);
        if (!newsletter) return false;

        // Mark as XLSX data source
        newsletter.dataSource = {
            type: 'xlsx',
            lastUpdated: new Date().toISOString()
        };
        newsletter.lastUpdated = new Date().toISOString();

        // Store each data set separately to avoid localStorage limits
        try {
            if (xlsxData.posts) {
                localStorage.setItem(`newsletter_posts_${id}`, JSON.stringify(xlsxData.posts));
            }
            if (xlsxData.growth) {
                localStorage.setItem(`newsletter_growth_${id}`, JSON.stringify(xlsxData.growth));
            }
            if (xlsxData.audience) {
                localStorage.setItem(`newsletter_audience_${id}`, JSON.stringify(xlsxData.audience));
            }

            // Store metadata
            localStorage.setItem(`newsletter_meta_${id}`, JSON.stringify({
                hasData: true,
                hasPosts: !!xlsxData.posts,
                hasGrowth: !!xlsxData.growth,
                hasAudience: !!xlsxData.audience,
                lastUpdated: xlsxData.lastUpdated
            }));
        } catch (e) {
            console.warn('XLSX data too large for localStorage, keeping in memory only');
        }

        // Also keep in memory for immediate access
        newsletter.xlsxData = xlsxData;

        save();
        return true;
    }

    /**
     * Retrieve XLSX data (3 separate stores)
     * @param {string} id - Newsletter ID
     * @returns {Object|null} - { posts, growth, audience } or null
     */
    function getXLSXData(id) {
        const newsletter = get(id);
        if (!newsletter) return null;

        // Return from memory if available
        if (newsletter.xlsxData) {
            return newsletter.xlsxData;
        }

        // Try to load from storage
        try {
            const meta = localStorage.getItem(`newsletter_meta_${id}`);
            if (!meta) return null;

            const metaParsed = JSON.parse(meta);
            if (!metaParsed.hasData) return null;

            const result = {
                posts: null,
                growth: null,
                audience: null,
                lastUpdated: metaParsed.lastUpdated
            };

            if (metaParsed.hasPosts) {
                const posts = localStorage.getItem(`newsletter_posts_${id}`);
                if (posts) {
                    result.posts = JSON.parse(posts);
                    // Rehydrate dates
                    result.posts = result.posts.map(p => ({
                        ...p,
                        date: new Date(p.date)
                    }));
                }
            }

            if (metaParsed.hasGrowth) {
                const growth = localStorage.getItem(`newsletter_growth_${id}`);
                if (growth) {
                    result.growth = JSON.parse(growth);
                    result.growth = result.growth.map(g => ({
                        ...g,
                        date: new Date(g.date)
                    }));
                }
            }

            if (metaParsed.hasAudience) {
                const audience = localStorage.getItem(`newsletter_audience_${id}`);
                if (audience) {
                    result.audience = JSON.parse(audience);
                    result.audience = result.audience.map(a => ({
                        ...a,
                        date: new Date(a.date)
                    }));
                }
            }

            // Cache in memory
            newsletter.xlsxData = result;
            return result;
        } catch (e) {
            console.warn('Failed to load XLSX data:', e);
            return null;
        }
    }

    /**
     * Check if newsletter has XLSX data
     */
    function hasXLSXData(id) {
        const newsletter = get(id);
        if (!newsletter) return false;

        if (newsletter.xlsxData) return true;

        try {
            const meta = localStorage.getItem(`newsletter_meta_${id}`);
            return meta && JSON.parse(meta).hasData;
        } catch (e) {
            return false;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // THEME MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────

    function applyTheme(themeId) {
        const theme = THEMES[themeId];
        if (!theme) return;

        const root = document.documentElement;
        const isLight = root.getAttribute('data-theme') === 'light';

        // In light mode, the CSS [data-theme="light"] rules handle all
        // colors. Only apply inline overrides in dark mode (where the
        // newsletter theme actually dictates the palette).
        if (!isLight) {
            root.style.setProperty('--color-primary', theme.primary);
            // Background comes from CSS tokens — do NOT override via inline style
            // root.style.setProperty('--color-background', theme.background);
            root.style.setProperty('--color-accent-1', theme.accent);

            // Update related colors
            root.style.setProperty('--color-positive', theme.primary);
            root.style.setProperty('--color-chart-primary', theme.primary);
            root.style.setProperty('--color-surface-border', `${theme.primary}26`);
            root.style.setProperty('--color-glow', `${theme.primary}80`);
        } else {
            // Remove any previously set inline overrides so CSS rules take effect
            const props = [
                '--color-primary', '--color-background', '--color-accent-1',
                '--color-positive', '--color-chart-primary',
                '--color-surface-border', '--color-glow'
            ];
            props.forEach(p => root.style.removeProperty(p));
        }
    }

    function getThemes() {
        return { ...THEMES };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PERSISTENCE
    // ─────────────────────────────────────────────────────────────────────────

    function save() {
        try {
            const toStore = newsletters.map(n => ({
                ...n,
                data: undefined // Don't store data in registry
            }));
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                newsletters: toStore,
                activeIndex: activeNewsletterIndex
            }));
        } catch (e) {
            console.error('Failed to save newsletter registry:', e);
        }
    }

    function load() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                newsletters = parsed.newsletters || [];
                activeNewsletterIndex = parsed.activeIndex || 0;
            }
        } catch (e) {
            console.error('Failed to load newsletter registry:', e);
            newsletters = [];
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UTILITIES
    // ─────────────────────────────────────────────────────────────────────────

    function generateId(name) {
        return name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') +
            '-' + Date.now().toString(36);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────

    return {
        init,
        add,
        update,
        remove,
        get,
        getAll,
        getActive,
        setActive,
        setData,
        getData,
        setXLSXData,
        getXLSXData,
        hasXLSXData,
        applyTheme,
        getThemes,
        THEMES
    };
})();

window.NewsletterManager = NewsletterManager;
