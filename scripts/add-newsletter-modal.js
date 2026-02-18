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

    return { init, open, close, updateDropdown };
})();

window.AddNewsletterModal = AddNewsletterModal;
