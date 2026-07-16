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

window.setSoundsListLoading = function(isLoading) {
    const list = document.getElementById('sounds-list');
    if (!list) return;
    if (!isLoading) return;
    list.innerHTML = Array.from({ length: 5 }).map(() => `
        <div class="p-3 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-3">
            <div class="w-9 h-9 rounded-full skeleton-line shrink-0"></div>
            <div class="flex-grow space-y-2">
                <div class="skeleton-line w-3/4"></div>
                <div class="skeleton-line w-1/3 h-2"></div>
            </div>
        </div>
    `).join('');
};

window.renderSoundTags = function(sound, containerId, clickable = false) {
    const container = document.getElementById(containerId);
    if (!container || !sound) return;
    const tags = [];
    if (sound.ecoCategory) {
        const ecoLabel = window.translations[window.currentLang]?.[`filter_${sound.ecoCategory}`] || sound.ecoCategory;
        tags.push({ label: ecoLabel, type: 'eco', value: sound.ecoCategory });
    }
    if (sound.typeTag) tags.push({ label: sound.typeTag, type: 'ucsSub', value: sound.typeTag });
    if (sound.tagArray) sound.tagArray.forEach(t => tags.push({ label: t, type: 'gen', value: t }));

    container.innerHTML = tags.map(tag => {
        const clickAttr = clickable && tag.type === 'gen'
            ? `onclick="window.toggleGenTag('${String(tag.value).replace(/'/g, "\\'")}')"`
            : '';
        const colors = tag.type === 'eco'
            ? 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800'
            : tag.type === 'ucsSub'
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800'
                : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600';
        return `<span ${clickAttr} class="tag-pill ${colors} border">${tag.label}</span>`;
    }).join('');
};

window.getRegionStats = function() {
    const sounds = window.soundsData || [];
    const byEco = { geophony: 0, biophony: 0, anthrophony: 0 };
    const byUcs = {};
    const recordists = new Set();
    let totalSecs = 0;
    let withAudio = 0;

    sounds.forEach(s => {
        if (s.ecoCategory && byEco[s.ecoCategory] !== undefined) byEco[s.ecoCategory]++;
        if (s.ucsCat) byUcs[s.ucsCat] = (byUcs[s.ucsCat] || 0) + 1;
        if (s.recordist) recordists.add(s.recordist);
        totalSecs += window.parseDuration ? window.parseDuration(s.duration) : 0;
        if (s.url && s.url.length > 10) withAudio++;
    });

    const topUcs = Object.entries(byUcs).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { total: sounds.length, byEco, topUcs, recordists: recordists.size, totalSecs, withAudio };
};

window.renderRegionStats = function(targetId = 'region-stats-grid') {
    const grid = document.getElementById(targetId);
    if (!grid || !window.parseDuration) return;
    const stats = window.getRegionStats();

    // The main "Статистика региона" panel is rendered by the React + Motion widget
    // (src/widgets/analytics-widget.js); other targets (e.g. the admin grid) keep the plain cards.
    if (targetId === 'region-stats-grid' && window.AnalyticsWidget && typeof window.AnalyticsWidget.mount === 'function') {
        window.AnalyticsWidget.mount(grid, {
            total: stats.total,
            withAudio: stats.withAudio,
            recordists: stats.recordists,
            totalMinutes: stats.totalSecs / 60,
            byEco: stats.byEco,
            topUcsList: stats.topUcs.map(([label, value]) => ({ label, value }))
        });
        return;
    }

    const cards = [
        { value: stats.total, label: 'Записей', color: 'text-blue-600 dark:text-blue-400' },
        { value: stats.withAudio, label: 'С аудио', color: 'text-emerald-600 dark:text-emerald-400' },
        { value: stats.recordists, label: 'Авторов', color: 'text-indigo-600 dark:text-indigo-400' },
        { value: window.formatTotalDuration(stats.totalSecs), label: 'Длительность', color: 'text-amber-600 dark:text-amber-400' },
        { value: stats.byEco.geophony, label: 'Геофония', color: 'text-sky-600 dark:text-sky-400' },
        { value: stats.byEco.biophony, label: 'Биофония', color: 'text-green-600 dark:text-green-400' },
        { value: stats.byEco.anthrophony, label: 'Антропофония', color: 'text-orange-600 dark:text-orange-400' },
        { value: stats.topUcs[0] ? stats.topUcs[0][0] : '—', label: stats.topUcs[0] ? `Топ UCS (${stats.topUcs[0][1]})` : 'Топ UCS', color: 'text-violet-600 dark:text-violet-400' }
    ];
    grid.innerHTML = cards.map(c => `
        <div class="stat-card">
            <div class="stat-value ${c.color}">${c.value}</div>
            <div class="stat-label">${c.label}</div>
        </div>
    `).join('');
};

window.exportSoundsData = function(format, allSounds = false) {
    const sounds = allSounds ? (window.soundsData || []) : (window.getFilteredSounds ? window.getFilteredSounds() : []);
    if (!sounds.length) return window.showToast('Нет данных для экспорта');

    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `rosmap_${stamp}.${format === 'csv' ? 'csv' : 'geojson'}`;

    if (format === 'csv') {
        const headers = ['id', 'title', 'lat', 'lng', 'ecoCategory', 'ucsCat', 'typeTag', 'recordist', 'gear', 'channels', 'weather', 'date', 'duration', 'url'];
        const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const rows = sounds.map(s => headers.map(h => escape(s[h])).join(','));
        const blob = new Blob(['\uFEFF' + [headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
        window.showToast(`Экспортировано ${sounds.length} записей (CSV)`);
        return;
    }

    const geojson = {
        type: 'FeatureCollection',
        features: sounds.map(s => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
            properties: {
                id: s.id, title: s.title, description: s.description,
                ecoCategory: s.ecoCategory, ucsCat: s.ucsCat, typeTag: s.typeTag,
                recordist: s.recordist, gear: s.gear, channels: s.channels,
                weather: s.weather, date: s.date, duration: s.duration, url: s.url || '',
                keywords: s.keywords || ''
            }
        }))
    };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    window.showToast(`Экспортировано ${sounds.length} точек (GeoJSON)`);
};

window.onboardingSteps = [
    { target: null, title: 'Добро пожаловать в Audio Map', text: 'Интерактивная карта звуков Ростовской области. Пройдите короткий тур — это займёт 30 секунд.' },
    { target: '#burger-btn', title: 'Библиотека звуков', text: 'Кнопка меню слева открывает три раздела: Библиотека (поиск и фильтры), Лента с новостями и Экспедиции.' },
    { target: null, title: 'Аудиоплеер', text: 'Нажмите на любую метку на карте, чтобы открыть плеер. Для ambisonics записей доступно вращение на 360°.' },
    { target: '#fab-add', title: 'Добавьте свой звук', text: 'Кнопка «+» — загрузка WAV с метаданными. На телефоне удерживайте палец на карте, чтобы быстро поставить метку.' }
];

window.startOnboarding = function(step = 0) {
    const overlay = document.getElementById('onboarding-overlay');
    if (!overlay) return;
    
    // Закрываем всё лишнее, чтобы тур был поверх чистой карты
    const sb = document.getElementById('sidebar');
    if (sb && !sb.classList.contains('sidebar-hidden')) window.toggleSidebar();
    if (window.closePlayerCard) window.closePlayerCard();

    window.__onboardingStep = step;
    overlay.classList.remove('hidden');
    overlay.classList.add('pointer-events-auto');
    window.updateOnboardingStep();
};

window.updateOnboardingStep = function() {
    const step = window.onboardingSteps[window.__onboardingStep || 0];
    const overlay = document.getElementById('onboarding-overlay');
    const highlight = document.getElementById('onboarding-highlight');
    const card = document.getElementById('onboarding-card');
    if (!step || !overlay || !highlight || !card) return;

    document.getElementById('onboarding-step-label').textContent = `Шаг ${window.__onboardingStep + 1} / ${window.onboardingSteps.length}`;
    document.getElementById('onboarding-title').textContent = step.title;
    document.getElementById('onboarding-text').textContent = step.text;

    const prevBtn = document.getElementById('onboarding-prev');
    if (prevBtn) prevBtn.style.visibility = window.__onboardingStep === 0 ? 'hidden' : 'visible';

    const nextBtn = document.getElementById('onboarding-next');
    if (nextBtn) nextBtn.textContent = window.__onboardingStep === window.onboardingSteps.length - 1 ? 'Готово' : 'Далее';

    const placeCardCentered = () => {
        highlight.style.opacity = '0';
        highlight.style.pointerEvents = 'none';
        card.style.left = '50%';
        card.style.top = '50%';
        card.style.transform = 'translate(-50%, -50%)';
    };

    if (!step.target) {
        placeCardCentered();
        return;
    }

    const el = document.querySelector(step.target);
    if (!el) {
        placeCardCentered();
        return;
    }

    const rect = el.getBoundingClientRect();
    const pad = 8;
    highlight.style.opacity = '1';
    highlight.style.display = 'block';
    highlight.style.left = `${rect.left - pad}px`;
    highlight.style.top = `${rect.top - pad}px`;
    highlight.style.width = `${rect.width + pad * 2}px`;
    highlight.style.height = `${rect.height + pad * 2}px`;

    // Ждём кадр, чтобы размеры карточки обновились после смены текста
    requestAnimationFrame(() => {
        const cardRect = card.getBoundingClientRect();
        const cardWidth = cardRect.width || 320;
        const cardHeight = cardRect.height || 180;

        let top = rect.bottom + 16;
        let left = rect.left;

        if (top + cardHeight > window.innerHeight - 16) {
            top = rect.top - cardHeight - 16;
        }

        if (window.innerWidth < 640) {
            left = (window.innerWidth - cardWidth) / 2;
        } else {
            if (left + cardWidth > window.innerWidth - 16) left = window.innerWidth - cardWidth - 16;
            if (left < 16) left = 16;
        }

        if (top < 16) {
            top = Math.max(16, (window.innerHeight - cardHeight) / 2);
            left = (window.innerWidth - cardWidth) / 2;
        }

        card.style.left = `${left}px`;
        card.style.top = `${top}px`;
        card.style.transform = 'none';
    });
};

window.nextOnboardingStep = function() {
    if (window.__onboardingStep >= window.onboardingSteps.length - 1) {
        window.dismissOnboarding();
        return;
    }
    window.__onboardingStep++;
    window.updateOnboardingStep();
};

window.prevOnboardingStep = function() {
    if (window.__onboardingStep > 0) {
        window.__onboardingStep--;
        window.updateOnboardingStep();
    }
};

window.dismissOnboarding = function() {
    localStorage.setItem('rosmap_onboarding_done', '1');
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.classList.remove('pointer-events-auto');
    }
};

window.restartOnboarding = function() {
    localStorage.removeItem('rosmap_onboarding_done');
    if (window.closeSettingsModal) window.closeSettingsModal();
    if (window.closeCabinet) window.closeCabinet();
    window.startOnboarding(0);
};

window.initOnboarding = function() {
    if (localStorage.getItem('rosmap_onboarding_done')) return;
    setTimeout(() => window.startOnboarding(0), 500);
};

// ДОБАВЛЕНО: Кастомные UI Окна (для правого клика, подтверждений и текстовых промптов)
window.CustomUI = window.CustomUI || {
    resolve: null,
    open: function(opts) {
        const titleEl = document.getElementById('ui-modal-title');
        const messageEl = document.getElementById('ui-modal-message');
        const btn = document.getElementById('ui-modal-confirm');
        const inputEl = document.getElementById('ui-modal-input');
        const m = document.getElementById('ui-modal-overlay');
        const content = m ? m.firstElementChild : null;

        if (titleEl) titleEl.innerHTML = opts.title || 'Внимание';
        if (messageEl) messageEl.innerHTML = opts.message || '';
        if (btn) {
            btn.textContent = opts.confirmText || 'ОК';
            btn.className = opts.confirmClass || 'px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-md';
        }

        // showInput=true превращает диалог в текстовый промпт (см. createSession/причина отклонения):
        // подтверждение вернёт значение поля, а не true/false.
        if (inputEl) {
            if (opts.showInput) {
                inputEl.classList.remove('hidden');
                inputEl.value = opts.inputValue || '';
                inputEl.placeholder = opts.inputPlaceholder || '';
                setTimeout(() => inputEl.focus(), 50);
            } else {
                inputEl.classList.add('hidden');
                inputEl.value = '';
            }
        }

        if (m && content) {
            m.classList.remove('hidden');
            void m.offsetWidth;
            m.classList.remove('opacity-0');
            content.classList.remove('scale-95');
        }

        return new Promise(res => { this.resolve = res; });
    },
    close: function(value) {
        const m = document.getElementById('ui-modal-overlay');
        const content = m ? m.firstElementChild : null;
        const inputEl = document.getElementById('ui-modal-input');

        // Если диалог был текстовым промптом и пользователь подтвердил (не отменил) — резолвим
        // значением поля ввода, а не булевым true.
        if (value === true && inputEl && !inputEl.classList.contains('hidden')) {
            value = inputEl.value.trim();
        }

        if (m && content) {
            m.classList.add('opacity-0');
            content.classList.add('scale-95');
            setTimeout(() => {
                if (m.classList.contains('opacity-0')) m.classList.add('hidden');
                if (inputEl) { inputEl.classList.add('hidden'); inputEl.value = ''; }
            }, 300);
        }
        if (this.resolve) {
            const resolve = this.resolve;
            this.resolve = null;
            resolve(value);
        }
    }
};

// Мини-"шторка" со списком действий — переиспользуемая замена контекстного меню по «...»
// (профиль автора / ответить / реакция / пожаловаться у комментариев, см. openCommentMenu).
window.ActionSheet = {
    _actions: [],
    open: function(items) {
        this._actions = items.map(i => i.onClick);
        const container = document.getElementById('action-sheet-items');
        const overlay = document.getElementById('action-sheet-overlay');
        const content = document.getElementById('action-sheet-content');
        if (!container || !overlay || !content) return;

        container.innerHTML = items.map((item, i) => `
            <button onclick="window.ActionSheet.trigger(${i})" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors text-left ${item.danger ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'}">
                <i class="fa-solid ${item.icon} w-4 text-center opacity-70"></i>${item.label}
            </button>
        `).join('');

        overlay.classList.remove('hidden');
        void overlay.offsetWidth;
        overlay.classList.remove('opacity-0');
        content.classList.remove('translate-y-full', 'sm:scale-95');
    },
    trigger: function(i) {
        const fn = this._actions[i];
        this.close();
        // Ждём завершения анимации закрытия шторки, прежде чем открывать следующий модал/промпт —
        // иначе они визуально конфликтуют (пересекаются переходы opacity/scale).
        if (fn) setTimeout(fn, 280);
    },
    close: function() {
        const overlay = document.getElementById('action-sheet-overlay');
        const content = document.getElementById('action-sheet-content');
        if (!overlay || !content) return;
        overlay.classList.add('opacity-0');
        content.classList.add('translate-y-full', 'sm:scale-95');
        setTimeout(() => { if (overlay.classList.contains('opacity-0')) overlay.classList.add('hidden'); }, 300);
    }
};

window.openLocationPickerModal = function() {
    const modal = document.getElementById('location-picker-modal');
    const content = document.getElementById('location-picker-modal-content');
    if (!modal || !content) return;

    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-95');

    if (window.initLocationPickerMap) window.initLocationPickerMap();
};

window.closeLocationPickerModal = function() {
    const modal = document.getElementById('location-picker-modal');
    const content = document.getElementById('location-picker-modal-content');
    if (!modal || !content) return;

    modal.classList.add('opacity-0', 'pointer-events-none');
    content.classList.add('scale-95');
    setTimeout(() => {
        if (modal.classList.contains('opacity-0')) modal.classList.add('hidden');
    }, 300);
};

window.applyPickedLocation = function() {
    if (window.isSoundwalkPrinciple()) {
        if (!window.addModalRoute || window.addModalRoute.length < 2) {
            window.showToast('Для звуковой прогулки нужно минимум 2 точки маршрута');
            return;
        }
        window.tempAddCoords = window.addModalRoute[0];
    } else if (!window.tempAddCoords) {
        window.showToast('Сначала выберите точку на карте');
        return;
    }

    const coordsInput = document.getElementById('add-coords');
    const locationInput = document.getElementById('add-loc');
    if (coordsInput && window.tempAddCoords) {
        coordsInput.value = `${Number(window.tempAddCoords[0]).toFixed(5)}, ${Number(window.tempAddCoords[1]).toFixed(5)}`;
    }
    if (locationInput) {
        locationInput.value = locationInput.value.trim() || (window.isSoundwalkPrinciple() ? 'Маршрут звуковой прогулки' : 'Точка выбрана на карте');
    }

    window.updateSoundwalkRouteUI();
    window.closeLocationPickerModal();
};

window.handlePrincipleChange = function(value) {
    window.updateSoundwalkRouteUI();
    if (!window.isSoundwalkPrinciple(value)) {
        // При смене принципа на Spot/Drop rig маршрут больше не нужен
        window.addModalRoute = [];
        if (window.addModalPolyline && window.locationPickerMap) {
            window.locationPickerMap.geoObjects.remove(window.addModalPolyline);
            window.addModalPolyline = null;
        }
    } else if ((!window.addModalRoute || !window.addModalRoute.length) && window.tempAddCoords) {
        window.addModalRoute = [window.tempAddCoords.slice()];
    }
};

window.updateSoundwalkRouteUI = function() {
    const clearBtn = document.getElementById('add-clear-route');
    const isWalk = window.isSoundwalkPrinciple();
    const count = (window.addModalRoute || []).length;
    if (clearBtn) {
        clearBtn.classList.toggle('hidden', !isWalk || count === 0);
        clearBtn.textContent = count > 0 ? `Очистить маршрут (${count} т.)` : 'Очистить маршрут';
    }
};

window.clearAddModalRoute = function() {
    window.addModalRoute = [];
    if (window.addModalPolyline && window.locationPickerMap) {
        window.locationPickerMap.geoObjects.remove(window.addModalPolyline);
        window.addModalPolyline = null;
    }
    window.updateSoundwalkRouteUI();
    window.showToast('Маршрут очищен');
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
    // Если облачная копия того же id пришла без route — сохраняем маршрут из локального демо,
    // иначе soundwalk'и r2/r5 «теряют» прогулку после первой синхронизации.
    cloudData.forEach(cs => {
        if (cs.deleted) { combinedMap.delete(cs.id); return; }
        const prev = combinedMap.get(cs.id);
        combinedMap.set(cs.id, { ...cs, route: (cs.route && cs.route.length > 1) ? cs.route : (prev?.route || cs.route) });
    });
    window.soundsData = Array.from(combinedMap.values()).reverse().map(window.formatSoundObject);
    window.assignArchiveNumbers();
    window.cloudDataCache = cloudData;
    window.__filteredSoundsCache = null;
    window.__filteredSoundsCacheKey = null;
        window.markerCache = new Map();
        window.markerLayoutCache = new Map();
        if (window.markerClusterer && window.map) {
            window.map.geoObjects.remove(window.markerClusterer);
            window.markerClusterer = null;
        }
};

// --- Устойчивая синхронизация: очередь + GET→merge→PUT ---
// Раньше каждый клиент делал слепой PUT всего файла из устаревшего кэша (last-write-wins),
// из‑за чего сообщения/уведомления/экспедиции периодически затирались.
window.__cloudWriteChains = window.__cloudWriteChains || {};
window.__cloudDataReady = window.__cloudDataReady || false;
window.__cloudWriteDepth = 0;

window.__enqueueCloudWrite = function(fileName, task) {
    const prev = window.__cloudWriteChains[fileName] || Promise.resolve();
    const next = prev.catch(() => {}).then(task);
    window.__cloudWriteChains[fileName] = next.catch(() => {});
    return next;
};

window.__waitCloudReady = async function() {
    if (window.__cloudDataReady) return;
    const started = Date.now();
    while (!window.__cloudDataReady && Date.now() - started < 15000) {
        await new Promise(r => setTimeout(r, 50));
    }
};

window.fetchCloudJson = async function(fileName) {
    const res = await fetch(`${window.YANDEX_BUCKET_URL}/${fileName}?nocache=${Date.now()}`);
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : null;
};

window.__putCloudJson = async function(fileName, data) {
    const presignRes = await fetch(window.YANDEX_FUNCTION_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, contentType: "application/json" })
    });
    if (!presignRes.ok) throw new Error("Ошибка получения ссылки для JSON");
    const presignData = await presignRes.json();
    const putRes = await fetch(presignData.uploadUrl, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });
    if (!putRes.ok) throw new Error("Ошибка загрузки JSON в облако");
    return true;
};

window.__recordTime = function(item) {
    if (!item) return 0;
    const raw = item.editedAt || item.date || item.createdAt || item.profileUpdatedAt || 0;
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : 0;
};

window.__laterIso = function(a, b) {
    const ta = a ? new Date(a).getTime() : 0;
    const tb = b ? new Date(b).getTime() : 0;
    if (tb > ta) return b || a || '';
    return a || b || '';
};

window.__mergeReactions = function(a = {}, b = {}) {
    const out = { ...a };
    Object.keys(b || {}).forEach(emoji => {
        const set = new Set([...(out[emoji] || []), ...(b[emoji] || [])]);
        if (set.size) out[emoji] = Array.from(set);
        else delete out[emoji];
    });
    return out;
};

window.__mergeKeyedArrays = function(a = [], b = [], idKey = 'id') {
    const map = new Map();
    const upsert = (item) => {
        if (!item || item[idKey] == null) return;
        const prev = map.get(item[idKey]);
        if (!prev) { map.set(item[idKey], item); return; }
        const prevT = window.__recordTime(prev);
        const nextT = window.__recordTime(item);
        const newer = nextT >= prevT ? item : prev;
        const older = nextT >= prevT ? prev : item;
        const deleted = !!(newer.deleted || (older.deleted && nextT <= prevT));
        map.set(item[idKey], {
            ...older,
            ...newer,
            deleted: deleted || undefined,
            reactions: window.__mergeReactions(older.reactions, newer.reactions),
            reports: window.__mergeKeyedArrays(older.reports || [], newer.reports || [])
        });
    };
    (a || []).forEach(upsert);
    (b || []).forEach(upsert);
    return Array.from(map.values());
};

window.__profileScalarRev = function(p) {
    if (!p?.profileUpdatedAt) return 0;
    const t = new Date(p.profileUpdatedAt).getTime();
    return Number.isFinite(t) ? t : 0;
};

window.mergeProfilesArrays = function(fresh = [], proposed = []) {
    const out = new Map();
    (fresh || []).forEach(p => {
        if (p?.loginName) out.set(p.loginName, { ...p });
    });
    (proposed || []).forEach(p => {
        if (!p?.loginName) return;
        const cloud = out.get(p.loginName);
        if (!cloud) {
            out.set(p.loginName, { ...p });
            return;
        }
        // Скаляры (bio, avatar, badges…) — только если локальная правка новее по profileUpdatedAt.
        // lastSeen / inbox / notifications / sessions всегда сливаются отдельно, чтобы presence
        // и сообщения не затирали чужие поля.
        const preferProposedScalars = window.__profileScalarRev(p) > window.__profileScalarRev(cloud);
        const merged = preferProposedScalars ? { ...cloud, ...p } : { ...p, ...cloud };
        merged.loginName = p.loginName;
        merged.lastSeen = window.__laterIso(cloud.lastSeen, p.lastSeen);
        merged.profileUpdatedAt = window.__laterIso(cloud.profileUpdatedAt, p.profileUpdatedAt);
        merged.inbox = window.__mergeKeyedArrays(cloud.inbox || [], p.inbox || []);
        merged.notifications = window.__mergeKeyedArrays(cloud.notifications || [], p.notifications || []);
        // Сессии: при явной правке профиля (profileUpdatedAt) берём список целиком,
        // иначе удаление экспедиции снова «воскреснет» из облака при merge по id.
        merged.sessions = preferProposedScalars
            ? (p.sessions || [])
            : window.__mergeKeyedArrays(cloud.sessions || [], p.sessions || []);
        if (!preferProposedScalars) {
            merged.badges = cloud.badges || [];
            merged.bio = cloud.bio;
            merged.avatar = cloud.avatar;
            merged.links = cloud.links;
            merged.gear = cloud.gear;
            merged.email = cloud.email;
            merged.emailVerified = cloud.emailVerified;
            merged.role = cloud.role;
            merged.blocked = cloud.blocked;
            merged.displayName = cloud.displayName || p.displayName;
        }
        out.set(p.loginName, merged);
    });
    return Array.from(out.values());
};

window.__mergeCommentLists = function(a = [], b = []) {
    const map = new Map();
    const upsert = (c) => {
        if (!c?.id) return;
        const prev = map.get(c.id);
        if (!prev) { map.set(c.id, { ...c, replies: [...(c.replies || [])], reactedBy: [...(c.reactedBy || [])] }); return; }
        const prevT = window.__recordTime(prev);
        const nextT = window.__recordTime(c);
        const newer = nextT >= prevT ? c : prev;
        const older = nextT >= prevT ? prev : c;
        map.set(c.id, {
            ...older,
            ...newer,
            replies: window.__mergeKeyedArrays(older.replies || [], newer.replies || []),
            reactedBy: Array.from(new Set([...(older.reactedBy || []), ...(newer.reactedBy || [])]))
        });
    };
    (a || []).forEach(upsert);
    (b || []).forEach(upsert);
    return Array.from(map.values());
};

window.mergeMapDataArrays = function(fresh = [], proposed = []) {
    const map = new Map();
    (fresh || []).forEach(s => { if (s?.id != null) map.set(s.id, s); });
    (proposed || []).forEach(s => {
        if (s?.id == null) return;
        const cloud = map.get(s.id);
        if (!cloud) { map.set(s.id, s); return; }
        if (s.deleted) { map.set(s.id, s); return; }
        if (cloud.deleted && !s.deleted) { map.set(s.id, s); return; }
        map.set(s.id, {
            ...cloud,
            ...s,
            comments: window.__mergeCommentLists(cloud.comments || [], s.comments || []),
            reports: window.__mergeKeyedArrays(cloud.reports || [], s.reports || []),
            likedBy: Array.isArray(s.likedBy) ? s.likedBy : (cloud.likedBy || []),
            dislikedBy: Array.isArray(s.dislikedBy) ? s.dislikedBy : (cloud.dislikedBy || []),
            plays: Math.max(cloud.plays || 0, s.plays || 0),
            downloads: Math.max(cloud.downloads || 0, s.downloads || 0),
            route: (s.route && s.route.length > 1) ? s.route : (cloud.route || s.route)
        });
    });
    return Array.from(map.values());
};

window.mergeFeedPostsArrays = function(fresh = [], proposed = []) {
    const map = new Map();
    const stamp = (p) => new Date(p?.updatedAt || p?.createdAt || 0).getTime();
    (fresh || []).forEach(p => { if (p?.id != null && !p.deleted) map.set(p.id, p); });
    (proposed || []).forEach(p => {
        if (p?.id == null) return;
        if (p.deleted) { map.delete(p.id); return; }
        const cloud = map.get(p.id);
        if (!cloud || stamp(p) >= stamp(cloud)) map.set(p.id, p);
    });
    return Array.from(map.values()).sort((a, b) => stamp(b) - stamp(a));
};

// fileName выбирает JSON-файл в том же бакете: "map_data.json" для звуков (по умолчанию,
// обратная совместимость со всеми существующими вызовами) или "profiles.json" для публичных
// профилей рекордистов (см. window.syncProfilesData ниже).
window.syncCloudData = async function(newCloudData, fileName = "map_data.json") {
    return window.__enqueueCloudWrite(fileName, async () => {
        window.__cloudWriteDepth++;
        try {
            await window.__waitCloudReady();
            const fresh = await window.fetchCloudJson(fileName);
            const proposed = Array.isArray(newCloudData) ? newCloudData : [];

            // Защита от затирания облака пустым массивом до/вместо загрузки
            if (!proposed.length && Array.isArray(fresh) && fresh.length) {
                console.warn(`[sync] Skip empty overwrite for ${fileName}`);
                if (fileName === "map_data.json") {
                    window.mergeData(fresh);
                    window.__lastCloudPollKey = JSON.stringify(fresh);
                }
                return false;
            }

            let merged = proposed;
            if (Array.isArray(fresh)) {
                if (fileName === "profiles.json") merged = window.mergeProfilesArrays(fresh, proposed);
                else if (fileName === "feed.json") merged = window.mergeFeedPostsArrays(fresh, proposed);
                else merged = window.mergeMapDataArrays(fresh, proposed);
            }

            await window.__putCloudJson(fileName, merged);
            window.__lastMergedUpload = { fileName, data: merged };

            if (fileName === "map_data.json") {
                window.mergeData(merged);
                window.initFiltersData();
                window.processFilterChange(false);
                window.__lastCloudPollKey = JSON.stringify(merged);
                if (document.getElementById('cabinet-modal') && !document.getElementById('cabinet-modal').classList.contains('hidden')) {
                    window.renderCabinet();
                }
            } else if (fileName === "feed.json") {
                window.feedPosts = merged.filter(p => !p.deleted);
                window.__lastFeedPollKey = JSON.stringify(window.feedPosts);
                if (window.__sidebarTab === 'feed' && window.renderSidebarFeed) window.renderSidebarFeed();
            }
            return true;
        } catch (e) {
            console.error(e);
            window.showToast("Синхронизация с облаком не удалась.");
            return false;
        } finally {
            window.__cloudWriteDepth = Math.max(0, window.__cloudWriteDepth - 1);
        }
    });
};

// Профили рекордистов синхронизируются тем же presign+PUT механизмом, но в отдельный файл,
// чтобы не смешивать "визитки" пользователей с данными звуков.
window.syncProfilesData = async function(newProfiles) {
    const success = await window.syncCloudData(newProfiles, "profiles.json");
    if (success) {
        const merged = (window.__lastMergedUpload && window.__lastMergedUpload.fileName === "profiles.json")
            ? window.__lastMergedUpload.data
            : newProfiles;
        window.profilesData = merged;
        window.__lastProfilesPollKey = JSON.stringify(merged);
        if (window.refreshNotificationsUI) window.refreshNotificationsUI();
        if (window.refreshMessagesUI) window.refreshMessagesUI();
    }
    return success;
};

window.syncFeedPosts = async function(posts) {
    const success = await window.syncCloudData(posts, "feed.json");
    if (success) {
        const merged = (window.__lastMergedUpload && window.__lastMergedUpload.fileName === "feed.json")
            ? window.__lastMergedUpload.data
            : posts;
        window.feedPosts = (merged || []).filter(p => !p.deleted);
        window.__lastFeedPollKey = JSON.stringify(window.feedPosts);
        if (window.renderSidebarFeed) window.renderSidebarFeed();
    }
    return success;
};

window.isCurrentUserAdmin = function() {
    if (!window.currentUser) return false;
    return String(window.currentUser.role || '').toLowerCase() === 'admin'
        || String(window.currentUser.username || '').toLowerCase() === 'admin'
        || String(window.currentUser.loginName || '').toLowerCase() === 'admin';
};

// Фоновый опрос облака: новые звуки, уведомления, сообщения — без перезагрузки страницы.
window.pollLiveCloudData = async function() {
    if (window.__pollingInFlight || document.hidden) return;
    // Не затираем локальный кэш, пока идёт запись — иначе UI мигает устаревшим снимком.
    if (window.__cloudWriteDepth > 0) return;
    window.__pollingInFlight = true;
    try {
        const [cloudData, profiles, feed] = await Promise.all([
            fetch(`${window.YANDEX_BUCKET_URL}/map_data.json?nocache=${Date.now()}`)
                .then(res => res.ok ? res.json() : null)
                .catch(() => null),
            fetch(`${window.YANDEX_BUCKET_URL}/profiles.json?nocache=${Date.now()}`)
                .then(res => res.ok ? res.json() : null)
                .catch(() => null),
            fetch(`${window.YANDEX_BUCKET_URL}/feed.json?nocache=${Date.now()}`)
                .then(res => res.ok ? res.json() : null)
                .catch(() => null)
        ]);

        if (Array.isArray(cloudData)) {
            const key = JSON.stringify(cloudData);
            if (key !== window.__lastCloudPollKey) {
                window.__lastCloudPollKey = key;
                const playingId = window.currentPlayingId;
                const detailsOpen = (() => {
                    const m = document.getElementById('details-modal');
                    return m && !m.classList.contains('hidden') && !m.classList.contains('opacity-0');
                })();
                window.mergeData(cloudData);
                if (window.initFiltersData) window.initFiltersData();
                if (window.processFilterChange) window.processFilterChange(false);
                if (playingId && detailsOpen) {
                    const s = window.soundsData.find(x => x.id === playingId);
                    if (s && window.renderComments) window.renderComments(s);
                    if (s && window.renderDetailsReactions) window.renderDetailsReactions(s);
                }
                if (window.renderSidebarExpeditions) {
                    const panel = document.getElementById('panel-expeditions');
                    if (panel && !panel.classList.contains('hidden')) window.renderSidebarExpeditions();
                }
            }
        }

        if (Array.isArray(profiles)) {
            const key = JSON.stringify(profiles);
            if (key !== window.__lastProfilesPollKey) {
                window.__lastProfilesPollKey = key;
                window.profilesData = profiles;
                if (window.applyProfileToCurrentUser) window.applyProfileToCurrentUser();
                if (window.refreshNotificationsUI) window.refreshNotificationsUI();
                if (window.refreshMessagesUI) window.refreshMessagesUI();
                if (window.renderSidebarExpeditions) {
                    const panel = document.getElementById('panel-expeditions');
                    if (panel && !panel.classList.contains('hidden')) window.renderSidebarExpeditions();
                }
                // Обновить открытый чат, если идёт переписка
                if (window.__activeMessagePeer && window.openMessageThread) {
                    const thread = document.getElementById('messages-thread');
                    if (thread && !thread.classList.contains('hidden')) {
                        window.openMessageThread(window.__activeMessagePeer, { quiet: true });
                    }
                }
            }
        }

        if (Array.isArray(feed)) {
            const key = JSON.stringify(feed);
            if (key !== window.__lastFeedPollKey) {
                window.__lastFeedPollKey = key;
                window.feedPosts = feed.filter(p => !p.deleted);
                if (window.__sidebarTab === 'feed' && window.renderSidebarFeed) window.renderSidebarFeed();
            }
        }
    } finally {
        window.__pollingInFlight = false;
    }
};

window.startLiveCloudPolling = function(intervalMs = 12000) {
    if (window.__livePollTimer) return;
    window.__livePollTimer = setInterval(() => window.pollLiveCloudData(), intervalMs);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) window.pollLiveCloudData();
    });
    window.addEventListener('focus', () => window.pollLiveCloudData());
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

// --- Привязка звука к автору и видимость по статусу модерации ---
// Новые/отредактированные звуки хранят надёжный recordistId (= login), а старые/сид-данные
// сопоставляются по текстовому имени recordist — оставляем оба пути для совместимости.
window.matchesRecordist = function(sound, login, displayName) {
    if (!sound) return false;
    if (login && sound.recordistId && sound.recordistId === login) return true;
    if (displayName && sound.recordist && sound.recordist.toLowerCase() === String(displayName).toLowerCase()) return true;
    return false;
};

window.getUserSounds = function(login, displayName, { includeAllStatuses = false } = {}) {
    return (window.soundsData || []).filter(s => {
        if (!window.matchesRecordist(s, login, displayName)) return false;
        if (includeAllStatuses) return true;
        return !s.status || s.status === 'published';
    });
};

// Публично (главная карта/список/чужие портфолио) видны только status === 'published';
// автор и админ видят свои pending/rejected записи везде, где идёт прямая работа с ними.
window.isSoundStatusVisible = function(s) {
    if (!s || !s.status || s.status === 'published') return true;
    if (!window.currentUser) return false;
    const isAdmin = String(window.currentUser.role || '').toLowerCase() === 'admin' || String(window.currentUser.username || '').toLowerCase() === 'admin';
    if (isAdmin) return true;
    const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
    return window.matchesRecordist(s, login, window.currentUser.username);
};

// --- Публичные профили рекордистов (общее облачное хранилище profiles.json) ---
window.getProfileByLogin = function(login) {
    if (!login) return null;
    return (window.profilesData || []).find(p => p.loginName === String(login).toLowerCase()) || null;
};
window.getProfileByDisplayName = function(name) {
    if (!name) return null;
    return (window.profilesData || []).find(p => p.displayName && p.displayName.toLowerCase() === String(name).toLowerCase()) || null;
};

// Небольшой каталог бейджей доверия — назначаются вручную из админ-панели (см. auth.js toggleUserBadge).
window.BADGE_CATALOG = {
    verified: { label: 'Проверенный автор', icon: 'fa-shield-halved', cls: 'badge-chip-verified' },
    geophony_expert: { label: 'Эксперт геофонии', icon: 'fa-water', cls: 'badge-chip-geo' },
    biophony_expert: { label: 'Эксперт биофонии', icon: 'fa-leaf', cls: 'badge-chip-bio' },
    anthrophony_expert: { label: 'Эксперт антропофонии', icon: 'fa-city', cls: 'badge-chip-anthro' }
};

window.openPublicProfile = function(login, displayName) {
    const profile = (login && window.getProfileByLogin(login)) || window.getProfileByDisplayName(displayName) || null;
    const finalLogin = login || (profile ? profile.loginName : null);
    const finalName = (profile && profile.displayName) || displayName || 'Рекордист';
    const isOwn = !!window.currentUser && (
        (finalLogin && (window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase()) === finalLogin) ||
        (!finalLogin && window.currentUser.username && window.currentUser.username.toLowerCase() === finalName.toLowerCase())
    );

    window.__publicProfileCtx = { login: finalLogin, displayName: finalName };

    const nameEl = document.getElementById('pp-name');
    if (nameEl) nameEl.textContent = finalName;

    const bioEl = document.getElementById('pp-bio');
    if (bioEl) {
        bioEl.textContent = (profile && profile.bio) || '';
        bioEl.classList.toggle('hidden', !(profile && profile.bio));
    }

    const joinedEl = document.getElementById('pp-joined');
    if (joinedEl) {
        const joinedDate = profile && profile.joinedAt ? new Date(profile.joinedAt) : null;
        joinedEl.innerHTML = joinedDate && !isNaN(joinedDate)
            ? `<i class="fa-solid fa-calendar-days"></i>${joinedDate.toLocaleDateString('ru-RU')}`
            : `<i class="fa-solid fa-calendar-days"></i>—`;
    }

    const avatarEl = document.getElementById('pp-avatar');
    const avatarFallback = document.getElementById('pp-avatar-fallback');
    const avatarSrc = (profile && profile.avatar) || (isOwn && window.currentUser ? window.currentUser.avatar : '');
    if (avatarSrc) {
        if (avatarEl) { avatarEl.src = avatarSrc; avatarEl.classList.remove('hidden'); }
        if (avatarFallback) avatarFallback.classList.add('hidden');
    } else {
        if (avatarEl) avatarEl.classList.add('hidden');
        if (avatarFallback) avatarFallback.classList.remove('hidden');
    }

    const badgesEl = document.getElementById('pp-badges');
    if (badgesEl) {
        const badges = (profile && profile.badges) || [];
        badgesEl.innerHTML = badges.map(key => {
            const b = window.BADGE_CATALOG[key];
            if (!b) return '';
            return `<span class="badge-chip ${b.cls}"><i class="fa-solid ${b.icon}"></i>${b.label}</span>`;
        }).join('');
        badgesEl.classList.toggle('hidden', badges.length === 0);
    }

    const gearEl = document.getElementById('pp-gear');
    if (gearEl) {
        const gear = (profile && profile.gear) || [];
        gearEl.innerHTML = gear.length
            ? gear.map(g => `<span class="gear-chip"><i class="fa-solid fa-walkie-talkie"></i>${g}</span>`).join('')
            : `<span class="text-xs text-slate-400">Список оборудования пока не заполнен</span>`;
    }

    const linksEl = document.getElementById('pp-links');
    if (linksEl) {
        const links = (profile && profile.links) || [];
        linksEl.innerHTML = links.map(url => {
            let host = url;
            try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { /* оставляем как есть, если не полный URL */ }
            return `<a href="${url}" target="_blank" rel="noopener" class="profile-link-chip"><i class="fa-solid fa-arrow-up-right-from-square"></i>${host}</a>`;
        }).join('');
        linksEl.classList.toggle('hidden', links.length === 0);
    }

    const previewBtn = document.getElementById('pp-view-own-note');
    if (previewBtn) previewBtn.classList.toggle('hidden', !isOwn);

    const msgBtn = document.getElementById('pp-message-btn');
    if (msgBtn) msgBtn.classList.toggle('hidden', isOwn || !finalLogin);

    // Экспедиции: организатор + участник
    const expEl = document.getElementById('pp-expeditions');
    if (expEl) {
        const sessions = window.getSessionsForUser ? window.getSessionsForUser(finalLogin) : [];
        if (!sessions.length) {
            expEl.innerHTML = `<p class="text-xs text-slate-400">Экспедиций пока нет</p>`;
        } else {
            expEl.innerHTML = sessions.map(s => {
                const dateStr = s.date ? new Date(s.date).toLocaleDateString('ru-RU') : '';
                return `
                <div class="pp-expedition-card" onclick="window.closePublicProfileModal(); window.setSidebarSessionFilter('${s.id}'); window.switchSidebarTab('expeditions'); const sb=document.getElementById('sidebar'); if(sb&&sb.classList.contains('sidebar-hidden')&&window.toggleSidebar) window.toggleSidebar();">
                    <div class="flex items-center justify-between gap-2">
                        <h5 class="text-xs font-bold text-slate-800 dark:text-white truncate">${s.title}</h5>
                        <span class="pub-status-pill ${s.roleLabel === 'Организатор' ? 'pub-status-published' : 'pub-status-pending'}">${s.roleLabel}</span>
                    </div>
                    ${dateStr || s.route ? `<p class="text-[10px] text-slate-400 mt-0.5 truncate">${dateStr || ''}${dateStr && s.route ? ' · ' : ''}${s.route || ''}</p>` : ''}
                    ${s.ownerId !== finalLogin ? `<p class="text-[10px] text-slate-400 mt-0.5">Орг.: ${s.ownerName}</p>` : ''}
                </div>`;
            }).join('');
        }
    }

    const sounds = window.getUserSounds(finalLogin, finalName, { includeAllStatuses: isOwn });
    window.__publicProfileSounds = sounds;
    window.renderPublicProfileStats(sounds);
    window.setPublicProfileFilter('all');

    const m = document.getElementById('public-profile-modal');
    const c = document.getElementById('public-profile-modal-content');
    if (m && c) {
        m.classList.remove('hidden');
        void m.offsetWidth;
        m.classList.remove('opacity-0', 'pointer-events-none');
        c.classList.remove('scale-95');
    }

    // Рендерим карту после снятия display:none — иначе ymaps инициализируется в контейнере
    // нулевой ширины/высоты и рисует пустое/битое полотно.
    if (window.renderProfileMiniMap) window.renderProfileMiniMap('profile-mini-map', sounds.filter(s => !s.status || s.status === 'published'));
};

window.openProfileAvatarLightbox = function() {
    const avatarEl = document.getElementById('pp-avatar');
    if (!avatarEl || avatarEl.classList.contains('hidden') || !avatarEl.src) return;
    if (window.openLightbox) window.openLightbox([avatarEl.src], 0);
};

window.closePublicProfileModal = function() {
    const m = document.getElementById('public-profile-modal');
    const c = document.getElementById('public-profile-modal-content');
    if (m && c) {
        m.classList.add('opacity-0', 'pointer-events-none');
        c.classList.add('scale-95');
        setTimeout(() => { if (m.classList.contains('opacity-0')) m.classList.add('hidden'); }, 300);
    }
};

window.setPublicProfileFilter = function(eco) {
    window.__publicProfileFilter = eco;
    const all = window.__publicProfileSounds || [];
    const filtered = eco === 'all' ? all : all.filter(s => s.ecoCategory === eco);
    window.renderPortfolioGrid(filtered, 'pp-portfolio-grid');

    ['all', 'geophony', 'biophony', 'anthrophony'].forEach(key => {
        const btn = document.getElementById(`pp-filter-${key}`);
        if (btn) btn.classList.toggle('active', key === eco);
    });
};

window.renderPortfolioGrid = function(sounds, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!sounds || !sounds.length) {
        el.innerHTML = `<p class="analytics-empty">Пока нет записей в этой категории</p>`;
        return;
    }
    el.innerHTML = sounds.map(s => {
        const ecoLabel = window.translations[window.currentLang]?.[`filter_${s.ecoCategory}`] || s.ecoCategory;
        const st = window.STATUS_LABELS && window.STATUS_LABELS[s.status];
        const statusPill = st && s.status !== 'published' ? `<span class="pub-status-pill ${st.cls}">${st.label}</span>` : '';
        const thumb = (s.images && s.images[0]) || `https://picsum.photos/seed/${s.id}/80/80`;
        return `
        <div class="portfolio-card" onclick="window.closePublicProfileModal(); window.selectSound('${s.id}');">
            <div class="portfolio-card-top">
                <span class="portfolio-card-eco eco-${s.ecoCategory}">${ecoLabel}</span>
                ${statusPill}
            </div>
            <div class="portfolio-card-body">
                <img src="${thumb}" alt="" class="portfolio-card-thumb" loading="lazy">
                <div class="min-w-0 flex-1">
                    <h4 class="portfolio-card-title">${s.title}</h4>
                    <div class="portfolio-card-meta"><i class="fa-regular fa-calendar"></i> ${s.date || '—'}</div>
                </div>
            </div>
        </div>`;
    }).join('');
};

window.renderPublicProfileStats = function(sounds) {
    const published = (sounds || []).filter(s => !s.status || s.status === 'published');
    let totalSecs = 0, totalDownloads = 0;
    published.forEach(s => {
        totalSecs += window.parseDuration ? window.parseDuration(s.duration) : 0;
        totalDownloads += s.downloads || 0;
    });
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('pp-stat-count', published.length);
    set('pp-stat-duration', window.formatTotalDuration ? window.formatTotalDuration(totalSecs) : '0:00');
    set('pp-stat-downloads', totalDownloads);
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

        const values = Array.from(set || []).sort();
        if (!values.length) {
            container.innerHTML = '<div class="text-[10px] text-slate-400">Нет данных</div>';
            return;
        }

        const counts = new Map();
        window.soundsData.forEach(sound => {
            const key = String(sound[dataKey] ?? '');
            if (!key) return;
            counts.set(key, (counts.get(key) || 0) + 1);
        });

        const setNameMap = {
            'window.toggleEcoLayer': 'activeEcoLayer',
            'window.toggleUcsCat': 'activeUcsCat',
            'window.toggleUcsSub': 'activeUcsSub',
            'window.togglePrinciple': 'activePrinciple',
            'window.toggleGear': 'activeGear',
            'window.toggleMic': 'activeMic',
            'window.toggleChannels': 'activeChannels',
            'window.toggleLicense': 'activeLicense',
            'window.toggleRecordist': 'activeRecordist',
            'window.toggleWeather': 'activeWeather',
            'window.toggleDate': 'activeDate'
        };

        const setName = setNameMap[toggleFn] || 'activeFilters';
        container.innerHTML = values.map(val => {
            const isActive = window[setName] && window[setName].has(val);
            const count = counts.get(String(val)) || 0;

            let displayName = val;
            if (dataKey === 'ecoCategory' && window.translations[window.currentLang] && window.translations[window.currentLang][`filter_${val}`]) {
                displayName = window.translations[window.currentLang][`filter_${val}`];
            }

            return `<button onclick="${toggleFn}('${val}')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border flex items-center ${isActive ? 'bg-teal-600 text-white border-teal-600 shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}">
                ${icon ? `<i class="fa-solid ${icon} mr-1 opacity-70"></i>` : ''}${displayName} <span class="ml-1 text-[9px] font-normal opacity-60">(${count})</span>
            </button>`;
        }).join('');
    };

    renderMetaSet(window.allExtractedEcoLayers, 'filter-eco-layer', 'window.toggleEcoLayer', 'fa-leaf', 'ecoCategory');
    renderMetaSet(window.allExtractedUcsCats, 'filter-ucs-categories', 'window.toggleUcsCat', 'fa-folder-tree', 'ucsCat');
    renderMetaSet(window.allExtractedSubcats, 'filter-ucs-subcategories', 'window.toggleUcsSub', 'fa-tag', 'typeTag');

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

window.getFilteredSounds = function(forceRefresh = false) {
    const queryEl = document.getElementById('search-input');
    const query = queryEl ? queryEl.value.trim().toLowerCase() : '';
    const cacheKey = `${query}|${window.activeEcoLayer.size}|${Array.from(window.activeEcoLayer).sort().join(',')}|${window.activeUcsCat.size}|${Array.from(window.activeUcsCat).sort().join(',')}|${window.activeUcsSub.size}|${Array.from(window.activeUcsSub).sort().join(',')}|${window.activePrinciple.size}|${Array.from(window.activePrinciple).sort().join(',')}|${window.activeGear.size}|${Array.from(window.activeGear).sort().join(',')}|${window.activeMic.size}|${Array.from(window.activeMic).sort().join(',')}|${window.activeChannels.size}|${Array.from(window.activeChannels).sort().join(',')}|${window.activeLicense.size}|${Array.from(window.activeLicense).sort().join(',')}|${window.activeRecordist.size}|${Array.from(window.activeRecordist).sort().join(',')}|${window.activeWeather.size}|${Array.from(window.activeWeather).sort().join(',')}|${window.activeDate.size}|${Array.from(window.activeDate).sort().join(',')}|session:${window.activeSessionId || ''}`;

    if (!forceRefresh && window.__filteredSoundsCacheKey === cacheKey && window.__filteredSoundsCache) {
        return window.__filteredSoundsCache;
    }

    const filtered = window.soundsData.filter(s => {
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
        const statusMatch = window.isSoundStatusVisible(s);
        const sessionMatch = !window.activeSessionId || s.sessionId === window.activeSessionId;

        return searchMatch && ecoMatch && ucsCatMatch && ucsSubMatch && principleMatch && gearMatch && micMatch && channelMatch && licenseMatch && recordistMatch && weatherMatch && dateMatch && statusMatch && sessionMatch;
    });

    window.__filteredSoundsCache = filtered;
    window.__filteredSoundsCacheKey = cacheKey;
    return filtered;
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
        const thumb = (sound.images && sound.images[0]) || `https://picsum.photos/seed/${sound.id}/72/72`;
        item.innerHTML = `
            <img src="${thumb}" alt="" class="sidebar-sound-thumb" loading="lazy" onerror="this.src='https://picsum.photos/seed/${sound.id}/72/72'">
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

// Видимость pending/rejected звуков зависит от currentUser (см. isSoundStatusVisible), а логин/
// логаут не проходит через mergeData/syncCloudData — сбрасываем кэш фильтра вручную, чтобы карта
// и список сразу отразили звуки, которые стали видимыми/скрытыми после смены пользователя.
window.bustFilteredSoundsCache = function() {
    window.__filteredSoundsCache = null;
    window.__filteredSoundsCacheKey = null;
    if (window.processFilterChange) window.processFilterChange(false);
};

window.processFilterChange = function(forceOpenDesktopSidebar = false) {
    if (window.__filterRenderFrame) cancelAnimationFrame(window.__filterRenderFrame);
    window.__filterRenderFrame = requestAnimationFrame(() => {
        window.__filteredSoundsCache = null;
        window.__filteredSoundsCacheKey = null;
        window.renderFilterPanels();
        window.updateMapMarkers();
        window.renderList();
        window.__filterRenderFrame = null;
    });
}

window.switchSidebarTab = function(tab) {
    const next = ['library', 'feed', 'expeditions'].includes(tab) ? tab : 'library';
    window.__sidebarTab = next;

    const btnLib = document.getElementById('tab-library');
    const btnFeed = document.getElementById('tab-feed');
    const btnExp = document.getElementById('tab-expeditions');
    const panelLib = document.getElementById('sidebar-library');
    const panelFeed = document.getElementById('sidebar-feed');
    const panelExp = document.getElementById('panel-expeditions');
    const searchWrap = document.getElementById('sidebar-search-wrap');

    const activeClass = 'flex-1 py-3 text-[11px] md:text-[12px] font-bold text-blue-600 border-b-2 border-blue-600 transition-colors';
    const inactiveClass = 'flex-1 py-3 text-[11px] md:text-[12px] font-bold text-slate-500 dark:text-slate-400 border-b-2 border-transparent hover:text-slate-800 dark:hover:text-slate-200 transition-colors';

    if (btnLib) btnLib.className = inactiveClass;
    if (btnFeed) btnFeed.className = inactiveClass;
    if (btnExp) btnExp.className = inactiveClass;
    if (panelLib) panelLib.classList.add('hidden');
    if (panelFeed) panelFeed.classList.add('hidden');
    if (panelExp) panelExp.classList.add('hidden');

    if (next === 'feed') {
        if (btnFeed) btnFeed.className = activeClass;
        if (panelFeed) panelFeed.classList.remove('hidden');
        if (searchWrap) searchWrap.classList.add('hidden');
        if (window.renderSidebarFeed) window.renderSidebarFeed();
    } else if (next === 'expeditions') {
        if (btnExp) btnExp.className = activeClass;
        if (panelExp) panelExp.classList.remove('hidden');
        if (searchWrap) searchWrap.classList.add('hidden');
        if (window.renderSidebarExpeditions) window.renderSidebarExpeditions();
    } else {
        if (btnLib) btnLib.className = activeClass;
        if (panelLib) panelLib.classList.remove('hidden');
        if (searchWrap) searchWrap.classList.remove('hidden');
    }
};

window.renderSidebarFeed = function() {
    const container = document.getElementById('sidebar-feed');
    if (!container) return;

    const isAdmin = window.isCurrentUserAdmin && window.isCurrentUserAdmin();
    const posts = (window.feedPosts || []).filter(p => !p.deleted)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const published = (window.soundsData || []).filter(s => !s.status || s.status === 'published');
    const recent = [...published]
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''), 'ru'))
        .slice(0, 4);
    const ecoLabels = { geophony: 'Геофония', biophony: 'Биофония', anthrophony: 'Антропофония' };
    const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const adminBar = isAdmin
        ? `<button type="button" onclick="window.openFeedPostEditor()" class="feed-admin-create"><i class="fa-solid fa-plus mr-1.5"></i>Создать пост</button>`
        : '';

    const postsHtml = posts.length
        ? posts.map(p => {
            const dateStr = p.createdAt ? new Date(p.createdAt).toLocaleDateString('ru-RU') : '';
            const titleStyle = `font-family:${p.titleFont === 'serif' ? 'Georgia, serif' : 'inherit'};font-size:${({ sm: '13px', md: '14px', lg: '16px', xl: '18px' })[p.titleSize] || '14px'}`;
            const adminActions = isAdmin
                ? `<div class="flex gap-1 mt-2" onclick="event.stopPropagation()">
                    <button type="button" onclick="window.openFeedPostEditor('${p.id}')" class="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"><i class="fa-solid fa-pen mr-1"></i>Изменить</button>
                    <button type="button" onclick="window.deleteFeedPost('${p.id}')" class="px-2 py-1 rounded-lg text-[10px] font-bold bg-red-50 dark:bg-red-900/30 text-red-600"><i class="fa-solid fa-trash mr-1"></i>Удалить</button>
                   </div>`
                : '';
            if (p.type === 'article') {
                return `<button type="button" onclick="window.openFeedArticle('${p.id}')" class="feed-card feed-card--post w-full text-left">
                    <div class="feed-card__badge feed-card__badge--article">Статья</div>
                    <p class="feed-card__title" style="${titleStyle}">${esc(p.title)}</p>
                    <p class="feed-card__meta">${esc(p.authorName || 'Админ')}${dateStr ? ' · ' + dateStr : ''} · Читать</p>
                    ${adminActions}
                </button>`;
            }
            return `<div class="feed-card feed-card--notice">
                <div class="feed-card__badge feed-card__badge--notice">Уведомление</div>
                <p class="feed-card__title" style="${titleStyle}">${esc(p.title)}</p>
                ${p.body ? `<p class="feed-card__text">${esc(p.body)}</p>` : ''}
                <p class="feed-card__meta mt-1">${esc(p.authorName || 'Админ')}${dateStr ? ' · ' + dateStr : ''}</p>
                ${adminActions}
            </div>`;
        }).join('')
        : `<p class="text-xs text-slate-400 text-center py-3">Пока нет постов в ленте</p>`;

    const recentHtml = recent.length
        ? recent.map(s => `
            <button type="button" onclick="window.selectSound('${s.id}')" class="feed-card feed-card--sound w-full text-left">
                <div class="feed-card__badge">${ecoLabels[s.ecoCategory] || 'Звук'}</div>
                <p class="feed-card__title">${esc(s.title || 'Без названия')}</p>
                <p class="feed-card__meta">${[s.recordist, s.duration, s.date].filter(Boolean).join(' · ')}</p>
            </button>`).join('')
        : '';

    container.innerHTML = `
        ${adminBar}
        <div class="feed-card feed-card--info">
            <div class="feed-card__badge feed-card__badge--info">О проекте</div>
            <p class="feed-card__title">Аудиокарта Ростовской области</p>
            <p class="feed-card__text">Коллекция полевых звукозаписей: геофония, биофония и антропофония региона.</p>
        </div>
        <div>
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-0.5">Лента</p>
            <div class="flex flex-col gap-2">${postsHtml}</div>
        </div>
        ${recentHtml ? `<div><p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-0.5">Недавние записи</p><div class="flex flex-col gap-2">${recentHtml}</div></div>` : ''}
    `;
};

window.__editingFeedPostId = null;

window.updateFeedPostTypeUI = function() {
    const type = document.querySelector('input[name="feed-post-type"]:checked')?.value || 'notice';
    const noticeBox = document.getElementById('feed-post-notice-fields');
    const articleBox = document.getElementById('feed-post-article-fields');
    if (noticeBox) noticeBox.classList.toggle('hidden', type !== 'notice');
    if (articleBox) articleBox.classList.toggle('hidden', type !== 'article');
};

window.openFeedPostEditor = function(postId = null) {
    if (!window.isCurrentUserAdmin || !window.isCurrentUserAdmin()) {
        window.showToast('Только администратор может создавать посты');
        return;
    }
    window.__editingFeedPostId = postId;
    const post = postId ? (window.feedPosts || []).find(p => p.id === postId) : null;
    const titleEl = document.getElementById('feed-post-title');
    const bodyEl = document.getElementById('feed-post-body');
    const editor = document.getElementById('feed-post-editor');
    const fontEl = document.getElementById('feed-post-title-font');
    const sizeEl = document.getElementById('feed-post-title-size');
    const header = document.getElementById('feed-post-modal-title');

    if (titleEl) titleEl.value = post?.title || '';
    if (bodyEl) bodyEl.value = post?.body || '';
    if (editor) editor.innerHTML = post?.html || '';
    if (fontEl) fontEl.value = post?.titleFont || 'sans';
    if (sizeEl) sizeEl.value = post?.titleSize || 'md';
    document.querySelectorAll('input[name="feed-post-type"]').forEach(r => {
        r.checked = (r.value === (post?.type || 'notice'));
    });
    if (header) header.innerHTML = `<i class="fa-solid fa-pen-to-square mr-2 text-blue-500"></i>${post ? 'Редактировать пост' : 'Новый пост'}`;
    window.updateFeedPostTypeUI();
    window.applyFeedTitlePreview();

    const m = document.getElementById('feed-post-modal');
    const c = document.getElementById('feed-post-modal-content');
    if (!m || !c) return;
    m.classList.remove('hidden');
    void m.offsetWidth;
    m.classList.remove('opacity-0', 'pointer-events-none');
    c.classList.remove('scale-95');
};

window.closeFeedPostModal = function() {
    const m = document.getElementById('feed-post-modal');
    const c = document.getElementById('feed-post-modal-content');
    if (!m || !c) return;
    m.classList.add('opacity-0', 'pointer-events-none');
    c.classList.add('scale-95');
    setTimeout(() => { if (m.classList.contains('opacity-0')) m.classList.add('hidden'); }, 300);
    window.__editingFeedPostId = null;
};

window.applyFeedTitlePreview = function() {
    const titleEl = document.getElementById('feed-post-title');
    const fontEl = document.getElementById('feed-post-title-font');
    const sizeEl = document.getElementById('feed-post-title-size');
    if (!titleEl) return;
    const sizes = { sm: '14px', md: '16px', lg: '20px', xl: '24px' };
    titleEl.style.fontFamily = fontEl?.value === 'serif' ? 'Georgia, "Times New Roman", serif' : 'inherit';
    titleEl.style.fontSize = sizes[sizeEl?.value] || '16px';
};

window.execFeedEditor = function(cmd) {
    const editor = document.getElementById('feed-post-editor');
    if (!editor) return;
    editor.focus();
    document.execCommand(cmd, false, null);
};

window.insertFeedEditorImage = function(files) {
    const file = files && files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const editor = document.getElementById('feed-post-editor');
        if (!editor) return;
        editor.focus();
        document.execCommand('insertHTML', false, `<img src="${e.target.result}" alt="" class="feed-inline-img">`);
    };
    reader.readAsDataURL(file);
    const input = document.getElementById('feed-post-image-input');
    if (input) input.value = '';
};

window.sanitizeFeedHtml = function(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    tmp.querySelectorAll('script,style,iframe,object,embed,link').forEach(el => el.remove());
    tmp.querySelectorAll('*').forEach(el => {
        [...el.attributes].forEach(attr => {
            const name = attr.name.toLowerCase();
            if (name.startsWith('on') || name === 'srcdoc') el.removeAttribute(attr.name);
            if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(attr.value)) el.removeAttribute(attr.name);
        });
    });
    return tmp.innerHTML;
};

window.saveFeedPost = async function() {
    if (!window.isCurrentUserAdmin || !window.isCurrentUserAdmin()) return;
    const type = document.querySelector('input[name="feed-post-type"]:checked')?.value || 'notice';
    const title = (document.getElementById('feed-post-title')?.value || '').trim();
    if (!title) { window.showToast('Укажите заголовок'); return; }

    const body = (document.getElementById('feed-post-body')?.value || '').trim();
    const html = window.sanitizeFeedHtml(document.getElementById('feed-post-editor')?.innerHTML || '');
    if (type === 'notice' && !body) { window.showToast('Добавьте текст уведомления'); return; }
    if (type === 'article' && !html.replace(/<[^>]+>/g, '').trim() && !html.includes('<img')) {
        window.showToast('Добавьте текст или фото в статью');
        return;
    }

    const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
    const now = new Date().toISOString();
    const existingId = window.__editingFeedPostId;
    const post = {
        id: existingId || ('fp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
        type,
        title,
        body: type === 'notice' ? body.slice(0, 400) : '',
        html: type === 'article' ? html : '',
        titleFont: document.getElementById('feed-post-title-font')?.value || 'sans',
        titleSize: document.getElementById('feed-post-title-size')?.value || 'md',
        authorId: login,
        authorName: window.currentUser.username || 'Админ',
        createdAt: existingId
            ? ((window.feedPosts || []).find(p => p.id === existingId)?.createdAt || now)
            : now,
        updatedAt: now
    };

    const next = [...(window.feedPosts || []).filter(p => p.id !== post.id), post];
    const ok = await window.syncFeedPosts(next);
    if (ok) {
        window.closeFeedPostModal();
        window.showToast(existingId ? 'Пост обновлён' : 'Пост опубликован');
        if (window.switchSidebarTab) window.switchSidebarTab('feed');
    }
};

window.deleteFeedPost = async function(postId) {
    if (!window.isCurrentUserAdmin || !window.isCurrentUserAdmin()) return;
    const okConfirm = await window.CustomUI.open({
        title: 'Удалить пост?',
        message: 'Пост исчезнет из ленты для всех пользователей.',
        confirmText: 'Удалить',
        confirmClass: 'px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-md'
    });
    if (!okConfirm) return;
    const next = (window.feedPosts || []).map(p => p.id === postId ? { ...p, deleted: true, updatedAt: new Date().toISOString() } : p);
    const ok = await window.syncFeedPosts(next);
    if (ok) window.showToast('Пост удалён');
};

window.openFeedArticle = function(postId) {
    const post = (window.feedPosts || []).find(p => p.id === postId && p.type === 'article' && !p.deleted);
    if (!post) return;
    const titleEl = document.getElementById('feed-article-title');
    const metaEl = document.getElementById('feed-article-meta');
    const bodyEl = document.getElementById('feed-article-body');
    const sizes = { sm: '1.05rem', md: '1.25rem', lg: '1.5rem', xl: '1.75rem' };
    if (titleEl) {
        titleEl.textContent = post.title || '';
        titleEl.style.fontFamily = post.titleFont === 'serif' ? 'Georgia, "Times New Roman", serif' : 'inherit';
        titleEl.style.fontSize = sizes[post.titleSize] || '1.25rem';
    }
    if (metaEl) {
        const dateStr = post.createdAt ? new Date(post.createdAt).toLocaleString('ru-RU') : '';
        metaEl.textContent = [post.authorName || 'Админ', dateStr].filter(Boolean).join(' · ');
    }
    if (bodyEl) bodyEl.innerHTML = window.sanitizeFeedHtml(post.html || '');

    const m = document.getElementById('feed-article-modal');
    const c = document.getElementById('feed-article-modal-content');
    if (!m || !c) return;
    m.classList.remove('hidden');
    void m.offsetWidth;
    m.classList.remove('opacity-0', 'pointer-events-none');
    c.classList.remove('scale-95');
};

window.closeFeedArticleModal = function() {
    const m = document.getElementById('feed-article-modal');
    const c = document.getElementById('feed-article-modal-content');
    if (!m || !c) return;
    m.classList.add('opacity-0', 'pointer-events-none');
    c.classList.add('scale-95');
    setTimeout(() => { if (m.classList.contains('opacity-0')) m.classList.add('hidden'); }, 300);
};

window.switchFilterTab = function(tab) {
    if (tab === 'expeditions') {
        window.switchSidebarTab('expeditions');
        return;
    }
    if (window.__sidebarTab !== 'library') window.switchSidebarTab('library');

    const btnUcs = document.getElementById('tab-ucs');
    const btnTags = document.getElementById('tab-tags');
    const btnMeta = document.getElementById('tab-meta');
    const panelUcs = document.getElementById('panel-ucs');
    const panelTags = document.getElementById('panel-tags');
    const panelMeta = document.getElementById('panel-meta');
    if (!btnUcs || !btnTags || !btnMeta) return;

    const activeClass = 'flex-1 py-2.5 text-[11px] md:text-[12px] font-bold text-blue-600 border-b-2 border-blue-600 transition-colors';
    const inactiveClass = 'flex-1 py-2.5 text-[11px] md:text-[12px] font-bold text-slate-500 dark:text-slate-400 border-b-2 border-transparent hover:text-slate-800 dark:hover:text-slate-200 transition-colors';

    btnUcs.className = inactiveClass;
    btnTags.className = inactiveClass;
    btnMeta.className = inactiveClass;
    if (panelUcs) panelUcs.classList.add('hidden');
    if (panelTags) panelTags.classList.add('hidden');
    if (panelMeta) panelMeta.classList.add('hidden');

    if (tab === 'tags') {
        btnTags.className = activeClass;
        if (panelTags) panelTags.classList.remove('hidden');
    } else if (tab === 'meta') {
        btnMeta.className = activeClass;
        if (panelMeta) panelMeta.classList.remove('hidden');
    } else {
        btnUcs.className = activeClass;
        if (panelUcs) panelUcs.classList.remove('hidden');
    }
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
        const colorClass = s.ecoCategory === 'geophony' ? 'walker-geo'
            : s.ecoCategory === 'biophony' ? 'walker-bio' : 'walker-anthro';
        if (window.mapAddRouteOverlay) window.mapAddRouteOverlay(s.route, colorClass);
    } else if (window.map) {
        if (window.mapSetView) window.mapSetView(s.lat, s.lng, 15);
        else if (window.map.setCenter) window.map.setCenter([s.lat, s.lng], 15, { duration: 800 });
    }

    window.currentPlayingId = id;
    window.trackSoundPlay(id);
    window.updateMapMarkers();
    const card = document.getElementById('player-card');
    if(card) card.classList.remove('translate-y-[150%]', 'opacity-0');
    document.body.classList.add('player-visible');

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

    if (window.refreshAnalyzerMetersIfOpen) window.refreshAnalyzerMetersIfOpen();
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

    const recordistEl = document.getElementById('det-recordist');
    if (recordistEl) {
        recordistEl.textContent = s.recordist || 'Автор';
        recordistEl.classList.add('cursor-pointer', 'text-blue-600', 'dark:text-blue-400', 'hover:underline');
        recordistEl.title = 'Открыть публичный профиль';
        recordistEl.onclick = () => window.openPublicProfile(s.recordistId, s.recordist);
    }

    const expEl = document.getElementById('det-expedition');
    if (expEl) {
        const session = s.sessionId && window.findSessionById ? window.findSessionById(s.sessionId) : null;
        if (session) {
            expEl.innerHTML = `<span class="cursor-pointer text-blue-600 dark:text-blue-400 hover:underline" onclick="window.openExpeditionViewModal('${session.id}')">${session.title}</span>`;
            expEl.title = 'Открыть описание экспедиции';
        } else {
            expEl.textContent = '—';
            expEl.title = '';
        }
    }

    const playsEl = document.getElementById('det-stat-plays');
    const downloadsEl = document.getElementById('det-stat-downloads');
    if (playsEl) playsEl.textContent = s.plays || 0;
    if (downloadsEl) downloadsEl.textContent = s.downloads || 0;
    window.renderDetailsReactions(s);
    window.cancelReplyToComment();

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
    if (s.url && s.url.length > 10 && !s.url.startsWith('blob:')) {
        window.open(s.url, '_blank');
        window.incrementDownloadCount(s.id);
    }
    else window.showToast("Файл недоступен для скачивания.");
}

// Счётчик скачиваний питает блок доверия в публичном профиле ("статистика скачиваний
// коллегами"). Fire-and-forget синхронизация с облаком — не блокируем сам файл-даунлоад.
window.incrementDownloadCount = function(id) {
    const s = window.soundsData.find(x => x.id === id);
    if (!s) return;
    s.downloads = (s.downloads || 0) + 1;
    const updatedCloud = [...window.cloudDataCache];
    const idx = updatedCloud.findIndex(x => x.id === id);
    if (idx >= 0) updatedCloud[idx] = { ...updatedCloud[idx], downloads: s.downloads };
    else updatedCloud.push(s);
    window.syncCloudData(updatedCloud);
};

// Счётчик прослушиваний питает вкладку "Аналитика" (спрос по нишам/трекам). Дедуплицируем
// по браузерной сессии, чтобы повторные клики по одному маркеру не спамили облако запросами.
window.__playedSoundIds = window.__playedSoundIds || new Set();
window.trackSoundPlay = function(id) {
    if (window.__playedSoundIds.has(id)) return;
    window.__playedSoundIds.add(id);
    const s = window.soundsData.find(x => x.id === id);
    if (!s) return;
    s.plays = (s.plays || 0) + 1;
    const updatedCloud = [...window.cloudDataCache];
    const idx = updatedCloud.findIndex(x => x.id === id);
    if (idx >= 0) updatedCloud[idx] = { ...updatedCloud[idx], plays: s.plays };
    else updatedCloud.push(s);
    window.syncCloudData(updatedCloud);
};

window.renderComments = function(sound) {
    const container = document.getElementById('comments-list');
    if(!container) return;
    if(!sound.comments || sound.comments.length === 0) { container.innerHTML = `<p class="text-sm text-slate-400 italic px-2">Нет комментариев</p>`; return; }

    const login = window.currentUser ? (window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase()) : null;
    const isAdmin = !!window.currentUser && (String(window.currentUser.role || '').toLowerCase() === 'admin' || login === 'admin');
    const esc = s => String(s == null ? '' : s).replace(/'/g, "\\'");

    const renderAuthor = (author, authorId) => {
        const profile = authorId && window.getProfileByLogin ? window.getProfileByLogin(authorId) : null;
        const avatar = profile?.avatar
            ? `<img src="${profile.avatar}" alt="" class="comment-avatar">`
            : `<span class="comment-avatar comment-avatar-fallback"><i class="fa-solid fa-user"></i></span>`;
        const name = authorId
            ? `<span class="comment-author-link" onclick="window.openPublicProfile('${authorId}', '${esc(author)}')">${author}</span>`
            : `<span class="font-bold text-slate-700 dark:text-slate-200">${author}</span>`;
        return `<span class="comment-author-wrap">${avatar}${name}</span>`;
    };

    const renderReply = r => `
        <div class="comment-reply">
            <div class="flex justify-between items-start gap-2 mb-1">
                <span class="text-[12px]">${renderAuthor(r.author, r.authorId)}</span>
                <div class="flex items-center gap-1 shrink-0">
                    <span class="text-[9px] text-slate-400">${r.date}</span>
                    <button onclick="window.openReplyMenu('${sound.id}', '${r.id}')" class="comment-menu-btn" title="Действия">
                        <i class="fa-solid fa-ellipsis"></i>
                    </button>
                </div>
            </div>
            <p class="text-[12px] text-slate-600 dark:text-slate-300">${r.text}</p>
        </div>`;

    container.innerHTML = sound.comments.map(c => {
        const reactedByMe = !!login && (c.reactedBy || []).includes(login);
        const reactionCount = (c.reactedBy || []).length;
        return `
        <div class="bg-slate-100/60 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
            <div class="flex justify-between items-start mb-1.5 gap-2">
                <span class="text-[13px]">${renderAuthor(c.author, c.authorId)}</span>
                <div class="flex items-center gap-1.5 shrink-0">
                    <span class="text-[10px] text-slate-400">${c.date}</span>
                    <button onclick="window.openCommentMenu('${sound.id}', '${c.id}')" class="comment-menu-btn" title="Действия">
                        <i class="fa-solid fa-ellipsis"></i>
                    </button>
                </div>
            </div>
            <p class="text-[13px] text-slate-600 dark:text-slate-300 mb-1.5">${c.text}</p>
            <button onclick="window.toggleCommentReaction('${sound.id}', '${c.id}')" class="comment-reaction-btn ${reactedByMe ? 'active' : ''}">
                <i class="fa-solid fa-heart"></i>${reactionCount > 0 ? reactionCount : ''}
            </button>
            ${(c.replies && c.replies.length) ? `<div class="comment-replies">${c.replies.map(renderReply).join('')}</div>` : ''}
        </div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
}

// Контекст активного ответа: parentCommentId — корневой комментарий, replyToId/author —
// конкретный человек, которому отвечаем (может быть автор корня или вложенного ответа).
window.__replyContext = null;
window.startReplyToComment = function(soundId, commentId, authorName, parentCommentId = null, replyToAuthorId = null) {
    window.__replyContext = {
        soundId,
        parentCommentId: parentCommentId || commentId,
        replyToId: commentId,
        replyToAuthor: authorName,
        replyToAuthorId
    };
    const banner = document.getElementById('comment-reply-banner');
    const label = document.getElementById('comment-reply-target');
    const input = document.getElementById('new-comment-input');
    if (label) label.textContent = authorName;
    if (banner) { banner.classList.remove('hidden'); banner.classList.add('flex'); }
    if (input) {
        input.focus();
        if (!input.value.startsWith('@') && authorName) input.value = `@${authorName} `;
    }
};
window.cancelReplyToComment = function() {
    window.__replyContext = null;
    const banner = document.getElementById('comment-reply-banner');
    if (banner) { banner.classList.add('hidden'); banner.classList.remove('flex'); }
};

window.addComment = async function() {
    const input = document.getElementById('new-comment-input');
    if(!input || !input.value.trim() || !window.currentPlayingId) return; 
    const s = window.soundsData.find(x => x.id === window.currentPlayingId);
    if(s) {
        const now = new Date();
        const dateStr = now.toLocaleDateString(window.currentLang === 'ru' ? 'ru-RU' : 'en-US');
        const createdAt = now.toISOString();
        const authorName = window.currentUser ? window.currentUser.username : (window.currentLang === 'ru' ? 'Гость' : 'Guest');
        const authorId = window.currentUser ? (window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase()) : null;
        const text = input.value.trim();
        const idBase = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

        const replyCtx = (window.__replyContext && window.__replyContext.soundId === s.id) ? window.__replyContext : null;
        let notifyTarget = null;
        let notifType = 'comment';
        let notifText = '';

        if (replyCtx) {
            const parent = (s.comments || []).find(c => c.id === replyCtx.parentCommentId);
            if (parent) {
                parent.replies = parent.replies || [];
                parent.replies.push({
                    id: 'cr' + idBase,
                    author: authorName,
                    authorId,
                    text,
                    date: dateStr,
                    createdAt,
                    replyToId: replyCtx.replyToId,
                    replyToAuthor: replyCtx.replyToAuthor
                });
                notifyTarget = replyCtx.replyToAuthorId || parent.authorId;
                notifType = 'reply';
                notifText = `${authorName} ответил(а) вам в «${s.title}»`;
            }
            window.cancelReplyToComment();
        } else {
            s.comments.push({ id: 'c' + idBase, author: authorName, authorId, text, date: dateStr, createdAt, replies: [], reactedBy: [] });
            notifyTarget = s.recordistId;
            notifType = 'comment';
            notifText = `${authorName} прокомментировал(а) «${s.title}»`;
        }

        input.value = ''; window.renderComments(s);
        let updatedCloud = [...window.cloudDataCache];
        let idx = updatedCloud.findIndex(x => x.id === s.id);
        if(idx >= 0) updatedCloud[idx] = s; else updatedCloud.push(s); 
        await window.syncCloudData(updatedCloud);

        if (notifyTarget && window.pushNotifications) {
            window.pushNotifications([notifyTarget], {
                type: notifType, text: notifText, fromId: authorId, fromName: authorName,
                soundId: s.id, soundTitle: s.title
            });
        }
    }
}

// Меню «...» у комментария — профиль автора / ответить / реакция / пожаловаться.
window.openCommentMenu = function(soundId, commentId) {
    const s = window.soundsData.find(x => x.id === soundId);
    if (!s) return;
    const c = (s.comments || []).find(x => x.id === commentId);
    if (!c) return;
    const login = window.currentUser ? (window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase()) : null;
    const isAdmin = !!window.currentUser && (String(window.currentUser.role || '').toLowerCase() === 'admin' || login === 'admin');
    const reacted = !!login && (c.reactedBy || []).includes(login);

    const items = [];
    if (c.authorId) items.push({ icon: 'fa-id-badge', label: 'Профиль автора', onClick: () => window.openPublicProfile(c.authorId, c.author) });
    items.push({ icon: 'fa-reply', label: 'Ответить', onClick: () => window.startReplyToComment(soundId, commentId, c.author, commentId, c.authorId) });
    items.push({ icon: 'fa-heart', label: reacted ? 'Убрать реакцию' : 'Поставить реакцию', onClick: () => window.toggleCommentReaction(soundId, commentId) });
    items.push({ icon: 'fa-flag', label: 'Пожаловаться', danger: true, onClick: () => window.openReportModal('comment', soundId, commentId) });
    if (isAdmin) {
        items.push({ icon: 'fa-trash-can', label: 'Удалить комментарий', danger: true, onClick: () => window.adminDeleteComment(soundId, commentId) });
    }
    window.ActionSheet.open(items);
};

// Меню у вложенного ответа — чтобы можно было ответить тому, кто ответил вам.
window.openReplyMenu = function(soundId, replyId) {
    const s = window.soundsData.find(x => x.id === soundId);
    if (!s) return;
    let parent = null;
    let reply = null;
    for (const c of (s.comments || [])) {
        const found = (c.replies || []).find(r => r.id === replyId);
        if (found) { parent = c; reply = found; break; }
    }
    if (!parent || !reply) return;
    const login = window.currentUser ? (window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase()) : null;
    const isAdmin = !!window.currentUser && (String(window.currentUser.role || '').toLowerCase() === 'admin' || login === 'admin');

    const items = [];
    if (reply.authorId) items.push({ icon: 'fa-id-badge', label: 'Профиль автора', onClick: () => window.openPublicProfile(reply.authorId, reply.author) });
    items.push({ icon: 'fa-reply', label: 'Ответить', onClick: () => window.startReplyToComment(soundId, replyId, reply.author, parent.id, reply.authorId) });
    items.push({ icon: 'fa-flag', label: 'Пожаловаться', danger: true, onClick: () => window.openReportModal('comment', soundId, parent.id) });
    if (isAdmin) {
        items.push({
            icon: 'fa-trash-can', label: 'Удалить ответ', danger: true,
            onClick: async () => {
                parent.replies = (parent.replies || []).filter(r => r.id !== replyId);
                const updatedCloud = [...window.cloudDataCache];
                const idx = updatedCloud.findIndex(x => x.id === soundId);
                if (idx >= 0) updatedCloud[idx] = s; else updatedCloud.push(s);
                const ok = await window.syncCloudData(updatedCloud);
                if (ok) { window.showToast('Ответ удалён'); window.renderComments(s); }
            }
        });
    }
    window.ActionSheet.open(items);
};

window.adminDeleteComment = async function(soundId, commentId) {
    const s = window.soundsData.find(x => x.id === soundId);
    if (!s) return;
    const confirmed = await window.CustomUI.open({
        title: '<i class="fa-solid fa-trash-can mr-2 text-red-500"></i>Удалить комментарий?',
        message: 'Комментарий и все ответы к нему будут удалены.',
        confirmText: 'Удалить',
        confirmClass: 'px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-md'
    });
    if (!confirmed) return;
    s.comments = (s.comments || []).filter(c => c.id !== commentId);
    const updatedCloud = [...window.cloudDataCache];
    const idx = updatedCloud.findIndex(x => x.id === soundId);
    if (idx >= 0) updatedCloud[idx] = s; else updatedCloud.push(s);
    const success = await window.syncCloudData(updatedCloud);
    if (success) { window.showToast('Комментарий удалён'); window.renderComments(s); }
};

window.toggleCommentReaction = async function(soundId, commentId) {
    if (!window.currentUser) { window.showToast('Войдите, чтобы поставить реакцию'); if (window.openAuthModal) window.openAuthModal(); return; }
    const s = window.soundsData.find(x => x.id === soundId);
    if (!s) return;
    const c = (s.comments || []).find(x => x.id === commentId);
    if (!c) return;
    const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
    c.reactedBy = c.reactedBy || [];
    const idx = c.reactedBy.indexOf(login);
    const adding = idx < 0;
    if (idx >= 0) c.reactedBy.splice(idx, 1); else c.reactedBy.push(login);
    window.renderComments(s);

    const updatedCloud = [...window.cloudDataCache];
    const cIdx = updatedCloud.findIndex(x => x.id === soundId);
    if (cIdx >= 0) updatedCloud[cIdx] = s; else updatedCloud.push(s);
    await window.syncCloudData(updatedCloud);

    if (adding && c.authorId && window.pushNotifications) {
        window.pushNotifications([c.authorId], {
            type: 'reaction',
            text: `${window.currentUser.username} отреагировал(а) на ваш комментарий к «${s.title}»`,
            fromId: login,
            fromName: window.currentUser.username,
            soundId: s.id,
            soundTitle: s.title
        });
    }
};

// Жалоба на метку или на конкретный комментарий — попадает в очередь модерации
// (Кабинет -> Админ-панель -> Жалобы, см. auth.js renderReportsList).
window.openReportModal = async function(type, soundId, commentId = null) {
    if (!window.currentUser) { window.showToast('Войдите, чтобы отправить жалобу'); if (window.openAuthModal) window.openAuthModal(); return; }
    if (!soundId) return;

    const reason = await window.CustomUI.open({
        title: '<i class="fa-solid fa-flag mr-2 text-red-500"></i>Пожаловаться',
        message: type === 'comment' ? 'Опишите, что не так с этим комментарием — жалобу рассмотрят модераторы.' : 'Опишите, что не так с этой записью — жалобу рассмотрят модераторы.',
        confirmText: 'Отправить жалобу',
        confirmClass: 'px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-md',
        showInput: true,
        inputPlaceholder: 'Причина жалобы'
    });
    if (reason === false || !reason) return;

    const s = window.soundsData.find(x => x.id === soundId);
    if (!s) return;
    const report = {
        id: 'rep' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        type,
        commentId: commentId || null,
        reason,
        reporterId: window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase(),
        reporterName: window.currentUser.username,
        date: new Date().toISOString(),
        status: 'pending'
    };
    s.reports = [...(s.reports || []), report];

    const updatedCloud = [...window.cloudDataCache];
    const idx = updatedCloud.findIndex(x => x.id === soundId);
    if (idx >= 0) updatedCloud[idx] = s; else updatedCloud.push(s);
    const success = await window.syncCloudData(updatedCloud);
    window.showToast(success ? 'Жалоба отправлена модераторам' : 'Не удалось отправить жалобу');

    if (success && window.notifyAdmins) {
        window.notifyAdmins({
            type: 'report',
            text: `${report.reporterName} пожаловался(ась) на ${type === 'comment' ? 'комментарий к' : ''} «${s.title}»: ${reason}`,
            fromId: report.reporterId,
            fromName: report.reporterName,
            soundId: s.id,
            soundTitle: s.title
        });
    }
};

// Лайк/дизлайк метки — взаимоисключающий тумблер (голос за один автоматически снимает другой).
window.toggleSoundReaction = async function(kind) {
    if (!window.currentUser) { window.showToast('Войдите, чтобы оценить запись'); if (window.openAuthModal) window.openAuthModal(); return; }
    const s = window.soundsData.find(x => x.id === window.currentPlayingId);
    if (!s) return;
    const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
    s.likedBy = s.likedBy || []; s.dislikedBy = s.dislikedBy || [];
    const other = kind === 'like' ? s.dislikedBy : s.likedBy;
    const target = kind === 'like' ? s.likedBy : s.dislikedBy;
    const oi = other.indexOf(login); if (oi >= 0) other.splice(oi, 1);
    const ti = target.indexOf(login);
    const adding = ti < 0;
    if (ti >= 0) target.splice(ti, 1); else target.push(login);
    window.renderDetailsReactions(s);

    const updatedCloud = [...window.cloudDataCache];
    const idx = updatedCloud.findIndex(x => x.id === s.id);
    if (idx >= 0) updatedCloud[idx] = s; else updatedCloud.push(s);
    await window.syncCloudData(updatedCloud);

    if (adding && s.recordistId && window.pushNotifications) {
        if (kind === 'like') {
            window.pushNotifications([s.recordistId], {
                type: 'like',
                text: `${window.currentUser.username} оценил(а) вашу запись «${s.title}»`,
                fromId: login,
                fromName: window.currentUser.username,
                soundId: s.id,
                soundTitle: s.title
            });
        } else {
            window.pushNotifications([s.recordistId], {
                type: 'dislike',
                text: `${window.currentUser.username} поставил(а) дизлайк записи «${s.title}»`,
                fromId: login,
                fromName: window.currentUser.username,
                soundId: s.id,
                soundTitle: s.title
            });
        }
    }
};

window.renderDetailsReactions = function(s) {
    const login = window.currentUser ? (window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase()) : null;
    const likeBtn = document.getElementById('det-like-btn');
    const dislikeBtn = document.getElementById('det-dislike-btn');
    const likeCount = document.getElementById('det-like-count');
    const dislikeCount = document.getElementById('det-dislike-count');
    if (likeCount) likeCount.textContent = (s.likedBy || []).length;
    if (dislikeCount) dislikeCount.textContent = (s.dislikedBy || []).length;
    if (likeBtn) likeBtn.classList.toggle('active', !!login && (s.likedBy || []).includes(login));
    if (dislikeBtn) dislikeBtn.classList.toggle('active', !!login && (s.dislikedBy || []).includes(login));
};

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
    if (!cat || !subcatSelect) return;

    const selectedCat = cat.value || 'AMBIENCE';
    const structure = window.ucsStructure || {};
    const options = structure[selectedCat] || [];

    subcatSelect.innerHTML = options.map(sub => `<option value="${sub.id}">${sub.name}</option>`).join('');
    if (typeof window.generateUCSFileName === 'function') {
        window.generateUCSFileName();
    }
}

window.generateUCSFileName = function() {
    const subcat = document.getElementById('add-subcat') ? document.getElementById('add-subcat').value : 'USER';
    const userDef = window.transliterate(document.getElementById('add-user-defined').value || 'NewSound').replace(/\s+/g, '_');
    const rec = window.transliterate(document.getElementById('add-recordist').value || 'Anon').replace(/\s+/g, '');
    if (document.getElementById('add-file-name')) document.getElementById('add-file-name').value = `${subcat}_${userDef}_${rec}_ST.wav`;
}
// Фото прикладываются как base64 (как и images у сид-данных) — без отдельного аплоада в бакет,
// max 3 шт., превью рисуется в тот же .image-preview-grid, что уже был в вёрстке.
window.handleImageFilesWrapper = function(files) {
    if (!files || !files.length) return;
    window.pendingImages = window.pendingImages || [];
    const remaining = Math.max(0, 3 - window.pendingImages.length);
    if (remaining === 0) { window.showToast('Можно прикрепить максимум 3 фото'); return; }

    const toProcess = Array.from(files).slice(0, remaining);
    let loaded = 0;
    toProcess.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            window.pendingImages.push(e.target.result);
            loaded++;
            if (loaded === toProcess.length) window.renderPendingImagesPreview();
        };
        reader.readAsDataURL(file);
    });
};

window.renderPendingImagesPreview = function() {
    const container = document.getElementById('image-preview-container');
    if (!container) return;
    const images = window.pendingImages || [];
    if (!images.length) { container.innerHTML = ''; container.classList.add('hidden'); return; }
    container.classList.remove('hidden');
    container.innerHTML = images.map((src, i) => `
        <div class="relative">
            <img src="${src}" class="image-thumb">
            <button type="button" onclick="event.stopPropagation(); window.removePendingImage(${i})" class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] shadow-md">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `).join('');
};

window.removePendingImage = function(index) {
    if (!window.pendingImages) return;
    window.pendingImages.splice(index, 1);
    window.renderPendingImagesPreview();
};

// targetStatus: 'pending' (кнопка "Опубликовать") или 'draft' (кнопка "Черновик").
// Логика перехода статусов при редактировании — см. комментарий у поля status ниже.
window.publishSound = async function(targetStatus = 'pending') {
    if (!window.currentUser) { window.showToast('Войдите, чтобы опубликовать звук'); return; }

    const val = elId => (document.getElementById(elId)?.value || '').trim();
    const coords = window.tempAddCoords || window.parseCoordinateString(val('add-coords'));
    if (!coords) { window.showToast('Выберите точку на карте перед публикацией'); return; }
    const title = val('add-display-title') || val('add-user-defined') || 'Новая запись';

    const isEdit = !!window.editingSoundId;
    const existing = isEdit ? window.soundsData.find(x => x.id === window.editingSoundId) : null;
    if (isEdit && !existing) { window.showToast('Редактируемый звук не найден'); return; }

    const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
    const btn = document.getElementById('publish-btn');
    const draftBtn = document.getElementById('draft-btn');
    if (btn) btn.disabled = true;
    if (draftBtn) draftBtn.disabled = true;
    window.showToast(targetStatus === 'draft' ? 'Сохранение черновика...' : (isEdit ? 'Сохранение изменений...' : 'Публикация...'));

    const soundObj = {
        id: existing ? existing.id : ('u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)),
        title,
        ecoCategory: val('add-eco') || 'anthrophony',
        ucsCat: val('add-category') || 'AMBIENCE',
        typeTag: val('add-subcat'),
        lat: coords[0], lng: coords[1],
        duration: existing?.duration || '0:00',
        url: window.currentUploadedFileUrl || existing?.url || '',
        semanticTag: existing?.semanticTag || '',
        gear: val('add-recorder'),
        date: val('add-date'),
        time: val('add-time'),
        description: val('add-desc'),
        comments: existing?.comments || [],
        keywords: val('add-tags'),
        micType: val('add-mic'),
        recPrinciple: val('add-principle'),
        format: val('add-format'),
        channels: val('add-channels'),
        weather: val('add-weather'),
        location: val('add-loc'),
        recordist: window.currentUser.username,
        recordistId: login,
        license: val('add-license'),
        fileName: val('add-file-name'),
        images: (window.pendingImages && window.pendingImages.length) ? [...window.pendingImages] : (existing?.images || []),
        route: window.isSoundwalkPrinciple()
            ? ((window.addModalRoute && window.addModalRoute.length > 1) ? [...window.addModalRoute] : (existing?.route || undefined))
            : undefined,
        sessionId: val('add-session') || null,
        createdAt: existing?.createdAt || new Date().toISOString(),
        // Черновик остаётся черновиком до явной публикации; уже прошедшую модерацию запись
        // редактирование метаданных не трогает (кнопка "Опубликовать" тут работает как "Сохранить").
        // Только переход draft -> pending образует настоящую отправку на модерацию.
        status: targetStatus === 'draft'
            ? 'draft'
            : (isEdit ? (existing.status === 'draft' ? 'pending' : (existing.status || 'published')) : 'pending'),
        downloads: existing?.downloads || 0,
        plays: existing?.plays || 0,
        likedBy: existing?.likedBy || [],
        dislikedBy: existing?.dislikedBy || [],
        reports: existing?.reports || [],
        rejectionReason: existing && existing.status === 'draft' ? '' : (existing?.rejectionReason || ''),
        seenByAuthor: true
    };

    if (window.isSoundwalkPrinciple() && (!soundObj.route || soundObj.route.length < 2)) {
        if (btn) btn.disabled = false;
        if (draftBtn) draftBtn.disabled = false;
        window.showToast('Для звуковой прогулки нарисуйте маршрут (минимум 2 точки)');
        return;
    }

    let updatedCloud = [...window.cloudDataCache];
    const idx = updatedCloud.findIndex(x => x.id === soundObj.id);
    if (idx >= 0) updatedCloud[idx] = soundObj; else updatedCloud.push(soundObj);

    const success = await window.syncCloudData(updatedCloud);
    if (btn) btn.disabled = false;
    if (draftBtn) draftBtn.disabled = false;

    if (success) {
        const msg = soundObj.status === 'draft' ? 'Черновик сохранён!' : (isEdit ? 'Изменения сохранены!' : 'Звук отправлен на модерацию!');
        window.showToast(msg);
        window.toggleAddModal(true);
    }
};

// Заполняет выпадающий список сессий в модалке добавления. selectedId (если передан) выбирается
// сразу — используется после создания новой сессии прямо из модалки.
window.populateSessionSelect = function(selectedId = '') {
    const select = document.getElementById('add-session');
    if (!select) return;
    const sessions = window.getMySessions ? window.getMySessions() : [];
    select.innerHTML = '<option value="">Без сессии</option>' +
        sessions.map(s => `<option value="${s.id}">${s.title}</option>`).join('');
    select.value = selectedId || '';
};

// Открывает модалку "Добавить аудио" в режиме редактирования существующей записи —
// поля заполняются текущими данными звука, а publishSound() ниже патчит, а не создаёт новую.
window.editSound = function(id) {
    const s = window.soundsData.find(x => x.id === id);
    if (!s) { window.showToast('Звук не найден'); return; }

    window.editingSoundId = id;
    window.pendingImages = Array.isArray(s.images) ? [...s.images] : [];
    window.currentUploadedFile = null;
    window.currentUploadedFileUrl = s.url || '';
    window.tempAddCoords = [s.lat, s.lng];

    const setVal = (elId, v) => { const el = document.getElementById(elId); if (el) el.value = v ?? ''; };

    setVal('add-user-defined', s.title || '');
    setVal('add-display-title', s.title || '');
    setVal('add-desc', s.description || '');
    setVal('add-eco', s.ecoCategory || 'anthrophony');
    setVal('add-category', s.ucsCat || 'AMBIENCE');
    window.updateUcsSubcats();
    setVal('add-subcat', s.typeTag || '');
    setVal('add-tags', s.keywords || '');
    setVal('add-loc', s.location || '');
    setVal('add-coords', `${Number(s.lat).toFixed(5)}, ${Number(s.lng).toFixed(5)}`);
    setVal('add-date', s.date || '');
    setVal('add-time', s.time || '');
    setVal('add-weather', s.weather || 'Ясно (Clear)');
    setVal('add-principle', s.recPrinciple || 'Направленная фиксация (Spot)');
    setVal('add-recorder', s.gear || '');
    setVal('add-mic', s.micType || '');
    setVal('add-format', s.format || '');
    setVal('add-channels', s.channels || 'Stereo XY');
    setVal('add-recordist', s.recordist || (window.currentUser ? window.currentUser.username : ''));
    setVal('add-license', s.license || 'CC BY 4.0');
    setVal('add-file-name', s.fileName || '');

    window.addModalRoute = (s.route && s.route.length) ? s.route.map(p => [...p]) : [];
    window.handlePrincipleChange(s.recPrinciple || '');

    window.populateSessionSelect(s.sessionId || '');
    const draftBtnEl = document.getElementById('draft-btn');
    // Кнопка "Черновик" уместна только пока запись сама остаётся черновиком —
    // для уже отправленных/опубликованных/отклонённых записей повторный черновик не имеет смысла.
    if (draftBtnEl) draftBtnEl.classList.toggle('hidden', s.status !== 'draft');

    window.renderPendingImagesPreview();

    const dropContent = document.getElementById('drop-zone-content');
    if (dropContent) dropContent.innerHTML = s.url
        ? `<i class="fa-solid fa-file-waveform text-4xl text-blue-400 mb-3"></i><span class="text-sm font-bold text-slate-500 dark:text-slate-400">Аудиофайл уже сохранён. Выберите новый, чтобы заменить.</span>`
        : `<i class="fa-solid fa-cloud-arrow-up text-4xl text-slate-300 dark:text-slate-500 mb-3"></i><span class="text-sm font-bold text-slate-500 dark:text-slate-400">Нажмите или перетащите аудиофайл (.wav)</span>`;

    const headerTitle = document.getElementById('add-modal-header-title');
    if (headerTitle) headerTitle.innerHTML = `<i class="fa-solid fa-pen mr-2 text-blue-600"></i>Редактировать запись`;
    const publishText = document.getElementById('publish-btn-text');
    if (publishText) publishText.textContent = 'Сохранить изменения';

    window.toggleAddModal(false, null, true);
};

window.resetAddModalToCreateMode = function() {
    window.editingSoundId = null;
    window.pendingImages = [];
    window.currentUploadedFile = null;
    window.currentUploadedFileUrl = '';
    window.tempAddCoords = null;
    window.addModalRoute = [];
    window.updateSoundwalkRouteUI();

    const headerTitle = document.getElementById('add-modal-header-title');
    if (headerTitle) headerTitle.innerHTML = `<i class="fa-solid fa-file-audio mr-2 text-blue-600"></i><span data-lang="add_audio_title">Добавить аудио</span>`;
    const publishText = document.getElementById('publish-btn-text');
    if (publishText) publishText.textContent = 'Опубликовать звук';

    const dropContent = document.getElementById('drop-zone-content');
    if (dropContent) dropContent.innerHTML = `<i class="fa-solid fa-cloud-arrow-up text-4xl text-slate-300 dark:text-slate-500 mb-3"></i><div class="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 mb-2"><span class="text-sm font-bold" data-lang="drag_drop">Нажмите или перетащите аудиофайл (.wav)</span></div>`;

    const imgContainer = document.getElementById('image-preview-container');
    if (imgContainer) { imgContainer.innerHTML = ''; imgContainer.classList.add('hidden'); }

    ['add-user-defined', 'add-display-title', 'add-desc', 'add-tags', 'add-loc', 'add-coords', 'add-date', 'add-time'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const fileNameEl = document.getElementById('add-file-name');
    if (fileNameEl) fileNameEl.value = 'AMB_Loc_Tag_Anon.wav';
    const recEl = document.getElementById('add-recordist');
    if (recEl) recEl.value = window.currentUser ? window.currentUser.username : '';
    const principleEl = document.getElementById('add-principle');
    if (principleEl) principleEl.value = 'Направленная фиксация (Spot)';

    window.populateSessionSelect();
    const draftBtnEl = document.getElementById('draft-btn');
    if (draftBtnEl) draftBtnEl.classList.remove('hidden');
};

// ИЗМЕНЕНО: Принимаем координаты при клике ПКМ; isEdit=true пропускает сброс в режим "создания",
// чтобы editSound() выше мог открыть модалку, уже предзаполненную данными редактируемого звука.
window.toggleAddModal = function(forceClose = false, coords = null, isEdit = false) {
    const m = document.getElementById('add-modal');
    const c = document.getElementById('add-modal-content');
    const coordsInput = document.getElementById('add-coords');

    if (!window.currentUser) {
        window.showToast('Нужно войти в аккаунт, чтобы добавлять звук');
        if (window.openAuthModal) window.openAuthModal();
        return;
    }

    if (m && m.classList.contains('hidden') && !forceClose) {
        if (!isEdit) window.resetAddModalToCreateMode();

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
    window.resetAddModalToCreateMode();
}
window.closeAddModalSafely = function() { window.toggleAddModal(true); }

// UI System Callbacks
window.setMapStyle = function(style, skipSave = false) {
    const mapContainer = document.getElementById('map');
    window.currentMapStyle = style;
    if(!mapContainer) return;
    if (style === 'monochrome') mapContainer.classList.add('map-monochrome');
    else mapContainer.classList.remove('map-monochrome');
    if (!skipSave && window.saveUserSettings) window.saveUserSettings('mapStyle', style);
    if (window.refreshSettingsUI) window.refreshSettingsUI();
}
window.changeGUISize = function(size, skipSave = false) {
    const scales = { small: '14px', medium: '16px', large: '18px' };
    window.currentGuiScale = size;
    document.documentElement.style.fontSize = scales[size];
    if (!skipSave && window.saveUserSettings) window.saveUserSettings('guiScale', size);
    if (window.refreshSettingsUI) window.refreshSettingsUI();
}
window.setLanguage = function(lang, skipSave = false) {
    window.currentLang = lang; window.renderList();
    if (!skipSave && window.saveUserSettings) window.saveUserSettings('lang', lang);
    if (window.refreshSettingsUI) window.refreshSettingsUI();
}
window.setTheme = function(theme, skipSave = false) {
    window.currentTheme = theme;
    const root = document.documentElement;
    if (theme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
    } else {
        root.classList.remove('dark');
        root.classList.add('light');
    }
    if (!skipSave && window.saveUserSettings) window.saveUserSettings('theme', theme);
    if (window.refreshSettingsUI) window.refreshSettingsUI();
    if (window.refreshAnalyzersTheme) window.refreshAnalyzersTheme();
}
window.toggleSidebar = function() {
    const s = document.getElementById('sidebar');
    if(!s) return;
    s.classList.toggle('sidebar-hidden');
    const isHidden = s.classList.contains('sidebar-hidden');

    const backdrop = document.getElementById('sidebar-backdrop');
    if (backdrop && window.innerWidth < 768) backdrop.classList.toggle('visible', !isHidden);

    if(window.innerWidth >= 768) {
        const playerCard = document.getElementById('player-card');
        if(playerCard) { if (isHidden) { playerCard.style.marginLeft = '0'; } else { playerCard.style.marginLeft = '25.5rem'; } }
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

        // Swipe-to-navigate only makes sense while the card's own content fits on screen.
        // Once the analyzers panel expands the card into a scrollable sheet, a vertical
        // drag must scroll that content instead of closing the player or opening details.
        const isSwipeNavBlocked = (e) => {
            if (window.analyzersOpen) return true;
            if (e.target.closest('#ambi-sphere-pad') || e.target.closest('#player-analyzers')) return true;
            if (e.target.tagName.toLowerCase() === 'input') return true;
            return false;
        };

        playerCardEl.addEventListener('touchstart', e => {
            if (isSwipeNavBlocked(e)) { playerTouchActive = false; return; }
            playerTouchStartY = e.touches[0].screenY;
            playerTouchActive = true;
        }, { passive: true });

        playerCardEl.addEventListener('touchend', e => {
            if (!playerTouchActive) return;
            playerTouchActive = false;
            if (isSwipeNavBlocked(e)) return;

            const playerTouchEndY = e.changedTouches[0].screenY;
            const diffY = playerTouchEndY - playerTouchStartY;
            if (Math.abs(diffY) > 50) {
                if (diffY > 0) window.closePlayerCard();
                else window.openDetailsModal();
            }
        }, { passive: true });

        // Mouse-drag equivalent for desktop: click-drag up/down on the card mirrors the
        // mobile swipe (open details / close player), so the gesture isn't phone-only.
        let playerMouseStartY = 0;
        let playerMouseActive = false;

        playerCardEl.addEventListener('mousedown', e => {
            if (isSwipeNavBlocked(e)) { playerMouseActive = false; return; }
            playerMouseStartY = e.clientY;
            playerMouseActive = true;
        });

        window.addEventListener('mouseup', e => {
            if (!playerMouseActive) return;
            playerMouseActive = false;
            if (isSwipeNavBlocked(e)) return;

            const diffY = e.clientY - playerMouseStartY;
            if (Math.abs(diffY) > 50) {
                if (diffY > 0) window.closePlayerCard();
                else window.openDetailsModal();
            }
        });
    }
};