import { initGlobalState } from './state.js?v=20260717k';
import { initAuth } from './auth.js?v=20260717k';

import '../ui/ui.js?v=20260717k';
import './sfx.js?v=20260717k';
import './audio.js?v=20260717k';
import './map.js?v=20260717k';
import './mapbox-map.js?v=20260717k';
import './guessr.js?v=20260717k';
import '../widgets/analytics-widget.js?v=20260717k';

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
        if (window.updateUcsSubcats) window.updateUcsSubcats();
        if (window.setupAmbisonicSphere) window.setupAmbisonicSphere();
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
        if (window.refreshNotificationsUI) window.refreshNotificationsUI();

        document.addEventListener('click', (e) => {
            const wrap = document.getElementById('notif-wrap');
            const panel = document.getElementById('notif-panel');
            if (wrap && panel && !wrap.contains(e.target) && !panel.classList.contains('hidden')) {
                panel.classList.add('hidden');
            }
        });

        if (window.refreshMessagesUI) window.refreshMessagesUI();

        Promise.all([
            fetch(`${window.YANDEX_BUCKET_URL}/map_data.json?nocache=${Date.now()}`)
                .then(res => res.ok ? res.json() : [])
                .catch(err => { console.warn('База данных недоступна или пуста:', err); return []; }),
            fetch(`${window.YANDEX_BUCKET_URL}/profiles.json?nocache=${Date.now()}`)
                .then(res => res.ok ? res.json() : [])
                .catch(err => { console.warn('Профили пользователей недоступны:', err); return []; }),
            fetch(`${window.YANDEX_BUCKET_URL}/feed.json?nocache=${Date.now()}`)
                .then(res => res.ok ? res.json() : [])
                .catch(() => [])
        ]).then(([cloudData, profiles, feed]) => {
            window.profilesData = Array.isArray(profiles) ? profiles : [];
            window.__lastProfilesPollKey = JSON.stringify(window.profilesData);
            window.feedPosts = Array.isArray(feed) ? feed.filter(p => !p.deleted) : [];
            window.__lastFeedPollKey = JSON.stringify(window.feedPosts);
            if (cloudData.length > 0 && window.mergeData) {
                window.mergeData(cloudData);
                window.__lastCloudPollKey = JSON.stringify(cloudData);
            } else {
                window.__lastCloudPollKey = JSON.stringify([]);
            }
            window.__cloudDataReady = true;
            if (window.initFiltersData) window.initFiltersData();
            if (window.processFilterChange) window.processFilterChange(window.innerWidth >= 768);
            if (window.applyProfileToCurrentUser) window.applyProfileToCurrentUser();
            if (window.refreshNotificationsUI) window.refreshNotificationsUI();
            if (window.refreshMessagesUI) window.refreshMessagesUI();
            if (window.ensureSupportWelcome) window.ensureSupportWelcome().then(() => {
                if (window.refreshMessagesUI) window.refreshMessagesUI();
            });
            if (window.startLiveCloudPolling) window.startLiveCloudPolling(12000);
            if (window.touchMyPresence) window.touchMyPresence(true);
        }).catch(err => {
            console.warn('Не удалось загрузить облачные данные:', err);
            window.__cloudDataReady = true;
        });

        const searchInput = document.getElementById('search-input');
        if (searchInput) {
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
