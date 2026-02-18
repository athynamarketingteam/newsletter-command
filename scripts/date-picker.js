/* ════════════════════════════════════════════════════════════════════════════
   DATE PICKER — Newsletter Analytics Dashboard
   Custom date range picker with calendar UI
   ════════════════════════════════════════════════════════════════════════════ */

const DatePicker = (function () {
    'use strict';

    let overlay = null;
    let startDate = null;
    let endDate = null;
    let selectingEnd = false;
    let currentMonth = new Date();
    let onSelect = null;

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    // ─────────────────────────────────────────────────────────────────────────
    // INITIALIZATION
    // ─────────────────────────────────────────────────────────────────────────

    function init() {
        overlay = document.getElementById('date-picker-modal');
        if (!overlay) return;

        setupButtons();
        setupPresets();
    }

    /**
     * Open the date picker modal
     * @param {Function} callback - Called when range is applied
     * @param {Object} existingRange - Optional existing range to restore
     */
    function open(callback, existingRange = null) {
        if (!overlay) return;

        onSelect = callback;

        // Use existing range if provided, otherwise default to last 30 days
        if (existingRange && existingRange.startDate && existingRange.endDate) {
            startDate = new Date(existingRange.startDate);
            endDate = new Date(existingRange.endDate);
        } else if (!startDate || !endDate) {
            // Only set defaults if no range exists
            endDate = new Date();
            startDate = new Date();
            startDate.setDate(endDate.getDate() - 30);
        }

        selectingEnd = false;
        currentMonth = new Date(startDate);

        renderCalendars();
        updateSummary();
        overlay.classList.add('is-open');
    }

    function close() {
        if (overlay) {
            overlay.classList.remove('is-open');
        }
    }

    /**
     * Get the currently selected range
     * @returns {Object|null} { startDate, endDate } or null
     */
    function getCurrentRange() {
        if (startDate && endDate) {
            return { startDate: new Date(startDate), endDate: new Date(endDate) };
        }
        return null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CALENDAR RENDERING
    // ─────────────────────────────────────────────────────────────────────────

    function renderCalendars() {
        const container = overlay.querySelector('.date-picker__calendars');
        if (!container) return;

        const leftMonth = new Date(currentMonth);
        const rightMonth = new Date(currentMonth);
        rightMonth.setMonth(rightMonth.getMonth() + 1);

        container.innerHTML = `
            <div class="calendar" data-offset="0">
                ${renderCalendarMonth(leftMonth)}
            </div>
            <div class="calendar" data-offset="1">
                ${renderCalendarMonth(rightMonth)}
            </div>
        `;

        // Add click handlers for days
        container.querySelectorAll('.calendar__day:not(.calendar__day--disabled)').forEach(day => {
            day.addEventListener('click', () => handleDayClick(day));
        });

        // Navigation
        const prevBtn = overlay.querySelector('[data-nav="prev"]');
        const nextBtn = overlay.querySelector('[data-nav="next"]');

        if (prevBtn) {
            prevBtn.onclick = () => {
                currentMonth.setMonth(currentMonth.getMonth() - 1);
                renderCalendars();
            };
        }
        if (nextBtn) {
            nextBtn.onclick = () => {
                currentMonth.setMonth(currentMonth.getMonth() + 1);
                renderCalendars();
            };
        }
    }

    function renderCalendarMonth(date) {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startPad = firstDay.getDay();
        const today = new Date();

        let html = `
            <div class="calendar__header">
                <span class="calendar__month-name">${MONTHS[month]} ${year}</span>
            </div>
            <div class="calendar__days-header">
                ${DAYS.map(d => `<span>${d}</span>`).join('')}
            </div>
            <div class="calendar__days">
        `;

        // Empty days for padding
        for (let i = 0; i < startPad; i++) {
            html += `<span class="calendar__day calendar__day--empty"></span>`;
        }

        // Days of month
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const current = new Date(year, month, day);
            const isToday = isSameDay(current, today);
            const isStart = startDate && isSameDay(current, startDate);
            const isEnd = endDate && isSameDay(current, endDate);
            const isInRange = isDateInRange(current);
            const isFuture = current > today;

            let classes = ['calendar__day'];
            if (isToday) classes.push('calendar__day--today');
            if (isStart) classes.push('calendar__day--start');
            if (isEnd) classes.push('calendar__day--end');
            if (isInRange && !isStart && !isEnd) classes.push('calendar__day--in-range');
            if (isFuture) classes.push('calendar__day--disabled');

            html += `<span class="${classes.join(' ')}" data-date="${current.toISOString()}">${day}</span>`;
        }

        html += '</div>';
        return html;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DATE SELECTION
    // ─────────────────────────────────────────────────────────────────────────

    function handleDayClick(dayEl) {
        const dateStr = dayEl.dataset.date;
        if (!dateStr) return;

        const clicked = new Date(dateStr);

        if (!selectingEnd || clicked < startDate) {
            // Selecting start date
            startDate = clicked;
            endDate = null;
            selectingEnd = true;
        } else {
            // Selecting end date
            endDate = clicked;
            selectingEnd = false;
        }

        renderCalendars();
        updateSummary();
    }

    function setRange(start, end) {
        startDate = new Date(start);
        endDate = new Date(end);
        currentMonth = new Date(startDate);
        renderCalendars();
        updateSummary();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRESET BUTTONS
    // ─────────────────────────────────────────────────────────────────────────

    function setupPresets() {
        const presets = overlay.querySelectorAll('[data-preset]');
        presets.forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.dataset.preset;
                const today = new Date();
                today.setHours(23, 59, 59, 999);

                let start = new Date(today);

                switch (preset) {
                    case '7d':
                        start.setDate(today.getDate() - 7);
                        break;
                    case '30d':
                        start.setDate(today.getDate() - 30);
                        break;
                    case '90d':
                        start.setDate(today.getDate() - 90);
                        break;
                    case 'month':
                        start = new Date(today.getFullYear(), today.getMonth(), 1);
                        break;
                    case 'ytd':
                        start = new Date(today.getFullYear(), 0, 1);
                        break;
                }

                setRange(start, today);
            });
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UI UPDATES
    // ─────────────────────────────────────────────────────────────────────────

    function updateSummary() {
        const summary = overlay.querySelector('.date-picker__summary');
        if (!summary) return;

        if (startDate && endDate) {
            const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
            summary.textContent = `${formatDate(startDate)} - ${formatDate(endDate)} (${days} days)`;
        } else if (startDate) {
            summary.textContent = `${formatDate(startDate)} - Select end date`;
        } else {
            summary.textContent = 'Select a date range';
        }
    }

    function setupButtons() {
        if (!overlay) return;

        // Select buttons specifically within the date-picker-modal
        const cancelBtns = overlay.querySelectorAll('[data-action="cancel"]');
        const applyBtn = overlay.querySelector('[data-action="apply"]');

        // Attach close handler to all cancel buttons (X button + Cancel button)
        cancelBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                close();
            });
        });

        // Attach apply handler
        if (applyBtn) {
            applyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleApply();
            });
        }

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
    }

    function handleApply() {
        // Close modal FIRST, before triggering any callbacks
        close();

        // Then trigger the callback to update the dashboard
        if (startDate && endDate && onSelect) {
            onSelect({ startDate, endDate });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UTILITIES
    // ─────────────────────────────────────────────────────────────────────────

    function isSameDay(a, b) {
        return a.getDate() === b.getDate() &&
            a.getMonth() === b.getMonth() &&
            a.getFullYear() === b.getFullYear();
    }

    function isDateInRange(date) {
        if (!startDate || !endDate) return false;
        return date >= startDate && date <= endDate;
    }

    function formatDate(date) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────

    return {
        init,
        open,
        close,
        setRange,
        getCurrentRange
    };
})();

window.DatePicker = DatePicker;
