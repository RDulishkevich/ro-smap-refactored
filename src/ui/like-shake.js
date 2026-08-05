/**
 * Like burst + input error shake (Transitions.dev patterns).
 * Brand: --like-color maps to peach accent; hearts use Iconsax (no SVG fill path required).
 */
(function initLikeShake(global) {
    const PARTICLE_COUNT = 8;

    function ensureParticles(btn) {
        if (!btn) return null;
        let layer = btn.querySelector('.t-like-particles');
        if (!layer) {
            layer = document.createElement('span');
            layer.className = 't-like-particles';
            layer.setAttribute('aria-hidden', 'true');
            for (let n = 0; n < PARTICLE_COUNT; n += 1) {
                layer.appendChild(document.createElement('i'));
            }
            const icon = btn.querySelector('.t-like-icon');
            if (icon && icon.nextSibling) btn.insertBefore(layer, icon.nextSibling);
            else btn.insertBefore(layer, btn.firstChild);
        }
        while (layer.children.length < PARTICLE_COUNT) {
            layer.appendChild(document.createElement('i'));
        }
        return layer;
    }

    function spray(layer) {
        if (!layer) return;
        const dots = layer.querySelectorAll('i');
        const distBase = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--like-particle-dist')) || 20;
        dots.forEach((dot) => {
            const angle = Math.random() * Math.PI * 2;
            const dist = distBase * (0.7 + Math.random() * 0.9);
            dot.style.setProperty('--px', `${Math.cos(angle) * dist}px`);
            dot.style.setProperty('--py', `${Math.sin(angle) * dist}px`);
            dot.style.setProperty('--pdur', `${480 + Math.random() * 280}ms`);
            dot.style.setProperty('--pdelay', `${Math.random() * 60}ms`);
            dot.style.setProperty('--p-end-scale', `${0.35 + Math.random() * 0.45}`);
            dot.style.setProperty('--psize', `${0.7 + Math.random() * 0.8}`);
        });
    }

    function setLiked(btn, liked) {
        if (!btn) return;
        btn.classList.add('t-like');
        btn.dataset.liked = liked ? 'true' : 'false';
        btn.classList.toggle('active', !!liked);
        btn.classList.toggle('is-active', !!liked);
        btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
        if (!btn.querySelector('.t-like-icon')) {
            const heart = btn.querySelector('.t-like-heart, .icon-heart, .icon-like-1');
            if (heart) {
                const wrap = document.createElement('span');
                wrap.className = 't-like-icon';
                heart.classList.add('t-like-heart');
                heart.parentNode.insertBefore(wrap, heart);
                wrap.appendChild(heart);
            }
        }
        ensureParticles(btn);
    }

    function play(btn) {
        if (!btn || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setLiked(btn, true);
            return;
        }
        setLiked(btn, true);
        const layer = ensureParticles(btn);
        spray(layer);
        btn.classList.remove('is-bursting');
        // force reflow so animation restarts
        void btn.offsetWidth;
        btn.classList.add('is-bursting');
        const dur = 700;
        clearTimeout(btn.__likeBurstTimer);
        btn.__likeBurstTimer = setTimeout(() => {
            btn.classList.remove('is-bursting');
        }, dur);
    }

    /** Markup fragment for a like control (Iconsax heart). */
    function buttonInner({ icon = 'icon-heart', count = '', label = '' } = {}) {
        const particles = Array.from({ length: PARTICLE_COUNT }, () => '<i></i>').join('');
        const countHtml = count !== '' && count != null
            ? `<span class="t-like-count">${count}</span>`
            : '';
        const labelHtml = label ? `<span class="t-like-label">${label}</span>` : '';
        return `<span class="t-like-icon"><i class="${icon} t-like-heart" aria-hidden="true"></i></span>`
            + `<span class="t-like-particles" aria-hidden="true">${particles}</span>`
            + countHtml + labelHtml;
    }

    /* ── Input shake ── */
    function findShakeParts(target) {
        let el = typeof target === 'string' ? document.querySelector(target) : target;
        if (!el) return null;
        if (el.classList?.contains('t-input-wrap')) {
            return {
                wrap: el,
                input: el.querySelector('.t-input') || el.querySelector('input, textarea, select'),
                msg: el.querySelector('.t-error-msg')
            };
        }
        const wrap = el.closest?.('.t-input-wrap');
        if (wrap) {
            return {
                wrap,
                input: wrap.querySelector('.t-input') || el,
                msg: wrap.querySelector('.t-error-msg')
            };
        }
        // Promote plain modal-input: wrap in place
        if (el.classList?.contains('modal-input') || el.matches?.('input, textarea, select')) {
            const parent = el.parentElement;
            if (!parent) return { wrap: null, input: el, msg: null };
            let shell = parent.classList.contains('t-input-wrap') ? parent : null;
            if (!shell) {
                shell = document.createElement('div');
                shell.className = 't-input-wrap';
                parent.insertBefore(shell, el);
                shell.appendChild(el);
                const msg = document.createElement('p');
                msg.className = 't-error-msg';
                shell.appendChild(msg);
            }
            el.classList.add('t-input');
            return { wrap: shell, input: el, msg: shell.querySelector('.t-error-msg') };
        }
        return { wrap: null, input: el, msg: null };
    }

    function clearError(parts) {
        if (!parts) return;
        parts.wrap?.classList.remove('is-error');
        parts.input?.classList.remove('is-error', 'is-shaking');
        if (parts.msg) parts.msg.textContent = '';
    }

    function shake(target, opts = {}) {
        const parts = findShakeParts(target);
        if (!parts?.input) return;
        const hold = opts.holdMs ?? 3000;
        if (parts.msg && opts.message) parts.msg.textContent = opts.message;
        parts.wrap?.classList.add('is-error');
        parts.input.classList.add('t-input', 'is-error');
        parts.input.classList.remove('is-shaking');
        void parts.input.offsetWidth;
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            parts.input.classList.add('is-shaking');
        }
        clearTimeout(parts.input.__shakeRevert);
        parts.input.__shakeRevert = setTimeout(() => {
            if (opts.persist) return;
            clearError(parts);
        }, hold);
        try { parts.input.focus?.({ preventScroll: true }); } catch (_) {}
    }

    global.LikeBurst = { play, setLiked, ensureParticles, buttonInner };
    global.InputShake = { shake, clear: (t) => clearError(findShakeParts(t)), findShakeParts };
})(typeof window !== 'undefined' ? window : globalThis);
