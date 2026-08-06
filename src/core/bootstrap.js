import { initGlobalState } from './state.js?v=20260726c';
import './api.js?v=20260721t';
import { initAuth } from './auth.js?v=20260806j';

import './sfx.js?v=20260721t';
import './antispam.js?v=20260721t';
import '../ui/file-xfer.js?v=20260805j';
import '../ui/like-shake.js?v=20260805j';
import '../ui/ui.js?v=20260806j';
import './audio.js?v=20260806q';
import './map.js?v=20260806i';
import './mapbox-map.js?v=20260806d';
import './dgis-map.js?v=20260721t';
import './google-earth-map.js?v=20260721t';
import './yandex3-map.js?v=20260806d';
import './achievements.js?v=20260721t';
import './guessr.js?v=20260721t';
import './admin-console.js?v=20260721t';
import './support-bot.js?v=20260721t';
import './pwa.js?v=20260721t';
import './events.js?v=20260806f';
import './ucsName.js?v=20260721t';
import './wavMeta.js?v=20260721t';
import './wavReadMeta.js?v=20260806a';
import './audioConvert.js?v=20260721t';
import '../data/publishRules.js?v=20260721t';
import '../data/legalDocs.js?v=20260721t';
import '../data/gearCatalog.js?v=20260721t';
import '../widgets/analytics-widget.js?v=20260805k';

export function bootstrapApp() {
    if (window.__appBootstrapped) return;
    window.__appBootstrapped = true;

    initGlobalState();
    initAuth();

    document.addEventListener('DOMContentLoaded', () => {
        window.audioElement = document.getElementById('global-audio');
        window.soundsData = window.rawSoundsData.map(window.formatSoundObject);

        /* Block pinch-zoom gestures (iOS Safari) — viewport meta also sets user-scalable=no */
        document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
        document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });

        if (window.renderWaveform) window.renderWaveform();
        if (window.setupAudioEvents) window.setupAudioEvents();
        if (window.populateUcsCategorySelect) window.populateUcsCategorySelect();
        if (window.updateUcsSubcats) window.updateUcsSubcats();
        if (window.setupAmbisonicSphere) window.setupAmbisonicSphere();

        const finishUiBoot = () => {
            if (window.applyUserSettings) window.applyUserSettings();
            try {
                const savedLang = localStorage.getItem('rosmap_lang');
                if (savedLang && !(window.currentUser?.settings?.lang)) window.setLanguage(savedLang, true);
            } catch (_) {}
            try {
                const savedPalette = localStorage.getItem('rosmap_palette');
                if (savedPalette && !(window.currentUser?.settings?.palette) && window.setColorPalette) {
                    window.setColorPalette(savedPalette, true);
                }
            } catch (_) {}
            try {
                const savedFont = localStorage.getItem('rosmap_font');
                if (savedFont && !(window.currentUser?.settings?.font) && window.setUiFont) {
                    window.setUiFont(savedFont, true);
                }
            } catch (_) {}
            if (window.setColorPalette && !document.documentElement.getAttribute('data-palette')) {
                window.setColorPalette(window.currentPalette || 'coral', true);
            }
            if (window.setUiFont && !document.documentElement.getAttribute('data-font')) {
                window.setUiFont(window.currentFont || 'geo-klukva', true);
            }
            if (window.bindSettingsPickers) window.bindSettingsPickers();
            if (window.applyUILanguage) window.applyUILanguage();
            if (window.initSwipeHandlers) window.initSwipeHandlers();
            if (window.initDockChrome) window.initDockChrome();
            if (window.setSoundsListLoading) window.setSoundsListLoading(true);
            if (window.initOnboarding) window.initOnboarding();
            if (window.bindMessagesKeyboardInset) window.bindMessagesKeyboardInset();
            if (window.refreshNotificationsUI) window.refreshNotificationsUI();
            if (window.syncAccountChrome) window.syncAccountChrome();
            if (window.initPolevkaPwa) window.initPolevkaPwa();
        };

        const sessionPromise = (window.restoreAuthSession ? window.restoreAuthSession() : Promise.resolve(false))
            .catch(() => false)
            .then(finishUiBoot);

        document.addEventListener('click', (e) => {
            const wrap = document.getElementById('notif-wrap');
            const wrapMobile = document.getElementById('notif-wrap-mobile');
            const panel = document.getElementById('notif-panel');
            if (!panel || panel.classList.contains('hidden')) return;
            if (wrap?.contains(e.target) || wrapMobile?.contains(e.target) || panel.contains(e.target)) return;
            panel.classList.add('hidden');
        });

        if (window.refreshMessagesUI) window.refreshMessagesUI();

        Promise.all([
            sessionPromise,
            fetch(`${window.YANDEX_BUCKET_URL}/map_data.json?nocache=${Date.now()}`)
                .then(res => res.ok ? res.json() : [])
                .catch(err => { console.warn('База данных недоступна или пуста:', err); return []; }),
            fetch(`${window.YANDEX_BUCKET_URL}/profiles.json?nocache=${Date.now()}`)
                .then(res => res.ok ? res.json() : [])
                .catch(err => { console.warn('Профили пользователей недоступны:', err); return []; }),
            fetch(`${window.YANDEX_BUCKET_URL}/feed.json?nocache=${Date.now()}`)
                .then(res => res.ok ? res.json() : [])
                .catch(() => []),
            fetch(`${window.YANDEX_BUCKET_URL}/events.json?nocache=${Date.now()}`)
                .then(res => res.ok ? res.json() : [])
                .catch(() => [])
        ]).then(async ([, cloudData, profiles, feed, events]) => {
            let mail = [];
            if ((window.isAuthed?.() || window.getAuthToken?.()) && window.apiGetMail) {
                try { mail = await window.apiGetMail(); } catch (_) { mail = []; }
            }
            if (window.applyProfilesAndMailSnapshot) {
                window.applyProfilesAndMailSnapshot(
                    Array.isArray(profiles) ? profiles : [],
                    Array.isArray(mail) ? mail : []
                );
            } else {
                window.profilesData = Array.isArray(profiles) ? profiles : [];
                window.mailData = Array.isArray(mail) ? mail : [];
                window.__lastProfilesPollKey = window.fingerprintDataset
                    ? window.fingerprintDataset(window.profilesData)
                    : String((window.profilesData || []).length);
                window.__lastMailPollKey = window.fingerprintDataset
                    ? window.fingerprintDataset(window.mailData)
                    : String((window.mailData || []).length);
            }
            window.feedPosts = Array.isArray(feed) ? feed.filter(p => !p.deleted) : [];
            window.__lastFeedPollKey = window.fingerprintDataset
                ? window.fingerprintDataset(window.feedPosts)
                : String(window.feedPosts.length);
            window.eventsData = Array.isArray(events) ? events.filter(e => !e.deleted) : [];
            window.__lastEventsPollKey = window.fingerprintDataset
                ? window.fingerprintDataset(window.eventsData)
                : String(window.eventsData.length);
            if (window.renderEventsPanel) window.renderEventsPanel();
            if (cloudData.length > 0 && window.mergeData) {
                window.mergeData(cloudData);
                window.__lastCloudPollKey = window.fingerprintDataset
                    ? window.fingerprintDataset(cloudData)
                    : String(cloudData.length);
            } else {
                window.__lastCloudPollKey = window.fingerprintDataset
                    ? window.fingerprintDataset([])
                    : '0';
            }
            window.__cloudDataReady = true;
            if (window.initFiltersData) window.initFiltersData();
            if (window.clearAllSoundFilters) window.clearAllSoundFilters(true);
            else if (window.processFilterChange) window.processFilterChange(false);
            if (window.applyProfileToCurrentUser) window.applyProfileToCurrentUser();
            if (window.refreshNotificationsUI) window.refreshNotificationsUI();
            if (window.refreshMessagesUI) window.refreshMessagesUI();
            if (window.ensureSupportWelcome) window.ensureSupportWelcome().then(() => {
                if (window.refreshMessagesUI) window.refreshMessagesUI();
            });
            if (window.startLiveCloudPolling) window.startLiveCloudPolling();
            if (window.touchMyPresence) window.touchMyPresence(true);
            if (window.refreshAdminSupportBadge) window.refreshAdminSupportBadge();
            if (window.scheduleWaveformPrefetch) window.scheduleWaveformPrefetch();
            if (window.apiHealth) {
                window.apiHealth().then((h) => {
                    window.__apiHealth = h;
                    if (h && h.ok === false && window.showToast) {
                        window.showToast('API временно недоступен — сохранение может не работать', { silent: true });
                    }
                }).catch(() => {
                    window.__apiHealth = { ok: false };
                });
            }
        }).catch(err => {
            console.warn('Не удалось загрузить облачные данные:', err);
            window.__cloudDataReady = true;
        });

        const searchInput = document.getElementById('search-input');
        const clearSearchAutofill = () => {
            if (!searchInput) return;
            const junk = /novaya[\s_]*zapis/i;
            if (!searchInput.value || junk.test(searchInput.value.trim())) {
                searchInput.value = '';
            }
        };
        if (searchInput) {
            clearSearchAutofill();
            searchInput.setAttribute('readonly', 'readonly');
            const unlockSearch = () => {
                searchInput.removeAttribute('readonly');
            };
            searchInput.addEventListener('focus', unlockSearch, { once: true });
            searchInput.addEventListener('touchstart', unlockSearch, { once: true, passive: true });
            let searchTimer = null;
            searchInput.addEventListener('input', () => {
                if (window.updateSearchSuggestions) window.updateSearchSuggestions(searchInput.value || '');
                if (searchTimer) clearTimeout(searchTimer);
                searchTimer = setTimeout(() => {
                    if (window.processFilterChange) window.processFilterChange(false);
                }, 140);
            });
            searchInput.addEventListener('focus', () => {
                if (window.updateSearchSuggestions) window.updateSearchSuggestions(searchInput.value || '');
            });
            window.addEventListener('pageshow', clearSearchAutofill);
            setTimeout(clearSearchAutofill, 0);
            setTimeout(clearSearchAutofill, 250);
        }

        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('audio-file-input');
        const audioXfer = document.getElementById('audio-xfer');
        if (window.FileXfer) {
            if (audioXfer) {
                window.FileXfer.mount(audioXfer, {
                    mode: 'upload',
                    name: 'Аудиофайл',
                    actionLabel: 'Выбрать',
                    loadingLabel: 'Обработка…',
                    doneLabel: 'Готово'
                });
            }
            const imageXfer = document.getElementById('image-xfer');
            if (imageXfer) {
                window.FileXfer.mount(imageXfer, {
                    mode: 'photo',
                    name: 'Фото',
                    actionLabel: 'Выбрать',
                    loadingLabel: 'Загрузка…',
                    doneLabel: 'Готово'
                });
            }
            const pubXfer = document.getElementById('publish-xfer');
            if (pubXfer) {
                window.FileXfer.mount(pubXfer, {
                    mode: 'upload',
                    name: 'Опубликовать',
                    actionLabel: 'Опубликовать',
                    loadingLabel: 'Публикация…',
                    doneLabel: 'Готово'
                });
            }
            const dlXfer = document.getElementById('details-download-xfer');
            if (dlXfer) {
                window.FileXfer.mount(dlXfer, {
                    mode: 'download',
                    name: 'WAV',
                    actionLabel: 'Скачать',
                    loadingLabel: 'Скачивание…',
                    doneLabel: 'Готово'
                });
            }
            const zipXfer = document.getElementById('expedition-view-download-btn');
            if (zipXfer && zipXfer.classList.contains('file-xfer')) {
                window.FileXfer.mount(zipXfer, {
                    mode: 'download',
                    name: 'ZIP',
                    actionLabel: 'ZIP',
                    loadingLabel: 'Сборка…',
                    doneLabel: 'Готово'
                });
            }
        }
        if (dropZone && fileInput) {
            dropZone.addEventListener('click', (e) => {
                if (e.target.closest('[data-file-xfer-action]') || e.target.closest('.file-xfer__action')) {
                    fileInput.click();
                    return;
                }
                if (e.target.closest('.file-xfer__done')) return;
                fileInput.click();
            });
            fileInput.addEventListener('change', e => {
                if (window.handleAudioFiles) window.handleAudioFiles(e.target.files);
            });
            if (window.FileXfer && audioXfer) {
                window.FileXfer.bindDropHost(dropZone, audioXfer, {
                    mode: 'upload',
                    onFiles: (files) => window.handleAudioFiles && window.handleAudioFiles(files)
                });
            } else {
                dropZone.addEventListener('dragover', e => {
                    e.preventDefault();
                    dropZone.classList.add('is-dragover');
                });
                dropZone.addEventListener('dragleave', e => {
                    e.preventDefault();
                    dropZone.classList.remove('is-dragover');
                });
                dropZone.addEventListener('drop', e => {
                    e.preventDefault();
                    dropZone.classList.remove('is-dragover');
                    if (window.handleAudioFiles) window.handleAudioFiles(e.dataTransfer.files);
                });
            }
        }

        const imageDrop = document.getElementById('image-drop-zone');
        const imageXferEl = document.getElementById('image-xfer');
        if (imageDrop && imageXferEl && window.FileXfer) {
            window.FileXfer.bindDropHost(imageDrop, imageXferEl, {
                mode: 'photo',
                onFiles: (files) => {
                    const input = document.getElementById('image-file-input');
                    if (window.handleImageFilesWrapper) window.handleImageFilesWrapper(files);
                    else if (input) {
                        /* fallthrough */
                    }
                }
            });
        }

        if (typeof window.startMainMap === 'function') {
            window.ensureYandexMapsLoaded
                ? window.ensureYandexMapsLoaded().then(() => window.startMainMap()).catch((err) => {
                    console.error(err);
                    if (window.showToast) window.showToast('Не удалось загрузить карту');
                })
                : window.startMainMap();
        } else if (typeof window.initMap === 'function') {
            const boot = () => {
                if (typeof ymaps !== 'undefined') ymaps.ready(window.initMap);
            };
            if (window.ensureYandexMapsLoaded) {
                window.ensureYandexMapsLoaded().then(boot).catch((err) => {
                    console.error(err);
                    if (window.showToast) window.showToast('Не удалось загрузить карту');
                });
            } else {
                boot();
            }
        }
    });
}
