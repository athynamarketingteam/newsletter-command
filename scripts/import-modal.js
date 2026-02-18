/* ════════════════════════════════════════════════════════════════════════════
   IMPORT MODAL — Newsletter Analytics Dashboard
   Supports both XLSX (multi-tab) and CSV (legacy) file formats
   ════════════════════════════════════════════════════════════════════════════ */

const ImportModal = (function () {
    'use strict';

    let overlay = null;
    let currentFile = null;
    let parsedData = null;
    let selectedFormat = 'xlsx'; // Default to XLSX

    function init() {
        overlay = document.getElementById('import-modal');
        if (!overlay) return;

        setupFormatSelector();
        setupDropzone();
        setupButtons();
    }

    function open() {
        if (overlay) {
            overlay.classList.add('is-open');
            reset();
        }
    }

    function close() {
        if (overlay) {
            overlay.classList.remove('is-open');
        }
    }

    function reset() {
        currentFile = null;
        parsedData = null;
        selectedFormat = 'xlsx';

        // Reset format selector
        const formatOptions = overlay.querySelectorAll('.import-format-option');
        formatOptions.forEach(opt => {
            opt.classList.toggle('is-selected', opt.dataset.format === 'xlsx');
        });

        // Hide warnings
        const warnings = overlay.querySelector('#import-warnings');
        if (warnings) {
            warnings.style.display = 'none';
        }

        // Reset dropzone
        updateDropzoneUI();

        // Remove any results
        const results = overlay.querySelector('.import-results');
        if (results) results.remove();

        const success = overlay.querySelector('.import-success');
        if (success) success.remove();
    }

    function setupFormatSelector() {
        const formatOptions = overlay.querySelectorAll('.import-format-option');

        formatOptions.forEach(option => {
            option.addEventListener('click', () => {
                // Update selection
                formatOptions.forEach(opt => opt.classList.remove('is-selected'));
                option.classList.add('is-selected');
                selectedFormat = option.dataset.format;

                // Update dropzone UI and accept attribute
                updateDropzoneUI();

                // Reset file if format changed
                if (currentFile) {
                    currentFile = null;
                    parsedData = null;
                    updateDropzoneUI();
                    const results = overlay.querySelector('.import-results');
                    if (results) results.remove();
                }
            });
        });
    }

    function updateDropzoneUI() {
        const dropzone = overlay.querySelector('.dropzone');
        const input = overlay.querySelector('.dropzone__input');
        if (!dropzone) return;

        dropzone.classList.remove('has-file');

        if (selectedFormat === 'xlsx') {
            dropzone.innerHTML = `
                <div class="dropzone__icon">📊</div>
                <div class="dropzone__text">Drop your Excel file here</div>
                <div class="dropzone__hint">or click to browse • Multi-tab XLSX format</div>
                <input type="file" class="dropzone__input" accept=".xlsx">
            `;
        } else {
            dropzone.innerHTML = `
                <div class="dropzone__icon">📄</div>
                <div class="dropzone__text">Drop your CSV file here</div>
                <div class="dropzone__hint">or click to browse • Beehiiv export format</div>
                <input type="file" class="dropzone__input" accept=".csv">
            `;
        }

        // Re-attach event listener to new input
        const newInput = dropzone.querySelector('.dropzone__input');
        newInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleFile(file);
        });
    }

    function setupDropzone() {
        const dropzone = overlay.querySelector('.dropzone');
        if (!dropzone) return;

        // Prevent duplicate listeners
        if (dropzone._hasListeners) return;
        dropzone._hasListeners = true;

        dropzone.addEventListener('click', (e) => {
            if (dropzone.classList.contains('has-file')) return;
            const input = dropzone.querySelector('.dropzone__input');
            if (input) input.click();
        });

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('is-dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('is-dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('is-dragover');
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
        });
    }

    function setupButtons() {
        const cancelBtns = overlay.querySelectorAll('[data-action="cancel"]');
        const importBtn = overlay.querySelector('[data-action="import"]');

        cancelBtns.forEach(btn => btn.addEventListener('click', close));
        if (importBtn) importBtn.addEventListener('click', handleImport);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
    }

    async function handleFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();

        // Validate file type
        if (selectedFormat === 'xlsx' && ext !== 'xlsx') {
            showError('Please select an XLSX file, or switch to CSV format');
            return;
        }
        if (selectedFormat === 'csv' && ext !== 'csv') {
            showError('Please select a CSV file, or switch to XLSX format');
            return;
        }

        currentFile = file;
        const dropzone = overlay.querySelector('.dropzone');

        dropzone.classList.add('has-file');
        dropzone.innerHTML = `
            <div class="dropzone__file-info">
                <span class="dropzone__file-icon">${selectedFormat === 'xlsx' ? '📊' : '📄'}</span>
                <div>
                    <div class="dropzone__file-name">${file.name}</div>
                    <div class="dropzone__file-size">${formatFileSize(file.size)}</div>
                </div>
            </div>
        `;

        try {
            if (selectedFormat === 'xlsx') {
                // Use XLSX Parser
                const result = await XLSXParser.parseFile(file);
                parsedData = result;

                // Show warnings if any
                showWarnings(result.warnings);

                // Show results
                showXLSXResults(result);
            } else {
                // Use legacy CSV Parser
                const result = await CSVParser.readFile(file);
                parsedData = {
                    posts: result.rows,
                    growth: null,
                    audience: null,
                    warnings: [],
                    success: true,
                    isCSV: true
                };
                showCSVResults(result);
            }
        } catch (e) {
            console.error('Parse error:', e);
            showError(e.message);
        }
    }

    function showWarnings(warnings) {
        const warningsEl = overlay.querySelector('#import-warnings');
        if (!warningsEl) return;

        if (warnings && warnings.length > 0) {
            warningsEl.style.display = 'flex';
            warningsEl.querySelector('.import-warnings__text').innerHTML = warnings.join('<br>');
        } else {
            warningsEl.style.display = 'none';
        }
    }

    function showXLSXResults(result) {
        const existingResults = overlay.querySelector('.import-results');
        if (existingResults) existingResults.remove();

        const postsCount = result.posts?.length || 0;
        const growthCount = result.growth?.length || 0;
        const audienceCount = result.audience?.length || 0;

        const html = `
            <div class="import-results">
                <div class="import-results__title">✓ XLSX parsed successfully</div>
                <div class="import-results__stats">
                    <div class="import-results__stat">
                        <span class="import-results__stat-label">Campaign posts:</span>
                        <span class="import-results__stat-value">${postsCount}</span>
                    </div>
                    <div class="import-results__stat">
                        <span class="import-results__stat-label">Growth months:</span>
                        <span class="import-results__stat-value">${growthCount}</span>
                    </div>
                    <div class="import-results__stat">
                        <span class="import-results__stat-label">Audience records:</span>
                        <span class="import-results__stat-value">${audienceCount}</span>
                    </div>
                    ${result.audience?.length > 0 ? `
                    <div class="import-results__stat">
                        <span class="import-results__stat-label">Active Subscribers:</span>
                        <span class="import-results__stat-value">${XLSXParser.getLatestSubscriberCount(result.audience)?.toLocaleString() || 'N/A'}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;

        const body = overlay.querySelector('.modal__body');
        body.insertAdjacentHTML('beforeend', html);
    }

    function showCSVResults(result) {
        const existingResults = overlay.querySelector('.import-results');
        if (existingResults) existingResults.remove();

        const html = `
            <div class="import-results">
                <div class="import-results__title">✓ CSV parsed successfully</div>
                <div class="import-results__stats">
                    <div class="import-results__stat">
                        <span class="import-results__stat-label">Posts found:</span>
                        <span class="import-results__stat-value">${result.rows.length}</span>
                    </div>
                    <div class="import-results__stat">
                        <span class="import-results__stat-label">Date range:</span>
                        <span class="import-results__stat-value">${getDateRange(result.rows)}</span>
                    </div>
                </div>
            </div>
        `;

        const body = overlay.querySelector('.modal__body');
        body.insertAdjacentHTML('beforeend', html);
    }

    function showError(message) {
        const existingResults = overlay.querySelector('.import-results');
        if (existingResults) existingResults.remove();

        const html = `
            <div class="import-results import-results--error">
                <div class="import-results__title">✗ Import Error</div>
                <div>${message}</div>
            </div>
        `;

        const body = overlay.querySelector('.modal__body');
        body.insertAdjacentHTML('beforeend', html);
    }

    function handleImport() {
        if (!parsedData) {
            showError('No data to import. Please select a file first.');
            return;
        }

        try {
            const newsletter = NewsletterManager.getActive();

            if (parsedData.isCSV) {
                // Legacy CSV import
                const dashboardData = CSVParser.transformToDashboardData(parsedData.posts);
                NewsletterManager.setData(newsletter.id, dashboardData);
            } else {
                // XLSX import: Store 3 separate data sets
                NewsletterManager.setXLSXData(newsletter.id, {
                    posts: parsedData.posts,
                    growth: parsedData.growth,
                    audience: parsedData.audience,
                    lastUpdated: new Date().toISOString()
                });
            }

            // Refresh dashboard with new data
            if (window.Dashboard && window.Dashboard.refresh) {
                window.Dashboard.refresh();
            }

            close();
            console.log('✅ Data imported successfully');
        } catch (e) {
            console.error('Import failed:', e);
            showError(`Import failed: ${e.message}`);
        }
    }

    function getDateRange(rows) {
        if (!rows || rows.length === 0) return 'N/A';
        const dates = rows.filter(r => r.date).map(r => r.date);
        if (dates.length === 0) return 'N/A';
        const min = new Date(Math.min(...dates));
        const max = new Date(Math.max(...dates));
        return `${formatDate(min)} - ${formatDate(max)}`;
    }

    function formatDate(date) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    return { init, open, close };
})();

window.ImportModal = ImportModal;
