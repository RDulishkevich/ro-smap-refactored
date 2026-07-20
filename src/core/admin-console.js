/**
 * Admin console — command palette for operators (~70 commands).
 * Commands stay inside the admin dock (no section jumps / no forced navigation).
 */

window.ADMIN_CONSOLE_COMMANDS = [
    { name: 'help', usage: 'help [filter]', desc: 'Список команд' },
    { name: 'whoami', usage: 'whoami', desc: 'Текущий админ' },
    { name: 'health', usage: 'health', desc: 'Проверка Secure API' },
    { name: 'version', usage: 'version', desc: 'Версия клиента / API' },
    { name: 'stats', usage: 'stats', desc: 'Сводка по каталогу' },
    { name: 'pending', usage: 'pending', desc: 'Звуки на модерации' },
    { name: 'published', usage: 'published', desc: 'Опубликованные (топ)' },
    { name: 'rejected', usage: 'rejected', desc: 'Отклонённые' },
    { name: 'approve', usage: 'approve <soundId>', desc: 'Одобрить запись' },
    { name: 'reject', usage: 'reject <soundId>', desc: 'Отклонить запись' },
    { name: 'delete', usage: 'delete <soundId>', desc: 'Удалить запись (tombstone)' },
    { name: 'status', usage: 'status <soundId> <published|pending|rejected>', desc: 'Сменить статус' },
    { name: 'sound', usage: 'sound <soundId>', desc: 'Карточка звука (в консоли)' },
    { name: 'id', usage: 'id <soundId>', desc: 'Показать публичный ID' },
    { name: 'find', usage: 'find <текст>', desc: 'Поиск по названию/автору/id' },
    { name: 'users', usage: 'users', desc: 'Список пользователей' },
    { name: 'whois', usage: 'whois <login>', desc: 'Карточка пользователя' },
    { name: 'block', usage: 'block <login>', desc: 'Заблокировать пользователя' },
    { name: 'unblock', usage: 'unblock <login>', desc: 'Разблокировать' },
    { name: 'role', usage: 'role <login>', desc: 'Роль пользователя' },
    { name: 'profile', usage: 'profile <login>', desc: 'Сводка профиля (без модалки)' },
    { name: 'reports', usage: 'reports', desc: 'Открытые жалобы' },
    { name: 'resolve', usage: 'resolve <reportId|№>', desc: 'Закрыть жалобу' },
    { name: 'support', usage: 'support', desc: 'Очередь поддержки' },
    { name: 'tickets', usage: 'tickets', desc: 'Обращения с номерами' },
    { name: 'ticket', usage: 'ticket <№>', desc: 'Найти обращение по номеру' },
    { name: 'refresh', usage: 'refresh', desc: 'Принудительный poll облака' },
    { name: 'export-csv', usage: 'export-csv', desc: 'Экспорт CSV (все)' },
    { name: 'export-geojson', usage: 'export-geojson', desc: 'Экспорт GeoJSON' },
    { name: 'tombstones', usage: 'tombstones', desc: 'Удалённые звуки в кэше' },
    { name: 'mail', usage: 'mail', desc: 'Сводка mail.json' },
    { name: 'sessions', usage: 'sessions', desc: 'Все экспедиции' },
    { name: 'expedition', usage: 'expedition <id>', desc: 'Карточка экспедиции' },
    { name: 'feed', usage: 'feed', desc: 'Посты ленты' },
    { name: 'feed-pin', usage: 'feed-pin <postId>', desc: 'Закрепить пост' },
    { name: 'feed-unpin', usage: 'feed-unpin <postId>', desc: 'Открепить пост' },
    { name: 'feed-stats', usage: 'feed-stats [postId]', desc: 'Статистика ленты / поста' },
    { name: 'feed-delete', usage: 'feed-delete <postId>', desc: 'Удалить пост ленты' },
    { name: 'feed-comments', usage: 'feed-comments <postId>', desc: 'Комментарии поста' },
    { name: 'feed-clear-comments', usage: 'feed-clear-comments <postId>', desc: 'Очистить комментарии поста' },
    { name: 'events', usage: 'events', desc: 'Список ивентов' },
    { name: 'event', usage: 'event <id>', desc: 'Карточка ивента' },
    { name: 'event-create', usage: 'event-create', desc: 'Открыть редактор ивента' },
    { name: 'event-status', usage: 'event-status <id> <status>', desc: 'Сменить статус ивента' },
    { name: 'event-pin', usage: 'event-pin <id>', desc: 'Закрепить / открепить ивент' },
    { name: 'event-end', usage: 'event-end <id>', desc: 'Завершить ивент' },
    { name: 'event-participants', usage: 'event-participants <id>', desc: 'Участники ивента' },
    { name: 'event-rsvp', usage: 'event-rsvp <id> <going|maybe|declined>', desc: 'Тест RSVP от админа' },
    { name: 'event-set-winner', usage: 'event-set-winner <id> <login>', desc: 'Назначить победителя' },
    { name: 'event-delete', usage: 'event-delete <id>', desc: 'Удалить ивент' },
    { name: 'events-refresh', usage: 'events-refresh', desc: 'Перерисовать панель ивентов' },
    { name: 'orphans', usage: 'orphans', desc: 'Проверка осиротевших маркеров' },
    { name: 'clear-filters', usage: 'clear-filters', desc: 'Сбросить фильтры карты' },
    { name: 'filters', usage: 'filters', desc: 'Активные фильтры' },
    { name: 'goto', usage: 'goto <lat> <lng>', desc: 'Центрировать карту' },
    { name: 'provider', usage: 'provider <id>', desc: 'Сменить движок карты' },
    { name: 'providers', usage: 'providers', desc: 'Список движков карты' },
    { name: 'notify', usage: 'notify <login> <текст…>', desc: 'Системное уведомление' },
    { name: 'likes', usage: 'likes <soundId>', desc: 'Лайки записи' },
    { name: 'plays', usage: 'plays <soundId>', desc: 'Прослушивания' },
    { name: 'downloads', usage: 'downloads <soundId>', desc: 'Скачивания' },
    { name: 'comments', usage: 'comments <soundId>', desc: 'Комментарии записи' },
    { name: 'reports-of', usage: 'reports-of <soundId>', desc: 'Жалобы на запись' },
    { name: 'top-plays', usage: 'top-plays', desc: 'Топ по прослушиваниям' },
    { name: 'top-likes', usage: 'top-likes', desc: 'Топ по лайкам' },
    { name: 'count', usage: 'count', desc: 'Быстрые счётчики' },
    { name: 'unread', usage: 'unread', desc: 'Непрочитанные у support' },
    { name: 'inbox', usage: 'inbox <login>', desc: 'Размер inbox пользователя' },
    { name: 'presence', usage: 'presence <login>', desc: 'Онлайн-статус' },
    { name: 'badges', usage: 'badges <login>', desc: 'Бейджи пользователя' },
    { name: 'activity', usage: 'activity <login>', desc: 'Активность (кратко)' },
    { name: 'dump-sound', usage: 'dump-sound <soundId>', desc: 'JSON записи (сжатый)' },
    { name: 'dump-user', usage: 'dump-user <login>', desc: 'JSON профиля (сжатый)' },
    { name: 'copy-id', usage: 'copy-id <soundId>', desc: 'Скопировать ID в буфер' },
    { name: 'theme', usage: 'theme <light|dark>', desc: 'Тема UI' },
    { name: 'lang', usage: 'lang <ru|en>', desc: 'Язык UI' },
    { name: 'toast', usage: 'toast <текст…>', desc: 'Показать toast' },
    { name: 'echo', usage: 'echo <текст…>', desc: 'Эхо в консоль' },
    { name: 'time', usage: 'time', desc: 'Текущее время' },
    { name: 'cls', usage: 'cls', desc: 'Очистить консоль' },
    { name: 'clear', usage: 'clear', desc: 'Очистить консоль' },
    { name: 'markers', usage: 'markers', desc: 'Число маркеров в кэше' },
    { name: 'rebuild-markers', usage: 'rebuild-markers', desc: 'Пересобрать маркеры' },
    { name: 'api-cache', usage: 'api-cache', desc: 'Ключи poll-кэша' },
    { name: 'fingerprint', usage: 'fingerprint', desc: 'Fingerprint каталога' },
    { name: 'follow', usage: 'follow <login>', desc: 'Подписчики/подписки' },
    { name: 'open-section', usage: 'open-section <sounds|reports|users|support|events|tools|console>', desc: 'Перейти в секцию админки' },
    { name: 'pending-count', usage: 'pending-count', desc: 'Счётчик модерации' },
    { name: 'help-faq', usage: 'help-faq', desc: 'Темы бота поддержки' }
];

window.__adminConsoleSuggestIdx = -1;
window.__adminConsoleHistory = window.__adminConsoleHistory || [];
window.__adminConsoleHistoryIdx = -1;

window.adminConsoleLog = function(line, kind = 'info') {
    const out = document.getElementById('admin-console-output');
    if (!out) return;
    const row = document.createElement('div');
    row.className = `admin-console-line admin-console-line--${kind}`;
    row.textContent = line;
    out.appendChild(row);
    out.scrollTop = out.scrollHeight;
};

window.adminConsoleClear = function() {
    const out = document.getElementById('admin-console-output');
    if (out) out.innerHTML = '';
};

window.hideAdminConsoleSuggest = function() {
    const box = document.getElementById('admin-console-suggest');
    if (box) {
        box.classList.add('hidden');
        box.innerHTML = '';
    }
    window.__adminConsoleSuggestIdx = -1;
};

window.getAdminConsoleSuggestions = function(raw) {
    const q = String(raw || '').trim().toLowerCase();
    const cmds = window.ADMIN_CONSOLE_COMMANDS || [];
    if (!q) return cmds.slice(0, 12);
    const first = q.split(/\s+/)[0];
    return cmds
        .filter((c) => c.name.startsWith(first) || c.usage.includes(first) || c.desc.toLowerCase().includes(first))
        .slice(0, 12);
};

window.renderAdminConsoleSuggest = function(raw) {
    const box = document.getElementById('admin-console-suggest');
    if (!box) return;
    const list = window.getAdminConsoleSuggestions(raw);
    if (!list.length) {
        window.hideAdminConsoleSuggest();
        return;
    }
    if (window.__adminConsoleSuggestIdx >= list.length) window.__adminConsoleSuggestIdx = list.length - 1;
    box.innerHTML = list.map((c, i) => `
        <button type="button" class="admin-console-suggest__item${i === window.__adminConsoleSuggestIdx ? ' is-active' : ''}" data-idx="${i}" role="option">
            <code>${c.usage}</code><span>${c.desc}</span>
        </button>
    `).join('');
    box.classList.remove('hidden');
    box.querySelectorAll('.admin-console-suggest__item').forEach((btn) => {
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const idx = Number(btn.dataset.idx);
            window.applyAdminConsoleSuggestion(list[idx]);
        });
    });
};

window.applyAdminConsoleSuggestion = function(cmd) {
    const input = document.getElementById('admin-console-input');
    if (!input || !cmd) return;
    const parts = String(input.value || '').trim().split(/\s+/);
    if (parts.length <= 1) input.value = cmd.name + (cmd.usage.includes('<') ? ' ' : '');
    else input.value = cmd.name + ' ' + parts.slice(1).join(' ');
    window.hideAdminConsoleSuggest();
    input.focus();
};

window.onAdminConsoleInput = function() {
    const input = document.getElementById('admin-console-input');
    window.renderAdminConsoleSuggest(input?.value || '');
};

window.onAdminConsoleKeydown = function(event) {
    const input = document.getElementById('admin-console-input');
    const box = document.getElementById('admin-console-suggest');
    const open = box && !box.classList.contains('hidden');
    const list = open ? window.getAdminConsoleSuggestions(input?.value || '') : [];

    if (event.key === 'ArrowDown' && open && list.length) {
        event.preventDefault();
        window.__adminConsoleSuggestIdx = Math.min(list.length - 1, (window.__adminConsoleSuggestIdx < 0 ? 0 : window.__adminConsoleSuggestIdx + 1));
        window.renderAdminConsoleSuggest(input.value);
        return;
    }
    if (event.key === 'ArrowUp' && open && list.length) {
        event.preventDefault();
        window.__adminConsoleSuggestIdx = Math.max(0, window.__adminConsoleSuggestIdx - 1);
        window.renderAdminConsoleSuggest(input.value);
        return;
    }
    if (event.key === 'Tab' && list.length) {
        event.preventDefault();
        const pick = list[Math.max(0, window.__adminConsoleSuggestIdx)] || list[0];
        window.applyAdminConsoleSuggestion(pick);
        return;
    }
    if (event.key === 'Escape') {
        window.hideAdminConsoleSuggest();
        return;
    }
    if (event.key === 'ArrowUp' && !open && (window.__adminConsoleHistory || []).length) {
        event.preventDefault();
        const hist = window.__adminConsoleHistory;
        if (window.__adminConsoleHistoryIdx < 0) window.__adminConsoleHistoryIdx = hist.length;
        window.__adminConsoleHistoryIdx = Math.max(0, window.__adminConsoleHistoryIdx - 1);
        input.value = hist[window.__adminConsoleHistoryIdx] || '';
        return;
    }
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    if (open && window.__adminConsoleSuggestIdx >= 0 && list[window.__adminConsoleSuggestIdx]) {
        window.applyAdminConsoleSuggestion(list[window.__adminConsoleSuggestIdx]);
        return;
    }
    const val = input?.value || '';
    if (input) input.value = '';
    window.hideAdminConsoleSuggest();
    window.runAdminConsoleCommand(val);
};

window.runAdminConsoleCommand = async function(raw) {
    const line = String(raw || '').trim();
    if (!line) return;
    if (!window.isCurrentUserAdmin || !window.isCurrentUserAdmin()) {
        window.adminConsoleLog('Нет прав администратора', 'error');
        return;
    }
    window.__adminConsoleHistory.push(line);
    if (window.__adminConsoleHistory.length > 80) window.__adminConsoleHistory.shift();
    window.__adminConsoleHistoryIdx = -1;

    window.adminConsoleLog(`› ${line}`, 'cmd');
    const parts = line.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((p) => p.replace(/^"|"$/g, '')) || [];
    const cmd = String(parts[0] || '').toLowerCase();
    const args = parts.slice(1);
    const findSound = (id) => (window.soundsData || []).find((x) => x.id === id || window.getSoundDisplayId?.(x) === id);

    try {
        switch (cmd) {
            case 'help':
            case '?': {
                const filter = String(args[0] || '').toLowerCase();
                (window.ADMIN_CONSOLE_COMMANDS || [])
                    .filter((c) => !filter || c.name.includes(filter) || c.desc.toLowerCase().includes(filter))
                    .forEach((c) => window.adminConsoleLog(`${c.usage} — ${c.desc}`));
                window.adminConsoleLog(`Всего команд: ${(window.ADMIN_CONSOLE_COMMANDS || []).length}`, 'ok');
                break;
            }
            case 'whoami': {
                const u = window.currentUser;
                window.adminConsoleLog(u ? `${u.loginName || u.username} (${u.role || 'user'})` : 'гость');
                break;
            }
            case 'health': {
                const h = await window.apiHealth();
                window.adminConsoleLog(JSON.stringify(h), h?.ok ? 'ok' : 'error');
                break;
            }
            case 'version': {
                const h = window.__apiHealth || {};
                window.adminConsoleLog(`client cache 20260720a · api ${h.version ?? '?'}`);
                break;
            }
            case 'stats':
            case 'count': {
                const all = window.soundsData || [];
                const pub = all.filter((s) => !s.status || s.status === 'published');
                const pending = all.filter((s) => s.status === 'pending');
                const rejected = all.filter((s) => s.status === 'rejected');
                const users = (window.profilesData || []).length;
                window.adminConsoleLog(`sounds ${all.length} · published ${pub.length} · pending ${pending.length} · rejected ${rejected.length} · users ${users}`);
                break;
            }
            case 'pending':
            case 'pending-count': {
                const list = (window.soundsData || []).filter((s) => s.status === 'pending');
                window.adminConsoleLog(`pending: ${list.length}`, list.length ? 'info' : 'ok');
                if (cmd === 'pending') {
                    if (!list.length) window.adminConsoleLog('Очередь пуста', 'ok');
                    else list.slice(0, 40).forEach((s) => window.adminConsoleLog(`${s.id} · ${s.title} · ${s.recordist || ''}`));
                }
                break;
            }
            case 'published':
                (window.soundsData || []).filter((s) => !s.status || s.status === 'published').slice(0, 40)
                    .forEach((s) => window.adminConsoleLog(`${s.id} · ${s.title}`));
                break;
            case 'rejected':
                (window.soundsData || []).filter((s) => s.status === 'rejected').slice(0, 40)
                    .forEach((s) => window.adminConsoleLog(`${s.id} · ${s.title}`));
                break;
            case 'approve': {
                const id = args[0];
                if (!id) { window.adminConsoleLog('usage: approve <soundId>', 'error'); break; }
                if (window.setSoundStatus) await window.setSoundStatus(id, 'published');
                window.adminConsoleLog(`approved ${id}`, 'ok');
                break;
            }
            case 'reject': {
                const id = args[0];
                if (!id) { window.adminConsoleLog('usage: reject <soundId>', 'error'); break; }
                if (window.setSoundStatus) await window.setSoundStatus(id, 'rejected');
                window.adminConsoleLog(`rejected ${id}`, 'ok');
                break;
            }
            case 'status': {
                const id = args[0];
                const st = args[1];
                if (!id || !['published', 'pending', 'rejected'].includes(st)) {
                    window.adminConsoleLog('usage: status <soundId> <published|pending|rejected>', 'error');
                    break;
                }
                if (window.setSoundStatus) await window.setSoundStatus(id, st);
                window.adminConsoleLog(`${id} → ${st}`, 'ok');
                break;
            }
            case 'delete': {
                const id = args[0];
                if (!id) { window.adminConsoleLog('usage: delete <soundId>', 'error'); break; }
                if (window.deleteSoundFromCloud) await window.deleteSoundFromCloud(id);
                window.adminConsoleLog(`delete requested ${id}`, 'ok');
                break;
            }
            case 'sound':
            case 'dump-sound': {
                const id = args[0];
                const s = findSound(id);
                if (!s) { window.adminConsoleLog('не найдено', 'error'); break; }
                window.adminConsoleLog(JSON.stringify({
                    id: s.id,
                    publicId: window.getSoundDisplayId?.(s) || s.id,
                    title: s.title,
                    status: s.status,
                    recordist: s.recordist,
                    plays: s.plays,
                    downloads: s.downloads,
                    likes: (s.likedBy || []).length,
                    comments: (s.comments || []).length,
                    lat: s.lat,
                    lng: s.lng
                }));
                break;
            }
            case 'id': {
                const s = findSound(args[0]);
                if (!s) { window.adminConsoleLog('не найдено', 'error'); break; }
                window.adminConsoleLog(`${s.id} · display ${window.getSoundDisplayId?.(s) || s.id}`);
                break;
            }
            case 'copy-id': {
                const s = findSound(args[0]);
                if (!s) { window.adminConsoleLog('не найдено', 'error'); break; }
                const text = String(s.id);
                try {
                    await navigator.clipboard.writeText(text);
                    window.adminConsoleLog(`copied ${text}`, 'ok');
                } catch (_) {
                    window.adminConsoleLog(text);
                }
                break;
            }
            case 'find': {
                const q = args.join(' ').toLowerCase();
                if (!q) { window.adminConsoleLog('usage: find <текст>', 'error'); break; }
                const hits = (window.soundsData || []).filter((s) =>
                    String(s.title || '').toLowerCase().includes(q)
                    || String(s.recordist || '').toLowerCase().includes(q)
                    || String(s.id || '').toLowerCase().includes(q)
                    || String(window.getSoundDisplayId?.(s) || '').toLowerCase().includes(q)
                ).slice(0, 30);
                if (!hits.length) window.adminConsoleLog('ничего', 'error');
                else hits.forEach((s) => window.adminConsoleLog(`${s.id} · ${s.title}`));
                break;
            }
            case 'users':
                (window.profilesData || []).slice(0, 80).forEach((p) => {
                    window.adminConsoleLog(`${p.loginName} · ${p.displayName || ''} · ${p.blocked ? 'BLOCKED' : (p.role || 'user')}`);
                });
                break;
            case 'whois':
            case 'profile':
            case 'dump-user': {
                const login = String(args[0] || '').toLowerCase();
                if (!login) { window.adminConsoleLog(`usage: ${cmd} <login>`, 'error'); break; }
                const p = window.getProfileByLogin?.(login);
                if (!p) { window.adminConsoleLog('не найден', 'error'); break; }
                window.adminConsoleLog(JSON.stringify({
                    login: p.loginName,
                    name: p.displayName,
                    role: p.role,
                    blocked: !!p.blocked,
                    badges: p.badges || [],
                    joinedAt: p.joinedAt,
                    followers: (p.followers || []).length,
                    following: (p.following || []).length
                }));
                break;
            }
            case 'block': {
                const login = String(args[0] || '').toLowerCase();
                if (!login) { window.adminConsoleLog('usage: block <login>', 'error'); break; }
                if (window.setUserBlocked) await window.setUserBlocked(login, true);
                window.adminConsoleLog(`blocked ${login}`, 'ok');
                break;
            }
            case 'unblock': {
                const login = String(args[0] || '').toLowerCase();
                if (!login) { window.adminConsoleLog('usage: unblock <login>', 'error'); break; }
                if (window.setUserBlocked) await window.setUserBlocked(login, false);
                window.adminConsoleLog(`unblocked ${login}`, 'ok');
                break;
            }
            case 'role': {
                const login = String(args[0] || '').toLowerCase();
                const p = window.getProfileByLogin?.(login);
                window.adminConsoleLog(p ? `${login}: ${p.role || 'user'}` : 'не найден', p ? 'ok' : 'error');
                break;
            }
            case 'reports': {
                const reports = window.getAllReports ? window.getAllReports().filter((r) => r.status !== 'resolved') : [];
                if (!reports.length) window.adminConsoleLog('жалоб нет', 'ok');
                else reports.slice(0, 40).forEach((r) => window.adminConsoleLog(`${r.id} · #${r.number || '?'} · ${r.soundTitle} · ${r.reason}`));
                break;
            }
            case 'resolve': {
                const rid = args[0];
                if (!rid) { window.adminConsoleLog('usage: resolve <reportId|№>', 'error'); break; }
                const all = window.getAllReports ? window.getAllReports() : [];
                const hit = all.find((r) => r.id === rid || String(r.number) === String(rid));
                if (!hit) { window.adminConsoleLog('жалоба не найдена', 'error'); break; }
                if (window.resolveReport) await window.resolveReport(hit.soundId, hit.id);
                window.adminConsoleLog(`resolved ${hit.id} (#${hit.number || '?'})`, 'ok');
                break;
            }
            case 'support':
            case 'unread': {
                const supportProfile = window.getProfileByLogin?.(window.SUPPORT_LOGIN);
                const peers = new Set();
                (supportProfile?.inbox || []).forEach((m) => {
                    if (!m?.fromId || m.read || m.deleted) return;
                    if (String(m.fromId).toLowerCase() === String(window.SUPPORT_LOGIN || '').toLowerCase()) return;
                    peers.add(String(m.fromId).toLowerCase());
                });
                window.adminConsoleLog(`support unread peers: ${peers.size}`);
                [...peers].slice(0, 40).forEach((p) => window.adminConsoleLog(p));
                break;
            }
            case 'tickets': {
                const supportProfile = window.getProfileByLogin?.(window.SUPPORT_LOGIN);
                const tickets = (supportProfile?.inbox || []).filter((m) => m.ticketNumber);
                if (!tickets.length) window.adminConsoleLog('тикетов нет', 'ok');
                else tickets.slice(0, 50).forEach((m) => window.adminConsoleLog(`№ ${m.ticketNumber} · ${m.fromId} · ${m.ticketStatus || 'open'} · ${String(m.text || '').slice(0, 80)}`));
                break;
            }
            case 'ticket': {
                const n = Number(args[0]);
                if (!n) { window.adminConsoleLog('usage: ticket <№>', 'error'); break; }
                const supportProfile = window.getProfileByLogin?.(window.SUPPORT_LOGIN);
                const hit = (supportProfile?.inbox || []).find((m) => Number(m.ticketNumber) === n);
                if (!hit) window.adminConsoleLog('не найден', 'error');
                else window.adminConsoleLog(JSON.stringify({ number: hit.ticketNumber, from: hit.fromId, status: hit.ticketStatus, text: hit.text, date: hit.date }));
                break;
            }
            case 'refresh':
                if (window.pollLiveCloudData) await window.pollLiveCloudData();
                window.adminConsoleLog('poll done', 'ok');
                break;
            case 'export-csv':
                if (window.exportSoundsData) window.exportSoundsData('csv', true);
                window.adminConsoleLog('csv export started', 'ok');
                break;
            case 'export-geojson':
                if (window.exportSoundsData) window.exportSoundsData('geojson', true);
                window.adminConsoleLog('geojson export started', 'ok');
                break;
            case 'tombstones': {
                const tombs = (window.cloudDataCache || []).filter((s) => s && s.deleted);
                window.adminConsoleLog(`tombstones: ${tombs.length}`);
                tombs.slice(0, 30).forEach((s) => window.adminConsoleLog(`${s.id} · ${s.title || ''}`));
                break;
            }
            case 'mail': {
                const mail = window.mailData || [];
                let inbox = 0; let notif = 0;
                mail.forEach((m) => {
                    inbox += (m.inbox || []).length;
                    notif += (m.notifications || []).length;
                });
                window.adminConsoleLog(`mailboxes ${mail.length} · messages ${inbox} · notifications ${notif}`);
                break;
            }
            case 'sessions': {
                const all = [];
                (window.profilesData || []).forEach((p) => {
                    (p.sessions || []).forEach((s) => all.push({ ...s, owner: p.loginName }));
                });
                window.adminConsoleLog(`expeditions: ${all.length}`);
                all.slice(0, 40).forEach((s) => window.adminConsoleLog(`${s.id} · ${s.title} · ${s.owner}`));
                break;
            }
            case 'expedition': {
                const id = args[0];
                const session = window.findSessionById?.(id);
                if (!session) { window.adminConsoleLog('не найдена', 'error'); break; }
                window.adminConsoleLog(JSON.stringify({ id: session.id, title: session.title, owner: session.ownerId || session.ownerName, date: session.date }));
                break;
            }
            case 'feed': {
                const posts = window.feedPosts || [];
                window.adminConsoleLog(`feed posts: ${posts.length}`);
                posts.slice(0, 20).forEach((p) => window.adminConsoleLog(`${p.id} · ${p.pinned ? '📌 ' : ''}${p.title || p.type} · ♥${(p.reactedBy || []).length} · 💬${(p.comments || []).length} · 👁${p.views || 0}`));
                break;
            }
            case 'feed-pin':
            case 'feed-unpin': {
                const id = args[0];
                const post = (window.feedPosts || []).find((p) => p.id === id);
                if (!post) { window.adminConsoleLog('пост не найден', 'error'); break; }
                const wantPin = cmd === 'feed-pin';
                if (!!post.pinned === wantPin) {
                    window.adminConsoleLog(wantPin ? 'уже закреплён' : 'уже откреплён', 'ok');
                    break;
                }
                if (window.toggleFeedPin) await window.toggleFeedPin(id);
                window.adminConsoleLog(wantPin ? 'pinned' : 'unpinned', 'ok');
                break;
            }
            case 'feed-stats': {
                const id = args[0];
                if (id) {
                    const p = (window.feedPosts || []).find((x) => x.id === id);
                    if (!p) { window.adminConsoleLog('не найден', 'error'); break; }
                    window.adminConsoleLog(JSON.stringify({
                        id: p.id, title: p.title, pinned: !!p.pinned,
                        views: p.views || 0, viewedBy: (p.viewedBy || []).length,
                        hearts: (p.reactedBy || []).length, comments: (p.comments || []).length
                    }));
                } else {
                    const posts = window.feedPosts || [];
                    window.adminConsoleLog(`posts ${posts.length} · pinned ${posts.filter((p) => p.pinned).length} · comments ${posts.reduce((n, p) => n + (p.comments || []).length, 0)}`);
                }
                break;
            }
            case 'feed-delete': {
                const id = args[0];
                if (!id) { window.adminConsoleLog('usage: feed-delete <postId>', 'error'); break; }
                if (window.deleteFeedPost) await window.deleteFeedPost(id);
                window.adminConsoleLog('deleted', 'ok');
                break;
            }
            case 'feed-comments': {
                const id = args[0];
                const p = (window.feedPosts || []).find((x) => x.id === id);
                if (!p) { window.adminConsoleLog('не найден', 'error'); break; }
                (p.comments || []).slice(0, 40).forEach((c) => window.adminConsoleLog(`${c.id} · ${c.author}: ${String(c.text || '').slice(0, 80)}`));
                if (!(p.comments || []).length) window.adminConsoleLog('(пусто)');
                break;
            }
            case 'feed-clear-comments': {
                const id = args[0];
                const next = (window.feedPosts || []).map((p) => p.id === id ? { ...p, comments: [], updatedAt: new Date().toISOString() } : p);
                if (!(window.feedPosts || []).some((p) => p.id === id)) { window.adminConsoleLog('не найден', 'error'); break; }
                if (window.syncFeedPosts) await window.syncFeedPosts(next);
                window.adminConsoleLog('comments cleared', 'ok');
                break;
            }
            case 'events': {
                const list = window.getActiveEvents ? window.getActiveEvents() : (window.eventsData || []);
                window.adminConsoleLog(`events: ${list.length}`);
                list.slice(0, 30).forEach((e) => {
                    const st = window.normalizeEventStatus ? window.normalizeEventStatus(e) : e.status;
                    window.adminConsoleLog(`${e.id} · ${st} · ${e.title} · ${(e.participants || []).filter((p) => p.status === 'going').length} going`);
                });
                break;
            }
            case 'event': {
                const e = (window.getActiveEvents ? window.getActiveEvents() : []).find((x) => x.id === args[0]);
                if (!e) { window.adminConsoleLog('не найден', 'error'); break; }
                window.adminConsoleLog(JSON.stringify({
                    id: e.id, title: e.title, type: e.type, status: e.status,
                    startsAt: e.startsAt, endsAt: e.endsAt, pinned: !!e.pinned,
                    participants: (e.participants || []).length, winners: e.winners || []
                }));
                break;
            }
            case 'event-create':
                if (window.openEventEditor) window.openEventEditor();
                window.adminConsoleLog('editor opened', 'ok');
                break;
            case 'event-status': {
                const [id, status] = args;
                if (!id || !status) { window.adminConsoleLog('usage: event-status <id> <status>', 'error'); break; }
                if (window.setEventStatus) await window.setEventStatus(id, status);
                window.adminConsoleLog(`status → ${status}`, 'ok');
                break;
            }
            case 'event-pin':
                if (!args[0]) { window.adminConsoleLog('usage: event-pin <id>', 'error'); break; }
                if (window.toggleEventPin) await window.toggleEventPin(args[0]);
                window.adminConsoleLog('toggled pin', 'ok');
                break;
            case 'event-end':
                if (!args[0]) { window.adminConsoleLog('usage: event-end <id>', 'error'); break; }
                if (window.setEventStatus) await window.setEventStatus(args[0], 'ended');
                window.adminConsoleLog('ended', 'ok');
                break;
            case 'event-participants': {
                const e = (window.getActiveEvents ? window.getActiveEvents() : []).find((x) => x.id === args[0]);
                if (!e) { window.adminConsoleLog('не найден', 'error'); break; }
                (e.participants || []).forEach((p) => window.adminConsoleLog(`${p.login} · ${p.status}${p.soundId ? ' · ' + p.soundId : ''}${p.score != null ? ' · score ' + p.score : ''}`));
                if (!(e.participants || []).length) window.adminConsoleLog('(пусто)');
                break;
            }
            case 'event-rsvp': {
                const [id, status] = args;
                if (!id || !status) { window.adminConsoleLog('usage: event-rsvp <id> <going|maybe|declined>', 'error'); break; }
                if (window.rsvpEvent) await window.rsvpEvent(id, status);
                window.adminConsoleLog(`rsvp ${status}`, 'ok');
                break;
            }
            case 'event-set-winner': {
                const [id, login] = args;
                if (!id || !login) { window.adminConsoleLog('usage: event-set-winner <id> <login>', 'error'); break; }
                if (window.setEventWinner) await window.setEventWinner(id, login);
                window.adminConsoleLog('winner set', 'ok');
                break;
            }
            case 'event-delete':
                if (!args[0]) { window.adminConsoleLog('usage: event-delete <id>', 'error'); break; }
                if (window.deleteEvent) await window.deleteEvent(args[0]);
                window.adminConsoleLog('delete requested', 'ok');
                break;
            case 'events-refresh':
                if (window.renderEventsPanel) window.renderEventsPanel();
                if (window.renderAdminEventsList) window.renderAdminEventsList();
                window.adminConsoleLog('refreshed', 'ok');
                break;
            case 'orphans': {
                const alive = new Set((window.soundsData || []).map((s) => s.id));
                let orphan = 0;
                (window.markerCache || new Map()).forEach((_, id) => { if (!alive.has(id)) orphan += 1; });
                (window.mapboxMarkerCache || new Map()).forEach((_, id) => { if (!alive.has(id)) orphan += 1; });
                window.adminConsoleLog(`orphan markers: ${orphan}`, orphan ? 'error' : 'ok');
                break;
            }
            case 'clear-filters':
                if (window.clearAllSoundFilters) window.clearAllSoundFilters();
                window.adminConsoleLog('filters cleared', 'ok');
                break;
            case 'filters':
                window.adminConsoleLog(JSON.stringify({
                    eco: window.activeEcoFilter || null,
                    ucs: window.activeUcsFilter || null,
                    tags: window.activeTagFilters || [],
                    session: window.activeSessionId || null
                }));
                break;
            case 'goto': {
                const lat = Number(args[0]); const lng = Number(args[1]);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                    window.adminConsoleLog('usage: goto <lat> <lng>', 'error');
                    break;
                }
                if (window.mapSetView) window.mapSetView(lat, lng, 12);
                else if (window.map?.setCenter) window.map.setCenter([lat, lng], 12);
                window.adminConsoleLog(`map → ${lat}, ${lng}`, 'ok');
                break;
            }
            case 'provider': {
                const id = args[0];
                if (!id) { window.adminConsoleLog('usage: provider <id>', 'error'); break; }
                if (window.setMapProvider) window.setMapProvider(id);
                window.adminConsoleLog(`provider ${id}`, 'ok');
                break;
            }
            case 'providers':
                window.adminConsoleLog('yandex · maplibre · mapbox · dgis · google-earth (если подключены)');
                break;
            case 'notify': {
                const login = String(args[0] || '').toLowerCase();
                const text = args.slice(1).join(' ').trim();
                if (!login || !text) { window.adminConsoleLog('usage: notify <login> <текст>', 'error'); break; }
                if (window.pushNotifications) {
                    await window.pushNotifications([login], {
                        type: 'system',
                        text,
                        fromId: 'admin',
                        fromName: 'Администратор'
                    });
                    window.adminConsoleLog(`notify → ${login}`, 'ok');
                } else window.adminConsoleLog('pushNotifications недоступен', 'error');
                break;
            }
            case 'likes': {
                const s = findSound(args[0]);
                if (!s) { window.adminConsoleLog('не найдено', 'error'); break; }
                window.adminConsoleLog(`likes ${(s.likedBy || []).length}: ${(s.likedBy || []).slice(0, 20).join(', ')}`);
                break;
            }
            case 'plays': {
                const s = findSound(args[0]);
                if (!s) { window.adminConsoleLog('не найдено', 'error'); break; }
                window.adminConsoleLog(`plays ${s.plays || 0}`);
                break;
            }
            case 'downloads': {
                const s = findSound(args[0]);
                if (!s) { window.adminConsoleLog('не найдено', 'error'); break; }
                window.adminConsoleLog(`downloads ${s.downloads || 0}`);
                break;
            }
            case 'comments': {
                const s = findSound(args[0]);
                if (!s) { window.adminConsoleLog('не найдено', 'error'); break; }
                (s.comments || []).slice(0, 30).forEach((c) => window.adminConsoleLog(`${c.id} · ${c.author}: ${String(c.text || '').slice(0, 60)}`));
                break;
            }
            case 'reports-of': {
                const s = findSound(args[0]);
                if (!s) { window.adminConsoleLog('не найдено', 'error'); break; }
                (s.reports || []).forEach((r) => window.adminConsoleLog(`${r.id} · #${r.number || '?'} · ${r.status} · ${r.reason}`));
                break;
            }
            case 'top-plays':
                [...(window.soundsData || [])].sort((a, b) => (b.plays || 0) - (a.plays || 0)).slice(0, 15)
                    .forEach((s) => window.adminConsoleLog(`${s.plays || 0} · ${s.id} · ${s.title}`));
                break;
            case 'top-likes':
                [...(window.soundsData || [])].sort((a, b) => (b.likedBy || []).length - (a.likedBy || []).length).slice(0, 15)
                    .forEach((s) => window.adminConsoleLog(`${(s.likedBy || []).length} · ${s.id} · ${s.title}`));
                break;
            case 'inbox': {
                const login = String(args[0] || '').toLowerCase();
                const p = window.getProfileByLogin?.(login);
                window.adminConsoleLog(p ? `inbox ${(p.inbox || []).length}` : 'не найден', p ? 'ok' : 'error');
                break;
            }
            case 'presence': {
                const login = String(args[0] || '').toLowerCase();
                const label = window.formatPresenceLabel?.(login) || '—';
                window.adminConsoleLog(`${login}: ${label}`);
                break;
            }
            case 'badges': {
                const login = String(args[0] || '').toLowerCase();
                const p = window.getProfileByLogin?.(login);
                window.adminConsoleLog(p ? `badges: ${(p.badges || []).join(', ') || '—'}` : 'не найден');
                break;
            }
            case 'activity': {
                const login = String(args[0] || '').toLowerCase();
                const box = (window.mailData || []).find((m) => String(m.loginName || '').toLowerCase() === login);
                const log = box?.activityLog || [];
                window.adminConsoleLog(`activity ${log.length}`);
                log.slice(0, 15).forEach((e) => window.adminConsoleLog(`${e.type || ''} · ${e.text || ''}`));
                break;
            }
            case 'follow': {
                const login = String(args[0] || '').toLowerCase();
                const p = window.getProfileByLogin?.(login);
                if (!p) { window.adminConsoleLog('не найден', 'error'); break; }
                window.adminConsoleLog(`followers ${(p.followers || []).length} · following ${(p.following || []).length}`);
                break;
            }
            case 'theme': {
                const t = args[0];
                if (t !== 'light' && t !== 'dark') { window.adminConsoleLog('usage: theme <light|dark>', 'error'); break; }
                if (window.setTheme) window.setTheme(t);
                window.adminConsoleLog(`theme ${t}`, 'ok');
                break;
            }
            case 'lang': {
                const l = args[0];
                if (l !== 'ru' && l !== 'en') { window.adminConsoleLog('usage: lang <ru|en>', 'error'); break; }
                if (window.setLanguage) window.setLanguage(l);
                window.adminConsoleLog(`lang ${l}`, 'ok');
                break;
            }
            case 'toast': {
                const text = args.join(' ');
                if (!text) { window.adminConsoleLog('usage: toast <текст>', 'error'); break; }
                if (window.showToast) window.showToast(text);
                window.adminConsoleLog('toast shown', 'ok');
                break;
            }
            case 'echo':
                window.adminConsoleLog(args.join(' '));
                break;
            case 'time':
                window.adminConsoleLog(new Date().toISOString());
                break;
            case 'cls':
            case 'clear':
                window.adminConsoleClear();
                break;
            case 'markers': {
                const y = window.markerCache?.size || 0;
                const m = window.mapboxMarkerCache?.size || 0;
                const d = window.dgisMarkerCache?.size || 0;
                window.adminConsoleLog(`markers yandex=${y} mapbox=${m} dgis=${d}`);
                break;
            }
            case 'rebuild-markers':
                if (window.updateMapMarkers) window.updateMapMarkers();
                window.adminConsoleLog('markers rebuilt', 'ok');
                break;
            case 'api-cache':
                window.adminConsoleLog(JSON.stringify({
                    cloud: !!window.__lastCloudPollKey,
                    profiles: !!window.__lastProfilesPollKey,
                    mail: !!window.__lastMailPollKey,
                    feed: !!window.__lastFeedPollKey
                }));
                break;
            case 'fingerprint':
                window.adminConsoleLog(window.fingerprintDataset?.(window.soundsData) || 'n/a');
                break;
            case 'open-section': {
                const sec = args[0];
                if (!sec) { window.adminConsoleLog('usage: open-section <sounds|reports|users|support|events|tools|console>', 'error'); break; }
                if (window.switchAdminSection) window.switchAdminSection(sec);
                window.adminConsoleLog(`section ${sec}`, 'ok');
                break;
            }
            case 'help-faq':
                (window.SUPPORT_BOT_FAQ || []).forEach((f, i) => {
                    window.adminConsoleLog(`${i + 1}. ${f.keys.slice(0, 4).join(', ')}`);
                });
                break;
            default:
                window.adminConsoleLog(`Неизвестная команда: ${cmd}. Введите help`, 'error');
        }
    } catch (err) {
        window.adminConsoleLog(String(err?.message || err), 'error');
    }
};
