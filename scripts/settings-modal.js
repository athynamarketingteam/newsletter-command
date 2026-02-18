/* ════════════════════════════════════════════════════════════════════════════
   SETTINGS MODAL — Newsletter Analytics Dashboard
   Publication ID manager for Beehiiv newsletter sync
   ════════════════════════════════════════════════════════════════════════════ */

const SettingsModal = (function () {
    'use strict';

    let overlay = null;
    let listContainer = null;

    function init() {
        overlay = document.getElementById('settings-modal');
        if (!overlay) return;

        listContainer = overlay.querySelector('.settings-newsletter-list');

        // Wire close buttons
        overlay.querySelector('[data-action="close"]')?.addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });

        // Wire the Settings button in the header
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', open);
        }
    }

    function open() {
        if (!overlay) return;
        overlay.classList.add('is-open');
        loadNewsletters();
    }

    function close() {
        if (!overlay) return;
        overlay.classList.remove('is-open');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LOAD NEWSLETTERS FROM SERVER
    // ─────────────────────────────────────────────────────────────────────────

    async function loadNewsletters() {
        if (!listContainer) return;

        listContainer.innerHTML = `
            <div class="settings-loading">
                <span class="settings-loading__spinner">⏳</span>
                <span>Loading newsletters…</span>
            </div>`;

        try {
            // Get server-configured newsletters
            const res = await fetch('/api/settings/newsletters');
            const serverData = res.ok ? await res.json() : { newsletters: [] };
            const serverNewsletters = serverData.newsletters || [];

            // Get client-side newsletters from NewsletterManager
            const clientNewsletters = window.NewsletterManager ? NewsletterManager.getAll() : [];

            // Merge: start with server list, add any client-only newsletters
            const merged = [...serverNewsletters];
            clientNewsletters.forEach(cn => {
                const slug = cn.id.replace(/-[a-z0-9]+$/, ''); // strip random suffix
                const exists = merged.some(sn =>
                    sn.slug === slug || sn.slug === cn.id ||
                    slug.startsWith(sn.slug) || cn.id.startsWith(sn.slug)
                );
                if (!exists) {
                    merged.push({
                        slug: cn.id,
                        name: cn.name,
                        pubId: '',
                        hasPubId: false,
                        isDefault: false
                    });
                }
            });

            renderList(merged);
        } catch (err) {
            listContainer.innerHTML = `
                <div class="settings-error">
                    <span>❌ Failed to load settings: ${err.message}</span>
                </div>`;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER NEWSLETTER LIST
    // ─────────────────────────────────────────────────────────────────────────

    function renderList(newsletters) {
        if (!newsletters.length) {
            listContainer.innerHTML = `
                <div class="settings-empty">
                    <span>📭</span>
                    <span>No newsletters configured. Add one from the dropdown.</span>
                </div>`;
            return;
        }

        listContainer.innerHTML = newsletters.map(nl => {
            const displayName = nl.name || formatSlug(nl.slug);
            const statusBadge = nl.isDefault
                ? '<span class="settings-badge settings-badge--default">🔒 Default</span>'
                : nl.hasPubId
                    ? '<span class="settings-badge settings-badge--connected">✅ Connected</span>'
                    : '<span class="settings-badge settings-badge--pending">⚠️ Needs Pub ID</span>';

            const pubIdDisplay = nl.isDefault
                ? `<div class="settings-pub-id settings-pub-id--readonly">
                       <span class="settings-pub-id__value">${nl.pubId || 'Not set'}</span>
                       <span class="settings-pub-id__hint">Configured in .env</span>
                   </div>`
                : `<div class="settings-pub-id settings-pub-id--editable">
                       <input type="text" class="settings-pub-id__input" 
                              placeholder="pub_xxxxxxxxxxxxxxx"
                              data-slug="${nl.slug}"
                              value="${nl.hasPubId ? nl.pubId : ''}">
                       <button class="settings-pub-id__save btn btn--primary btn--sm" 
                               data-slug="${nl.slug}">
                           Save
                       </button>
                   </div>`;

            return `
                <div class="settings-newsletter-item ${nl.isDefault ? 'is-default' : ''}">
                    <div class="settings-newsletter-item__header">
                        <div class="settings-newsletter-item__name">
                            <span class="settings-newsletter-item__icon">🗞️</span>
                            <span>${displayName}</span>
                        </div>
                        ${statusBadge}
                    </div>
                    <div class="settings-newsletter-item__config">
                        <label class="settings-label">Publication ID</label>
                        ${pubIdDisplay}
                    </div>
                    <div class="settings-newsletter-item__slug">
                        <span class="settings-slug-label">Slug:</span>
                        <code class="settings-slug-value">${nl.slug}</code>
                    </div>
                </div>`;
        }).join('');

        // Attach save button listeners
        listContainer.querySelectorAll('.settings-pub-id__save').forEach(btn => {
            btn.addEventListener('click', () => handleSave(btn));
        });

        // Allow Enter key to save
        listContainer.querySelectorAll('.settings-pub-id__input').forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const saveBtn = input.parentElement.querySelector('.settings-pub-id__save');
                    if (saveBtn) handleSave(saveBtn);
                }
            });
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SAVE PUBLICATION ID
    // ─────────────────────────────────────────────────────────────────────────

    async function handleSave(btn) {
        const slug = btn.dataset.slug;
        const input = listContainer.querySelector(`.settings-pub-id__input[data-slug="${slug}"]`);
        const pubId = input?.value?.trim();

        if (!pubId) {
            input?.focus();
            shakeElement(input);
            return;
        }

        // Validate format
        if (!pubId.startsWith('pub_')) {
            showToast('⚠️ Publication ID should start with "pub_"', 'warning');
            input?.focus();
            return;
        }

        // Save to server
        btn.disabled = true;
        btn.textContent = 'Saving…';

        try {
            const res = await fetch('/api/settings/newsletters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug, pubId })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                btn.textContent = '✅ Saved';
                btn.classList.add('is-saved');
                showToast(`✅ Publication ID saved for ${formatSlug(slug)}`, 'success');

                // Update the badge
                const item = btn.closest('.settings-newsletter-item');
                const badge = item?.querySelector('.settings-badge');
                if (badge) {
                    badge.className = 'settings-badge settings-badge--connected';
                    badge.textContent = '✅ Connected';
                }

                setTimeout(() => {
                    btn.textContent = 'Save';
                    btn.disabled = false;
                    btn.classList.remove('is-saved');
                }, 2000);
            } else {
                throw new Error(data.error || 'Save failed');
            }
        } catch (err) {
            btn.textContent = 'Save';
            btn.disabled = false;
            showToast(`❌ ${err.message}`, 'error');
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UTILITIES
    // ─────────────────────────────────────────────────────────────────────────

    function formatSlug(slug) {
        return slug.replace(/-[a-z0-9]{6,}$/, '')  // strip random suffix
            .split('-')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    }

    function shakeElement(el) {
        if (!el) return;
        el.classList.add('shake');
        setTimeout(() => el.classList.remove('shake'), 500);
    }

    function showToast(message, type) {
        // Use existing toast system if available
        if (window.showToast) {
            window.showToast(message, type);
            return;
        }

        // Minimal fallback toast
        const toast = document.createElement('div');
        toast.className = `settings-toast settings-toast--${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('is-visible'));
        setTimeout(() => {
            toast.classList.remove('is-visible');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    return { init, open, close };
})();

window.SettingsModal = SettingsModal;
