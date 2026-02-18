/* ════════════════════════════════════════════════════════════════════════════
   THEME MANAGER — Newsletter Analytics Dashboard
   Light/Dark theme switching with persistence
   ════════════════════════════════════════════════════════════════════════════ */

const ThemeManager = (function () {
    'use strict';

    const STORAGE_KEY = 'dashboard_theme';
    let currentTheme = 'dark';

    // ─────────────────────────────────────────────────────────────────────────
    // INITIALIZATION
    // ─────────────────────────────────────────────────────────────────────────

    function init() {
        // Load saved preference
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && (saved === 'light' || saved === 'dark')) {
            currentTheme = saved;
        } else {
            // Check system preference
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
                currentTheme = 'light';
            }
        }

        apply(currentTheme);
        setupToggle();

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem(STORAGE_KEY)) {
                set(e.matches ? 'dark' : 'light');
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // THEME SWITCHING
    // ─────────────────────────────────────────────────────────────────────────

    function set(theme) {
        if (theme !== 'light' && theme !== 'dark') return;
        currentTheme = theme;
        localStorage.setItem(STORAGE_KEY, theme);
        apply(theme);
        updateToggleUI();
    }

    function toggle() {
        set(currentTheme === 'dark' ? 'light' : 'dark');
    }

    function get() {
        return currentTheme;
    }

    function apply(theme) {
        document.documentElement.setAttribute('data-theme', theme);

        // Update meta theme-color for mobile browsers
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            metaTheme.content = theme === 'light' ? '#F6F4F8' : '#111111';
        }

        // Re-apply newsletter theme to handle inline CSS variable overrides
        // In light mode this removes inline overrides; in dark mode it re-sets them
        if (window.NewsletterManager) {
            const active = NewsletterManager.getActive();
            if (active) {
                NewsletterManager.applyTheme(active.theme);
            }
        }

        // Re-render charts with correct theme colors
        if (window.Charts && typeof Charts.init === 'function') {
            setTimeout(() => Charts.init(), 50);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TOGGLE UI
    // ─────────────────────────────────────────────────────────────────────────

    function setupToggle() {
        const toggle = document.getElementById('theme-toggle');
        if (!toggle) return;

        toggle.addEventListener('click', () => {
            ThemeManager.toggle();
        });

        updateToggleUI();
    }

    function updateToggleUI() {
        const toggle = document.getElementById('theme-toggle');
        if (!toggle) return;

        const icon = toggle.querySelector('.theme-toggle__icon');
        const label = toggle.querySelector('.theme-toggle__label');

        if (currentTheme === 'light') {
            if (icon) icon.textContent = '🌙';
            if (label) label.textContent = 'Dark';
            toggle.setAttribute('aria-label', 'Switch to dark mode');
        } else {
            if (icon) icon.textContent = '☀️';
            if (label) label.textContent = 'Light';
            toggle.setAttribute('aria-label', 'Switch to light mode');
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────

    return {
        init,
        set,
        toggle,
        get
    };
})();

window.ThemeManager = ThemeManager;
