/* ════════════════════════════════════════════════════════════════════════════
   ADD NEWSLETTER MODAL — Newsletter Analytics Dashboard
   ════════════════════════════════════════════════════════════════════════════ */

const AddNewsletterModal = (function () {
    'use strict';

    let overlay = null;
    let selectedTheme = 'basilisk';

    function init() {
        overlay = document.getElementById('add-newsletter-modal');
        if (!overlay) return;

        setupThemePicker();
        setupButtons();

        // Populate dropdown with all registered newsletters on page load
        updateDropdown();

        // Setup color swatch picker
        setupColorPicker();
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
        const nameInput = overlay.querySelector('#newsletter-name');
        if (nameInput) nameInput.value = '';
        selectedTheme = 'basilisk';
        updateThemePicker();
        updatePreview();
    }

    function setupThemePicker() {
        const picker = overlay.querySelector('.theme-picker');
        if (!picker) return;

        picker.addEventListener('click', (e) => {
            const option = e.target.closest('.theme-picker__option');
            if (option) {
                selectedTheme = option.dataset.theme;
                updateThemePicker();
                updatePreview();
            }
        });
    }

    function updateThemePicker() {
        const options = overlay.querySelectorAll('.theme-picker__option');
        options.forEach(opt => {
            opt.classList.toggle('is-selected', opt.dataset.theme === selectedTheme);
        });
    }

    function updatePreview() {
        const preview = overlay.querySelector('.preview-card__content');
        const nameInput = overlay.querySelector('#newsletter-name');
        const themes = NewsletterManager.getThemes();
        const theme = themes[selectedTheme];

        if (preview && theme) {
            const name = nameInput?.value || 'New Newsletter';
            preview.innerHTML = `
                <span class="preview-card__icon" style="color: ${theme.primary}">🗞️</span>
                <div>
                    <div class="preview-card__title">${name}</div>
                    <div class="preview-card__subtitle">Newsletter Analytics</div>
                </div>
            `;
        }
    }

    function setupButtons() {
        const cancelBtn = overlay.querySelector('[data-action="cancel"]');
        const createBtn = overlay.querySelector('[data-action="create"]');
        const nameInput = overlay.querySelector('#newsletter-name');

        if (cancelBtn) cancelBtn.addEventListener('click', close);
        if (createBtn) createBtn.addEventListener('click', handleCreate);
        if (nameInput) nameInput.addEventListener('input', updatePreview);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
    }

    function handleCreate() {
        const nameInput = overlay.querySelector('#newsletter-name');
        const name = nameInput?.value?.trim();

        if (!name) {
            nameInput?.focus();
            return;
        }

        const newsletter = NewsletterManager.add({
            name: name,
            theme: selectedTheme
        });

        NewsletterManager.setActive(newsletter.id);
        updateDropdown();
        close();

        // Open import modal to add data
        if (window.ImportModal) {
            setTimeout(() => ImportModal.open(), 300);
        }
    }

    function updateDropdown() {
        const trigger = document.querySelector('#newsletter-dropdown .dropdown__trigger span');
        const menu = document.querySelector('#newsletter-dropdown .dropdown__menu');
        const active = NewsletterManager.getActive();

        if (trigger && active) {
            trigger.textContent = active.name;
        }

        // Update color swatch to match active newsletter
        updateColorSwatch();

        if (menu) {
            const newsletters = NewsletterManager.getAll();
            menu.innerHTML = newsletters.map(n => {
                const isActive = n.id === active?.id;
                return `
                    <div class="dropdown__item-row ${isActive ? 'is-active' : ''}">
                        <button class="dropdown__item" data-newsletter-id="${n.id}">${n.name}</button>
                        <span class="dropdown__delete" data-delete-id="${n.id}" data-is-default="${n.isDefault === true}" title="Remove newsletter">✕</span>
                    </div>`;
            }).join('') + `
                <button class="dropdown__item" data-action="add-newsletter">+ Add Newsletter</button>
            `;

            // Newsletter selection listeners
            menu.querySelectorAll('[data-newsletter-id]').forEach(item => {
                item.addEventListener('click', () => {
                    NewsletterManager.setActive(item.dataset.newsletterId);
                    updateDropdown();
                    if (window.Dashboard) Dashboard.refresh();
                });
            });

            // Delete listeners
            menu.querySelectorAll('.dropdown__delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.deleteId;
                    const nl = NewsletterManager.get(id);
                    if (!nl) return;

                    // Default newsletters can't be removed
                    if (btn.dataset.isDefault === 'true') {
                        alert(`"${nl.name}" is a default newsletter configured in .env and can't be removed from here.`);
                        return;
                    }

                    if (confirm(`Delete "${nl.name}" dashboard? This will remove all imported data.`)) {
                        try {
                            localStorage.removeItem(`newsletter_data_${id}`);
                            localStorage.removeItem(`newsletter_posts_${id}`);
                            localStorage.removeItem(`newsletter_growth_${id}`);
                            localStorage.removeItem(`newsletter_audience_${id}`);
                            localStorage.removeItem(`newsletter_meta_${id}`);
                        } catch (e) { /* ignore */ }

                        NewsletterManager.remove(id);

                        const remaining = NewsletterManager.getAll();
                        if (remaining.length > 0) {
                            NewsletterManager.setActive(remaining[0].id);
                        }

                        updateDropdown();
                        if (window.Dashboard) Dashboard.refresh();
                    }
                });
            });

            menu.querySelector('[data-action="add-newsletter"]')?.addEventListener('click', open);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // COLOR SWATCH PICKER
    // ─────────────────────────────────────────────────────────────────────────

    function setupColorPicker() {
        const swatch = document.getElementById('newsletter-color-swatch');
        const popup = document.getElementById('color-picker-popup');
        const swatchesContainer = document.getElementById('color-picker-swatches');
        const hexInput = document.getElementById('color-picker-hex');
        const applyBtn = document.getElementById('color-picker-apply');

        if (!swatch || !popup) return;

        // Render preset theme swatches
        const themes = NewsletterManager.getThemes();
        if (swatchesContainer) {
            swatchesContainer.innerHTML = Object.entries(themes).map(([key, theme]) =>
                `<button class="color-picker-popup__swatch" data-theme="${key}" 
                    style="--swatch-color: ${theme.primary}" 
                    title="${theme.name}" aria-label="${theme.name} theme"></button>`
            ).join('');

            // Swatch click handler
            swatchesContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('.color-picker-popup__swatch');
                if (!btn) return;
                const themeKey = btn.dataset.theme;
                applyColorToNewsletter(themeKey, null);
                closeColorPicker();
            });
        }

        // Toggle popup on swatch click
        swatch.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = popup.classList.contains('is-open');
            if (isOpen) {
                closeColorPicker();
            } else {
                openColorPicker();
            }
        });

        // Hex input apply
        if (applyBtn && hexInput) {
            applyBtn.addEventListener('click', () => {
                applyHexColor();
            });

            hexInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    applyHexColor();
                }
            });

            // Live validation: only allow hex characters
            hexInput.addEventListener('input', () => {
                hexInput.value = hexInput.value.replace(/[^0-9A-Fa-f]/g, '').substring(0, 6);
            });
        }

        // Close popup on click outside
        document.addEventListener('click', (e) => {
            if (!popup.contains(e.target) && e.target !== swatch) {
                closeColorPicker();
            }
        });

        // Set initial swatch color
        updateColorSwatch();
    }

    function openColorPicker() {
        const popup = document.getElementById('color-picker-popup');
        if (!popup) return;
        popup.classList.add('is-open');

        // Pre-fill hex input with current color
        const active = NewsletterManager.getActive();
        if (active) {
            const themes = NewsletterManager.getThemes();
            const theme = themes[active.theme];
            const color = (active.customColor || (theme && theme.primary) || '#C2EE6B').replace('#', '');
            const hexInput = document.getElementById('color-picker-hex');
            if (hexInput) hexInput.value = color.toUpperCase();

            // Mark selected swatch
            const swatches = popup.querySelectorAll('.color-picker-popup__swatch');
            swatches.forEach(s => {
                s.classList.toggle('is-selected', s.dataset.theme === active.theme && !active.customColor);
            });
        }
    }

    function closeColorPicker() {
        const popup = document.getElementById('color-picker-popup');
        if (popup) popup.classList.remove('is-open');
    }

    function applyHexColor() {
        const hexInput = document.getElementById('color-picker-hex');
        if (!hexInput) return;

        const hex = hexInput.value.trim();
        if (!/^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(hex)) {
            hexInput.style.outline = '2px solid #FF6B6B';
            setTimeout(() => { hexInput.style.outline = ''; }, 1000);
            return;
        }

        const fullHex = hex.length === 3
            ? hex.split('').map(c => c + c).join('')
            : hex;

        applyColorToNewsletter(null, '#' + fullHex.toUpperCase());
        closeColorPicker();
    }

    function applyColorToNewsletter(themeKey, customHex) {
        const active = NewsletterManager.getActive();
        if (!active) return;

        if (themeKey) {
            // Using a preset theme
            NewsletterManager.update(active.id, { theme: themeKey, customColor: null });
            NewsletterManager.applyTheme(themeKey);
        } else if (customHex) {
            // Using a custom hex color — apply it as a custom override
            NewsletterManager.update(active.id, { customColor: customHex });
            applyCustomColor(customHex);
        }

        updateColorSwatch();

        // Refresh charts to pick up new colors
        if (window.Charts) {
            Charts.init();
        }
        if (window.Dashboard) {
            Dashboard.refresh();
        }
    }

    function applyCustomColor(hex) {
        const root = document.documentElement;
        const isLight = root.getAttribute('data-theme') === 'light';

        if (!isLight) {
            root.style.setProperty('--color-primary', hex);
            root.style.setProperty('--color-positive', hex);
            root.style.setProperty('--color-chart-primary', hex);
            root.style.setProperty('--color-surface-border', hex + '26');
            root.style.setProperty('--color-glow', hex + '80');
        }
    }

    function updateColorSwatch() {
        const swatch = document.getElementById('newsletter-color-swatch');
        if (!swatch) return;

        const active = NewsletterManager.getActive();
        if (!active) return;

        let color;
        if (active.customColor) {
            color = active.customColor;
        } else {
            const themes = NewsletterManager.getThemes();
            const theme = themes[active.theme];
            color = theme ? theme.primary : '#C2EE6B';
        }

        swatch.style.background = color;
    }

    return { init, open, close, updateDropdown };
})();

window.AddNewsletterModal = AddNewsletterModal;
