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
        window.showToast('Успешный вход: ' + window.currentUser.username);
        window.applyUserSettings();
        if (window.applyProfileToCurrentUser) window.applyProfileToCurrentUser();
        if (isNewRegistration && window.saveMyProfile) window.saveMyProfile({ joinedAt: new Date().toISOString() });
        window.bustFilteredSoundsCache();
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
    };

    // Подмешивает публичные данные профиля (био/ссылки/гир-лист/бейджи/дата регистрации) из
    // общего облачного profiles.json в currentUser. Вызывается и после логина (auth.js), и после
    // фонового фетча profiles.json на старте приложения (bootstrap.js) — порядок этих двух событий
    // не гарантирован, поэтому дёргаем из обоих мест.
    window.applyProfileToCurrentUser = function() {
        if (!window.currentUser) return;
        const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        const profile = window.getProfileByLogin ? window.getProfileByLogin(login) : null;
        if (!profile) return;
        window.currentUser.bio = profile.bio || '';
        window.currentUser.links = profile.links || [];
        window.currentUser.gear = profile.gear || [];
        window.currentUser.badges = profile.badges || [];
        window.currentUser.joinedAt = profile.joinedAt || window.currentUser.joinedAt;
        window.currentUser.email = profile.email || window.currentUser.email || '';
        window.currentUser.emailVerified = !!profile.emailVerified;
        if (profile.avatar && !window.currentUser.avatar) window.currentUser.avatar = profile.avatar;
    };

    // Единая точка сохранения профиля: патчит currentUser переданными полями и апсертит
    // соответствующую запись в общем profiles.json (облако), синхронно с сессией в localStorage.
    window.saveMyProfile = async function(fields = {}) {
        if (!window.currentUser) return false;
        Object.assign(window.currentUser, fields);
        localStorage.setItem('rosmap_user', JSON.stringify(window.currentUser));

        const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        const record = {
            loginName: login,
            displayName: window.currentUser.username,
            avatar: window.currentUser.avatar || '',
            bio: window.currentUser.bio || '',
            links: window.currentUser.links || [],
            gear: window.currentUser.gear || [],
            badges: window.currentUser.badges || [],
            email: window.currentUser.email || '',
            emailVerified: !!window.currentUser.emailVerified,
            joinedAt: window.currentUser.joinedAt || new Date().toISOString()
        };

        const updated = [...(window.profilesData || [])];
        const idx = updated.findIndex(p => p.loginName === login);
        if (idx >= 0) updated[idx] = { ...updated[idx], ...record }; else updated.push(record);

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

    // Удаляет саму сессию и отвязывает от неё звуки (они остаются, просто теряют sessionId).
    window.deleteSession = async function(sessionId) {
        if (!window.currentUser) return false;
        const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        const updated = [...(window.profilesData || [])];
        const idx = updated.findIndex(p => p.loginName === login);
        if (idx < 0) return false;
        updated[idx] = { ...updated[idx], sessions: (updated[idx].sessions || []).filter(s => s.id !== sessionId) };

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

    // --- Вкладка "Экспедиции" в левой панели звуков: быстрый доступ к своим сессиям прямо
    // с карты, без захода в приватный кабинет. Клик по карточке фильтрует #sounds-list. ---
    window.renderSidebarExpeditions = function() {
        const container = document.getElementById('panel-expeditions');
        if (!container) return;

        if (!window.currentUser) {
            container.innerHTML = `
                <div class="text-center py-6 text-slate-400 dark:text-slate-500">
                    <i class="fa-solid fa-route text-3xl mb-2 opacity-30 block"></i>
                    <p class="text-xs font-medium">Войдите, чтобы вести свои экспедиции и группировать звуки по выездам.</p>
                    <button onclick="window.openAuthModal()" class="mt-3 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm">Войти</button>
                </div>`;
            return;
        }

        const sessions = window.getMySessions();
        const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        const mySounds = window.getUserSounds(login, window.currentUser.username, { includeAllStatuses: true });

        const resetChip = `
            <button onclick="window.setSidebarSessionFilter(null)" class="sidebar-expedition-reset ${!window.activeSessionId ? 'active' : ''}">
                <i class="fa-solid fa-layer-group"></i>Все звуки
            </button>`;

        if (!sessions.length) {
            container.innerHTML = `
                ${resetChip}
                <div class="text-center py-6 text-slate-400 dark:text-slate-500">
                    <i class="fa-solid fa-route text-3xl mb-2 opacity-30 block"></i>
                    <p class="text-xs font-medium">У вас пока нет экспедиций.</p>
                    <button onclick="window.openSessionModal()" class="mt-3 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm"><i class="fa-solid fa-plus mr-1"></i>Создать</button>
                </div>`;
            return;
        }

        container.innerHTML = resetChip + sessions.map(session => {
            const count = mySounds.filter(s => s.sessionId === session.id).length;
            const dateStr = session.date ? new Date(session.date).toLocaleDateString('ru-RU') : '';
            const active = window.activeSessionId === session.id;
            return `
            <div class="sidebar-expedition-card ${active ? 'active' : ''}" onclick="window.setSidebarSessionFilter('${session.id}')">
                <div class="flex items-center justify-between gap-2">
                    <h5 class="font-bold text-slate-800 dark:text-white text-xs truncate">${session.title}</h5>
                    <span class="sidebar-expedition-count">${count}</span>
                </div>
                ${dateStr || session.route ? `<p class="text-[10px] text-slate-400 mt-0.5 truncate">${dateStr ? `<i class="fa-regular fa-calendar mr-1"></i>${dateStr}` : ''}${dateStr && session.route ? ' · ' : ''}${session.route ? `<i class="fa-solid fa-route mr-1"></i>${session.route}` : ''}</p>` : ''}
            </div>`;
        }).join('') + `
            <button onclick="window.openSessionModal()" class="sidebar-expedition-add"><i class="fa-solid fa-plus mr-1.5"></i>Новая экспедиция</button>`;
    };

    window.setSidebarSessionFilter = function(sessionId) {
        window.activeSessionId = sessionId || null;
        if (window.renderList) window.renderList();
        if (window.renderSidebarExpeditions) window.renderSidebarExpeditions();
    };

    // --- Полноценная форма экспедиции: дата, цели, маршрут, участники (свои+гости), медиа, ссылки ---
    window.__editingSessionId = null;
    window.__sessionFormPhotos = [];

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
        window.renderSessionPhotosPreview();
        window.renderSessionParticipantsPicker(session?.participants || []);

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

        const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        const updated = [...(window.profilesData || [])];
        const idx = updated.findIndex(p => p.loginName === login);

        const isEdit = !!window.__editingSessionId;
        const existingSessions = idx >= 0 ? [...(updated[idx].sessions || [])] : [];

        let sessionObj;
        if (isEdit) {
            sessionObj = existingSessions.find(s => s.id === window.__editingSessionId);
            if (!sessionObj) { window.showToast('Экспедиция не найдена'); return; }
            Object.assign(sessionObj, { title, date, route, purpose, guests, videoLinks, links, participants, photos });
        } else {
            sessionObj = {
                id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                title, date, route, purpose, guests, videoLinks, links, participants, photos,
                createdAt: new Date().toISOString()
            };
            existingSessions.push(sessionObj);
        }

        if (idx >= 0) updated[idx] = { ...updated[idx], sessions: existingSessions };
        else updated.push({ loginName: login, displayName: window.currentUser.username, sessions: existingSessions });

        window.showToast('Сохранение экспедиции...');
        const success = await window.syncProfilesData(updated);
        if (success) {
            window.showToast(isEdit ? 'Экспедиция обновлена' : 'Экспедиция создана');
            window.closeSessionModal();
            if (window.populateSessionSelect) window.populateSessionSelect(sessionObj.id);
            if (window.renderSessionsPanel) window.renderSessionsPanel();
            if (window.renderSidebarExpeditions) window.renderSidebarExpeditions();
        } else {
            window.showToast('Не удалось сохранить экспедицию');
        }
    };

    // Применение настроек профиля к интерфейсу
    window.applyUserSettings = function() {
        if(!window.currentUser || !window.currentUser.settings) return;
        const s = window.currentUser.settings;
        if(s.theme) window.setTheme(s.theme, true);
        if(s.mapStyle) window.setMapStyle(s.mapStyle, true);
        if(s.lang) window.setLanguage(s.lang, true);
        if(s.guiScale) window.changeGUISize(s.guiScale, true);
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
        const m = document.getElementById('cabinet-modal');
        if(m) {
            m.classList.remove('hidden');
            void m.offsetWidth;
            m.classList.remove('opacity-0', 'pointer-events-none');
            m.firstElementChild.classList.remove('scale-95');
            window.refreshCabinetTabs();
            window.switchCabinetTab('sounds');
        }
    };

    window.openSettingsPanel = function() {
        const m = document.getElementById('settings-modal');
        if (!m) return;
        if (window.closeCabinet) window.closeCabinet();
        m.classList.remove('hidden');
        void m.offsetWidth;
        m.classList.remove('opacity-0', 'pointer-events-none');
        m.firstElementChild.classList.remove('scale-95');
        window.refreshSettingsUI();
        if (window.renderRegionStats) window.renderRegionStats('region-stats-grid');
    };

    window.closeSettingsModal = function() {
        const m = document.getElementById('settings-modal');
        if (!m) return;
        m.classList.add('opacity-0', 'pointer-events-none');
        m.firstElementChild.classList.add('scale-95');
        setTimeout(() => { if (m.classList.contains('opacity-0')) m.classList.add('hidden'); }, 300);
    };

    window.refreshSettingsUI = function() {
        const themeLightBtn = document.getElementById('theme-light-btn');
        const themeDarkBtn = document.getElementById('theme-dark-btn');
        const mapNormalBtn = document.getElementById('map-normal-btn');
        const mapMonoBtn = document.getElementById('map-mono-btn');
        const langSelect = document.getElementById('lang-select');
        const scaleButtons = document.querySelectorAll('[data-scale]');

        const activeClass = 'flex-1 py-2 text-xs font-bold bg-blue-600 text-white shadow-md rounded-lg transition-all';
        const inactiveClass = 'flex-1 py-2 text-xs font-bold bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-lg transition-all';

        if (themeLightBtn && themeDarkBtn) {
            const isDark = window.currentTheme === 'dark';
            themeLightBtn.className = isDark ? inactiveClass : activeClass;
            themeDarkBtn.className = isDark ? activeClass : inactiveClass;
        }

        if (mapNormalBtn && mapMonoBtn) {
            const isMono = window.currentMapStyle === 'monochrome';
            mapNormalBtn.className = isMono ? inactiveClass : activeClass;
            mapMonoBtn.className = isMono ? activeClass : inactiveClass;
        }

        if (langSelect) {
            langSelect.value = window.currentLang || 'ru';
        }

        scaleButtons.forEach(btn => {
            const size = btn.getAttribute('data-scale');
            const isActive = (window.currentGuiScale || 'medium') === size;
            btn.className = isActive
                ? 'p-2.5 text-xs font-bold bg-blue-600 text-white rounded-xl transition-all shadow-md'
                : 'p-2.5 text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors';
        });
    };

    window.openSupportModal = function() {
        const m = document.getElementById('support-modal');
        if (!m) return;
        if (window.closeSettingsModal) window.closeSettingsModal();
        if (window.closeCabinet) window.closeCabinet();
        m.classList.remove('hidden');
        void m.offsetWidth;
        m.classList.remove('opacity-0', 'pointer-events-none');
        m.firstElementChild.classList.remove('scale-95');
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
        const m = document.getElementById('cabinet-modal');
        if(m) {
            m.classList.add('opacity-0', 'pointer-events-none');
            m.firstElementChild.classList.add('scale-95');
            setTimeout(() => { if(m.classList.contains('opacity-0')) m.classList.add('hidden') }, 300);
        }
    };

    window.switchCabinetTab = function(tab) {
        const btnSounds = document.getElementById('cab-tab-sounds');
        const btnSessions = document.getElementById('cab-tab-sessions');
        const btnAnalytics = document.getElementById('cab-tab-analytics');
        const btnSettings = document.getElementById('cab-tab-settings');
        const btnSecurity = document.getElementById('cab-tab-security');
        const btnSupport = document.getElementById('cab-tab-support');
        const btnFaq = document.getElementById('cab-tab-faq');
        const btnAdmin = document.getElementById('cab-tab-admin');
        
        const pnlSounds = document.getElementById('cab-panel-sounds');
        const pnlSessions = document.getElementById('cab-panel-sessions');
        const pnlAnalytics = document.getElementById('cab-panel-analytics');
        const pnlSettings = document.getElementById('cab-panel-settings');
        const pnlSecurity = document.getElementById('cab-panel-security');
        const pnlSupport = document.getElementById('cab-panel-support');
        const pnlFaq = document.getElementById('cab-panel-faq');
        const pnlAdmin = document.getElementById('cab-panel-admin');

        const activeClass = "py-3 px-3 text-[13px] font-bold text-blue-600 border-b-2 border-blue-600 transition-colors whitespace-nowrap";
        const activeAdminClass = "py-3 px-3 text-[13px] font-bold text-red-600 border-b-2 border-red-600 transition-colors whitespace-nowrap";
        const inactiveClass = "py-3 px-3 text-[13px] font-bold text-slate-500 dark:text-slate-400 border-b-2 border-transparent hover:text-slate-800 dark:hover:text-slate-200 transition-colors whitespace-nowrap";

        [btnSounds, btnSessions, btnAnalytics, btnSettings, btnSecurity, btnSupport, btnFaq, btnAdmin].forEach(btn => {
            if (!btn || btn.classList.contains('hidden')) return;
            btn.className = inactiveClass;
        });

        [pnlSounds, pnlSessions, pnlAnalytics, pnlSettings, pnlSecurity, pnlSupport, pnlFaq, pnlAdmin].forEach(panel => {
            if (panel) panel.classList.add('hidden');
        });

        if (tab === 'sounds') {
            if (btnSounds) btnSounds.className = activeClass;
            if (pnlSounds) pnlSounds.classList.remove('hidden');
            window.renderCabinet();
        } else if (tab === 'sessions') {
            if (btnSessions) btnSessions.className = activeClass;
            if (pnlSessions) pnlSessions.classList.remove('hidden');
            if (window.renderSessionsPanel) window.renderSessionsPanel();
        } else if (tab === 'analytics') {
            if (btnAnalytics) btnAnalytics.className = activeClass;
            if (pnlAnalytics) pnlAnalytics.classList.remove('hidden');
            if (window.renderMyAnalytics) window.renderMyAnalytics();
        } else if (tab === 'settings') {
            if (btnSettings) btnSettings.className = activeClass;
            if (pnlSettings) pnlSettings.classList.remove('hidden');
            window.fillProfileSettingsForm();
        } else if (tab === 'security') {
            if (btnSecurity) btnSecurity.className = activeClass;
            if (pnlSecurity) pnlSecurity.classList.remove('hidden');
        } else if (tab === 'support') {
            if (btnSupport) btnSupport.className = activeClass;
            if (pnlSupport) pnlSupport.classList.remove('hidden');
        } else if (tab === 'faq') {
            if (btnFaq) btnFaq.className = activeClass;
            if (pnlFaq) pnlFaq.classList.remove('hidden');
        } else if (tab === 'admin') {
            if (btnAdmin && !btnAdmin.classList.contains('hidden')) btnAdmin.className = activeAdminClass;
            if (pnlAdmin) pnlAdmin.classList.remove('hidden');
            window.renderAdminList();
            window.renderAdminUsersList();
            window.renderReportsList();
            if (window.renderRegionStats) window.renderRegionStats('admin-stats-grid');
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
            return `
                <div class="flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer bg-white dark:bg-slate-800 rounded-xl" onclick="window.openedFromAdmin=true; window.closeCabinet(); window.selectSound('${s.id}'); window.openDetailsModal();">
                    <div class="flex-1 min-w-0 pr-4">
                        <p class="text-sm font-bold text-slate-800 dark:text-white truncate">${s.title}</p>
                        <p class="text-xs text-slate-500 truncate">${s.archiveNum}_${s.fileName} · <span class="font-semibold">${s.recordist || 'Автор'}</span></p>
                        ${status === 'rejected' && s.rejectionReason ? `<p class="text-[11px] text-red-500 truncate mt-0.5"><i class="fa-solid fa-circle-exclamation mr-1"></i>${s.rejectionReason}</p>` : ''}
                    </div>
                    <div class="flex items-center gap-2 flex-wrap justify-end" onclick="event.stopPropagation()">
                        ${isHardcoded ? `<span class="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">Вшито</span>` : ''}
                        ${isPending ? `
                            <button onclick="window.setSoundStatus('${s.id}', 'published')" class="text-emerald-600 hover:text-white bg-emerald-50 hover:bg-emerald-500 dark:bg-emerald-900/30 dark:hover:bg-emerald-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm"><i class="fa-solid fa-check mr-1"></i>Одобрить</button>
                            <button onclick="window.setSoundStatus('${s.id}', 'rejected')" class="text-red-600 hover:text-white bg-red-50 hover:bg-red-500 dark:bg-red-900/30 dark:hover:bg-red-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm"><i class="fa-solid fa-xmark mr-1"></i>Отклонить</button>
                        ` : `
                            <select onchange="window.setSoundStatus('${s.id}', this.value)" class="text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-2 py-1.5">
                                <option value="published" ${status === 'published' ? 'selected' : ''}>Опубликовано</option>
                                <option value="pending" ${status === 'pending' ? 'selected' : ''}>На модерации</option>
                                <option value="rejected" ${status === 'rejected' ? 'selected' : ''}>Отклонено</option>
                            </select>
                        `}
                        <button onclick="window.openedFromAdmin=true; window.editSound('${s.id}'); window.closeCabinet();" class="text-blue-600 hover:text-white bg-blue-50 hover:bg-blue-500 dark:bg-blue-900/30 dark:hover:bg-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm">Изменить</button>
                        <button onclick="window.deleteSoundFromCloud('${s.id}')" class="text-red-600 hover:text-white bg-red-50 hover:bg-red-500 dark:bg-red-900/30 dark:hover:bg-red-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm">Удалить</button>
                    </div>
                </div>
            `;
        }).join('');
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
        if (success) { window.showToast('Статус обновлён'); window.renderAdminList(); }
    };

    // --- Жалобы (на записи и на комментарии) — очередь модерации в админ-панели ---
    window.getAllReports = function() {
        const list = [];
        (window.soundsData || []).forEach(s => {
            (s.reports || []).forEach(r => list.push({ ...r, soundId: s.id, soundTitle: s.title }));
        });
        return list.sort((a, b) => new Date(b.date) - new Date(a.date));
    };

    window.renderReportsList = function() {
        const container = document.getElementById('admin-reports-list');
        const countEl = document.getElementById('admin-reports-count');
        if (!container) return;

        const reports = window.getAllReports();
        const pendingCount = reports.filter(r => r.status !== 'resolved').length;
        if (countEl) countEl.textContent = pendingCount ? `(${pendingCount})` : '';

        if (!reports.length) {
            container.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">Жалоб пока нет.</p>`;
            return;
        }

        container.innerHTML = reports.map(r => {
            const s = window.soundsData.find(x => x.id === r.soundId);
            let targetText = '';
            if (r.type === 'comment') {
                const c = s ? (s.comments || []).find(x => x.id === r.commentId) : null;
                targetText = c ? `Комментарий: «${c.text}»` : 'Комментарий уже удалён';
            }
            const dateStr = r.date ? new Date(r.date).toLocaleDateString('ru-RU') : '';
            return `
            <div class="admin-report-row ${r.status === 'resolved' ? 'resolved' : ''}">
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">${r.type === 'comment' ? 'Жалоба на комментарий' : 'Жалоба на запись'} <span class="text-slate-400 font-normal">· ${r.soundTitle || ''}</span></p>
                    ${targetText ? `<p class="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">${targetText}</p>` : ''}
                    <p class="text-[11px] text-red-500 dark:text-red-400 mt-0.5 truncate"><i class="fa-solid fa-quote-left mr-1 opacity-60"></i>${r.reason}</p>
                    <p class="text-[10px] text-slate-400 mt-0.5">От ${r.reporterName || 'аноним'} · ${dateStr}</p>
                </div>
                <div class="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                    <button onclick="window.openedFromAdmin=true; window.closeCabinet(); window.selectSound('${r.soundId}'); window.openDetailsModal();" class="text-blue-600 hover:text-white bg-blue-50 hover:bg-blue-500 dark:bg-blue-900/30 dark:hover:bg-blue-600 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors">Просмотреть</button>
                    ${r.type === 'comment' && s && (s.comments || []).some(c => c.id === r.commentId) ? `<button onclick="window.deleteReportedComment('${r.soundId}', '${r.commentId}', '${r.id}')" class="text-red-600 hover:text-white bg-red-50 hover:bg-red-500 dark:bg-red-900/30 dark:hover:bg-red-600 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors">Удалить коммент.</button>` : ''}
                    ${r.status !== 'resolved' ? `<button onclick="window.resolveReport('${r.soundId}', '${r.id}')" class="text-emerald-600 hover:text-white bg-emerald-50 hover:bg-emerald-500 dark:bg-emerald-900/30 dark:hover:bg-emerald-600 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors">Решено</button>` : `<span class="pub-status-pill pub-status-published">Решено</span>`}
                </div>
            </div>`;
        }).join('');
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
        if (success) { window.showToast('Жалоба отмечена решённой'); window.renderReportsList(); }
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
        if (success) { window.showToast('Комментарий удалён'); window.renderReportsList(); if (window.renderComments) window.renderComments(s); }
    };

    // --- Профили пользователей внутри админ-панели: назначение бейджей доверия ---
    window.renderAdminUsersList = function() {
        const el = document.getElementById('admin-users-grid');
        if (!el) return;
        const profiles = window.profilesData || [];
        if (!profiles.length) {
            el.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">Пока нет зарегистрированных профилей.</p>`;
            return;
        }
        el.innerHTML = profiles.map(p => `
            <div class="admin-user-row">
                <div class="admin-user-row-name"><i class="fa-solid fa-user-astronaut mr-1.5 opacity-60"></i>${p.displayName || p.loginName}</div>
                <div class="admin-user-row-badges">
                    ${Object.entries(window.BADGE_CATALOG || {}).map(([key, b]) => `
                        <label class="badge-toggle-chip ${(p.badges || []).includes(key) ? 'active' : ''}">
                            <input type="checkbox" class="hidden" ${(p.badges || []).includes(key) ? 'checked' : ''} onchange="window.toggleUserBadge('${p.loginName}', '${key}', this.checked)">
                            <i class="fa-solid ${b.icon}"></i>${b.label}
                        </label>
                    `).join('')}
                </div>
            </div>
        `).join('');
    };

    window.toggleUserBadge = async function(login, badgeKey, checked) {
        const updated = [...(window.profilesData || [])];
        const idx = updated.findIndex(p => p.loginName === login);
        if (idx < 0) return;
        const badges = new Set(updated[idx].badges || []);
        if (checked) badges.add(badgeKey); else badges.delete(badgeKey);
        updated[idx] = { ...updated[idx], badges: Array.from(badges) };
        const success = await window.syncProfilesData(updated);
        if (success) { window.showToast('Бейджи обновлены'); window.renderAdminUsersList(); }
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

        container.innerHTML = `
            <div class="analytics-cards-row">
                <div class="analytics-stat-card"><div class="analytics-stat-icon"><i class="fa-solid fa-headphones text-blue-500"></i></div><div class="analytics-stat-value">${data.totalPlays}</div><div class="analytics-stat-label">Прослушиваний</div></div>
                <div class="analytics-stat-card"><div class="analytics-stat-icon"><i class="fa-solid fa-download text-emerald-500"></i></div><div class="analytics-stat-value">${data.totalDownloads}</div><div class="analytics-stat-label">Скачиваний</div></div>
                <div class="analytics-stat-card"><div class="analytics-stat-icon"><i class="fa-solid fa-file-audio text-indigo-500"></i></div><div class="analytics-stat-value">${data.totalPublished}</div><div class="analytics-stat-label">Опубликовано</div></div>
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