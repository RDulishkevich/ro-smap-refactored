import { initGlobalState } from './state.js?v=20260720f';
import './api.js?v=20260720f';
import { initAuth } from './auth.js?v=20260720f';

import './sfx.js?v=20260720f';
import './antispam.js?v=20260720f';
import '../ui/ui.js?v=20260720f';
import './audio.js?v=20260720f';
import './map.js?v=20260720f';
import './mapbox-map.js?v=20260720f';
import './dgis-map.js?v=20260720f';
import './google-earth-map.js?v=20260720f';
import './achievements.js?v=20260720f';
import './guessr.js?v=20260720f';
import './admin-console.js?v=20260720f';
import './support-bot.js?v=20260720f';
import './pwa.js?v=20260720f';
import './events.js?v=20260720f';
import './ucsName.js?v=20260720f';
import './wavMeta.js?v=20260720f';
import './wavReadMeta.js?v=20260720f';
import './audioConvert.js?v=20260720f';
import '../data/publishRules.js?v=20260720f';
import '../data/gearCatalog.js?v=20260720f';
import '../widgets/analytics-widget.js?v=20260720f';

export function bootstrapApp() {
    if (window.__appBootstrapped) return;
    window.__appBootstrapped = true;

    initGlobalState();
    initAuth();

    document.addEventListener('DOMContentLoaded', () => {
        window.audioElement = document.getElementById('global-audio');
        window.soundsData = window.rawSoundsData.map(window.formatSoundObject);

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
            if (window.setColorPalette && !document.documentElement.getAttribute('data-palette')) {
                window.setColorPalette(window.currentPalette || 'coral', true);
            }
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
            fetch(`${window.YANDEX_BUCKET_URL}/mail.json?nocache=${Date.now()}`)
                .then(res => res.ok ? res.json() : [])
                .catch(() => []),
            fetch(`${window.YANDEX_BUCKET_URL}/feed.json?nocache=${Date.now()}`)
                .then(res => res.ok ? res.json() : [])
                .catch(() => []),
            fetch(`${window.YANDEX_BUCKET_URL}/events.json?nocache=${Date.now()}`)
                .then(res => res.ok ? res.json() : [])
                .catch(() => [])
        ]).then(([, cloudData, profiles, mail, feed, events]) => {
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
        if (dropZone && fileInput) {
            dropZone.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', e => {
                if (window.handleAudioFiles) window.handleAudioFiles(e.target.files);
            });
            dropZone.addEventListener('dragover', e => {
                e.preventDefault();
                dropZone.classList.add('border-blue-500', 'bg-blue-50', 'dark:bg-slate-700');
            });
            dropZone.addEventListener('dragleave', e => {
                e.preventDefault();
                dropZone.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-slate-700');
            });
            dropZone.addEventListener('drop', e => {
                e.preventDefault();
                dropZone.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-slate-700');
                if (window.handleAudioFiles) window.handleAudioFiles(e.dataTransfer.files);
            });
        }

        if (typeof window.startMainMap === 'function') {
            window.startMainMap();
        } else if (typeof window.initMap === 'function' && typeof ymaps !== 'undefined') {
            ymaps.ready(window.initMap);
        }
    });
}
