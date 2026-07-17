export function initAuth() {
    // Извлекаем пользователя при загрузке
    const savedUserStr = localStorage.getItem('rosmap_user');
    window.currentUser = savedUserStr ? JSON.parse(savedUserStr) : null;
    
    window.authMode = 'login'; // 'login' or 'register'

    window.openAuthModal = function() {
        const m = document.getElementById('auth-modal');
        if(!m) return;
        m.classList.remove('hidden');
        void m.offsetWidth;
        m.classList.remove('opacity-0', 'pointer-events-none');
        m.firstElementChild.classList.remove('scale-95');
        if (window.playSfx) window.playSfx('open');
        window.switchAuthTab('login');
    };

    window.closeAuthModal = function() {
        const m = document.getElementById('auth-modal');
        if(!m) return;
        m.classList.add('opacity-0', 'pointer-events-none');
        m.firstElementChild.classList.add('scale-95');
        setTimeout(() => { if(m.classList.contains('opacity-0')) m.classList.add('hidden') }, 300);
    };

    window.switchAuthTab = function(mode) {
        window.authMode = mode;
        const btnLogin = document.getElementById('auth-tab-login');
        const btnReg = document.getElementById('auth-tab-register');
        const container = document.getElementById('auth-form-container');
        const actionBtn = document.getElementById('auth-action-btn');

        const activeClass = "flex-1 py-3 text-sm font-bold text-blue-600 border-b-2 border-blue-600 transition-colors";
        const inactiveClass = "flex-1 py-3 text-sm font-bold text-slate-500 dark:text-slate-400 border-b-2 border-transparent hover:text-slate-800 dark:hover:text-slate-200 transition-colors";

        if (mode === 'login') {
            btnLogin.className = activeClass;
            btnReg.className = inactiveClass;
            actionBtn.textContent = 'Войти';
            container.innerHTML = `
                <div>
                    <label class="modal-label">Логин (Имя / CreatorID)</label>
                    <input type="text" id="auth-username" class="modal-input dark:bg-slate-900" placeholder="Ваш псевдоним" onkeydown="if(event.key==='Enter') window.submitAuth()">
                </div>
                <div>
                    <label class="modal-label">Пароль</label>
                    <input type="password" id="auth-password" class="modal-input dark:bg-slate-900" placeholder="Ваш пароль" onkeydown="if(event.key==='Enter') window.submitAuth()">
                </div>
            `;
        } else {
            btnReg.className = activeClass;
            btnLogin.className = inactiveClass;
            actionBtn.textContent = 'Зарегистрироваться';
            container.innerHTML = `
                <div>
                    <label class="modal-label">Логин (Имя / CreatorID)</label>
                    <input type="text" id="auth-username" class="modal-input dark:bg-slate-900" placeholder="Придумайте псевдоним" onkeydown="if(event.key==='Enter') window.submitAuth()">
                </div>
                <div>
                    <label class="modal-label">Пароль</label>
                    <input type="password" id="auth-password" class="modal-input dark:bg-slate-900" placeholder="Придумайте пароль" onkeydown="if(event.key==='Enter') window.submitAuth()">
                </div>
                <p class="text-[10px] text-slate-400 leading-tight">Этот логин будет автоматически использоваться как CreatorID при добавлении ваших аудиозаписей.</p>
            `;
        }
    };

    window.submitAuth = function() {
        const name = document.getElementById('auth-username').value.trim();
        const pass = document.getElementById('auth-password').value.trim();

        if(!name || !pass) return window.showToast('Заполните все поля!');

        let usersDb = JSON.parse(localStorage.getItem('rosmap_users_db')) || {};

        // Специальный вход для админа
        if (name.toLowerCase() === 'admin' && pass === 'Скай') {
            window.currentUser = { username: 'Admin', loginName: 'admin', role: 'admin', settings: { theme: 'light', mapStyle: 'normal', lang: 'ru' } };
            localStorage.setItem('rosmap_user', JSON.stringify(window.currentUser));
            window.closeAuthModal();
            window.showToast('Успешный вход: Админ');
            window.applyUserSettings();
            if (window.applyProfileToCurrentUser) window.applyProfileToCurrentUser();
            window.bustFilteredSoundsCache();
            if (window.refreshNotificationsUI) window.refreshNotificationsUI();
            if (window.refreshMessagesUI) window.refreshMessagesUI();
            if (window.ensureSupportWelcome) window.ensureSupportWelcome();
            if (window.touchMyPresence) window.touchMyPresence(true);
            window.openCabinet();
            return;
        }

        const userKey = name.toLowerCase();

        let isNewRegistration = false;
        if (window.authMode === 'register') {
            if (usersDb[userKey]) {
                return window.showToast('Логин уже занят!');
            }
            usersDb[userKey] = { 
                password: pass, 
                displayName: name,
                settings: { theme: 'light', mapStyle: 'normal', lang: 'ru' } 
            };
            localStorage.setItem('rosmap_users_db', JSON.stringify(usersDb));
            window.showToast('Регистрация успешна!');
            isNewRegistration = true;
        }

        // Режим входа
        if (!usersDb[userKey] || usersDb[userKey].password !== pass) {
            return window.showToast('Неверный логин или пароль!');
        }

        window.currentUser = { 
            username: usersDb[userKey].displayName, 
            loginName: userKey,
            role: 'user', 
            settings: usersDb[userKey].settings 
        };
        
        localStorage.setItem('rosmap_user', JSON.stringify(window.currentUser));
        window.closeAuthModal();
        if (window.applyProfileToCurrentUser) window.applyProfileToCurrentUser();

        if (window.currentUser.blocked) {
            window.currentUser = null;
            localStorage.removeItem('rosmap_user');
            if (window.refreshNotificationsUI) window.refreshNotificationsUI();
            return window.showToast('Аккаунт заблокирован администратором');
        }

        window.showToast('Успешный вход: ' + window.currentUser.username);
        window.applyUserSettings();
        if (isNewRegistration && window.saveMyProfile) window.saveMyProfile({ joinedAt: new Date().toISOString() });
        window.bustFilteredSoundsCache();
        if (window.refreshNotificationsUI) window.refreshNotificationsUI();
        if (window.refreshMessagesUI) window.refreshMessagesUI();
        if (window.ensureSupportWelcome) window.ensureSupportWelcome();
        if (window.touchMyPresence) window.touchMyPresence(true);
        window.openCabinet();
    };

    window.logoutUser = function() {
        window.currentUser = null;
        localStorage.removeItem('rosmap_user');
        window.closeCabinet();
        window.showToast("Вы вышли из профиля");
        
        // Сброс интерфейса на дефолт
        window.setTheme('light');
        window.setMapStyle('normal');
        window.activeSessionId = null;
        window.bustFilteredSoundsCache();
        if (window.renderSidebarExpeditions) window.renderSidebarExpeditions();
        if (window.refreshNotificationsUI) window.refreshNotificationsUI();
        if (window.refreshMessagesUI) window.refreshMessagesUI();
        if (window.syncAccountChrome) window.syncAccountChrome();
        const panel = document.getElementById('notif-panel');
        if (panel) panel.classList.add('hidden');
    };

    // Подмешивает публичные данные профиля (био/ссылки/гир-лист/бейджи/дата регистрации) из
    // общего облачного profiles.json в currentUser. Вызывается и после логина (auth.js), и после
    // фонового фетча profiles.json на старте приложения (bootstrap.js) — порядок этих двух событий
    // не гарантирован, поэтому дёргаем из обоих мест.
    window.applyProfileToCurrentUser = function() {
        if (!window.currentUser) return;
        const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        const profile = window.getProfileByLogin ? window.getProfileByLogin(login) : null;
        if (!profile) {
            if (window.refreshNotificationsUI) window.refreshNotificationsUI();
            if (window.refreshMessagesUI) window.refreshMessagesUI();
            return;
        }
        window.currentUser.bio = profile.bio || '';
        window.currentUser.links = profile.links || [];
        window.currentUser.gear = profile.gear || [];
        window.currentUser.badges = profile.badges || [];
        window.currentUser.joinedAt = profile.joinedAt || window.currentUser.joinedAt;
        window.currentUser.email = profile.email || window.currentUser.email || '';
        window.currentUser.emailVerified = !!profile.emailVerified;
        window.currentUser.blocked = !!profile.blocked;
        if (login !== 'admin') {
            window.currentUser.role = profile.role === 'admin' ? 'admin' : 'user';
        }
        if (profile.avatar && !window.currentUser.avatar) window.currentUser.avatar = profile.avatar;

        if (window.currentUser.blocked && login !== 'admin') {
            window.currentUser = null;
            localStorage.removeItem('rosmap_user');
            window.showToast('Аккаунт заблокирован администратором');
        }

        if (window.refreshNotificationsUI) window.refreshNotificationsUI();
        if (window.refreshMessagesUI) window.refreshMessagesUI();
        if (window.__sidebarTab === 'feed' && window.renderSidebarFeed) window.renderSidebarFeed();
    };

    // Единая точка сохранения профиля: патчит currentUser переданными полями и апсертит
    // соответствующую запись в общем profiles.json. sessions/notifications/role/blocked
    // сохраняются, если не переданы явно в fields.
    window.saveMyProfile = async function(fields = {}) {
        if (!window.currentUser) return false;
        Object.assign(window.currentUser, fields);
        localStorage.setItem('rosmap_user', JSON.stringify(window.currentUser));

        const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        const updated = [...(window.profilesData || [])];
        const idx = updated.findIndex(p => p.loginName === login);
        const prev = idx >= 0 ? updated[idx] : {};

        const record = {
            ...prev,
            loginName: login,
            displayName: window.currentUser.username,
            avatar: window.currentUser.avatar || prev.avatar || '',
            bio: window.currentUser.bio || '',
            links: window.currentUser.links || [],
            gear: window.currentUser.gear || [],
            badges: window.currentUser.badges || [],
            email: window.currentUser.email || '',
            emailVerified: !!window.currentUser.emailVerified,
            joinedAt: window.currentUser.joinedAt || prev.joinedAt || new Date().toISOString(),
            sessions: prev.sessions || [],
            notifications: fields.notifications !== undefined ? fields.notifications : (prev.notifications || []),
            inbox: fields.inbox !== undefined ? fields.inbox : (prev.inbox || []),
            role: fields.role !== undefined ? fields.role : (prev.role || (window.currentUser.role === 'admin' ? 'admin' : 'user')),
            blocked: fields.blocked !== undefined ? !!fields.blocked : !!prev.blocked,
            profileUpdatedAt: new Date().toISOString(),
            lastSeen: new Date().toISOString()
        };

        if (idx >= 0) updated[idx] = record; else updated.push(record);
        return await window.syncProfilesData(updated);
    };

    // --- Экспедиции / сессии: внутренние папки для группировки звуков перед публикацией ---
    // Хранятся в том же profiles.json, что и остальная визитка (profile.sessions = [{id, title, createdAt}]).
    window.getMySessions = function() {
        if (!window.currentUser) return [];
        const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        const profile = window.getProfileByLogin ? window.getProfileByLogin(login) : null;
        return (profile && profile.sessions) || [];
    };

    // Каталог всех экспедиций всех пользователей (для левой панели и карточек деталей/профиля).
    window.getAllSessions = function() {
        const list = [];
        (window.profilesData || []).forEach(p => {
            (p.sessions || []).forEach(s => {
                list.push({
                    ...s,
                    ownerId: p.loginName,
                    ownerName: p.displayName || p.loginName
                });
            });
        });
        return list.sort((a, b) => {
            const da = a.date || a.createdAt || '';
            const db = b.date || b.createdAt || '';
            return String(db).localeCompare(String(da));
        });
    };

    window.findSessionById = function(sessionId) {
        if (!sessionId) return null;
        return window.getAllSessions().find(s => s.id === sessionId) || null;
    };

    // Экспедиции, связанные с пользователем: свои (организатор) + те, где он в participants.
    window.getSessionsForUser = function(login) {
        if (!login) return [];
        return window.getAllSessions().map(s => {
            const isOwner = s.ownerId === login;
            const isParticipant = !isOwner && Array.isArray(s.participants) && s.participants.includes(login);
            if (!isOwner && !isParticipant) return null;
            return { ...s, roleLabel: isOwner ? 'Организатор' : 'Участник' };
        }).filter(Boolean);
    };

    // Удаляет саму сессию и отвязывает от неё звуки (они остаются, просто теряют sessionId).
    window.deleteSession = async function(sessionId) {
        if (!window.currentUser) return false;
        const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        const updated = [...(window.profilesData || [])];
        const idx = updated.findIndex(p => p.loginName === login);
        if (idx < 0) return false;
        updated[idx] = {
            ...updated[idx],
            sessions: (updated[idx].sessions || []).filter(s => s.id !== sessionId),
            profileUpdatedAt: new Date().toISOString()
        };

        const updatedCloud = [...window.cloudDataCache];
        let changed = false;
        window.soundsData.forEach(s => {
            if (s.sessionId === sessionId) {
                s.sessionId = null;
                const cIdx = updatedCloud.findIndex(x => x.id === s.id);
                if (cIdx >= 0) updatedCloud[cIdx] = s; else updatedCloud.push(s);
                changed = true;
            }
        });

        const profilesOk = await window.syncProfilesData(updated);
        if (changed) await window.syncCloudData(updatedCloud);
        return profilesOk;
    };

    window.assignSoundToSession = async function(soundId, sessionId) {
        const s = window.soundsData.find(x => x.id === soundId);
        if (!s) return false;
        s.sessionId = sessionId || null;
        const updatedCloud = [...window.cloudDataCache];
        const idx = updatedCloud.findIndex(x => x.id === soundId);
        if (idx >= 0) updatedCloud[idx] = s; else updatedCloud.push(s);
        const success = await window.syncCloudData(updatedCloud);
        if (success) { window.showToast('Сессия обновлена'); if (window.renderCabinet) window.renderCabinet(); if (window.renderSessionsPanel) window.renderSessionsPanel(); }
        return success;
    };

    // Массово переводит все черновики сессии на модерацию за один запрос к облаку.
    window.publishSessionDrafts = async function(sessionId) {
        const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        const mine = window.getUserSounds(login, window.currentUser.username, { includeAllStatuses: true });
        const drafts = mine.filter(s => s.sessionId === sessionId && s.status === 'draft');
        if (!drafts.length) { window.showToast('В этой экспедиции нет черновиков'); return; }

        const updatedCloud = [...window.cloudDataCache];
        drafts.forEach(s => {
            s.status = 'pending';
            const idx = updatedCloud.findIndex(x => x.id === s.id);
            if (idx >= 0) updatedCloud[idx] = s; else updatedCloud.push(s);
        });

        window.showToast('Публикация записей экспедиции...');
        const success = await window.syncCloudData(updatedCloud);
        if (success) { window.showToast(`Отправлено на модерацию: ${drafts.length}`); window.renderSessionsPanel(); }
    };

    window.renderSessionsPanel = function() {
        const container = document.getElementById('cab-sessions-list');
        if (!container || !window.currentUser) return;

        const sessions = window.getMySessions();
        if (!sessions.length) {
            container.innerHTML = `<div class="text-center py-12 text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm"><i class="fa-solid fa-route text-4xl mb-3 opacity-30 block"></i><p class="font-medium text-sm">У вас пока нет экспедиций.</p><p class="text-xs mt-1">Создайте сессию, чтобы группировать записи одного выезда перед публикацией.</p></div>`;
            return;
        }

        const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        const mySounds = window.getUserSounds(login, window.currentUser.username, { includeAllStatuses: true });

        container.innerHTML = sessions.map(session => {
            const soundsInSession = mySounds.filter(s => s.sessionId === session.id);
            const draftCount = soundsInSession.filter(s => s.status === 'draft').length;
            const createdDate = session.date
                ? new Date(session.date).toLocaleDateString('ru-RU')
                : (session.createdAt ? new Date(session.createdAt).toLocaleDateString('ru-RU') : '');

            const participantNames = [
                ...((session.participants || []).map(login => {
                    const p = window.getProfileByLogin ? window.getProfileByLogin(login) : null;
                    return p ? (p.displayName || p.loginName) : login;
                })),
                ...(session.guests || [])
            ];

            return `
            <div class="session-card">
                <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                        <h5 class="font-bold text-slate-800 dark:text-white text-sm truncate">${session.title}</h5>
                        <p class="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1 flex-wrap">
                            ${createdDate ? `<span><i class="fa-regular fa-calendar mr-1"></i>${createdDate}</span> · ` : ''}
                            <span>${soundsInSession.length} ${soundsInSession.length === 1 ? 'запись' : 'записей'}</span>
                        </p>
                        ${session.route ? `<p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1"><i class="fa-solid fa-route mr-1 opacity-60"></i>${session.route}</p>` : ''}
                        ${session.purpose ? `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${session.purpose}</p>` : ''}
                        ${participantNames.length ? `<p class="text-[11px] text-slate-400 mt-1"><i class="fa-solid fa-user-group mr-1 opacity-60"></i>${participantNames.join(', ')}</p>` : ''}
                        ${(session.photos && session.photos.length) ? `<div class="flex gap-1.5 mt-2">${session.photos.slice(0, 4).map(src => `<img src="${src}" class="w-9 h-9 rounded-lg object-cover border border-slate-200 dark:border-slate-700">`).join('')}</div>` : ''}
                        ${(session.videoLinks && session.videoLinks.length) || (session.links && session.links.length) ? `
                        <div class="flex flex-wrap gap-1.5 mt-2">
                            ${(session.videoLinks || []).map(url => `<a href="${url}" target="_blank" rel="noopener" class="profile-link-chip"><i class="fa-solid fa-film"></i>Видео</a>`).join('')}
                            ${(session.links || []).map(url => `<a href="${url}" target="_blank" rel="noopener" class="profile-link-chip"><i class="fa-solid fa-link"></i>Ресурс</a>`).join('')}
                        </div>` : ''}
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                        <button onclick="window.openSessionModal('${session.id}')" class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 flex items-center justify-center transition-colors" title="Редактировать экспедицию">
                            <i class="fa-solid fa-pen text-xs"></i>
                        </button>
                        <button onclick="window.deleteSession('${session.id}').then(() => window.renderSessionsPanel())" class="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-500 flex items-center justify-center transition-colors" title="Удалить экспедицию">
                            <i class="fa-solid fa-trash-can text-xs"></i>
                        </button>
                    </div>
                </div>
                ${soundsInSession.length ? `
                <div class="session-sound-list">
                    ${soundsInSession.map(s => {
                        const st = window.STATUS_LABELS[s.status] || window.STATUS_LABELS.published;
                        return `
                        <div class="session-sound-row" onclick="window.selectSound('${s.id}'); window.closeCabinet();">
                            <span class="truncate flex-1 pr-2">${s.title}</span>
                            <span class="pub-status-pill ${st.cls} shrink-0">${st.label}</span>
                        </div>`;
                    }).join('')}
                </div>` : `<p class="text-xs text-slate-400 italic mt-2">Пока нет записей — привяжите звук к сессии в вкладке "Мои звуки".</p>`}
                ${draftCount > 0 ? `
                <button onclick="window.publishSessionDrafts('${session.id}')" class="mt-3 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm">
                    <i class="fa-solid fa-cloud-arrow-up mr-1.5"></i>Опубликовать все черновики (${draftCount})
                </button>` : ''}
            </div>`;
        }).join('');
    };

    // --- Вкладка "Экспедиции" в левой панели: публичный каталог всех экспедиций пользователей.
    // Клик фильтрует список звуков по sessionId. ---
    window.renderSidebarExpeditions = function() {
        const container = document.getElementById('panel-expeditions');
        if (!container) return;

        const sessions = window.getAllSessions();
        const myLogin = window.currentUser
            ? (window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase())
            : null;

        const resetChip = `
            <button onclick="window.setSidebarSessionFilter(null)" class="sidebar-expedition-reset ${!window.activeSessionId ? 'active' : ''}">
                <i class="fa-solid fa-layer-group"></i>Все звуки
            </button>`;

        if (!sessions.length) {
            container.innerHTML = `
                ${resetChip}
                <div class="text-center py-6 text-slate-400 dark:text-slate-500">
                    <i class="fa-solid fa-route text-3xl mb-2 opacity-30 block"></i>
                    <p class="text-xs font-medium">Пока никто не создал экспедиций.</p>
                    ${myLogin ? `<button onclick="window.openSessionModal()" class="mt-3 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm"><i class="fa-solid fa-plus mr-1"></i>Создать</button>` : ''}
                </div>`;
            return;
        }

        container.innerHTML = resetChip + sessions.map(session => {
            const count = (window.soundsData || []).filter(s =>
                s.sessionId === session.id && (!s.status || s.status === 'published')
            ).length;
            const dateStr = session.date ? new Date(session.date).toLocaleDateString('ru-RU') : '';
            const active = window.activeSessionId === session.id;
            const mine = myLogin && session.ownerId === myLogin;
            const joined = myLogin && !mine && Array.isArray(session.participants) && session.participants.includes(myLogin);
            const thumb = (session.photos && session.photos[0])
                ? `<img src="${session.photos[0]}" alt="" class="sidebar-expedition-thumb">`
                : `<span class="sidebar-expedition-thumb sidebar-expedition-thumb-fallback"><i class="fa-solid fa-route"></i></span>`;
            return `
            <div class="sidebar-expedition-card ${active ? 'active' : ''}">
                <div class="flex items-start gap-2.5">
                    ${thumb}
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center justify-between gap-2">
                            <h5 class="font-bold text-slate-800 dark:text-white text-xs truncate">${session.title}</h5>
                            <span class="sidebar-expedition-count">${count}</span>
                        </div>
                        <p class="text-[10px] text-slate-400 mt-0.5 truncate">
                            <i class="fa-solid fa-user-astronaut mr-1 opacity-60"></i>${session.ownerName}
                            ${mine ? ' · ваша' : (joined ? ' · вы участник' : '')}
                        </p>
                        ${dateStr || session.route ? `<p class="text-[10px] text-slate-400 mt-0.5 truncate">${dateStr ? `<i class="fa-regular fa-calendar mr-1"></i>${dateStr}` : ''}${dateStr && session.route ? ' · ' : ''}${session.route ? `<i class="fa-solid fa-route mr-1"></i>${session.route}` : ''}</p>` : ''}
                        <div class="flex gap-1.5 mt-2">
                            <button type="button" onclick="event.stopPropagation(); window.openExpeditionViewModal('${session.id}')" class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700/80 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 transition-colors"><i class="fa-solid fa-eye mr-1"></i>Посмотреть</button>
                            <button type="button" onclick="event.stopPropagation(); window.setSidebarSessionFilter('${session.id}')" class="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors"><i class="fa-solid fa-filter mr-1"></i>Фильтр</button>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('') + (myLogin
            ? `<button onclick="window.openSessionModal()" class="sidebar-expedition-add"><i class="fa-solid fa-plus mr-1.5"></i>Новая экспедиция</button>`
            : '');
    };

    window.__viewingExpeditionId = null;
    window.openExpeditionViewModal = function(sessionId) {
        const session = window.findSessionById ? window.findSessionById(sessionId) : null;
        if (!session) { window.showToast('Экспедиция не найдена'); return; }
        window.__viewingExpeditionId = sessionId;

        const titleEl = document.getElementById('expedition-view-title');
        const body = document.getElementById('expedition-view-body');
        if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-route mr-2 text-blue-500"></i>${session.title}`;

        const dateStr = session.date ? new Date(session.date).toLocaleDateString('ru-RU') : '—';
        const count = (window.soundsData || []).filter(s =>
            s.sessionId === session.id && (!s.status || s.status === 'published')
        ).length;
        const guestChips = (session.guests || []).map(g =>
            `<span class="exp-participant-chip exp-participant-chip--guest">${window.escMsgHtml ? window.escMsgHtml(g) : g} <span class="opacity-60">(гость)</span></span>`
        );
        const participantChips = (session.participants || []).map(login => {
            const p = window.getProfileByLogin ? window.getProfileByLogin(login) : null;
            const name = p?.displayName || login;
            const safeLogin = String(login).replace(/'/g, "\\'");
            const safeName = String(name).replace(/'/g, "\\'");
            return `<button type="button" class="exp-participant-chip" onclick="window.closeExpeditionViewModal(); window.openPublicProfile('${safeLogin}', '${safeName}')">${window.escMsgHtml ? window.escMsgHtml(name) : name}</button>`;
        });
        const ownerLogin = session.ownerId || '';
        const ownerSafe = String(ownerLogin).replace(/'/g, "\\'");
        const ownerNameSafe = String(session.ownerName || ownerLogin).replace(/'/g, "\\'");
        const ownerHtml = ownerLogin
            ? `<button type="button" class="font-semibold text-blue-600 dark:text-blue-400 hover:underline truncate text-left" onclick="window.closeExpeditionViewModal(); window.openPublicProfile('${ownerSafe}', '${ownerNameSafe}')">${window.escMsgHtml ? window.escMsgHtml(session.ownerName || ownerLogin) : (session.ownerName || ownerLogin)}</button>`
            : `<p class="font-semibold text-slate-700 dark:text-slate-200 truncate">${session.ownerName || '—'}</p>`;
        const photos = session.photos || [];
        const links = [...(session.links || []), ...(session.videoLinks || [])];

        if (body) {
            body.innerHTML = `
                ${photos.length ? `<div class="flex gap-2 overflow-x-auto pb-1">${photos.map((src, i) => `<img src="${src}" class="h-28 w-40 object-cover rounded-xl border border-slate-100 dark:border-slate-700 shrink-0 cursor-pointer" onclick="window.openLightbox((window.findSessionById('${session.id}')||{}).photos||[], ${i})" alt="">`).join('')}</div>` : ''}
                <div class="grid grid-cols-2 gap-2 text-xs">
                    <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60"><p class="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Организатор</p>${ownerHtml}</div>
                    <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60"><p class="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Дата</p><p class="font-semibold text-slate-700 dark:text-slate-200">${dateStr}</p></div>
                    <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60"><p class="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Звуков</p><p class="font-semibold text-slate-700 dark:text-slate-200">${count}</p></div>
                    <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60"><p class="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Маршрут</p><p class="font-semibold text-slate-700 dark:text-slate-200 truncate">${session.route || '—'}</p></div>
                </div>
                ${(session.routeStops || []).length ? `<div><p class="text-[10px] text-slate-400 font-bold uppercase mb-1.5">Точки маршрута</p><div class="space-y-1.5">${session.routeStops.map((st, i) => {
                    const title = st.title || `Точка ${i + 1}`;
                    const click = st.soundId
                        ? `window.closeExpeditionViewModal(); window.selectSound('${st.soundId}')`
                        : `window.closeExpeditionViewModal(); if(window.map){window.map.setCenter([${Number(st.lat)},${Number(st.lng)}], 14);}`;
                    return `<button type="button" class="session-route-stop w-full text-left" onclick="${click}"><span class="session-route-stop__num">${i + 1}</span><span class="truncate flex-1 font-semibold text-slate-700 dark:text-slate-200">${title}${st.lat != null ? ` · ${Number(st.lat).toFixed(4)}, ${Number(st.lng).toFixed(4)}` : ''}</span></button>`;
                }).join('')}</div>${session.routeStops.length > 1 ? `<button type="button" onclick="window.showExpeditionRouteOnMap('${session.id}')" class="mt-2 w-full py-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 text-xs font-bold"><i class="fa-solid fa-map-location-dot mr-1"></i>Показать маршрут на карте</button>` : ''}</div>` : ''}
                ${session.purpose ? `<div><p class="text-[10px] text-slate-400 font-bold uppercase mb-1">Цель</p><p class="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">${session.purpose}</p></div>` : ''}
                ${participantChips.length || guestChips.length ? `<div><p class="text-[10px] text-slate-400 font-bold uppercase mb-1.5">Участники</p><div class="flex flex-wrap gap-1.5">${participantChips.join('')}${guestChips.join('')}</div></div>` : ''}
                ${links.length ? `<div><p class="text-[10px] text-slate-400 font-bold uppercase mb-1">Ссылки</p><ul class="space-y-1">${links.map(l => `<li><a href="${l}" target="_blank" rel="noopener" class="text-sm text-blue-600 hover:underline break-all">${l}</a></li>`).join('')}</ul></div>` : ''}
            `;
        }

        const m = document.getElementById('expedition-view-modal');
        const c = document.getElementById('expedition-view-modal-content');
        if (!m || !c) return;
        m.classList.remove('hidden');
        void m.offsetWidth;
        m.classList.remove('opacity-0', 'pointer-events-none');
        c.classList.remove('scale-95');
    };

    window.closeExpeditionViewModal = function() {
        const m = document.getElementById('expedition-view-modal');
        const c = document.getElementById('expedition-view-modal-content');
        if (!m || !c) return;
        m.classList.add('opacity-0', 'pointer-events-none');
        c.classList.add('scale-95');
        setTimeout(() => { if (m.classList.contains('opacity-0')) m.classList.add('hidden'); }, 300);
        window.__viewingExpeditionId = null;
    };

    window.showExpeditionRouteOnMap = function(sessionId) {
        const session = window.findSessionById ? window.findSessionById(sessionId) : null;
        const stops = session?.routeStops || [];
        if (stops.length < 2) { window.showToast('Нужно минимум 2 точки'); return; }
        window.closeExpeditionViewModal();
        const coords = stops.map(s => [s.lat, s.lng]);
        if (window.clearMapRoutes) window.clearMapRoutes();
        if (window.mapAddRouteOverlay) window.mapAddRouteOverlay(coords, 'blue');
        window.showToast('Маршрут экспедиции на карте');
    };

    window.applyExpeditionViewFilter = function() {
        const id = window.__viewingExpeditionId;
        window.closeExpeditionViewModal();
        if (id) window.setSidebarSessionFilter(id);
    };

    window.setSidebarSessionFilter = function(sessionId) {
        window.activeSessionId = sessionId || null;
        if (sessionId && window.switchSidebarTab) window.switchSidebarTab('library');
        if (window.renderList) window.renderList();
        if (window.updateMapMarkers) window.updateMapMarkers();
        if (window.renderSidebarExpeditions) window.renderSidebarExpeditions();
        if (sessionId) window.showToast('Фильтр: звуки выбранной экспедиции');
    };

    // --- Полноценная форма экспедиции: дата, цели, маршрут, участники (свои+гости), медиа, ссылки ---
    window.__editingSessionId = null;
    window.__sessionFormPhotos = [];
    window.__sessionRouteStops = [];

    window.openSessionModal = function(sessionId = null) {
        if (!window.currentUser) { window.showToast('Войдите, чтобы создать экспедицию'); if (window.openAuthModal) window.openAuthModal(); return; }
        window.__editingSessionId = sessionId;

        const session = sessionId ? window.getMySessions().find(s => s.id === sessionId) : null;
        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
        setVal('session-form-title', session?.title);
        setVal('session-form-date', session?.date);
        setVal('session-form-route', session?.route);
        setVal('session-form-purpose', session?.purpose);
        setVal('session-form-guests', (session?.guests || []).join(', '));
        setVal('session-form-videos', (session?.videoLinks || []).join(', '));
        setVal('session-form-links', (session?.links || []).join(', '));
        window.__sessionFormPhotos = session?.photos ? [...session.photos] : [];
        window.__sessionRouteStops = (session?.routeStops || session?.routePoints || []).map(s => {
            if (Array.isArray(s)) return { lat: s[0], lng: s[1], title: 'Точка' };
            return { ...s };
        });
        window.renderSessionPhotosPreview();
        window.renderSessionParticipantsPicker(session?.participants || []);
        window.renderSessionRouteStops();

        const titleEl = document.getElementById('session-modal-title');
        const saveTextEl = document.getElementById('session-form-save-text');
        if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-route mr-2 text-blue-600"></i>${session ? 'Редактировать экспедицию' : 'Новая экспедиция'}`;
        if (saveTextEl) saveTextEl.textContent = session ? 'Сохранить изменения' : 'Создать экспедицию';

        const m = document.getElementById('session-modal');
        const c = document.getElementById('session-modal-content');
        if (m && c) {
            m.classList.remove('hidden');
            void m.offsetWidth;
            m.classList.remove('opacity-0', 'pointer-events-none');
            c.classList.remove('scale-95');
        }
    };

    window.closeSessionModal = function() {
        const m = document.getElementById('session-modal');
        const c = document.getElementById('session-modal-content');
        if (m && c) {
            m.classList.add('opacity-0', 'pointer-events-none');
            c.classList.add('scale-95');
            setTimeout(() => { if (m.classList.contains('opacity-0')) m.classList.add('hidden'); }, 300);
        }
        window.__sessionRouteStops = [];
    };

    window.isSessionFormDirty = function() {
        const title = (document.getElementById('session-form-title')?.value || '').trim();
        const route = (document.getElementById('session-form-route')?.value || '').trim();
        const purpose = (document.getElementById('session-form-purpose')?.value || '').trim();
        return !!(title || route || purpose
            || (window.__sessionRouteStops || []).length
            || (window.__sessionFormPhotos || []).length
            || window.__editingSessionId);
    };

    window.requestCloseSessionModal = async function() {
        if (window.isSessionFormDirty()) {
            const ok = await (window.confirmDiscardDraft
                ? window.confirmDiscardDraft('Форма экспедиции не сохранена.')
                : true);
            if (!ok) return;
        }
        window.closeSessionModal();
    };

    window.getSessionRouteCandidateSounds = function() { return []; };

    window.openSessionRoutePicker = function() {
        window.__sessionRoutePicking = true;
        window.__sessionRouteStops = window.__sessionRouteStops || [];
        if (window.openLocationPickerModal) window.openLocationPickerModal();
    };

    window.renderSessionRoutePicker = function() {};

    window.renderSessionRouteStops = function() {
        const box = document.getElementById('session-route-stops');
        if (!box) return;
        const stops = window.__sessionRouteStops || [];
        if (!stops.length) {
            box.innerHTML = `<p class="text-[11px] text-slate-400 px-1">Пока нет точек движения</p>`;
            return;
        }
        box.innerHTML = stops.map((stop, i) => `
            <div class="session-route-stop">
                <span class="session-route-stop__num">${i + 1}</span>
                <span class="truncate flex-1 font-semibold text-slate-700 dark:text-slate-200">${stop.title || `Точка ${i + 1}`} · ${Number(stop.lat).toFixed(4)}, ${Number(stop.lng).toFixed(4)}</span>
                <button type="button" onclick="window.moveSessionRouteStop(${i}, -1)" class="text-slate-400 hover:text-blue-500 px-1" title="Выше"><i class="fa-solid fa-arrow-up text-[10px]"></i></button>
                <button type="button" onclick="window.moveSessionRouteStop(${i}, 1)" class="text-slate-400 hover:text-blue-500 px-1" title="Ниже"><i class="fa-solid fa-arrow-down text-[10px]"></i></button>
                <button type="button" onclick="window.removeSessionRouteStop(${i})" class="text-red-400 hover:text-red-500 px-1"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `).join('');
        window.syncSessionRouteTextFromStops();
    };

    window.syncSessionRouteTextFromStops = function() {
        const stops = window.__sessionRouteStops || [];
        if (stops.length < 2) return;
        const routeInput = document.getElementById('session-form-route');
        if (!routeInput) return;
        const auto = stops.map((s, i) => s.title || `Точка ${i + 1}`).join(' → ');
        if (!routeInput.value.trim() || routeInput.dataset.autoRoute === '1') {
            routeInput.value = auto;
            routeInput.dataset.autoRoute = '1';
        }
    };

    window.addSessionRouteStop = function() {
        window.openSessionRoutePicker();
    };

    window.removeSessionRouteStop = function(index) {
        window.__sessionRouteStops.splice(index, 1);
        window.__sessionRouteStops.forEach((st, i) => { if (!st.soundId) st.title = `Точка ${i + 1}`; });
        const routeInput = document.getElementById('session-form-route');
        if (routeInput) routeInput.dataset.autoRoute = '1';
        window.renderSessionRouteStops();
    };

    window.moveSessionRouteStop = function(index, dir) {
        const next = index + dir;
        const arr = window.__sessionRouteStops || [];
        if (next < 0 || next >= arr.length) return;
        const tmp = arr[index];
        arr[index] = arr[next];
        arr[next] = tmp;
        const routeInput = document.getElementById('session-form-route');
        if (routeInput) routeInput.dataset.autoRoute = '1';
        window.renderSessionRouteStops();
    };

    // Список участников — чипы-чекбоксы по всем ЗАРЕГИСТРИРОВАННЫМ пользователям (кроме себя);
    // незарегистрированных вписывают отдельным текстовым полем (session-form-guests).
    window.renderSessionParticipantsPicker = function(selectedLogins) {
        const container = document.getElementById('session-form-participants');
        if (!container || !window.currentUser) return;
        const myLogin = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        const profiles = (window.profilesData || []).filter(p => p.loginName !== myLogin);
        if (!profiles.length) {
            container.innerHTML = `<span class="text-xs text-slate-400">Других зарегистрированных пользователей пока нет.</span>`;
            return;
        }
        container.innerHTML = profiles.map(p => `
            <label class="badge-toggle-chip ${selectedLogins.includes(p.loginName) ? 'active' : ''}">
                <input type="checkbox" class="hidden" value="${p.loginName}" ${selectedLogins.includes(p.loginName) ? 'checked' : ''} onchange="this.closest('label').classList.toggle('active', this.checked)">
                <i class="fa-solid fa-user"></i>${p.displayName || p.loginName}
            </label>
        `).join('');
    };

    window.handleSessionPhotos = function(files) {
        if (!files || !files.length) return;
        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = e => {
                window.__sessionFormPhotos.push(e.target.result);
                window.renderSessionPhotosPreview();
            };
            reader.readAsDataURL(file);
        });
    };

    window.renderSessionPhotosPreview = function() {
        const container = document.getElementById('session-form-photos-preview');
        if (!container) return;
        container.innerHTML = (window.__sessionFormPhotos || []).map((src, i) => `
            <div class="relative">
                <img src="${src}" class="image-thumb">
                <button type="button" onclick="window.removeSessionPhoto(${i})" class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] shadow-md"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `).join('');
    };
    window.removeSessionPhoto = function(i) {
        window.__sessionFormPhotos.splice(i, 1);
        window.renderSessionPhotosPreview();
    };

    window.saveSessionForm = async function() {
        const title = (document.getElementById('session-form-title')?.value || '').trim();
        if (!title) { window.showToast('Укажите название экспедиции'); return; }

        const date = document.getElementById('session-form-date')?.value || '';
        const route = (document.getElementById('session-form-route')?.value || '').trim();
        const purpose = (document.getElementById('session-form-purpose')?.value || '').trim();
        const guests = (document.getElementById('session-form-guests')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
        const videoLinks = (document.getElementById('session-form-videos')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
        const links = (document.getElementById('session-form-links')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
        const participants = Array.from(document.querySelectorAll('#session-form-participants input:checked')).map(el => el.value);
        const photos = [...(window.__sessionFormPhotos || [])];
        const routeStops = [...(window.__sessionRouteStops || [])];

        const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        const updated = [...(window.profilesData || [])];
        const idx = updated.findIndex(p => p.loginName === login);

        const isEdit = !!window.__editingSessionId;
        const existingSessions = idx >= 0 ? [...(updated[idx].sessions || [])] : [];
        const prevParticipants = isEdit
            ? new Set((existingSessions.find(s => s.id === window.__editingSessionId)?.participants) || [])
            : new Set();

        let sessionObj;
        if (isEdit) {
            sessionObj = existingSessions.find(s => s.id === window.__editingSessionId);
            if (!sessionObj) { window.showToast('Экспедиция не найдена'); return; }
            Object.assign(sessionObj, { title, date, route, purpose, guests, videoLinks, links, participants, photos, routeStops, updatedAt: new Date().toISOString() });
        } else {
            sessionObj = {
                id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                title, date, route, purpose, guests, videoLinks, links, participants, photos, routeStops,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            existingSessions.push(sessionObj);
        }

        if (idx >= 0) updated[idx] = { ...updated[idx], sessions: existingSessions, profileUpdatedAt: new Date().toISOString() };
        else updated.push({ loginName: login, displayName: window.currentUser.username, sessions: existingSessions, profileUpdatedAt: new Date().toISOString() });

        window.showToast('Сохранение экспедиции...');
        const success = await window.syncProfilesData(updated);
        if (success) {
            window.showToast(isEdit ? 'Экспедиция обновлена' : 'Экспедиция создана');
            window.closeSessionModal();
            if (window.populateSessionSelect) window.populateSessionSelect(sessionObj.id);
            if (window.renderSessionsPanel) window.renderSessionsPanel();
            if (window.renderSidebarExpeditions) window.renderSidebarExpeditions();

            const newlyAdded = participants.filter(p => !prevParticipants.has(p) && p !== login);
            if (newlyAdded.length && window.pushNotifications) {
                window.pushNotifications(newlyAdded, {
                    type: 'expedition',
                    text: `${window.currentUser.username} добавил(а) вас в экспедицию «${title}»`,
                    fromId: login,
                    fromName: window.currentUser.username
                });
            }
        } else {
            window.showToast('Не удалось сохранить экспедицию');
        }
    };

    // Применение настроек профиля к интерфейсу
    window.applyUserSettings = function() {
        if(!window.currentUser || !window.currentUser.settings) return;
        const s = window.currentUser.settings;
        if(s.theme) window.setTheme(s.theme, true);
        if(s.palette && window.setColorPalette) window.setColorPalette(s.palette, true);
        if(s.mapStyle) window.setMapStyle(s.mapStyle, true);
        if(s.mapProvider && window.setMapProvider) window.setMapProvider(s.mapProvider, true);
        if(s.lang) window.setLanguage(s.lang, true);
        if(s.guiScale) window.changeGUISize(s.guiScale, true);
        if (typeof s.uiSounds === 'boolean' && window.setUiSoundsEnabled) {
            window.setUiSoundsEnabled(s.uiSounds, true);
        }
    };

    // Сохранение настроек в базу
    window.saveUserSettings = function(key, value) {
        if(!window.currentUser) return;
        window.currentUser.settings[key] = value;
        localStorage.setItem('rosmap_user', JSON.stringify(window.currentUser));
        
        // Обновляем локальную базу, если это не админ
        if (window.currentUser.role !== 'admin') {
            let usersDb = JSON.parse(localStorage.getItem('rosmap_users_db')) || {};
            if (usersDb[window.currentUser.username.toLowerCase()]) {
                usersDb[window.currentUser.username.toLowerCase()].settings = window.currentUser.settings;
                localStorage.setItem('rosmap_users_db', JSON.stringify(usersDb));
            }
        }
    };

    window.toggleCabinet = function() {
        if (!window.currentUser) {
            window.openAuthModal();
        } else {
            window.openCabinet();
        }
    };

    window.refreshCabinetTabs = function() {
        const adminTab = document.getElementById('cab-tab-admin');
        const roleEl = document.getElementById('cabinet-user-role');
        const isAdmin = String(window.currentUser?.role || '').toLowerCase() === 'admin' || String(window.currentUser?.username || '').toLowerCase() === 'admin';

        if (adminTab) {
            if (isAdmin) {
                adminTab.classList.remove('hidden');
                adminTab.classList.remove('pointer-events-none');
            } else {
                adminTab.classList.add('hidden');
                adminTab.classList.add('pointer-events-none');
            }
        }

        if (roleEl) {
            if (isAdmin) {
                roleEl.textContent = 'Администратор системы';
                roleEl.className = 'text-[11px] font-bold text-red-500 uppercase tracking-wider';
            } else {
                roleEl.textContent = 'Рекордист';
                roleEl.className = 'text-[11px] font-bold text-slate-400 uppercase tracking-wider';
            }
        }
    };

    window.openCabinet = function() {
        if (window.openDockView) {
            if (window.playSfx) window.playSfx('open');
            window.openDockView('cabinet');
            return;
        }
        const m = document.getElementById('cabinet-modal');
        if (m) {
            m.classList.remove('hidden');
            void m.offsetWidth;
            m.classList.remove('opacity-0', 'pointer-events-none');
            m.firstElementChild.classList.remove('scale-95');
            if (window.playSfx) window.playSfx('open');
            window.refreshCabinetTabs();
            window.switchCabinetTab('sounds');
        }
    };

    window.openSettingsPanel = function() {
        const content = document.getElementById('cabinet-modal-content');
        if (content && content.classList.contains('cabinet-in-dock') && window.undockCabinetContent) {
            window.undockCabinetContent();
        } else if (window.closeCabinet) {
            const m = document.getElementById('cabinet-modal');
            if (m && !m.classList.contains('hidden') && !m.classList.contains('opacity-0')) {
                window.closeCabinet();
            }
        }
        if (window.openDockView) {
            if (window.playSfx) window.playSfx('open');
            window.openDockView('settings');
            return;
        }
        const m = document.getElementById('settings-modal');
        if (!m) return;
        m.classList.remove('hidden');
        void m.offsetWidth;
        m.classList.remove('opacity-0', 'pointer-events-none');
        m.firstElementChild.classList.remove('scale-95');
        if (window.playSfx) window.playSfx('open');
        window.refreshSettingsUI();
        if (window.renderRegionStats) window.renderRegionStats('region-stats-grid');
    };

    window.closeSettingsModal = function() {
        const content = document.getElementById('settings-modal-content');
        if (content && content.classList.contains('settings-in-dock')) {
            if (window.playSfx) window.playSfx('close');
            if (window.undockSettingsContent) window.undockSettingsContent();
            if (window.openDockView) window.openDockView(window.__sidebarTab || 'library');
            return;
        }
        const m = document.getElementById('settings-modal');
        if (!m) return;
        m.classList.add('opacity-0', 'pointer-events-none');
        m.firstElementChild.classList.add('scale-95');
        if (window.playSfx) window.playSfx('close');
        setTimeout(() => { if (m.classList.contains('opacity-0')) m.classList.add('hidden'); }, 300);
    };

    window.refreshSettingsUI = function() {
        const mapNormalBtn = document.getElementById('map-normal-btn');
        const mapMonoBtn = document.getElementById('map-mono-btn');
        const langSelect = document.getElementById('lang-select');
        const scaleButtons = document.querySelectorAll('[data-scale]');
        const themeSwitch = document.getElementById('theme-glass-switch');
        const sfxSwitch = document.getElementById('sfx-glass-switch');

        if (themeSwitch) {
            const isDark = window.currentTheme === 'dark';
            themeSwitch.setAttribute('aria-checked', isDark ? 'true' : 'false');
        }

        if (mapNormalBtn && mapMonoBtn) {
            const isMono = window.currentMapStyle === 'monochrome';
            mapNormalBtn.className = isMono ? 'glass-seg__btn' : 'glass-seg__btn is-active is-active--accent';
            mapMonoBtn.className = isMono ? 'glass-seg__btn is-active is-active--accent' : 'glass-seg__btn';
        }

        const mapYandexBtn = document.getElementById('map-provider-yandex-btn');
        const mapMapboxBtn = document.getElementById('map-provider-mapbox-btn');
        if (mapYandexBtn && mapMapboxBtn) {
            const isMapbox = window.currentMapProvider === 'mapbox';
            mapYandexBtn.className = isMapbox ? 'glass-seg__btn' : 'glass-seg__btn is-active is-active--accent';
            mapMapboxBtn.className = isMapbox ? 'glass-seg__btn is-active is-active--accent' : 'glass-seg__btn';
        }
        const tokenWrap = document.getElementById('mapbox-token-wrap');
        if (tokenWrap) tokenWrap.classList.toggle('hidden', window.currentMapProvider !== 'mapbox');
        const tokenInput = document.getElementById('mapbox-token-input');
        if (tokenInput && window.getMapboxToken && !tokenInput.matches(':focus')) {
            tokenInput.value = window.getMapboxToken() || '';
        }

        if (langSelect) {
            langSelect.value = window.currentLang || 'ru';
        }

        if (sfxSwitch) {
            const on = window.uiSoundsEnabled !== false;
            sfxSwitch.setAttribute('aria-checked', on ? 'true' : 'false');
        }

        scaleButtons.forEach(btn => {
            const size = btn.getAttribute('data-scale');
            const isActive = (window.currentGuiScale || 'medium') === size;
            btn.className = isActive
                ? 'glass-seg__btn is-active is-active--accent'
                : 'glass-seg__btn';
        });

        document.querySelectorAll('#palette-picker [data-palette-id]').forEach(btn => {
            const on = btn.getAttribute('data-palette-id') === (window.currentPalette || 'coral');
            btn.classList.toggle('is-active', on);
            btn.setAttribute('aria-checked', on ? 'true' : 'false');
        });
    };

    window.openSupportModal = function() {
        window.contactSupport();
    };

    window.contactSupport = function() {
        if (window.closeSettingsModal) window.closeSettingsModal();
        if (window.closeCabinet) window.closeCabinet();
        if (window.closeSupportModal) window.closeSupportModal();
        const items = [];
        if (window.currentUser) {
            items.push({
                icon: 'fa-comments',
                label: 'Написать в сообщениях',
                onClick: () => {
                    if (window.openMessagesModal) window.openMessagesModal(window.SUPPORT_LOGIN || 'support');
                }
            });
        } else {
            items.push({
                icon: 'fa-right-to-bracket',
                label: 'Войти и открыть чат поддержки',
                onClick: () => { if (window.openAuthModal) window.openAuthModal(); }
            });
        }
        items.push({
            icon: 'fa-envelope',
            label: 'Написать на почту',
            onClick: () => {
                window.location.href = 'mailto:help@rosmap.local?subject=' + encodeURIComponent('Поддержка RO·SMap');
            }
        });
        if (window.ActionSheet) window.ActionSheet.open(items);
        else window.location.href = 'mailto:help@rosmap.local';
    };

    window.closeSupportModal = function() {
        const m = document.getElementById('support-modal');
        if (!m) return;
        m.classList.add('opacity-0', 'pointer-events-none');
        m.firstElementChild.classList.add('scale-95');
        setTimeout(() => { if (m.classList.contains('opacity-0')) m.classList.add('hidden'); }, 300);
    };

    window.uploadProfilePhoto = function(files) {
        if (!files || !files[0]) return;
        const file = files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            const avatar = document.getElementById('cabinet-avatar');
            const fallback = document.getElementById('cabinet-avatar-fallback');
            if (avatar) {
                avatar.src = e.target.result;
                avatar.classList.remove('hidden');
            }
            if (fallback) fallback.classList.add('hidden');
            window.currentUser = window.currentUser || {};
            if (window.saveMyProfile) window.saveMyProfile({ avatar: e.target.result });
            else { window.currentUser.avatar = e.target.result; localStorage.setItem('rosmap_user', JSON.stringify(window.currentUser)); }
            window.showToast('Фото профиля обновлено');
        };
        reader.readAsDataURL(file);
    };

    window.changePassword = function() {
        const currentPassword = document.getElementById('cab-current-password')?.value || '';
        const newPassword = document.getElementById('cab-new-password')?.value || '';
        const confirmPassword = document.getElementById('cab-confirm-password')?.value || '';

        if (!newPassword || !confirmPassword) {
            return window.showToast('Заполните поля нового пароля');
        }

        if (newPassword !== confirmPassword) {
            return window.showToast('Новые пароли не совпадают');
        }

        if (!window.currentUser) {
            return window.showToast('Сначала войдите в профиль');
        }

        const userKey = String(window.currentUser.loginName || window.currentUser.username || '').toLowerCase();
        let usersDb = JSON.parse(localStorage.getItem('rosmap_users_db')) || {};

        if (window.currentUser.role === 'admin' || userKey === 'admin') {
            if (currentPassword && currentPassword !== 'Скай') {
                return window.showToast('Текущий пароль неверен');
            }
        } else {
            if (!usersDb[userKey] || usersDb[userKey].password !== currentPassword) {
                return window.showToast('Текущий пароль неверен');
            }
        }

        if (window.currentUser.role !== 'admin' && userKey !== 'admin') {
            usersDb[userKey] = usersDb[userKey] || {};
            usersDb[userKey].password = newPassword;
            localStorage.setItem('rosmap_users_db', JSON.stringify(usersDb));
        }

        window.currentUser.password = newPassword;
        localStorage.setItem('rosmap_user', JSON.stringify(window.currentUser));
        if (document.getElementById('cab-current-password')) document.getElementById('cab-current-password').value = '';
        if (document.getElementById('cab-new-password')) document.getElementById('cab-new-password').value = '';
        if (document.getElementById('cab-confirm-password')) document.getElementById('cab-confirm-password').value = '';
        window.showToast('Пароль успешно обновлён');
    };

    window.closeCabinet = function() {
        const content = document.getElementById('cabinet-modal-content');
        if (content && content.classList.contains('cabinet-in-dock')) {
            if (window.playSfx) window.playSfx('close');
            if (window.undockCabinetContent) window.undockCabinetContent();
            if (window.__dockView === 'cabinet' && window.openDockView) {
                window.openDockView(window.__sidebarTab || 'library');
            }
            return;
        }
        const m = document.getElementById('cabinet-modal');
        if(m) {
            const wasOpen = !m.classList.contains('hidden') && !m.classList.contains('opacity-0');
            m.classList.add('opacity-0', 'pointer-events-none');
            m.firstElementChild.classList.add('scale-95');
            if (wasOpen && window.playSfx) window.playSfx('close');
            setTimeout(() => { if(m.classList.contains('opacity-0')) m.classList.add('hidden') }, 300);
        }
    };

    window.switchCabinetTab = function(tab) {
        const tabs = document.querySelectorAll('#cabinet-tabs [data-cab-tab]');
        const panels = document.querySelectorAll('[data-cab-panel]');
        if (!tabs.length) return;

        tabs.forEach(btn => {
            const on = btn.dataset.cabTab === tab;
            btn.classList.toggle('active', on);
            if (on && !btn.classList.contains('hidden')) {
                // Прокрутить активную вкладку в видимую область (мобильный bar)
                try { btn.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' }); } catch (_) {}
            }
        });

        panels.forEach(panel => {
            panel.classList.toggle('hidden', panel.dataset.cabPanel !== tab);
        });

        if (tab === 'sounds') {
            window.renderCabinet();
        } else if (tab === 'sessions') {
            if (window.renderSessionsPanel) window.renderSessionsPanel();
        } else if (tab === 'analytics') {
            if (window.renderMyAnalytics) window.renderMyAnalytics();
        } else if (tab === 'settings') {
            if (window.fillProfileSettingsForm) window.fillProfileSettingsForm();
        } else if (tab === 'admin') {
            const adminBtn = document.getElementById('cab-tab-admin');
            if (adminBtn && adminBtn.classList.contains('hidden')) {
                window.switchCabinetTab('sounds');
                return;
            }
            if (window.switchAdminSection) window.switchAdminSection(window.__adminSection || 'sounds');
            else {
                window.renderAdminList();
                window.renderAdminUsersList();
                window.renderReportsList();
                if (window.renderRegionStats) window.renderRegionStats('admin-stats-grid');
            }
        }
    };

    window.parseDuration = function(durStr) {
        if(!durStr) return 0;
        const parts = durStr.split(':').map(Number);
        if(parts.length === 2) return (parts[0] * 60) + parts[1];
        if(parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
        return 0;
    };

    window.formatTotalDuration = function(totalSeconds) {
        if (isNaN(totalSeconds) || totalSeconds === 0) return "0:00";
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = Math.floor(totalSeconds % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    window.STATUS_LABELS = {
        published: { label: 'Опубликовано', cls: 'pub-status-published' },
        pending: { label: 'На модерации', cls: 'pub-status-pending' },
        rejected: { label: 'Отклонено', cls: 'pub-status-rejected' },
        draft: { label: 'Черновик', cls: 'pub-status-draft' }
    };

    window.renderCabinet = function() {
        if(!window.currentUser) return;

        const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        document.getElementById('cabinet-user-name').textContent = window.currentUser.username;
        const joinedEl = document.getElementById('cabinet-user-joined');
        const joinedDate = window.currentUser.joinedAt ? new Date(window.currentUser.joinedAt) : null;
        if (joinedEl) joinedEl.innerHTML = `<i class="fa-solid fa-calendar-days"></i>${joinedDate && !isNaN(joinedDate) ? joinedDate.toLocaleDateString('ru-RU') : new Date().toLocaleDateString('ru-RU')}`;

        const mySounds = window.getUserSounds(login, window.currentUser.username, { includeAllStatuses: true });

        const statsEl = document.getElementById('cabinet-user-stats');
        if (statsEl) statsEl.innerHTML = `<i class="fa-solid fa-microphone"></i>${mySounds.length} звуков`;

        const avatar = document.getElementById('cabinet-avatar');
        const fallback = document.getElementById('cabinet-avatar-fallback');
        if (window.currentUser.avatar) {
            if (avatar) {
                avatar.src = window.currentUser.avatar;
                avatar.classList.remove('hidden');
            }
            if (fallback) fallback.classList.add('hidden');
        } else {
            if (avatar) avatar.classList.add('hidden');
            if (fallback) fallback.classList.remove('hidden');
        }
        
        window.refreshCabinetTabs();

        document.getElementById('cabinet-stat-count').textContent = mySounds.length;
        
        let totalSecs = 0;
        mySounds.forEach(s => totalSecs += window.parseDuration(s.duration));
        document.getElementById('cabinet-stat-duration').textContent = window.formatTotalDuration(totalSecs);
        
        const list = document.getElementById('cabinet-sounds-list');
        if(mySounds.length === 0) {
            list.innerHTML = `<div class="text-center py-12 text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm"><i class="fa-solid fa-microphone-slash text-4xl mb-3 opacity-30 block"></i><p class="font-medium text-sm">Вы еще не загрузили ни одного звука.</p><p class="text-xs mt-1">Опубликованные вами звуки появятся здесь.</p></div>`;
            return;
        }

        const mySessions = window.getMySessions ? window.getMySessions() : [];
        const sessionOptions = sel => '<option value="">Без сессии</option>' +
            mySessions.map(sess => `<option value="${sess.id}" ${sel === sess.id ? 'selected' : ''}>${sess.title}</option>`).join('');

        // "Уведомление о новых статусах": если админ поменял статус записи с момента последнего
        // визита в кабинет (seenByAuthor === false), показываем тост один раз и гасим флаг.
        const unseen = mySounds.filter(s => s.seenByAuthor === false);
        if (unseen.length > 0) {
            window.showToast(`Обновился статус ${unseen.length} ${unseen.length === 1 ? 'записи' : 'записей'}`);
            const updatedCloud = [...window.cloudDataCache];
            unseen.forEach(s => {
                s.seenByAuthor = true;
                const idx = updatedCloud.findIndex(x => x.id === s.id);
                if (idx >= 0) updatedCloud[idx] = { ...updatedCloud[idx], seenByAuthor: true };
                else updatedCloud.push(s);
            });
            window.syncCloudData(updatedCloud);
        }

        list.innerHTML = mySounds.map(s => {
            const isHardcoded = window.rawSoundsData.map(r => r.id).includes(s.id);
            const st = window.STATUS_LABELS[s.status] || window.STATUS_LABELS.published;
            return `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow gap-3">
                <div class="flex items-center gap-3 overflow-hidden">
                    <button onclick="window.selectSound('${s.id}'); window.closeCabinet();" class="w-10 h-10 rounded-full bg-blue-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 hover:scale-105 transition-transform" title="Воспроизвести на карте">
                        <i class="fa-solid fa-play text-sm translate-x-[1px] pointer-events-none"></i>
                    </button>
                    <div class="flex-1 min-w-0 pr-2">
                        <p class="text-sm font-bold text-slate-800 dark:text-white truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400" onclick="window.selectSound('${s.id}'); window.closeCabinet(); window.openDetailsModal();">${s.title}</p>
                        <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span class="pub-status-pill ${st.cls}">${st.label}</span>
                            <span class="text-[10px] text-slate-500 font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded truncate max-w-[120px] sm:max-w-none">${s.fileName}</span>
                            ${isHardcoded ? `<span class="text-[8px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded uppercase tracking-wider">Вшито</span>` : ''}
                        </div>
                        ${s.status === 'rejected' && s.rejectionReason ? `<p class="text-[11px] text-red-600 dark:text-red-400 mt-1 leading-snug"><i class="fa-solid fa-circle-exclamation mr-1"></i>${s.rejectionReason}</p>` : ''}
                        <select onchange="window.assignSoundToSession('${s.id}', this.value)" class="mt-1.5 text-[10px] font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 px-1.5 py-1 max-w-[180px]" title="Привязать к экспедиции">
                            ${sessionOptions(s.sessionId)}
                        </select>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0 sm:pr-2">
                    <button onclick="window.editSound('${s.id}'); window.closeCabinet();" class="flex-1 sm:flex-none sm:w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors shadow-sm font-bold text-xs" title="Редактировать">
                        <i class="fa-solid fa-pen sm:mr-0 mr-1"></i> <span class="sm:hidden">Изменить</span>
                    </button>
                    <button onclick="window.deleteSoundFromCloud('${s.id}')" class="flex-1 sm:flex-none sm:w-9 h-9 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 flex items-center justify-center transition-colors shadow-sm font-bold text-xs" title="Удалить">
                        <i class="fa-solid fa-trash-can sm:mr-0 mr-1"></i> <span class="sm:hidden">Удалить</span>
                    </button>
                </div>
            </div>
        `}).join('');
    };

    // Переключатель "Все записи / На модерации" превращает список в полноценную очередь ревью.
    window.__adminListFilter = window.__adminListFilter || 'all';
    window.setAdminListFilter = function(mode) {
        window.__adminListFilter = mode;
        const btnAll = document.getElementById('admin-filter-btn-all');
        const btnPending = document.getElementById('admin-filter-btn-pending');
        if (btnAll) btnAll.classList.toggle('active', mode === 'all');
        if (btnPending) btnPending.classList.toggle('active', mode === 'pending');
        window.renderAdminList();
    };

    window.renderAdminList = function() {
        const list = document.getElementById('admin-sounds-list');
        if(!list) return;

        const rawIds = window.rawSoundsData.map(s => s.id);
        const pendingCount = window.soundsData.filter(s => s.status === 'pending').length;
        const countEl = document.getElementById('admin-filter-pending-count');
        if (countEl) countEl.textContent = pendingCount;
        if (window.assignArchiveNumbers) window.assignArchiveNumbers();

        const filterMode = window.__adminListFilter || 'all';
        const sounds = filterMode === 'pending' ? window.soundsData.filter(s => s.status === 'pending') : window.soundsData;

        if (!sounds.length) {
            list.innerHTML = `<div class="text-center py-10 text-slate-400"><i class="fa-solid fa-clipboard-check text-3xl mb-2 opacity-30 block"></i><p class="text-sm font-medium">Очередь модерации пуста.</p></div>`;
            return;
        }

        list.innerHTML = sounds.map(s => {
            const isHardcoded = rawIds.includes(s.id);
            const status = s.status || 'published';
            const isPending = status === 'pending';
            const num = s.archiveNum || '—';
            const statusLabel = ({ published: 'Опубликовано', pending: 'На модерации', rejected: 'Отклонено', draft: 'Черновик' })[status] || status;
            return `
                <div class="admin-entity-row">
                    <button type="button" class="admin-entity-main min-w-0 flex-1 text-left" onclick="window.openedFromAdmin=true; window.closeCabinet(); window.selectSound('${s.id}'); window.openDetailsModal();">
                        <p class="admin-entity-num">№ ${num}${isHardcoded ? ' · вшито' : ''}</p>
                        <p class="admin-entity-title">${s.title || 'Без названия'}</p>
                        <p class="admin-entity-meta">${s.fileName || ''} · ${s.recordist || 'Автор'} · ${statusLabel}</p>
                        ${status === 'rejected' && s.rejectionReason ? `<p class="text-[11px] text-red-500 mt-0.5 line-clamp-2"><i class="fa-solid fa-circle-exclamation mr-1"></i>${s.rejectionReason}</p>` : ''}
                    </button>
                    <button type="button" onclick="event.stopPropagation(); window.openAdminSoundActions('${s.id}')" class="admin-actions-btn shrink-0"><i class="fa-solid fa-ellipsis"></i> Действия</button>
                </div>
            `;
        }).join('');
    };

    window.openAdminSoundActions = function(soundId) {
        const s = window.soundsData.find(x => x.id === soundId);
        if (!s) return;
        const status = s.status || 'published';
        const items = [
            { icon: 'fa-eye', label: 'Просмотреть', tone: 'primary', onClick: () => { window.openedFromAdmin = true; window.closeCabinet(); window.selectSound(soundId); window.openDetailsModal(); } },
            { icon: 'fa-pen', label: 'Изменить', tone: 'primary', onClick: () => { window.openedFromAdmin = true; window.editSound(soundId); window.closeCabinet(); } }
        ];
        if (status === 'pending') {
            items.push({ icon: 'fa-check', label: 'Одобрить', tone: 'success', onClick: () => window.setSoundStatus(soundId, 'published') });
            items.push({ icon: 'fa-xmark', label: 'Отклонить', tone: 'danger', onClick: () => window.setSoundStatus(soundId, 'rejected') });
        } else {
            if (status !== 'published') items.push({ icon: 'fa-check', label: 'Опубликовать', tone: 'success', onClick: () => window.setSoundStatus(soundId, 'published') });
            if (status !== 'pending') items.push({ icon: 'fa-clock', label: 'На модерацию', tone: 'warning', onClick: () => window.setSoundStatus(soundId, 'pending') });
            if (status !== 'rejected') items.push({ icon: 'fa-ban', label: 'Отклонить', tone: 'danger', onClick: () => window.setSoundStatus(soundId, 'rejected') });
        }
        items.push({ icon: 'fa-trash', label: 'Удалить', tone: 'danger', onClick: () => window.deleteSoundFromCloud(soundId) });
        window.ActionSheet.open(items);
    };

    window.openDetailsAdminActions = function() {
        const id = window.currentPlayingId;
        if (!id) return;
        const s = window.soundsData.find(x => x.id === id);
        if (!s) return;
        const status = s.status || 'published';
        const items = [
            { icon: 'fa-pen', label: 'Изменить', tone: 'primary', onClick: () => { window.closeDetailsModal(); window.editSound(id); } },
            { icon: 'fa-clock', label: 'Вернуть на модерацию', tone: 'warning', onClick: () => window.setSoundStatus(id, 'pending') },
            { icon: 'fa-trash', label: 'Удалить', tone: 'danger', onClick: () => window.deleteSoundFromCloud(id) }
        ];
        if (status === 'pending') {
            items.splice(1, 1,
                { icon: 'fa-check', label: 'Одобрить', tone: 'success', onClick: () => window.setSoundStatus(id, 'published') },
                { icon: 'fa-xmark', label: 'Отклонить', tone: 'danger', onClick: () => window.setSoundStatus(id, 'rejected') }
            );
        }
        window.ActionSheet.open(items);
    };

    // Смена статуса модерации прямо из списка админки (без открытия полной формы редактирования).
    // При отклонении запрашиваем причину — она попадёт в дэшборд автора как уведомление.
    window.setSoundStatus = async function(id, status) {
        const s = window.soundsData.find(x => x.id === id);
        if (!s) return;

        let reason = s.rejectionReason || '';
        if (status === 'rejected') {
            const input = await window.CustomUI.open({
                title: '<i class="fa-solid fa-circle-exclamation mr-2 text-red-500"></i>Причина отклонения',
                message: 'Она будет показана автору записи в его личном кабинете.',
                confirmText: 'Отклонить',
                confirmClass: 'px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-md',
                showInput: true,
                inputPlaceholder: 'Например: неверные координаты записи'
            });
            if (input === false) { window.renderAdminList(); return; }
            reason = input;
        } else {
            reason = '';
        }

        s.status = status;
        s.rejectionReason = reason;
        s.seenByAuthor = false;
        const updatedCloud = [...window.cloudDataCache];
        const idx = updatedCloud.findIndex(x => x.id === id);
        if (idx >= 0) updatedCloud[idx] = { ...updatedCloud[idx], status, rejectionReason: reason, seenByAuthor: false };
        else updatedCloud.push(s);
        const success = await window.syncCloudData(updatedCloud);
        if (success) {
            window.showToast('Статус обновлён');
            window.renderAdminList();
            if (s.recordistId && window.pushNotifications) {
                const adminLogin = window.currentUser?.loginName || 'admin';
                if (status === 'published') {
                    window.pushNotifications([s.recordistId], {
                        type: 'moderation',
                        text: `Ваша запись «${s.title}» одобрена и опубликована`,
                        fromId: adminLogin,
                        fromName: window.currentUser?.username || 'Администратор',
                        soundId: s.id,
                        soundTitle: s.title
                    });
                    if (window.notifyFollowersAboutNewSound) window.notifyFollowersAboutNewSound(s);
                } else if (status === 'rejected') {
                    window.pushNotifications([s.recordistId], {
                        type: 'moderation',
                        text: `Ваша запись «${s.title}» отклонена${reason ? ': ' + reason : ''}`,
                        fromId: adminLogin,
                        fromName: window.currentUser?.username || 'Администратор',
                        soundId: s.id,
                        soundTitle: s.title
                    });
                }
            }
        }
    };

    // --- Жалобы (на записи и на комментарии) — очередь модерации в админ-панели ---
    window.__adminSection = 'sounds';

    window.switchAdminSection = function(section) {
        window.__adminSection = section || 'sounds';
        ['sounds', 'reports', 'users'].forEach(key => {
            const panel = document.getElementById(`admin-section-${key}`);
            const btn = document.getElementById(`admin-tab-btn-${key}`);
            if (panel) panel.classList.toggle('hidden', key !== window.__adminSection);
            if (btn) btn.classList.toggle('active', key === window.__adminSection);
        });
        if (window.__adminSection === 'reports') window.renderReportsList();
        if (window.__adminSection === 'users') window.renderAdminUsersList();
        if (window.__adminSection === 'sounds') {
            if (window.renderAdminList) window.renderAdminList();
            if (window.renderRegionStats) window.renderRegionStats('admin-stats-grid');
        }
    };

    window.getAllReports = function() {
        const list = [];
        (window.soundsData || []).forEach(s => {
            (s.reports || []).forEach(r => list.push({ ...r, soundId: s.id, soundTitle: s.title, number: r.number }));
        });
        return list.sort((a, b) => new Date(b.date) - new Date(a.date));
    };

    window.getNextReportNumber = function() {
        let max = 0;
        (window.soundsData || []).forEach(s => {
            (s.reports || []).forEach(r => {
                const n = Number(r.number) || 0;
                if (n > max) max = n;
            });
        });
        return max + 1;
    };

    window.assignMissingReportNumbers = function() {
        const items = [];
        (window.soundsData || []).forEach(s => {
            (s.reports || []).forEach(r => items.push(r));
        });
        items.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
        let max = 0;
        items.forEach(r => {
            const n = Number(r.number) || 0;
            if (n > max) max = n;
        });
        items.forEach(r => {
            if (!r.number) {
                max += 1;
                r.number = max;
            }
        });
    };

    window.renderReportsList = function() {
        const container = document.getElementById('admin-reports-list');
        const countEl = document.getElementById('admin-reports-count');
        const tabCount = document.getElementById('admin-tab-reports-count');
        if (!container) return;

        window.assignMissingReportNumbers();
        const reports = window.getAllReports();
        const pendingCount = reports.filter(r => r.status !== 'resolved').length;
        if (countEl) countEl.textContent = pendingCount ? `(${pendingCount})` : '';
        if (tabCount) tabCount.textContent = pendingCount ? `(${pendingCount})` : '';

        if (!reports.length) {
            container.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">Жалоб пока нет.</p>`;
            return;
        }

        container.innerHTML = reports.map(r => {
            const reasonShort = String(r.reason || '').length > 90
                ? String(r.reason).slice(0, 90) + '…'
                : (r.reason || '');
            const dateStr = r.date ? new Date(r.date).toLocaleDateString('ru-RU') : '';
            const num = r.number || '—';
            return `
            <div class="admin-entity-row ${r.status === 'resolved' ? 'is-muted' : ''}">
                <button type="button" class="admin-entity-main min-w-0 flex-1 text-left" onclick="window.openReportDetail('${r.soundId}', '${r.id}')">
                    <p class="admin-entity-num">Жалоба № ${num}${r.status === 'resolved' ? ' · решено' : ''}</p>
                    <p class="admin-entity-title">${r.type === 'comment' ? 'На комментарий' : 'На запись'} · ${r.soundTitle || ''}</p>
                    <p class="admin-entity-meta">От ${r.reporterName || 'аноним'} · ${dateStr}</p>
                    <p class="text-[11px] text-red-500 dark:text-red-400 mt-1 line-clamp-2"><i class="fa-solid fa-quote-left mr-1 opacity-60"></i>${reasonShort}</p>
                </button>
                <button type="button" onclick="event.stopPropagation(); window.openAdminReportActions('${r.soundId}', '${r.id}')" class="admin-actions-btn shrink-0"><i class="fa-solid fa-ellipsis"></i> Действия</button>
            </div>`;
        }).join('');
    };

    window.openReportDetail = function(soundId, reportId) {
        const s = window.soundsData.find(x => x.id === soundId);
        const r = s ? (s.reports || []).find(x => x.id === reportId) : null;
        if (!r) return;
        window.__activeReport = { soundId, reportId };
        const title = document.getElementById('report-detail-title');
        const body = document.getElementById('report-detail-body');
        if (title) title.innerHTML = `<i class="fa-solid fa-flag mr-2 text-red-500"></i>Жалоба № ${r.number || '—'}`;
        let targetText = '';
        if (r.type === 'comment') {
            const c = s ? (s.comments || []).find(x => x.id === r.commentId) : null;
            targetText = c ? `Комментарий: «${c.text}»` : 'Комментарий уже удалён';
        }
        if (body) {
            body.innerHTML = `
                <div class="space-y-3 text-sm">
                    <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                        <p class="text-[10px] font-bold uppercase text-slate-400 mb-1">Объект</p>
                        <p class="font-semibold text-slate-800 dark:text-slate-100">${r.type === 'comment' ? 'Комментарий к записи' : 'Запись'} «${s?.title || r.soundTitle || ''}»</p>
                        ${targetText ? `<p class="text-xs text-slate-500 mt-1">${targetText}</p>` : ''}
                    </div>
                    <div class="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40">
                        <p class="text-[10px] font-bold uppercase text-red-400 mb-1">Текст жалобы</p>
                        <p class="text-slate-800 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">${r.reason || '—'}</p>
                    </div>
                    <p class="text-[11px] text-slate-400">От ${r.reporterName || 'аноним'} · ${r.date ? new Date(r.date).toLocaleString('ru-RU') : ''} · ${r.status === 'resolved' ? 'Решено' : 'Открыта'}</p>
                </div>`;
        }
        const m = document.getElementById('report-detail-modal');
        const c = document.getElementById('report-detail-modal-content');
        if (!m || !c) return;
        m.classList.remove('hidden');
        void m.offsetWidth;
        m.classList.remove('opacity-0', 'pointer-events-none');
        c.classList.remove('scale-95');
    };

    window.closeReportDetailModal = function() {
        const m = document.getElementById('report-detail-modal');
        const c = document.getElementById('report-detail-modal-content');
        if (!m || !c) return;
        m.classList.add('opacity-0', 'pointer-events-none');
        c.classList.add('scale-95');
        setTimeout(() => { if (m.classList.contains('opacity-0')) m.classList.add('hidden'); }, 300);
        window.__activeReport = null;
    };

    window.openAdminReportActions = function(soundId, reportId) {
        const s = window.soundsData.find(x => x.id === soundId);
        const r = s ? (s.reports || []).find(x => x.id === reportId) : null;
        if (!r) return;
        const items = [
            { icon: 'fa-eye', label: 'Открыть текст жалобы', tone: 'primary', onClick: () => window.openReportDetail(soundId, reportId) },
            { icon: 'fa-music', label: 'Просмотреть запись', tone: 'primary', onClick: () => { window.closeReportDetailModal(); window.openedFromAdmin = true; window.closeCabinet(); window.selectSound(soundId); window.openDetailsModal(); } }
        ];
        if (r.type === 'comment' && s && (s.comments || []).some(c => c.id === r.commentId)) {
            items.push({ icon: 'fa-trash', label: 'Удалить комментарий', tone: 'danger', onClick: () => window.deleteReportedComment(soundId, r.commentId, reportId) });
        }
        if (r.status !== 'resolved') {
            items.push({ icon: 'fa-check', label: 'Отметить решённой', tone: 'success', onClick: () => window.resolveReport(soundId, reportId) });
        }
        window.ActionSheet.open(items);
    };

    window.openReportDetailActions = function() {
        const ctx = window.__activeReport;
        if (!ctx) return;
        window.openAdminReportActions(ctx.soundId, ctx.reportId);
    };

    window.resolveReport = async function(soundId, reportId) {
        const s = window.soundsData.find(x => x.id === soundId);
        if (!s) return;
        const r = (s.reports || []).find(x => x.id === reportId);
        if (!r) return;
        r.status = 'resolved';
        const updatedCloud = [...window.cloudDataCache];
        const idx = updatedCloud.findIndex(x => x.id === soundId);
        if (idx >= 0) updatedCloud[idx] = s; else updatedCloud.push(s);
        const success = await window.syncCloudData(updatedCloud);
        if (success) { window.showToast('Жалоба отмечена решённой'); window.renderReportsList(); window.closeReportDetailModal(); }
    };

    window.deleteReportedComment = async function(soundId, commentId, reportId) {
        const s = window.soundsData.find(x => x.id === soundId);
        if (!s) return;
        const confirmed = await window.CustomUI.open({
            title: '<i class="fa-solid fa-trash-can mr-2 text-red-500"></i>Удалить комментарий?',
            message: 'Комментарий и все ответы к нему будут удалены без возможности восстановления.',
            confirmText: 'Удалить',
            confirmClass: 'px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-md'
        });
        if (!confirmed) return;

        s.comments = (s.comments || []).filter(c => c.id !== commentId);
        (s.reports || []).forEach(r => { if (r.id === reportId) r.status = 'resolved'; });

        const updatedCloud = [...window.cloudDataCache];
        const idx = updatedCloud.findIndex(x => x.id === soundId);
        if (idx >= 0) updatedCloud[idx] = s; else updatedCloud.push(s);
        const success = await window.syncCloudData(updatedCloud);
        if (success) { window.showToast('Комментарий удалён'); window.renderReportsList(); window.closeReportDetailModal(); if (window.renderComments) window.renderComments(s); }
    };

    // --- Профили пользователей внутри админ-панели: бейджи, роли, блокировки, сводка ---
    window.renderAdminUsersList = function() {
        const el = document.getElementById('admin-users-grid');
        if (!el) return;
        const profiles = window.profilesData || [];
        if (!profiles.length) {
            el.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">Пока нет зарегистрированных профилей.</p>`;
            return;
        }
        el.innerHTML = profiles.map(p => {
            const isAdmin = p.role === 'admin' || p.loginName === 'admin';
            const isBlocked = !!p.blocked;
            const badgeCount = (p.badges || []).length;
            return `
            <div class="admin-entity-row ${isBlocked ? 'is-muted' : ''}">
                <div class="admin-entity-main min-w-0 flex-1">
                    <div class="admin-user-row-name flex items-center gap-2">
                        ${p.avatar ? `<img src="${p.avatar}" class="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-600" alt="">` : `<i class="fa-solid fa-user-astronaut opacity-60"></i>`}
                        <span class="truncate">${p.displayName || p.loginName}</span>
                        ${isAdmin ? `<span class="pub-status-pill pub-status-pending">Админ</span>` : ''}
                        ${isBlocked ? `<span class="pub-status-pill pub-status-rejected">Блок</span>` : ''}
                    </div>
                    <p class="admin-entity-meta mt-0.5">@${p.loginName}${p.joinedAt ? ' · рег. ' + new Date(p.joinedAt).toLocaleDateString('ru-RU') : ''}${badgeCount ? ` · ${badgeCount} зван.` : ''}</p>
                </div>
                <button type="button" onclick="window.openAdminUserActions('${p.loginName}')" class="admin-actions-btn shrink-0"><i class="fa-solid fa-ellipsis"></i> Действия</button>
            </div>`;
        }).join('');
    };

    window.openAdminUserActions = function(login) {
        const p = window.getProfileByLogin ? window.getProfileByLogin(login) : null;
        if (!p) return;
        const isAdmin = p.role === 'admin' || p.loginName === 'admin';
        const isBlocked = !!p.blocked;
        const items = [
            { icon: 'fa-medal', label: 'Звания', tone: 'warning', onClick: () => window.openBadgeAssignModal(login) },
            { icon: 'fa-chart-simple', label: 'Сводка', tone: 'primary', onClick: () => window.openUserActivityModal(login) }
        ];
        if (login !== 'admin') {
            items.push({ icon: 'fa-user-shield', label: isAdmin ? 'Снять админа' : 'Сделать админом', tone: 'primary', onClick: () => window.setUserAdminRole(login, !isAdmin) });
            items.push({ icon: 'fa-ban', label: isBlocked ? 'Разблокировать' : 'Заблокировать', tone: isBlocked ? 'success' : 'danger', onClick: () => window.setUserBlocked(login, !isBlocked) });
        }
        window.ActionSheet.open(items);
    };

    window.__badgeAssignLogin = null;

    window.openBadgeAssignModal = function(login) {
        window.__badgeAssignLogin = login;
        const profile = window.getProfileByLogin ? window.getProfileByLogin(login) : null;
        const userEl = document.getElementById('badge-assign-user');
        const list = document.getElementById('badge-assign-list');
        if (userEl) userEl.textContent = `@${login}${profile?.displayName ? ' · ' + profile.displayName : ''}`;
        if (list) {
            const badges = new Set(profile?.badges || []);
            list.innerHTML = Object.entries(window.BADGE_CATALOG || {}).map(([key, b]) => `
                <label class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/40 ${badges.has(key) ? 'ring-2 ring-amber-400/60' : ''}">
                    <input type="checkbox" class="accent-amber-500" ${badges.has(key) ? 'checked' : ''} onchange="window.toggleUserBadge('${login}', '${key}', this.checked)">
                    <span class="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center shrink-0"><i class="fa-solid ${b.icon}"></i></span>
                    <span class="text-sm font-bold text-slate-700 dark:text-slate-200">${b.label}</span>
                </label>
            `).join('');
        }
        const m = document.getElementById('badge-assign-modal');
        const c = document.getElementById('badge-assign-modal-content');
        if (!m || !c) return;
        m.classList.remove('hidden');
        void m.offsetWidth;
        m.classList.remove('opacity-0', 'pointer-events-none');
        c.classList.remove('scale-95');
    };

    window.closeBadgeAssignModal = function() {
        const m = document.getElementById('badge-assign-modal');
        const c = document.getElementById('badge-assign-modal-content');
        if (!m || !c) return;
        m.classList.add('opacity-0', 'pointer-events-none');
        c.classList.add('scale-95');
        setTimeout(() => { if (m.classList.contains('opacity-0')) m.classList.add('hidden'); }, 300);
        window.__badgeAssignLogin = null;
        if (window.renderAdminUsersList) window.renderAdminUsersList();
    };

    window.toggleUserBadge = async function(login, badgeKey, checked) {
        const updated = [...(window.profilesData || [])];
        const idx = updated.findIndex(p => p.loginName === login);
        if (idx < 0) return;
        const badges = new Set(updated[idx].badges || []);
        if (checked) badges.add(badgeKey); else badges.delete(badgeKey);
        updated[idx] = {
            ...updated[idx],
            badges: Array.from(badges),
            profileUpdatedAt: new Date().toISOString()
        };
        const success = await window.syncProfilesData(updated);
        if (success) {
            window.showToast('Бейджи обновлены');
            if (window.__badgeAssignLogin === login) {
                const profile = window.getProfileByLogin ? window.getProfileByLogin(login) : null;
                const list = document.getElementById('badge-assign-list');
                if (list) {
                    const badges = new Set(profile?.badges || []);
                    list.innerHTML = Object.entries(window.BADGE_CATALOG || {}).map(([key, b]) => `
                        <label class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/40 ${badges.has(key) ? 'ring-2 ring-amber-400/60' : ''}">
                            <input type="checkbox" class="accent-amber-500" ${badges.has(key) ? 'checked' : ''} onchange="window.toggleUserBadge('${login}', '${key}', this.checked)">
                            <span class="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center shrink-0"><i class="fa-solid ${b.icon}"></i></span>
                            <span class="text-sm font-bold text-slate-700 dark:text-slate-200">${b.label}</span>
                        </label>
                    `).join('');
                }
            } else if (window.renderAdminUsersList) {
                window.renderAdminUsersList();
            }
            if (checked && window.pushNotifications) {
                const badgeMeta = (window.BADGE_CATALOG && window.BADGE_CATALOG[badgeKey]) || { label: badgeKey };
                const adminLogin = window.currentUser?.loginName || 'admin';
                window.pushNotifications([login], {
                    type: 'badge',
                    text: `Вам присвоен бейдж «${badgeMeta.label}»`,
                    fromId: adminLogin,
                    fromName: window.currentUser?.username || 'Администратор'
                });
            }
        }
    };

    window.setUserBlocked = async function(login, blocked) {
        if (login === 'admin') return;
        const updated = [...(window.profilesData || [])];
        const idx = updated.findIndex(p => p.loginName === login);
        if (idx < 0) return;
        const confirmed = await window.CustomUI.open({
            title: blocked ? '<i class="fa-solid fa-ban mr-2 text-red-500"></i>Заблокировать?' : 'Разблокировать?',
            message: blocked ? `Пользователь @${login} не сможет войти в аккаунт.` : `Пользователь @${login} снова сможет войти.`,
            confirmText: blocked ? 'Заблокировать' : 'Разблокировать',
            confirmClass: blocked
                ? 'px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-md'
                : 'px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-md'
        });
        if (!confirmed) return;
        updated[idx] = { ...updated[idx], blocked: !!blocked, profileUpdatedAt: new Date().toISOString() };
        const success = await window.syncProfilesData(updated);
        if (success) { window.showToast(blocked ? 'Пользователь заблокирован' : 'Пользователь разблокирован'); window.renderAdminUsersList(); }
    };

    window.setUserAdminRole = async function(login, makeAdmin) {
        if (login === 'admin') return;
        const updated = [...(window.profilesData || [])];
        const idx = updated.findIndex(p => p.loginName === login);
        if (idx < 0) return;
        const confirmed = await window.CustomUI.open({
            title: makeAdmin ? '<i class="fa-solid fa-user-shield mr-2 text-indigo-500"></i>Назначить администратором?' : 'Снять права администратора?',
            message: makeAdmin
                ? `@${login} получит доступ к модерации, жалобам и управлению пользователями.`
                : `@${login} потеряет права администратора.`,
            confirmText: makeAdmin ? 'Назначить' : 'Снять',
            confirmClass: 'px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-md'
        });
        if (!confirmed) return;
        updated[idx] = { ...updated[idx], role: makeAdmin ? 'admin' : 'user', profileUpdatedAt: new Date().toISOString() };
        const success = await window.syncProfilesData(updated);
        if (success) {
            window.showToast(makeAdmin ? 'Права администратора выданы' : 'Права администратора сняты');
            window.renderAdminUsersList();
            if (window.pushNotifications) {
                const adminLogin = window.currentUser?.loginName || 'admin';
                window.pushNotifications([login], {
                    type: 'badge',
                    text: makeAdmin
                        ? 'Вам выданы права администратора'
                        : 'С вас сняты права администратора',
                    fromId: adminLogin,
                    fromName: window.currentUser?.username || 'Администратор'
                });
            }
        }
    };

    // Сводка всех действий пользователя для админа: регистрация, метки, комментарии.
    window.getUserActivity = function(login) {
        const profile = window.getProfileByLogin ? window.getProfileByLogin(login) : null;
        const sounds = (window.soundsData || []).filter(s => window.matchesRecordist(s, login, profile?.displayName));
        const comments = [];
        (window.soundsData || []).forEach(s => {
            (s.comments || []).forEach(c => {
                if (c.authorId === login) {
                    comments.push({ id: c.id, text: c.text, date: c.date, createdAt: c.createdAt, soundId: s.id, soundTitle: s.title, kind: 'comment' });
                }
                (c.replies || []).forEach(r => {
                    if (r.authorId === login) {
                        comments.push({ id: r.id, text: r.text, date: r.date, createdAt: r.createdAt, soundId: s.id, soundTitle: s.title, kind: 'reply' });
                    }
                });
            });
        });
        comments.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        return { profile, sounds, comments };
    };

    window.openUserActivityModal = function(login) {
        const data = window.getUserActivity(login);
        const title = document.getElementById('user-activity-title');
        const body = document.getElementById('user-activity-body');
        const modal = document.getElementById('user-activity-modal');
        const content = document.getElementById('user-activity-modal-content');
        if (!body || !modal || !content) return;

        const p = data.profile;
        if (title) title.textContent = `Сводка: ${p?.displayName || login}`;

        const fmt = iso => {
            if (!iso) return '—';
            try { return new Date(iso).toLocaleString('ru-RU'); } catch (e) { return String(iso); }
        };

        body.innerHTML = `
            <div class="rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 p-4 space-y-1.5">
                <p class="text-xs text-slate-500"><span class="font-bold text-slate-700 dark:text-slate-200">Логин:</span> @${login}</p>
                <p class="text-xs text-slate-500"><span class="font-bold text-slate-700 dark:text-slate-200">Регистрация:</span> ${fmt(p?.joinedAt)}</p>
                <p class="text-xs text-slate-500"><span class="font-bold text-slate-700 dark:text-slate-200">Роль:</span> ${p?.role === 'admin' || login === 'admin' ? 'Администратор' : 'Пользователь'}</p>
                <p class="text-xs text-slate-500"><span class="font-bold text-slate-700 dark:text-slate-200">Статус:</span> ${p?.blocked ? 'Заблокирован' : 'Активен'}</p>
                <p class="text-xs text-slate-500"><span class="font-bold text-slate-700 dark:text-slate-200">Email:</span> ${p?.email ? (p.emailVerified ? p.email + ' ✓' : p.email) : 'не привязан'}</p>
            </div>
            <div>
                <h5 class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Метки (${data.sounds.length})</h5>
                ${data.sounds.length ? data.sounds.map(s => `
                    <div class="activity-row" onclick="window.closeUserActivityModal(); window.closeCabinet(); window.selectSound('${s.id}');">
                        <div class="min-w-0 flex-1">
                            <p class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">${s.title}</p>
                            <p class="text-[10px] text-slate-400">${fmt(s.createdAt) !== '—' ? fmt(s.createdAt) : (s.date || '—')} · ${s.status || 'published'}</p>
                        </div>
                    </div>
                `).join('') : `<p class="text-xs text-slate-400">Меток пока нет</p>`}
            </div>
            <div>
                <h5 class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Комментарии и ответы (${data.comments.length})</h5>
                ${data.comments.length ? data.comments.map(c => `
                    <div class="activity-row" onclick="window.closeUserActivityModal(); window.closeCabinet(); window.selectSound('${c.soundId}'); window.openDetailsModal();">
                        <div class="min-w-0 flex-1">
                            <p class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">${c.kind === 'reply' ? 'Ответ' : 'Комментарий'} · ${c.soundTitle}</p>
                            <p class="text-[11px] text-slate-500 truncate">«${c.text}»</p>
                            <p class="text-[10px] text-slate-400">${fmt(c.createdAt) !== '—' ? fmt(c.createdAt) : (c.date || '—')}</p>
                        </div>
                    </div>
                `).join('') : `<p class="text-xs text-slate-400">Комментариев пока нет</p>`}
            </div>
        `;

        modal.classList.remove('hidden');
        void modal.offsetWidth;
        modal.classList.remove('opacity-0', 'pointer-events-none');
        content.classList.remove('scale-95');
    };

    window.closeUserActivityModal = function() {
        const modal = document.getElementById('user-activity-modal');
        const content = document.getElementById('user-activity-modal-content');
        if (!modal || !content) return;
        modal.classList.add('opacity-0', 'pointer-events-none');
        content.classList.add('scale-95');
        setTimeout(() => { if (modal.classList.contains('opacity-0')) modal.classList.add('hidden'); }, 300);
    };

    // --- Уведомления: лайки, ответы, комментарии; админам — жалобы ---
    // Хранятся в profiles.json у получателя (profile.notifications[]).
    window.pushNotifications = async function(targetLogins, payload) {
        const fromId = payload.fromId || null;
        const targets = [...new Set((targetLogins || []).filter(Boolean).filter(l => l !== fromId))];
        if (!targets.length) return false;

        const updated = [...(window.profilesData || [])];
        const notifBase = {
            id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            type: payload.type,
            text: payload.text,
            fromId,
            fromName: payload.fromName || '',
            soundId: payload.soundId || null,
            soundTitle: payload.soundTitle || '',
            date: new Date().toISOString(),
            read: false
        };

        targets.forEach(login => {
            let idx = updated.findIndex(p => p.loginName === login);
            if (idx < 0) {
                updated.push({ loginName: login, displayName: login, notifications: [] });
                idx = updated.length - 1;
            }
            const list = [...(updated[idx].notifications || [])];
            list.unshift({ ...notifBase, id: notifBase.id + Math.random().toString(36).slice(2, 4) });
            updated[idx] = { ...updated[idx], notifications: list.slice(0, 60) };
        });

        const ok = await window.syncProfilesData(updated);
        if (ok && window.refreshNotificationsUI) window.refreshNotificationsUI();
        if (ok && window.currentUser && window.playSfx) {
            const myLogin = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
            if (targets.includes(myLogin)) window.playSfx('notify');
        }
        return ok;
    };

    window.notifyAdmins = async function(payload) {
        const adminLogins = new Set(['admin']);
        (window.profilesData || []).forEach(p => { if (p.role === 'admin') adminLogins.add(p.loginName); });
        return window.pushNotifications([...adminLogins], payload);
    };

    window.getMyNotifications = function() {
        if (!window.currentUser) return [];
        const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        const profile = window.getProfileByLogin ? window.getProfileByLogin(login) : null;
        return (profile && profile.notifications) || [];
    };

    window.refreshNotificationsUI = function() {
        const btn = document.getElementById('notif-btn');
        const btnMobile = document.getElementById('notif-btn-mobile');
        const badge = document.getElementById('notif-badge');
        const badgeMobile = document.getElementById('notif-badge-mobile');
        if (!window.currentUser) {
            if (btn) btn.classList.add('hidden');
            if (btnMobile) btnMobile.classList.add('hidden');
            const panel = document.getElementById('notif-panel');
            if (panel) panel.classList.add('hidden');
            return;
        }
        if (btn) btn.classList.remove('hidden');
        if (btnMobile) btnMobile.classList.remove('hidden');
        const unread = window.getMyNotifications().filter(n => !n.read).length;
        const label = unread > 99 ? '99+' : String(unread);
        if (badge) {
            badge.textContent = label;
            badge.classList.toggle('hidden', unread === 0);
        }
        if (badgeMobile) {
            badgeMobile.textContent = label;
            badgeMobile.classList.toggle('hidden', unread === 0);
        }
        if (document.getElementById('notif-panel') && !document.getElementById('notif-panel').classList.contains('hidden')) {
            window.renderNotificationsList();
        }
    };

    window.toggleNotificationsPanel = function() {
        if (!window.currentUser) return;
        const panel = document.getElementById('notif-panel');
        if (!panel) return;
        const opening = panel.classList.contains('hidden');
        panel.classList.toggle('hidden', !opening);
        if (opening) {
            const anchor = (window.innerWidth < 768)
                ? document.getElementById('notif-btn-mobile')
                : document.getElementById('notif-btn');
            if (anchor) {
                const r = anchor.getBoundingClientRect();
                if (window.innerWidth < 768) {
                    panel.style.left = 'auto';
                    panel.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
                    panel.style.bottom = 'auto';
                    panel.style.top = `${r.bottom + 8}px`;
                    panel.style.width = `min(calc(100vw - 1.5rem), 22rem)`;
                } else {
                    panel.style.left = '';
                    panel.style.right = '';
                    panel.style.top = '';
                    panel.style.bottom = '';
                    panel.style.width = '';
                }
            }
            if (window.playSfx) window.playSfx('open');
            window.renderNotificationsList();
        } else if (window.playSfx) {
            window.playSfx('close');
        }
    };

    window.renderNotificationsList = function() {
        const list = document.getElementById('notif-list');
        if (!list) return;
        const items = window.getMyNotifications();
        if (!items.length) {
            list.innerHTML = `<p class="text-xs text-slate-400 text-center py-8">Пока нет уведомлений</p>`;
            return;
        }
        const icons = {
            comment: 'fa-comment',
            reply: 'fa-reply',
            like: 'fa-thumbs-up',
            dislike: 'fa-thumbs-down',
            reaction: 'fa-heart',
            report: 'fa-flag',
            message: 'fa-envelope',
            badge: 'fa-award',
            expedition: 'fa-route',
            moderation: 'fa-clipboard-check'
        };
        list.innerHTML = items.map(n => `
            <button onclick="window.openNotification('${n.id}')" class="notif-item ${n.read ? '' : 'unread'} w-full text-left">
                <i class="fa-solid ${icons[n.type] || 'fa-bell'} notif-item-icon"></i>
                <div class="min-w-0 flex-1">
                    <p class="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-snug">${n.text}</p>
                    <p class="text-[10px] text-slate-400 mt-0.5">${n.date ? new Date(n.date).toLocaleString('ru-RU') : ''}</p>
                </div>
            </button>
        `).join('');
    };

    window.openNotification = async function(notifId) {
        const login = window.currentUser?.loginName || String(window.currentUser?.username || '').toLowerCase();
        const updated = [...(window.profilesData || [])];
        const idx = updated.findIndex(p => p.loginName === login);
        if (idx < 0) return;
        const notifs = [...(updated[idx].notifications || [])];
        const n = notifs.find(x => x.id === notifId);
        if (!n) return;
        n.read = true;
        updated[idx] = { ...updated[idx], notifications: notifs };
        await window.syncProfilesData(updated);
        window.refreshNotificationsUI();

        const panel = document.getElementById('notif-panel');
        if (panel) panel.classList.add('hidden');

        if (n.soundId) {
            window.selectSound(n.soundId);
            if (n.type === 'comment' || n.type === 'reply' || n.type === 'report' || n.type === 'reaction' || n.type === 'moderation' || n.type === 'like' || n.type === 'dislike') {
                setTimeout(() => window.openDetailsModal(), 200);
            }
        } else if (n.fromId && (n.type === 'message' || n.type === 'reaction')) {
            window.openMessagesModal(n.fromId);
        } else if (n.type === 'expedition' && window.switchSidebarTab) {
            window.switchSidebarTab('expeditions');
            const sb = document.getElementById('sidebar');
            if (sb && sb.classList.contains('sidebar-hidden') && window.toggleSidebar) window.toggleSidebar();
        }
    };

    window.markAllNotificationsRead = async function() {
        if (!window.currentUser) return;
        const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        const updated = [...(window.profilesData || [])];
        const idx = updated.findIndex(p => p.loginName === login);
        if (idx < 0) return;
        const notifs = (updated[idx].notifications || []).map(n => ({ ...n, read: true }));
        updated[idx] = { ...updated[idx], notifications: notifs };
        await window.syncProfilesData(updated);
        window.refreshNotificationsUI();
    };

    // --- Личные сообщения между пользователями (inbox в profiles.json) ---
    window.__activeMessagePeer = null;
    window.__messageReplyTo = null;
    window.__messagePendingImage = null;
    window.MSG_EMOJI_LIST = ['😀','😂','😍','👍','👎','❤️','🔥','👏','😮','😢','🎉','🎵','📸','🙏','✨','💯'];
    window.MSG_REACT_EMOJI = ['👍','❤️','😂','😮','😢','🔥'];
    window.ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
    window.SUPPORT_LOGIN = 'support';
    window.SUPPORT_NAME = 'Поддержка RO·SMap';

    window.ensureSupportProfile = async function() {
        const login = window.SUPPORT_LOGIN;
        const updated = [...(window.profilesData || [])];
        let idx = updated.findIndex(p => p.loginName === login);
        if (idx < 0) {
            updated.push({
                loginName: login,
                displayName: window.SUPPORT_NAME,
                role: 'support',
                bio: 'Служба поддержки аудиокарты Ростовской области',
                inbox: [],
                notifications: [],
                lastSeen: new Date().toISOString()
            });
            await window.syncProfilesData(updated);
            return;
        }
        if (updated[idx].displayName !== window.SUPPORT_NAME || updated[idx].role !== 'support') {
            updated[idx] = { ...updated[idx], displayName: window.SUPPORT_NAME, role: 'support' };
            await window.syncProfilesData(updated);
        }
    };

    window.ensureSupportWelcome = async function() {
        if (!window.currentUser) return;
        const myLogin = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        if (myLogin === window.SUPPORT_LOGIN) return;
        await window.ensureSupportProfile();
        const updated = [...(window.profilesData || [])];
        const idx = updated.findIndex(p => p.loginName === myLogin);
        if (idx < 0) return;
        const inbox = updated[idx].inbox || [];
        const hasSupport = inbox.some(m => m.fromId === window.SUPPORT_LOGIN || m._supportThread);
        if (hasSupport) return;
        const welcome = {
            id: 'msup' + Date.now().toString(36),
            fromId: window.SUPPORT_LOGIN,
            fromName: window.SUPPORT_NAME,
            text: 'Здравствуйте! Это чат поддержки RO·SMap. Напишите сюда, если нужна помощь с картой, публикацией или аккаунтом.',
            date: new Date().toISOString(),
            read: false,
            _supportThread: true
        };
        updated[idx] = { ...updated[idx], inbox: [welcome, ...inbox].slice(0, 200) };
        await window.syncProfilesData(updated);
    };

    window.escMsgHtml = function(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    };

    window.isUserOnline = function(loginOrProfile) {
        const profile = typeof loginOrProfile === 'string'
            ? (window.getProfileByLogin ? window.getProfileByLogin(loginOrProfile) : null)
            : loginOrProfile;
        if (!profile || !profile.lastSeen) return false;
        return (Date.now() - new Date(profile.lastSeen).getTime()) < window.ONLINE_THRESHOLD_MS;
    };

    window.formatPresenceLabel = function(loginOrProfile) {
        const profile = typeof loginOrProfile === 'string'
            ? (window.getProfileByLogin ? window.getProfileByLogin(loginOrProfile) : null)
            : loginOrProfile;
        const online = window.isUserOnline(profile);
        if (online) return window.t ? window.t('online') : 'в сети';
        if (!profile || !profile.lastSeen) return window.t ? window.t('offline') : 'не в сети';

        const seen = new Date(profile.lastSeen);
        if (isNaN(seen.getTime())) return window.t ? window.t('offline') : 'не в сети';

        const diff = Date.now() - seen.getTime();
        const lang = window.currentLang === 'en' ? 'en' : 'ru';
        if (lang === 'en') {
            if (diff < 60 * 1000) return 'last seen just now';
            if (diff < 60 * 60 * 1000) return `last seen ${Math.floor(diff / 60000)} min ago`;
            if (diff < 24 * 60 * 60 * 1000) return `last seen ${Math.floor(diff / 3600000)} h ago`;
            return `last seen ${seen.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
        }
        if (diff < 60 * 1000) return 'был(а) в сети только что';
        if (diff < 60 * 60 * 1000) return `был(а) в сети ${Math.floor(diff / 60000)} мин. назад`;
        if (diff < 24 * 60 * 60 * 1000) return `был(а) в сети ${Math.floor(diff / 3600000)} ч. назад`;
        return `был(а) в сети ${seen.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
    };

    window.touchMyPresence = async function(force = false) {
        if (!window.currentUser) return;
        const now = Date.now();
        // Редко обновляем lastSeen: частые full-file записи раньше затирали чужие сообщения.
        if (!force && window.__lastPresenceTouch && (now - window.__lastPresenceTouch) < 120000) return;
        window.__lastPresenceTouch = now;
        const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        const updated = [...(window.profilesData || [])];
        const idx = updated.findIndex(p => p.loginName === login);
        const iso = new Date().toISOString();
        if (idx >= 0) updated[idx] = { ...updated[idx], lastSeen: iso };
        else updated.push({ loginName: login, displayName: window.currentUser.username, lastSeen: iso });
        await window.syncProfilesData(updated);
    };

    window.getMyInbox = function() {
        if (!window.currentUser) return [];
        const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        const profile = window.getProfileByLogin ? window.getProfileByLogin(login) : null;
        return (profile && profile.inbox) || [];
    };

    window.findInboxMessage = function(msgId) {
        const profiles = window.profilesData || [];
        for (let i = 0; i < profiles.length; i++) {
            const inbox = profiles[i].inbox || [];
            const mi = inbox.findIndex(m => m.id === msgId);
            if (mi >= 0) return { profileLogin: profiles[i].loginName, profileIdx: i, msgIdx: mi, msg: inbox[mi] };
        }
        return null;
    };

    window.refreshMessagesUI = function() {
        const btn = document.getElementById('msg-btn');
        const badge = document.getElementById('msg-badge');
        const btnMobile = document.getElementById('msg-btn-mobile');
        const badgeMobile = document.getElementById('msg-badge-mobile');
        const apply = (b, badgeEl) => {
            if (!b) return;
            if (!window.currentUser) {
                b.classList.add('hidden');
                return;
            }
            b.classList.remove('hidden');
            const unread = window.getMyInbox().filter(m => !m.read && !m.deleted).length;
            if (badgeEl) {
                badgeEl.textContent = unread > 99 ? '99+' : String(unread);
                badgeEl.classList.toggle('hidden', unread === 0);
            }
        };
        apply(btn, badge);
        apply(btnMobile, badgeMobile);
        if (window.syncAccountChrome) window.syncAccountChrome();
    };

    window.toggleMessagesPanel = function() {
        if (!window.currentUser) { if (window.openAuthModal) window.openAuthModal(); return; }
        window.openMessagesModal();
    };

    window.openMessagesModal = function(peerLogin = null) {
        if (window.openDockView) {
            if (window.playSfx) window.playSfx('open');
            window.openDockView('messages');
            window.touchMyPresence(true);
            if (peerLogin) window.openMessageThread(peerLogin);
            else window.showMessagesConversations();
            window.ensureSupportWelcome().then(() => {
                if (peerLogin) {
                    if (window.__activeMessagePeer === peerLogin) window.openMessageThread(peerLogin, { quiet: true });
                } else if (!window.__activeMessagePeer) {
                    window.showMessagesConversations();
                }
            });
            return;
        }
        const m = document.getElementById('messages-modal');
        const c = document.getElementById('messages-modal-content');
        if (!m || !c) return;
        m.classList.remove('hidden');
        void m.offsetWidth;
        m.classList.remove('opacity-0', 'pointer-events-none');
        c.classList.remove('scale-95');
        if (window.playSfx) window.playSfx('open');
        window.touchMyPresence(true);

        if (peerLogin) window.openMessageThread(peerLogin);
        else window.showMessagesConversations();

        window.ensureSupportWelcome().then(() => {
            if (peerLogin) {
                if (window.__activeMessagePeer === peerLogin) window.openMessageThread(peerLogin, { quiet: true });
            } else if (!window.__activeMessagePeer) {
                window.showMessagesConversations();
            }
        });

        requestAnimationFrame(() => {
            void c.offsetHeight;
            const conv = document.getElementById('messages-conversations');
            if (conv) void conv.offsetHeight;
        });
    };

    window.closeMessagesModal = function() {
        const content = document.getElementById('messages-modal-content');
        const inDock = content && content.classList.contains('messages-in-dock');
        if (inDock) {
            if (!window.__skipMessagesDockClose && window.playSfx) window.playSfx('close');
            if (window.undockMessagesContent) window.undockMessagesContent();
            if (!window.__skipMessagesDockClose && window.__dockView === 'messages' && window.openDockView) {
                window.openDockView(window.__sidebarTab || 'library');
            }
        } else {
            const m = document.getElementById('messages-modal');
            const c = document.getElementById('messages-modal-content');
            if (!m || !c) return;
            m.classList.add('opacity-0', 'pointer-events-none');
            c.classList.add('scale-95');
            if (window.playSfx) window.playSfx('close');
            setTimeout(() => { if (m.classList.contains('opacity-0')) m.classList.add('hidden'); }, 300);
        }
        window.__activeMessagePeer = null;
        window.cancelMessageReply();
        window.hideEmojiPicker();
        const input = document.getElementById('messages-compose-input');
        if (input) input.value = '';
        window.__messagePendingImage = null;
    };

    window.isMessageComposeDirty = function() {
        const text = (document.getElementById('messages-compose-input')?.value || '').trim();
        return !!(text || window.__messagePendingImage || window.__messageReplyTo);
    };

    window.requestCloseMessagesModal = async function() {
        if (window.isMessageComposeDirty()) {
            const ok = await (window.confirmDiscardDraft
                ? window.confirmDiscardDraft('Черновик сообщения не отправлен.')
                : true);
            if (!ok) return;
        }
        window.closeMessagesModal();
    };

    window.requestShowMessagesConversations = async function() {
        if (window.isMessageComposeDirty && window.isMessageComposeDirty()) {
            const ok = await (window.confirmDiscardDraft
                ? window.confirmDiscardDraft('Черновик сообщения не отправлен.')
                : true);
            if (!ok) return;
            const input = document.getElementById('messages-compose-input');
            if (input) input.value = '';
            window.__messagePendingImage = null;
            if (window.cancelMessageReply) window.cancelMessageReply();
        }
        window.showMessagesConversations();
    };

    window.showMessagesConversations = function() {
        window.__activeMessagePeer = null;
        window.cancelMessageReply();
        window.hideEmojiPicker();
        const conv = document.getElementById('messages-conversations');
        const thread = document.getElementById('messages-thread');
        if (conv) conv.classList.remove('hidden');
        if (thread) thread.classList.add('hidden');

        const inbox = window.getMyInbox();
        const byPeer = new Map();
        inbox.forEach(msg => {
            const peer = msg.fromId;
            if (!peer) return;
            const prev = byPeer.get(peer);
            if (!prev || new Date(msg.date) > new Date(prev.date)) byPeer.set(peer, msg);
        });

        const myLogin = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        const isAdmin = window.isCurrentUserAdmin && window.isCurrentUserAdmin();

        (window.profilesData || []).forEach(p => {
            (p.inbox || []).forEach(msg => {
                if (msg.fromId === myLogin) {
                    const peer = p.loginName;
                    const synthetic = { ...msg, fromId: peer, fromName: p.displayName || peer, _outgoingHint: true };
                    const prev = byPeer.get(peer);
                    if (!prev || new Date(msg.date) > new Date(prev.date)) byPeer.set(peer, synthetic);
                }
            });
        });

        // Админ видит обращения в поддержку (сообщения в inbox профиля support)
        if (isAdmin) {
            const supportProfile = window.getProfileByLogin ? window.getProfileByLogin(window.SUPPORT_LOGIN) : null;
            (supportProfile?.inbox || []).forEach(msg => {
                if (!msg.fromId || msg.fromId === window.SUPPORT_LOGIN) return;
                const peer = msg.fromId;
                const synthetic = { ...msg, _supportTicket: true };
                const prev = byPeer.get(peer);
                if (!prev || new Date(msg.date) > new Date(prev.date)) byPeer.set(peer, synthetic);
            });
        }

        // У каждого пользователя всегда есть закреплённый чат с поддержкой
        if (myLogin !== window.SUPPORT_LOGIN && !byPeer.has(window.SUPPORT_LOGIN)) {
            byPeer.set(window.SUPPORT_LOGIN, {
                fromId: window.SUPPORT_LOGIN,
                fromName: window.SUPPORT_NAME,
                text: window.t ? window.t('write_support') : 'Напишите в поддержку',
                date: new Date(0).toISOString(),
                _supportPinned: true
            });
        }

        if (!conv) return;
        if (!byPeer.size) {
            conv.innerHTML = `<p class="text-xs text-slate-400 text-center py-10">${window.t ? window.t('no_conversations') : 'Пока нет переписок.'}</p>`;
            return;
        }

        const rows = [...byPeer.entries()].sort((a, b) => {
            if (a[0] === window.SUPPORT_LOGIN) return -1;
            if (b[0] === window.SUPPORT_LOGIN) return 1;
            return new Date(b[1].date) - new Date(a[1].date);
        });
        conv.innerHTML = rows.map(([peer, last]) => {
            const unread = inbox.filter(m => m.fromId === peer && !m.read && !m.deleted).length;
            const isSupport = peer === window.SUPPORT_LOGIN;
            const profile = window.getProfileByLogin ? window.getProfileByLogin(peer) : null;
            const name = isSupport ? window.SUPPORT_NAME : (profile?.displayName || last.fromName || peer);
            const online = isSupport ? true : window.isUserOnline(profile);
            const avatar = isSupport
                ? `<span class="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center text-sm"><i class="fa-solid fa-headset"></i></span>`
                : (profile?.avatar
                    ? `<img src="${profile.avatar}" class="w-9 h-9 rounded-full object-cover" alt="">`
                    : `<span class="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 text-sm"><i class="fa-solid fa-user"></i></span>`);
            const preview = last._supportPinned
                ? (window.t ? window.t('write_support') : 'Напишите в поддержку')
                : (last.deleted
                    ? (window.t ? window.t('msg_deleted') : 'Сообщение удалено')
                    : (last.image && !last.text ? `📷 ${window.t ? window.t('photo_label') : 'Фото'}` : (last.text || '')));
            const ticks = last._outgoingHint
                ? `<span class="msg-ticks msg-ticks--list ${last.read ? 'is-read' : 'is-delivered'}" title="${last.read ? 'Просмотрено' : 'Доставлено'}"><i class="fa-solid ${last.read ? 'fa-check-double' : 'fa-check'}"></i></span>`
                : '';
            const presence = isSupport
                ? (window.t ? window.t('support_status') : 'обычно отвечает в течение дня')
                : (window.formatPresenceLabel ? window.formatPresenceLabel(profile) : (online ? 'в сети' : 'не в сети'));
            const openFn = (isAdmin && last._supportTicket)
                ? `window.openSupportTicket('${peer}')`
                : `window.openMessageThread('${peer}')`;
            return `
            <button onclick="${openFn}" class="notif-item ${unread ? 'unread' : ''} ${isSupport ? 'msg-support-row' : ''} w-full text-left">
                <div class="relative shrink-0">${avatar}<span class="msg-online-dot ${online ? 'on' : ''}"></span></div>
                <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between gap-2">
                        <p class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">${window.escMsgHtml(name)}${isSupport ? ' <span class="text-[9px] text-blue-500 font-bold">PIN</span>' : ''}</p>
                        ${unread ? `<span class="text-[10px] font-bold text-blue-600">${unread}</span>` : ticks}
                    </div>
                    <p class="text-[10px] ${online ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'} truncate mt-0.5">${window.escMsgHtml(presence)}</p>
                    <p class="text-[11px] text-slate-500 truncate mt-0.5">${window.escMsgHtml(preview)}</p>
                </div>
            </button>`;
        }).join('');
    };

    window.updateThreadPeerHeader = function(peerLogin) {
        const isSupport = peerLogin === window.SUPPORT_LOGIN;
        const profile = window.getProfileByLogin ? window.getProfileByLogin(peerLogin) : null;
        const name = isSupport ? window.SUPPORT_NAME : (profile?.displayName || peerLogin);
        const nameEl = document.getElementById('messages-thread-name');
        const statusEl = document.getElementById('messages-thread-status');
        const avatar = document.getElementById('messages-thread-avatar');
        const fallback = document.getElementById('messages-thread-avatar-fallback');
        const onlineDot = document.getElementById('messages-thread-online');
        const online = isSupport ? true : window.isUserOnline(profile);

        if (nameEl) nameEl.textContent = name;
        if (statusEl) {
            statusEl.textContent = isSupport
                ? (window.t ? window.t('support_status') : 'обычно отвечает в течение дня')
                : (window.formatPresenceLabel ? window.formatPresenceLabel(profile) : (online ? 'в сети' : 'не в сети'));
        }
        if (onlineDot) onlineDot.classList.toggle('hidden', !online);

        if (isSupport) {
            if (avatar) avatar.classList.add('hidden');
            if (fallback) {
                fallback.classList.remove('hidden');
                fallback.innerHTML = '<i class="fa-solid fa-headset"></i>';
            }
        } else if (profile?.avatar) {
            if (avatar) { avatar.src = profile.avatar; avatar.classList.remove('hidden'); }
            if (fallback) fallback.classList.add('hidden');
        } else {
            if (avatar) avatar.classList.add('hidden');
            if (fallback) {
                fallback.classList.remove('hidden');
                fallback.innerHTML = '<i class="fa-solid fa-user"></i>';
            }
        }
    };

    window.openPeerProfileFromChat = function() {
        const peer = window.__activeMessagePeer;
        if (!peer || peer === window.SUPPORT_LOGIN) {
            window.showToast('Это служебный чат поддержки');
            return;
        }
        const profile = window.getProfileByLogin ? window.getProfileByLogin(peer) : null;
        window.openPublicProfile(peer, profile?.displayName || peer);
    };

    window.openSupportTicket = function(userLogin) {
        // Админ отвечает пользователю от имени поддержки
        window.__supportTicketUser = userLogin;
        window.openMessageThread(userLogin, { asSupport: true });
    };

    window.renderMessageTicks = function(m) {
        if (!m._mine || m.deleted) return '';
        const read = !!m.read;
        const title = read ? 'Просмотрено' : 'Доставлено';
        const cls = read ? 'msg-ticks is-read' : 'msg-ticks is-delivered';
        const icon = read ? 'fa-check-double' : 'fa-check';
        return `<span class="${cls}" title="${title}"><i class="fa-solid ${icon}"></i></span>`;
    };

    window.renderMessageBubble = function(m) {
        if (m.deleted) {
            return `<div class="msg-bubble deleted ${m._mine ? 'mine' : ''}" onclick="window.openMessageMenu('${m.id}')">
                <p class="text-[13px] leading-snug">Сообщение удалено</p>
                <p class="msg-bubble-foot"><span>${m.date ? new Date(m.date).toLocaleString('ru-RU') : ''}</span>${window.renderMessageTicks(m)}</p>
            </div>`;
        }
        const reply = m.replyTo
            ? `<div class="msg-bubble-reply">${window.escMsgHtml(m.replyTo.fromName || '')}: ${window.escMsgHtml(m.replyTo.text || (m.replyTo.image ? '📷 Фото' : ''))}</div>`
            : '';
        const img = m.image
            ? `<img src="${m.image}" class="msg-bubble-img" alt="" onclick="event.stopPropagation(); window.openMessageImage('${m.id}')">`
            : '';
        const edited = m.editedAt ? ' · изменено' : '';
        const reactions = m.reactions && Object.keys(m.reactions).length
            ? `<div class="msg-reactions">${Object.entries(m.reactions).map(([emoji, users]) =>
                users?.length ? `<span class="msg-reaction-chip">${emoji} ${users.length}</span>` : ''
            ).join('')}</div>`
            : '';
        return `<div class="msg-bubble ${m._mine ? 'mine' : ''} ${m._mine ? '' : 'swipe-reply-row'}" data-msg-id="${m.id}" onclick="window.openMessageMenu('${m.id}')">
            ${m._mine ? '' : '<span class="swipe-reply-hint"><i class="fa-solid fa-reply"></i></span>'}
            ${reply}${img}
            ${m.text ? `<p class="text-[13px] leading-snug">${window.escMsgHtml(m.text)}</p>` : ''}
            ${reactions}
            <p class="msg-bubble-foot"><span>${m.date ? new Date(m.date).toLocaleString(window.currentLang === 'en' ? 'en-US' : 'ru-RU') : ''}${edited}</span>${window.renderMessageTicks(m)}</p>
        </div>`;
    };

    window.openMessageImage = function(msgId) {
        const found = window.findInboxMessage(msgId);
        if (found?.msg?.image && window.openLightbox) window.openLightbox([found.msg.image], 0);
    };

    window.openMessageThread = async function(peerLogin, { quiet = false, asSupport = false } = {}) {
        window.__activeMessagePeer = peerLogin;
        window.__messagingAsSupport = !!asSupport;
        if (!asSupport) window.__supportTicketUser = null;

        const conv = document.getElementById('messages-conversations');
        const thread = document.getElementById('messages-thread');
        const list = document.getElementById('messages-thread-list');
        if (conv) conv.classList.add('hidden');
        if (thread) thread.classList.remove('hidden');

        window.updateThreadPeerHeader(asSupport ? peerLogin : peerLogin);
        if (asSupport) {
            const nameEl = document.getElementById('messages-thread-name');
            const statusEl = document.getElementById('messages-thread-status');
            const profile = window.getProfileByLogin ? window.getProfileByLogin(peerLogin) : null;
            if (nameEl) nameEl.textContent = `Тикет: ${profile?.displayName || peerLogin}`;
            if (statusEl) statusEl.textContent = 'ответ от имени поддержки';
        }

        const myLogin = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        let all = [];

        if (asSupport) {
            // Админ смотрит переписку пользователя с поддержкой
            const supportProfile = (window.getProfileByLogin ? window.getProfileByLogin(window.SUPPORT_LOGIN) : null) || {};
            const fromUser = (supportProfile.inbox || []).filter(m => m.fromId === peerLogin).map(m => ({ ...m, _mine: false }));
            const userProfile = (window.getProfileByLogin ? window.getProfileByLogin(peerLogin) : null) || {};
            const fromSupport = (userProfile.inbox || []).filter(m => m.fromId === window.SUPPORT_LOGIN).map(m => ({ ...m, _mine: true }));
            all = [...fromUser, ...fromSupport].sort((a, b) => new Date(a.date) - new Date(b.date));
        } else if (peerLogin === window.SUPPORT_LOGIN) {
            const supportProfile = (window.getProfileByLogin ? window.getProfileByLogin(window.SUPPORT_LOGIN) : null) || {};
            const outgoing = (supportProfile.inbox || []).filter(m => m.fromId === myLogin).map(m => ({ ...m, _mine: true }));
            const incoming = window.getMyInbox().filter(m => m.fromId === window.SUPPORT_LOGIN);
            all = [...incoming.map(m => ({ ...m, _mine: false })), ...outgoing].sort((a, b) => new Date(a.date) - new Date(b.date));
        } else {
            const incoming = window.getMyInbox().filter(m => m.fromId === peerLogin);
            const peerProfile = (window.getProfileByLogin ? window.getProfileByLogin(peerLogin) : null) || {};
            const outgoing = (peerProfile.inbox || []).filter(m => m.fromId === myLogin).map(m => ({ ...m, _mine: true }));
            all = [...incoming.map(m => ({ ...m, _mine: false })), ...outgoing].sort((a, b) => new Date(a.date) - new Date(b.date));
        }

        if (list) {
            const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
            list.innerHTML = all.length
                ? all.map(m => window.renderMessageBubble(m)).join('')
                : `<p class="text-xs text-slate-400 text-center py-6">Начните переписку</p>`;
            if (!quiet || nearBottom) list.scrollTop = list.scrollHeight;
            if (window.bindSwipeReplyRows) window.bindSwipeReplyRows(list, (id) => window.startMessageReply(id));
        }

        // Пометить прочитанными входящие в мой inbox
        const updated = [...(window.profilesData || [])];
        const idx = updated.findIndex(p => p.loginName === myLogin);
        if (idx >= 0 && !asSupport) {
            let changed = false;
            const inbox = (updated[idx].inbox || []).map(m => {
                if (m.fromId === peerLogin && !m.read) {
                    changed = true;
                    return { ...m, read: true, readAt: new Date().toISOString() };
                }
                return m;
            });
            if (changed) {
                updated[idx] = { ...updated[idx], inbox };
                await window.syncProfilesData(updated);
                window.refreshMessagesUI();
            }
        }
        // Админ читает обращения в support inbox
        if (asSupport) {
            const sIdx = updated.findIndex(p => p.loginName === window.SUPPORT_LOGIN);
            if (sIdx >= 0) {
                let changed = false;
                const inbox = (updated[sIdx].inbox || []).map(m => {
                    if (m.fromId === peerLogin && !m.read) {
                        changed = true;
                        return { ...m, read: true, readAt: new Date().toISOString() };
                    }
                    return m;
                });
                if (changed) {
                    updated[sIdx] = { ...updated[sIdx], inbox };
                    await window.syncProfilesData(updated);
                    window.refreshMessagesUI();
                }
            }
        }
    };

    window.cancelMessageReply = function() {
        window.__messageReplyTo = null;
        const banner = document.getElementById('messages-reply-banner');
        if (banner) banner.classList.add('hidden');
    };

    window.startMessageReply = function(msgId) {
        const found = window.findInboxMessage(msgId);
        if (!found || found.msg.deleted) return;
        const m = found.msg;
        // Ответ по свайпу — на сообщение собеседника (не своё)
        const myLogin = window.currentUser
            ? (window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase())
            : '';
        if (m.fromId === myLogin) return;

        window.__messageReplyTo = {
            id: m.id,
            text: m.text || '',
            image: !!m.image,
            fromName: m.fromName || m.fromId
        };
        const banner = document.getElementById('messages-reply-banner');
        const preview = document.getElementById('messages-reply-preview');
        if (preview) preview.textContent = m.text || (m.image ? '📷 Photo' : '');
        if (banner) {
            banner.classList.remove('hidden');
            banner.classList.add('flex');
        }
        document.getElementById('messages-compose-input')?.focus();
    };

    window.toggleEmojiPicker = function() {
        const picker = document.getElementById('messages-emoji-picker');
        if (!picker) return;
        const opening = picker.classList.contains('hidden');
        if (opening) {
            picker.innerHTML = window.MSG_EMOJI_LIST.map(e =>
                `<button type="button" onclick="window.insertMessageEmoji('${e}')">${e}</button>`
            ).join('');
            picker.classList.remove('hidden');
        } else {
            picker.classList.add('hidden');
        }
    };

    window.hideEmojiPicker = function() {
        const picker = document.getElementById('messages-emoji-picker');
        if (picker) picker.classList.add('hidden');
    };

    window.insertMessageEmoji = function(emoji) {
        const input = document.getElementById('messages-compose-input');
        if (!input) return;
        const start = input.selectionStart || input.value.length;
        const end = input.selectionEnd || input.value.length;
        input.value = input.value.slice(0, start) + emoji + input.value.slice(end);
        input.focus();
        input.selectionStart = input.selectionEnd = start + emoji.length;
    };

    window.sendMessagePhoto = function(files) {
        if (!files || !files[0] || !files[0].type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            window.__messagePendingImage = e.target.result;
            await window.sendMessageInThread();
            const input = document.getElementById('messages-photo-input');
            if (input) input.value = '';
        };
        reader.readAsDataURL(files[0]);
    };

    window.sendMessageInThread = async function() {
        const peer = window.__activeMessagePeer;
        if (!peer || !window.currentUser) return;
        const input = document.getElementById('messages-compose-input');
        const text = (input?.value || '').trim();
        const image = window.__messagePendingImage || null;
        if (!text && !image) return;

        const myLogin = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        const asSupport = !!window.__messagingAsSupport;
        const updated = [...(window.profilesData || [])];

        // Куда кладём сообщение и от чьего имени
        let targetLogin = peer;
        let fromId = myLogin;
        let fromName = window.currentUser.username;
        if (asSupport) {
            // Админ → inbox пользователя от имени support
            targetLogin = peer;
            fromId = window.SUPPORT_LOGIN;
            fromName = window.SUPPORT_NAME;
            await window.ensureSupportProfile();
        } else if (peer === window.SUPPORT_LOGIN) {
            // Пользователь → inbox поддержки
            targetLogin = window.SUPPORT_LOGIN;
            await window.ensureSupportProfile();
        }

        let idx = updated.findIndex(p => p.loginName === targetLogin);
        if (idx < 0) {
            updated.push({ loginName: targetLogin, displayName: targetLogin === window.SUPPORT_LOGIN ? window.SUPPORT_NAME : targetLogin, inbox: [] });
            idx = updated.length - 1;
        }
        const msg = {
            id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            fromId,
            fromName,
            text,
            image: image || undefined,
            replyTo: window.__messageReplyTo || undefined,
            reactions: {},
            date: new Date().toISOString(),
            read: false
        };
        updated[idx] = { ...updated[idx], inbox: [msg, ...(updated[idx].inbox || [])].slice(0, 200) };

        if (targetLogin !== window.SUPPORT_LOGIN) {
            const isReply = !!window.__messageReplyTo;
            const notifs = [...(updated[idx].notifications || [])];
            notifs.unshift({
                id: 'n' + Date.now().toString(36),
                type: 'message',
                text: asSupport
                    ? (image && !text ? 'Поддержка отправила вам фото' : 'Поддержка ответила на ваше обращение')
                    : (isReply
                        ? `${window.currentUser.username} ответил(а) на ваше сообщение`
                        : (image && !text
                            ? `${window.currentUser.username} отправил(а) вам фото`
                            : `${window.currentUser.username} написал(а) вам сообщение`)),
                fromId,
                fromName,
                date: new Date().toISOString(),
                read: false
            });
            updated[idx] = { ...updated[idx], notifications: notifs.slice(0, 60) };
        }

        if (input) input.value = '';
        window.__messagePendingImage = null;
        window.cancelMessageReply();
        window.hideEmojiPicker();

        const ok = await window.syncProfilesData(updated);
        if (ok) {
            if (asSupport) window.openMessageThread(peer, { asSupport: true });
            else window.openMessageThread(peer);
            window.showToast('Сообщение отправлено', { sfx: 'send' });
            window.touchMyPresence();
        } else {
            window.showToast('Не удалось отправить');
        }
    };

    window.openMessageMenu = function(msgId) {
        const found = window.findInboxMessage(msgId);
        if (!found) return;
        const m = found.msg;
        const myLogin = window.currentUser?.loginName || String(window.currentUser?.username || '').toLowerCase();
        const isMine = m.fromId === myLogin;
        const items = [];

        if (!m.deleted) {
            items.push({ icon: 'fa-reply', label: 'Ответить', onClick: () => window.startMessageReply(msgId) });
            items.push({
                icon: 'fa-face-smile',
                label: 'Реакция',
                onClick: () => {
                    const reactItems = window.MSG_REACT_EMOJI.map(emoji => ({
                        icon: 'fa-heart',
                        label: emoji,
                        onClick: () => window.toggleMessageReaction(msgId, emoji)
                    }));
                    setTimeout(() => window.ActionSheet.open(reactItems), 300);
                }
            });
            if (isMine) {
                items.push({ icon: 'fa-pen', label: 'Редактировать', onClick: () => window.editMessage(msgId) });
                items.push({ icon: 'fa-trash-can', label: 'Удалить', danger: true, onClick: () => window.deleteMessage(msgId) });
            } else {
                items.push({ icon: 'fa-flag', label: 'Пожаловаться', danger: true, onClick: () => window.reportMessage(msgId) });
            }
        }
        if (m.fromId) {
            const authorProfile = window.getProfileByLogin ? window.getProfileByLogin(m.fromId) : null;
            items.unshift({
                icon: 'fa-id-badge',
                label: 'Профиль автора',
                onClick: () => window.openPublicProfile(m.fromId, authorProfile?.displayName || m.fromName || m.fromId)
            });
        }
        if (items.length) window.ActionSheet.open(items);
    };

    window.toggleMessageReaction = async function(msgId, emoji) {
        if (!window.currentUser) return;
        const found = window.findInboxMessage(msgId);
        if (!found || found.msg.deleted) return;
        const myLogin = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        const updated = [...(window.profilesData || [])];
        const pIdx = updated.findIndex(p => p.loginName === found.profileLogin);
        if (pIdx < 0) return;
        const inbox = [...(updated[pIdx].inbox || [])];
        const msg = { ...inbox[found.msgIdx] };
        const reactions = { ...(msg.reactions || {}) };

        // Убираем прошлую реакцию пользователя
        Object.keys(reactions).forEach(key => {
            reactions[key] = (reactions[key] || []).filter(u => u !== myLogin);
            if (!reactions[key].length) delete reactions[key];
        });
        const list = reactions[emoji] || [];
        const had = (found.msg.reactions?.[emoji] || []).includes(myLogin);
        if (!had) {
            reactions[emoji] = [...list, myLogin];
        }
        msg.reactions = reactions;
        inbox[found.msgIdx] = msg;
        updated[pIdx] = { ...updated[pIdx], inbox };

        const ok = await window.syncProfilesData(updated);
        if (ok) {
            if (window.__activeMessagePeer) window.openMessageThread(window.__activeMessagePeer, { quiet: true });
            if (!had && msg.fromId && msg.fromId !== myLogin && window.pushNotifications) {
                window.pushNotifications([msg.fromId], {
                    type: 'reaction',
                    text: `${window.currentUser.username} поставил(а) реакцию ${emoji} на ваше сообщение`,
                    fromId: myLogin,
                    fromName: window.currentUser.username
                });
            }
        }
    };

    window.editMessage = async function(msgId) {
        const found = window.findInboxMessage(msgId);
        if (!found || found.msg.deleted) return;
        const myLogin = window.currentUser?.loginName || String(window.currentUser?.username || '').toLowerCase();
        if (found.msg.fromId !== myLogin) return;

        const next = await window.CustomUI.open({
            title: '<i class="fa-solid fa-pen mr-2 text-blue-500"></i>Редактировать',
            message: 'Измените текст сообщения',
            confirmText: 'Сохранить',
            confirmClass: 'px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-md',
            showInput: true,
            inputPlaceholder: 'Текст сообщения',
            inputValue: found.msg.text || ''
        });
        if (next === false || next == null) return;
        const text = String(next).trim();
        if (!text && !found.msg.image) { window.showToast('Текст не может быть пустым'); return; }

        const updated = [...(window.profilesData || [])];
        const pIdx = updated.findIndex(p => p.loginName === found.profileLogin);
        if (pIdx < 0) return;
        const inbox = [...(updated[pIdx].inbox || [])];
        inbox[found.msgIdx] = { ...inbox[found.msgIdx], text, editedAt: new Date().toISOString() };
        updated[pIdx] = { ...updated[pIdx], inbox };
        const ok = await window.syncProfilesData(updated);
        if (ok) {
            window.showToast('Сообщение изменено');
            if (window.__activeMessagePeer) window.openMessageThread(window.__activeMessagePeer, { quiet: true });
        }
    };

    window.deleteMessage = async function(msgId) {
        const found = window.findInboxMessage(msgId);
        if (!found) return;
        const myLogin = window.currentUser?.loginName || String(window.currentUser?.username || '').toLowerCase();
        if (found.msg.fromId !== myLogin) return;
        const confirmed = await window.CustomUI.open({
            title: '<i class="fa-solid fa-trash-can mr-2 text-red-500"></i>Удалить сообщение?',
            message: 'Сообщение будет удалено для обоих участников переписки.',
            confirmText: 'Удалить',
            confirmClass: 'px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-md'
        });
        if (!confirmed) return;

        const updated = [...(window.profilesData || [])];
        const pIdx = updated.findIndex(p => p.loginName === found.profileLogin);
        if (pIdx < 0) return;
        const inbox = [...(updated[pIdx].inbox || [])];
        inbox[found.msgIdx] = {
            ...inbox[found.msgIdx],
            deleted: true,
            text: '',
            image: undefined,
            reactions: {}
        };
        updated[pIdx] = { ...updated[pIdx], inbox };
        const ok = await window.syncProfilesData(updated);
        if (ok) {
            window.showToast('Сообщение удалено');
            if (window.__activeMessagePeer) window.openMessageThread(window.__activeMessagePeer, { quiet: true });
        }
    };

    window.reportMessage = async function(msgId) {
        if (!window.currentUser) return;
        const found = window.findInboxMessage(msgId);
        if (!found || found.msg.deleted) return;

        const reason = await window.CustomUI.open({
            title: '<i class="fa-solid fa-flag mr-2 text-red-500"></i>Пожаловаться на сообщение',
            message: 'Опишите причину — жалобу рассмотрят модераторы.',
            confirmText: 'Отправить',
            confirmClass: 'px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-md',
            showInput: true,
            inputPlaceholder: 'Причина жалобы'
        });
        if (reason === false || !reason) return;

        const myLogin = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        const updated = [...(window.profilesData || [])];
        const pIdx = updated.findIndex(p => p.loginName === found.profileLogin);
        if (pIdx < 0) return;
        const inbox = [...(updated[pIdx].inbox || [])];
        const msg = { ...inbox[found.msgIdx] };
        msg.reports = [...(msg.reports || []), {
            id: 'rep' + Date.now().toString(36),
            reason: String(reason),
            reporterId: myLogin,
            reporterName: window.currentUser.username,
            date: new Date().toISOString()
        }];
        inbox[found.msgIdx] = msg;
        updated[pIdx] = { ...updated[pIdx], inbox };
        const ok = await window.syncProfilesData(updated);
        window.showToast(ok ? 'Жалоба отправлена' : 'Не удалось отправить жалобу');
        if (ok && window.notifyAdmins) {
            window.notifyAdmins({
                type: 'report',
                text: `${window.currentUser.username} пожаловался(ась) на сообщение от ${msg.fromName || msg.fromId}: ${reason}`,
                fromId: myLogin,
                fromName: window.currentUser.username
            });
        }
    };

    window.openComposeMessageFromProfile = function() {
        const ctx = window.__publicProfileCtx;
        if (!ctx?.login) return;
        if (!window.currentUser) { window.showToast('Войдите, чтобы писать сообщения'); if (window.openAuthModal) window.openAuthModal(); return; }
        const myLogin = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        if (ctx.login === myLogin) { window.showToast('Это ваш профиль'); return; }
        window.closePublicProfileModal();
        window.openMessagesModal(ctx.login);
    };

    // --- Настройки профиля (вкладка "Настройки" кабинета) ---
    window.fillProfileSettingsForm = function() {
        if (!window.currentUser) return;
        const bioEl = document.getElementById('profile-bio');
        const gearEl = document.getElementById('profile-gear');
        const linksEl = document.getElementById('profile-links');
        if (bioEl) bioEl.value = window.currentUser.bio || '';
        if (gearEl) gearEl.value = (window.currentUser.gear || []).join(', ');
        if (linksEl) linksEl.value = (window.currentUser.links || []).join(', ');

        const emailEl = document.getElementById('profile-email');
        if (emailEl) emailEl.value = window.currentUser.email || '';
        window.refreshEmailVerificationUI();
    };

    window.saveMyProfileFromSettingsForm = async function() {
        if (!window.currentUser) return;
        const bio = (document.getElementById('profile-bio')?.value || '').trim();
        const gear = (document.getElementById('profile-gear')?.value || '').split(',').map(g => g.trim()).filter(Boolean);
        const links = (document.getElementById('profile-links')?.value || '').split(',').map(l => l.trim()).filter(Boolean);
        window.showToast('Сохранение профиля...');
        const ok = await window.saveMyProfile({ bio, gear, links });
        window.showToast(ok ? 'Профиль обновлён' : 'Не удалось сохранить профиль');
    };

    // --- Привязка email с кодом подтверждения ---
    // Код и адрес живут только в памяти (window.__pendingEmailVerification), в облако/профиль
    // попадают только после успешного подтверждения — так жалоба "ввёл email и забыл" не
    // оставляет висящих неподтверждённых кодов в общем profiles.json.
    window.__pendingEmailVerification = null;

    window.refreshEmailVerificationUI = function() {
        const badge = document.getElementById('email-verified-badge');
        if (!badge) return;
        const verified = !!(window.currentUser && window.currentUser.email && window.currentUser.emailVerified);
        badge.textContent = verified ? 'Подтверждена' : 'Не подтверждена';
        badge.className = `pub-status-pill ${verified ? 'pub-status-published' : 'pub-status-rejected'}`;
    };

    // Точка интеграции с реальной отправкой писем — см. window.YANDEX_EMAIL_FUNCTION_URL
    // в state.js. Пока URL не задан, работаем в демо-режиме: код показывается прямо в тосте,
    // поскольку у клиентского приложения нет собственного почтового сервера.
    window.sendVerificationEmail = async function(email, code) {
        if (window.YANDEX_EMAIL_FUNCTION_URL) {
            try {
                const res = await fetch(window.YANDEX_EMAIL_FUNCTION_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, code })
                });
                if (res.ok) return true;
            } catch (e) { /* падаем в демо-режим ниже */ }
        }
        window.showToast(`Демо-режим: код подтверждения — ${code}`);
        console.info(`[demo email] Код подтверждения для ${email}: ${code}`);
        return true;
    };

    window.startEmailVerification = async function() {
        if (!window.currentUser) return;
        const email = (document.getElementById('profile-email')?.value || '').trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { window.showToast('Введите корректный email'); return; }

        const code = String(Math.floor(100000 + Math.random() * 900000));
        window.__pendingEmailVerification = { email, code, expiresAt: Date.now() + 10 * 60 * 1000 };

        const btn = document.getElementById('email-send-code-btn');
        if (btn) btn.disabled = true;
        await window.sendVerificationEmail(email, code);
        if (btn) btn.disabled = false;

        const block = document.getElementById('email-code-block');
        if (block) { block.classList.remove('hidden'); block.classList.add('space-y-2'); }
        const codeInput = document.getElementById('email-code-input');
        if (codeInput) { codeInput.value = ''; codeInput.focus(); }
    };

    window.confirmEmailCode = async function() {
        const pending = window.__pendingEmailVerification;
        if (!pending) { window.showToast('Сначала запросите код'); return; }
        if (Date.now() > pending.expiresAt) { window.showToast('Код истёк, запросите новый'); window.__pendingEmailVerification = null; return; }

        const entered = (document.getElementById('email-code-input')?.value || '').trim();
        if (entered !== pending.code) { window.showToast('Неверный код'); return; }

        window.showToast('Подтверждение почты...');
        const ok = await window.saveMyProfile({ email: pending.email, emailVerified: true });
        if (ok) {
            window.__pendingEmailVerification = null;
            const block = document.getElementById('email-code-block');
            if (block) block.classList.add('hidden');
            window.refreshEmailVerificationUI();
            window.showToast('Почта подтверждена');
        } else {
            window.showToast('Не удалось сохранить подтверждение');
        }
    };

    // --- Профессиональная аналитика: спрос по трекам/акустическим нишам (только опубликованные) ---
    const ECO_LABELS = { biophony: 'Биофония', geophony: 'Геофония', anthrophony: 'Антропофония' };
    const ECO_ICONS = { biophony: 'fa-leaf', geophony: 'fa-water', anthrophony: 'fa-city' };

    window.getMyAnalytics = function() {
        if (!window.currentUser) return null;
        const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        const mySounds = window.getUserSounds(login, window.currentUser.username, { includeAllStatuses: true });
        const published = mySounds.filter(s => !s.status || s.status === 'published');

        const totalPlays = published.reduce((sum, s) => sum + (s.plays || 0), 0);
        const totalDownloads = published.reduce((sum, s) => sum + (s.downloads || 0), 0);

        const byCategory = {};
        Object.keys(ECO_LABELS).forEach(cat => { byCategory[cat] = { plays: 0, downloads: 0, count: 0, demand: 0 }; });
        published.forEach(s => {
            const cat = byCategory[s.ecoCategory] ? s.ecoCategory : 'anthrophony';
            byCategory[cat].plays += (s.plays || 0);
            byCategory[cat].downloads += (s.downloads || 0);
            byCategory[cat].count += 1;
        });
        Object.values(byCategory).forEach(c => { c.demand = c.plays + c.downloads * 2; });

        // Спрос = прослушивания + скачивания x2 (скачивание — более сильный сигнал интереса).
        const topSounds = published
            .map(s => ({ ...s, demand: (s.plays || 0) + (s.downloads || 0) * 2 }))
            .sort((a, b) => b.demand - a.demand)
            .slice(0, 5);

        return { totalPlays, totalDownloads, totalPublished: published.length, byCategory, topSounds };
    };

    window.renderMyAnalytics = function() {
        const container = document.getElementById('cab-analytics-content');
        if (!container || !window.currentUser) return;

        const data = window.getMyAnalytics();
        if (!data || data.totalPublished === 0) {
            container.innerHTML = `<div class="text-center py-12 text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm"><i class="fa-solid fa-chart-line text-4xl mb-3 opacity-30 block"></i><p class="font-medium text-sm">Пока нет данных для аналитики.</p><p class="text-xs mt-1">Она появится, когда ваши опубликованные записи начнут слушать и скачивать.</p></div>`;
            return;
        }

        const maxDemand = Math.max(...Object.values(data.byCategory).map(c => c.demand), 1);

        // Линейный график активности по датам публикаций (последние 14 дней)
        const days = [];
        const now = new Date();
        for (let i = 13; i >= 0; i--) {
            const d = new Date(now);
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() - i);
            days.push({ key: d.toISOString().slice(0, 10), label: `${d.getDate()}.${d.getMonth() + 1}`, value: 0 });
        }
        const myLogin = window.currentUser?.loginName || String(window.currentUser?.username || '').toLowerCase();
        (window.soundsData || []).forEach(s => {
            if (!window.matchesRecordist || !window.matchesRecordist(s, myLogin, window.currentUser?.username)) return;
            const dayKey = (s.date || s.createdAt || '').slice(0, 10);
            const bucket = days.find(d => d.key === dayKey);
            if (bucket) bucket.value += 1;
            else if (s.plays) {
                // если даты нет — учтём активность через plays в последний день
            }
        });
        // Добавим «вес» прослушиваний/скачиваний как активность на сегодня для наглядности
        const today = days[days.length - 1];
        if (today) today.value += Math.min(20, Math.round((data.totalPlays || 0) / Math.max(1, data.totalPublished || 1)));

        const maxAct = Math.max(...days.map(d => d.value), 1);
        const w = 280, h = 120, pad = 12;
        const pts = days.map((d, i) => {
            const x = pad + (i / (days.length - 1)) * (w - pad * 2);
            const y = h - pad - (d.value / maxAct) * (h - pad * 2);
            return `${x},${y}`;
        });
        const linePath = `M ${pts.join(' L ')}`;
        const areaPath = `${linePath} L ${w - pad},${h - pad} L ${pad},${h - pad} Z`;

        container.innerHTML = `
            <div class="analytics-cards-row">
                <div class="analytics-stat-card"><div class="analytics-stat-icon"><i class="fa-solid fa-headphones text-blue-500"></i></div><div class="analytics-stat-value">${data.totalPlays}</div><div class="analytics-stat-label">Прослушиваний</div></div>
                <div class="analytics-stat-card"><div class="analytics-stat-icon"><i class="fa-solid fa-download text-emerald-500"></i></div><div class="analytics-stat-value">${data.totalDownloads}</div><div class="analytics-stat-label">Скачиваний</div></div>
                <div class="analytics-stat-card"><div class="analytics-stat-icon"><i class="fa-solid fa-file-audio text-indigo-500"></i></div><div class="analytics-stat-value">${data.totalPublished}</div><div class="analytics-stat-label">Опубликовано</div></div>
            </div>

            <div class="analytics-chart-card">
                <div class="analytics-chart-title">Активность (14 дней)</div>
                <svg class="analytics-line-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
                    <path class="area" d="${areaPath}"></path>
                    <path class="line" d="${linePath}"></path>
                </svg>
                <div class="flex justify-between text-[9px] text-slate-400 mt-1 px-0.5">
                    <span>${days[0].label}</span>
                    <span>${days[Math.floor(days.length / 2)].label}</span>
                    <span>${days[days.length - 1].label}</span>
                </div>
            </div>

            <div class="analytics-chart-card">
                <div class="analytics-chart-title">Спрос по акустическим нишам</div>
                <div class="analytics-bars">
                    ${Object.entries(data.byCategory).map(([key, c]) => `
                        <div class="analytics-bar-row">
                            <span class="analytics-bar-label"><i class="fa-solid ${ECO_ICONS[key]} mr-1"></i>${ECO_LABELS[key]} <span class="text-slate-400">(${c.count})</span></span>
                            <div class="analytics-bar-track">
                                <div class="analytics-bar-fill" style="width: ${Math.max(6, Math.round((c.demand / maxDemand) * 100))}%">
                                    <span class="analytics-bar-value">${c.demand}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="analytics-chart-card">
                <div class="analytics-chart-title">Самые популярные записи</div>
                <div class="space-y-2">
                    ${data.topSounds.map((s, i) => `
                        <div class="flex items-center gap-2.5 py-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-lg px-1.5 -mx-1.5 transition-colors" onclick="window.selectSound('${s.id}'); window.closeCabinet();">
                            <span class="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-[10px] font-bold flex items-center justify-center shrink-0">${i + 1}</span>
                            <span class="flex-1 min-w-0 text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">${s.title}</span>
                            <span class="text-[10px] text-slate-400 shrink-0"><i class="fa-solid fa-headphones mr-0.5"></i>${s.plays || 0}</span>
                            <span class="text-[10px] text-slate-400 shrink-0"><i class="fa-solid fa-download mr-0.5"></i>${s.downloads || 0}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    };

    window.openOwnPublicProfile = function() {
        if (!window.currentUser) return;
        window.closeCabinet();
        window.openPublicProfile(window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase(), window.currentUser.username);
    };
}