/**
 * Admin console — command palette for operators.
 * Commands call existing product functions; they do not invent new backends.
 */

window.ADMIN_CONSOLE_COMMANDS = [
    { name: 'help', usage: 'help', desc: 'Список команд' },
    { name: 'whoami', usage: 'whoami', desc: 'Текущий админ' },
    { name: 'health', usage: 'health', desc: 'Проверка Secure API' },
    { name: 'version', usage: 'version', desc: 'Версия клиента / API' },
    { name: 'stats', usage: 'stats', desc: 'Сводка по каталогу' },
    { name: 'pending', usage: 'pending', desc: 'Звуки на модерации' },
    { name: 'approve', usage: 'approve <soundId>', desc: 'Одобрить запись' },
    { name: 'reject', usage: 'reject <soundId>', desc: 'Отклонить запись' },
    { name: 'delete', usage: 'delete <soundId>', desc: 'Удалить запись (tombstone)' },
    { name: 'sound', usage: 'sound <soundId>', desc: 'Карточка звука' },
    { name: 'find', usage: 'find <текст>', desc: 'Поиск по названию/автору' },
    { name: 'users', usage: 'users', desc: 'Список пользователей' },
    { name: 'block', usage: 'block <login>', desc: 'Заблокировать пользователя' },
    { name: 'unblock', usage: 'unblock <login>', desc: 'Разблокировать' },
    { name: 'profile', usage: 'profile <login>', desc: 'Открыть публичный профиль' },
    { name: 'reports', usage: 'reports', desc: 'Открытые жалобы' },
    { name: 'resolve', usage: 'resolve <reportId>', desc: 'Закрыть жалобу' },
    { name: 'support', usage: 'support', desc: 'Очередь поддержки' },
    { name: 'refresh', usage: 'refresh', desc: 'Принудительный poll облака' },
    { name: 'export-csv', usage: 'export-csv', desc: 'Экспорт CSV (все)' },
    { name: 'export-geojson', usage: 'export-geojson', desc: 'Экспорт GeoJSON' },
    { name: 'tombstones', usage: 'tombstones', desc: 'Удалённые звуки в кэше' },
    { name: 'mail', usage: 'mail', desc: 'Сводка mail.json' },
    { name: 'sessions', usage: 'sessions', desc: 'Все экспедиции' },
    { name: 'feed', usage: 'feed', desc: 'Посты ленты' },
    { name: 'orphans', usage: 'orphans', desc: 'Проверка осиротевших маркеров' },
    { name: 'clear-filters', usage: 'clear-filters', desc: 'Сбросить фильтры карты' },
    { name: 'goto', usage: 'goto <lat> <lng>', desc: 'Центрировать карту' },
    { name: 'provider', usage: 'provider <id>', desc: 'Сменить движок карты' },
    { name: 'notify', usage: 'notify <login> <текст…>', desc: 'Системное уведомление пользователю' }
];

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

window.runAdminConsoleCommand = async function(raw) {
    const line = String(raw || '').trim();
    if (!line) return;
    if (!window.isCurrentUserAdmin || !window.isCurrentUserAdmin()) {
        window.adminConsoleLog('Нет прав администратора', 'error');
        return;
    }
    window.adminConsoleLog(`› ${line}`, 'cmd');
    const parts = line.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((p) => p.replace(/^"|"$/g, '')) || [];
    const cmd = String(parts[0] || '').toLowerCase();
    const args = parts.slice(1);

    try {
        switch (cmd) {
            case 'help':
            case '?':
                window.ADMIN_CONSOLE_COMMANDS.forEach((c) => {
                    window.adminConsoleLog(`${c.usage} — ${c.desc}`);
                });
                break;
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
                window.adminConsoleLog(`client cache 20260718q · api ${h.version ?? '?'}`);
                break;
            }
            case 'stats': {
                const all = window.soundsData || [];
                const pub = all.filter((s) => !s.status || s.status === 'published');
                const pending = all.filter((s) => s.status === 'pending');
                const rejected = all.filter((s) => s.status === 'rejected');
                const users = (window.profilesData || []).length;
                window.adminConsoleLog(`sounds ${all.length} · published ${pub.length} · pending ${pending.length} · rejected ${rejected.length} · users ${users}`);
                break;
            }
            case 'pending': {
                const list = (window.soundsData || []).filter((s) => s.status === 'pending');
                if (!list.length) window.adminConsoleLog('Очередь пуста', 'ok');
                else list.slice(0, 40).forEach((s) => window.adminConsoleLog(`${s.id} · ${s.title} · ${s.recordist || ''}`));
                break;
            }
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
            case 'delete': {
                const id = args[0];
                if (!id) { window.adminConsoleLog('usage: delete <soundId>', 'error'); break; }
                if (window.deleteSoundFromCloud) await window.deleteSoundFromCloud(id);
                window.adminConsoleLog(`delete requested ${id}`, 'ok');
                break;
            }
            case 'sound': {
                const id = args[0];
                const s = (window.soundsData || []).find((x) => x.id === id);
                if (!s) { window.adminConsoleLog('не найдено', 'error'); break; }
                window.adminConsoleLog(JSON.stringify({
                    id: s.id, title: s.title, status: s.status, recordist: s.recordist,
                    plays: s.plays, downloads: s.downloads, comments: (s.comments || []).length
                }));
                if (window.selectSound) window.selectSound(id);
                break;
            }
            case 'find': {
                const q = args.join(' ').toLowerCase();
                if (!q) { window.adminConsoleLog('usage: find <текст>', 'error'); break; }
                const hits = (window.soundsData || []).filter((s) =>
                    String(s.title || '').toLowerCase().includes(q)
                    || String(s.recordist || '').toLowerCase().includes(q)
                    || String(s.id || '').toLowerCase().includes(q)
                ).slice(0, 30);
                if (!hits.length) window.adminConsoleLog('ничего', 'error');
                else hits.forEach((s) => window.adminConsoleLog(`${s.id} · ${s.title}`));
                break;
            }
            case 'users': {
                (window.profilesData || []).slice(0, 80).forEach((p) => {
                    window.adminConsoleLog(`${p.loginName} · ${p.displayName || ''} · ${p.blocked ? 'BLOCKED' : (p.role || 'user')}`);
                });
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
            case 'profile': {
                const login = String(args[0] || '').toLowerCase();
                if (!login) { window.adminConsoleLog('usage: profile <login>', 'error'); break; }
                if (window.openPublicProfile) window.openPublicProfile(login);
                window.adminConsoleLog(`opened ${login}`, 'ok');
                break;
            }
            case 'reports': {
                const reports = window.getAllReports ? window.getAllReports().filter((r) => r.status !== 'resolved') : [];
                if (!reports.length) window.adminConsoleLog('жалоб нет', 'ok');
                else reports.slice(0, 40).forEach((r) => window.adminConsoleLog(`${r.id} · #${r.number || '?'} · ${r.soundTitle} · ${r.reason}`));
                if (window.switchAdminSection) window.switchAdminSection('reports');
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
            case 'support': {
                if (window.switchAdminSection) window.switchAdminSection('support');
                if (window.renderAdminSupportList) window.renderAdminSupportList();
                window.adminConsoleLog('секция поддержки открыта', 'ok');
                break;
            }
            case 'refresh': {
                if (window.pollLiveCloudData) await window.pollLiveCloudData();
                window.adminConsoleLog('poll done', 'ok');
                break;
            }
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
            case 'feed': {
                const posts = window.feedPosts || [];
                window.adminConsoleLog(`feed posts: ${posts.length}`);
                posts.slice(0, 20).forEach((p) => window.adminConsoleLog(`${p.id} · ${p.title || p.type}`));
                break;
            }
            case 'orphans': {
                const alive = new Set((window.soundsData || []).map((s) => s.id));
                let orphan = 0;
                (window.markerCache || new Map()).forEach((_, id) => { if (!alive.has(id)) orphan += 1; });
                (window.mapboxMarkerCache || new Map()).forEach((_, id) => { if (!alive.has(id)) orphan += 1; });
                window.adminConsoleLog(`orphan markers: ${orphan}`, orphan ? 'error' : 'ok');
                if (window.updateMapMarkers) window.updateMapMarkers();
                break;
            }
            case 'clear-filters':
                if (window.clearAllSoundFilters) window.clearAllSoundFilters();
                window.adminConsoleLog('filters cleared', 'ok');
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
            default:
                window.adminConsoleLog(`Неизвестная команда: ${cmd}. Введите help`, 'error');
        }
    } catch (err) {
        window.adminConsoleLog(String(err?.message || err), 'error');
    }
};

window.onAdminConsoleKeydown = function(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const input = document.getElementById('admin-console-input');
    if (!input) return;
    const val = input.value;
    input.value = '';
    window.runAdminConsoleCommand(val);
};
