import { initGlobalState } from './state.js';
import { initAuth } from './auth.js';

import '../ui/ui.js';
import './audio.js';
import './map.js';

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
        if (window.initSwipeHandlers) window.initSwipeHandlers();
        if (window.setSoundsListLoading) window.setSoundsListLoading(true);
        if (window.initOnboarding) window.initOnboarding();

        fetch(`${window.YANDEX_BUCKET_URL}/map_data.json?nocache=${Date.now()}`)
            .then(res => res.ok ? res.json() : [])
            .then(cloudData => {
                if (cloudData.length > 0 && window.mergeData) window.mergeData(cloudData);
                if (window.initFiltersData) window.initFiltersData();
                if (window.processFilterChange) window.processFilterChange(window.innerWidth >= 768);
            })
            .catch(err => {
                console.warn('База данных недоступна или пуста:', err);
                if (window.initFiltersData) window.initFiltersData();
                if (window.processFilterChange) window.processFilterChange(window.innerWidth >= 768);
            });

        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            let searchTimer = null;
            searchInput.addEventListener('input', () => {
                if (searchTimer) clearTimeout(searchTimer);
                searchTimer = setTimeout(() => {
                    if (window.processFilterChange) window.processFilterChange(false);
                }, 140);
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

        if (typeof ymaps !== 'undefined' && window.initMap) {
            ymaps.ready(window.initMap);
        }
    });
}
