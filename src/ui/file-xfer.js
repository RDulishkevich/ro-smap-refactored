/**
 * File transfer control — idle pill → loading progress → completed.
 * Motion reference: cream bar + peach action → full peach “Uploading…” with fill → charcoal Completed.
 * Canon: DESIGN.md (Полёвка × Wispr). CSS-only motion (no Framer).
 */
(function initFileXfer(global) {
    const ESC = (s) => String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const DEFAULTS = {
        upload: {
            emptyName: 'Аудиофайл',
            action: 'Выбрать',
            loading: 'Загрузка…',
            done: 'Готово',
            icon: 'icon-document-upload',
            doneIcon: 'icon-tick-circle'
        },
        download: {
            emptyName: 'Файл',
            action: 'Скачать',
            loading: 'Скачивание…',
            done: 'Готово',
            icon: 'icon-document-download',
            doneIcon: 'icon-tick-circle'
        },
        photo: {
            emptyName: 'Фото',
            action: 'Выбрать',
            loading: 'Загрузка…',
            done: 'Готово',
            icon: 'icon-camera',
            doneIcon: 'icon-tick-circle'
        }
    };

    function modeDefaults(mode) {
        return DEFAULTS[mode] || DEFAULTS.upload;
    }

    function ensureStructure(el, opts = {}) {
        if (!el) return null;
        const mode = opts.mode || el.dataset.mode || 'upload';
        const d = modeDefaults(mode);
        el.classList.add('file-xfer');
        el.dataset.mode = mode;
        if (!el.dataset.state) el.dataset.state = 'idle';
        if (el.querySelector('.file-xfer__track')) return el;

        const name = opts.name || el.dataset.name || d.emptyName;
        const action = opts.actionLabel || el.dataset.action || d.action;
        const loading = opts.loadingLabel || el.dataset.loading || d.loading;
        const done = opts.doneLabel || el.dataset.done || d.done;
        const icon = opts.icon || d.icon;
        const tag = opts.asButton ? 'button' : 'div';
        const typeAttr = opts.asButton ? ' type="button"' : '';

        el.innerHTML = `
            <div class="file-xfer__track">
                <div class="file-xfer__file">
                    <i class="${icon} file-xfer__clip" aria-hidden="true"></i>
                    <span class="file-xfer__name">${ESC(name)}</span>
                </div>
                <${tag}${typeAttr} class="file-xfer__action" data-file-xfer-action>
                    <span class="file-xfer__progress" aria-hidden="true"></span>
                    <span class="file-xfer__action-label" data-idle>${ESC(action)}</span>
                    <span class="file-xfer__action-label file-xfer__action-label--busy" data-busy>${ESC(loading)}</span>
                </${tag}>
            </div>
            <div class="file-xfer__done" aria-live="polite">
                <i class="${d.doneIcon}" aria-hidden="true"></i>
                <span class="file-xfer__done-label">${ESC(done)}</span>
            </div>
        `;
        el.classList.add('file-xfer--enter');
        return el;
    }

    function setState(el, state, opts = {}) {
        if (!el) return;
        ensureStructure(el, opts);
        const next = state || 'idle';
        el.dataset.state = next;
        if (opts.name != null) {
            const nameEl = el.querySelector('.file-xfer__name');
            if (nameEl) nameEl.textContent = opts.name;
            el.dataset.name = opts.name;
        }
        if (opts.actionLabel != null) {
            const idle = el.querySelector('[data-idle]');
            if (idle) idle.textContent = opts.actionLabel;
        }
        if (opts.loadingLabel != null) {
            const busy = el.querySelector('[data-busy]');
            if (busy) busy.textContent = opts.loadingLabel;
        }
        if (opts.doneLabel != null) {
            const done = el.querySelector('.file-xfer__done-label');
            if (done) done.textContent = opts.doneLabel;
        }
        if (typeof opts.progress === 'number') setProgress(el, opts.progress);
        if (next === 'loading' && opts.progress == null) setProgress(el, el.__xferProgress || 8);
        if (next === 'done') setProgress(el, 100);
        if (next === 'idle' || next === 'drag') setProgress(el, 0);
    }

    function setProgress(el, value) {
        if (!el) return;
        const p = Math.max(0, Math.min(100, Number(value) || 0));
        el.__xferProgress = p;
        el.style.setProperty('--xfer-p', `${p}%`);
        const bar = el.querySelector('.file-xfer__progress');
        if (bar) bar.style.setProperty('--xfer-p', `${p}%`);
    }

    function mount(el, opts = {}) {
        if (!el) return null;
        ensureStructure(el, opts);
        setState(el, opts.state || el.dataset.state || 'idle', opts);
        return el;
    }

    function html(opts = {}) {
        const mode = opts.mode || 'upload';
        const d = modeDefaults(mode);
        const id = opts.id ? ` id="${ESC(opts.id)}"` : '';
        const cls = ['file-xfer', opts.className || ''].filter(Boolean).join(' ');
        return `<div${id} class="${cls}" data-mode="${ESC(mode)}" data-state="idle" data-name="${ESC(opts.name || d.emptyName)}" data-action="${ESC(opts.actionLabel || d.action)}" data-loading="${ESC(opts.loadingLabel || d.loading)}" data-done="${ESC(opts.doneLabel || d.done)}"></div>`;
    }

    /**
     * Run an async task with loading → progress → done.
     * task({ setProgress }) may return void; errors rethrow after idle reset.
     */
    async function run(el, task, opts = {}) {
        if (!el || typeof task !== 'function') return;
        mount(el, opts);
        const holdMs = opts.doneHoldMs ?? 900;
        setState(el, 'loading', {
            ...opts,
            loadingLabel: opts.loadingLabel,
            progress: 12
        });
        let fake = 12;
        const tick = opts.indeterminate !== false
            ? setInterval(() => {
                fake = Math.min(88, fake + 4 + Math.random() * 6);
                setProgress(el, fake);
            }, 280)
            : null;
        try {
            const result = await task({
                setProgress: (v) => {
                    if (tick) clearInterval(tick);
                    setProgress(el, v);
                }
            });
            if (tick) clearInterval(tick);
            setState(el, 'done', { ...opts, progress: 100 });
            if (opts.resetToIdle !== false) {
                await new Promise((r) => setTimeout(r, holdMs));
                setState(el, 'idle', {
                    name: opts.nameAfter || opts.name || el.dataset.name,
                    actionLabel: opts.actionAfter || opts.actionLabel
                });
            }
            return result;
        } catch (err) {
            if (tick) clearInterval(tick);
            setState(el, 'idle', opts);
            throw err;
        }
    }

    function bindDropHost(host, xferEl, handlers = {}) {
        if (!host || !xferEl) return;
        mount(xferEl, { mode: handlers.mode || 'upload', ...handlers });
        const onOver = (e) => {
            e.preventDefault();
            e.stopPropagation();
            host.classList.add('is-dragover');
            setState(xferEl, 'drag');
        };
        const onLeave = (e) => {
            e.preventDefault();
            if (e.target !== host && host.contains(e.relatedTarget)) return;
            host.classList.remove('is-dragover');
            if (xferEl.dataset.state === 'drag') setState(xferEl, 'idle');
        };
        const onDrop = (e) => {
            e.preventDefault();
            host.classList.remove('is-dragover');
            setState(xferEl, 'idle');
            if (handlers.onFiles) handlers.onFiles(e.dataTransfer?.files);
        };
        host.addEventListener('dragenter', onOver);
        host.addEventListener('dragover', onOver);
        host.addEventListener('dragleave', onLeave);
        host.addEventListener('drop', onDrop);
    }

    global.FileXfer = { mount, setState, setProgress, run, html, ensureStructure, bindDropHost, modeDefaults };
})(typeof window !== 'undefined' ? window : globalThis);
