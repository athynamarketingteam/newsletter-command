/* ════════════════════════════════════════════════════════════════════════════
   PERFORMANCE HIGHLIGHTS — Newsletter Analytics Dashboard
   Shows best/worst performers and trend indicators
   ════════════════════════════════════════════════════════════════════════════ */

const PerformanceHighlights = (function () {
    'use strict';

    let container = null;

    // ─────────────────────────────────────────────────────────────────────────
    // INITIALIZATION
    // ─────────────────────────────────────────────────────────────────────────

    function init() {
        container = document.getElementById('performance-highlights');
        if (!container) {
            console.warn('PerformanceHighlights: container not found');
            return;
        }
        console.log('📊 PerformanceHighlights initialized');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UPDATE
    // ─────────────────────────────────────────────────────────────────────────

    function update(rows, baselines) {
        if (!container || !rows || rows.length === 0) {
            hide();
            return;
        }

        // Get extremes from InsightEngine
        const extremes = window.InsightEngine?.getPerformanceExtremes(rows, 'ctr', 1);
        const trendData = window.InsightEngine?.detectAcceleration(rows, 'ctr');

        if (!extremes) {
            hide();
            return;
        }

        const best = extremes.top[0];
        const worst = extremes.bottom[0];
        const baseline = baselines?.['30d'];

        // Build HTML
        container.innerHTML = `
            <div class="highlights">
                <div class="highlights__section">
                    <h3 class="highlights__title">
                        <span class="highlights__icon">🏆</span>
                        Best Performer
                    </h3>
                    ${renderHighlightCard(best, baseline, 'best')}
                </div>
                
                <div class="highlights__section">
                    <h3 class="highlights__title">
                        <span class="highlights__icon">⚠️</span>
                        Needs Attention
                    </h3>
                    ${renderHighlightCard(worst, baseline, 'worst')}
                </div>
                
                ${trendData ? `
                <div class="highlights__section highlights__section--trend">
                    <h3 class="highlights__title">
                        <span class="highlights__icon">${getTrendIcon(trendData.status)}</span>
                        CTR Trend
                    </h3>
                    ${renderTrendCard(trendData)}
                </div>
                ` : ''}
            </div>
        `;

        container.style.display = 'block';
    }

    function renderHighlightCard(post, baseline, type) {
        if (!post) return '<div class="highlight-card highlight-card--empty">No data available</div>';

        const ctr = post.ctr || post.click_rate || 0;
        const baselineCtr = baseline?.ctr || 0;
        const diff = baselineCtr ? ((ctr - baselineCtr) / baselineCtr * 100) : 0;
        const diffClass = diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral';

        return `
            <div class="highlight-card highlight-card--${type}">
                <div class="highlight-card__title">${escapeHtml(truncate(post.title, 50))}</div>
                <div class="highlight-card__metrics">
                    <div class="highlight-card__metric">
                        <span class="highlight-card__value">${ctr.toFixed(2)}%</span>
                        <span class="highlight-card__label">CTR</span>
                    </div>
                    <div class="highlight-card__comparison highlight-card__comparison--${diffClass}">
                        <span class="highlight-card__delta">${diff > 0 ? '+' : ''}${diff.toFixed(1)}%</span>
                        <span class="highlight-card__baseline">vs 30-day avg</span>
                    </div>
                </div>
                ${post.date ? `<div class="highlight-card__date">${formatDate(post.date)}</div>` : ''}
            </div>
        `;
    }

    function renderTrendCard(trendData) {
        const { status, recent, acceleration } = trendData;

        const statusText = {
            'accelerating': 'Trending Up Faster',
            'decelerating': 'Slowing Down',
            'steady': 'Holding Steady'
        };

        const statusClass = {
            'accelerating': 'positive',
            'decelerating': 'warning',
            'steady': 'neutral'
        };

        return `
            <div class="highlight-card highlight-card--trend">
                <div class="trend-status trend-status--${statusClass[status] || 'neutral'}">
                    <span class="trend-status__arrow">${getTrendArrow(status)}</span>
                    <span class="trend-status__text">${statusText[status] || 'Unknown'}</span>
                </div>
                <div class="trend-detail">
                    <span class="trend-detail__label">7-day momentum:</span>
                    <span class="trend-detail__value trend-detail__value--${recent.direction}">
                        ${recent.direction === 'up' ? '↑' : recent.direction === 'down' ? '↓' : '→'} 
                        ${recent.strength}
                    </span>
                </div>
            </div>
        `;
    }

    function getTrendIcon(status) {
        switch (status) {
            case 'accelerating': return '🚀';
            case 'decelerating': return '📉';
            case 'steady': return '➡️';
            default: return '📊';
        }
    }

    function getTrendArrow(status) {
        switch (status) {
            case 'accelerating': return '⬆️';
            case 'decelerating': return '⬇️';
            case 'steady': return '➡️';
            default: return '•';
        }
    }

    function hide() {
        if (container) {
            container.style.display = 'none';
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UTILITIES
    // ─────────────────────────────────────────────────────────────────────────

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function truncate(str, maxLen) {
        if (!str) return '';
        return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
    }

    function formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────

    return {
        init,
        update,
        hide
    };

})();

window.PerformanceHighlights = PerformanceHighlights;
