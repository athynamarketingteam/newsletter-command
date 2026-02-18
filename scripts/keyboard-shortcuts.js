/* ════════════════════════════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS MODULE — Newsletter Analytics Dashboard
   Global keyboard shortcuts for quick navigation
   ════════════════════════════════════════════════════════════════════════════ */

const KeyboardShortcuts = (function () {
    'use strict';

    let helpModal = null;
    let isEnabled = true;

    // ─────────────────────────────────────────────────────────────────────────
    // SHORTCUTS DEFINITION
    // ─────────────────────────────────────────────────────────────────────────

    const shortcuts = {
        '?': { description: 'Show keyboard shortcuts', action: toggleHelp },
        'e': { description: 'Open Export modal', action: () => ExportModal?.open() },
        'i': { description: 'Open Import modal', action: () => ImportModal?.open() },
        't': { description: 'Toggle theme', action: () => ThemeManager?.toggle() },
        '1': { description: 'Switch to 30 days', action: () => setDateRange('30d') },
        '2': { description: 'Switch to 90 days', action: () => setDateRange('90d') },
        'Escape': { description: 'Close any modal', action: closeAllModals }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // INITIALIZATION
    // ─────────────────────────────────────────────────────────────────────────

    function init() {
        helpModal = document.getElementById('shortcuts-modal');

        document.addEventListener('keydown', handleKeyDown);
        console.log('⌨️ KeyboardShortcuts initialized (Press ? for help)');
    }

    function handleKeyDown(e) {
        // Skip if disabled or if user is typing in an input
        if (!isEnabled) return;
        if (isInputFocused()) return;

        const key = e.key;
        const shortcut = shortcuts[key];

        if (shortcut) {
            e.preventDefault();
            shortcut.action();
        }
    }

    function isInputFocused() {
        const active = document.activeElement;
        if (!active) return false;
        const tagName = active.tagName.toLowerCase();
        return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || active.isContentEditable;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTIONS
    // ─────────────────────────────────────────────────────────────────────────

    function toggleHelp() {
        if (helpModal) {
            helpModal.classList.toggle('is-open');
        }
    }

    function closeHelp() {
        if (helpModal) {
            helpModal.classList.remove('is-open');
        }
    }

    function setDateRange(range) {
        const dateToggle = document.getElementById('date-range-toggle');
        if (dateToggle && window.Components?.PillToggle) {
            // If custom, just open the date picker
            if (range === 'custom') {
                DatePicker?.open((dates) => {
                    // Update app state
                    if (window.Dashboard?.state) {
                        window.Dashboard.state.dateRange = 'custom';
                        window.Dashboard.state.customRange = dates;
                    }
                    window.Dashboard?.refresh();
                }, window.Dashboard?.state?.customRange);
            } else {
                // Set the pill toggle value and update state
                Components.PillToggle.setValue(dateToggle, range);
                if (window.Dashboard?.state) {
                    window.Dashboard.state.dateRange = range;
                    window.Dashboard.state.customRange = null;
                }
                window.Dashboard?.refresh();
            }
        }
    }

    function closeAllModals() {
        // Close all modals
        document.querySelectorAll('.modal-overlay.is-open').forEach(modal => {
            modal.classList.remove('is-open');
        });

        // Also close shortcuts help
        closeHelp();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────

    return {
        init,
        enable: () => { isEnabled = true; },
        disable: () => { isEnabled = false; },
        closeHelp,
        shortcuts
    };
})();

// Export for use
window.KeyboardShortcuts = KeyboardShortcuts;
