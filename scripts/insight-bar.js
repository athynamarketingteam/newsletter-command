/* ════════════════════════════════════════════════════════════════════════════
   INSIGHT BAR — Newsletter Analytics Dashboard
   Displays auto-generated insights at the top of the dashboard
   ════════════════════════════════════════════════════════════════════════════ */

const InsightBar = (function () {
    'use strict';

    let container = null;
    let currentInsight = null;

    // ─────────────────────────────────────────────────────────────────────────
    // INITIALIZATION
    // ─────────────────────────────────────────────────────────────────────────

    function init() {
        container = document.getElementById('insight-bar');
        if (!container) {
            console.warn('InsightBar: #insight-bar container not found');
            return;
        }

        // Initial state
        render({
            text: 'Import data to see insights',
            type: 'neutral',
            icon: '📊'
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDERING
    // ─────────────────────────────────────────────────────────────────────────

    function render(insight) {
        if (!container) return;

        currentInsight = insight;

        const typeClass = `insight-bar--${insight.type || 'neutral'}`;

        container.className = `insight-bar ${typeClass}`;
        container.innerHTML = `
            <span class="insight-bar__icon">${insight.icon || '📊'}</span>
            <span class="insight-bar__text">${insight.text}</span>
            ${insight.action ? `
                <button class="insight-bar__action" data-action="${insight.action.id}">
                    ${insight.action.label}
                </button>
            ` : ''}
        `;

        // Show the bar
        container.style.display = 'flex';

        // Setup action handlers
        const actionBtn = container.querySelector('.insight-bar__action');
        if (actionBtn && insight.action?.handler) {
            actionBtn.addEventListener('click', insight.action.handler);
        }
    }

    /**
     * Update insight based on current data
     */
    function update(rows, baselines) {
        if (!InsightEngine) {
            console.warn('InsightBar: InsightEngine not available');
            return;
        }

        const insight = InsightEngine.generatePrimaryInsight(rows, baselines);
        render(insight);
    }

    /**
     * Show a temporary message
     */
    function showMessage(text, type = 'info', icon = 'ℹ️', duration = 5000) {
        render({ text, type, icon });

        if (duration > 0) {
            setTimeout(() => {
                if (currentInsight?.text === text) {
                    // Restore previous insight or default
                    render(currentInsight || {
                        text: 'Import data to see insights',
                        type: 'neutral',
                        icon: '📊'
                    });
                }
            }, duration);
        }
    }

    /**
     * Hide the insight bar
     */
    function hide() {
        if (container) {
            container.style.display = 'none';
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────

    return {
        init,
        update,
        render,
        showMessage,
        hide
    };

})();

window.InsightBar = InsightBar;
