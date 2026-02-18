/* ════════════════════════════════════════════════════════════════════════════
   EXPORT MODAL MODULE — Newsletter Analytics Dashboard
   PNG, PDF, and CSV export functionality
   Uses DownloadService for robust file downloads
   ════════════════════════════════════════════════════════════════════════════ */

const ExportModal = (function () {
    'use strict';

    let overlay = null;

    // ─────────────────────────────────────────────────────────────────────────
    // INITIALIZATION
    // ─────────────────────────────────────────────────────────────────────────

    function init() {
        overlay = document.getElementById('export-modal');
        if (!overlay) return;

        setupEventListeners();
        console.log('📦 ExportModal initialized');
    }

    function setupEventListeners() {
        // Close buttons
        const closeButtons = overlay.querySelectorAll('[data-action="cancel"]');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                close();
            });
        });

        // Close on backdrop click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });

        // Export type cards
        const exportCards = overlay.querySelectorAll('.export-card');
        exportCards.forEach(card => {
            card.addEventListener('click', () => handleExport(card.dataset.type));
        });
    }

    function open() {
        if (overlay) {
            overlay.classList.add('is-open');
            resetState();
        }
    }

    function close() {
        if (overlay) {
            overlay.classList.remove('is-open');
        }
    }

    function resetState() {
        // Reset progress bar
        const progress = overlay.querySelector('.export-progress');
        if (progress) progress.style.display = 'none';

        // Reset status text
        const status = overlay.querySelector('.export-status');
        if (status) status.textContent = '';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EXPORT COORDINATOR
    // ─────────────────────────────────────────────────────────────────────────

    async function handleExport(type) {
        const progress = overlay.querySelector('.export-progress');
        const status = overlay.querySelector('.export-status');
        const progressBar = overlay.querySelector('.export-progress__bar');

        // Show progress UI
        if (progress) progress.style.display = 'block';
        if (status) status.textContent = `Preparing ${type.toUpperCase()} export...`;
        if (progressBar) progressBar.style.width = '10%';

        try {
            // Verify dependencies
            if (!window.DownloadService) {
                throw new Error('DownloadService not loaded');
            }

            // Route to specific handler
            switch (type) {
                case 'png':
                    await exportPNG(progressBar, status);
                    break;
                case 'pdf':
                    await exportPDF(progressBar, status);
                    break;
                case 'csv':
                    await exportCSV(progressBar, status);
                    break;
                default:
                    throw new Error(`Unknown export type: ${type}`);
            }

            // Success state
            if (status) status.textContent = '✅ Export complete!';
            if (progressBar) progressBar.style.width = '100%';

            // Auto-close overlay
            setTimeout(() => close(), 1500);

        } catch (error) {
            console.error('Export error:', error);
            if (status) status.textContent = `❌ Export failed: ${error.message}`;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PNG EXPORT
    // ─────────────────────────────────────────────────────────────────────────

    async function exportPNG(progressBar, status) {
        if (status) status.textContent = 'Preparing dashboard for capture...';
        if (progressBar) progressBar.style.width = '20%';

        const dashboard = document.querySelector('.dashboard__content');
        if (!dashboard) throw new Error('Dashboard content not found');

        // Check library
        if (typeof modernScreenshot === 'undefined') {
            throw new Error('modern-screenshot library not loaded');
        }

        if (progressBar) progressBar.style.width = '40%';
        if (status) status.textContent = 'Capturing dashboard...';

        // Resolve background color from active theme
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const bgColor = isLight ? '#F8F5F2' : '#111111';

        // Capture using modern-screenshot (SVG foreignObject = native CSS rendering)
        const dataUrl = await modernScreenshot.domToPng(dashboard, {
            scale: 2,
            backgroundColor: bgColor,
            quality: 1.0,
        });

        if (progressBar) progressBar.style.width = '80%';
        if (status) status.textContent = 'Processing image...';

        // Convert data URL → Blob → Download
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const filename = DownloadService.generateFilename('png');
        DownloadService.downloadBlob(blob, filename);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PDF EXPORT
    // ─────────────────────────────────────────────────────────────────────────

    async function exportPDF(progressBar, status) {
        if (status) status.textContent = 'Preparing dashboard capture...';
        if (progressBar) progressBar.style.width = '20%';

        // Check libraries
        if (typeof modernScreenshot === 'undefined') {
            throw new Error('modern-screenshot library not loaded');
        }
        if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
            throw new Error('jsPDF library not loaded');
        }

        const dashboard = document.querySelector('.dashboard__content');
        if (!dashboard) throw new Error('Dashboard content not found');

        if (progressBar) progressBar.style.width = '40%';
        if (status) status.textContent = 'Capturing dashboard...';

        // Resolve background color from active theme
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const bgColor = isLight ? '#F8F5F2' : '#111111';

        // Capture the entire dashboard as a high-res image (same as PNG export)
        const dataUrl = await modernScreenshot.domToPng(dashboard, {
            scale: 2,
            backgroundColor: bgColor,
            quality: 1.0,
        });

        if (progressBar) progressBar.style.width = '60%';
        if (status) status.textContent = 'Building PDF pages...';

        // Load image to get dimensions
        const img = new Image();
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error('Failed to load captured image'));
            img.src = dataUrl;
        });

        // Set up PDF in landscape to better fit the wide dashboard
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4'); // landscape
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 8;
        const usableWidth = pageWidth - (margin * 2);
        const usableHeight = pageHeight - (margin * 2);

        // Calculate image dimensions to fit page width
        const imgAspect = img.height / img.width;
        const pdfImgWidth = usableWidth;
        const pdfImgFullHeight = pdfImgWidth * imgAspect;

        // If the image fits on one page, just place it
        if (pdfImgFullHeight <= usableHeight) {
            doc.addImage(dataUrl, 'PNG', margin, margin, pdfImgWidth, pdfImgFullHeight);
        } else {
            // Slice the image across multiple pages using a canvas
            const sliceCanvas = document.createElement('canvas');
            const sliceCtx = sliceCanvas.getContext('2d');
            const pixelsPerPage = (usableHeight / pdfImgFullHeight) * img.height;

            sliceCanvas.width = img.width;
            let srcY = 0;
            let pageNum = 0;

            while (srcY < img.height) {
                const sliceHeight = Math.min(pixelsPerPage, img.height - srcY);
                sliceCanvas.height = sliceHeight;
                sliceCtx.drawImage(img, 0, srcY, img.width, sliceHeight, 0, 0, img.width, sliceHeight);

                const sliceData = sliceCanvas.toDataURL('image/png');
                const slicePdfHeight = (sliceHeight / img.height) * pdfImgFullHeight;

                if (pageNum > 0) doc.addPage();
                doc.addImage(sliceData, 'PNG', margin, margin, pdfImgWidth, slicePdfHeight);

                srcY += sliceHeight;
                pageNum++;
            }
        }

        if (progressBar) progressBar.style.width = '90%';
        if (status) status.textContent = 'Finalizing PDF...';

        // Download
        const filename = DownloadService.generateFilename('pdf');
        doc.save(filename);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CSV EXPORT
    // ─────────────────────────────────────────────────────────────────────────

    async function exportCSV(progressBar, status) {
        if (status) status.textContent = 'Preparing data...';
        if (progressBar) progressBar.style.width = '30%';

        const newsletter = window.NewsletterManager?.getActive();
        if (!newsletter) throw new Error('No newsletter selected');

        const data = window.NewsletterManager.getData(newsletter.id);
        if (!data || !data.rawRows || data.rawRows.length === 0) {
            throw new Error('No data available to export');
        }

        if (progressBar) progressBar.style.width = '60%';
        if (status) status.textContent = 'Formatting CSV...';

        // Extract headers
        const headers = Object.keys(data.rawRows[0]);

        // Build CSV Content
        // Add Byte Order Mark (BOM) for Excel UTF-8 compatibility
        let csvContent = '\uFEFF';

        // Header Row
        csvContent += headers.join(',') + '\n';

        // Data Rows
        data.rawRows.forEach(row => {
            const rowLine = headers.map(header => {
                let cell = row[header] === null || row[header] === undefined ? '' : String(row[header]);

                // Escape quotes (DOUBLE double quotes)
                cell = cell.replace(/"/g, '""');

                // Wrap in quotes if contains comma, quote, or newline
                if (cell.search(/("|,|\n)/g) >= 0) {
                    cell = `"${cell}"`;
                }
                return cell;
            }).join(',');

            csvContent += rowLine + '\n';
        });

        if (progressBar) progressBar.style.width = '80%';
        if (status) status.textContent = 'Downloading...';

        // Download via Service
        const filename = DownloadService.generateFilename('csv');
        // MIME type must be plain 'text/csv' - semicolons cause issues in some Chrome versions
        const blob = new Blob([csvContent], { type: 'text/csv' });
        DownloadService.downloadBlob(blob, filename);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DATA HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    function getDateRangeText() {
        const text = document.getElementById('date-range-text');
        return text ? text.textContent : 'Custom Range';
    }

    function getKPIData() {
        const kpis = [];
        // Hero
        const hero = document.getElementById('hero-subscribers');
        if (hero) kpis.push({ label: 'Active Subscribers', value: hero.textContent });

        // Cards
        document.querySelectorAll('.kpi-card').forEach(card => {
            const label = card.querySelector('.kpi-card__label');
            const value = card.querySelector('.kpi-card__value');
            if (label && value) {
                kpis.push({ label: label.textContent, value: value.textContent });
            }
        });
        return kpis;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────

    return {
        init,
        open,
        close
    };

})();

window.ExportModal = ExportModal;
