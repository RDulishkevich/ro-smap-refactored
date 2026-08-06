/**
 * Cookie / local-storage consent for Полёвка.
 * Session cookies (rosmap_at / rosmap_rt) are set only after login when consent allows.
 */

const CONSENT_KEY = 'polevka_cookie_consent';
const CONSENT_VERSION = 2; // bump when cookie policy text changes

window.getCookieConsent = function() {
    try {
        const raw = localStorage.getItem(CONSENT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || Number(parsed.v) !== CONSENT_VERSION) return null;
        if (parsed.choice !== 'all' && parsed.choice !== 'necessary') return null;
        return parsed;
    } catch (_) {
        return null;
    }
};

/** Full consent required for auth session cookies. */
window.hasCookieConsentForAuth = function() {
    const c = window.getCookieConsent();
    return !!(c && c.choice === 'all');
};

window.hasCookieConsentDecision = function() {
    return !!window.getCookieConsent();
};

window.setCookieConsent = function(choice) {
    const next = {
        v: CONSENT_VERSION,
        choice: choice === 'necessary' ? 'necessary' : 'all',
        at: new Date().toISOString()
    };
    try {
        localStorage.setItem(CONSENT_KEY, JSON.stringify(next));
    } catch (_) {}
    window.hideCookieConsentBanner();
    if (next.choice === 'necessary') {
        // Не держим сессию, если пользователь отказался от auth-cookies
        try {
            if (window.apiLogout) window.apiLogout();
        } catch (_) {}
        if (window.clearAuthSession) window.clearAuthSession();
        if (window.showToast) {
            window.showToast('Сохранены только локальные настройки. Для входа нужно принять cookies сессии.');
        }
    } else if (window.showToast) {
        window.showToast('Согласие сохранено');
    }
    return next;
};

window.hideCookieConsentBanner = function() {
    const el = document.getElementById('cookie-consent-banner');
    if (!el) return;
    el.classList.add('opacity-0', 'pointer-events-none', 'cookie-consent--hide');
    setTimeout(() => {
        if (el.classList.contains('cookie-consent--hide')) el.classList.add('hidden');
    }, 280);
};

window.showCookieConsentBanner = function() {
    const el = document.getElementById('cookie-consent-banner');
    if (!el) return;
    el.classList.remove('hidden');
    void el.offsetWidth;
    el.classList.remove('opacity-0', 'pointer-events-none', 'cookie-consent--hide');
};

window.openCookieConsentSettings = function() {
    window.showCookieConsentBanner();
};

window.initCookieConsent = function() {
    if (window.hasCookieConsentDecision()) return;
    // Slight delay so map chrome paints first
    setTimeout(() => window.showCookieConsentBanner(), 600);
};

/** Gate auth: session cookies need full consent. */
window.requireCookieConsentForAuth = function() {
    if (window.hasCookieConsentForAuth()) return true;
    if (!window.hasCookieConsentDecision()) {
        window.showCookieConsentBanner();
        if (window.showToast) {
            window.showToast('Сначала подтвердите использование cookies');
        }
        return false;
    }
    window.showCookieConsentBanner();
    if (window.showToast) {
        window.showToast('Для входа нужно принять cookies сессии');
    }
    return false;
};
