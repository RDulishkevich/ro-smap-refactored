/**
 * PWA helpers: service worker, Android install prompt, iOS «На экран Домой» guide.
 * iOS Safari cannot trigger Add to Home Screen programmatically — only instructions.
 */

window.isPolevkaStandalone = function isPolevkaStandalone() {
    try {
        if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
        if (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) return true;
    } catch (_) {}
    return !!(window.navigator && window.navigator.standalone === true);
};

window.isIosDevice = function isIosDevice() {
    const ua = String(navigator.userAgent || '');
    if (/iPad|iPhone|iPod/i.test(ua)) return true;
    // iPadOS desktop UA
    return navigator.platform === 'MacIntel' && Number(navigator.maxTouchPoints || 0) > 1;
};

window.registerPolevkaServiceWorker = function registerPolevkaServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    const isLocalhost = /^(localhost|127\.0\.0\.1)$/i.test(location.hostname);
    if (location.protocol !== 'https:' && !isLocalhost) return;

    const swUrl = new URL('sw.js', document.baseURI || location.href).href;
    navigator.serviceWorker.register(swUrl).catch((err) => {
        console.warn('Service worker registration failed:', err);
    });
};

window.__deferredInstallPrompt = null;

window.bindPolevkaInstallPrompt = function bindPolevkaInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        window.__deferredInstallPrompt = e;
        const btn = document.getElementById('btn-add-to-home');
        if (btn) btn.classList.remove('hidden');
        const settingsBtn = document.getElementById('btn-add-to-home-settings');
        if (settingsBtn) settingsBtn.classList.remove('hidden');
    });

    window.addEventListener('appinstalled', () => {
        window.__deferredInstallPrompt = null;
        if (window.showToast) window.showToast('Полёвка добавлена на устройство');
    });
};

window.openAddToHomeScreenHelp = async function openAddToHomeScreenHelp() {
    if (window.isPolevkaStandalone && window.isPolevkaStandalone()) {
        if (window.showToast) window.showToast('Полёвка уже открыта с экрана «Домой»');
        return;
    }

    const deferred = window.__deferredInstallPrompt;
    if (deferred && typeof deferred.prompt === 'function') {
        try {
            deferred.prompt();
            const choice = await deferred.userChoice;
            window.__deferredInstallPrompt = null;
            if (choice && choice.outcome === 'accepted' && window.showToast) {
                window.showToast('Установка началась');
            }
            return;
        } catch (err) {
            console.warn('Install prompt failed:', err);
        }
    }

    const isIos = window.isIosDevice && window.isIosDevice();
    const title = isIos ? 'Добавить на экран «Домой»' : 'Установить Полёвку';
    const message = isIos
        ? `<ol class="list-decimal pl-4 space-y-2 text-left text-sm text-slate-600 dark:text-slate-300">
            <li>Откройте сайт в <strong>Safari</strong> (не в Chrome и не во встроенном браузере).</li>
            <li>Нажмите кнопку <strong>«Поделиться»</strong> внизу или вверху экрана.</li>
            <li>Прокрутите и выберите <strong>«На экран „Домой“»</strong>.</li>
            <li>Подтвердите — появится иконка Полёвки.</li>
           </ol>
           <p class="mt-3 text-xs text-slate-500 dark:text-slate-400 text-left">На iPhone нельзя установить приложение одной кнопкой из сайта — только через меню Safari.</p>`
        : `<p class="text-sm text-slate-600 dark:text-slate-300 text-left">В этом браузере установка может быть в меню <strong>«⋮»</strong> → <strong>«Установить приложение»</strong> / <strong>«Добавить на главный экран»</strong>.</p>
           <p class="mt-2 text-xs text-slate-500 dark:text-slate-400 text-left">Нужен HTTPS и современный Chrome / Edge / Samsung Internet.</p>`;

    if (window.CustomUI && window.CustomUI.open) {
        await window.CustomUI.open({
            title,
            message,
            confirmText: 'Понятно',
            confirmClass: 'px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-md'
        });
        return;
    }
    if (window.showToast) window.showToast(isIos ? 'Safari → Поделиться → На экран «Домой»' : 'Меню браузера → Установить приложение');
};

window.maybeHintAddToHomeScreen = function maybeHintAddToHomeScreen() {
    try {
        if (window.isPolevkaStandalone && window.isPolevkaStandalone()) return;
        if (!(window.isIosDevice && window.isIosDevice())) return;
        if (localStorage.getItem('polevka_a2hs_hint_v1')) return;
        localStorage.setItem('polevka_a2hs_hint_v1', '1');
        setTimeout(() => {
            if (window.isPolevkaStandalone && window.isPolevkaStandalone()) return;
            if (window.showToast) {
                window.showToast('Можно добавить Полёвку на экран «Домой» — кнопка в Помощи → FAQ');
            }
        }, 12000);
    } catch (_) {}
};

window.initPolevkaPwa = function initPolevkaPwa() {
    try {
        if (window.isPolevkaStandalone && window.isPolevkaStandalone()) {
            document.documentElement.classList.add('is-standalone');
        }
    } catch (_) {}
    window.bindPolevkaInstallPrompt();
    window.registerPolevkaServiceWorker();
    window.maybeHintAddToHomeScreen();

    // На iOS кнопка всегда полезна (инструкция); на Android — после beforeinstallprompt или тоже как гайд.
    const showIos = window.isIosDevice && window.isIosDevice() && !(window.isPolevkaStandalone && window.isPolevkaStandalone());
    if (showIos) {
        document.getElementById('btn-add-to-home')?.classList.remove('hidden');
        document.getElementById('btn-add-to-home-settings')?.classList.remove('hidden');
    }
};
