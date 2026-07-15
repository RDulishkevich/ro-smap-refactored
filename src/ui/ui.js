window.showToast = function(message) {
    const toast = document.getElementById('toast-message');
    if (!toast) return;
    const textEl = document.getElementById('toast-text');
    if (textEl) textEl.textContent = message;
    toast.classList.remove('-translate-y-24', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
    if(window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('-translate-y-24', 'opacity-0');
    }, 3000);
}

// ДОБАВЛЕНО: Кастомные UI Окна (для правого клика и подтверждений)
window.CustomUI = {
    resolve: null,
    open: function(opts) {
        document.getElementById('ui-modal-title').innerHTML = opts.title || 'Внимание';
        document.getElementById('ui-modal-message').innerHTML = opts.message || '';
        const btn = document.getElementById('ui-modal-confirm');
        btn.textContent = opts.confirmText || 'ОК';
        if(opts.confirmClass) btn.className = opts.confirmClass;
        
        const m = document.getElementById('ui-modal-overlay');
        m.classList.remove('hidden');
        void m.offsetWidth;
        m.classList.remove('opacity-0');
        m.firstElementChild.classList.remove('scale-95');
        
        return new Promise(res => { this.resolve = res; });
    },
    close: function(value) {
        const m = document.getElementById('ui-modal-overlay');
        m.classList.add('opacity-0');
        m.firstElementChild.classList.add('scale-95');
        setTimeout(() => m.classList.add('hidden'), 300);
        if(this.resolve) this.resolve(value);
    }
};

window.assignArchiveNumbers = function() {
    const total = window.soundsData.length;
    window.soundsData.forEach((s, idx) => { s.archiveNum = String(total - idx).padStart(3, '0'); });
}

// Lightbox
window.openLightbox = function(images, index) {
    if(!images || images.length === 0) return;
    window.currentLightboxImages = images; window.currentLightboxIndex = index;
    window.updateLightboxView();
    const lb = document.getElementById('lightbox-overlay');
    lb.classList.remove('hidden'); lb.classList.add('flex'); void lb.offsetWidth; lb.classList.remove('opacity-0');
}
window.openLightboxForSound = function(id, index) {
    const s = window.soundsData.find(x => x.id === id);
    if(s && s.images && s.images.length > 0) window.openLightbox(s.images, index);
}
window.closeLightbox = function() {
    const lb = document.getElementById('lightbox-overlay');
    lb.classList.add('opacity-0');
    setTimeout(() => { lb.classList.add('hidden'); lb.classList.remove('flex'); }, 300);
}
window.nextLightbox = function(e) {
    if(e) e.stopPropagation();
    if(window.currentLightboxImages.length <= 1) return;
    window.currentLightboxIndex = (window.currentLightboxIndex + 1) % window.currentLightboxImages.length;
    window.updateLightboxView();
}
window.prevLightbox = function(e) {
    if(e) e.stopPropagation();
    if(window.currentLightboxImages.length <= 1) return;
    window.currentLightboxIndex = (window.currentLightboxIndex - 1 + window.currentLightboxImages.length) % window.currentLightboxImages.length;
    window.updateLightboxView();
}
window.updateLightboxView = function() {
    document.getElementById('lightbox-img').src = window.currentLightboxImages[window.currentLightboxIndex];
    document.getElementById('lightbox-counter').textContent = `${window.currentLightboxIndex + 1} / ${window.currentLightboxImages.length}`;
}

// Data Merging & Sync
window.mergeData = function(cloudData) {
    const combinedMap = new Map();
    window.rawSoundsData.forEach(rs => combinedMap.set(rs.id, JSON.parse(JSON.stringify(rs))));
    cloudData.forEach(cs => { if(cs.deleted) combinedMap.delete(cs.id); else combinedMap.set(cs.id, cs); });
    window.soundsData = Array.from(combinedMap.values()).reverse().map(window.formatSoundObject);
    window.assignArchiveNumbers();
    window.cloudDataCache = cloudData;
};

window.syncCloudData = async function(newCloudData) {
    try {
        const presignRes = await fetch(window.YANDEX_FUNCTION_URL, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileName: "map_data.json", contentType: "application/json" })
        });
        if (!presignRes.ok) throw new Error("Ошибка получения ссылки для JSON");
        const presignData = await presignRes.json();

        await fetch(presignData.uploadUrl, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newCloudData)
        });
        window.mergeData(newCloudData); window.initFiltersData(); window.processFilterChange(false);
        if(document.getElementById('cabinet-modal') && !document.getElementById('cabinet-modal').classList.contains('hidden')) { window.renderCabinet(); }
        return true;
    } catch(e) { console.error(e); window.showToast("Синхронизация с облаком не удалась."); return false; }
};

window.deleteSoundFromCloud = async function(id) {
    const confirmed = await window.CustomUI.open({
        title: '<i class="fa-solid fa-trash-can mr-2 text-red-500"></i>Удалить звук?',
        message: window.translations[window.currentLang].delete_confirm,
        confirmText: 'Удалить',
        confirmClass: 'px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-md'
    });
    if(!confirmed) return;
    window.showToast("Удаление...");
    let updatedCloud = [...window.cloudDataCache];
    const rawIds = window.rawSoundsData.map(s => s.id);
    if (rawIds.includes(id)) {
        let idx = updatedCloud.findIndex(x => x.id === id);
        if(idx >= 0) updatedCloud[idx] = { id: id, deleted: true };
        else updatedCloud.push({ id: id, deleted: true });
    } else {
        updatedCloud = updatedCloud.filter(s => s.id !== id);
    }
    const success = await window.syncCloudData(updatedCloud);
    if(success) window.showToast("Звук успешно удален!");
};

// --- Filters Logic ---
window.initFiltersData = function() {
    window.allExtractedTags.clear(); window.allExtractedSubcats.clear(); window.allExtractedGears.clear();
    window.allExtractedChannels.clear(); window.allExtractedLicenses.clear(); window.allExtractedRecordists.clear();
    window.allExtractedWeathers.clear(); window.allExtractedDates.clear(); window.allExtractedMics.clear();
    window.allExtractedPrinciples.clear(); window.allExtractedEcoLayers.clear(); window.allExtractedUcsCats.clear();

    window.soundsData.forEach(s => {
        if(s.tagArray) s.tagArray.forEach(t => window.allExtractedTags.add(t));
        if(s.typeTag) window.allExtractedSubcats.add(s.typeTag);
        if(s.ecoCategory) window.allExtractedEcoLayers.add(s.ecoCategory);
        if(s.ucsCat) window.allExtractedUcsCats.add(s.ucsCat);
        if(s.gear) window.allExtractedGears.add(s.gear);
        if(s.channels) window.allExtractedChannels.add(s.channels);
        if(s.license) window.allExtractedLicenses.add(s.license);
        if(s.recordist) window.allExtractedRecordists.add(s.recordist);
        if(s.weather) window.allExtractedWeathers.add(s.weather);
        if(s.date) window.allExtractedDates.add(s.date);
        if(s.micType) window.allExtractedMics.add(s.micType);
        if(s.recPrinciple) window.allExtractedPrinciples.add(s.recPrinciple);
    });
}

window.renderFilterPanels = function() {
    const renderMetaSet = (set, containerId, toggleFn, icon, dataKey) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = Array.from(set).sort().map(val => {
            let setName = toggleFn.replace('window.toggle', 'active');
            // Исключения для правильного маппинга имен сетов
            if(setName === 'activeEcoLayer' || setName === 'activeUcsCat' || setName === 'activeUcsSub') {
                 // Оставляем как есть, логика ниже
            } else {
                 setName = toggleFn.replace('window.toggle', 'active');
            }
            
            const isActive = window[setName] && window[setName].has(val);
            const count = window.soundsData.filter(s => s[dataKey] === val).length;
            
            // Если это слои (geophony и тд), переводим их
            let displayName = val;
            if (dataKey === 'ecoCategory' && window.translations[window.currentLang][`filter_${val}`]) {
                displayName = window.translations[window.currentLang][`filter_${val}`];
            }

            return `<button onclick="${toggleFn}('${val}')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border flex items-center ${isActive ? 'bg-teal-600 text-white border-teal-600 shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}">
                ${icon ? `<i class="fa-solid ${icon} mr-1 opacity-70"></i>` : ''}${displayName} <span class="ml-1 text-[9px] font-normal opacity-60">(${count})</span>
            </button>`;
        }).join('');
    };

    // Отрисовка UCS Категорий (ДОБАВЛЕНО)
    renderMetaSet(window.allExtractedEcoLayers, 'filter-eco-layer', 'window.toggleEcoLayer', 'fa-leaf', 'ecoCategory');
    renderMetaSet(window.allExtractedUcsCats, 'filter-ucs-categories', 'window.toggleUcsCat', 'fa-folder-tree', 'ucsCat');
    renderMetaSet(window.allExtractedSubcats, 'filter-ucs-subcategories', 'window.toggleUcsSub', 'fa-tag', 'typeTag');

    // Отрисовка Метаданных
    renderMetaSet(window.allExtractedPrinciples, 'filter-meta-principle', 'window.togglePrinciple', 'fa-street-view', 'recPrinciple');
    renderMetaSet(window.allExtractedGears, 'filter-meta-gear', 'window.toggleGear', 'fa-walkie-talkie', 'gear');
    renderMetaSet(window.allExtractedMics, 'filter-meta-mic', 'window.toggleMic', 'fa-microphone-lines', 'micType');
    renderMetaSet(window.allExtractedChannels, 'filter-meta-channels', 'window.toggleChannels', 'fa-headphones', 'channels');
    renderMetaSet(window.allExtractedLicenses, 'filter-meta-license', 'window.toggleLicense', 'fa-scale-balanced', 'license');
    renderMetaSet(window.allExtractedRecordists, 'filter-meta-recordist', 'window.toggleRecordist', 'fa-user-astronaut', 'recordist');
    renderMetaSet(window.allExtractedWeathers, 'filter-meta-weather', 'window.toggleWeather', 'fa-cloud-sun', 'weather');
    renderMetaSet(window.allExtractedDates, 'filter-meta-date', 'window.toggleDate', 'fa-calendar-days', 'date');
    window.renderActiveTags();
}

window.renderActiveTags = function() {
    const container = document.getElementById('active-tags-container');
    if (!container) return;

    const activeSets = [
        ['eco', window.activeEcoLayer],
        ['ucsCat', window.activeUcsCat],
        ['ucsSub', window.activeUcsSub],
        ['principle', window.activePrinciple],
        ['gear', window.activeGear],
        ['mic', window.activeMic],
        ['channels', window.activeChannels],
        ['license', window.activeLicense],
        ['recordist', window.activeRecordist],
        ['weather', window.activeWeather],
        ['date', window.activeDate]
    ];

    const totalActive = activeSets.reduce((sum, [, set]) => sum + set.size, 0);
    if (totalActive === 0) {
        container.innerHTML = '';
        return;
    }

    const html = `<button onclick="window.activeEcoLayer.clear(); window.activeUcsCat.clear(); window.activeUcsSub.clear(); window.activeGenTags.clear(); window.activePrinciple.clear(); window.activeGear.clear(); window.activeMic.clear(); window.activeChannels.clear(); window.activeLicense.clear(); window.activeRecordist.clear(); window.activeWeather.clear(); window.activeDate.clear(); window.processFilterChange();" class="text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 uppercase tracking-wider transition-colors"><i class="fa-solid fa-trash-can mr-1"></i>Сбросить</button>`;
    container.innerHTML = html;
}

window.getFilteredSounds = function() {
    const queryEl = document.getElementById('search-input');
    const query = queryEl ? queryEl.value.trim().toLowerCase() : '';

    return window.soundsData.filter(s => {
        const searchTarget = `${s.title} ${s.description} ${s.keywords} ${s.ecoCategory} ${s.ucsCat} ${s.typeTag} ${s.recPrinciple} ${s.gear} ${s.micType} ${s.recordist} ${s.weather} ${s.date} ${s.license} ${s.channels}`.toLowerCase();
        const searchMatch = !query || searchTarget.includes(query);

        const ecoMatch = window.activeEcoLayer.size === 0 || window.activeEcoLayer.has(s.ecoCategory);
        const ucsCatMatch = window.activeUcsCat.size === 0 || window.activeUcsCat.has(s.ucsCat);
        const ucsSubMatch = window.activeUcsSub.size === 0 || window.activeUcsSub.has(s.typeTag);
        const principleMatch = window.activePrinciple.size === 0 || window.activePrinciple.has(s.recPrinciple);
        const gearMatch = window.activeGear.size === 0 || window.activeGear.has(s.gear);
        const micMatch = window.activeMic.size === 0 || window.activeMic.has(s.micType);
        const channelMatch = window.activeChannels.size === 0 || window.activeChannels.has(s.channels);
        const licenseMatch = window.activeLicense.size === 0 || window.activeLicense.has(s.license);
        const recordistMatch = window.activeRecordist.size === 0 || window.activeRecordist.has(s.recordist);
        const weatherMatch = window.activeWeather.size === 0 || window.activeWeather.has(s.weather);
        const dateMatch = window.activeDate.size === 0 || window.activeDate.has(s.date);

        return searchMatch && ecoMatch && ucsCatMatch && ucsSubMatch && principleMatch && gearMatch && micMatch && channelMatch && licenseMatch && recordistMatch && weatherMatch && dateMatch;
    });
}

window.renderList = function() {
    const listContainer = document.getElementById('sounds-list');
    if(!listContainer) return;
    listContainer.innerHTML = '';
    const filtered = window.getFilteredSounds();
    if(filtered.length === 0) { listContainer.innerHTML = `<p class="text-center text-sm text-slate-400 mt-4">Ничего не найдено</p>`; return; }

    filtered.forEach(sound => {
        const item = document.createElement('div');
        const isSelected = window.currentPlayingId === sound.id;
        item.className = `p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 group ${isSelected ? 'bg-slate-50 dark:bg-slate-700/50 shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-100'}`;
        item.onclick = () => window.selectSound(sound.id);
        item.innerHTML = `
            <button class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${isSelected && window.isPlaying ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}">
                ${isSelected && window.isPlaying ? '<i class="fa-solid fa-pause text-xs"></i>' : '<i class="fa-solid fa-play text-xs translate-x-[1px]"></i>'}
            </button>
            <div class="flex-grow min-w-0 text-left">
                <h3 class="font-semibold text-[13px] truncate text-slate-800 dark:text-white flex items-center gap-1.5">${sound.title}</h3>
                <div class="flex flex-wrap gap-1 mt-1"><span class="text-[8px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 font-bold uppercase tracking-wider">${window.translations[window.currentLang][`filter_${sound.ecoCategory}`] || sound.ecoCategory}</span></div>
            </div>`;
        listContainer.appendChild(item);
    });
}

// ДОБАВЛЕНО: Функции переключения UCS фильтров
window.toggleEcoLayer = function(val) { if (window.activeEcoLayer.has(val)) window.activeEcoLayer.delete(val); else window.activeEcoLayer.add(val); window.processFilterChange(false); }
window.toggleUcsCat = function(val) { if (window.activeUcsCat.has(val)) window.activeUcsCat.delete(val); else window.activeUcsCat.add(val); window.processFilterChange(false); }
window.toggleUcsSub = function(val) { if (window.activeUcsSub.has(val)) window.activeUcsSub.delete(val); else window.activeUcsSub.add(val); window.processFilterChange(false); }

window.togglePrinciple = function(val) { if (window.activePrinciple.has(val)) window.activePrinciple.delete(val); else window.activePrinciple.add(val); window.processFilterChange(false); }
window.toggleGear = function(val) { if (window.activeGear.has(val)) window.activeGear.delete(val); else window.activeGear.add(val); window.processFilterChange(false); }
window.toggleMic = function(val) { if (window.activeMic.has(val)) window.activeMic.delete(val); else window.activeMic.add(val); window.processFilterChange(false); }
window.toggleChannels = function(val) { if (window.activeChannels.has(val)) window.activeChannels.delete(val); else window.activeChannels.add(val); window.processFilterChange(false); }
window.toggleLicense = function(val) { if (window.activeLicense.has(val)) window.activeLicense.delete(val); else window.activeLicense.add(val); window.processFilterChange(false); }
window.toggleRecordist = function(val) { if (window.activeRecordist.has(val)) window.activeRecordist.delete(val); else window.activeRecordist.add(val); window.processFilterChange(false); }
window.toggleWeather = function(val) { if (window.activeWeather.has(val)) window.activeWeather.delete(val); else window.activeWeather.add(val); window.processFilterChange(false); }
window.toggleDate = function(val) { if (window.activeDate.has(val)) window.activeDate.delete(val); else window.activeDate.add(val); window.processFilterChange(false); }

window.processFilterChange = function(forceOpenDesktopSidebar = false) {
    window.renderFilterPanels(); window.updateMapMarkers(); window.renderList();
}

window.switchFilterTab = function(tab) {
    const btnUcs = document.getElementById('tab-ucs'), btnTags = document.getElementById('tab-tags'), btnMeta = document.getElementById('tab-meta');
    const panelUcs = document.getElementById('panel-ucs'), panelTags = document.getElementById('panel-tags'), panelMeta = document.getElementById('panel-meta');
    if (!btnUcs || !btnTags || !btnMeta) return;
    const activeClass = "flex-1 py-3 text-[12px] md:text-[13px] font-bold text-blue-600 border-b-2 border-blue-600 transition-colors";
    const inactiveClass = "flex-1 py-3 text-[12px] md:text-[13px] font-bold text-slate-500 dark:text-slate-400 border-b-2 border-transparent hover:text-slate-800 dark:hover:text-slate-200 transition-colors";

    btnUcs.className = inactiveClass; btnTags.className = inactiveClass; btnMeta.className = inactiveClass;
    if(panelUcs) panelUcs.classList.add('hidden'); if(panelTags) panelTags.classList.add('hidden'); if(panelMeta) panelMeta.classList.add('hidden');
    if (tab === 'ucs') { btnUcs.className = activeClass; if(panelUcs) panelUcs.classList.remove('hidden'); }
    else if (tab === 'tags') { btnTags.className = activeClass; if(panelTags) panelTags.classList.remove('hidden'); }
    else { btnMeta.className = activeClass; if(panelMeta) panelMeta.classList.remove('hidden'); }
}

// --- Player, UI and Details ---
window.selectSound = function(id) {
    const s = window.soundsData.find(x => x.id === id);
    if(!s) return;

    const filtered = window.getFilteredSounds();
    const isVisible = filtered.some(item => item.id === id);
    if (!isVisible) {
        window.showToast('Этот звук сейчас не виден по активным фильтрам');
        return;
    }

    if (window.innerWidth < 768) {
        const sb = document.getElementById('sidebar');
        if (sb && !sb.classList.contains('sidebar-hidden')) window.toggleSidebar();
    }

    window.clearMapRoutes();
    const ambiBtn = document.getElementById('btn-ambi-toggle');
    if(s.channels && s.channels.toLowerCase().includes('ambisonics')) {
        if (ambiBtn) { ambiBtn.classList.remove('hidden'); ambiBtn.classList.add('text-indigo-500'); }
        window.isAmbisonicMode = false;
    } else {
        if(ambiBtn) ambiBtn.classList.add('hidden');
    }

    if (s.route && s.route.length > 1 && window.map) {
        window.activePolyline = new ymaps.Polyline(s.route, {}, { strokeColor: '#38bdf8', strokeWidth: 4, strokeOpacity: 0.8, strokeStyle: 'shortdash' });
        window.map.geoObjects.add(window.activePolyline);
        window.map.setBounds(window.activePolyline.geometry.getBounds(), {checkZoomRange: true, duration: 800, zoomMargin: 40});
    } else if (window.map) {
        window.map.setCenter([s.lat, s.lng], 15, { duration: 800 });
    }

    window.currentPlayingId = id;
    window.updateMapMarkers();
    const card = document.getElementById('player-card');
    if(card) card.classList.remove('translate-y-[150%]', 'opacity-0');

    const titleEl = document.getElementById('player-title');
    const gearEl = document.getElementById('player-gear');
    if (titleEl) titleEl.textContent = s.title;
    if (gearEl) gearEl.innerHTML = `<i class="fa-solid fa-walkie-talkie mr-1 text-slate-400"></i>${s.gear}`;

    if (s.url) {
        if (window.audioElement) {
            if (window.audioElement.src !== s.url && !window.audioElement.src.endsWith(s.url)) window.audioElement.src = s.url;
            if(!window.isPlaying) {
                const playPromise = window.audioElement.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => { window.isPlaying = true; window.startTimelineAnimation(); window.updateUIState(); })
                               .catch(() => { window.isPlaying = false; window.prepareMockPlayback(s); });
                }
            }
        }
    } else {
        if (window.audioElement) { window.audioElement.pause(); window.audioElement.removeAttribute('src'); }
        window.prepareMockPlayback(s);
    }
}

window.openDetailsModal = function() {
    const s = window.soundsData.find(x => x.id === window.currentPlayingId);
    if (!s) return;

    const detImg = document.getElementById('details-image');
    if (s.images && s.images.length > 0) {
        if (detImg) {
            detImg.src = s.images[0];
            detImg.onclick = () => window.openLightboxForSound(s.id, 0);
        }
    } else {
        if (detImg) {
            detImg.src = `https://picsum.photos/seed/${s.id}/800/500`;
            detImg.onclick = () => window.openLightbox([`https://picsum.photos/seed/${s.id}/800/500`], 0);
        }
    }

    const titleEl = document.getElementById('details-title');
    const fileEl = document.getElementById('details-filename');
    const descEl = document.getElementById('details-description');

    if (titleEl) titleEl.textContent = s.title;
    if (fileEl) fileEl.innerHTML = `<i class="fa-solid fa-file-waveform mr-1"></i>${s.archiveNum}_${s.fileName}`;
    if (descEl) descEl.textContent = s.description;

    const safeText = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.textContent = txt;
    };

    safeText('det-location', s.location || 'Ростовская область');
    safeText('det-coords', `${Number(s.lat).toFixed(4)}, ${Number(s.lng).toFixed(4)}`);
    window.renderComments(s);

    const m = document.getElementById('details-modal');
    const c = document.getElementById('details-modal-content');
    if (m && c) {
        m.classList.remove('hidden');
        void m.offsetWidth;
        m.classList.remove('opacity-0', 'pointer-events-none');
        c.classList.remove('scale-95');
    }
}

window.closeDetailsModal = function() {
    const m = document.getElementById('details-modal');
    const c = document.getElementById('details-modal-content');
    if (m && c) {
        m.classList.add('opacity-0', 'pointer-events-none');
        c.classList.add('scale-95');
        setTimeout(() => {
            if (m.classList.contains('opacity-0')) m.classList.add('hidden');
        }, 300);
    }
}

window.downloadSound = function(format) {
    const s = window.soundsData.find(x => x.id === window.currentPlayingId);
    if(!s) return;
    if (s.url && s.url.length > 10 && !s.url.startsWith('blob:')) window.open(s.url, '_blank');
    else window.showToast("Файл недоступен для скачивания.");
}

window.renderComments = function(sound) {
    const container = document.getElementById('comments-list');
    if(!container) return;
    if(!sound.comments || sound.comments.length === 0) { container.innerHTML = `<p class="text-sm text-slate-400 italic px-2">Нет комментариев</p>`; return; }
    container.innerHTML = sound.comments.map(c => `
        <div class="bg-slate-100/60 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-200/50">
            <div class="flex justify-between mb-1.5"><span class="text-[13px] font-bold text-slate-700">${c.author}</span><span class="text-[10px] text-slate-400">${c.date}</span></div>
            <p class="text-[13px] text-slate-600">${c.text}</p>
        </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
}

window.addComment = async function() {
    const input = document.getElementById('new-comment-input');
    if(!input || !input.value.trim() || !window.currentPlayingId) return; 
    const s = window.soundsData.find(x => x.id === window.currentPlayingId);
    if(s) {
        const dateStr = new Date().toLocaleDateString(window.currentLang === 'ru' ? 'ru-RU' : 'en-US');
        let authorName = window.currentUser ? window.currentUser.username : (window.currentLang === 'ru' ? 'Гость' : 'Guest');
        s.comments.push({ author: authorName, text: input.value.trim(), date: dateStr });
        input.value = ''; window.renderComments(s);
        let updatedCloud = [...window.cloudDataCache];
        let idx = updatedCloud.findIndex(x => x.id === s.id);
        if(idx >= 0) updatedCloud[idx] = s; else updatedCloud.push(s); 
        await window.syncCloudData(updatedCloud);
    }
}

// Добавление Аудио
window.handleAudioFiles = function(files) {
    if(files && files.length > 0 && files[0].type.startsWith('audio/')) {
        window.currentUploadedFile = files[0];
        window.generateUCSFileName(); 
        window.currentUploadedFileUrl = URL.createObjectURL(files[0]);
        document.getElementById('drop-zone-content').innerHTML = `<span class="text-sm font-bold text-blue-600">Готов к загрузке: ${files[0].name}</span>`;
    }
}

// ДОБАВЛЕНО: Обновление выпадающего списка субкатегорий в модалке Add
window.updateUcsSubcats = function() {
    const cat = document.getElementById('add-category');
    const subcatSelect = document.getElementById('add-subcat');
    if(!cat || !subcatSelect || !window.ucsStructure) return;
    
    const selectedCat = cat.value;
    if(window.ucsStructure[selectedCat]) {
        subcatSelect.innerHTML = window.ucsStructure[selectedCat].map(sub => 
            `<option value="${sub.id}">${sub.name}</option>`
        ).join('');
    }
    window.generateUCSFileName();
}

window.generateUCSFileName = function() {
    const subcat = document.getElementById('add-subcat') ? document.getElementById('add-subcat').value : 'USER';
    const userDef = window.transliterate(document.getElementById('add-user-defined').value || 'NewSound').replace(/\s+/g, '_');
    const rec = window.transliterate(document.getElementById('add-recordist').value || 'Anon').replace(/\s+/g, '');
    if (document.getElementById('add-file-name')) document.getElementById('add-file-name').value = `${subcat}_${userDef}_${rec}_ST.wav`;
}
window.publishSound = async function() {
    window.showToast("Функция загрузки встроена в API. (См. полную версию).");
}

// ИЗМЕНЕНО: Принимаем координаты при клике ПКМ
window.toggleAddModal = function(forceClose = false, coords = null) {
    const m = document.getElementById('add-modal');
    const c = document.getElementById('add-modal-content');
    const coordsInput = document.getElementById('add-coords');

    if (m && m.classList.contains('hidden') && !forceClose) {
        if (coords && coordsInput) {
            coordsInput.value = `${Number(coords[0]).toFixed(5)}, ${Number(coords[1]).toFixed(5)}`;
            window.tempAddCoords = coords;
        }

        if (m && c) {
            m.classList.remove('hidden');
            void m.offsetWidth;
            m.classList.remove('opacity-0', 'pointer-events-none');
            c.classList.remove('scale-95');
        }

        window.updateUcsSubcats();
        return;
    }

    if (m && c) {
        m.classList.add('opacity-0', 'pointer-events-none');
        c.classList.add('scale-95');
        setTimeout(() => {
            if (m.classList.contains('opacity-0')) m.classList.add('hidden');
        }, 300);
    }
}
window.closeAddModalSafely = function() { window.toggleAddModal(true); }

// UI System Callbacks
window.setMapStyle = function(style, skipSave = false) {
    const mapContainer = document.getElementById('map');
    if(!mapContainer) return;
    if (style === 'monochrome') mapContainer.classList.add('map-monochrome');
    else mapContainer.classList.remove('map-monochrome');
    if (!skipSave && window.saveUserSettings) window.saveUserSettings('mapStyle', style);
}
window.changeGUISize = function(size, skipSave = false) {
    const scales = { small: '14px', medium: '16px', large: '18px' };
    document.documentElement.style.fontSize = scales[size];
    if (!skipSave && window.saveUserSettings) window.saveUserSettings('guiScale', size);
}
window.setLanguage = function(lang, skipSave = false) {
    window.currentLang = lang; window.renderList();
    if (!skipSave && window.saveUserSettings) window.saveUserSettings('lang', lang);
}
window.setTheme = function(theme, skipSave = false) {
    window.currentTheme = theme;
    if (theme === 'dark') document.documentElement.classList.add('dark'); else document.documentElement.classList.remove('dark');
    if (!skipSave && window.saveUserSettings) window.saveUserSettings('theme', theme);
}
window.toggleSidebar = function() {
    const s = document.getElementById('sidebar');
    if(!s) return;
    s.classList.toggle('sidebar-hidden');
    if(window.innerWidth >= 768) {
        const playerCard = document.getElementById('player-card');
        if(playerCard) { if (s.classList.contains('sidebar-hidden')) { playerCard.style.marginLeft = '0'; } else { playerCard.style.marginLeft = '25.5rem'; } }
    }
}

window.initSwipeHandlers = function() {
    const lbOverlay = document.getElementById('lightbox-overlay');
    let touchStartX = 0;
    if (lbOverlay) {
        lbOverlay.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
        lbOverlay.addEventListener('touchend', e => {
            const touchEndX = e.changedTouches[0].screenX;
            const diffX = touchStartX - touchEndX;
            if (Math.abs(diffX) > 50) {
                if (diffX > 0) window.nextLightbox();
                else window.prevLightbox();
            }
        }, { passive: true });
    }

    const playerCardEl = document.getElementById('player-card');
    if (playerCardEl) {
        let playerTouchStartY = 0;
        let playerTouchActive = false;

        playerCardEl.addEventListener('touchstart', e => {
            if (e.target.closest('#ambi-sphere-pad') || e.target.tagName.toLowerCase() === 'input') return;
            playerTouchStartY = e.touches[0].screenY;
            playerTouchActive = true;
        }, { passive: true });

        playerCardEl.addEventListener('touchend', e => {
            if (!playerTouchActive) return;
            playerTouchActive = false;
            if (e.target.closest('#ambi-sphere-pad') || e.target.tagName.toLowerCase() === 'input') return;

            const playerTouchEndY = e.changedTouches[0].screenY;
            const diffY = playerTouchEndY - playerTouchStartY;
            if (Math.abs(diffY) > 50) {
                if (diffY > 0) window.closePlayerCard();
                else window.openDetailsModal();
            }
        }, { passive: true });
    }
};