/**
 * PWA helpers: service worker, Android install prompt, iOS «На экран Домой» guide,
 * and cross-browser device notifications (Chrome / Safari / installed web app).
 *
 * Notes:
 * - iOS Safari Web Notifications work reliably only from a Home Screen / standalone PWA (16.4+).
 * - Prefer ServiceWorkerRegistration.showNotification over `new Notification()` (Safari + Chrome).
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

window.isPolevkaSecureContext = function isPolevkaSecureContext() {
    if (window.isSecureContext) return true;
    const host = String(location.hostname || '');
    return location.protocol === 'https:'
        || host === 'localhost'
        || host === '127.0.0.1';
};

window.registerPolevkaServiceWorker = function registerPolevkaServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (!window.isPolevkaSecureContext()) return;

    const swUrl = new URL('sw.js', document.baseURI || location.href).href;
    navigator.serviceWorker.register(swUrl).then((reg) => {
        try { reg.update(); } catch (_) {}
    }).catch((err) => {
        console.warn('Service worker registration failed:', err);
    });

    if (!window.__polevkaSwMessageBound) {
        window.__polevkaSwMessageBound = true;
        navigator.serviceWorker.addEventListener('message', (event) => {
            const data = event && event.data;
            if (!data || data.type !== 'polevka-notif-click') return;
            if (data.notifId && window.openNotification) window.openNotification(data.notifId);
            else if (window.toggleNotificationsPanel) window.toggleNotificationsPanel();
        });
    }
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
            <li>Откройте иконку Полёвки и включите уведомления в Настройках приложения.</li>
           </ol>
           <p class="mt-3 text-xs text-slate-500 dark:text-slate-400 text-left">На iPhone системные уведомления работают из ярлыка на «Домой», не из обычной вкладки Safari.</p>`
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

/** True when this browser can request / show Web Notifications at all. */
window.canUseDeviceNotifications = function canUseDeviceNotifications() {
    if (!window.isPolevkaSecureContext || !window.isPolevkaSecureContext()) return false;
    if (typeof window.Notification === 'undefined') return false;
    // iOS: Web Notifications are only reliable in the installed / standalone PWA.
    if (window.isIosDevice && window.isIosDevice()
        && !(window.isPolevkaStandalone && window.isPolevkaStandalone())) {
        return false;
    }
    return true;
};

window.getNotificationPermission = function getNotificationPermission() {
    try {
        if (typeof Notification === 'undefined') return 'unsupported';
        return Notification.permission || 'default';
    } catch (_) {
        return 'unsupported';
    }
};

window.__notifAssetUrl = function __notifAssetUrl(file) {
    try {
        return new URL(file, document.baseURI || location.href).href;
    } catch (_) {
        return file;
    }
};

/**
 * Show an OS notification for an inbox item.
 * Uses Service Worker showNotification first (Safari iOS PWA + Chrome), then Notification().
 */
window.showDeviceNotificationFromInbox = async function showDeviceNotificationFromInbox(n) {
    const body = String(n?.text || 'Новое уведомление').slice(0, 140);
    const title = 'Полёвка';
    const visible = document.visibilityState === 'visible';
    const panel = document.getElementById('notif-panel');
    const panelOpen = !!(panel && !panel.classList.contains('hidden'));

    const canNotify = window.canUseDeviceNotifications && window.canUseDeviceNotifications()
        && window.getNotificationPermission() === 'granted';

    // In-app feedback when OS alerts are unavailable or the user is already looking at the app.
    if (!canNotify) {
        if (visible && !panelOpen && window.showToast) window.showToast(body);
        return;
    }
    if (visible && panelOpen) return;

    const opts = {
        body,
        icon: window.__notifAssetUrl('Logo.png'),
        badge: window.__notifAssetUrl('icons/icon-192.png'),
        tag: `polevka-${n?.id || Date.now()}`,
        renotify: true,
        data: { url: './', notifId: n?.id || null }
    };

    // 1) Service Worker path — required on iOS PWA, preferred in Chrome.
    try {
        if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.ready;
            if (reg && typeof reg.showNotification === 'function') {
                await reg.showNotification(title, opts);
                return;
            }
        }
    } catch (err) {
        console.warn('SW notification failed', err);
    }

    // 2) Constructor fallback (desktop Safari / older Chrome).
    try {
        const note = new Notification(title, opts);
        note.onclick = () => {
            try { window.focus(); } catch (_) {}
            try { note.close(); } catch (_) {}
            if (n?.id && window.openNotification) window.openNotification(n.id);
            else if (window.toggleNotificationsPanel) window.toggleNotificationsPanel();
        };
        return;
    } catch (err) {
        console.warn('Notification() failed', err);
    }

    if (visible && !panelOpen && window.showToast) window.showToast(body);
};

window.enableDeviceNotifications = async function enableDeviceNotifications(opts = {}) {
    const quiet = !!opts.quiet;
    const ios = window.isIosDevice && window.isIosDevice();
    const standalone = window.isPolevkaStandalone && window.isPolevkaStandalone();

    if (!window.isPolevkaSecureContext || !window.isPolevkaSecureContext()) {
        if (!quiet && window.showToast) window.showToast('Уведомления доступны только по HTTPS');
        return false;
    }

    if (ios && !standalone) {
        if (!quiet) {
            if (window.CustomUI?.open) {
                await window.CustomUI.open({
                    title: 'Уведомления на iPhone',
                    message: '<div class="text-left text-sm text-slate-600 dark:text-slate-300 space-y-2"><p>Safari во вкладке не показывает системные уведомления Полёвки.</p><p>Добавьте приложение на экран «Домой», откройте ярлык и снова нажмите «Включить уведомления».</p></div>',
                    confirmText: 'Как добавить',
                    confirmClass: 'px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-md'
                });
                if (window.openAddToHomeScreenHelp) window.openAddToHomeScreenHelp();
            } else if (window.showToast) {
                window.showToast('На iPhone: Safari → На экран «Домой», затем включите уведомления');
            }
        }
        return false;
    }

    if (typeof Notification === 'undefined') {
        if (!quiet && window.showToast) window.showToast('Уведомления не поддерживаются в этом браузере');
        return false;
    }

    try {
        // Ensure SW is registered before requesting permission (Safari prefers this order).
        if ('serviceWorker' in navigator) {
            try {
                window.registerPolevkaServiceWorker();
                await navigator.serviceWorker.ready;
            } catch (_) {}
        }

        let perm = Notification.permission;
        if (perm === 'default') {
            perm = await Notification.requestPermission();
        }
        if (perm !== 'granted') {
            if (!quiet && window.showToast) {
                window.showToast(
                    ios
                        ? 'Разрешите уведомления в Настройки → Полёвка'
                        : 'Разрешите уведомления в настройках браузера'
                );
            }
            return false;
        }

        try { localStorage.setItem('polevka_device_notifs', '1'); } catch (_) {}

        // Smoke-test via SW so Safari/Chrome both register the permission path.
        try {
            if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.ready;
                if (reg?.showNotification && !quiet) {
                    await reg.showNotification('Полёвка', {
                        body: 'Уведомления включены',
                        icon: window.__notifAssetUrl('Logo.png'),
                        badge: window.__notifAssetUrl('icons/icon-192.png'),
                        tag: 'polevka-enabled',
                        data: { url: './' }
                    });
                }
            }
        } catch (err) {
            console.warn('Enable smoke notification failed', err);
        }

        if (!quiet && window.showToast) {
            window.showToast(
                standalone
                    ? 'Уведомления включены для Полёвки'
                    : 'Уведомления включены'
            );
        }
        return true;
    } catch (err) {
        console.warn(err);
        if (!quiet && window.showToast) window.showToast('Не удалось включить уведомления');
        return false;
    }
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

    const showIos = window.isIosDevice && window.isIosDevice() && !(window.isPolevkaStandalone && window.isPolevkaStandalone());
    if (showIos) {
        document.getElementById('btn-add-to-home')?.classList.remove('hidden');
        document.getElementById('btn-add-to-home-settings')?.classList.remove('hidden');
    }

    // Soft prompt when already on home screen / desktop PWA and permission still default.
    try {
        if (window.canUseDeviceNotifications()
            && Notification.permission === 'default'
            && !localStorage.getItem('polevka_notif_hint_v1')
            && (window.isPolevkaStandalone() || !window.isIosDevice())) {
            localStorage.setItem('polevka_notif_hint_v1', '1');
            setTimeout(() => {
                if (Notification.permission !== 'default') return;
                if (window.showToast) {
                    window.showToast('Включите уведомления в Настройках, чтобы не пропускать ответы');
                }
            }, 10000);
        }
    } catch (_) {}
};
