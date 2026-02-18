/* ════════════════════════════════════════════════════════════════════════════
   POSTS TABLE MODULE — Newsletter Analytics Dashboard
   Searchable, sortable, paginated table for post data
   ════════════════════════════════════════════════════════════════════════════ */

const PostsTable = (function () {
    'use strict';

    let container = null;
    let posts = [];
    let filteredPosts = [];
    let currentPage = 1;
    let pageSize = 10;
    let sortColumn = 'send_date';
    let sortDirection = 'desc';
    let searchQuery = '';

    // ─────────────────────────────────────────────────────────────────────────
    // INITIALIZATION
    // ─────────────────────────────────────────────────────────────────────────

    function init() {
        container = document.getElementById('posts-table-container');
        if (!container) return;

        setupEventListeners();
        console.log('📋 PostsTable initialized');
    }

    function setupEventListeners() {
        // Search input
        const searchInput = document.getElementById('posts-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value.toLowerCase();
                currentPage = 1;
                filterAndRender();
            });
        }

        // Page size selector
        const pageSizeSelect = document.getElementById('posts-page-size');
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', (e) => {
                pageSize = parseInt(e.target.value, 10);
                currentPage = 1;
                render();
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DATA LOADING
    // ─────────────────────────────────────────────────────────────────────────

    function loadData(rawRows) {
        if (!rawRows || rawRows.length === 0) {
            posts = [];
            filteredPosts = [];
            render();
            return;
        }

        // Transform raw rows to table-friendly format
        // CSV parser maps: title, date, sent, delivered, uniqueOpens, uniqueClicks, openRate, ctr
        posts = rawRows.map(row => ({
            id: row.postId || Math.random().toString(36).substr(2, 9),
            title: row.title || 'Untitled',
            send_date: row.date || parseDate(row.send_date),
            recipients: row.delivered || row.sent || 0,
            opens: row.uniqueOpens || 0,
            clicks: row.uniqueClicks || 0,
            open_rate: row.openRate || 0,
            click_rate: row.ctr || 0
        }));

        // Calculate rates if not provided
        posts.forEach(post => {
            if (post.recipients > 0) {
                if (!post.open_rate) post.open_rate = (post.opens / post.recipients) * 100;
                if (!post.click_rate) post.click_rate = (post.clicks / post.recipients) * 100;
            }
        });

        // Calculate CTR rankings (for badge display)
        calculateRankings();

        currentPage = 1;
        filterAndRender();
    }

    function calculateRankings() {
        // Sort by CTR to determine rankings
        const ctrSorted = [...posts]
            .filter(p => p.click_rate > 0)
            .sort((a, b) => b.click_rate - a.click_rate);

        // Assign ranks
        ctrSorted.forEach((post, index) => {
            post.ctr_rank = index + 1;
        });

        // Mark posts with no CTR as unranked
        posts.forEach(p => {
            if (!p.ctr_rank) p.ctr_rank = null;
        });

        // Calculate anomalies (CTR outliers)
        detectAnomalies();
    }

    function detectAnomalies() {
        const ctrValues = posts
            .map(p => p.click_rate)
            .filter(v => typeof v === 'number' && v > 0);

        if (ctrValues.length < 5) return; // Need enough data

        const mean = ctrValues.reduce((a, b) => a + b, 0) / ctrValues.length;
        const variance = ctrValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / ctrValues.length;
        const stdDev = Math.sqrt(variance);

        const threshold = 1.5; // 1.5 standard deviations

        posts.forEach(post => {
            if (typeof post.click_rate !== 'number' || post.click_rate === 0) {
                post.anomaly = null;
                return;
            }

            const zScore = (post.click_rate - mean) / stdDev;
            if (zScore > threshold) {
                post.anomaly = { type: 'high', deviation: ((post.click_rate - mean) / mean * 100).toFixed(0) };
            } else if (zScore < -threshold) {
                post.anomaly = { type: 'low', deviation: ((post.click_rate - mean) / mean * 100).toFixed(0) };
            } else {
                post.anomaly = null;
            }
        });
    }

    function parseDate(dateStr) {
        if (!dateStr) return new Date(0);
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? new Date(0) : d;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FILTERING & SORTING
    // ─────────────────────────────────────────────────────────────────────────

    function filterAndRender() {
        // Apply search filter
        if (searchQuery) {
            filteredPosts = posts.filter(post =>
                post.title.toLowerCase().includes(searchQuery)
            );
        } else {
            filteredPosts = [...posts];
        }

        // Apply sorting
        sortPosts();
        render();
    }

    function sortPosts() {
        filteredPosts.sort((a, b) => {
            let aVal = a[sortColumn];
            let bVal = b[sortColumn];

            // Handle dates
            if (sortColumn === 'send_date') {
                aVal = aVal.getTime();
                bVal = bVal.getTime();
            }

            // Handle strings
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    function handleSort(column) {
        if (sortColumn === column) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortColumn = column;
            sortDirection = 'desc';
        }
        filterAndRender();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDERING
    // ─────────────────────────────────────────────────────────────────────────

    function render() {
        if (!container) return;

        const tableBody = container.querySelector('.posts-table__body');
        const paginationInfo = container.querySelector('.posts-pagination__info');
        const prevBtn = container.querySelector('[data-action="prev"]');
        const nextBtn = container.querySelector('[data-action="next"]');

        if (!tableBody) return;

        // Calculate pagination
        const totalPages = Math.ceil(filteredPosts.length / pageSize);
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, filteredPosts.length);
        const pageData = filteredPosts.slice(startIndex, endIndex);

        // Render table rows
        if (pageData.length === 0) {
            tableBody.innerHTML = `
                <tr class="posts-table__row posts-table__row--empty">
                    <td colspan="6" class="posts-table__cell posts-table__cell--empty">
                        ${posts.length === 0 ? 'No data imported yet. Import a CSV to see posts.' : 'No posts match your search.'}
                    </td>
                </tr>
            `;
        } else {
            tableBody.innerHTML = pageData.map(post => {
                const rowClasses = ['posts-table__row'];
                if (post.ctr_rank && post.ctr_rank <= 3) rowClasses.push('posts-table__row--top');
                if (post.anomaly?.type === 'high') rowClasses.push('posts-table__row--anomaly-high');
                if (post.anomaly?.type === 'low') rowClasses.push('posts-table__row--anomaly-low');

                return `
                <tr class="${rowClasses.join(' ')}">
                    <td class="posts-table__cell posts-table__cell--title">
                        ${getRankBadge(post.ctr_rank)}${escapeHtml(post.title)}
                    </td>
                    <td class="posts-table__cell">${formatDate(post.send_date)}</td>
                    <td class="posts-table__cell posts-table__cell--number">${formatNumber(post.recipients)}</td>
                    <td class="posts-table__cell posts-table__cell--number">${formatNumber(post.opens)} <span class="posts-table__rate">(${safeToFixed(post.open_rate, 1)}%)</span></td>
                    <td class="posts-table__cell posts-table__cell--number">${formatNumber(post.clicks)} <span class="posts-table__rate">(${safeToFixed(post.click_rate, 1)}%)</span></td>
                    <td class="posts-table__cell posts-table__cell--ctr">
                        ${safeToFixed(post.click_rate, 2)}%${getAnomalyFlag(post.anomaly)}
                    </td>
                </tr>
            `;
            }).join('');
        }

        // Update pagination info
        if (paginationInfo) {
            paginationInfo.textContent = `Showing ${startIndex + 1}-${endIndex} of ${filteredPosts.length}`;
        }

        // Update pagination buttons
        if (prevBtn) {
            prevBtn.disabled = currentPage === 1;
            prevBtn.onclick = () => { currentPage--; render(); };
        }
        if (nextBtn) {
            nextBtn.disabled = currentPage >= totalPages;
            nextBtn.onclick = () => { currentPage++; render(); };
        }

        // Update sort indicators
        container.querySelectorAll('.posts-table__header').forEach(th => {
            const column = th.dataset.sort;
            th.classList.remove('posts-table__header--asc', 'posts-table__header--desc');
            if (column === sortColumn) {
                th.classList.add(`posts-table__header--${sortDirection}`);
            }
            th.onclick = () => handleSort(column);
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UTILITIES
    // ─────────────────────────────────────────────────────────────────────────

    function formatDate(date) {
        if (!date || date.getTime() === 0) return '—';
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    function formatNumber(num) {
        if (typeof num !== 'number' || isNaN(num)) return '—';
        return num.toLocaleString();
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function getRankBadge(rank) {
        if (!rank) return '';
        if (rank === 1) return '<span class="rank-badge rank-badge--gold" title="Top CTR">🥇</span>';
        if (rank === 2) return '<span class="rank-badge rank-badge--silver" title="#2 CTR">🥈</span>';
        if (rank === 3) return '<span class="rank-badge rank-badge--bronze" title="#3 CTR">🥉</span>';
        return '';
    }

    function getAnomalyFlag(anomaly) {
        if (!anomaly) return '';
        if (anomaly.type === 'high') {
            return `<span class="anomaly-flag anomaly-flag--high" title="Unusually high (+${anomaly.deviation}% vs avg)">↑ High</span>`;
        }
        if (anomaly.type === 'low') {
            return `<span class="anomaly-flag anomaly-flag--low" title="Unusually low (${anomaly.deviation}% vs avg)">↓ Low</span>`;
        }
        return '';
    }

    function safeToFixed(num, decimals) {
        if (typeof num !== 'number' || isNaN(num)) return '0';
        return num.toFixed(decimals);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────

    return {
        init,
        loadData,
        refresh: filterAndRender
    };
})();

// Export for use
window.PostsTable = PostsTable;
