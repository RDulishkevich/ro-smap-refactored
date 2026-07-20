/**
 * Events panel – contests / meetups / challenges on the right chrome.
 * Persists to events.json via syncEventsData.
 */

window.__eventsFilter = window.__eventsFilter || 'live';
window.__eventsDetailId = null;
window.__editingEventId = null;
window.__eventEditorPrizes = [];
window.__eventEditorConditions = [];
window.__eventCoverImage = null;

window.EVENT_STATUS_LABELS = {
    draft: 'Черновик',
    scheduled: 'Скоро',
    live: 'Идёт',
    judging: 'Жюри',
    ended: 'Завершён',
    archived: 'Архив'
};

window.EVENT_TYPE_LABELS = {
    contest: 'Конкурс',
    meetup: 'Встреча',
    challenge: 'Челлендж',
    announcement: 'Анонс'
};

window.getActiveEvents = function() {
    return (window.eventsData || []).filter((e) => e && !e.deleted);
};

window.normalizeEventStatus = function(e) {
    if (!e) return 'draft';
    if (e.status && e.status !== 'scheduled' && e.status !== 'live') return e.status;
    const now = Date.now();
    const start = e.startsAt ? new Date(e.startsAt).getTime() : 0;
    const end = e.endsAt ? new Date(e.endsAt).getTime() : 0;
    if (e.status === 'ended' || e.status === 'archived' || e.status === 'judging' || e.status === 'draft') return e.status;
    if (end && now > end) return 'ended';
    if (start && now < start) return 'scheduled';
    if ((start && now >= start) || e.status === 'live') return 'live';
    return e.status || 'scheduled';
};

window.filterEventsList = function(filter) {
    const all = window.getActiveEvents();
    const withStatus = all.map((e) => ({ ...e, _status: window.normalizeEventStatus(e) }));
    if (filter === 'upcoming') return withStatus.filter((e) => e._status === 'scheduled' || e._status === 'draft').sort((a, b) => new Date(a.startsAt || 0) - new Date(b.startsAt || 0));
    if (filter === 'ended') return withStatus.filter((e) => e._status === 'ended' || e._status === 'archived' || e._status === 'judging');
    // live (+ pinned first)
    return withStatus
        .filter((e) => e._status === 'live' || e.pinned)
        .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(a.endsAt || 0) - new Date(b.endsAt || 0));
};

window.formatEventRange = function(e) {
    const fmt = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d)) return '';
        return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    };
    const a = fmt(e.startsAt);
    const b = fmt(e.endsAt);
    if (a && b) return `${a} – ${b}`;
    return a || b || 'Даты уточняются';
};

window.openEventsPanel = function() {
    if (window.innerWidth < 768) {
        window.openEventsSheet();
        return;
    }
    const panel = document.getElementById('events-panel');
    if (!panel) return;
    panel.classList.remove('hidden');
    document.body.classList.add('events-panel-open');
    const fab = document.getElementById('events-fab');
    if (fab) fab.setAttribute('aria-expanded', 'true');
    window.renderEventsPanel();
};

window.closeEventsPanel = function() {
    const panel = document.getElementById('events-panel');
    if (panel) panel.classList.add('hidden');
    document.body.classList.remove('events-panel-open');
    const fab = document.getElementById('events-fab');
    if (fab) fab.setAttribute('aria-expanded', 'false');
    window.__eventsDetailId = null;
};

window.toggleEventsPanel = function() {
    const panel = document.getElementById('events-panel');
    if (!panel) return;
    if (panel.classList.contains('hidden')) window.openEventsPanel();
    else window.closeEventsPanel();
};

window.openEventsSheet = function() {
    const sheet = document.getElementById('events-sheet');
    if (!sheet) return;
    sheet.classList.remove('hidden');
    void sheet.offsetWidth;
    sheet.classList.remove('opacity-0', 'pointer-events-none');
    document.body.classList.add('events-open');
    window.renderEventsPanel();
};

window.closeEventsSheet = function() {
    const sheet = document.getElementById('events-sheet');
    if (!sheet) return;
    sheet.classList.add('opacity-0', 'pointer-events-none');
    document.body.classList.remove('events-open');
    setTimeout(() => { if (sheet.classList.contains('opacity-0')) sheet.classList.add('hidden'); }, 250);
    window.__eventsDetailId = null;
};

window.setEventsFilter = function(filter) {
    window.__eventsFilter = filter || 'live';
    window.__eventsDetailId = null;
    window.renderEventsPanel();
};

window.renderEventsPanel = function() {
    const hosts = [
        document.getElementById('events-panel-body'),
        document.getElementById('events-sheet-body')
    ].filter(Boolean);
    if (!hosts.length) return;

    const isAdmin = window.isCurrentUserAdmin && window.isCurrentUserAdmin();
    const filter = window.__eventsFilter || 'live';
    const list = window.filterEventsList(filter);
    const detailId = window.__eventsDetailId;
    const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const tabs = ['live', 'upcoming', 'ended'].map((key) => {
        const labels = { live: 'Сейчас', upcoming: 'Скоро', ended: 'Прошедшие' };
        return `<button type="button" class="events-tab ${filter === key ? 'is-active' : ''}" onclick="window.setEventsFilter('${key}')">${labels[key]}</button>`;
    }).join('');

    let bodyHtml = '';
    if (detailId) {
        const e = window.getActiveEvents().find((x) => x.id === detailId);
        bodyHtml = e ? window.renderEventDetail(e) : '<p class="text-xs text-slate-400 p-3">Ивент не найден</p>';
    } else {
        const cards = list.length
            ? list.map((e) => {
                const st = e._status || window.normalizeEventStatus(e);
                const going = (e.participants || []).filter((p) => p.status === 'going').length;
                return `
                <button type="button" class="event-card" onclick="window.openEventDetail('${esc(e.id)}')">
                    ${e.pinned ? '<span class="event-card__pin"><i class="fa-solid fa-thumbtack"></i></span>' : ''}
                    <div class="event-card__top">
                        <span class="event-pill event-pill--${st}">${window.EVENT_STATUS_LABELS[st] || st}</span>
                        <span class="event-card__type">${window.EVENT_TYPE_LABELS[e.type] || e.type || ''}</span>
                    </div>
                    <p class="event-card__title">${esc(e.title || 'Без названия')}</p>
                    ${e.theme ? `<p class="event-card__theme">${esc(e.theme)}</p>` : ''}
                    <p class="event-card__meta"><i class="fa-regular fa-calendar"></i> ${esc(window.formatEventRange(e))}</p>
                    <p class="event-card__meta"><i class="fa-solid fa-users"></i> ${going} участников</p>
                </button>`;
            }).join('')
            : `<div class="events-empty"><i class="fa-solid fa-calendar-days"></i><p>Пока нет ивентов</p><p class="text-[11px] opacity-70">Админ может создать конкурс, встречу или челлендж</p></div>`;

        bodyHtml = `
            <div class="events-tabs">${tabs}</div>
            ${isAdmin ? `<button type="button" class="events-create-btn" onclick="window.openEventEditor()"><i class="fa-solid fa-plus"></i> Создать ивент</button>` : ''}
            <div class="events-list">${cards}</div>`;
    }

    hosts.forEach((host) => { host.innerHTML = bodyHtml; });

    const badge = document.getElementById('events-rail-badge');
    const badgeMobile = document.getElementById('events-btn-mobile-badge');
    const liveCount = window.filterEventsList('live').length;
    [badge, badgeMobile].forEach((el) => {
        if (!el) return;
        el.textContent = String(liveCount);
        el.classList.toggle('hidden', liveCount === 0);
    });
};

window.openEventDetail = function(id) {
    window.__eventsDetailId = id;
    window.renderEventsPanel();
};

window.backToEventsList = function() {
    window.__eventsDetailId = null;
    window.renderEventsPanel();
};

window.renderEventDetail = function(e) {
    const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const st = window.normalizeEventStatus(e);
    const isAdmin = window.isCurrentUserAdmin && window.isCurrentUserAdmin();
    const login = window.currentUser
        ? (window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase())
        : null;
    const mine = (e.participants || []).find((p) => p.login === login);
    const going = (e.participants || []).filter((p) => p.status === 'going');

    const conditions = (e.conditions || []).length
        ? `<ul class="event-detail__list">${e.conditions.map((c) => `<li>${esc(c.label || c.kind)}${c.value ? `: ${esc(c.value)}` : ''}</li>`).join('')}</ul>`
        : '<p class="text-[11px] text-slate-400">Без особых условий</p>';

    const prizes = (e.prizes || []).length
        ? `<ul class="event-detail__list">${e.prizes.map((p) => {
            const bits = [];
            if (Number(p.xp) > 0) bits.push(`+${Number(p.xp)} XP`);
            if (p.achievementId) {
                const achTitle = window.getAchievementTitle
                    ? window.getAchievementTitle(p.achievementId)
                    : p.achievementId;
                bits.push(achTitle);
            }
            const reward = bits.length ? ` <span class="event-prize-reward">(${esc(bits.join(' · '))})</span>` : '';
            return `<li><strong>${esc(p.place || '')}.</strong> ${esc(p.title || '')}${p.description ? ` – ${esc(p.description)}` : ''}${reward}</li>`;
        }).join('')}</ul>`
        : '';

    const winners = (e.winners || []).length
        ? `<div class="event-detail__block"><h5>Победители</h5><ul class="event-detail__list">${e.winners.map((w) => {
            const bits = [];
            if (Number(w.xpGranted) > 0) bits.push(`+${Number(w.xpGranted)} XP`);
            if (w.achievementId) bits.push(window.getAchievementTitle ? window.getAchievementTitle(w.achievementId) : w.achievementId);
            return `<li>#${esc(w.place)} · ${esc(w.login)}${w.prizeTitle ? ` · ${esc(w.prizeTitle)}` : ''}${bits.length ? ` · ${esc(bits.join(' · '))}` : ''}</li>`;
        }).join('')}</ul></div>`
        : '';

    let rsvpHtml = '';
    if (!login) {
        rsvpHtml = `<button type="button" class="event-rsvp-btn" onclick="window.openAuthModal && window.openAuthModal()">Войти, чтобы участвовать</button>`;
    } else if (st === 'ended' || st === 'archived') {
        rsvpHtml = `<p class="text-[11px] text-slate-400">Ивент завершён</p>`;
    } else {
        const soundSelect = e.requireSound
            ? (() => {
                const sounds = window.getUserSounds
                    ? window.getUserSounds(login, window.currentUser.username, { includeAllStatuses: false })
                    : [];
                const opts = sounds.filter((s) => !s.status || s.status === 'published')
                    .map((s) => `<option value="${esc(s.id)}" ${mine?.soundId === s.id ? 'selected' : ''}>${esc(s.title)}</option>`)
                    .join('');
                return `<select id="event-rsvp-sound" class="modal-input text-xs mt-2"><option value="">Выберите запись</option>${opts}</select>`;
            })()
            : '';
        rsvpHtml = `
            <div class="event-rsvp">
                <div class="event-rsvp__row">
                    <button type="button" class="event-rsvp-btn ${mine?.status === 'going' ? 'is-active' : ''}" onclick="window.rsvpEvent('${e.id}', 'going')">Иду</button>
                    <button type="button" class="event-rsvp-btn event-rsvp-btn--ghost ${mine?.status === 'maybe' ? 'is-active' : ''}" onclick="window.rsvpEvent('${e.id}', 'maybe')">Возможно</button>
                    <button type="button" class="event-rsvp-btn event-rsvp-btn--ghost ${mine?.status === 'declined' ? 'is-active' : ''}" onclick="window.rsvpEvent('${e.id}', 'declined')">Нет</button>
                </div>
                ${soundSelect}
                ${e.requireSound ? `<button type="button" class="event-rsvp-btn mt-2" onclick="window.submitEventSound('${e.id}')">Прикрепить запись</button>` : ''}
            </div>`;
    }

    const adminBar = isAdmin
        ? `<div class="event-admin-bar">
            <button type="button" onclick="window.openEventEditor('${e.id}')"><i class="fa-solid fa-pen"></i></button>
            <button type="button" onclick="window.toggleEventPin('${e.id}')"><i class="fa-solid fa-thumbtack"></i></button>
            <button type="button" onclick="window.setEventStatus('${e.id}', 'live')">Live</button>
            <button type="button" onclick="window.setEventStatus('${e.id}', 'ended')">End</button>
            <button type="button" onclick="window.deleteEvent('${e.id}')" class="text-red-500"><i class="fa-solid fa-trash"></i></button>
           </div>`
        : '';

    return `
        <button type="button" class="events-back" onclick="window.backToEventsList()"><i class="fa-solid fa-arrow-left"></i> К списку</button>
        ${e.coverImage ? `<div class="event-detail__cover"><img src="${esc(e.coverImage)}" alt=""></div>` : ''}
        <div class="event-detail">
            <div class="event-card__top mb-2">
                <span class="event-pill event-pill--${st}">${window.EVENT_STATUS_LABELS[st] || st}</span>
                <span class="event-card__type">${window.EVENT_TYPE_LABELS[e.type] || ''}</span>
            </div>
            <h3 class="event-detail__title">${esc(e.title)}</h3>
            ${e.theme ? `<p class="event-card__theme">${esc(e.theme)}</p>` : ''}
            <p class="event-card__meta mt-2"><i class="fa-regular fa-calendar"></i> ${esc(window.formatEventRange(e))}</p>
            ${e.place?.label ? `<p class="event-card__meta"><i class="fa-solid fa-location-dot"></i> ${esc(e.place.label)}</p>` : ''}
            ${e.description ? `<p class="event-detail__desc">${esc(e.description)}</p>` : ''}
            <div class="event-detail__block"><h5>Условия</h5>${conditions}</div>
            ${prizes ? `<div class="event-detail__block"><h5>Призы</h5>${prizes}</div>` : ''}
            ${winners}
            <div class="event-detail__block"><h5>Участники (${going.length})</h5>
                <p class="text-[11px] text-slate-500">${going.slice(0, 12).map((p) => esc(p.name || p.login)).join(', ') || 'Пока никого'}</p>
            </div>
            ${rsvpHtml}
            ${adminBar}
        </div>`;
};

window.checkEventConditions = function(event, sound) {
    const issues = [];
    (event.conditions || []).forEach((c) => {
        if (c.kind === 'ecoCategory' && sound && c.value && sound.ecoCategory !== c.value) {
            issues.push(`Нужна категория ${c.value}`);
        }
        if (c.kind === 'minDuration' && sound) {
            const need = Number(c.value) || 0;
            const got = window.parseDuration ? window.parseDuration(sound.duration) : 0;
            if (got < need) issues.push(`Длительность от ${need} с`);
        }
        if (c.kind === 'hasSound' && !sound) issues.push('Нужна запись');
        if (c.kind === 'deadline' && c.value && Date.now() > new Date(c.value).getTime()) {
            issues.push('Дедлайн прошёл');
        }
    });
    return issues;
};

window.rsvpEvent = async function(eventId, status) {
    if (!window.currentUser) { if (window.openAuthModal) window.openAuthModal(); return; }
    const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
    const guard = window.spamGuardCheck
        ? window.spamGuardCheck(`event-rsvp:${login}`, { minIntervalMs: 800, maxPerWindow: 20, windowMs: 60000 })
        : { ok: true };
    if (!guard.ok) { window.spamGuardToast(guard); return; }

    const now = new Date().toISOString();
    const next = (window.eventsData || []).map((e) => {
        if (e.id !== eventId || e.deleted) return e;
        const participants = [...(e.participants || [])];
        const idx = participants.findIndex((p) => p.login === login);
        const row = {
            login,
            name: window.currentUser.username || login,
            status,
            soundId: idx >= 0 ? participants[idx].soundId : undefined,
            note: idx >= 0 ? participants[idx].note : undefined,
            joinedAt: idx >= 0 ? participants[idx].joinedAt : now,
            updatedAt: now,
            eligible: idx >= 0 ? participants[idx].eligible : true
        };
        if (idx >= 0) participants[idx] = row; else participants.push(row);
        return { ...e, participants, updatedAt: now };
    });
    const ok = await window.syncEventsData(next);
    if (ok) {
        window.showToast(status === 'going' ? 'Вы участвуете' : 'Статус обновлён');
        if (status === 'going' && window.notifyAdmins) {
            const ev = next.find((x) => x.id === eventId);
            window.notifyAdmins({
                type: 'event',
                text: `${window.currentUser.username} → ${ev?.title || eventId} (${status})`,
                fromId: login,
                fromName: window.currentUser.username
            });
        }
        window.__eventsDetailId = eventId;
        window.renderEventsPanel();
    }
};

window.submitEventSound = async function(eventId) {
    if (!window.currentUser) return;
    const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
    const sel = document.getElementById('event-rsvp-sound');
    const soundId = sel?.value || '';
    if (!soundId) { window.showToast('Выберите запись'); return; }
    const sound = (window.soundsData || []).find((s) => s.id === soundId);
    const event = window.getActiveEvents().find((e) => e.id === eventId);
    if (!event) return;
    const issues = window.checkEventConditions(event, sound);
    const now = new Date().toISOString();
    const next = (window.eventsData || []).map((e) => {
        if (e.id !== eventId || e.deleted) return e;
        const participants = [...(e.participants || [])];
        const idx = participants.findIndex((p) => p.login === login);
        const row = {
            login,
            name: window.currentUser.username || login,
            status: 'going',
            soundId,
            joinedAt: idx >= 0 ? participants[idx].joinedAt : now,
            updatedAt: now,
            eligible: issues.length === 0,
            needsReview: issues.length > 0,
            reviewNote: issues.join('; ') || undefined
        };
        if (idx >= 0) participants[idx] = { ...participants[idx], ...row };
        else participants.push(row);
        return { ...e, participants, updatedAt: now };
    });
    const ok = await window.syncEventsData(next);
    if (ok) {
        window.showToast(issues.length ? `Подано на проверку: ${issues[0]}` : 'Запись прикреплена');
        window.__eventsDetailId = eventId;
        window.renderEventsPanel();
    }
};

window.toggleEventPin = async function(eventId) {
    if (!window.isCurrentUserAdmin || !window.isCurrentUserAdmin()) return;
    const next = (window.eventsData || []).map((e) => {
        if (e.id !== eventId) return e;
        return { ...e, pinned: !e.pinned, updatedAt: new Date().toISOString() };
    });
    await window.syncEventsData(next);
    window.__eventsDetailId = eventId;
};

window.setEventStatus = async function(eventId, status) {
    if (!window.isCurrentUserAdmin || !window.isCurrentUserAdmin()) return;
    const next = (window.eventsData || []).map((e) => {
        if (e.id !== eventId) return e;
        return { ...e, status, updatedAt: new Date().toISOString() };
    });
    await window.syncEventsData(next);
    window.__eventsDetailId = eventId;
    window.renderEventsPanel();
};

window.deleteEvent = async function(eventId) {
    if (!window.isCurrentUserAdmin || !window.isCurrentUserAdmin()) return;
    const ok = await window.CustomUI.open({
        title: 'Удалить ивент?',
        message: 'Ивент исчезнет из панели для всех.',
        confirmText: 'Удалить',
        confirmClass: 'px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl'
    });
    if (!ok) return;
    const next = (window.eventsData || []).map((e) => e.id === eventId ? { ...e, deleted: true, updatedAt: new Date().toISOString() } : e);
    await window.syncEventsData(next);
    window.__eventsDetailId = null;
    window.renderEventsPanel();
};

/* –– Editor –– */
window.openEventEditor = function(eventId = null) {
    if (!window.isCurrentUserAdmin || !window.isCurrentUserAdmin()) {
        window.showToast('Только администратор');
        return;
    }
    window.__editingEventId = eventId;
    const e = eventId ? window.getActiveEvents().find((x) => x.id === eventId) : null;
    window.__eventEditorPrizes = e?.prizes
        ? e.prizes.map((p) => ({
            place: p.place || '',
            title: p.title || '',
            description: p.description || '',
            xp: Number(p.xp) || 0,
            achievementId: p.achievementId || ''
        }))
        : [{ place: '1', title: '', description: '', xp: 0, achievementId: '' }];
    window.__eventEditorConditions = e?.conditions ? e.conditions.map((c) => ({ ...c })) : [];
    window.__eventCoverImage = e?.coverImage || null;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    set('event-edit-title', e?.title || '');
    set('event-edit-theme', e?.theme || '');
    set('event-edit-description', e?.description || '');
    set('event-edit-type', e?.type || 'contest');
    set('event-edit-status', e?.status || 'scheduled');
    set('event-edit-starts', e?.startsAt ? e.startsAt.slice(0, 16) : '');
    set('event-edit-ends', e?.endsAt ? e.endsAt.slice(0, 16) : '');
    set('event-edit-place', e?.place?.label || '');
    set('event-edit-capacity', e?.capacity != null ? String(e.capacity) : '');
    const req = document.getElementById('event-edit-require-sound');
    if (req) req.checked = !!e?.requireSound;
    const pin = document.getElementById('event-edit-pinned');
    if (pin) pin.checked = !!e?.pinned;

    window.renderEventEditorLists();
    window.renderEventCoverPreview();
    window.renderEventParticipantsEditor(e);

    const header = document.getElementById('event-editor-title');
    if (header) header.textContent = e ? 'Редактировать ивент' : 'Новый ивент';

    const m = document.getElementById('event-editor-modal');
    const c = document.getElementById('event-editor-modal-content');
    if (!m || !c) return;
    m.classList.remove('hidden');
    void m.offsetWidth;
    m.classList.remove('opacity-0', 'pointer-events-none');
    c.classList.remove('scale-95');
    window.captureEventEditorSnapshot();
};

window.serializeEventEditorState = function() {
    const val = (id) => document.getElementById(id)?.value ?? '';
    const checked = (id) => !!document.getElementById(id)?.checked;
    return JSON.stringify({
        id: window.__editingEventId || null,
        title: val('event-edit-title'),
        theme: val('event-edit-theme'),
        description: val('event-edit-description'),
        type: val('event-edit-type'),
        status: val('event-edit-status'),
        starts: val('event-edit-starts'),
        ends: val('event-edit-ends'),
        place: val('event-edit-place'),
        capacity: val('event-edit-capacity'),
        requireSound: checked('event-edit-require-sound'),
        pinned: checked('event-edit-pinned'),
        cover: window.__eventCoverImage || null,
        prizes: window.__eventEditorPrizes || [],
        conditions: window.__eventEditorConditions || []
    });
};

window.captureEventEditorSnapshot = function() {
    window.__eventEditorSnapshot = window.serializeEventEditorState();
};

window.isEventEditorDirty = function() {
    if (!window.__eventEditorSnapshot) {
        const title = (document.getElementById('event-edit-title')?.value || '').trim();
        const desc = (document.getElementById('event-edit-description')?.value || '').trim();
        return !!(title || desc || window.__editingEventId);
    }
    return window.serializeEventEditorState() !== window.__eventEditorSnapshot;
};

window.closeEventEditor = function() {
    const m = document.getElementById('event-editor-modal');
    const c = document.getElementById('event-editor-modal-content');
    if (!m || !c) return;
    m.classList.add('opacity-0', 'pointer-events-none');
    c.classList.add('scale-95');
    setTimeout(() => { if (m.classList.contains('opacity-0')) m.classList.add('hidden'); }, 280);
    window.__editingEventId = null;
    window.__eventEditorSnapshot = null;
};

window.requestCloseEventEditor = async function() {
    return window.requestCloseIfDirty(
        window.isEventEditorDirty,
        'Редактор ивента не сохранён.',
        window.closeEventEditor
    );
};

window.renderEventEditorLists = function() {
    const prizesEl = document.getElementById('event-edit-prizes');
    const condEl = document.getElementById('event-edit-conditions');
    if (prizesEl) {
        const achOpts = (window.ACHIEVEMENT_CATALOG || []).map((a) => {
            const label = window.locQuestText ? window.locQuestText(a.title) : (a.title?.ru || a.id);
            return { id: a.id, label };
        });
        prizesEl.innerHTML = (window.__eventEditorPrizes || []).map((p, i) => {
            const achSelect = `
                <select class="modal-input text-xs" onchange="window.__eventEditorPrizes[${i}].achievementId=this.value">
                    <option value="">Без достижения</option>
                    ${achOpts.map((a) => `<option value="${a.id}" ${p.achievementId === a.id ? 'selected' : ''}>${String(a.label).replace(/</g, '')}</option>`).join('')}
                </select>`;
            return `
            <div class="event-editor-prize">
                <div class="event-editor-row">
                    <input class="modal-input text-xs" placeholder="Место" value="${String(p.place || '').replace(/"/g, '&quot;')}" oninput="window.__eventEditorPrizes[${i}].place=this.value">
                    <input class="modal-input text-xs" placeholder="Приз" value="${String(p.title || '').replace(/"/g, '&quot;')}" oninput="window.__eventEditorPrizes[${i}].title=this.value">
                    <input class="modal-input text-xs" placeholder="Описание" value="${String(p.description || '').replace(/"/g, '&quot;')}" oninput="window.__eventEditorPrizes[${i}].description=this.value">
                    <button type="button" onclick="window.__eventEditorPrizes.splice(${i},1);window.renderEventEditorLists()"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="event-editor-row event-editor-row--rewards">
                    <input class="modal-input text-xs" type="number" min="0" step="1" placeholder="XP" value="${Number(p.xp) || 0}" oninput="window.__eventEditorPrizes[${i}].xp=Math.max(0,Number(this.value)||0)">
                    ${achSelect}
                </div>
            </div>`;
        }).join('');
    }
    if (condEl) {
        condEl.innerHTML = (window.__eventEditorConditions || []).map((c, i) => `
            <div class="event-editor-row">
                <select class="modal-input text-xs" onchange="window.__eventEditorConditions[${i}].kind=this.value">
                    ${['ecoCategory', 'minDuration', 'hasSound', 'deadline', 'custom'].map((k) => `<option value="${k}" ${c.kind === k ? 'selected' : ''}>${k}</option>`).join('')}
                </select>
                <input class="modal-input text-xs" placeholder="Подпись" value="${String(c.label || '').replace(/"/g, '&quot;')}" oninput="window.__eventEditorConditions[${i}].label=this.value">
                <input class="modal-input text-xs" placeholder="Значение" value="${String(c.value || '').replace(/"/g, '&quot;')}" oninput="window.__eventEditorConditions[${i}].value=this.value">
                <button type="button" onclick="window.__eventEditorConditions.splice(${i},1);window.renderEventEditorLists()"><i class="fa-solid fa-xmark"></i></button>
            </div>`).join('');
    }
};

window.addEventPrizeRow = function() {
    window.__eventEditorPrizes.push({
        place: String((window.__eventEditorPrizes.length || 0) + 1),
        title: '',
        description: '',
        xp: 0,
        achievementId: ''
    });
    window.renderEventEditorLists();
};

window.addEventConditionRow = function() {
    window.__eventEditorConditions.push({ id: 'c' + Date.now().toString(36), kind: 'custom', label: '', value: '' });
    window.renderEventEditorLists();
};

window.renderEventCoverPreview = function() {
    const wrap = document.getElementById('event-cover-preview');
    const img = document.getElementById('event-cover-el');
    if (!wrap || !img) return;
    if (window.__eventCoverImage) {
        img.src = window.__eventCoverImage;
        wrap.classList.remove('hidden');
    } else wrap.classList.add('hidden');
};

window.pickEventCover = function(files) {
    if (!files || !files[0]) return;
    const reader = new FileReader();
    reader.onload = () => {
        window.__eventCoverImage = reader.result;
        window.renderEventCoverPreview();
    };
    reader.readAsDataURL(files[0]);
};

window.renderEventParticipantsEditor = function(e) {
    const el = document.getElementById('event-edit-participants');
    if (!el) return;
    const parts = e?.participants || [];
    if (!parts.length) {
        el.innerHTML = '<p class="text-[11px] text-slate-400">Участников пока нет</p>';
        return;
    }
    el.innerHTML = parts.map((p) => `
        <div class="event-part-row">
            <span class="min-w-0 truncate text-xs font-semibold">${p.name || p.login} · ${p.status}${p.soundId ? ' · 🎵' : ''}</span>
            <input type="number" class="modal-input text-xs w-16" placeholder="score" value="${p.score != null ? p.score : ''}" onchange="window.updateParticipantScore('${e.id}', '${p.login}', this.value)">
            <button type="button" class="text-[10px] font-bold text-amber-600" onclick="window.setEventWinner('${e.id}', '${p.login}')">Победитель</button>
        </div>`).join('');
};

window.updateParticipantScore = async function(eventId, login, score) {
    const n = score === '' ? undefined : Number(score);
    const next = (window.eventsData || []).map((e) => {
        if (e.id !== eventId) return e;
        return {
            ...e,
            participants: (e.participants || []).map((p) => p.login === login ? { ...p, score: n, updatedAt: new Date().toISOString() } : p),
            updatedAt: new Date().toISOString()
        };
    });
    await window.syncEventsData(next);
};

window.setEventWinner = async function(eventId, login) {
    const e = window.getActiveEvents().find((x) => x.id === eventId);
    if (!e) return;
    const already = (e.winners || []).find((w) => w.login === login);
    if (already) {
        window.showToast('Этот участник уже в победителях');
        return;
    }
    const place = String(((e.winners || []).length || 0) + 1);
    const prize = (e.prizes || []).find((p) => String(p.place) === place);
    let xpGranted = 0;
    let achievementId = '';
    if (prize && window.grantEventPrizeToUser) {
        const grant = await window.grantEventPrizeToUser(login, prize);
        if (grant?.ok) {
            xpGranted = grant.xpGranted || 0;
            achievementId = grant.achievementGranted || prize.achievementId || '';
        } else if (grant && !grant.skipped) {
            window.showToast(grant.reason === 'no_profile' ? 'Профиль победителя не найден' : 'Не удалось начислить приз');
        }
    }
    const winnerRow = {
        login,
        place,
        prizeTitle: prize?.title || '',
        xpGranted,
        achievementId
    };
    const winners = [...(e.winners || []), winnerRow];
    const next = (window.eventsData || []).map((ev) => ev.id === eventId ? { ...ev, winners, updatedAt: new Date().toISOString() } : ev);
    await window.syncEventsData(next);
    const bits = [`Победитель #${place}: ${login}`];
    if (winnerRow.xpGranted) bits.push(`+${winnerRow.xpGranted} XP`);
    if (winnerRow.achievementId) bits.push(window.getAchievementTitle?.(winnerRow.achievementId) || winnerRow.achievementId);
    window.showToast(bits.join(' · '));
    window.renderEventParticipantsEditor(window.getActiveEvents().find((x) => x.id === eventId));
};

window.saveEventFromEditor = async function() {
    if (!window.isCurrentUserAdmin || !window.isCurrentUserAdmin()) return;
    const title = (document.getElementById('event-edit-title')?.value || '').trim();
    if (!title) { window.showToast('Укажите название'); return; }
    const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
    const now = new Date().toISOString();
    const existingId = window.__editingEventId;
    const prev = existingId ? (window.eventsData || []).find((e) => e.id === existingId) : null;
    const toIso = (v) => {
        if (!v) return undefined;
        const d = new Date(v);
        return isNaN(d) ? undefined : d.toISOString();
    };
    const event = {
        id: existingId || ('ev' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
        title,
        theme: (document.getElementById('event-edit-theme')?.value || '').trim(),
        description: (document.getElementById('event-edit-description')?.value || '').trim(),
        coverImage: window.__eventCoverImage || undefined,
        type: document.getElementById('event-edit-type')?.value || 'contest',
        status: document.getElementById('event-edit-status')?.value || 'scheduled',
        startsAt: toIso(document.getElementById('event-edit-starts')?.value),
        endsAt: toIso(document.getElementById('event-edit-ends')?.value),
        place: { label: (document.getElementById('event-edit-place')?.value || '').trim() || undefined },
        conditions: (window.__eventEditorConditions || []).filter((c) => c.label || c.value).map((c, i) => ({
            id: c.id || ('c' + i),
            kind: c.kind || 'custom',
            label: c.label || c.kind,
            value: c.value || ''
        })),
        prizes: (window.__eventEditorPrizes || [])
            .filter((p) => p.title || p.place || Number(p.xp) > 0 || p.achievementId)
            .map((p) => ({
                place: String(p.place || '').trim(),
                title: String(p.title || '').trim(),
                description: String(p.description || '').trim(),
                xp: Math.max(0, Math.floor(Number(p.xp) || 0)),
                achievementId: String(p.achievementId || '').trim()
            })),
        capacity: Number(document.getElementById('event-edit-capacity')?.value) || undefined,
        requireSound: !!document.getElementById('event-edit-require-sound')?.checked,
        allowGuestRsvp: false,
        tags: prev?.tags || [],
        participants: prev?.participants || [],
        winners: prev?.winners || [],
        pinned: !!document.getElementById('event-edit-pinned')?.checked,
        createdBy: prev?.createdBy || login,
        createdAt: prev?.createdAt || now,
        updatedAt: now
    };
    const next = [...(window.eventsData || []).filter((e) => e.id !== event.id), event];
    const ok = await window.syncEventsData(next);
    if (ok) {
        window.closeEventEditor();
        window.showToast(existingId ? 'Ивент обновлён' : 'Ивент создан');
        window.openEventsPanel();
        window.__eventsDetailId = event.id;
        window.renderEventsPanel();
    }
};

window.renderAdminEventsList = function() {
    const el = document.getElementById('admin-events-list');
    if (!el) return;
    let list = window.getActiveEvents().slice().sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    const q = (window.__adminSearch?.events || '').trim().toLowerCase();
    if (q) {
        list = list.filter((e) => {
            const st = window.normalizeEventStatus(e);
            const hay = [
                e.title, e.id, e.type, e.description, e.place, st,
                window.EVENT_STATUS_LABELS?.[st], window.EVENT_TYPE_LABELS?.[e.type]
            ].map((x) => String(x || '').toLowerCase()).join(' ');
            return hay.includes(q);
        });
    }
    if (!list.length) {
        el.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">${q ? 'Ничего не найдено по запросу.' : 'Ивентов пока нет'}</p>`;
        return;
    }
    el.innerHTML = list.map((e) => {
        const st = window.normalizeEventStatus(e);
        const n = (e.participants || []).filter((p) => p.status === 'going').length;
        return `<div class="admin-entity-row">
            <button type="button" class="admin-entity-main text-left flex-1" onclick="window.openEventEditor('${e.id}')">
                <p class="admin-entity-num">${window.EVENT_STATUS_LABELS[st] || st}${e.pinned ? ' · pin' : ''}</p>
                <p class="admin-entity-title">${e.title}</p>
                <p class="admin-entity-meta">${n} уч. · ${window.EVENT_TYPE_LABELS[e.type] || ''}</p>
            </button>
            <button type="button" class="admin-actions-btn" onclick="window.openEventsPanel(); window.openEventDetail('${e.id}')">Открыть</button>
        </div>`;
    }).join('');
};

// Desktop/mobile: calendar FAB is always in #map-top-right-controls
