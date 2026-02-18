/* ════════════════════════════════════════════════════════════════════════════
   DOWNLOAD SERVICE
   Multiple fallback strategies for cross-browser file downloads
   ════════════════════════════════════════════════════════════════════════════ */

const DownloadService = (function () {
    'use strict';

    /**
     * Downloads a Blob with explicit filename
     * Uses multiple fallback strategies for maximum compatibility
     * 
     * @param {Blob} blob - The data to download
     * @param {string} filename - The desired filename WITH extension
     */
    function downloadBlob(blob, filename) {
        if (!blob) {
            console.error('DownloadService: No blob provided');
            return;
        }

        console.log('--- DOWNLOAD SERVICE ---');
        console.log('Filename:', filename);
        console.log('Blob size:', blob.size);
        console.log('Blob type:', blob.type);

        // Strategy 1: Try FileSaver.js if available
        if (typeof saveAs === 'function') {
            console.log('Using FileSaver.js saveAs()');
            try {
                saveAs(blob, filename);
                return;
            } catch (e) {
                console.warn('FileSaver.js failed:', e);
            }
        }

        // Strategy 2: Native anchor download with forced click
        console.log('Using native anchor download');
        nativeDownload(blob, filename);
    }

    /**
     * Native download using anchor element
     * Force immediate cleanup to avoid Chrome's download manager issues
     */
    function nativeDownload(blob, filename) {
        // Create a new blob with octet-stream to force download
        const downloadBlob = new Blob([blob], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(downloadBlob);

        // Create and configure anchor
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;

        // Force the download attribute
        a.setAttribute('download', filename);

        // Add to body (required for Firefox)
        document.body.appendChild(a);

        // Trigger click
        a.click();

        // Cleanup immediately
        document.body.removeChild(a);

        // Revoke URL after a delay
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 60000);
    }

    /**
     * Generates a standard filename
     */
    function generateFilename(extension) {
        const newsletter = window.NewsletterManager?.getActive();
        const rawName = newsletter?.name || 'newsletter-analytics';

        // Very strict sanitization - only alphanumeric and hyphens
        const safeName = rawName
            .replace(/[^a-zA-Z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .toLowerCase()
            .substring(0, 50);

        const date = new Date().toISOString().split('T')[0];
        return `${safeName}-${date}.${extension}`;
    }

    return {
        downloadBlob,
        generateFilename
    };

})();

window.DownloadService = DownloadService;
