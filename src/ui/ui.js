/** Cheap change key for poll/sync — avoids JSON.stringify of whole datasets on the main thread. */
window.fingerprintDataset = function(arr) {
    if (!Array.isArray(arr)) return 'x';
    const n = arr.length;
    let h = (n * 2654435761) >>> 0;
    let maxTs = 0;
    let extras = 0;
    for (let i = 0; i < n; i++) {
        const item = arr[i];
        if (!item || typeof item !== 'object') continue;
        const id = String(item.id || item.loginName || i);
        for (let j = 0; j < id.length; j++) h = (Math.imul(h, 31) + id.charCodeAt(j)) >>> 0;
        const tsRaw = item.editedAt || item.updatedAt || item.profileUpdatedAt
            || item.joinedAt || item.createdAt || item.at || item.lastSeen || '';
        if (tsRaw) {
            const t = typeof tsRaw === 'number' ? tsRaw : (Date.parse(tsRaw) || 0);
            if (t > maxTs) maxTs = t;
        }
        if (item.deleted) extras += 9973;
        if (item.plays != null) extras += (item.plays | 0) * 17;
        if (item.downloads != null) extras += (item.downloads | 0) * 19;
        if (Array.isArray(item.comments)) extras += item.comments.length * 23;
        if (Array.isArray(item.likedBy)) extras += item.likedBy.length * 29;
        if (Array.isArray(item.dislikedBy)) extras += item.dislikedBy.length * 31;
        if (Array.isArray(item.inbox)) extras += item.inbox.length * 1009;
        if (Array.isArray(item.notifications)) extras += item.notifications.length * 1013;
        if (item.typing && item.typing.at) {
            extras += String(item.typing.at).length * 37 + String(item.typing.to || '').length * 41;
        }
        if (item.status) {
            const st = String(item.status);
            for (let j = 0; j < st.length; j++) h = (Math.imul(h, 31) + st.charCodeAt(j)) >>> 0;
        }
    }
    h = (h + extras) >>> 0;
    return `${n}:${maxTs}:${h.toString(36)}`;
};

window.showToast = function(message, opts = {}) {
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
    if (opts.silent) return;
    if (window.playSfx) {
        const kind = opts.sfx || (window.sfxFromToastMessage ? window.sfxFromToastMessage(message) : 'toast');
        window.playSfx(kind, { throttleMs: 140 });
    }
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
            ? 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800'
            : tag.type === 'ucsSub'
                ? 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800/50 dark:text-stone-300 dark:border-stone-600'
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
        { value: stats.total, label: 'Записей', color: 'text-[#ff5a3d] dark:text-[#ff7a5c]' },
        { value: stats.withAudio, label: 'С аудио', color: 'text-stone-600 dark:text-stone-300' },
        { value: stats.recordists, label: 'Авторов', color: 'text-slate-700 dark:text-slate-300' },
        { value: window.formatTotalDuration(stats.totalSecs), label: 'Длительность', color: 'text-amber-600 dark:text-amber-400' },
        { value: stats.byEco.geophony, label: 'Геофония', color: 'text-sky-600 dark:text-sky-400' },
        { value: stats.byEco.biophony, label: 'Биофония', color: 'text-orange-700 dark:text-orange-300' },
        { value: stats.byEco.anthrophony, label: 'Антропофония', color: 'text-stone-600 dark:text-stone-300' },
        { value: stats.topUcs[0] ? stats.topUcs[0][0] : '—', label: stats.topUcs[0] ? `Топ UCS (${stats.topUcs[0][1]})` : 'Топ UCS', color: 'text-violet-600 dark:text-violet-400' }
    ];
    grid.innerHTML = cards.map(c => `
        <div class="stat-card">
            <div class="stat-value ${c.color}" title="${String(c.value).replace(/"/g, '&quot;')}">${c.value}</div>
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

window.onboardingStepsRu = [
    {
        target: null,
        title: 'Аудиокарта Ростовской области',
        text: 'Слушайте полевые записи прямо на карте. Три коротких шага — и вы в деле.'
    },
    {
        mapHint: true,
        title: 'Нажмите на метку',
        text: 'Каждая точка на карте — звук. Тапните по маркеру, чтобы послушать запись.'
    },
    {
        target: '#fab-add-sound',
        title: 'Меню и свои записи',
        text: 'Меню слева — библиотека и экспедиции. Кнопка «+» — добавить звук. На телефоне удерживайте палец на карте, чтобы поставить метку.'
    }
];
window.onboardingStepsEn = [
    {
        target: null,
        title: 'Rostov Region audio map',
        text: 'Listen to field recordings right on the map. Three short steps — and you’re in.'
    },
    {
        mapHint: true,
        title: 'Tap a marker',
        text: 'Every pin on the map is a sound. Tap a marker to listen.'
    },
    {
        target: '#fab-add-sound',
        title: 'Menu and your uploads',
        text: 'The left menu opens the library and expeditions. The “+” button adds a sound. On mobile, long-press the map to place a pin.'
    }
];
Object.defineProperty(window, 'onboardingSteps', {
    get() { return window.currentLang === 'en' ? window.onboardingStepsEn : window.onboardingStepsRu; }
});

window.startOnboarding = function(step = 0) {
    const overlay = document.getElementById('onboarding-overlay');
    if (!overlay) return;

    const sb = document.getElementById('sidebar');
    if (window.innerWidth < 768 && sb && !sb.classList.contains('sidebar-hidden')) window.toggleSidebar();
    if (window.closePlayerCard) window.closePlayerCard();
    window.__onboardingDemoPlayer = false;

    window.__onboardingStep = step;
    overlay.classList.remove('hidden');
    overlay.classList.add('pointer-events-auto');
    if (window.playSfx) window.playSfx('whoosh');
    window.updateOnboardingStep();
};

window.cleanupOnboardingPlayer = function() {
    if (!window.__onboardingDemoPlayer) return;
    window.__onboardingDemoPlayer = false;
    if (window.closePlayerCard) window.closePlayerCard();
};

window.updateOnboardingStep = function() {
    const step = window.onboardingSteps[window.__onboardingStep || 0];
    const overlay = document.getElementById('onboarding-overlay');
    const highlight = document.getElementById('onboarding-highlight');
    const card = document.getElementById('onboarding-card');
    if (!step || !overlay || !highlight || !card) return;

    document.getElementById('onboarding-step-label').textContent = `${window.t('tour_step')} ${window.__onboardingStep + 1} / ${window.onboardingSteps.length}`;
    document.getElementById('onboarding-title').textContent = step.title;
    document.getElementById('onboarding-text').textContent = step.text;

    const prevBtn = document.getElementById('onboarding-prev');
    if (prevBtn) prevBtn.style.visibility = window.__onboardingStep === 0 ? 'hidden' : 'visible';

    const nextBtn = document.getElementById('onboarding-next');
    if (nextBtn) nextBtn.textContent = window.__onboardingStep === window.onboardingSteps.length - 1 ? window.t('tour_done') : window.t('tour_next');

    const placeCardCentered = () => {
        highlight.style.opacity = '0';
        highlight.style.pointerEvents = 'none';
        highlight.style.borderRadius = '1.5rem';
        card.style.left = '50%';
        card.style.top = '50%';
        card.style.transform = 'translate(-50%, -50%)';
    };

    const placeCardNear = (rect, opts = {}) => {
        const pad = opts.pad ?? 8;
        highlight.style.opacity = '1';
        highlight.style.display = 'block';
        highlight.style.pointerEvents = 'none';
        highlight.style.borderRadius = opts.round || '1.5rem';
        highlight.style.left = `${rect.left - pad}px`;
        highlight.style.top = `${rect.top - pad}px`;
        highlight.style.width = `${rect.width + pad * 2}px`;
        highlight.style.height = `${rect.height + pad * 2}px`;

        requestAnimationFrame(() => {
            const cardRect = card.getBoundingClientRect();
            const cardWidth = cardRect.width || 320;
            const cardHeight = cardRect.height || 180;
            const margin = 16;
            const topSafe = Math.max(margin, (window.visualViewport && window.visualViewport.offsetTop) || 0);

            let top = rect.bottom + 16;
            let left = rect.left;

            if (top + cardHeight > window.innerHeight - margin) {
                top = rect.top - cardHeight - 16;
            }
            if (window.innerWidth < 640) {
                left = (window.innerWidth - cardWidth) / 2;
            } else {
                if (left + cardWidth > window.innerWidth - margin) left = window.innerWidth - cardWidth - margin;
                if (left < margin) left = margin;
            }
            if (top < topSafe) {
                top = Math.max(topSafe, (window.innerHeight - cardHeight) / 2);
                left = (window.innerWidth - cardWidth) / 2;
            }

            card.style.left = `${left}px`;
            card.style.top = `${top}px`;
            card.style.transform = 'none';
        });
    };

    if (step.mapHint) {
        window.cleanupOnboardingPlayer();
        const mapEl = document.getElementById('map') || document.getElementById('mapbox-map');
        const mapRect = mapEl
            ? mapEl.getBoundingClientRect()
            : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        const size = Math.min(132, Math.max(88, mapRect.width * 0.22));
        const cx = mapRect.left + mapRect.width / 2;
        const cy = mapRect.top + mapRect.height * 0.42;
        placeCardNear({
            left: cx - size / 2,
            top: cy - size / 2,
            width: size,
            height: size,
            bottom: cy + size / 2,
            right: cx + size / 2
        }, { pad: 4, round: '999px' });
        return;
    }

    if (step.showPlayer) {
        const demo = (window.soundsData || []).find(s => !s.status || s.status === 'published') || (window.soundsData || [])[0];
        if (demo && window.selectSound) {
            window.__onboardingDemoPlayer = true;
            window.selectSound(demo.id);
            setTimeout(() => {
                if (!window.__onboardingDemoPlayer) return;
                const el = document.querySelector('#player-card');
                if (!el) return;
                const rect = el.getBoundingClientRect();
                if (rect.height < 40) return;
                placeCardNear(rect);
            }, 450);
        }
        placeCardCentered();
        return;
    }

    window.cleanupOnboardingPlayer();

    if (!step.target) {
        placeCardCentered();
        return;
    }

    const el = document.querySelector(step.target);
    if (!el || el.classList.contains('hidden') || el.offsetParent === null) {
        placeCardCentered();
        return;
    }

    placeCardNear(el.getBoundingClientRect());
};

window.nextOnboardingStep = function() {
    window.cleanupOnboardingPlayer();
    if (window.__onboardingStep >= window.onboardingSteps.length - 1) {
        window.dismissOnboarding();
        return;
    }
    window.__onboardingStep++;
    window.updateOnboardingStep();
};

window.prevOnboardingStep = function() {
    window.cleanupOnboardingPlayer();
    if (window.__onboardingStep > 0) {
        window.__onboardingStep--;
        window.updateOnboardingStep();
    }
};

window.dismissOnboarding = function() {
    window.cleanupOnboardingPlayer();
    localStorage.setItem('rosmap_onboarding_done', '1');
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.classList.remove('pointer-events-auto');
    }
};

window.handleOnboardingBackdrop = function(e) {
    // Клик по затемнению / highlight или «мимо» карточки — скрыть демо-плеер на шаге 3
    const card = document.getElementById('onboarding-card');
    if (card && card.contains(e.target)) return;
    if (window.__onboardingDemoPlayer) {
        window.cleanupOnboardingPlayer();
        const highlight = document.getElementById('onboarding-highlight');
        if (highlight) {
            highlight.style.opacity = '0';
            highlight.style.width = '0';
            highlight.style.height = '0';
        }
        if (card) {
            card.style.left = '50%';
            card.style.top = '50%';
            card.style.transform = 'translate(-50%, -50%)';
        }
    }
};

/** Долгое нажатие / ПКМ по пузырю сообщения → меню действий. */
window.bindMessageBubbleMenus = function(container) {
    if (!container) return;
    container.querySelectorAll('.msg-bubble[data-msg-id]').forEach((bubble) => {
        if (bubble.dataset.menuBound === '1') return;
        bubble.dataset.menuBound = '1';
        const msgId = bubble.dataset.msgId;
        if (!msgId) return;

        bubble.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (bubble.dataset.swipeJustFired === '1') return;
            const point = window.eventClientPoint ? window.eventClientPoint(e) : { clientX: e.clientX, clientY: e.clientY };
            if (window.openMessageMenu) window.openMessageMenu(msgId, point);
        });

        let pressTimer = null;
        let startX = 0;
        let startY = 0;
        const clearPress = () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        };

        bubble.addEventListener('touchstart', (e) => {
            if (!e.touches?.[0]) return;
            clearPress();
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            pressTimer = setTimeout(() => {
                pressTimer = null;
                if (bubble.dataset.swipeJustFired === '1') return;
                try { if (navigator.vibrate) navigator.vibrate(12); } catch (_) {}
                if (window.openMessageMenu) {
                    window.openMessageMenu(msgId, { clientX: startX, clientY: startY });
                }
            }, 480);
        }, { passive: true });

        bubble.addEventListener('touchmove', (e) => {
            if (!pressTimer || !e.touches?.[0]) return;
            const dx = Math.abs(e.touches[0].clientX - startX);
            const dy = Math.abs(e.touches[0].clientY - startY);
            if (dx > 12 || dy > 12) clearPress();
        }, { passive: true });

        bubble.addEventListener('touchend', clearPress, { passive: true });
        bubble.addEventListener('touchcancel', clearPress, { passive: true });
    });
};

window.bindSwipeReplyRows = function(container, onReply) {
    if (!container || typeof onReply !== 'function') return;
    container.querySelectorAll('.swipe-reply-row').forEach(row => {
        if (row.dataset.swipeBound === '1') return;
        row.dataset.swipeBound = '1';
        let startX = 0, startY = 0, dx = 0, active = false;
        const threshold = 56;
        const reset = () => {
            row.style.transform = '';
            row.classList.remove('is-swiping');
            active = false;
            dx = 0;
        };
        const onStart = (clientX, clientY) => {
            startX = clientX;
            startY = clientY;
            active = true;
            dx = 0;
        };
        const onMove = (clientX, clientY) => {
            if (!active) return;
            const mx = clientX - startX;
            const my = clientY - startY;
            if (Math.abs(my) > Math.abs(mx) && Math.abs(my) > 12) {
                reset();
                return;
            }
            if (mx < 0) {
                dx = Math.max(mx, -96);
                row.style.transform = `translateX(${dx}px)`;
                row.classList.add('is-swiping');
            }
        };
        const onEnd = () => {
            if (!active) return;
            const id = row.dataset.msgId || row.dataset.commentId || row.dataset.replyId;
            const triggered = dx <= -threshold;
            reset();
            if (triggered && id) {
                row.dataset.swipeJustFired = '1';
                setTimeout(() => { delete row.dataset.swipeJustFired; }, 350);
                onReply(id, row);
            }
        };

        row.addEventListener('touchstart', (e) => {
            if (!e.touches[0]) return;
            onStart(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });
        row.addEventListener('touchmove', (e) => {
            if (!e.touches[0]) return;
            onMove(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });
        row.addEventListener('touchend', onEnd, { passive: true });
        row.addEventListener('touchcancel', reset, { passive: true });

        // Desktop / trackpad
        row.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'touch') return;
            if (e.button !== 0) return;
            onStart(e.clientX, e.clientY);
            row.setPointerCapture?.(e.pointerId);
        });
        row.addEventListener('pointermove', (e) => {
            if (e.pointerType === 'touch') return;
            onMove(e.clientX, e.clientY);
        });
        row.addEventListener('pointerup', (e) => {
            if (e.pointerType === 'touch') return;
            onEnd();
        });
        row.addEventListener('pointercancel', reset);

        row.addEventListener('click', (e) => {
            if (row.dataset.swipeJustFired === '1') {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);
    });
};

window.restartOnboarding = function() {
    localStorage.removeItem('rosmap_onboarding_done');
    if (window.closeSettingsModal) window.closeSettingsModal();
    if (window.closeCabinet) window.closeCabinet();
    if (window.hideDockPanel) window.hideDockPanel();
    window.startOnboarding(0);
};

window.initOnboarding = function() {
    if (localStorage.getItem('rosmap_onboarding_done')) return;
    const tryStart = () => {
        if (localStorage.getItem('rosmap_onboarding_done')) return;
        window.startOnboarding(0);
    };
    // Ждём карту/данные, но не дольше ~2.2 с — тур не должен «висеть» на пустом экране
    if (window.__cloudDataReady && (window.soundsData || []).length) {
        setTimeout(tryStart, 400);
        return;
    }
    let tries = 0;
    const timer = setInterval(() => {
        tries += 1;
        if (window.__cloudDataReady || tries >= 12) {
            clearInterval(timer);
            tryStart();
        }
    }, 180);
};

window.bindMessagesKeyboardInset = function() {
    const input = document.getElementById('messages-compose-input');
    if (!input || input.dataset.kbBound === '1') return;
    input.dataset.kbBound = '1';

    const apply = () => {
        if (!window.visualViewport) {
            document.documentElement.style.setProperty('--kb-inset', '0px');
            document.body.classList.remove('messages-kb-open');
            return;
        }
        const vv = window.visualViewport;
        const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
        document.documentElement.style.setProperty('--kb-inset', `${inset}px`);
        const open = inset > 48 && document.activeElement === input;
        document.body.classList.toggle('messages-kb-open', open);
    };

    input.addEventListener('focus', () => {
        apply();
        setTimeout(apply, 80);
        setTimeout(apply, 320);
    });
    input.addEventListener('blur', () => {
        setTimeout(() => {
            document.body.classList.remove('messages-kb-open');
            document.documentElement.style.setProperty('--kb-inset', '0px');
        }, 80);
    });
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', apply);
        window.visualViewport.addEventListener('scroll', apply);
    }
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
        if (window.playSfx) window.playSfx('open');

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
            if (window.playSfx) window.playSfx(value === false ? 'close' : 'click');
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
window.confirmDiscardDraft = async function(message) {
    return window.CustomUI.open({
        title: '<i class="fa-solid fa-triangle-exclamation mr-2 text-amber-500"></i>Закрыть без сохранения?',
        message: message || 'Несохранённые изменения будут потеряны.',
        confirmText: 'Закрыть',
        confirmClass: 'px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-md'
    });
};

window.isAddSoundDirty = function() {
    if (window.editingSoundId) return true;
    if (window.currentUploadedFile || window.currentUploadedFileUrl) return true;
    if ((window.pendingImages || []).length) return true;
    if ((window.addModalRoute || []).length) return true;
    const title = (document.getElementById('add-display-title')?.value || '').trim();
    const desc = (document.getElementById('add-desc')?.value || '').trim();
    const userDef = (document.getElementById('add-user-defined')?.value || '').trim();
    return !!(title || desc || userDef);
};

window.ActionSheet = {
    _actions: [],
    open: function(items, opts = {}) {
        if (!Array.isArray(items) || !items.length) return;
        this._actions = items.map(i => i.onClick);
        const container = document.getElementById('action-sheet-items');
        const overlay = document.getElementById('action-sheet-overlay');
        const content = document.getElementById('action-sheet-content');
        if (!container || !overlay || !content) return;

        const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const title = opts.title || '';
        const subtitle = opts.subtitle || '';
        const headerHtml = (title || subtitle)
            ? `<div class="action-sheet-header px-4 pt-3.5 pb-2.5 border-b border-slate-100 dark:border-slate-700">
                ${title ? `<p class="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">${esc(title)}</p>` : ''}
                ${subtitle ? `<p class="text-[11px] text-slate-400 font-mono mt-0.5 truncate">${esc(subtitle)}</p>` : ''}
               </div>`
            : '';

        container.innerHTML = headerHtml + items.map((item, i) => {
            const tone = item.tone || (item.danger ? 'danger' : '');
            const toneCls = tone ? `action-sheet-item--${tone}` : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700';
            const icon = String(item.icon || 'fa-circle').replace(/^fa-(solid|regular|brands)\s+/, '');
            return `
            <button type="button" onclick="window.ActionSheet.trigger(${i})" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors text-left ${toneCls}">
                <i class="fa-solid ${icon} w-4 text-center opacity-70"></i>${esc(item.label)}
            </button>`;
        }).join('');

        overlay.classList.remove('hidden');
        void overlay.offsetWidth;
        overlay.classList.remove('opacity-0');
        content.classList.remove('translate-y-full', 'sm:scale-95');
        if (window.playSfx) window.playSfx('open');
    },
    trigger: function(i) {
        const fn = this._actions[i];
        this.close(true);
        if (window.playSfx) window.playSfx('click');
        if (fn) setTimeout(fn, 280);
    },
    close: function(fromTrigger = false) {
        const overlay = document.getElementById('action-sheet-overlay');
        const content = document.getElementById('action-sheet-content');
        if (!overlay || !content) return;
        overlay.classList.add('opacity-0');
        content.classList.add('translate-y-full', 'sm:scale-95');
        if (!fromTrigger && window.playSfx) window.playSfx('close');
        setTimeout(() => { if (overlay.classList.contains('opacity-0')) overlay.classList.add('hidden'); }, 300);
    }
};

/**
 * Единая точка входа для меню действий (⋯, ПКМ по метке, сообщения, админка).
 * Открывает CtxPopup у курсора / якоря — как ПКМ по карте.
 */
window.openActionsMenu = function(items, opts = {}) {
    if (!Array.isArray(items) || !items.length) return;
    try { if (window.ActionSheet) window.ActionSheet.close(); } catch (_) {}

    let clientX = Number(opts.clientX);
    let clientY = Number(opts.clientY);

    if ((!Number.isFinite(clientX) || !Number.isFinite(clientY)) && opts.event) {
        const point = window.eventClientPoint
            ? window.eventClientPoint(opts.event)
            : null;
        if (point && Number.isFinite(point.clientX)) {
            clientX = point.clientX;
            clientY = point.clientY;
        } else if (Number.isFinite(opts.event.clientX)) {
            clientX = opts.event.clientX;
            clientY = opts.event.clientY;
        }
    }

    if ((!Number.isFinite(clientX) || !Number.isFinite(clientY)) && opts.anchor) {
        const el = typeof opts.anchor === 'string'
            ? document.querySelector(opts.anchor)
            : opts.anchor;
        if (el && typeof el.getBoundingClientRect === 'function') {
            const r = el.getBoundingClientRect();
            clientX = r.left + (r.width / 2);
            clientY = r.bottom + 6;
        }
    }

    if (!Number.isFinite(clientX)) clientX = Math.min((window.innerWidth || 320) - 24, 96);
    if (!Number.isFinite(clientY)) clientY = Math.min((window.innerHeight || 480) - 24, 120);

    if (window.CtxPopup) {
        window.CtxPopup.open({
            title: opts.title || '',
            subtitle: opts.subtitle || '',
            items,
            clientX,
            clientY
        });
        return;
    }
    if (window.ActionSheet) window.ActionSheet.open(items, opts);
};

/** Всплывающее контекстное меню у курсора (как ПКМ по карте), без модальной шторки. */
window.CtxPopup = {
    _actions: [],
    _bound: false,
    open: function({ title = '', subtitle = '', items = [], clientX = 12, clientY = 12 } = {}) {
        // Скрыть legacy map-context-menu, не трогая текущий popup до перерисовки
        const legacy = document.getElementById('map-context-menu');
        if (legacy) {
            legacy.classList.add('hidden');
            legacy.style.left = '-9999px';
            legacy.style.top = '-9999px';
        }
        const menu = document.getElementById('ctx-popup-menu');
        const itemsEl = document.getElementById('ctx-popup-items');
        const header = document.getElementById('ctx-popup-header');
        const titleEl = document.getElementById('ctx-popup-title');
        const subEl = document.getElementById('ctx-popup-subtitle');
        if (!menu || !itemsEl || !items.length) return;

        this._actions = items.map(i => i.onClick);
        if (header && titleEl) {
            const hasTitle = !!(title || subtitle);
            header.classList.toggle('hidden', !hasTitle);
            titleEl.textContent = title || '';
            if (subEl) {
                subEl.textContent = subtitle || '';
                subEl.classList.toggle('hidden', !subtitle);
            }
        }

        const toneColor = {
            primary: 'text-blue-500',
            success: 'text-emerald-500',
            warning: 'text-amber-500',
            danger: 'text-red-500'
        };
        itemsEl.innerHTML = items.map((item, i) => {
            const tone = item.tone || (item.danger ? 'danger' : '');
            const iconTone = toneColor[tone] || 'text-slate-400';
            const textTone = tone === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200';
            const icon = String(item.icon || 'fa-circle').replace(/^fa-(solid|regular|brands)\s+/, '');
            return `<button type="button" onclick="window.CtxPopup.trigger(${i})" class="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold ${textTone} hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left">
                <i class="fa-solid ${icon} ${iconTone} w-4 text-center"></i>
                <span class="truncate">${item.label}</span>
            </button>`;
        }).join('');

        menu.classList.remove('hidden');
        menu.style.position = 'fixed';
        menu.style.left = '-9999px';
        menu.style.top = '-9999px';
        const mw = menu.offsetWidth || 224;
        const mh = menu.offsetHeight || 160;
        const vw = window.innerWidth || 0;
        const vh = window.innerHeight || 0;
        const x = Math.min(Math.max(8, clientX), Math.max(8, vw - mw - 8));
        const y = Math.min(Math.max(8, clientY), Math.max(8, vh - mh - 8));
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        if (!this._bound) {
            this._bound = true;
            document.addEventListener('mousedown', (e) => {
                const m = document.getElementById('ctx-popup-menu');
                if (!m || m.classList.contains('hidden')) return;
                if (m.contains(e.target)) return;
                window.CtxPopup.close();
            }, true);
            document.addEventListener('scroll', () => window.CtxPopup.close(), true);
            window.addEventListener('resize', () => window.CtxPopup.close());
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') window.CtxPopup.close();
            });
        }
    },
    trigger: function(i) {
        const fn = this._actions[i];
        this.close();
        if (window.playSfx) window.playSfx('click');
        if (fn) setTimeout(fn, 40);
    },
    close: function() {
        const menu = document.getElementById('ctx-popup-menu');
        if (!menu) return;
        menu.classList.add('hidden');
        menu.style.left = '-9999px';
        menu.style.top = '-9999px';
        this._actions = [];
    }
};

window.eventClientPoint = function(e, fallback) {
    if (e && typeof e.clientX === 'number') return { clientX: e.clientX, clientY: e.clientY || 0 };
    const t = e?.touches?.[0] || e?.changedTouches?.[0];
    if (t) return { clientX: t.clientX, clientY: t.clientY };
    try {
        const dom = e?.get?.('domEvent');
        const original = (dom && dom.originalEvent) || null;
        const read = (key) => {
            if (original && typeof original[key] === 'number') return original[key];
            if (dom && typeof dom.get === 'function') {
                const v = dom.get(key);
                if (typeof v === 'number') return v;
            }
            if (dom && typeof dom[key] === 'number') return dom[key];
            return null;
        };
        const cx = read('clientX');
        const cy = read('clientY');
        if (cx != null) return { clientX: cx, clientY: cy ?? 0 };
    } catch (_) {}
    if (fallback && typeof fallback.clientX === 'number') return fallback;
    return { clientX: 24, clientY: 24 };
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
    window.__sessionRoutePicking = false;
};

window.applyPickedLocation = function() {
    if (window.__sessionRoutePicking) {
        if (!window.__sessionRouteStops || window.__sessionRouteStops.length < 2) {
            window.showToast('Нужно минимум 2 точки маршрута экспедиции');
            return;
        }
        window.__sessionRoutePicking = false;
        window.renderSessionRouteStops();
        window.closeLocationPickerModal();
        window.showToast(`Маршрут: ${window.__sessionRouteStops.length} точек`);
        return;
    }
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
    // Стабильный публичный ID: не зависит от порядка массива (раньше номера «прыгали»).
    (window.soundsData || []).forEach((s) => {
        if (!s || s.deleted) return;
        if (!s.publicId) s.publicId = String(s.id || '').trim();
        s.archiveNum = String(s.publicId || s.id || '—');
    });
};

window.getSoundDisplayId = function(soundOrId) {
    const s = typeof soundOrId === 'string'
        ? (window.soundsData || []).find((x) => x.id === soundOrId)
        : soundOrId;
    if (!s) return String(soundOrId || '—');
    return String(s.publicId || s.id || '—');
};

// Lightbox
window.openLightbox = function(images, index) {
    if(!images || images.length === 0) return;
    window.currentLightboxImages = images; window.currentLightboxIndex = index;
    window.updateLightboxView();
    const lb = document.getElementById('lightbox-overlay');
    lb.classList.remove('hidden'); lb.classList.add('flex'); void lb.offsetWidth; lb.classList.remove('opacity-0');
    window.bindLightboxSwipe();
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
    const dots = document.getElementById('lightbox-dots');
    if (dots) {
        const n = window.currentLightboxImages.length;
        dots.innerHTML = n > 1
            ? window.currentLightboxImages.map((_, i) => `<button type="button" class="lightbox-dot ${i === window.currentLightboxIndex ? 'active' : ''}" onclick="event.stopPropagation(); window.currentLightboxIndex=${i}; window.updateLightboxView()"></button>`).join('')
            : '';
    }
}

window.bindLightboxSwipe = function() {
    const img = document.getElementById('lightbox-img');
    if (!img || img.__swipeBound) return;
    img.__swipeBound = true;
    let startX = 0;
    img.addEventListener('touchstart', (e) => {
        if (e.touches[0]) startX = e.touches[0].clientX;
    }, { passive: true });
    img.addEventListener('touchend', (e) => {
        const endX = e.changedTouches?.[0]?.clientX;
        if (endX == null) return;
        const dx = endX - startX;
        if (Math.abs(dx) < 40) return;
        if (dx < 0) window.nextLightbox();
        else window.prevLightbox();
    }, { passive: true });
};

// Data Merging & Sync
window.mergeData = function(cloudData) {
    const incoming = Array.isArray(cloudData) ? cloudData : [];
    // Сохраняем локальные tombstone: иначе CDN без deleted снова «воскрешает» звук на карте.
    const localTombs = (window.cloudDataCache || []).filter((s) => s && s.deleted);
    const mergedCloud = localTombs.length
        ? window.mergeMapDataArrays(incoming, localTombs)
        : incoming;

    const combinedMap = new Map();
    // Shallow copy demo rows — deep JSON clone of the whole library was freezing the UI on every poll.
    (window.rawSoundsData || []).forEach((rs) => combinedMap.set(rs.id, { ...rs }));
    // Если облачная копия того же id пришла без route — сохраняем маршрут из локального демо,
    // иначе soundwalk'и r2/r5 «теряют» прогулку после первой синхронизации.
    mergedCloud.forEach((cs) => {
        if (cs.deleted) { combinedMap.delete(cs.id); return; }
        const prev = combinedMap.get(cs.id);
        combinedMap.set(cs.id, { ...cs, route: (cs.route && cs.route.length > 1) ? cs.route : (prev?.route || cs.route) });
    });
    window.soundsData = Array.from(combinedMap.values()).reverse().map(window.formatSoundObject);
    window.assignArchiveNumbers();
    // Tombstone остаются в кэше — нужны для следующего sync/poll.
    window.cloudDataCache = mergedCloud.slice();
    window.__filteredSoundsCache = null;
    window.__filteredSoundsCacheKey = null;

    // Prune only removed markers — full cache wipe forced a multi-frame map rebuild on every sync/poll.
    const aliveIds = new Set(window.soundsData.map((s) => s.id));
    const prune = (cache, destroy) => {
        if (!cache || !cache.size) return;
        cache.forEach((marker, id) => {
            if (aliveIds.has(id)) return;
            try { destroy(marker); } catch (_) {}
            cache.delete(id);
            if (window.__markerHoverSoundId === id && window.hideMarkerHoverCard) {
                window.hideMarkerHoverCard(true);
            }
        });
    };
    prune(window.markerCache, (pm) => { if (window.map) window.map.geoObjects.remove(pm); });
    prune(window.mapboxMarkerCache, (m) => m.remove());
    prune(window.dgisMarkerCache, (m) => m.destroy());
    prune(window.googleEarthMarkerCache, (m) => m.remove());
    if (window.markerLayoutCache && window.markerLayoutCache.size) {
        const nextLayouts = new Map();
        window.markerLayoutCache.forEach((layout, key) => {
            const id = String(key).split('|')[0];
            if (aliveIds.has(id)) nextLayouts.set(key, layout);
        });
        window.markerLayoutCache = nextLayouts;
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
    // Запись только через Secure API (JWT). Анонимный presign отключён.
    if (!window.getAuthToken || !window.getAuthToken()) {
        throw new Error('Требуется вход для синхронизации с облаком');
    }
    if (!window.apiSyncJson) throw new Error('Secure API клиент не загружен');
    const result = await window.apiSyncJson(fileName, data);
    // Предпочитаем снимок из ответа API — повторный GET из бакета может отдать устаревший кэш.
    if (result && Array.isArray(result.data)) {
        window.__lastMergedUpload = { fileName, data: result.data };
        return true;
    }
    const freshAfter = await window.fetchCloudJson(fileName);
    if (Array.isArray(freshAfter)) {
        window.__lastMergedUpload = { fileName, data: freshAfter };
    }
    return true;
};

window.__recordTime = function(item) {
    if (!item) return 0;
    // readAt / reactedAt важнее date: иначе mark-as-read и снятие реакции проигрывают CDN.
    const raw = item.editedAt || item.reactedAt || item.updatedAt || item.readAt || item.date || item.createdAt || item.profileUpdatedAt || 0;
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
        // read монотонен: прочитанное не откатывается устаревшим CDN.
        const read = !!(newer.read || older.read);
        const readAt = read
            ? (window.__laterIso(older.readAt, newer.readAt) || newer.readAt || older.readAt)
            : undefined;
        map.set(item[idKey], {
            ...older,
            ...newer,
            deleted: deleted || undefined,
            read: read || undefined,
            readAt: readAt || undefined,
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

window.__laterTyping = function(a, b) {
    // null = явное снятие «печатает»; выбираем более свежий сигнал по at / last clear.
    const atOf = (t) => (t && t.at ? new Date(t.at).getTime() : (t === null ? 0 : -1));
    if (a === undefined) return b === undefined ? undefined : b;
    if (b === undefined) return a;
    if (!a && !b) return null;
    if (a && !b) return a;
    if (!a && b) return b;
    return atOf(b) >= atOf(a) ? b : a;
};

window.mergeProfilesArrays = function(fresh = [], proposed = []) {
    const out = new Map();
    (fresh || []).forEach(p => {
        if (p?.loginName) out.set(String(p.loginName).toLowerCase(), { ...p, loginName: String(p.loginName).toLowerCase() });
    });
    (proposed || []).forEach(p => {
        if (!p?.loginName) return;
        const login = String(p.loginName).toLowerCase();
        const cloud = out.get(login);
        if (!cloud) {
            out.set(login, { ...p, loginName: login });
            return;
        }
        // Скаляры (bio, avatar, badges…) — только если локальная правка новее по profileUpdatedAt.
        // lastSeen / inbox / notifications / sessions / typing всегда сливаются отдельно.
        const preferProposedScalars = window.__profileScalarRev(p) > window.__profileScalarRev(cloud);
        const merged = preferProposedScalars ? { ...cloud, ...p } : { ...p, ...cloud };
        merged.loginName = login;
        merged.lastSeen = window.__laterIso(cloud.lastSeen, p.lastSeen);
        merged.profileUpdatedAt = window.__laterIso(cloud.profileUpdatedAt, p.profileUpdatedAt);
        merged.inbox = window.__mergeKeyedArrays(cloud.inbox || [], p.inbox || []);
        merged.notifications = window.__mergeKeyedArrays(cloud.notifications || [], p.notifications || []);
        merged.activityLog = window.__mergeKeyedArrays(cloud.activityLog || [], p.activityLog || []);
        merged.sessions = preferProposedScalars
            ? (p.sessions || [])
            : window.__mergeKeyedArrays(cloud.sessions || [], p.sessions || []);
        // typing: не завязан на profileUpdatedAt — иначе «печатает» пропадает при sync presence
        if (Object.prototype.hasOwnProperty.call(p, 'typing') || Object.prototype.hasOwnProperty.call(cloud, 'typing')) {
            if (p.typing === null && (!cloud.typing || new Date(p.lastSeen || 0) >= new Date(cloud.typing?.at || 0))) {
                merged.typing = null;
            } else {
                merged.typing = window.__laterTyping(cloud.typing, p.typing === null ? null : p.typing);
            }
        }
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
            merged.progress = cloud.progress || p.progress;
        }
        out.set(login, merged);
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
            // LWW: newer comment revision wins for reactedBy (union broke un-react)
            reactedBy: Array.isArray(newer.reactedBy) ? [...newer.reactedBy] : [...(older.reactedBy || [])]
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
        // Tombstone всегда побеждает «живую» копию — иначе удаление откатывается.
        if (s.deleted) {
            map.set(s.id, { ...cloud, ...s, deleted: true });
            return;
        }
        if (cloud.deleted) return;
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
    const stamp = (p) => {
        const raw = p?.reactedAt || p?.updatedAt || p?.createdAt || 0;
        const t = new Date(raw).getTime();
        return Number.isFinite(t) ? t : 0;
    };
    const upsert = (p) => {
        if (p?.id == null) return;
        if (p.deleted) { map.delete(p.id); return; }
        const prev = map.get(p.id);
        if (!prev) {
            map.set(p.id, {
                ...p,
                comments: window.__mergeCommentLists?.(p.comments || [], []) || (p.comments || []),
                reactedBy: Array.isArray(p.reactedBy) ? [...p.reactedBy] : [],
                viewedBy: Array.isArray(p.viewedBy) ? [...p.viewedBy] : []
            });
            return;
        }
        const newer = stamp(p) >= stamp(prev) ? p : prev;
        const older = stamp(p) >= stamp(prev) ? prev : p;
        map.set(p.id, {
            ...older,
            ...newer,
            comments: window.__mergeCommentLists
                ? window.__mergeCommentLists(older.comments || [], newer.comments || [])
                : (newer.comments || older.comments || []),
            reactedBy: Array.isArray(newer.reactedBy) ? [...newer.reactedBy] : [...(older.reactedBy || [])],
            viewedBy: Array.from(new Set([...(older.viewedBy || []), ...(newer.viewedBy || [])])),
            views: Math.max(Number(older.views) || 0, Number(newer.views) || 0),
            pinned: Object.prototype.hasOwnProperty.call(newer, 'pinned') ? !!newer.pinned : !!older.pinned,
            pinnedAt: newer.pinned ? (newer.pinnedAt || older.pinnedAt) : undefined
        });
    };
    (fresh || []).forEach(upsert);
    (proposed || []).forEach(upsert);
    return Array.from(map.values()).sort((a, b) => {
        const ap = a.pinned ? 1 : 0;
        const bp = b.pinned ? 1 : 0;
        if (bp !== ap) return bp - ap;
        return stamp(b) - stamp(a);
    });
};

window.mergeEventsArrays = function(fresh = [], proposed = []) {
    const map = new Map();
    const stamp = (e) => {
        const t = new Date(e?.updatedAt || e?.createdAt || e?.joinedAt || 0).getTime();
        return Number.isFinite(t) ? t : 0;
    };
    const mergeParticipants = (a = [], b = []) => {
        const m = new Map();
        [...(a || []), ...(b || [])].forEach((p) => {
            if (!p?.login) return;
            const key = String(p.login).toLowerCase();
            const prev = m.get(key);
            if (!prev || stamp(p) >= stamp(prev)) m.set(key, { ...prev, ...p, login: key });
        });
        return Array.from(m.values());
    };
    const upsert = (e) => {
        if (e?.id == null) return;
        if (e.deleted) { map.delete(e.id); return; }
        const prev = map.get(e.id);
        if (!prev) {
            map.set(e.id, {
                ...e,
                participants: [...(e.participants || [])],
                prizes: [...(e.prizes || [])],
                conditions: [...(e.conditions || [])],
                winners: [...(e.winners || [])]
            });
            return;
        }
        const newer = stamp(e) >= stamp(prev) ? e : prev;
        const older = stamp(e) >= stamp(prev) ? prev : e;
        map.set(e.id, {
            ...older,
            ...newer,
            participants: mergeParticipants(older.participants || [], newer.participants || []),
            prizes: Array.isArray(newer.prizes) ? newer.prizes : (older.prizes || []),
            conditions: Array.isArray(newer.conditions) ? newer.conditions : (older.conditions || []),
            winners: Array.isArray(newer.winners) ? newer.winners : (older.winners || []),
            pinned: Object.prototype.hasOwnProperty.call(newer, 'pinned') ? !!newer.pinned : !!older.pinned
        });
    };
    (fresh || []).forEach(upsert);
    (proposed || []).forEach(upsert);
    return Array.from(map.values()).sort((a, b) => stamp(b) - stamp(a));
};

window.mergeMailArrays = function(fresh = [], proposed = []) {
    const out = new Map();
    (fresh || []).forEach(p => {
        if (!p?.loginName) return;
        out.set(String(p.loginName).toLowerCase(), {
            loginName: String(p.loginName).toLowerCase(),
            inbox: Array.isArray(p.inbox) ? p.inbox : [],
            notifications: Array.isArray(p.notifications) ? p.notifications : [],
            activityLog: Array.isArray(p.activityLog) ? p.activityLog : []
        });
    });
    (proposed || []).forEach(p => {
        if (!p?.loginName) return;
        const login = String(p.loginName).toLowerCase();
        const cloud = out.get(login);
        if (!cloud) {
            out.set(login, {
                loginName: login,
                inbox: Array.isArray(p.inbox) ? p.inbox : [],
                notifications: Array.isArray(p.notifications) ? p.notifications : [],
                activityLog: Array.isArray(p.activityLog) ? p.activityLog : []
            });
            return;
        }
        out.set(login, {
            loginName: login,
            inbox: window.__mergeKeyedArrays(cloud.inbox || [], p.inbox || []),
            notifications: window.__mergeKeyedArrays(cloud.notifications || [], p.notifications || []),
            activityLog: window.__mergeKeyedArrays(cloud.activityLog || [], p.activityLog || [])
        });
    });
    return Array.from(out.values());
};

/** Визитки vs почта: inbox/notifications/activityLog → mail.json */
window.splitProfilesAndMail = function(profiles = []) {
    const cards = [];
    const mail = [];
    (profiles || []).forEach((p) => {
        if (!p?.loginName) return;
        const login = String(p.loginName).toLowerCase();
        const {
            inbox,
            notifications,
            activityLog,
            ...rest
        } = p;
        const card = { ...rest, loginName: login };
        delete card.inbox;
        delete card.notifications;
        delete card.activityLog;
        cards.push(card);
        mail.push({
            loginName: login,
            inbox: Array.isArray(inbox) ? inbox : [],
            notifications: Array.isArray(notifications) ? notifications : [],
            activityLog: Array.isArray(activityLog) ? activityLog : []
        });
    });
    return { cards, mail };
};

window.hydrateProfilesWithMail = function(profiles = [], mail = []) {
    const mailMap = new Map((mail || []).map((m) => [String(m.loginName || '').toLowerCase(), m]));
    const profileLogins = new Set();
    const hydrated = (profiles || []).map((p) => {
        const login = String(p.loginName || '').toLowerCase();
        profileLogins.add(login);
        const m = mailMap.get(login);
        // Если mail ещё пуст (миграция), оставляем поля из старого profiles.json
        return {
            ...p,
            loginName: login,
            inbox: m ? (m.inbox || []) : (p.inbox || []),
            notifications: m ? (m.notifications || []) : (p.notifications || []),
            activityLog: m ? (m.activityLog || []) : (p.activityLog || [])
        };
    });
    // Ящики без визитки (редко) — всё равно доступны в памяти через синтетическую запись
    (mail || []).forEach((m) => {
        const login = String(m.loginName || '').toLowerCase();
        if (!login || profileLogins.has(login)) return;
        hydrated.push({
            loginName: login,
            displayName: login,
            inbox: m.inbox || [],
            notifications: m.notifications || [],
            activityLog: m.activityLog || []
        });
    });
    return hydrated;
};

window.applyProfilesAndMailSnapshot = function(profiles, mail) {
    window.mailData = Array.isArray(mail) ? mail : (window.mailData || []);
    window.__lastMailPollKey = window.fingerprintDataset(window.mailData);
    const cards = Array.isArray(profiles) ? profiles : [];
    window.profilesData = window.hydrateProfilesWithMail(cards, window.mailData);
    window.__lastProfilesPollKey = window.fingerprintDataset(cards);
};

// fileName выбирает JSON-файл в том же бакете: "map_data.json" для звуков (по умолчанию,
// обратная совместимость со всеми существующими вызовами) или "profiles.json" для публичных
// профилей рекордистов (см. window.syncProfilesData ниже).
window.syncCloudData = async function(newCloudData, fileName = "map_data.json") {
    return window.__enqueueCloudWrite(fileName, async () => {
        window.__cloudWriteDepth++;
        try {
            if (!window.getAuthToken || !window.getAuthToken()) {
                window.showToast('Войдите в аккаунт, чтобы сохранить данные в облако');
                if (window.openAuthModal) window.openAuthModal();
                return false;
            }
            await window.__waitCloudReady();
            const fresh = await window.fetchCloudJson(fileName);
            const proposed = Array.isArray(newCloudData) ? newCloudData : [];

            // Защита от затирания облака пустым массивом до/вместо загрузки
            if (!proposed.length && Array.isArray(fresh) && fresh.length) {
                console.warn(`[sync] Skip empty overwrite for ${fileName}`);
                if (fileName === "map_data.json") {
                    window.mergeData(fresh);
                    window.__lastCloudPollKey = window.fingerprintDataset(fresh);
                }
                return false;
            }

            let merged = proposed;
            if (Array.isArray(fresh)) {
                if (fileName === "profiles.json") merged = window.mergeProfilesArrays(fresh, proposed);
                else if (fileName === "mail.json") merged = window.mergeMailArrays(fresh, proposed);
                else if (fileName === "feed.json") merged = window.mergeFeedPostsArrays(fresh, proposed);
                else if (fileName === "events.json") merged = window.mergeEventsArrays(fresh, proposed);
                else merged = window.mergeMapDataArrays(fresh, proposed);
            }

            await window.__putCloudJson(fileName, merged);
            // Сервер уже сделал merge+sanitize и мог вернуть итоговый снимок
            if (window.__lastMergedUpload && window.__lastMergedUpload.fileName === fileName && Array.isArray(window.__lastMergedUpload.data)) {
                merged = window.__lastMergedUpload.data;
            } else {
                window.__lastMergedUpload = { fileName, data: merged };
            }

            if (fileName === "map_data.json") {
                window.mergeData(merged);
                window.initFiltersData();
                window.processFilterChange(false);
                window.__lastCloudPollKey = window.fingerprintDataset(merged);
                if (document.getElementById('cabinet-modal') && !document.getElementById('cabinet-modal').classList.contains('hidden')) {
                    window.renderCabinet();
                }
            } else if (fileName === "feed.json") {
                window.feedPosts = merged.filter(p => !p.deleted);
                window.__lastFeedPollKey = window.fingerprintDataset(window.feedPosts);
                if (window.__sidebarTab === 'feed' && window.renderSidebarFeed) window.renderSidebarFeed();
            } else if (fileName === "events.json") {
                window.eventsData = merged.filter(e => !e.deleted);
                window.__lastEventsPollKey = window.fingerprintDataset(window.eventsData);
                if (window.renderEventsPanel) window.renderEventsPanel();
            } else if (fileName === "mail.json") {
                window.mailData = merged;
                window.__lastMailPollKey = window.fingerprintDataset(merged);
            }
            return true;
        } catch (e) {
            console.error(e);
            if (e && (e.code === 'unauthorized' || e.status === 401)) {
                window.showToast('Сессия истекла — войдите снова');
                if (window.clearAuthSession) window.clearAuthSession();
                if (window.openAuthModal) window.openAuthModal();
            } else if (e && (e.code === 'rate_limited' || e.status === 429)) {
                const now = Date.now();
                if (!window.__lastRateLimitToast || now - window.__lastRateLimitToast > 8000) {
                    window.__lastRateLimitToast = now;
                    window.showToast('Слишком много запросов — подождите немного');
                }
            } else {
                const detail = (e && (e.message || e.code)) ? String(e.message || e.code) : '';
                window.showToast(detail && detail.length < 80
                    ? `Синхронизация не удалась: ${detail}`
                    : "Синхронизация с облаком не удалась.");
            }
            return false;
        } finally {
            window.__cloudWriteDepth = Math.max(0, window.__cloudWriteDepth - 1);
        }
    });
};

// Профили: визитки → profiles.json, почта → mail.json (в памяти всё ещё гидратировано вместе).
window.syncProfilesData = async function(newProfiles) {
    // Держим write-lock на ВСЮ операцию (mail + cards), иначе poll между двумя sync
    // успевает затереть свежий inbox устаревшим mail.json из CDN.
    window.__cloudWriteDepth++;
    try {
        const { cards, mail } = window.splitProfilesAndMail(newProfiles);
        let mergedMail = Array.isArray(window.mailData) && window.mailData.length
            ? window.mergeMailArrays(window.mailData, mail)
            : mail;

        const mailKey = window.fingerprintDataset(mail);
        const cardsKey = window.fingerprintDataset(cards);
        const mailChanged = mailKey !== window.__lastMailPollKey;
        const cardsChanged = cardsKey !== window.__lastProfilesPollKey;

        // No-op: avoid burning sync rate limit on identical snapshots.
        if (!mailChanged && !cardsChanged) {
            window.applyProfilesAndMailSnapshot(cards, mergedMail);
            return true;
        }

        if (mailChanged) {
            const mailOk = await window.syncCloudData(mail, "mail.json");
            if (!mailOk) return false;
            mergedMail = (window.__lastMergedUpload && window.__lastMergedUpload.fileName === "mail.json"
                && Array.isArray(window.__lastMergedUpload.data))
                ? window.__lastMergedUpload.data
                : mergedMail;
            window.__lastMailWriteAt = Date.now();
        }

        if (cardsChanged) {
            const success = await window.syncCloudData(cards, "profiles.json");
            if (!success) return false;
            const mergedCards = (window.__lastMergedUpload && window.__lastMergedUpload.fileName === "profiles.json"
                && Array.isArray(window.__lastMergedUpload.data))
                ? window.__lastMergedUpload.data
                : cards;
            window.applyProfilesAndMailSnapshot(mergedCards, mergedMail);
        } else {
            window.applyProfilesAndMailSnapshot(cards, mergedMail);
        }
        if (window.refreshNotificationsUI) window.refreshNotificationsUI();
        if (window.refreshMessagesUI) window.refreshMessagesUI();
        return true;
    } finally {
        window.__cloudWriteDepth = Math.max(0, window.__cloudWriteDepth - 1);
    }
};

window.syncMailData = async function(newMail) {
    const success = await window.syncCloudData(newMail, "mail.json");
    if (success) {
        const mergedMail = (window.__lastMergedUpload && window.__lastMergedUpload.fileName === "mail.json")
            ? window.__lastMergedUpload.data
            : newMail;
        window.__lastMailWriteAt = Date.now();
        const cards = (window.profilesData || []).map((p) => {
            const { inbox, notifications, activityLog, ...card } = p;
            return card;
        });
        window.applyProfilesAndMailSnapshot(cards, mergedMail);
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
        window.__lastFeedPollKey = window.fingerprintDataset(window.feedPosts);
        if (window.renderSidebarFeed) window.renderSidebarFeed();
    }
    return success;
};

window.syncEventsData = async function(events) {
    const success = await window.syncCloudData(events, "events.json");
    if (success) {
        const merged = (window.__lastMergedUpload && window.__lastMergedUpload.fileName === "events.json")
            ? window.__lastMergedUpload.data
            : events;
        window.eventsData = (merged || []).filter(e => !e.deleted);
        window.__lastEventsPollKey = window.fingerprintDataset(window.eventsData);
        if (window.renderEventsPanel) window.renderEventsPanel();
        if (window.__adminSection === 'events' && window.renderAdminEventsList) window.renderAdminEventsList();
    }
    return success;
};

window.isCurrentUserAdmin = function() {
    if (!window.currentUser) return false;
    // Без JWT админские действия всё равно не пройдут на сервере
    if (window.getAuthToken && !window.getAuthToken()) return false;
    return String(window.currentUser.role || '').toLowerCase() === 'admin'
        || String(window.currentUser.loginName || '').toLowerCase() === 'admin';
};

// Фоновый опрос облака: новые звуки, уведомления, сообщения — без перезагрузки страницы.
window.pollLiveCloudData = async function() {
    if (window.__pollingInFlight || document.hidden) return;
    // Не затираем локальный кэш, пока идёт запись — иначе UI мигает устаревшим снимком.
    if (window.__cloudWriteDepth > 0) return;
    window.__pollingInFlight = true;
    try {
        const [cloudData, profiles, mail, feed, events] = await Promise.all([
            fetch(`${window.YANDEX_BUCKET_URL}/map_data.json?nocache=${Date.now()}`)
                .then(res => res.ok ? res.json() : null)
                .catch(() => null),
            fetch(`${window.YANDEX_BUCKET_URL}/profiles.json?nocache=${Date.now()}`)
                .then(res => res.ok ? res.json() : null)
                .catch(() => null),
            fetch(`${window.YANDEX_BUCKET_URL}/mail.json?nocache=${Date.now()}`)
                .then(res => res.ok ? res.json() : null)
                .catch(() => null),
            fetch(`${window.YANDEX_BUCKET_URL}/feed.json?nocache=${Date.now()}`)
                .then(res => res.ok ? res.json() : null)
                .catch(() => null),
            fetch(`${window.YANDEX_BUCKET_URL}/events.json?nocache=${Date.now()}`)
                .then(res => res.ok ? res.json() : null)
                .catch(() => null)
        ]);

        if (Array.isArray(cloudData)) {
            const key = window.fingerprintDataset(cloudData);
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

        const profilesArr = Array.isArray(profiles) ? profiles : null;
        const mailArr = Array.isArray(mail) ? mail : null;
        if (profilesArr || mailArr) {
            const nextProfiles = profilesArr || (window.profilesData || []).map((p) => {
                const { inbox, notifications, activityLog, ...card } = p;
                return card;
            });
            const nextMail = mailArr || window.mailData || [];
            // Сливаем с локальной почтой: read-флаги монотонны, новые письма с CDN не теряются.
            const effectiveMail = mailArr && Array.isArray(window.mailData)
                ? window.mergeMailArrays(nextMail, window.mailData)
                : nextMail;
            const cardsKey = window.fingerprintDataset(nextProfiles);
            const mailKey = window.fingerprintDataset(effectiveMail);
            if (cardsKey !== window.__lastProfilesPollKey || mailKey !== window.__lastMailPollKey) {
                window.applyProfilesAndMailSnapshot(nextProfiles, effectiveMail);
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
                        window.openMessageThread(window.__activeMessagePeer, {
                            quiet: true,
                            asSupport: !!window.__messagingAsSupport
                        });
                    }
                }
                if (window.__adminSection === 'support' && window.renderAdminSupportList) {
                    window.renderAdminSupportList();
                } else if (window.refreshAdminSupportBadge) {
                    window.refreshAdminSupportBadge();
                }
            }
            // Индикатор печати — на каждом тике опроса, даже если JSON «тот же» по другим полям
            if (window.__activeMessagePeer && window.updateTypingIndicator) {
                const thread = document.getElementById('messages-thread');
                if (thread && !thread.classList.contains('hidden')) {
                    window.updateTypingIndicator(window.__activeMessagePeer);
                }
            }
        }

        if (Array.isArray(feed)) {
            const key = window.fingerprintDataset(feed);
            if (key !== window.__lastFeedPollKey) {
                window.__lastFeedPollKey = key;
                window.feedPosts = feed.filter(p => !p.deleted);
                if (window.__sidebarTab === 'feed' && window.renderSidebarFeed) window.renderSidebarFeed();
            }
        }

        if (Array.isArray(events)) {
            const key = window.fingerprintDataset(events);
            if (key !== window.__lastEventsPollKey) {
                window.__lastEventsPollKey = key;
                window.eventsData = events.filter(e => !e.deleted);
                if (window.renderEventsPanel) window.renderEventsPanel();
                if (window.__adminSection === 'events' && window.renderAdminEventsList) window.renderAdminEventsList();
            }
        }
    } finally {
        window.__pollingInFlight = false;
    }
};

window.clearAllSoundFilters = function(skipRender = false) {
    [
        'activeEcoLayer', 'activeUcsCat', 'activeUcsSub', 'activeGenTags',
        'activePrinciple', 'activeGear', 'activeMic', 'activeChannels',
        'activeLicense', 'activeRecordist', 'activeWeather', 'activeDate'
    ].forEach((key) => {
        if (window[key] && typeof window[key].clear === 'function') window[key].clear();
    });
    window.activeSessionId = null;
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    if (window.syncSearchClearBtn) window.syncSearchClearBtn();
    if (window.clearSearchSuggestions) window.clearSearchSuggestions();
    if (!skipRender && window.processFilterChange) window.processFilterChange(false);
    else if (skipRender) {
        if (window.renderActiveTags) window.renderActiveTags();
        if (window.renderList) window.renderList();
        if (window.updateMapMarkers) window.updateMapMarkers();
        if (window.renderSidebarExpeditions) window.renderSidebarExpeditions();
    }
};

window.clearSearchQuery = function() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    if (window.syncSearchClearBtn) window.syncSearchClearBtn();
    if (window.clearSearchSuggestions) window.clearSearchSuggestions();
    if (window.processFilterChange) window.processFilterChange(false);
};

window.removeActiveFilter = function(setName, value) {
    if (setName === 'search') {
        window.clearSearchQuery();
        return;
    }
    if (setName === 'session') {
        window.activeSessionId = null;
        if (window.processFilterChange) window.processFilterChange(false);
        return;
    }
    if (window[setName] && typeof window[setName].delete === 'function') {
        window[setName].delete(value);
        if (window.processFilterChange) window.processFilterChange(false);
    }
};

window.startLiveCloudPolling = function() {
    if (window.__livePollTimer) return;
    const tick = async () => {
        await window.pollLiveCloudData();
        const fast = document.body.classList.contains('dock-view-messages')
            || (document.getElementById('messages-thread') && !document.getElementById('messages-thread').classList.contains('hidden'));
        const ms = document.hidden ? 25000 : (fast ? 4000 : 15000);
        window.__livePollTimer = setTimeout(tick, ms);
    };
    window.__livePollTimer = setTimeout(tick, 2500);
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
    const sound = (window.soundsData || []).find(s => s.id === id);
    const login = window.currentUser
        ? (window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase())
        : null;
    window.showToast("Удаление...");
    // Всегда soft-delete: hard-remove из массива откатывается merge'ем из облака.
    const updatedCloud = [...(window.cloudDataCache || [])];
    const tombstone = { id, deleted: true, editedAt: new Date().toISOString() };
    const idx = updatedCloud.findIndex(x => x && x.id === id);
    if (idx >= 0) updatedCloud[idx] = { ...updatedCloud[idx], ...tombstone };
    else updatedCloud.push(tombstone);
    const success = await window.syncCloudData(updatedCloud);
    if(success) {
        window.showToast("Звук успешно удален!");
        if (login && sound && window.logUserActivity) {
            window.logUserActivity({
                type: 'sound_delete',
                text: `Удалил запись «${sound.title || id}»`,
                soundId: id
            }, login);
        }
    }
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

// Публично на карте/в библиотеке — только published.
// pending/rejected/draft живут в кабинете автора и в админ-очереди.
window.isSoundStatusVisible = function(s) {
    if (!s || s.deleted) return false;
    if (!s.status || s.status === 'published') return true;
    return false;
};

// --- Публичные профили рекордистов (общее облачное хранилище profiles.json) ---
window.getProfileByLogin = function(login) {
    if (!login) return null;
    const key = String(login).toLowerCase();
    return (window.profilesData || []).find(p => String(p.loginName || '').toLowerCase() === key) || null;
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

window.getMyFollowing = function() {
    if (!window.currentUser) return [];
    const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
    const me = window.getProfileByLogin(login);
    return [...(me?.following || [])];
};

window.getFollowersOf = function(login) {
    if (!login) return [];
    return (window.profilesData || [])
        .filter(p => (p.following || []).includes(login))
        .map(p => p.loginName);
};

window.isFollowingUser = function(login) {
    return window.getMyFollowing().includes(login);
};

window.renderPublicFollowUI = function(profileLogin, isOwn) {
    const followers = window.getFollowersOf(profileLogin);
    const following = (window.getProfileByLogin(profileLogin)?.following) || [];
    const fc = document.getElementById('pp-followers-count');
    const fg = document.getElementById('pp-following-count');
    if (fc) fc.textContent = String(followers.length);
    if (fg) fg.textContent = String(following.length);

    const btn = document.getElementById('pp-follow-btn');
    if (!btn) return;
    if (!profileLogin || isOwn || !window.currentUser) {
        btn.classList.add('hidden');
        return;
    }
    btn.classList.remove('hidden');
    const on = window.isFollowingUser(profileLogin);
    btn.textContent = on ? window.t('unfollow') : window.t('follow');
    btn.className = on
        ? 'mt-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold transition-colors'
        : 'mt-2 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-colors';
};

window.toggleFollowFromProfile = async function() {
    if (!window.currentUser) { if (window.openAuthModal) window.openAuthModal(); return; }
    const target = window.__publicProfileCtx?.login;
    if (!target) return;
    const myLogin = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
    if (target === myLogin) return;

    const updated = [...(window.profilesData || [])];
    let idx = updated.findIndex(p => p.loginName === myLogin);
    if (idx < 0) {
        updated.push({ loginName: myLogin, displayName: window.currentUser.username, following: [] });
        idx = updated.length - 1;
    }
    const following = new Set(updated[idx].following || []);
    const was = following.has(target);
    if (was) following.delete(target); else following.add(target);
    updated[idx] = { ...updated[idx], following: Array.from(following), profileUpdatedAt: new Date().toISOString() };
    const ok = await window.syncProfilesData(updated);
    if (ok) {
        window.showToast(was ? 'Вы отписались' : 'Подписка оформлена');
        window.renderPublicFollowUI(target, false);
        if (!was && window.pushNotifications) {
            window.pushNotifications([target], {
                type: 'follow',
                text: `${window.currentUser.username} подписался(ась) на вас`,
                fromId: myLogin,
                fromName: window.currentUser.username
            });
        }
    }
};

window.openFollowList = function(kind) {
    const login = window.__publicProfileCtx?.login;
    if (!login) return;
    const list = kind === 'followers'
        ? window.getFollowersOf(login)
        : ((window.getProfileByLogin(login)?.following) || []);
    if (!list.length) {
        window.showToast(kind === 'followers' ? 'Пока нет подписчиков' : 'Пока нет подписок');
        return;
    }
    const followItems = list.map(l => {
        const p = window.getProfileByLogin(l);
        return {
            icon: 'fa-user',
            label: p?.displayName || l,
            tone: 'primary',
            onClick: () => window.openPublicProfile(l, p?.displayName || l)
        };
    });
    // Список выбора людей — ActionSheet (не контекстное меню у курсора).
    if (window.ActionSheet) {
        window.ActionSheet.open(followItems, { title: kind === 'followers' ? 'Подписчики' : 'Подписки' });
    } else if (window.openActionsMenu) {
        window.openActionsMenu(followItems, { title: kind === 'followers' ? 'Подписчики' : 'Подписки' });
    }
};

window.notifyFollowersAboutNewSound = function(sound) {
    if (!sound || !sound.recordistId || sound.status !== 'published') return;
    const followers = window.getFollowersOf(sound.recordistId);
    if (!followers.length || !window.pushNotifications) return;
    window.pushNotifications(followers, {
        type: 'new_sound',
        text: `${sound.recordist || 'Автор'} опубликовал(а) новую запись «${sound.title}»`,
        fromId: sound.recordistId,
        fromName: sound.recordist,
        soundId: sound.id,
        soundTitle: sound.title
    });
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

    const presenceEl = document.getElementById('pp-presence');
    if (presenceEl) {
        const online = window.isUserOnline ? window.isUserOnline(profile) : false;
        const label = window.formatPresenceLabel ? window.formatPresenceLabel(profile) : (online ? 'в сети' : 'не в сети');
        presenceEl.innerHTML = `<i class="fa-solid fa-circle text-[7px] ${online ? 'text-emerald-500' : 'text-slate-400'}"></i>${label}`;
    }

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
    let avatarSrc = '';
    if (profile && profile.avatar) avatarSrc = profile.avatar;
    else if (isOwn && window.currentUser?.avatar) avatarSrc = window.currentUser.avatar;
    if (avatarSrc) {
        if (avatarEl) {
            avatarEl.src = avatarSrc;
            avatarEl.classList.remove('hidden');
            avatarEl.style.display = '';
        }
        if (avatarFallback) {
            avatarFallback.classList.add('hidden');
            avatarFallback.style.display = 'none';
        }
    } else {
        if (avatarEl) {
            avatarEl.removeAttribute('src');
            avatarEl.classList.add('hidden');
        }
        if (avatarFallback) {
            avatarFallback.classList.remove('hidden');
            avatarFallback.style.display = '';
        }
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

    if (window.renderProfileAchievements) {
        window.renderProfileAchievements(finalLogin, profile);
    }

    window.renderPublicFollowUI(finalLogin, isOwn);

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
    const escAttr = (v) => String(v ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'");

    const renderMetaSet = (set, containerId, toggleFn, icon, dataKey, activeSetName) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        const values = Array.from(set || []).sort((a, b) => String(a).localeCompare(String(b), 'ru'));
        if (!values.length) {
            container.innerHTML = '<div class="text-[10px] text-slate-400">Нет данных</div>';
            return;
        }

        const counts = new Map();
        if (dataKey === 'tagArray') {
            window.soundsData.forEach((sound) => {
                (sound.tagArray || []).forEach((t) => {
                    const key = String(t ?? '');
                    if (!key) return;
                    counts.set(key, (counts.get(key) || 0) + 1);
                });
            });
        } else {
            window.soundsData.forEach((sound) => {
                const key = String(sound[dataKey] ?? '');
                if (!key) return;
                counts.set(key, (counts.get(key) || 0) + 1);
            });
        }

        const activeSet = window[activeSetName];
        container.innerHTML = values.map((val) => {
            const isActive = activeSet && activeSet.has(val);
            const count = counts.get(String(val)) || 0;

            let displayName = val;
            if (dataKey === 'ecoCategory' && window.translations[window.currentLang] && window.translations[window.currentLang][`filter_${val}`]) {
                displayName = window.translations[window.currentLang][`filter_${val}`];
            }

            return `<button type="button" onclick="${toggleFn}('${escAttr(val)}')" class="px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border flex items-center ${isActive ? 'bg-[#141414] text-white border-[#141414] shadow-sm dark:bg-[#ff5a3d] dark:border-[#ff5a3d]' : 'bg-white/40 dark:bg-white/10 text-slate-600 dark:text-slate-300 border-white/50 dark:border-white/15 hover:bg-white/60 dark:hover:bg-white/15'}">
                ${icon ? `<i class="fa-solid ${icon} mr-1 opacity-70"></i>` : ''}${displayName} <span class="ml-1 text-[9px] font-normal opacity-60">(${count})</span>
            </button>`;
        }).join('');
    };

    renderMetaSet(window.allExtractedEcoLayers, 'filter-eco-layer', 'window.toggleEcoLayer', 'fa-leaf', 'ecoCategory', 'activeEcoLayer');
    renderMetaSet(window.allExtractedUcsCats, 'filter-ucs-categories', 'window.toggleUcsCat', 'fa-folder-tree', 'ucsCat', 'activeUcsCat');
    renderMetaSet(window.allExtractedSubcats, 'filter-ucs-subcategories', 'window.toggleUcsSub', 'fa-tag', 'typeTag', 'activeUcsSub');
    renderMetaSet(window.allExtractedTags, 'panel-tags', 'window.toggleGenTag', 'fa-hashtag', 'tagArray', 'activeGenTags');

    renderMetaSet(window.allExtractedPrinciples, 'filter-meta-principle', 'window.togglePrinciple', 'fa-street-view', 'recPrinciple', 'activePrinciple');
    renderMetaSet(window.allExtractedGears, 'filter-meta-gear', 'window.toggleGear', 'fa-walkie-talkie', 'gear', 'activeGear');
    renderMetaSet(window.allExtractedMics, 'filter-meta-mic', 'window.toggleMic', 'fa-microphone-lines', 'micType', 'activeMic');
    renderMetaSet(window.allExtractedChannels, 'filter-meta-channels', 'window.toggleChannels', 'fa-headphones', 'channels', 'activeChannels');
    renderMetaSet(window.allExtractedLicenses, 'filter-meta-license', 'window.toggleLicense', 'fa-scale-balanced', 'license', 'activeLicense');
    renderMetaSet(window.allExtractedRecordists, 'filter-meta-recordist', 'window.toggleRecordist', 'fa-user-astronaut', 'recordist', 'activeRecordist');
    renderMetaSet(window.allExtractedWeathers, 'filter-meta-weather', 'window.toggleWeather', 'fa-cloud-sun', 'weather', 'activeWeather');
    renderMetaSet(window.allExtractedDates, 'filter-meta-date', 'window.toggleDate', 'fa-calendar-days', 'date', 'activeDate');
    window.renderActiveTags();
}

window.renderActiveTags = function() {
    const containers = [
        document.getElementById('active-tags-container'),
        document.getElementById('library-active-filters')
    ].filter(Boolean);
    if (!containers.length) return;

    const escAttr = (v) => String(v ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'");
    const escHtml = (v) => String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const pills = [];
    const queryEl = document.getElementById('search-input');
    const query = queryEl ? queryEl.value.trim() : '';
    if (query) {
        pills.push({
            label: `«${query}»`,
            remove: `window.removeActiveFilter('search')`
        });
    }
    if (window.activeSessionId) {
        const sess = window.findSessionById ? window.findSessionById(window.activeSessionId) : null;
        pills.push({
            label: sess?.title || 'Экспедиция',
            remove: `window.removeActiveFilter('session')`
        });
    }

    const activeSets = [
        ['activeEcoLayer', 'ecoCategory'],
        ['activeUcsCat', null],
        ['activeUcsSub', null],
        ['activeGenTags', null],
        ['activePrinciple', null],
        ['activeGear', null],
        ['activeMic', null],
        ['activeChannels', null],
        ['activeLicense', null],
        ['activeRecordist', null],
        ['activeWeather', null],
        ['activeDate', null]
    ];
    activeSets.forEach(([setName, ecoKey]) => {
        const set = window[setName];
        if (!set || !set.size) return;
        set.forEach((val) => {
            let label = val;
            if (ecoKey === 'ecoCategory' && window.translations?.[window.currentLang]?.[`filter_${val}`]) {
                label = window.translations[window.currentLang][`filter_${val}`];
            }
            pills.push({
                label,
                remove: `window.removeActiveFilter('${setName}', '${escAttr(val)}')`
            });
        });
    });

    if (!pills.length) {
        containers.forEach((c) => { c.innerHTML = ''; });
        return;
    }

    const html = pills.map((p) => `
        <button type="button" onclick="${p.remove}" class="active-filter-pill" title="Убрать фильтр">
            <span class="truncate max-w-[9rem]">${escHtml(p.label)}</span>
            <i class="fa-solid fa-xmark opacity-70"></i>
        </button>
    `).join('') + `
        <button type="button" onclick="window.clearAllSoundFilters()" class="active-filter-clear">
            <i class="fa-solid fa-trash-can mr-1"></i>Сбросить
        </button>`;
    containers.forEach((c) => { c.innerHTML = html; });
}

window.getFilteredSounds = function(forceRefresh = false) {
    const queryEl = document.getElementById('search-input');
    const query = queryEl ? queryEl.value.trim().toLowerCase() : '';
    const cacheKey = `${query}|gen:${Array.from(window.activeGenTags || []).sort().join(',')}|${window.activeEcoLayer.size}|${Array.from(window.activeEcoLayer).sort().join(',')}|${window.activeUcsCat.size}|${Array.from(window.activeUcsCat).sort().join(',')}|${window.activeUcsSub.size}|${Array.from(window.activeUcsSub).sort().join(',')}|${window.activePrinciple.size}|${Array.from(window.activePrinciple).sort().join(',')}|${window.activeGear.size}|${Array.from(window.activeGear).sort().join(',')}|${window.activeMic.size}|${Array.from(window.activeMic).sort().join(',')}|${window.activeChannels.size}|${Array.from(window.activeChannels).sort().join(',')}|${window.activeLicense.size}|${Array.from(window.activeLicense).sort().join(',')}|${window.activeRecordist.size}|${Array.from(window.activeRecordist).sort().join(',')}|${window.activeWeather.size}|${Array.from(window.activeWeather).sort().join(',')}|${window.activeDate.size}|${Array.from(window.activeDate).sort().join(',')}|session:${window.activeSessionId || ''}`;

    if (!forceRefresh && window.__filteredSoundsCacheKey === cacheKey && window.__filteredSoundsCache) {
        return window.__filteredSoundsCache;
    }

    const filtered = window.soundsData.filter(s => {
        const tagHay = Array.isArray(s.tagArray) ? s.tagArray.join(' ') : '';
        const searchTarget = `${s.title} ${s.description} ${s.keywords} ${tagHay} ${s.ecoCategory} ${s.ucsCat} ${s.typeTag} ${s.recPrinciple} ${s.gear} ${s.micType} ${s.recordist} ${s.weather} ${s.date} ${s.license} ${s.channels}`.toLowerCase();
        const searchMatch = !query || searchTarget.includes(query);

        const ecoMatch = window.activeEcoLayer.size === 0 || window.activeEcoLayer.has(s.ecoCategory);
        const ucsCatMatch = window.activeUcsCat.size === 0 || window.activeUcsCat.has(s.ucsCat);
        const ucsSubMatch = window.activeUcsSub.size === 0 || window.activeUcsSub.has(s.typeTag);
        const genTagMatch = !window.activeGenTags.size
            || (Array.isArray(s.tagArray) && s.tagArray.some((t) => window.activeGenTags.has(t)));
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

        return searchMatch && ecoMatch && ucsCatMatch && ucsSubMatch && genTagMatch && principleMatch && gearMatch && micMatch && channelMatch && licenseMatch && recordistMatch && weatherMatch && dateMatch && statusMatch && sessionMatch;
    });

    window.__filteredSoundsCache = filtered;
    window.__filteredSoundsCacheKey = cacheKey;
    return filtered;
}

window.__listVirt = window.__listVirt || { rowH: 68, overscan: 8, items: [], key: '' };

window.buildSoundListRowHtml = function(sound) {
    const isSelected = window.currentPlayingId === sound.id;
    const playing = isSelected && window.isPlaying;
    const thumb = (sound.images && sound.images[0]) || `https://picsum.photos/seed/${sound.id}/72/72`;
    const eco = window.translations[window.currentLang][`filter_${sound.ecoCategory}`] || sound.ecoCategory;
    const esc = window.escMsgHtml || ((t) => String(t ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
    const safeId = String(sound.id).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `
        <div class="sidebar-sound-row${isSelected ? ' is-active' : ''}" data-sound-id="${esc(sound.id)}" onclick="window.selectSound('${safeId}')">
            <img src="${esc(thumb)}" alt="" class="sidebar-sound-thumb" loading="lazy" onerror="this.src='https://picsum.photos/seed/${esc(sound.id)}/72/72'">
            <button type="button" class="sidebar-sound-row__play${playing ? ' is-playing' : ''}" tabindex="-1">
                ${playing ? '<i class="fa-solid fa-pause text-xs"></i>' : '<i class="fa-solid fa-play text-xs translate-x-[1px]"></i>'}
            </button>
            <div class="flex-grow min-w-0 text-left">
                <h3 class="font-semibold text-[13px] truncate text-slate-800 dark:text-white flex items-center gap-1.5">${esc(sound.title)}</h3>
                <div class="flex flex-wrap gap-1 mt-1">
                    <span class="text-[8px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 font-bold uppercase tracking-wider font-mono">${esc(window.getSoundDisplayId ? window.getSoundDisplayId(sound) : sound.id)}</span>
                    <span class="text-[8px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 font-bold uppercase tracking-wider">${esc(eco)}</span>
                </div>
            </div>
        </div>`;
};

window.renderListWindow = function(force = false) {
    const listContainer = document.getElementById('sounds-list');
    if (!listContainer) return;
    const items = window.__listVirt.items || [];
    if (!items.length) return;

    const rowH = window.__listVirt.rowH || 68;
    const overscan = window.__listVirt.overscan || 8;
    const scrollTop = listContainer.scrollTop || 0;
    const viewH = listContainer.clientHeight || 480;
    const start = Math.max(0, Math.floor(scrollTop / rowH) - overscan);
    const end = Math.min(items.length, Math.ceil((scrollTop + viewH) / rowH) + overscan);
    const key = `${start}:${end}:${items.length}:${window.currentPlayingId}:${window.isPlaying ? 1 : 0}`;
    if (!force && key === window.__listVirt.key) return;
    window.__listVirt.key = key;

    const topPad = start * rowH;
    const bottomPad = Math.max(0, (items.length - end) * rowH);
    const slice = items.slice(start, end);
    listContainer.innerHTML = `
        <div class="sounds-list-virt" style="padding-top:${topPad}px;padding-bottom:${bottomPad}px">
            ${slice.map((sound) => window.buildSoundListRowHtml(sound)).join('')}
        </div>`;
};

window.renderList = function() {
    const listContainer = document.getElementById('sounds-list');
    if (!listContainer) return;
    const filtered = window.getFilteredSounds();
    if (filtered.length === 0) {
        window.__listVirt.items = [];
        window.__listVirt.key = '';
        const query = (document.getElementById('search-input')?.value || '').trim();
        const hasFilters = !!(window.activeEcoLayer.size || window.activeUcsCat.size || window.activeUcsSub.size
            || window.activeGenTags.size || window.activePrinciple.size || window.activeGear.size
            || window.activeMic.size || window.activeChannels.size || window.activeLicense.size
            || window.activeRecordist.size || window.activeWeather.size || window.activeDate.size
            || window.activeSessionId || query);
        listContainer.innerHTML = `
            <div class="library-empty text-center px-3 py-8">
                <i class="fa-solid fa-filter-circle-xmark text-2xl text-slate-300 dark:text-slate-600 mb-3 block"></i>
                <p class="text-sm font-semibold text-slate-500 dark:text-slate-400">Ничего не найдено</p>
                <p class="text-[11px] text-slate-400 mt-1">${hasFilters ? 'Сбросьте поиск или фильтры, чтобы снова увидеть записи.' : 'В библиотеке пока нет опубликованных звуков.'}</p>
                ${hasFilters ? `
                    <div class="flex flex-wrap justify-center gap-2 mt-4">
                        ${query ? `<button type="button" onclick="window.clearSearchQuery()" class="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200">Очистить поиск</button>` : ''}
                        <button type="button" onclick="window.clearAllSoundFilters()" class="px-3 py-2 rounded-xl text-xs font-bold bg-[#141414] text-white dark:bg-[#ff5a3d]">Сбросить фильтры</button>
                    </div>` : ''}
            </div>`;
        return;
    }

    window.__listVirt.items = filtered;
    if (!listContainer.__virtBound) {
        listContainer.__virtBound = true;
        listContainer.addEventListener('scroll', () => {
            if (window.__listVirtRaf) return;
            window.__listVirtRaf = requestAnimationFrame(() => {
                window.__listVirtRaf = null;
                window.renderListWindow(false);
            });
        }, { passive: true });
    }
    // Small lists: render fully without virtual padding overhead
    if (filtered.length <= 40) {
        window.__listVirt.key = `full:${filtered.length}:${window.currentPlayingId}:${window.isPlaying ? 1 : 0}`;
        listContainer.innerHTML = filtered.map((sound) => window.buildSoundListRowHtml(sound)).join('');
        return;
    }
    window.renderListWindow(true);
};

/** Update play/selection classes without rebuilding the whole library list. */
window.refreshPlayingListRow = function() {
    const listContainer = document.getElementById('sounds-list');
    if (!listContainer) return;
    const rows = listContainer.querySelectorAll('.sidebar-sound-row[data-sound-id]');
    if (!rows.length) {
        if (window.renderList) window.renderList();
        return;
    }
    const activeId = window.currentPlayingId;
    let found = false;
    rows.forEach((row) => {
        const id = row.dataset.soundId;
        const isSelected = id === activeId;
        if (isSelected) found = true;
        const playing = isSelected && window.isPlaying;
        row.classList.toggle('is-active', isSelected);
        const playBtn = row.querySelector('.sidebar-sound-row__play');
        if (playBtn) {
            playBtn.classList.toggle('is-playing', playing);
            playBtn.innerHTML = playing
                ? '<i class="fa-solid fa-pause text-xs"></i>'
                : '<i class="fa-solid fa-play text-xs translate-x-[1px]"></i>';
        }
    });
    // Active row may be outside the virtual window — refresh window classes via key bust
    if (!found && (window.__listVirt.items || []).length > 40) {
        window.__listVirt.key = '';
        window.renderListWindow(true);
    }
};

// ДОБАВЛЕНО: Функции переключения UCS фильтров
window.toggleEcoLayer = function(val) { if (window.activeEcoLayer.has(val)) window.activeEcoLayer.delete(val); else window.activeEcoLayer.add(val); window.processFilterChange(false); }
window.toggleUcsCat = function(val) { if (window.activeUcsCat.has(val)) window.activeUcsCat.delete(val); else window.activeUcsCat.add(val); window.processFilterChange(false); }
window.toggleUcsSub = function(val) { if (window.activeUcsSub.has(val)) window.activeUcsSub.delete(val); else window.activeUcsSub.add(val); window.processFilterChange(false); }
window.toggleGenTag = function(val) { if (window.activeGenTags.has(val)) window.activeGenTags.delete(val); else window.activeGenTags.add(val); window.processFilterChange(false); }

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

window.hideAllDockPanels = function() {
    ['sidebar-library', 'sidebar-feed', 'panel-expeditions', 'dock-details', 'dock-analyzers', 'dock-settings', 'dock-cabinet', 'dock-messages', 'dock-expedition', 'dock-help', 'dock-admin'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
};

window.setDockHeader = function(title, subtitle, showBack) {
    const titleEl = document.getElementById('dock-title');
    const subEl = document.getElementById('dock-subtitle');
    const back = document.getElementById('dock-back-btn');
    if (titleEl) {
        titleEl.textContent = title || 'Ростовская область';
        if (!title || title === 'Ростовская область') titleEl.setAttribute('data-lang', 'title');
        else titleEl.removeAttribute('data-lang');
    }
    if (subEl) {
        if (subtitle) {
            subEl.innerHTML = subtitle;
            subEl.removeAttribute('data-lang');
        } else {
            subEl.innerHTML = '<i class="fa-solid fa-map-location-dot text-[color:var(--accent)]"></i> Audio Map';
            subEl.setAttribute('data-lang', 'subtitle');
        }
    }
    // Arrow always visible and always hides the dock
    if (back) {
        back.classList.remove('hidden');
        back.title = 'Скрыть панель';
        back.setAttribute('aria-label', 'Скрыть панель');
        back.onclick = () => window.hideDockPanel && window.hideDockPanel();
    }
};

window.undockDetailsContent = function() {
    const content = document.getElementById('details-modal-content');
    const modal = document.getElementById('details-modal');
    if (content && modal && content.classList.contains('details-in-dock')) {
        content.classList.remove('details-in-dock');
        modal.appendChild(content);
    }
};

window.dockDetailsContent = function() {
    const content = document.getElementById('details-modal-content');
    const host = document.getElementById('dock-details-host');
    if (!content || !host) return;
    content.classList.add('details-in-dock');
    host.appendChild(content);
};

window.undockSettingsContent = function() {
    const content = document.getElementById('settings-modal-content');
    const modal = document.getElementById('settings-modal');
    if (content && modal && content.classList.contains('settings-in-dock')) {
        content.classList.remove('settings-in-dock');
        modal.appendChild(content);
    }
};

window.dockSettingsContent = function() {
    const content = document.getElementById('settings-modal-content');
    const host = document.getElementById('dock-settings-host');
    if (!content || !host) return;
    content.classList.add('settings-in-dock');
    host.appendChild(content);
};

window.undockCabinetContent = function() {
    const content = document.getElementById('cabinet-modal-content');
    const modal = document.getElementById('cabinet-modal');
    if (content && modal && content.classList.contains('cabinet-in-dock')) {
        content.classList.remove('cabinet-in-dock');
        modal.appendChild(content);
    }
};

window.dockCabinetContent = function() {
    const content = document.getElementById('cabinet-modal-content');
    const host = document.getElementById('dock-cabinet-host');
    if (!content || !host) return;
    content.classList.add('cabinet-in-dock');
    host.appendChild(content);
};

window.clearRailTabActive = function() {
    ['rail-library', 'rail-feed', 'rail-expeditions', 'rail-help', 'rail-admin'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.classList.remove('is-active');
        btn.removeAttribute('aria-current');
    });
    ['tab-library', 'tab-feed', 'tab-expeditions', 'tab-help'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.className = 'ui-tab ui-tab--main';
    });
};

window.undockMessagesContent = function() {
    const content = document.getElementById('messages-modal-content');
    const modal = document.getElementById('messages-modal');
    if (content && modal && content.classList.contains('messages-in-dock')) {
        content.classList.remove('messages-in-dock');
        modal.appendChild(content);
    }
};

window.dockMessagesContent = function() {
    const content = document.getElementById('messages-modal-content');
    const host = document.getElementById('dock-messages-host');
    if (!content || !host) return;
    content.classList.add('messages-in-dock');
    host.appendChild(content);
};

window.undockExpeditionContent = function() {
    const content = document.getElementById('expedition-view-modal-content');
    const modal = document.getElementById('expedition-view-modal');
    if (content && modal && content.classList.contains('expedition-in-dock')) {
        content.classList.remove('expedition-in-dock');
        modal.appendChild(content);
    }
};

window.dockExpeditionContent = function() {
    const content = document.getElementById('expedition-view-modal-content');
    const host = document.getElementById('dock-expedition-host');
    if (!content || !host) return;
    content.classList.add('expedition-in-dock');
    host.appendChild(content);
};

window.switchHelpTab = function(tab) {
    const next = tab === 'faq' ? 'faq' : 'support';
    window.__helpTab = next;
    const supportBtn = document.getElementById('help-tab-support');
    const faqBtn = document.getElementById('help-tab-faq');
    const supportPanel = document.getElementById('help-panel-support');
    const faqPanel = document.getElementById('help-panel-faq');
    if (supportBtn) supportBtn.className = next === 'support' ? 'ui-tab ui-tab--filter is-active' : 'ui-tab ui-tab--filter';
    if (faqBtn) faqBtn.className = next === 'faq' ? 'ui-tab ui-tab--filter is-active' : 'ui-tab ui-tab--filter';
    if (supportPanel) supportPanel.classList.toggle('hidden', next !== 'support');
    if (faqPanel) faqPanel.classList.toggle('hidden', next !== 'faq');
};

window.openDockView = function(view) {
    const prev = window.__dockView;
    const next = ['library', 'feed', 'expeditions', 'help', 'details', 'analyzers', 'settings', 'cabinet', 'messages', 'expedition', 'admin'].includes(view) ? view : 'library';
    window.__dockView = next;
    document.body.classList.remove('dock-view-details', 'dock-view-analyzers', 'dock-view-settings', 'dock-view-cabinet', 'dock-view-messages', 'dock-view-expedition', 'dock-view-help', 'dock-view-admin');

    if (prev === 'messages' && next !== 'messages') {
        window.__activeMessagePeer = null;
        if (window.cancelMessageReply) window.cancelMessageReply();
        if (window.hideEmojiPicker) window.hideEmojiPicker();
        const input = document.getElementById('messages-compose-input');
        if (input) input.value = '';
        window.__messagePendingImage = null;
    }
    if (prev === 'expedition' && next !== 'expedition') {
        window.__viewingExpeditionId = null;
    }

    window.hideAllDockPanels();
    window.undockDetailsContent();
    window.undockSettingsContent();
    window.undockCabinetContent();
    window.undockMessagesContent();
    window.undockExpeditionContent();
    document.body.classList.remove('cab-mobile-home');
    document.body.classList.remove('cab-mobile-sounds');
    const mobileLogout = document.getElementById('dock-mobile-logout');
    if (mobileLogout) mobileLogout.classList.add('hidden');

    const mobileTabs = document.getElementById('dock-mobile-tabs');

    if (next === 'details') {
        document.body.classList.add('dock-view-details');
        const panel = document.getElementById('dock-details');
        if (panel) panel.classList.remove('hidden');
        window.dockDetailsContent();
        window.setDockHeader('Описание звука', 'Карточка записи', true);
        if (mobileTabs) mobileTabs.classList.add('hidden');
        window.clearRailTabActive();
    } else if (next === 'analyzers') {
        document.body.classList.add('dock-view-analyzers');
        const panel = document.getElementById('dock-analyzers');
        if (panel) panel.classList.remove('hidden');
        window.setDockHeader('Анализаторы', 'Спектр · стерео · громкость', true);
        if (mobileTabs) mobileTabs.classList.add('hidden');
        window.clearRailTabActive();
    } else if (next === 'settings') {
        document.body.classList.add('dock-view-settings');
        const panel = document.getElementById('dock-settings');
        if (panel) panel.classList.remove('hidden');
        window.dockSettingsContent();
        window.setDockHeader('Настройки', 'Тема · карта · язык', true);
        if (mobileTabs) mobileTabs.classList.add('hidden');
        window.clearRailTabActive();
        if (window.refreshSettingsUI) window.refreshSettingsUI();
        if (window.renderRegionStats) window.renderRegionStats('region-stats-grid');
    } else if (next === 'cabinet') {
        document.body.classList.add('dock-view-cabinet');
        document.body.classList.add('cab-mobile-home');
        const panel = document.getElementById('dock-cabinet');
        if (panel) panel.classList.remove('hidden');
        window.dockCabinetContent();
        window.setDockHeader('Личный кабинет', 'Профиль и записи', true);
        if (window.innerWidth < 768) {
            window.setDockHeader(window.currentLang === 'en' ? 'Profile' : 'Профиль', '', false);
        }
        const mobileLogout = document.getElementById('dock-mobile-logout');
        if (mobileLogout) mobileLogout.classList.toggle('hidden', window.innerWidth >= 768);
        if (mobileTabs) mobileTabs.classList.add('hidden');
        window.clearRailTabActive();
        if (window.refreshCabinetTabs) window.refreshCabinetTabs();
        if (window.switchCabinetTab) window.switchCabinetTab('sounds');
    } else if (next === 'messages') {
        document.body.classList.add('dock-view-messages');
        const panel = document.getElementById('dock-messages');
        if (panel) panel.classList.remove('hidden');
        window.dockMessagesContent();
        window.setDockHeader('Сообщения', 'Чаты и поддержка', true);
        if (mobileTabs) mobileTabs.classList.add('hidden');
        window.clearRailTabActive();
    } else if (next === 'expedition') {
        document.body.classList.add('dock-view-expedition');
        const panel = document.getElementById('dock-expedition');
        if (panel) panel.classList.remove('hidden');
        window.dockExpeditionContent();
        const session = window.__viewingExpeditionId && window.findSessionById
            ? window.findSessionById(window.__viewingExpeditionId)
            : null;
        const title = session?.title || (window.currentLang === 'en' ? 'Expedition' : 'Экспедиция');
        window.setDockHeader(title, window.currentLang === 'en' ? 'Description' : 'Описание', true);
        if (mobileTabs) mobileTabs.classList.add('hidden');
        window.clearRailTabActive();
    } else if (next === 'help') {
        document.body.classList.add('dock-view-help');
        const panel = document.getElementById('dock-help');
        if (panel) panel.classList.remove('hidden');
        window.setDockHeader('Помощь', 'Поддержка и FAQ', false);
        if (mobileTabs) mobileTabs.classList.remove('hidden');
        window.__sidebarTab = 'help';
        window.clearRailTabActive();
        const railHelp = document.getElementById('rail-help');
        const tabHelp = document.getElementById('tab-help');
        if (railHelp) { railHelp.classList.add('is-active'); railHelp.setAttribute('aria-current', 'page'); }
        if (tabHelp) tabHelp.className = 'ui-tab ui-tab--main is-active';
        window.switchHelpTab(window.__helpTab || 'support');
    } else if (next === 'admin') {
        if (!window.isCurrentUserAdmin || !window.isCurrentUserAdmin()) {
            window.showToast('Нужны права администратора');
            window.openDockView(window.__sidebarTab || 'library');
            return;
        }
        document.body.classList.add('dock-view-admin');
        const panel = document.getElementById('dock-admin');
        if (panel) panel.classList.remove('hidden');
        window.setDockHeader(
            window.currentLang === 'en' ? 'Admin' : 'Админ-панель',
            window.currentLang === 'en' ? 'Moderation & tools' : 'Модерация и инструменты',
            true
        );
        if (mobileTabs) mobileTabs.classList.add('hidden');
        window.clearRailTabActive();
        const railAdmin = document.getElementById('rail-admin');
        if (railAdmin) {
            railAdmin.classList.add('is-active');
            railAdmin.setAttribute('aria-current', 'page');
        }
        if (window.switchAdminSection) window.switchAdminSection(window.__adminSection || 'sounds');
        if (window.refreshAdminRailBadge) window.refreshAdminRailBadge();
    } else {
        if (mobileTabs) mobileTabs.classList.remove('hidden');
        window.__sidebarTab = next;
        const btnLib = document.getElementById('tab-library');
        const btnFeed = document.getElementById('tab-feed');
        const btnExp = document.getElementById('tab-expeditions');
        const railLib = document.getElementById('rail-library');
        const railFeed = document.getElementById('rail-feed');
        const railExp = document.getElementById('rail-expeditions');
        const panelLib = document.getElementById('sidebar-library');
        const panelFeed = document.getElementById('sidebar-feed');
        const panelExp = document.getElementById('panel-expeditions');
        const activeClass = 'ui-tab ui-tab--main is-active';
        window.clearRailTabActive();

        if (next === 'feed') {
            if (btnFeed) btnFeed.className = activeClass;
            if (railFeed) { railFeed.classList.add('is-active'); railFeed.setAttribute('aria-current', 'page'); }
            if (panelFeed) panelFeed.classList.remove('hidden');
            window.setDockHeader('Лента', 'Новости и посты', false);
            if (window.renderSidebarFeed) window.renderSidebarFeed();
        } else if (next === 'expeditions') {
            if (btnExp) btnExp.className = activeClass;
            if (railExp) { railExp.classList.add('is-active'); railExp.setAttribute('aria-current', 'page'); }
            if (panelExp) panelExp.classList.remove('hidden');
            window.setDockHeader('Экспедиции', 'Маршруты и сессии', false);
            if (window.renderSidebarExpeditions) window.renderSidebarExpeditions();
        } else {
            if (btnLib) btnLib.className = activeClass;
            if (railLib) { railLib.classList.add('is-active'); railLib.setAttribute('aria-current', 'page'); }
            if (panelLib) panelLib.classList.remove('hidden');
            window.setDockHeader('Ростовская область', null, false);
        }
    }

    if (window.showDockPanel) window.showDockPanel();
};

window.closeDockViewer = function() {
    let returnTab = window.__dockView === 'expedition'
        ? (window.__sidebarTab || 'expeditions')
        : (window.__sidebarTab || 'library');
    if (window.openedFromAdmin && window.isCurrentUserAdmin && window.isCurrentUserAdmin()) {
        returnTab = 'admin';
        window.openedFromAdmin = false;
    }
    if (window.analyzersOpen) {
        window.__skipAnalyzerViewRestore = true;
        if (window.collapsePlayerAnalyzers) window.collapsePlayerAnalyzers();
        window.__skipAnalyzerViewRestore = false;
    }
    if (window.__dockView === 'messages' && window.closeMessagesModal) {
        window.__skipMessagesDockClose = true;
        window.closeMessagesModal();
        window.__skipMessagesDockClose = false;
    }
    if (window.__dockView === 'expedition' && window.closeExpeditionViewModal) {
        window.__skipExpeditionDockClose = true;
        window.closeExpeditionViewModal();
        window.__skipExpeditionDockClose = false;
    }
    window.undockDetailsContent();
    window.undockSettingsContent();
    window.undockCabinetContent();
    window.undockMessagesContent();
    window.undockExpeditionContent();
    const m = document.getElementById('details-modal');
    if (m) {
        m.classList.add('opacity-0', 'pointer-events-none', 'hidden');
        const c = document.getElementById('details-modal-content');
        if (c) c.classList.add('scale-95');
    }
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal) settingsModal.classList.add('hidden', 'opacity-0', 'pointer-events-none');
    const cabinetModal = document.getElementById('cabinet-modal');
    if (cabinetModal) cabinetModal.classList.add('hidden', 'opacity-0', 'pointer-events-none');
    const messagesModal = document.getElementById('messages-modal');
    if (messagesModal) messagesModal.classList.add('hidden', 'opacity-0', 'pointer-events-none');
    const expeditionModal = document.getElementById('expedition-view-modal');
    if (expeditionModal) expeditionModal.classList.add('hidden', 'opacity-0', 'pointer-events-none');
    window.openDockView(returnTab);
};

window.switchSidebarTab = function(tab) {
    const next = ['library', 'feed', 'expeditions', 'help'].includes(tab) ? tab : 'library';
    if (window.analyzersOpen) {
        window.__skipAnalyzerViewRestore = true;
        if (window.collapsePlayerAnalyzers) window.collapsePlayerAnalyzers();
        window.__skipAnalyzerViewRestore = false;
    }
    window.openDockView(next);
};

window.syncAccountChrome = function() {
    const loggedIn = !!window.currentUser;
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.classList.toggle('hidden', !loggedIn);
    if (window.refreshProfileButtonAvatar) window.refreshProfileButtonAvatar();
    if (window.refreshCabinetTabs) window.refreshCabinetTabs();
    else if (window.refreshAdminRailBadge) window.refreshAdminRailBadge();
};

window.__feedFilter = window.__feedFilter || 'all';

window.setFeedFilter = function(filter) {
    window.__feedFilter = filter || 'all';
    window.renderSidebarFeed();
};

window.feedRelTime = function(iso) {
    if (!iso) return '';
    const d = new Date(iso).getTime();
    if (!Number.isFinite(d)) return '';
    const diff = Date.now() - d;
    if (diff < 60000) return 'только что';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч`;
    if (diff < 86400000 * 7) return `${Math.floor(diff / 86400000)} д`;
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

window.feedEsc = function(t) {
    return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

window.feedAuthorChip = function(authorId, authorName) {
    const esc = window.feedEsc;
    const name = authorName || authorId || 'Админ';
    const profile = authorId && window.getProfileByLogin ? window.getProfileByLogin(authorId) : null;
    const initial = String(name).trim().charAt(0).toUpperCase() || '?';
    const avatar = profile?.avatar
        ? `<img src="${esc(profile.avatar)}" alt="" class="feed-avatar">`
        : `<span class="feed-avatar feed-avatar--fallback" aria-hidden="true">${esc(initial)}</span>`;
    const label = authorId
        ? `<button type="button" class="feed-author-link" onclick="event.stopPropagation(); window.openPublicProfile('${esc(authorId)}', '${esc(name)}')">${esc(name)}</button>`
        : `<span class="feed-author-link is-static">${esc(name)}</span>`;
    return `<span class="feed-author-chip">${avatar}${label}</span>`;
};

window.openFeedPostMenu = function(postId, ev) {
    const p = (window.feedPosts || []).find((x) => x.id === postId && !x.deleted);
    if (!p) return;
    const isAdmin = window.isCurrentUserAdmin && window.isCurrentUserAdmin();
    const items = [];
    if (p.authorId) {
        items.push({
            icon: 'fa-id-badge',
            label: 'Профиль автора',
            tone: 'primary',
            onClick: () => window.openPublicProfile(p.authorId, p.authorName || p.authorId)
        });
    }
    if (p.type === 'article') {
        items.push({ icon: 'fa-book-open', label: 'Читать статью', tone: 'primary', onClick: () => window.openFeedArticle(postId) });
    }
    items.push({
        icon: 'fa-comment',
        label: window.__feedOpenComments === postId ? 'Скрыть комментарии' : 'Комментарии',
        onClick: () => window.toggleFeedComments(postId)
    });
    items.push({
        icon: 'fa-heart',
        label: 'Нравится',
        onClick: () => window.toggleFeedReaction(postId)
    });
    if (isAdmin) {
        items.push({
            icon: 'fa-thumbtack',
            label: p.pinned ? 'Открепить' : 'Закрепить',
            onClick: () => window.toggleFeedPin(postId)
        });
        items.push({ icon: 'fa-pen', label: 'Изменить', tone: 'primary', onClick: () => window.openFeedPostEditor(postId) });
        items.push({ icon: 'fa-trash-can', label: 'Удалить', tone: 'danger', onClick: () => window.deleteFeedPost(postId) });
    }
    const opts = {
        title: p.title || 'Пост',
        subtitle: p.type === 'article' ? 'Статья' : 'Новость',
        event: ev
    };
    if (!ev && typeof event !== 'undefined') opts.event = event;
    if (window.openActionsMenu) window.openActionsMenu(items, opts);
    else if (window.CtxPopup) {
        window.CtxPopup.open({ ...opts, items, clientX: 80, clientY: 120 });
    } else window.ActionSheet.open(items);
};

window.renderSidebarFeed = function() {
    const container = document.getElementById('sidebar-feed');
    if (!container) return;

    const isAdmin = window.isCurrentUserAdmin && window.isCurrentUserAdmin();
    const login = window.currentUser
        ? (window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase())
        : null;
    const filter = window.__feedFilter || 'all';
    const esc = window.feedEsc;
    const relTime = window.feedRelTime;

    let posts = (window.feedPosts || []).filter((p) => p && !p.deleted);
    posts.sort((a, b) => {
        const ap = a.pinned ? 1 : 0;
        const bp = b.pinned ? 1 : 0;
        if (bp !== ap) return bp - ap;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
    if (filter === 'pinned') posts = posts.filter((p) => p.pinned);
    else if (filter === 'article') posts = posts.filter((p) => p.type === 'article');
    else if (filter === 'notice') posts = posts.filter((p) => p.type !== 'article');

    const published = (window.soundsData || []).filter((s) => !s.status || s.status === 'published');
    const recent = [...published]
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''), 'ru'))
        .slice(0, 8);
    const ecoLabels = { geophony: 'Гео', biophony: 'Био', anthrophony: 'Антро' };

    const filters = [
        { id: 'all', label: 'Все' },
        { id: 'pinned', label: 'Закреп' },
        { id: 'article', label: 'Статьи' },
        { id: 'notice', label: 'Новости' }
    ].map((f) => `
        <button type="button" class="feed-filter ${filter === f.id ? 'is-active' : ''}" onclick="window.setFeedFilter('${f.id}')">${f.label}</button>
    `).join('');

    const socialBar = (p) => {
        const reacted = !!login && (p.reactedBy || []).includes(login);
        const hearts = (p.reactedBy || []).length;
        const comments = (p.comments || []).length;
        const views = Number(p.views) || (p.viewedBy || []).length || 0;
        const open = window.__feedOpenComments === p.id;
        return `
        <div class="feed-social" onclick="event.stopPropagation()">
            <div class="feed-social__stats">
                <button type="button" class="feed-social__btn ${reacted ? 'is-active' : ''}" onclick="window.toggleFeedReaction('${p.id}')" aria-pressed="${reacted ? 'true' : 'false'}" title="Нравится">
                    <i class="fa-solid fa-heart"></i><span>${hearts || ''}</span>
                </button>
                <button type="button" class="feed-social__btn ${open ? 'is-open' : ''}" onclick="window.toggleFeedComments('${p.id}')" title="Комментарии">
                    <i class="fa-solid fa-comment"></i><span>${comments || ''}</span>
                </button>
                <span class="feed-social__btn feed-social__btn--muted" title="Просмотры"><i class="fa-regular fa-eye"></i><span>${views || 0}</span></span>
            </div>
            ${open ? window.renderFeedCommentsBlock(p) : ''}
        </div>`;
    };

    const postsHtml = posts.length
        ? posts.map((p) => {
            const dateStr = relTime(p.createdAt);
            const titleStyle = `font-family:${p.titleFont === 'serif' ? 'Georgia, "Times New Roman", serif' : 'var(--font-ui, inherit)'};font-size:${({ sm: '0.9375rem', md: '1.05rem', lg: '1.2rem', xl: '1.35rem' })[p.titleSize] || '1.05rem'}`;
            const typeLabel = p.type === 'article' ? 'Статья' : 'Новость';
            const typeCls = p.type === 'article' ? 'feed-type--article' : 'feed-type--notice';
            const head = `
                <div class="feed-post__head">
                    <div class="feed-post__meta-row">
                        ${p.pinned ? '<span class="feed-pin" title="Закреплено"><i class="fa-solid fa-thumbtack"></i></span>' : ''}
                        <span class="feed-type ${typeCls}">${typeLabel}</span>
                        <span class="feed-post__dot" aria-hidden="true">·</span>
                        <span class="feed-post__time">${esc(dateStr)}</span>
                    </div>
                    <button type="button" class="feed-post__more comment-menu-btn" onclick="event.stopPropagation(); window.openFeedPostMenu('${p.id}', event)" title="Действия" aria-label="Действия">
                        <i class="fa-solid fa-ellipsis"></i>
                    </button>
                </div>
                <div class="feed-post__by">${window.feedAuthorChip(p.authorId, p.authorName)}</div>`;

            if (p.type === 'article') {
                const cover = p.coverImage || (p.html && (p.html.match(/<img[^>]+src="([^"]+)"/) || [])[1]) || '';
                const plain = String(p.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                const teaser = plain.length > 140 ? `${plain.slice(0, 140)}…` : plain;
                return `<article class="feed-post${p.pinned ? ' is-pinned' : ''}" data-feed-id="${esc(p.id)}">
                    ${cover ? `<button type="button" class="feed-post__cover" onclick="window.openFeedArticle('${p.id}')"><img src="${esc(cover)}" alt=""></button>` : ''}
                    <div class="feed-post__body">
                        ${head}
                        <button type="button" class="feed-post__title-btn" onclick="window.openFeedArticle('${p.id}')">
                            <h3 class="feed-post__title" style="${titleStyle}">${esc(p.title)}</h3>
                            ${teaser ? `<p class="feed-post__teaser">${esc(teaser)}</p>` : ''}
                            <span class="feed-post__read">Читать <i class="fa-solid fa-arrow-right"></i></span>
                        </button>
                        ${socialBar(p)}
                    </div>
                </article>`;
            }

            return `<article class="feed-post feed-post--notice${p.pinned ? ' is-pinned' : ''}" data-feed-id="${esc(p.id)}">
                <div class="feed-post__body">
                    ${head}
                    <h3 class="feed-post__title" style="${titleStyle}">${esc(p.title)}</h3>
                    ${p.image ? `<div class="feed-post__media"><img src="${esc(p.image)}" alt=""></div>` : ''}
                    ${p.body ? `<p class="feed-post__text">${esc(p.body)}</p>` : ''}
                    ${socialBar(p)}
                </div>
            </article>`;
        }).join('')
        : `<div class="feed-empty">
            <i class="fa-regular fa-newspaper"></i>
            <p>Пока нет публикаций</p>
            <p class="feed-empty__hint">${filter === 'all' ? 'Здесь появятся новости и статьи карты' : 'В этом фильтре пусто'}</p>
            ${isAdmin && filter === 'all' ? '<button type="button" class="feed-admin-create" onclick="window.openFeedPostEditor()"><i class="fa-solid fa-plus"></i> Создать пост</button>' : ''}
           </div>`;

    const recentHtml = recent.length
        ? `<section class="feed-recent" aria-label="Недавние записи">
            <div class="feed-section-label">С карты</div>
            <div class="feed-recent__rail">
                ${recent.map((s) => `
                    <button type="button" class="feed-recent__item" onclick="window.selectSound('${esc(s.id)}')">
                        <span class="feed-recent__eco">${ecoLabels[s.ecoCategory] || 'Звук'}</span>
                        <span class="feed-recent__title">${esc(s.title || 'Без названия')}</span>
                        <span class="feed-recent__meta">${esc([s.recordist, s.duration].filter(Boolean).join(' · '))}</span>
                    </button>`).join('')}
            </div>
           </section>`
        : '';

    container.innerHTML = `
        <div class="feed-shell">
            <div class="feed-toolbar">
                <header class="feed-head">
                    <div class="feed-head__text">
                        <h2 class="feed-head__title">Лента</h2>
                        <p class="feed-head__sub">Новости карты и полевые заметки</p>
                    </div>
                    ${isAdmin ? `<button type="button" class="feed-head__create" onclick="window.openFeedPostEditor()" title="Новый пост"><i class="fa-solid fa-plus"></i></button>` : ''}
                </header>
                <div class="feed-filters" role="tablist">${filters}</div>
            </div>
            <div class="feed-stream" id="feed-posts-list">${postsHtml}</div>
            ${recentHtml}
        </div>`;

    requestAnimationFrame(() => {
        if (window.bindFeedViewObserver) window.bindFeedViewObserver();
    });
};

window.renderFeedCommentsBlock = function(p) {
    const esc = window.feedEsc;
    const login = window.currentUser
        ? (window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase())
        : null;
    const comments = p.comments || [];
    const list = comments.length
        ? comments.map((c) => {
            const reactedByMe = !!login && (c.reactedBy || []).includes(login);
            const reactionCount = (c.reactedBy || []).length;
            const when = c.date || window.feedRelTime(c.createdAt);
            const profile = c.authorId && window.getProfileByLogin ? window.getProfileByLogin(c.authorId) : null;
            const avatar = profile?.avatar
                ? `<img src="${esc(profile.avatar)}" alt="" class="comment-avatar">`
                : `<span class="comment-avatar comment-avatar-fallback"><i class="fa-solid fa-user"></i></span>`;
            const name = c.authorId
                ? `<span class="comment-author-link" onclick="window.openPublicProfile('${esc(c.authorId)}', '${esc(c.author)}')">${esc(c.author || 'Гость')}</span>`
                : `<span class="font-bold text-slate-700 dark:text-slate-200">${esc(c.author || 'Гость')}</span>`;
            return `
            <div class="feed-comment">
                <div class="feed-comment__top">
                    <span class="comment-author-wrap">${avatar}${name}</span>
                    <div class="feed-comment__tools">
                        <span class="feed-comment__date">${esc(when)}</span>
                        <button type="button" class="comment-menu-btn" title="Действия" onclick="window.openFeedCommentMenu('${p.id}', '${esc(c.id)}', event)">
                            <i class="fa-solid fa-ellipsis"></i>
                        </button>
                    </div>
                </div>
                <p class="feed-comment__text">${esc(c.text)}</p>
                <button type="button" class="comment-reaction-btn ${reactedByMe ? 'active' : ''}" onclick="window.toggleFeedCommentReaction('${p.id}', '${esc(c.id)}')">
                    <i class="fa-solid fa-heart"></i>${reactionCount > 0 ? reactionCount : ''}
                </button>
            </div>`;
        }).join('')
        : `<p class="text-sm text-slate-400 italic px-1">Нет комментариев — напишите первым</p>`;

    return `
        <div class="feed-comments">
            <div class="feed-comments__list">${list}</div>
            <div class="feed-comments__compose">
                <input id="feed-comment-input-${esc(p.id)}" type="text" maxlength="500" class="modal-input text-xs" placeholder="Комментарий…" onkeydown="if(event.key==='Enter'){event.preventDefault();window.addFeedComment('${p.id}')}">
                <button type="button" class="feed-comments__send" onclick="window.addFeedComment('${p.id}')" aria-label="Отправить"><i class="fa-solid fa-paper-plane"></i></button>
            </div>
        </div>`;
};

window.openFeedCommentMenu = function(postId, commentId, ev) {
    const p = (window.feedPosts || []).find((x) => x.id === postId);
    if (!p) return;
    const c = (p.comments || []).find((x) => x.id === commentId);
    if (!c) return;
    const login = window.currentUser
        ? (window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase())
        : null;
    const isAdmin = window.isCurrentUserAdmin && window.isCurrentUserAdmin();
    const reacted = !!login && (c.reactedBy || []).includes(login);
    const items = [];
    if (c.authorId) {
        items.push({
            icon: 'fa-id-badge',
            label: 'Профиль автора',
            tone: 'primary',
            onClick: () => window.openPublicProfile(c.authorId, c.author)
        });
    }
    items.push({
        icon: 'fa-heart',
        label: reacted ? 'Убрать реакцию' : 'Поставить реакцию',
        onClick: () => window.toggleFeedCommentReaction(postId, commentId)
    });
    items.push({
        icon: 'fa-flag',
        label: 'Пожаловаться',
        tone: 'warning',
        onClick: async () => {
            if (!window.currentUser) {
                window.showToast('Войдите, чтобы пожаловаться');
                if (window.openAuthModal) window.openAuthModal();
                return;
            }
            if (window.notifyAdmins) {
                window.notifyAdmins({
                    type: 'report',
                    text: `Жалоба на комментарий в ленте «${p.title || postId}»: ${String(c.text || '').slice(0, 120)}`,
                    fromId: login,
                    fromName: window.currentUser.username
                });
            }
            window.showToast('Жалоба отправлена');
        }
    });
    if (isAdmin || (login && c.authorId === login)) {
        items.push({
            icon: 'fa-trash-can',
            label: 'Удалить',
            tone: 'danger',
            onClick: () => window.deleteFeedComment(postId, commentId)
        });
    }
    if (window.openActionsMenu) window.openActionsMenu(items, { title: c.author || 'Комментарий', event: ev || (typeof event !== 'undefined' ? event : null) });
    else window.ActionSheet.open(items);
};

window.toggleFeedCommentReaction = async function(postId, commentId) {
    if (!window.currentUser) {
        window.showToast('Войдите, чтобы поставить реакцию');
        if (window.openAuthModal) window.openAuthModal();
        return;
    }
    const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
    const guard = window.spamGuardCheck
        ? window.spamGuardCheck(`feed-c-react:${login}`, { minIntervalMs: 400, maxPerWindow: 40, windowMs: 60000 })
        : { ok: true };
    if (!guard.ok) { window.spamGuardToast(guard); return; }
    const now = new Date().toISOString();
    const next = (window.feedPosts || []).map((p) => {
        if (p.id !== postId) return p;
        const comments = (p.comments || []).map((c) => {
            if (c.id !== commentId) return c;
            const reactedBy = [...(c.reactedBy || [])];
            const idx = reactedBy.indexOf(login);
            if (idx >= 0) reactedBy.splice(idx, 1); else reactedBy.push(login);
            return { ...c, reactedBy, reactedAt: now, updatedAt: now };
        });
        return { ...p, comments, updatedAt: now };
    });
    window.__feedOpenComments = postId;
    await window.syncFeedPosts(next);
};

window.deleteFeedComment = async function(postId, commentId) {
    const ok = await window.CustomUI.open({
        title: 'Удалить комментарий?',
        message: 'Комментарий исчезнет из ленты.',
        confirmText: 'Удалить',
        confirmClass: 'px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl'
    });
    if (!ok) return;
    const next = (window.feedPosts || []).map((p) => {
        if (p.id !== postId) return p;
        return {
            ...p,
            comments: (p.comments || []).filter((c) => c.id !== commentId),
            updatedAt: new Date().toISOString()
        };
    });
    window.__feedOpenComments = postId;
    const success = await window.syncFeedPosts(next);
    if (success) window.showToast('Комментарий удалён');
};

window.toggleFeedComments = function(postId) {
    window.__feedOpenComments = window.__feedOpenComments === postId ? null : postId;
    window.renderSidebarFeed();
};

window.toggleFeedReaction = async function(postId) {
    if (!window.currentUser) { window.showToast('Войдите, чтобы поставить реакцию'); if (window.openAuthModal) window.openAuthModal(); return; }
    const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
    const guard = window.spamGuardCheck ? window.spamGuardCheck(`feed-react:${login}`, { minIntervalMs: 400, maxPerWindow: 40, windowMs: 60000 }) : { ok: true };
    if (!guard.ok) { window.spamGuardToast(guard); return; }
    const next = (window.feedPosts || []).map((p) => {
        if (p.id !== postId) return p;
        const reactedBy = [...(p.reactedBy || [])];
        const idx = reactedBy.indexOf(login);
        if (idx >= 0) reactedBy.splice(idx, 1); else reactedBy.push(login);
        const now = new Date().toISOString();
        return { ...p, reactedBy, reactedAt: now, updatedAt: now };
    });
    await window.syncFeedPosts(next);
};

window.toggleFeedPin = async function(postId) {
    if (!window.isCurrentUserAdmin || !window.isCurrentUserAdmin()) return;
    const next = (window.feedPosts || []).map((p) => {
        if (p.id !== postId) return p;
        const pinned = !p.pinned;
        const now = new Date().toISOString();
        return { ...p, pinned, pinnedAt: pinned ? now : null, updatedAt: now };
    });
    await window.syncFeedPosts(next);
};

window.addFeedComment = async function(postId) {
    if (!window.currentUser) { window.showToast('Войдите, чтобы комментировать'); if (window.openAuthModal) window.openAuthModal(); return; }
    const input = document.getElementById(`feed-comment-input-${postId}`);
    const text = (input?.value || '').trim();
    if (!text) return;
    const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
    const guard = window.spamGuardCheck ? window.spamGuardCheck(`feed-comment:${login}`, { minIntervalMs: 2500, maxPerWindow: 8, windowMs: 60000 }) : { ok: true };
    if (!guard.ok) { window.spamGuardToast(guard); return; }
    const now = new Date();
    const comment = {
        id: 'fc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        author: window.currentUser.username,
        authorId: login,
        text: text.slice(0, 500),
        date: now.toLocaleDateString('ru-RU'),
        createdAt: now.toISOString(),
        reactedBy: []
    };
    const next = (window.feedPosts || []).map((p) => {
        if (p.id !== postId) return p;
        return { ...p, comments: [...(p.comments || []), comment], updatedAt: now.toISOString() };
    });
    window.__feedOpenComments = postId;
    const ok = await window.syncFeedPosts(next);
    if (ok) window.showToast('Комментарий добавлен');
};

window.__feedViewedSession = window.__feedViewedSession || new Set();
window.recordFeedView = async function(postId) {
    if (!postId || window.__feedViewedSession.has(postId)) return;
    window.__feedViewedSession.add(postId);
    const login = window.currentUser
        ? (window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase())
        : null;
    const next = (window.feedPosts || []).map((p) => {
        if (p.id !== postId) return p;
        const viewedBy = [...(p.viewedBy || [])];
        if (login && !viewedBy.includes(login)) viewedBy.push(login);
        const views = Math.max(Number(p.views) || 0, viewedBy.length) + (login ? 0 : 1);
        return { ...p, viewedBy, views: login ? Math.max(views, viewedBy.length) : views, updatedAt: new Date().toISOString() };
    });
    window.syncFeedPosts(next);
};

window.bindFeedViewObserver = function() {
    const root = document.getElementById('feed-posts-list');
    if (!root || typeof IntersectionObserver === 'undefined') return;
    if (window.__feedViewObserver) window.__feedViewObserver.disconnect();
    window.__feedViewObserver = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
            if (!en.isIntersecting) return;
            const id = en.target.getAttribute('data-feed-id');
            if (id) window.recordFeedView(id);
        });
    }, { root: document.getElementById('sidebar'), threshold: 0.55 });
    root.querySelectorAll('[data-feed-id]').forEach((el) => window.__feedViewObserver.observe(el));
};

window.__editingFeedPostId = null;
window.__noticeFeedImage = null;
window.__cropState = null;
window.__cropCallback = null;

window.updateFeedPostTypeUI = function() {
    const type = document.querySelector('input[name="feed-post-type"]:checked')?.value || 'notice';
    const noticeBox = document.getElementById('feed-post-notice-fields');
    const articleBox = document.getElementById('feed-post-article-fields');
    if (noticeBox) noticeBox.classList.toggle('hidden', type !== 'notice');
    if (articleBox) articleBox.classList.toggle('hidden', type !== 'article');
};

window.renderNoticeImagePreview = function() {
    const wrap = document.getElementById('feed-notice-image-preview');
    const img = document.getElementById('feed-notice-image-el');
    const widthInput = document.getElementById('feed-notice-image-width');
    if (!wrap || !img) return;
    if (!window.__noticeFeedImage) {
        wrap.classList.add('hidden');
        return;
    }
    wrap.classList.remove('hidden');
    img.src = window.__noticeFeedImage;
    const w = widthInput ? Number(widthInput.value) || 100 : 100;
    img.style.width = `${w}%`;
    window.updateNoticeImageWidthPreview();
};

window.updateNoticeImageWidthPreview = function() {
    const widthInput = document.getElementById('feed-notice-image-width');
    const label = document.getElementById('feed-notice-image-width-label');
    const img = document.getElementById('feed-notice-image-el');
    const w = widthInput ? Number(widthInput.value) || 100 : 100;
    if (label) label.textContent = `${w}%`;
    if (img) img.style.width = `${w}%`;
};

window.clearNoticeFeedImage = function() {
    window.__noticeFeedImage = null;
    window.renderNoticeImagePreview();
};

window.pickNoticeFeedImage = function(files) {
    const file = files && files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        window.openImageCropModal(e.target.result, (cropped) => {
            window.__noticeFeedImage = cropped;
            window.renderNoticeImagePreview();
        });
    };
    reader.readAsDataURL(file);
    const input = document.getElementById('feed-notice-image-input');
    if (input) input.value = '';
};

window.pickArticleFeedImage = function(files) {
    const file = files && files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        window.openImageCropModal(e.target.result, (cropped) => {
            const editor = document.getElementById('feed-post-editor');
            if (!editor) return;
            editor.focus();
            document.execCommand('insertHTML', false, `<img src="${cropped}" alt="" class="feed-inline-img">`);
        });
    };
    reader.readAsDataURL(file);
    const input = document.getElementById('feed-post-image-input');
    if (input) input.value = '';
};

window.openImageCropModal = function(dataUrl, onDone) {
    window.__cropCallback = onDone;
    const img = document.getElementById('image-crop-source');
    const zoom = document.getElementById('image-crop-zoom');
    if (img) {
        img.onload = () => {
            window.__cropState = { x: 0, y: 0, scale: 1, dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 };
            if (zoom) zoom.value = 100;
            window.updateImageCropTransform();
            window.bindImageCropDrag();
        };
        img.src = dataUrl;
    }
    const m = document.getElementById('image-crop-modal');
    const c = document.getElementById('image-crop-modal-content');
    if (!m || !c) return;
    m.classList.remove('hidden');
    void m.offsetWidth;
    m.classList.remove('opacity-0', 'pointer-events-none');
    c.classList.remove('scale-95');
};

window.closeImageCropModal = function() {
    const m = document.getElementById('image-crop-modal');
    const c = document.getElementById('image-crop-modal-content');
    if (!m || !c) return;
    m.classList.add('opacity-0', 'pointer-events-none');
    c.classList.add('scale-95');
    setTimeout(() => { if (m.classList.contains('opacity-0')) m.classList.add('hidden'); }, 300);
    window.__cropCallback = null;
};

window.updateImageCropTransform = function() {
    const img = document.getElementById('image-crop-source');
    const zoom = document.getElementById('image-crop-zoom');
    if (!img || !window.__cropState) return;
    const scale = (Number(zoom?.value) || 100) / 100;
    window.__cropState.scale = scale;
    img.style.transform = `translate(calc(-50% + ${window.__cropState.x}px), calc(-50% + ${window.__cropState.y}px)) scale(${scale})`;
};

window.bindImageCropDrag = function() {
    const stage = document.getElementById('image-crop-stage');
    if (!stage || stage.__cropBound) return;
    stage.__cropBound = true;
    const onDown = (clientX, clientY) => {
        if (!window.__cropState) return;
        window.__cropState.dragging = true;
        window.__cropState.startX = clientX;
        window.__cropState.startY = clientY;
        window.__cropState.origX = window.__cropState.x;
        window.__cropState.origY = window.__cropState.y;
    };
    const onMove = (clientX, clientY) => {
        if (!window.__cropState?.dragging) return;
        window.__cropState.x = window.__cropState.origX + (clientX - window.__cropState.startX);
        window.__cropState.y = window.__cropState.origY + (clientY - window.__cropState.startY);
        window.updateImageCropTransform();
    };
    const onUp = () => { if (window.__cropState) window.__cropState.dragging = false; };
    stage.addEventListener('mousedown', (e) => { e.preventDefault(); onDown(e.clientX, e.clientY); });
    window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onUp);
    stage.addEventListener('touchstart', (e) => {
        if (e.touches[0]) onDown(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
        if (e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    window.addEventListener('touchend', onUp);
};

window.applyImageCrop = function() {
    const frame = document.getElementById('image-crop-frame');
    const img = document.getElementById('image-crop-source');
    if (!frame || !img || !img.naturalWidth) return;

    const imgRect = img.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const scaleX = img.naturalWidth / imgRect.width;
    const scaleY = img.naturalHeight / imgRect.height;
    const sx = Math.max(0, (frameRect.left - imgRect.left) * scaleX);
    const sy = Math.max(0, (frameRect.top - imgRect.top) * scaleY);
    const sw = Math.min(img.naturalWidth - sx, frameRect.width * scaleX);
    const sh = Math.min(img.naturalHeight - sy, frameRect.height * scaleY);

    const outSize = 900;
    const canvas = document.createElement('canvas');
    canvas.width = outSize;
    canvas.height = outSize;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, outSize, outSize);
    try {
        ctx.drawImage(img, sx, sy, Math.max(1, sw), Math.max(1, sh), 0, 0, outSize, outSize);
    } catch (e) {
        window.showToast('Не удалось кадрировать изображение');
        return;
    }
    const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
    const cb = window.__cropCallback;
    window.closeImageCropModal();
    if (cb) cb(dataUrl);
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
    const widthInput = document.getElementById('feed-notice-image-width');

    if (titleEl) titleEl.value = post?.title || '';
    if (bodyEl) bodyEl.value = post?.body || '';
    if (editor) editor.innerHTML = post?.html || '';
    if (fontEl) fontEl.value = post?.titleFont || 'sans';
    if (sizeEl) sizeEl.value = post?.titleSize || 'md';
    window.__noticeFeedImage = post?.image || null;
    if (widthInput) widthInput.value = String(post?.imageWidth || 100);
    const pinEl = document.getElementById('feed-post-pinned');
    if (pinEl) pinEl.checked = !!post?.pinned;
    window.renderNoticeImagePreview();
    document.querySelectorAll('input[name="feed-post-type"]').forEach(r => {
        r.checked = (r.value === (post?.type || 'notice'));
    });
    if (header) header.innerHTML = `<i class="fa-solid fa-pen-to-square mr-2 text-blue-500"></i>${post ? 'Редактировать пост' : 'Новый пост'}`;
    window.updateFeedPostTypeUI();
    window.applyFeedTitlePreview();
    window.__feedPostSnapshot = {
        type: post?.type || 'notice',
        title: post?.title || '',
        body: post?.body || '',
        html: post?.html || '',
        image: post?.image || '',
        width: String(post?.imageWidth || 100)
    };

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
    window.__noticeFeedImage = null;
    window.__feedPostSnapshot = null;
};

window.isFeedPostDirty = function() {
    const snap = window.__feedPostSnapshot;
    if (!snap) return false;
    const type = document.querySelector('input[name="feed-post-type"]:checked')?.value || 'notice';
    const title = (document.getElementById('feed-post-title')?.value || '').trim();
    const body = (document.getElementById('feed-post-body')?.value || '').trim();
    const html = document.getElementById('feed-post-editor')?.innerHTML || '';
    const image = window.__noticeFeedImage || '';
    const width = String(document.getElementById('feed-notice-image-width')?.value || '100');
    return type !== snap.type
        || title !== snap.title
        || body !== snap.body
        || html !== snap.html
        || image !== snap.image
        || width !== snap.width;
};

window.requestCloseFeedPostModal = async function() {
    if (window.isFeedPostDirty()) {
        const ok = await window.confirmDiscardDraft('Черновик поста не сохранён.');
        if (!ok) return;
    }
    window.closeFeedPostModal();
};

window.renderDetailsGallery = function() {
    const images = window.__detailsGalleryImages || [];
    const idx = Math.max(0, Math.min(window.__detailsGalleryIndex || 0, images.length - 1));
    window.__detailsGalleryIndex = idx;
    const detImg = document.getElementById('details-image');
    const thumbs = document.getElementById('details-extra-images');
    const counter = document.getElementById('details-gallery-counter');
    if (detImg) {
        detImg.src = images[idx] || '';
        detImg.onclick = () => window.openLightbox(images, idx);
    }
    if (counter) {
        if (images.length > 1) {
            counter.classList.remove('hidden');
            counter.textContent = `${idx + 1} / ${images.length}`;
        } else {
            counter.classList.add('hidden');
        }
    }
    if (thumbs) {
        if (images.length > 1) {
            thumbs.classList.remove('hidden');
            thumbs.innerHTML = images.map((src, i) =>
                `<img src="${src}" class="details-gallery__thumb ${i === idx ? 'active' : ''}" alt="" onclick="event.stopPropagation(); window.setDetailsGalleryIndex(${i})">`
            ).join('');
        } else {
            thumbs.classList.add('hidden');
            thumbs.innerHTML = '';
        }
    }
};

window.setDetailsGalleryIndex = function(i) {
    window.__detailsGalleryIndex = i;
    window.renderDetailsGallery();
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
    const noticeImage = window.__noticeFeedImage || null;
    const imageWidth = Number(document.getElementById('feed-notice-image-width')?.value) || 100;
    if (type === 'notice' && !body && !noticeImage) { window.showToast('Добавьте текст или фото уведомления'); return; }
    if (type === 'article' && !html.replace(/<[^>]+>/g, '').trim() && !html.includes('<img')) {
        window.showToast('Добавьте текст или фото в статью');
        return;
    }

    const coverMatch = html.match(/<img[^>]+src="([^"]+)"/);
    const coverImage = type === 'article' && coverMatch ? coverMatch[1] : '';

    const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
    const now = new Date().toISOString();
    const existingId = window.__editingFeedPostId;
    const prev = existingId ? (window.feedPosts || []).find(p => p.id === existingId) : null;
    const pinned = !!document.getElementById('feed-post-pinned')?.checked;
    const post = {
        id: existingId || ('fp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
        type,
        title,
        body: type === 'notice' ? body.slice(0, 400) : '',
        html: type === 'article' ? html : '',
        image: type === 'notice' ? noticeImage : undefined,
        imageWidth: type === 'notice' && noticeImage ? imageWidth : undefined,
        coverImage: coverImage || undefined,
        titleFont: document.getElementById('feed-post-title-font')?.value || 'sans',
        titleSize: document.getElementById('feed-post-title-size')?.value || 'md',
        authorId: login,
        authorName: window.currentUser.username || 'Админ',
        pinned,
        pinnedAt: pinned ? (prev?.pinnedAt || now) : null,
        comments: prev?.comments || [],
        reactedBy: prev?.reactedBy || [],
        viewedBy: prev?.viewedBy || [],
        views: prev?.views || 0,
        createdAt: existingId ? (prev?.createdAt || now) : now,
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
    if (window.recordFeedView) window.recordFeedView(postId);

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

    const activeClass = 'ui-tab ui-tab--filter is-active';
    const inactiveClass = 'ui-tab ui-tab--filter';

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

    window.__selectSoundToken = (window.__selectSoundToken || 0) + 1;
    const selectToken = window.__selectSoundToken;

    if (window.animationFrameId) {
        cancelAnimationFrame(window.animationFrameId);
        window.animationFrameId = null;
    }
    if (window.mockInterval) {
        clearInterval(window.mockInterval);
        window.mockInterval = null;
    }
    if (window.audioElement) {
        try { window.audioElement.pause(); } catch (_) {}
        try { window.audioElement.currentTime = 0; } catch (_) {}
    }
    window.isPlaying = false;
    window.currentPlayingId = id;
    window.trackSoundPlay(id);
    window.updateMapMarkers();
    if (window.refreshPlayingListRow) window.refreshPlayingListRow();
    if (window.playSfx) window.playSfx('select');
    const card = document.getElementById('player-card');
    if(card) card.classList.remove('translate-y-[150%]', 'opacity-0');
    document.body.classList.add('player-visible');

    const titleEl = document.getElementById('player-title');
    const gearEl = document.getElementById('player-gear');
    if (titleEl) titleEl.textContent = s.title;
    if (gearEl) gearEl.innerHTML = `<i class="fa-solid fa-walkie-talkie mr-1 text-slate-400"></i>${s.gear}`;

    if (s.url) {
        if (window.audioElement) {
            if (window.audioElement.src !== s.url && !window.audioElement.src.endsWith(s.url)) {
                window.audioElement.src = s.url;
                try { window.audioElement.load(); } catch (_) {}
            }
            const playPromise = window.audioElement.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    if (window.__selectSoundToken !== selectToken || window.currentPlayingId !== id) return;
                    window.isPlaying = true;
                    window.startTimelineAnimation();
                    window.updateUIState();
                }).catch((err) => {
                    if (window.__selectSoundToken !== selectToken || window.currentPlayingId !== id) return;
                    if (err?.name === 'AbortError') return;
                    window.isPlaying = false;
                    window.prepareMockPlayback(s);
                });
            }
        }
    } else {
        if (window.audioElement) { window.audioElement.pause(); window.audioElement.removeAttribute('src'); }
        window.prepareMockPlayback(s);
    }

    window.updateUIState();
    if (window.refreshAnalyzerMetersIfOpen) window.refreshAnalyzerMetersIfOpen();
}

window.openDetailsModal = function() {
    const s = window.soundsData.find(x => x.id === window.currentPlayingId);
    if (!s) return;

    const images = (s.images && s.images.length)
        ? s.images
        : [`https://picsum.photos/seed/${s.id}/800/500`];
    window.__detailsGalleryImages = images;
    window.__detailsGalleryIndex = 0;
    window.renderDetailsGallery();

    const titleEl = document.getElementById('details-title');
    const fileEl = document.getElementById('details-filename');
    const descEl = document.getElementById('details-description');

    if (titleEl) titleEl.textContent = s.title;
    const idEl = document.getElementById('details-sound-id');
    if (idEl) idEl.textContent = `ID · ${window.getSoundDisplayId ? window.getSoundDisplayId(s) : s.id}`;
    if (fileEl) fileEl.innerHTML = `<i class="fa-solid fa-file-waveform mr-1"></i>${s.archiveNum || s.id}_${s.fileName}`;
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

    const adminBtn = document.getElementById('details-admin-actions-btn');
    if (adminBtn) {
        const isAdmin = window.isCurrentUserAdmin && window.isCurrentUserAdmin();
        adminBtn.classList.toggle('hidden', !isAdmin);
        adminBtn.classList.toggle('flex', !!isAdmin);
    }

    // Always open sound card in the left viewer dock (mobile opens the drawer)
    if (window.openDockView) {
        window.openDockView('details');
        return;
    }

    const m = document.getElementById('details-modal');
    const c = document.getElementById('details-modal-content');
    if (m && c) {
        window.undockDetailsContent && window.undockDetailsContent();
        m.classList.remove('hidden');
        void m.offsetWidth;
        m.classList.remove('opacity-0', 'pointer-events-none');
        c.classList.remove('scale-95');
    }
}

window.closeDetailsModal = function() {
    if (window.__dockView === 'details' && window.closeDockViewer) {
        window.closeDockViewer();
        return;
    }
    window.undockDetailsContent && window.undockDetailsContent();
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

window.downloadSound = async function(format) {
    const s = window.soundsData.find(x => x.id === window.currentPlayingId);
    if (!s) return;
    if (!s.url || s.url.length < 10 || s.url.startsWith('blob:')) {
        window.showToast('Файл недоступен для скачивания.');
        return;
    }
    const fileName = s.fileName || `${s.typeTag || 'sound'}_${s.id}.wav`;
    try {
        const res = await fetch(s.url);
        if (!res.ok) throw new Error('fetch_failed');
        const blob = await res.blob();
        const a = document.createElement('a');
        const objUrl = URL.createObjectURL(blob);
        a.href = objUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(objUrl), 2000);
        window.incrementDownloadCount(s.id);
    } catch (_) {
        window.open(s.url, '_blank');
        window.incrementDownloadCount(s.id);
    }
};

// Счётчик скачиваний / прослушиваний — лёгкий patchSound вместо полного rewrite map_data.
window.__pendingMetricPatches = window.__pendingMetricPatches || new Map();

window.applySoundSocialFields = function(partial) {
    if (!partial || !partial.id) return;
    const patch = {
        plays: partial.plays,
        downloads: partial.downloads,
        likedBy: partial.likedBy,
        dislikedBy: partial.dislikedBy
    };
    const applyTo = (arr) => {
        if (!Array.isArray(arr)) return;
        const idx = arr.findIndex((x) => x && x.id === partial.id);
        if (idx < 0) return;
        const next = { ...arr[idx] };
        if (patch.plays != null) next.plays = patch.plays;
        if (patch.downloads != null) next.downloads = patch.downloads;
        if (Array.isArray(patch.likedBy)) next.likedBy = patch.likedBy;
        if (Array.isArray(patch.dislikedBy)) next.dislikedBy = patch.dislikedBy;
        arr[idx] = next;
    };
    applyTo(window.soundsData);
    applyTo(window.cloudDataCache);
    if (window.fingerprintDataset && Array.isArray(window.cloudDataCache)) {
        window.__lastCloudPollKey = window.fingerprintDataset(window.cloudDataCache.filter((s) => s && !s.deleted));
    }
};

window.__flushCounterCloudSync = async function() {
    if (window.__counterSyncTimer) {
        clearTimeout(window.__counterSyncTimer);
        window.__counterSyncTimer = null;
    }
    window.__counterSyncDirty = false;
    if (!window.getAuthToken || !window.getAuthToken()) {
        window.__pendingMetricPatches.clear();
        return;
    }
    const entries = [...window.__pendingMetricPatches.entries()];
    window.__pendingMetricPatches.clear();
    if (!entries.length) return;

    for (const [soundId, ops] of entries) {
        const payload = {};
        if (ops.incPlays) payload.incPlays = ops.incPlays;
        if (ops.incDownloads) payload.incDownloads = ops.incDownloads;
        if (!payload.incPlays && !payload.incDownloads) continue;
        try {
            const res = await window.apiPatchSound(soundId, payload);
            if (res && res.sound) window.applySoundSocialFields(res.sound);
        } catch (err) {
            // Only fall back to full sync when the API build is too old (no patchSound).
            // Never escalate rate_limited → full sync (makes the storm worse).
            if (err && err.code === 'unknown_action') {
                if (Array.isArray(window.cloudDataCache)) {
                    await window.syncCloudData([...window.cloudDataCache]).catch(() => {});
                }
                return;
            }
            if (err && (err.code === 'rate_limited' || err.status === 429)) {
                // re-queue with longer backoff — don't storm the API
                const prev = window.__pendingMetricPatches.get(soundId) || {};
                window.__pendingMetricPatches.set(soundId, {
                    incPlays: (prev.incPlays || 0) + (payload.incPlays || 0),
                    incDownloads: (prev.incDownloads || 0) + (payload.incDownloads || 0)
                });
                window.__counterSyncDirty = true;
                if (!window.__counterSyncTimer) {
                    window.__counterSyncTimer = setTimeout(() => {
                        window.__counterSyncTimer = null;
                        window.__flushCounterCloudSync();
                    }, 15000);
                }
                return;
            }
            console.warn('patchSound metrics failed', err);
        }
    }
};

window.__queueCounterCloudSync = function() {
    window.__counterSyncDirty = true;
    if (window.__counterSyncTimer) return;
    window.__counterSyncTimer = setTimeout(() => {
        window.__counterSyncTimer = null;
        window.__flushCounterCloudSync();
    }, 2500);
};

window.incrementDownloadCount = function(id) {
    const s = window.soundsData.find(x => x.id === id);
    if (!s) return;
    s.downloads = (s.downloads || 0) + 1;
    const updatedCloud = [...(window.cloudDataCache || [])];
    const idx = updatedCloud.findIndex(x => x.id === id);
    if (idx >= 0) updatedCloud[idx] = { ...updatedCloud[idx], downloads: s.downloads };
    else updatedCloud.push({ ...s });
    window.cloudDataCache = updatedCloud;
    const prev = window.__pendingMetricPatches.get(id) || {};
    window.__pendingMetricPatches.set(id, { ...prev, incDownloads: (prev.incDownloads || 0) + 1 });
    window.__queueCounterCloudSync();
};

// Счётчик прослушиваний — дедуп по сессии браузера.
window.__playedSoundIds = window.__playedSoundIds || new Set();
window.trackSoundPlay = function(id) {
    if (window.__playedSoundIds.has(id)) return;
    window.__playedSoundIds.add(id);
    const s = window.soundsData.find(x => x.id === id);
    if (!s) return;
    s.plays = (s.plays || 0) + 1;
    const updatedCloud = [...(window.cloudDataCache || [])];
    const idx = updatedCloud.findIndex(x => x.id === id);
    if (idx >= 0) updatedCloud[idx] = { ...updatedCloud[idx], plays: s.plays };
    else updatedCloud.push({ ...s });
    window.cloudDataCache = updatedCloud;
    const prev = window.__pendingMetricPatches.get(id) || {};
    window.__pendingMetricPatches.set(id, { ...prev, incPlays: (prev.incPlays || 0) + 1 });
    window.__queueCounterCloudSync();
};

window.addEventListener('pagehide', () => {
    if (window.__counterSyncDirty && window.__flushCounterCloudSync) window.__flushCounterCloudSync();
});
window.addEventListener('visibilitychange', () => {
    if (document.hidden && window.__counterSyncDirty && window.__flushCounterCloudSync) {
        window.__flushCounterCloudSync();
    }
});

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

    const renderReply = r => {
        const reactedByMe = !!login && (r.reactedBy || []).includes(login);
        const reactionCount = (r.reactedBy || []).length;
        return `
        <div class="comment-reply swipe-reply-row" data-reply-id="${r.id}" data-reply-author="${esc(r.author)}" data-reply-author-id="${esc(r.authorId || '')}">
            <span class="swipe-reply-hint"><i class="fa-solid fa-reply"></i></span>
            <div class="flex justify-between items-start gap-2 mb-1">
                <span class="text-[12px]">${renderAuthor(r.author, r.authorId)}</span>
                <div class="flex items-center gap-1 shrink-0">
                    <span class="text-[9px] text-slate-400">${r.date}</span>
                    <button onclick="window.openReplyMenu('${sound.id}', '${r.id}', event)" class="comment-menu-btn" title="Действия">
                        <i class="fa-solid fa-ellipsis"></i>
                    </button>
                </div>
            </div>
            <p class="text-[12px] text-slate-600 dark:text-slate-300">${r.text}</p>
            <button onclick="window.toggleCommentReaction('${sound.id}', '${r.id}')" class="comment-reaction-btn ${reactedByMe ? 'active' : ''}">
                <i class="fa-solid fa-heart"></i>${reactionCount > 0 ? reactionCount : ''}
            </button>
        </div>`;
    };

    container.innerHTML = sound.comments.map(c => {
        const reactedByMe = !!login && (c.reactedBy || []).includes(login);
        const reactionCount = (c.reactedBy || []).length;
        return `
        <div class="bg-slate-100/60 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 swipe-reply-row" data-comment-id="${c.id}" data-comment-author="${esc(c.author)}" data-comment-author-id="${esc(c.authorId || '')}">
            <span class="swipe-reply-hint"><i class="fa-solid fa-reply"></i></span>
            <div class="flex justify-between items-start mb-1.5 gap-2">
                <span class="text-[13px]">${renderAuthor(c.author, c.authorId)}</span>
                <div class="flex items-center gap-1.5 shrink-0">
                    <span class="text-[10px] text-slate-400">${c.date}</span>
                    <button onclick="window.openCommentMenu('${sound.id}', '${c.id}', event)" class="comment-menu-btn" title="Действия">
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
    if (window.bindSwipeReplyRows) {
        window.bindSwipeReplyRows(container, (id, row) => {
            if (row.dataset.replyId) {
                const parent = (sound.comments || []).find(c => (c.replies || []).some(r => r.id === id));
                if (!parent) return;
                window.startReplyToComment(sound.id, id, row.dataset.replyAuthor || '', parent.id, row.dataset.replyAuthorId || null);
            } else {
                window.startReplyToComment(sound.id, id, row.dataset.commentAuthor || '', id, row.dataset.commentAuthorId || null);
            }
        });
    }
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
    if (!window.currentUser) {
        window.showToast('Войдите, чтобы оставить комментарий');
        if (window.openAuthModal) window.openAuthModal();
        return;
    }
    const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
    const guard = window.spamGuardCheck
        ? window.spamGuardCheck(`comment:${login}`, { minIntervalMs: 2500, maxPerWindow: 8, windowMs: 60000 })
        : { ok: true };
    if (!guard.ok) { window.spamGuardToast(guard); return; }

    const s = window.soundsData.find(x => x.id === window.currentPlayingId);
    if(s) {
        const now = new Date();
        const dateStr = now.toLocaleDateString(window.currentLang === 'ru' ? 'ru-RU' : 'en-US');
        const createdAt = now.toISOString();
        const authorName = window.currentUser.username;
        const authorId = login;
        const text = input.value.trim();
        if (text.length > 2000) { window.showToast('Комментарий слишком длинный'); return; }
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
                    reactedBy: [],
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
        if (authorId && window.logUserActivity) {
            window.logUserActivity({
                type: replyCtx ? 'reply' : 'comment',
                text: replyCtx
                    ? `Ответил в «${s.title}»: «${text}»`
                    : `Написал комментарий к «${s.title}»: «${text}»`,
                soundId: s.id,
                date: createdAt
            }, authorId);
        }
    }
}

// Меню «...» у комментария — профиль автора / ответить / реакция / пожаловаться.
window.openCommentMenu = function(soundId, commentId, ev) {
    const s = window.soundsData.find(x => x.id === soundId);
    if (!s) return;
    const c = (s.comments || []).find(x => x.id === commentId);
    if (!c) return;
    const login = window.currentUser ? (window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase()) : null;
    const isAdmin = !!window.currentUser && (String(window.currentUser.role || '').toLowerCase() === 'admin' || login === 'admin');
    const reacted = !!login && (c.reactedBy || []).includes(login);

    const items = [];
    if (c.authorId) items.push({ icon: 'fa-id-badge', label: 'Профиль автора', tone: 'primary', onClick: () => window.openPublicProfile(c.authorId, c.author) });
    items.push({ icon: 'fa-reply', label: 'Ответить', tone: 'primary', onClick: () => window.startReplyToComment(soundId, commentId, c.author, commentId, c.authorId) });
    items.push({ icon: 'fa-heart', label: reacted ? 'Убрать реакцию' : 'Поставить реакцию', onClick: () => window.toggleCommentReaction(soundId, commentId) });
    items.push({ icon: 'fa-flag', label: 'Пожаловаться', tone: 'warning', onClick: () => window.openReportModal('comment', soundId, commentId) });
    if (isAdmin) {
        items.push({ icon: 'fa-trash-can', label: 'Удалить', tone: 'danger', onClick: () => window.adminDeleteComment(soundId, commentId) });
        if (c.authorId && c.authorId !== 'admin') {
            items.push({
                icon: 'fa-user-slash',
                label: 'Удалить и заблокировать',
                tone: 'danger',
                onClick: async () => {
                    await window.adminDeleteComment(soundId, commentId);
                    if (window.setUserBlocked) window.setUserBlocked(c.authorId, true);
                }
            });
        }
    }
    if (window.openActionsMenu) window.openActionsMenu(items, { title: c.author || 'Комментарий', event: ev || (typeof event !== 'undefined' ? event : null) });
    else window.ActionSheet.open(items);
};

// Меню у вложенного ответа — чтобы можно было ответить тому, кто ответил вам.
window.openReplyMenu = function(soundId, replyId, ev) {
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
    if (reply.authorId) items.push({ icon: 'fa-id-badge', label: 'Профиль автора', tone: 'primary', onClick: () => window.openPublicProfile(reply.authorId, reply.author) });
    items.push({ icon: 'fa-reply', label: 'Ответить', tone: 'primary', onClick: () => window.startReplyToComment(soundId, replyId, reply.author, parent.id, reply.authorId) });
    items.push({ icon: 'fa-flag', label: 'Пожаловаться', tone: 'warning', onClick: () => window.openReportModal('comment', soundId, replyId) });
    items.push({
        icon: 'fa-heart',
        label: 'Реакция',
        tone: 'primary',
        onClick: () => window.toggleCommentReaction(soundId, replyId)
    });
    if (isAdmin) {
        items.push({
            icon: 'fa-trash-can', label: 'Удалить', tone: 'danger',
            onClick: async () => {
                parent.replies = (parent.replies || []).filter(r => r.id !== replyId);
                const updatedCloud = [...window.cloudDataCache];
                const idx = updatedCloud.findIndex(x => x.id === soundId);
                if (idx >= 0) updatedCloud[idx] = s; else updatedCloud.push(s);
                const ok = await window.syncCloudData(updatedCloud);
                if (ok) { window.showToast('Ответ удалён'); window.renderComments(s); }
            }
        });
        if (reply.authorId && reply.authorId !== 'admin') {
            items.push({
                icon: 'fa-user-slash', label: 'Удалить и заблокировать', tone: 'danger',
                onClick: async () => {
                    parent.replies = (parent.replies || []).filter(r => r.id !== replyId);
                    const updatedCloud = [...window.cloudDataCache];
                    const idx = updatedCloud.findIndex(x => x.id === soundId);
                    if (idx >= 0) updatedCloud[idx] = s; else updatedCloud.push(s);
                    await window.syncCloudData(updatedCloud);
                    window.renderComments(s);
                    if (window.setUserBlocked) window.setUserBlocked(reply.authorId, true);
                }
            });
        }
    }
    if (window.openActionsMenu) window.openActionsMenu(items, { title: reply.author || 'Ответ', event: ev || (typeof event !== 'undefined' ? event : null) });
    else window.ActionSheet.open(items);
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
    const guard = window.spamGuardCheck
        ? window.spamGuardCheck(`react:${window.currentUser.loginName || 'u'}`, { minIntervalMs: 400, maxPerWindow: 40, windowMs: 60000 })
        : { ok: true };
    if (!guard.ok) { window.spamGuardToast(guard); return; }

    const s = window.soundsData.find(x => x.id === soundId);
    if (!s) return;
    let c = (s.comments || []).find(x => x.id === commentId);
    let parent = null;
    if (!c) {
        for (const top of (s.comments || [])) {
            const reply = (top.replies || []).find(x => x.id === commentId);
            if (reply) { c = reply; parent = top; break; }
        }
    }
    if (!c) return;
    const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
    c.reactedBy = c.reactedBy || [];
    const idx = c.reactedBy.indexOf(login);
    const adding = idx < 0;
    if (idx >= 0) c.reactedBy.splice(idx, 1); else c.reactedBy.push(login);
    // Bump so LWW merge prefers this revision over stale CDN copies
    c.reactedAt = new Date().toISOString();
    c.updatedAt = c.reactedAt;
    if (parent) parent.updatedAt = c.reactedAt;
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
    if (adding && window.logUserActivity) {
        window.logUserActivity({
            type: 'reaction',
            text: `Поставил реакцию на комментарий к «${s.title}»`,
            soundId: s.id
        }, login);
    }
};

// Жалоба на метку или на конкретный комментарий — попадает в очередь модерации
// (Кабинет -> Админ-панель -> Жалобы, см. auth.js renderReportsList).
window.openReportModal = async function(type, soundId, commentId = null) {
    if (!window.currentUser) { window.showToast('Войдите, чтобы отправить жалобу'); if (window.openAuthModal) window.openAuthModal(); return; }
    if (!soundId) return;
    const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
    const guard = window.spamGuardCheck
        ? window.spamGuardCheck(`report:${login}`, { minIntervalMs: 5000, maxPerWindow: 5, windowMs: 60000 })
        : { ok: true };
    if (!guard.ok) { window.spamGuardToast(guard); return; }

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
        number: window.getNextReportNumber ? window.getNextReportNumber() : undefined,
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

    const reactionSet = adding;
    try {
        const res = await window.apiPatchSound(s.id, { reaction: kind, reactionSet });
        if (res && res.sound) {
            window.applySoundSocialFields(res.sound);
            const updated = window.soundsData.find(x => x.id === s.id) || s;
            window.renderDetailsReactions(updated);
        }
    } catch (err) {
        if (err && err.code === 'unknown_action') {
            const updatedCloud = [...window.cloudDataCache];
            const idx = updatedCloud.findIndex(x => x.id === s.id);
            if (idx >= 0) updatedCloud[idx] = s; else updatedCloud.push(s);
            await window.syncCloudData(updatedCloud);
        } else if (err && (err.code === 'rate_limited' || err.status === 429)) {
            const now = Date.now();
            if (!window.__lastRateLimitToast || now - window.__lastRateLimitToast > 8000) {
                window.__lastRateLimitToast = now;
                window.showToast('Слишком много запросов — подождите немного');
            }
        } else {
            console.warn('patchSound reaction failed', err);
            window.showToast('Не удалось сохранить оценку');
        }
    }

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
    if (adding && window.logUserActivity) {
        window.logUserActivity({
            type: kind === 'like' ? 'like' : 'dislike',
            text: kind === 'like' ? `Лайкнул запись «${s.title}»` : `Дизлайкнул запись «${s.title}»`,
            soundId: s.id
        }, login);
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
window.probeAudioDuration = function(src) {
    return new Promise((resolve, reject) => {
        if (!src) return reject(new Error('no src'));
        const a = new Audio();
        a.preload = 'metadata';
        const done = (fn, val) => {
            a.onloadedmetadata = null;
            a.onerror = null;
            try { a.src = ''; } catch (_) {}
            fn(val);
        };
        a.onloadedmetadata = () => {
            const secs = a.duration;
            if (!isFinite(secs) || secs <= 0) done(reject, new Error('bad duration'));
            else done(resolve, secs);
        };
        a.onerror = () => done(reject, new Error('audio error'));
        a.src = src;
    });
};

window.handleAudioFiles = function(files) {
    if(files && files.length > 0 && files[0].type.startsWith('audio/')) {
        const file = files[0];
        if (file.size > (window.MAX_AUDIO_UPLOAD_BYTES || 1024 * 1024 * 1024)) {
            window.showToast('Аудиофайл больше 1 ГБ');
            return;
        }
        window.currentUploadedFile = file;
        window.generateUCSFileName();
        if (window.currentUploadedFileUrl && String(window.currentUploadedFileUrl).startsWith('blob:')) {
            try { URL.revokeObjectURL(window.currentUploadedFileUrl); } catch (_) {}
        }
        window.currentUploadedFileUrl = URL.createObjectURL(file);
        window.__uploadedAudioDuration = '0:00';
        window.probeAudioDuration(window.currentUploadedFileUrl).then(secs => {
            window.__uploadedAudioDuration = window.formatTime ? window.formatTime(secs) : `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
        }).catch(() => { window.__uploadedAudioDuration = '0:00'; });
        document.getElementById('drop-zone-content').innerHTML = `<span class="text-sm font-bold text-blue-600">Готов к загрузке: ${file.name}</span>`;
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
    const name = window.collectUcsNameFromForm
        ? window.collectUcsNameFromForm()
        : 'AMBMisc_Untitled_Anon_ROSMAP.wav';
    const el = document.getElementById('add-file-name');
    if (el) el.value = name;
};

window.__fxNameManual = false;
window.__fxNameTranslateTimer = null;

window.markFxNameManual = function() {
    window.__fxNameManual = true;
    const el = document.getElementById('add-user-defined');
    if (el) el.dataset.auto = '0';
};

window.scheduleFxNameAutoTranslate = function() {
    if (window.__fxNameManual) return;
    clearTimeout(window.__fxNameTranslateTimer);
    window.__fxNameTranslateTimer = setTimeout(() => {
        window.translateFxNameFromDescription({ silent: true, onlyIfAuto: true });
    }, 600);
};

window.translateFxNameFromDescription = async function(opts = {}) {
    const descEl = document.getElementById('add-desc');
    const fxEl = document.getElementById('add-user-defined');
    if (!descEl || !fxEl) return;
    const desc = (descEl.value || '').trim();
    if (!desc) {
        if (!opts.silent) window.showToast('Сначала заполните описание');
        return;
    }
    if (opts.onlyIfAuto && (window.__fxNameManual || fxEl.dataset.auto === '0')) return;
    if (!window.currentUser) {
        if (!opts.silent) {
            window.showToast('Войдите, чтобы перевести');
            if (window.openAuthModal) window.openAuthModal();
        }
        return;
    }
    if (!window.apiTranslate) {
        if (!opts.silent) window.showToast('Перевод недоступен');
        return;
    }
    try {
        if (!opts.silent) window.showToast('Перевод…');
        const [en] = await window.apiTranslate(desc.slice(0, 500));
        const fx = window.sanitizeFxName ? window.sanitizeFxName(en) : String(en || '').slice(0, 40);
        if (!fx || fx === 'Untitled') {
            if (!opts.silent) window.showToast('Не удалось получить английское имя');
            return;
        }
        fxEl.value = fx;
        fxEl.dataset.auto = '1';
        window.__fxNameManual = false;
        window.generateUCSFileName();
        if (!opts.silent) window.showToast('FXName обновлён');
    } catch (err) {
        console.warn(err);
        if (!opts.silent) {
            const msg = err?.code === 'translate_unconfigured'
                ? 'Переводчик не настроен на сервере'
                : (err.message || 'Ошибка перевода');
            window.showToast(msg);
        }
    }
};
// Фото звука: локальный preview + File; в JSON уходит только https URL после upload.
window.handleImageFilesWrapper = function(files) {
    if (!files || !files.length) return;
    window.pendingImages = window.pendingImages || [];
    const remaining = Math.max(0, 3 - window.pendingImages.length);
    if (remaining === 0) { window.showToast('Можно прикрепить максимум 3 фото'); return; }

    const toProcess = Array.from(files).slice(0, remaining);
    toProcess.forEach(file => {
        if (!file.type || !file.type.startsWith('image/')) return;
        if (file.size > (window.MAX_IMAGE_UPLOAD_BYTES || 30 * 1024 * 1024)) {
            window.showToast('Фото больше 30 МБ — сожмите или выберите другое');
            return;
        }
        const preview = URL.createObjectURL(file);
        window.pendingImages.push({ preview, file });
    });
    window.renderPendingImagesPreview();
};

window.pendingImageSrc = function(item) {
    if (!item) return '';
    if (typeof item === 'string') return item;
    return item.preview || item.url || '';
};

window.renderPendingImagesPreview = function() {
    const container = document.getElementById('image-preview-container');
    if (!container) return;
    const images = window.pendingImages || [];
    if (!images.length) { container.innerHTML = ''; container.classList.add('hidden'); return; }
    container.classList.remove('hidden');
    container.innerHTML = images.map((item, i) => `
        <div class="relative">
            <img src="${window.pendingImageSrc(item)}" class="image-thumb">
            <button type="button" onclick="event.stopPropagation(); window.removePendingImage(${i})" class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] shadow-md">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `).join('');
};

window.removePendingImage = function(index) {
    if (!window.pendingImages) return;
    const item = window.pendingImages[index];
    if (item && item.preview && String(item.preview).startsWith('blob:')) {
        try { URL.revokeObjectURL(item.preview); } catch (_) {}
    }
    window.pendingImages.splice(index, 1);
    window.renderPendingImagesPreview();
};

window.resolvePendingImagesForPublish = async function(soundId) {
    const out = [];
    const items = window.pendingImages || [];
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (typeof item === 'string') {
            if (window.isHttpMediaUrl && window.isHttpMediaUrl(item)) {
                out.push(item);
            } else if (item.startsWith('data:') && window.uploadImageToStorage) {
                out.push(await window.uploadImageToStorage(item, `sound_${soundId}_${i}`));
            }
            continue;
        }
        if (item?.file && window.uploadImageToStorage) {
            out.push(await window.uploadImageToStorage(item.file, `sound_${soundId}_${i}`));
        } else if (item?.url && window.isHttpMediaUrl(item.url)) {
            out.push(item.url);
        }
    }
    return out.slice(0, 3);
};

// targetStatus: 'pending' (кнопка "Опубликовать") или 'draft' (кнопка "Черновик").
// Логика перехода статусов при редактировании — см. комментарий у поле status ниже.
window.publishSound = async function(targetStatus = 'pending') {
    if (!window.currentUser) { window.showToast('Войдите, чтобы опубликовать звук'); return; }
    const loginKey = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
    const guard = window.spamGuardCheck
        ? window.spamGuardCheck(`publish:${loginKey}`, { minIntervalMs: 4000, maxPerWindow: 6, windowMs: 120000 })
        : { ok: true };
    if (!guard.ok) { window.spamGuardToast(guard); return; }

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

    if (window.currentUploadedFileUrl && (!window.__uploadedAudioDuration || window.__uploadedAudioDuration === '0:00') && window.probeAudioDuration) {
        try {
            const secs = await window.probeAudioDuration(window.currentUploadedFileUrl);
            window.__uploadedAudioDuration = window.formatTime ? window.formatTime(secs) : `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
        } catch (_) {}
    }

    const soundId = existing ? existing.id : ('u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7));

    let audioUrl = existing?.url || '';
    let metaEmbedded = false;
    try {
        if (window.currentUploadedFile) {
            let file = window.currentUploadedFile;
            if (file.size > (window.MAX_AUDIO_UPLOAD_BYTES || 1024 * 1024 * 1024)) {
                throw Object.assign(new Error('Аудио больше 1 ГБ'), { code: 'file_too_large' });
            }

            const ucsName = val('add-file-name')
                || (window.collectUcsNameFromForm && window.collectUcsNameFromForm())
                || `audio_${soundId}.wav`;
            if (document.getElementById('add-file-name')) {
                document.getElementById('add-file-name').value = ucsName;
            }

            if (window.embedWavMetadata) {
                try {
                    window.showToast('Вшивание метаданных…');
                    const embedResult = await window.embedWavMetadata(file, {
                        soundId,
                        fxName: val('add-user-defined') || title,
                        title,
                        description: val('add-desc'),
                        originator: window.currentUser.username || login,
                        creatorId: login,
                        originatorReference: soundId,
                        catId: val('add-subcat'),
                        category: val('add-category'),
                        subCategory: val('add-subcat'),
                        sourceId: window.UCS_SOURCE_ID || 'ROSMAP',
                        location: val('add-loc'),
                        lat: coords?.[0],
                        lng: coords?.[1],
                        micType: val('add-mic'),
                        recorder: val('add-recorder'),
                        channels: val('add-channels'),
                        license: val('add-license'),
                        keywords: val('add-tags'),
                        ecoCategory: val('add-eco'),
                        note: val('add-desc'),
                        originationDate: (val('add-date') || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
                        originationTime: (val('add-time') || '00:00:00').slice(0, 8)
                    }, ucsName);
                    if (embedResult.embedded && embedResult.file) {
                        file = embedResult.file;
                        metaEmbedded = true;
                    } else if (embedResult.skipped === 'not_wav') {
                        window.showToast('Метаданные вшиваются только в WAV');
                    }
                } catch (metaErr) {
                    console.warn('WAV metadata embed failed', metaErr);
                }
            }

            window.showToast('Загрузка аудио в облако...');
            const ext = (String(ucsName || file.name || '').split('.').pop() || 'wav').replace(/[^a-z0-9]/gi, '') || 'wav';
            audioUrl = await window.uploadUserMedia(
                file,
                `audio_${soundId}.${ext}`,
                file.type || 'audio/wav'
            );
            window.currentUploadedFile = file;
        } else if (window.isForbiddenMediaUrl && window.isForbiddenMediaUrl(audioUrl)) {
            throw new Error('Выберите аудиофайл для загрузки в облако');
        } else if (!isEdit && !audioUrl) {
            throw new Error('Добавьте аудиофайл');
        }

        window.showToast('Загрузка фото...');
        const images = await window.resolvePendingImagesForPublish(soundId);

        const soundObj = {
            id: soundId,
            title,
            ecoCategory: val('add-eco') || 'anthrophony',
            ucsCat: val('add-category') || 'AMBIENCE',
            typeTag: val('add-subcat'),
            lat: coords[0], lng: coords[1],
            duration: (window.__uploadedAudioDuration && window.__uploadedAudioDuration !== '0:00')
                ? window.__uploadedAudioDuration
                : (existing?.duration || '0:00'),
            url: audioUrl,
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
            images,
            route: window.isSoundwalkPrinciple()
                ? ((window.addModalRoute && window.addModalRoute.length > 1) ? [...window.addModalRoute] : (existing?.route || undefined))
                : undefined,
            sessionId: val('add-session') || null,
            createdAt: existing?.createdAt || new Date().toISOString(),
            // Черновик → draft. Явная публикация / повторная отправка после reject → pending.
            // Уже published при правке метаданных остаётся published.
            status: (() => {
                if (targetStatus === 'draft') return 'draft';
                if (!isEdit) return 'pending';
                const prev = existing.status || 'published';
                if (prev === 'draft' || prev === 'rejected' || prev === 'pending') return 'pending';
                return prev;
            })(),
            downloads: existing?.downloads || 0,
            plays: existing?.plays || 0,
            likedBy: existing?.likedBy || [],
            dislikedBy: existing?.dislikedBy || [],
            reports: existing?.reports || [],
            rejectionReason: (() => {
                if (targetStatus === 'draft') return '';
                if (!isEdit) return '';
                const prev = existing.status || 'published';
                // Повторная отправка на модерацию — старую причину сбрасываем
                if (prev === 'draft' || prev === 'rejected' || prev === 'pending') return '';
                return existing?.rejectionReason || '';
            })(),
            seenByAuthor: true
        };

        const wasResubmit = isEdit && (existing.status === 'rejected' || existing.status === 'draft');
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
            const msg = soundObj.status === 'draft'
                ? 'Черновик сохранён!'
                : (wasResubmit
                    ? 'Отправлено на модерацию снова!'
                    : (isEdit
                        ? (soundObj.status === 'pending' ? 'Отправлено на модерацию!' : 'Изменения сохранены!')
                        : 'Звук отправлен на модерацию!'));
            window.showToast(msg);
            if (metaEmbedded) {
                const coordsLabel = `${Number(soundObj.lat).toFixed(5)}, ${Number(soundObj.lng).toFixed(5)}`;
                const metaMsg = (window.translations?.[window.currentLang || 'ru']?.meta_embedded
                    || 'Координаты {coords} успешно вшиты в метаданные файла.')
                    .replace('{coords}', coordsLabel);
                window.showToast(metaMsg);
            }
            if (!isEdit && soundObj.status !== 'draft' && window.logUserActivity) {
                window.logUserActivity({
                    type: 'sound_add',
                    text: `Добавил запись «${soundObj.title}»`,
                    soundId: soundObj.id,
                    date: soundObj.createdAt
                }, login);
            }
            if (soundObj.status === 'published' && window.notifyFollowersAboutNewSound) {
                window.notifyFollowersAboutNewSound(soundObj);
            }
            if (soundObj.status !== 'draft' && window.evaluateFieldProgress) {
                window.evaluateFieldProgress();
            }
            window.toggleAddModal(true);
        }
    } catch (err) {
        console.error(err);
        if (btn) btn.disabled = false;
        if (draftBtn) draftBtn.disabled = false;
        window.showToast(err.message || 'Не удалось сохранить запись');
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
    window.__fxNameManual = true;
    const fxEl = document.getElementById('add-user-defined');
    if (fxEl) fxEl.dataset.auto = '0';
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
    if (publishText) {
        publishText.textContent = (s.status === 'rejected' || s.status === 'draft')
            ? 'Отправить на модерацию'
            : 'Сохранить изменения';
    }

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
    window.__fxNameManual = false;
    const fxEl = document.getElementById('add-user-defined');
    if (fxEl) fxEl.dataset.auto = '1';
    if (window.generateUCSFileName) window.generateUCSFileName();
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

        if (window.playSfx) window.playSfx('open');
        window.updateUcsSubcats();
        return;
    }

    if (m && c) {
        m.classList.add('opacity-0', 'pointer-events-none');
        c.classList.add('scale-95');
        if (window.playSfx) window.playSfx('close');
        setTimeout(() => {
            if (m.classList.contains('opacity-0')) m.classList.add('hidden');
        }, 300);
    }
    window.resetAddModalToCreateMode();
}
window.closeAddModalSafely = async function() {
    if (window.isAddSoundDirty && window.isAddSoundDirty()) {
        const ok = await window.confirmDiscardDraft('Форма добавления / изменения звука не сохранена.');
        if (!ok) return;
    }
    window.toggleAddModal(true);
};
window.goBackFromAdd = function() {
    return window.closeAddModalSafely();
};

// UI System Callbacks
window.setMapStyle = function(style, skipSave = false) {
    const mapContainer = document.getElementById('map');
    window.currentMapStyle = style;
    if (mapContainer) {
        if (window.isMapLibreProvider && window.isMapLibreProvider(window.currentMapProvider)) {
            mapContainer.classList.remove('map-monochrome');
            if (window.applyMapboxBasemapConfig) window.applyMapboxBasemapConfig();
        } else if (style === 'monochrome') {
            mapContainer.classList.add('map-monochrome');
        } else {
            mapContainer.classList.remove('map-monochrome');
        }
    }
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
    window.currentLang = lang === 'en' ? 'en' : 'ru';
    if (window.applyUILanguage) window.applyUILanguage();
    if (window.renderList) window.renderList();
    if (window.renderFeed) window.renderFeed();
    if (window.renderSidebarExpeditions) window.renderSidebarExpeditions();
    if (window.refreshSettingsUI) window.refreshSettingsUI();
    const langSelect = document.getElementById('lang-select');
    if (langSelect) langSelect.value = window.currentLang;
    if (!window.__activeMessagePeer && document.getElementById('messages-modal') && !document.getElementById('messages-modal').classList.contains('hidden')) {
        if (window.showMessagesConversations) window.showMessagesConversations();
    } else if (window.__activeMessagePeer && window.openMessageThread) {
        window.openMessageThread(window.__activeMessagePeer, { quiet: true });
    }
    if (!skipSave) {
        try { localStorage.setItem('rosmap_lang', window.currentLang); } catch (_) {}
        if (window.saveUserSettings) window.saveUserSettings('lang', window.currentLang);
    }
};

window.t = function(key, fallback = '') {
    const dict = (window.translations && window.translations[window.currentLang || 'ru']) || {};
    if (dict[key] != null) return dict[key];
    const ru = (window.translations && window.translations.ru) || {};
    if (ru[key] != null) return ru[key];
    return fallback || key;
};

window.applyUILanguage = function() {
    const lang = window.currentLang || 'ru';
    document.documentElement.lang = lang === 'en' ? 'en' : 'ru';

    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.getAttribute('data-lang');
        const text = window.t(key);
        if (!text || text === key) return;
        if (el.tagName === 'OPTION') {
            el.textContent = text;
            return;
        }
        // Сохраняем иконки: обновляем текстовые узлы или весь текст, если детей нет
        const icon = el.querySelector(':scope > i.fa-solid, :scope > i.fa-regular, :scope > i.fa-brands');
        if (icon && el.children.length <= 2) {
            const span = el.querySelector(':scope > span:not([class*="fa"])');
            if (span && !span.querySelector('i')) {
                span.textContent = text;
            } else {
                let replaced = false;
                el.childNodes.forEach(node => {
                    if (node.nodeType === 3 && node.textContent.trim()) {
                        node.textContent = (node.textContent.match(/^\s*/) || [''])[0] + text;
                        replaced = true;
                    }
                });
                if (!replaced) {
                    const tn = document.createTextNode(' ' + text);
                    el.appendChild(tn);
                }
            }
        } else if (el.children.length === 0) {
            el.textContent = text;
        } else {
            const span = el.querySelector('[data-lang-text]') || el.querySelector('span:not(.fa-solid):not(.fa-regular)');
            if (span && span.children.length === 0) span.textContent = text;
            else {
                el.childNodes.forEach(node => {
                    if (node.nodeType === 3 && node.textContent.trim()) {
                        node.textContent = (node.textContent.match(/^\s*/) || [''])[0] + text;
                    }
                });
            }
        }
    });

    document.querySelectorAll('[data-lang-placeholder]').forEach(el => {
        const key = el.getAttribute('data-lang-placeholder');
        const text = window.t(key);
        if (text && text !== key) el.setAttribute('placeholder', text);
    });

    document.querySelectorAll('[data-lang-title]').forEach(el => {
        const key = el.getAttribute('data-lang-title');
        const text = window.t(key);
        if (text && text !== key) el.setAttribute('title', text);
    });

    // Кнопки тура
    const skip = document.querySelector('#onboarding-card button[onclick*="dismissOnboarding"]');
    if (skip) skip.textContent = window.t('tour_skip');
    const prev = document.getElementById('onboarding-prev');
    if (prev) prev.textContent = window.t('tour_back');
    if (typeof window.__onboardingStep === 'number' && document.getElementById('onboarding-overlay') && !document.getElementById('onboarding-overlay').classList.contains('hidden')) {
        window.updateOnboardingStep();
    }
    const questsPanel = document.getElementById('cab-panel-quests');
    if (questsPanel && !questsPanel.classList.contains('hidden') && window.renderQuestsPanel) {
        window.renderQuestsPanel();
    }
    if (window.updateMapProviderHint) window.updateMapProviderHint();
};
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
    const themeSwitch = document.getElementById('theme-glass-switch');
    if (themeSwitch) themeSwitch.setAttribute('aria-checked', theme === 'dark' ? 'true' : 'false');
    if (!skipSave && window.saveUserSettings) window.saveUserSettings('theme', theme);
    if (window.refreshSettingsUI) window.refreshSettingsUI();
    if (window.refreshAnalyzersTheme) window.refreshAnalyzersTheme();
    if (window.isMapLibreProvider && window.isMapLibreProvider(window.currentMapProvider) && window.applyMapboxBasemapConfig) {
        window.applyMapboxBasemapConfig();
    }
};

window.setColorPalette = function(palette, skipSave = false) {
    const next = ['coral', 'terre', 'sparrow'].includes(palette) ? palette : 'coral';
    window.currentPalette = next;
    document.documentElement.setAttribute('data-palette', next);
    try { localStorage.setItem('rosmap_palette', next); } catch (_) {}
    if (!skipSave && window.saveUserSettings) window.saveUserSettings('palette', next);
    if (window.refreshSettingsUI) window.refreshSettingsUI();
    if (window.refreshAnalyzersTheme) window.refreshAnalyzersTheme();
};
window.showDockPanel = function() {
    const s = document.getElementById('sidebar');
    if (!s) return;
    s.classList.remove('sidebar-hidden');
    s.classList.add('dock-expanded');
    s.classList.remove('dock-compact');
    document.body.classList.remove('dock-is-hidden');
    document.body.classList.add('dock-is-expanded');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (backdrop) backdrop.classList.toggle('visible', window.innerWidth < 768);
    const playerCard = document.getElementById('player-card');
    if (playerCard) playerCard.style.marginLeft = '';
};

window.hideDockPanel = function() {
    const s = document.getElementById('sidebar');
    if (!s) return;
    s.classList.add('sidebar-hidden');
    document.body.classList.add('dock-is-hidden');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (backdrop) backdrop.classList.remove('visible');
    const playerCard = document.getElementById('player-card');
    if (playerCard) playerCard.style.marginLeft = '';
    if (window.clearRailTabActive) window.clearRailTabActive();
};

window.initDockChrome = function() {
    const s = document.getElementById('sidebar');
    if (s) {
        s.classList.add('dock-expanded');
        s.classList.remove('dock-compact');
    }
    document.body.classList.add('dock-is-expanded');
    if (s && s.classList.contains('sidebar-hidden')) {
        document.body.classList.add('dock-is-hidden');
        if (window.clearRailTabActive) window.clearRailTabActive();
    } else {
        document.body.classList.remove('dock-is-hidden');
    }
    if (window.syncAccountChrome) window.syncAccountChrome();
    if (window.initSearchChrome) window.initSearchChrome();
};

window.toggleSidebar = function() {
    const s = document.getElementById('sidebar');
    if (!s) return;
    if (s.classList.contains('sidebar-hidden')) {
        // На мобильном бургер всегда открывает каталог, а не оставшийся кабинет/чат/настройки
        if (window.innerWidth < 768) {
            const view = window.__dockView;
            if (!['library', 'feed', 'expeditions', 'help'].includes(view)) {
                if (window.openDockView) {
                    window.openDockView(window.__sidebarTab || 'library');
                    return;
                }
            }
        }
        window.showDockPanel();
    } else {
        window.hideDockPanel();
    }
};

window.toggleSearchBar = function(forceOpen) {
    const cluster = document.getElementById('map-search-cluster');
    const toolbar = document.getElementById('map-top-toolbar');
    const toggle = document.getElementById('search-toggle-btn');
    const input = document.getElementById('search-input');
    if (!cluster || !input) return;
    const open = typeof forceOpen === 'boolean'
        ? forceOpen
        : !cluster.classList.contains('is-open');
    cluster.classList.toggle('is-open', open);
    if (toolbar) toolbar.classList.toggle('is-search-open', open);
    document.body.classList.toggle('search-is-open', open);
    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
        // Defer focus so width transition can start before caret appears
        requestAnimationFrame(() => {
            input.focus();
            if (window.updateSearchSuggestions) window.updateSearchSuggestions(input.value || '');
        });
    } else {
        input.blur();
        window.clearSearchSuggestions();
    }
};

window.clearSearchSuggestions = function() {
    const box = document.getElementById('search-suggestions');
    const input = document.getElementById('search-input');
    if (box) {
        box.classList.add('hidden');
        box.innerHTML = '';
    }
    if (input) input.setAttribute('aria-expanded', 'false');
    window.__searchSuggestionIndex = -1;
};

window.getSearchSuggestions = function(query) {
    const q = String(query || '').trim().toLowerCase();
    if (q.length < 1) return [];
    const out = [];
    const seen = new Set();
    const push = (item) => {
        const key = `${item.type}:${item.id}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push(item);
    };

    (window.soundsData || []).forEach(s => {
        if (out.length >= 14) return;
        if (window.isSoundStatusVisible && !window.isSoundStatusVisible(s)) return;
        const hay = `${s.title || ''} ${s.description || ''} ${s.keywords || ''} ${s.recordist || ''} ${s.ecoCategory || ''} ${s.typeTag || ''}`.toLowerCase();
        if (!hay.includes(q)) return;
        push({
            type: 'sound',
            id: s.id,
            label: s.title || 'Звук',
            meta: s.recordist || s.ecoCategory || 'Звук',
            icon: 'fa-music'
        });
    });

    (window.feedPosts || []).filter(p => !p.deleted).forEach(p => {
        if (out.length >= 14) return;
        const title = p.title || (p.type === 'article' ? 'Статья' : 'Объявление');
        const hay = `${title} ${p.body || ''} ${p.text || ''} ${p.excerpt || ''}`.toLowerCase();
        if (!hay.includes(q)) return;
        push({
            type: 'feed',
            id: p.id,
            label: title,
            meta: 'Лента',
            icon: 'fa-newspaper'
        });
    });

    const sessions = window.getAllSessions ? window.getAllSessions() : [];
    sessions.forEach(s => {
        if (out.length >= 14) return;
        const hay = `${s.title || ''} ${s.description || ''} ${s.location || ''} ${s.ownerName || ''}`.toLowerCase();
        if (!hay.includes(q)) return;
        push({
            type: 'expedition',
            id: s.id,
            label: s.title || 'Экспедиция',
            meta: s.ownerName || 'Экспедиция',
            icon: 'fa-route'
        });
    });

    (window.profilesData || []).forEach(p => {
        if (out.length >= 14) return;
        const name = p.displayName || p.loginName || '';
        if (!name || !name.toLowerCase().includes(q)) return;
        push({
            type: 'profile',
            id: p.loginName,
            label: name,
            meta: 'Профиль',
            icon: 'fa-user'
        });
    });

    return out.slice(0, 10);
};

window.updateSearchSuggestions = function(query) {
    const box = document.getElementById('search-suggestions');
    const input = document.getElementById('search-input');
    if (!box) return;
    if (window.syncSearchClearBtn) window.syncSearchClearBtn();
    const q = String(query || '').trim();
    const items = window.getSearchSuggestions(query);
    window.__searchSuggestionIndex = -1;
    window.__searchSuggestions = items;
    if (!q.length) {
        box.classList.add('hidden');
        box.innerHTML = '';
        if (input) input.setAttribute('aria-expanded', 'false');
        return;
    }
    if (!items.length) {
        box.innerHTML = `<div class="search-suggestion search-suggestion--empty" role="option" aria-disabled="true">
            <span class="search-suggestion__icon"><i class="fa-solid fa-magnifying-glass"></i></span>
            <span class="min-w-0">
                <div class="search-suggestion__label">Ничего не найдено</div>
                <div class="search-suggestion__meta">Попробуйте другое слово или сбросьте фильтры</div>
            </span>
        </div>`;
        box.classList.remove('hidden');
        if (input) input.setAttribute('aria-expanded', 'true');
        return;
    }
    const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    box.innerHTML = items.map((item, i) => `
        <button type="button" role="option" class="search-suggestion" data-index="${i}" data-type="${esc(item.type)}" data-id="${esc(item.id)}">
            <span class="search-suggestion__icon"><i class="fa-solid ${item.icon}"></i></span>
            <span class="min-w-0">
                <div class="search-suggestion__label">${esc(item.label)}</div>
                <div class="search-suggestion__meta">${esc(item.meta)}</div>
            </span>
        </button>
    `).join('');
    box.classList.remove('hidden');
    if (input) input.setAttribute('aria-expanded', 'true');
};

window.syncSearchClearBtn = function() {
    const input = document.getElementById('search-input');
    const btn = document.getElementById('search-clear-btn');
    if (!btn) return;
    const hasValue = !!(input && input.value.trim());
    btn.classList.toggle('hidden', !hasValue);
};

window.applySearchSuggestion = function(type, id) {
    window.clearSearchSuggestions();
    if (type === 'sound') {
        const sound = (window.soundsData || []).find((s) => s.id === id);
        const input = document.getElementById('search-input');
        if (input && sound?.title) {
            input.value = sound.title;
            if (window.syncSearchClearBtn) window.syncSearchClearBtn();
            if (window.processFilterChange) window.processFilterChange(false);
        }
        if (window.selectSound) window.selectSound(id);
        if (window.openDockView) window.openDockView('library');
    } else if (type === 'feed') {
        if (window.switchSidebarTab) window.switchSidebarTab('feed');
        setTimeout(() => {
            const el = document.querySelector(`[data-feed-id="${id}"]`) || document.getElementById(`feed-post-${id}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 80);
    } else if (type === 'expedition') {
        if (window.setSidebarSessionFilter) window.setSidebarSessionFilter(id);
        if (window.switchSidebarTab) window.switchSidebarTab('expeditions');
    } else if (type === 'profile') {
        const profile = (window.profilesData || []).find(p => p.loginName === id);
        if (window.openPublicProfile) window.openPublicProfile(id, profile?.displayName || id);
    }
};

window.initSearchChrome = function() {
    if (window.__searchChromeBound) return;
    window.__searchChromeBound = true;
    const input = document.getElementById('search-input');
    const box = document.getElementById('search-suggestions');
    if (box) {
        box.addEventListener('click', (e) => {
            const btn = e.target.closest('.search-suggestion:not(.search-suggestion--empty)');
            if (!btn) return;
            e.preventDefault();
            window.applySearchSuggestion(btn.dataset.type, btn.dataset.id);
        });
    }
    if (!input) return;

    input.addEventListener('input', () => {
        if (window.syncSearchClearBtn) window.syncSearchClearBtn();
        if (window.renderActiveTags) window.renderActiveTags();
    });

    input.addEventListener('keydown', (e) => {
        const suggBox = document.getElementById('search-suggestions');
        const items = window.__searchSuggestions || [];
        if (e.key === 'Escape') {
            if (suggBox && !suggBox.classList.contains('hidden')) {
                window.clearSearchSuggestions();
                e.preventDefault();
            } else {
                window.toggleSearchBar(false);
            }
            return;
        }
        if (!items.length || !suggBox || suggBox.classList.contains('hidden')) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const delta = e.key === 'ArrowDown' ? 1 : -1;
            const next = Math.max(0, Math.min(items.length - 1, (window.__searchSuggestionIndex ?? -1) + delta));
            window.__searchSuggestionIndex = next;
            suggBox.querySelectorAll('.search-suggestion').forEach((el, i) => el.classList.toggle('is-active', i === next));
            return;
        }
        if (e.key === 'Enter' && window.__searchSuggestionIndex >= 0) {
            const item = items[window.__searchSuggestionIndex];
            if (item) {
                e.preventDefault();
                window.applySearchSuggestion(item.type, item.id);
            }
        }
    });

    document.addEventListener('click', (e) => {
        const cluster = document.getElementById('map-search-cluster');
        if (cluster && !cluster.contains(e.target)) {
            window.clearSearchSuggestions();
            const input = document.getElementById('search-input');
            // Не закрываем строку, пока в ней есть запрос — иначе теряется контекст на мобиле.
            if (cluster.classList.contains('is-open') && !(input && input.value.trim())) {
                window.toggleSearchBar(false);
            }
        }
    });
};

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