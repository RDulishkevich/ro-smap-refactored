export function initAuth() {
    // Сессия без JWT больше не считается валидной (иначе роль можно подделать в DevTools).
    const token = (() => { try { return localStorage.getItem('rosmap_token'); } catch (_) { return null; } })();
    const savedUserStr = localStorage.getItem('rosmap_user');
    if (savedUserStr && token) {
        try { window.currentUser = JSON.parse(savedUserStr); } catch (_) { window.currentUser = null; }
    } else {
        window.currentUser = null;
        try {
            localStorage.removeItem('rosmap_user');
            if (!token) localStorage.removeItem('rosmap_token');
        } catch (_) {}
    }
    
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

    window.isAuthFormDirty = function() {
        const name = (document.getElementById('auth-username')?.value || '').trim();
        const pass = (document.getElementById('auth-password')?.value || '').trim();
        return !!(name || pass);
    };

    window.requestCloseAuthModal = async function() {
        if (window.requestCloseIfDirty) {
            return window.requestCloseIfDirty(
                window.isAuthFormDirty,
                'Введённые данные входа / регистрации будут сброшены.',
                window.closeAuthModal
            );
        }
        window.closeAuthModal();
        return true;
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
                <div>
                    <label class="modal-label">Уровень умений в полевой записи</label>
                    <select id="auth-skill-level" class="modal-input dark:bg-slate-900 text-sm">
                        <option value="">Выберите…</option>
                        <option value="beginner">Новичок — только начинаю</option>
                        <option value="intermediate">Любитель — уже записываю</option>
                        <option value="advanced">Продвинутый — регулярно в поле</option>
                        <option value="pro">Профи — работа / исследования</option>
                    </select>
                </div>
                <div>
                    <label class="modal-label">Для чего хотите использовать Полёвку?</label>
                    <div class="space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
                        <label class="flex items-center gap-2"><input type="checkbox" name="auth-intent" value="listen" class="rounded"> Слушать карту и открывать места</label>
                        <label class="flex items-center gap-2"><input type="checkbox" name="auth-intent" value="publish" class="rounded"> Публиковать свои записи</label>
                        <label class="flex items-center gap-2"><input type="checkbox" name="auth-intent" value="research" class="rounded"> Исследования / учёба</label>
                        <label class="flex items-center gap-2"><input type="checkbox" name="auth-intent" value="education" class="rounded"> Обучение полевой записи</label>
                        <label class="flex items-center gap-2"><input type="checkbox" name="auth-intent" value="community" class="rounded"> Сообщество и экспедиции</label>
                        <label class="flex items-center gap-2"><input type="checkbox" name="auth-intent" value="other" class="rounded"> Другое</label>
                    </div>
                </div>
                <label class="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 leading-snug">
                    <input type="checkbox" id="auth-pd-consent" class="mt-0.5 rounded shrink-0">
                    <span>Согласен(на) на обработку персональных данных (логин, профиль, активность) для работы сервиса Полёвка. <button type="button" class="text-blue-600 dark:text-blue-400 font-semibold hover:underline" onclick="event.preventDefault(); window.openPdConsentInfo && window.openPdConsentInfo()">Подробнее</button></span>
                </label>
                <p class="text-[10px] text-slate-400 leading-tight">Этот логин будет автоматически использоваться как CreatorID при добавлении ваших аудиозаписей.</p>
            `;
        }
    };

    window.openPdConsentInfo = async function() {
        if (!window.CustomUI?.open) return;
        await window.CustomUI.open({
            title: 'Персональные данные',
            message: '<div class="text-left text-sm text-slate-600 dark:text-slate-300 space-y-2"><p>Мы обрабатываем логин, отображаемое имя, аватар, сообщения и метаданные записей, чтобы вы могли пользоваться картой, кабинетом и модерацией.</p><p>Данные хранятся в облаке сервиса. Вы можете запросить удаление через поддержку.</p><p class="text-xs text-slate-400">Файлы cookie браузера сервис не использует: сессия и настройки хранятся в localStorage на вашем устройстве.</p></div>',
            confirmText: 'Понятно'
        });
    };

    window.submitAuth = async function() {
        const name = document.getElementById('auth-username').value.trim();
        const pass = document.getElementById('auth-password').value.trim();

        if (!name || !pass) return window.showToast('Заполните все поля!');
        if (pass.length < 4) return window.showToast('Пароль слишком короткий (мин. 4)');

        let regSurvey = null;
        if (window.authMode === 'register') {
            const pd = document.getElementById('auth-pd-consent');
            if (!pd?.checked) return window.showToast('Нужно согласие на обработку персональных данных');
            const skill = (document.getElementById('auth-skill-level')?.value || '').trim();
            if (!skill) return window.showToast('Укажите уровень умений');
            const intents = Array.from(document.querySelectorAll('input[name="auth-intent"]:checked')).map((el) => el.value);
            if (!intents.length) return window.showToast('Выберите хотя бы одну цель использования');
            regSurvey = {
                skillLevel: skill,
                platformIntents: intents,
                pdConsentAt: new Date().toISOString(),
                pdConsent: true
            };
        }

        const login = name.toLowerCase();
        const actionBtn = document.getElementById('auth-action-btn');
        if (actionBtn) actionBtn.disabled = true;

        const finishOk = async (data, isNewRegistration) => {
            window.setAuthSession(data.token, data.user);
            window.closeAuthModal();
            if (window.applyProfileToCurrentUser) window.applyProfileToCurrentUser();
            if (window.currentUser?.blocked) {
                window.clearAuthSession();
                return window.showToast('Аккаунт заблокирован администратором');
            }
            window.showToast('Успешный вход: ' + (window.currentUser.username || login));
            window.applyUserSettings();
            if (isNewRegistration && window.saveMyProfile) {
                await window.saveMyProfile({
                    joinedAt: new Date().toISOString(),
                    ...(regSurvey || {})
                });
            }
            window.bustFilteredSoundsCache();
            if (window.refreshNotificationsUI) window.refreshNotificationsUI();
            if (window.refreshMessagesUI) window.refreshMessagesUI();
            if (window.ensureSupportWelcome) window.ensureSupportWelcome();
            if (window.touchMyPresence) window.touchMyPresence(true);
            if (window.syncAccountChrome) window.syncAccountChrome();
            if (window.refreshCabinetTabs) window.refreshCabinetTabs();
            if (window.enableDeviceNotifications) window.enableDeviceNotifications({ quiet: true });
            if (window.__pendingSupportOpen) {
                window.__pendingSupportOpen = false;
                if (window.openMessagesModal) window.openMessagesModal(window.SUPPORT_LOGIN || 'support');
            } else {
                window.openCabinet();
            }
        };

        try {
            if (!window.apiLogin) throw new Error('API недоступен');

            if (window.authMode === 'register') {
                const reg = await window.apiRegister(login, pass, name);
                await finishOk(reg, true);
                return;
            }

            try {
                const data = await window.apiLogin(login, pass);
                await finishOk(data, false);
                return;
            } catch (err) {
                // Миграция со старого localStorage-аккаунта в облако
                if (err.code === 'no_user') {
                    let usersDb = {};
                    try { usersDb = JSON.parse(localStorage.getItem('rosmap_users_db') || '{}'); } catch (_) {}
                    const local = usersDb[login];
                    if (local && local.password === pass) {
                        const reg = await window.apiRegister(login, pass, local.displayName || name);
                        await finishOk(reg, false);
                        return;
                    }
                }
                if (err.code === 'blocked') return window.showToast('Аккаунт заблокирован администратором');
                if (err.code === 'bad_credentials') return window.showToast('Неверный логин или пароль!');
                if (err.code === 'login_taken') return window.showToast('Логин уже занят!');
                throw err;
            }
        } catch (err) {
            console.error(err);
            const msg = err.code === 'server_misconfigured'
                ? 'Облачный API ещё не настроен (см. cloud/api/README.md)'
                : (err.message || 'Ошибка входа');
            window.showToast(msg);
        } finally {
            if (actionBtn) actionBtn.disabled = false;
        }
    };

    window.logoutUser = async function() {
        const confirmed = await window.CustomUI.open({
            title: '<i class="fa-solid fa-right-from-bracket mr-2 text-red-500"></i>Выйти из аккаунта?',
            message: 'Вы уверены, что хотите выйти? Несохранённые данные на этом устройстве могут быть потеряны.',
            confirmText: 'Выйти',
            confirmClass: 'px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-md'
        });
        if (!confirmed) return;

        window.currentUser = null;
        if (window.clearAuthSession) window.clearAuthSession();
        else {
            try {
                localStorage.removeItem('rosmap_user');
                localStorage.removeItem('rosmap_token');
            } catch (_) {}
        }
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
        if (window.refreshProfileButtonAvatar) window.refreshProfileButtonAvatar();
        if (window.refreshCabinetTabs) window.refreshCabinetTabs();
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
        window.currentUser.progress = profile.progress || window.currentUser.progress || window.getEmptyProgress?.() || { xp: 0, achievements: [], completedQuests: [], guessrBestScore: 0 };
        window.currentUser.joinedAt = profile.joinedAt || window.currentUser.joinedAt;
        window.currentUser.email = profile.email || window.currentUser.email || '';
        window.currentUser.emailVerified = !!profile.emailVerified;
        window.currentUser.blocked = !!profile.blocked;
        window.currentUser.skillLevel = profile.skillLevel || window.currentUser.skillLevel || '';
        window.currentUser.platformIntents = Array.isArray(profile.platformIntents)
            ? profile.platformIntents
            : (window.currentUser.platformIntents || []);
        window.currentUser.pdConsent = profile.pdConsent != null ? !!profile.pdConsent : !!window.currentUser.pdConsent;
        window.currentUser.pdConsentAt = profile.pdConsentAt || window.currentUser.pdConsentAt || '';
        window.currentUser.pushSubscription = profile.pushSubscription || window.currentUser.pushSubscription || null;
        if (login !== 'admin') {
            window.currentUser.role = profile.role === 'admin' ? 'admin' : 'user';
        }
        if (profile.avatar) window.currentUser.avatar = profile.avatar;
        if (profile.displayName) window.currentUser.username = profile.displayName;

        if (window.currentUser.blocked && login !== 'admin') {
            if (window.clearAuthSession) window.clearAuthSession();
            else {
                window.currentUser = null;
                localStorage.removeItem('rosmap_user');
            }
            window.showToast('Аккаунт заблокирован администратором');
        }

        if (window.refreshNotificationsUI) window.refreshNotificationsUI();
        if (window.refreshMessagesUI) window.refreshMessagesUI();
        if (window.__sidebarTab === 'feed' && window.renderSidebarFeed) window.renderSidebarFeed();
        if (window.refreshProfileButtonAvatar) window.refreshProfileButtonAvatar();
        if (window.refreshCabinetTabs) window.refreshCabinetTabs();
    };

    // Единая точка сохранения профиля: патчит currentUser переданными полями и апсертит
    // соответствующую запись в общем profiles.json. sessions/notifications/role/blocked
    // сохраняются, если не переданы явно в fields.
    window.saveMyProfile = async function(fields = {}) {
        if (!window.currentUser) return false;
        Object.assign(window.currentUser, fields);
        localStorage.setItem('rosmap_user', JSON.stringify(window.currentUser));

        const login = String(window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase()).toLowerCase();
        const updated = [...(window.profilesData || [])];
        const idx = updated.findIndex(p => String(p.loginName || '').toLowerCase() === login);
        const prev = idx >= 0 ? updated[idx] : {};

        const record = {
            ...prev,
            loginName: login,
            displayName: window.currentUser.username,
            avatar: window.currentUser.avatar || prev.avatar || '',
            bio: fields.bio !== undefined ? (window.currentUser.bio || '') : (window.currentUser.bio ?? prev.bio ?? ''),
            links: fields.links !== undefined ? (window.currentUser.links || []) : (window.currentUser.links || prev.links || []),
            gear: fields.gear !== undefined ? (window.currentUser.gear || []) : (window.currentUser.gear || prev.gear || []),
            badges: window.currentUser.badges || prev.badges || [],
            progress: window.currentUser.progress || prev.progress || { xp: 0, achievements: [], completedQuests: [], guessrBestScore: 0 },
            email: window.currentUser.email || '',
            emailVerified: !!window.currentUser.emailVerified,
            joinedAt: window.currentUser.joinedAt || prev.joinedAt || new Date().toISOString(),
            skillLevel: window.currentUser.skillLevel || prev.skillLevel || '',
            platformIntents: Array.isArray(window.currentUser.platformIntents)
                ? window.currentUser.platformIntents
                : (prev.platformIntents || []),
            pdConsent: window.currentUser.pdConsent != null ? !!window.currentUser.pdConsent : !!prev.pdConsent,
            pdConsentAt: window.currentUser.pdConsentAt || prev.pdConsentAt || '',
            pushSubscription: window.currentUser.pushSubscription || prev.pushSubscription || null,
            sessions: prev.sessions || [],
            notifications: fields.notifications !== undefined ? fields.notifications : (prev.notifications || []),
            inbox: fields.inbox !== undefined ? fields.inbox : (prev.inbox || []),
            activityLog: prev.activityLog || [],
            typing: prev.typing || null,
            role: fields.role !== undefined ? fields.role : (prev.role || (window.currentUser.role === 'admin' ? 'admin' : 'user')),
            blocked: fields.blocked !== undefined ? !!fields.blocked : !!prev.blocked,
            profileUpdatedAt: new Date().toISOString(),
            lastSeen: new Date().toISOString()
        };

        if (fields.bio !== undefined) record.bio = String(fields.bio || '');
        if (fields.gear !== undefined) record.gear = Array.isArray(fields.gear) ? fields.gear : [];
        if (fields.links !== undefined) record.links = Array.isArray(fields.links) ? fields.links : [];
        if (fields.skillLevel !== undefined) record.skillLevel = String(fields.skillLevel || '');
        if (fields.platformIntents !== undefined) {
            record.platformIntents = Array.isArray(fields.platformIntents) ? fields.platformIntents : [];
        }
        if (fields.pdConsent !== undefined) record.pdConsent = !!fields.pdConsent;
        if (fields.pdConsentAt !== undefined) record.pdConsentAt = fields.pdConsentAt || '';
        if (fields.pushSubscription !== undefined) record.pushSubscription = fields.pushSubscription || null;
        if (fields.avatar !== undefined) {
            const av = fields.avatar || '';
            record.avatar = (window.isForbiddenMediaUrl && window.isForbiddenMediaUrl(av)) ? '' : av;
        }
        if (fields.username !== undefined) record.displayName = fields.username;

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
        if (window.buildUcsFileName && window.resolveProjectSourceId) {
            s.fileName = window.buildUcsFileName({
                catId: s.typeTag || 'AMBMisc',
                fxName: s.fxName || s.title || 'Untitled',
                creatorId: s.recordistId || s.recordist || 'Anon',
                sourceId: window.resolveProjectSourceId(sessionId),
                channels: s.channels,
                location: s.location
            });
        }
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
            s.rejectionReason = '';
            s.seenByAuthor = true;
            const idx = updatedCloud.findIndex(x => x.id === s.id);
            if (idx >= 0) updatedCloud[idx] = s; else updatedCloud.push(s);
        });

        window.showToast('Публикация записей экспедиции...');
        const success = await window.syncCloudData(updatedCloud);
        if (success) {
            window.showToast(`Отправлено на модерацию: ${drafts.length}`);
            window.renderSessionsPanel();
            if (window.pushNotifications) {
                for (const s of drafts) {
                    window.pushNotifications([login], {
                        type: 'moderation',
                        text: `Запись «${s.title}» отправлена на модерацию`,
                        fromId: null,
                        fromName: 'Полёвка',
                        soundId: s.id,
                        soundTitle: s.title,
                        action: 'edit',
                        moderationStatus: 'pending'
                    });
                }
            }
        }
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
            <div class="session-card cursor-pointer" onclick="window.openCabinetExpedition('${session.id}')">
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
                            ${(session.videoLinks || []).map(url => `<a href="${url}" target="_blank" rel="noopener" class="profile-link-chip" onclick="event.stopPropagation()"><i class="fa-solid fa-film"></i>Видео</a>`).join('')}
                            ${(session.links || []).map(url => `<a href="${url}" target="_blank" rel="noopener" class="profile-link-chip" onclick="event.stopPropagation()"><i class="fa-solid fa-link"></i>Ресурс</a>`).join('')}
                        </div>` : ''}
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0" onclick="event.stopPropagation()">
                        <button onclick="window.openSessionModal('${session.id}')" class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 flex items-center justify-center transition-colors" title="Редактировать экспедицию">
                            <i class="fa-solid fa-pen text-xs"></i>
                        </button>
                        <button onclick="window.deleteSession('${session.id}').then(() => window.renderSessionsPanel())" class="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-500 flex items-center justify-center transition-colors" title="Удалить экспедицию">
                            <i class="fa-solid fa-trash-can text-xs"></i>
                        </button>
                    </div>
                </div>
                ${soundsInSession.length ? `
                <div class="session-sound-list" onclick="event.stopPropagation()">
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
                <button onclick="event.stopPropagation(); window.publishSessionDrafts('${session.id}')" class="mt-3 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm">
                    <i class="fa-solid fa-cloud-arrow-up mr-1.5"></i>Опубликовать все черновики (${draftCount})
                </button>` : ''}
            </div>`;
        }).join('');
    };

    window.openCabinetExpedition = function(sessionId) {
        if (window.closeCabinet) window.closeCabinet();
        if (window.openExpeditionViewModal) window.openExpeditionViewModal(sessionId);
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

        if (window.openDockView) {
            if (window.playSfx) window.playSfx('open');
            // Prefer returning to the expeditions catalog after "Назад".
            if (window.__sidebarTab !== 'library' && window.__sidebarTab !== 'feed' && window.__sidebarTab !== 'help') {
                window.__sidebarTab = 'expeditions';
            }
            window.openDockView('expedition');
            return;
        }

        const m = document.getElementById('expedition-view-modal');
        const c = document.getElementById('expedition-view-modal-content');
        if (!m || !c) return;
        m.classList.remove('hidden');
        void m.offsetWidth;
        m.classList.remove('opacity-0', 'pointer-events-none');
        c.classList.remove('scale-95');
        if (window.playSfx) window.playSfx('open');
    };

    window.closeExpeditionViewModal = function() {
        const content = document.getElementById('expedition-view-modal-content');
        const inDock = content && content.classList.contains('expedition-in-dock');
        if (inDock) {
            if (!window.__skipExpeditionDockClose && window.playSfx) window.playSfx('close');
            if (window.undockExpeditionContent) window.undockExpeditionContent();
            if (!window.__skipExpeditionDockClose && window.__dockView === 'expedition' && window.openDockView) {
                window.openDockView(window.__sidebarTab || 'expeditions');
            }
        } else {
            const m = document.getElementById('expedition-view-modal');
            const c = document.getElementById('expedition-view-modal-content');
            if (!m || !c) return;
            m.classList.add('opacity-0', 'pointer-events-none');
            c.classList.add('scale-95');
            if (window.playSfx) window.playSfx('close');
            setTimeout(() => { if (m.classList.contains('opacity-0')) m.classList.add('hidden'); }, 300);
        }
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
        if (window.processFilterChange) window.processFilterChange(false);
        else {
            if (window.renderList) window.renderList();
            if (window.updateMapMarkers) window.updateMapMarkers();
            if (window.renderActiveTags) window.renderActiveTags();
        }
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
        (async () => {
            window.showToast('Загрузка фото экспедиции...');
            try {
                for (const file of Array.from(files)) {
                    if (!file.type || !file.type.startsWith('image/')) continue;
                    const url = await window.uploadImageToStorage(file, `session_${Date.now()}`);
                    window.__sessionFormPhotos = window.__sessionFormPhotos || [];
                    window.__sessionFormPhotos.push(url);
                }
                window.renderSessionPhotosPreview();
                window.showToast('Фото добавлено');
            } catch (err) {
                console.error(err);
                window.showToast(err.message || 'Не удалось загрузить фото');
            }
        })();
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
        const photos = [...(window.__sessionFormPhotos || [])]
            .filter((u) => window.isHttpMediaUrl ? window.isHttpMediaUrl(u) : (typeof u === 'string' && /^https?:\/\//i.test(u)));
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

            if (!isEdit && window.evaluateFieldProgress) window.evaluateFieldProgress();

            const newlyAdded = participants.filter(p => !prevParticipants.has(p) && p !== login);
            if (newlyAdded.length && window.pushNotifications) {
                window.pushNotifications(newlyAdded, {
                    type: 'expedition',
                    text: `${window.currentUser.username} добавил(а) вас в экспедицию «${title}»`,
                    fromId: login,
                    fromName: window.currentUser.username
                });
            }
            if (newlyAdded.length && window.logUserActivity) {
                newlyAdded.forEach(p => {
                    window.logUserActivity({
                        type: 'expedition_join',
                        text: `Стал участником экспедиции «${title}»`,
                        sessionId: sessionObj.id
                    }, p);
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
        const adminMobile = document.getElementById('cab-mobile-admin');
        const railAdmin = document.getElementById('rail-admin');
        const roleEl = document.getElementById('cabinet-user-role');
        const isAdmin = window.isCurrentUserAdmin
            ? window.isCurrentUserAdmin()
            : (String(window.currentUser?.role || '').toLowerCase() === 'admin' || String(window.currentUser?.username || '').toLowerCase() === 'admin');

        if (adminTab) {
            adminTab.classList.add('hidden');
            adminTab.classList.add('pointer-events-none');
        }
        if (adminMobile) {
            adminMobile.classList.toggle('hidden', !isAdmin);
        }
        if (railAdmin) {
            railAdmin.classList.toggle('hidden', !isAdmin);
            if (!isAdmin && window.__dockView === 'admin' && window.openDockView) {
                window.openDockView('home');
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
        if (window.refreshAdminRailBadge) window.refreshAdminRailBadge();
    };

    window.refreshCabinetMobileChrome = function(tab) {
        if (window.innerWidth >= 768 || window.__dockView !== 'cabinet') return;
        const logout = document.getElementById('dock-mobile-logout');
        const back = document.getElementById('dock-back-btn');
        const closeBtn = document.getElementById('dock-mobile-close') || document.querySelector('.dock-header button[onclick*="hideDockPanel"]');
        const isHome = !tab || tab === 'sounds';
        const titles = {
            sounds: window.currentLang === 'en' ? 'Profile' : 'Профиль',
            mysounds: window.currentLang === 'en' ? 'My sounds' : 'Мои звуки',
            quests: window.currentLang === 'en' ? 'Quests' : 'Задания',
            sessions: window.currentLang === 'en' ? 'Expeditions' : 'Экспедиции',
            analytics: window.currentLang === 'en' ? 'Analytics' : 'Аналитика',
            settings: window.currentLang === 'en' ? 'Settings' : 'Настройки',
            security: window.currentLang === 'en' ? 'Password' : 'Пароль',
            admin: window.currentLang === 'en' ? 'Admin' : 'Админ-панель'
        };
        const titleEl = document.getElementById('dock-title');
        const subEl = document.getElementById('dock-subtitle');
        if (titleEl) {
            titleEl.textContent = titles[tab] || titles.sounds;
            titleEl.removeAttribute('data-lang');
        }
        if (subEl) {
            subEl.innerHTML = '';
        }
        if (isHome) {
            if (logout) logout.classList.remove('hidden');
            if (back) back.classList.add('hidden');
            if (closeBtn) {
                closeBtn.classList.remove('hidden');
                closeBtn.onclick = () => window.hideDockPanel && window.hideDockPanel();
                closeBtn.setAttribute('aria-label', 'Закрыть');
            }
        } else {
            if (logout) logout.classList.add('hidden');
            if (closeBtn) closeBtn.classList.add('hidden');
            if (back) {
                back.classList.remove('hidden');
                back.title = window.currentLang === 'en' ? 'Back' : 'Назад';
                back.setAttribute('aria-label', back.title);
                back.onclick = () => window.switchCabinetTab('sounds');
            }
        }
    };

    window.openCabinetMySounds = function() {
        if (window.innerWidth >= 768) {
            window.switchCabinetTab('sounds');
            return;
        }
        document.querySelectorAll('[data-cab-panel]').forEach(p => p.classList.add('hidden'));
        document.querySelectorAll('[data-cab-tab]').forEach(b => b.classList.remove('active'));
        const panel = document.getElementById('cab-panel-sounds');
        const tabBtn = document.getElementById('cab-tab-sounds');
        if (panel) panel.classList.remove('hidden');
        if (tabBtn) tabBtn.classList.add('active');
        document.body.classList.remove('cab-mobile-home');
        document.body.classList.add('cab-mobile-sounds');
        if (window.renderCabinet) window.renderCabinet();
        if (window.refreshCabinetMobileChrome) window.refreshCabinetMobileChrome('mysounds');
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
            setTimeout(() => { if (window.captureSettingsFormSnapshot) window.captureSettingsFormSnapshot(); }, 0);
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
        if (window.captureSettingsFormSnapshot) window.captureSettingsFormSnapshot();
    };

    window.closeSettingsModal = function() {
        const content = document.getElementById('settings-modal-content');
        if (content && content.classList.contains('settings-in-dock')) {
            if (window.playSfx) window.playSfx('close');
            if (window.undockSettingsContent) window.undockSettingsContent();
            if (window.openDockView) window.openDockView(window.__sidebarTab || 'library');
            window.__settingsFormSnapshot = null;
            return;
        }
        const m = document.getElementById('settings-modal');
        if (!m) return;
        m.classList.add('opacity-0', 'pointer-events-none');
        m.firstElementChild.classList.add('scale-95');
        if (window.playSfx) window.playSfx('close');
        setTimeout(() => { if (m.classList.contains('opacity-0')) m.classList.add('hidden'); }, 300);
        window.__settingsFormSnapshot = null;
    };

    window.captureSettingsFormSnapshot = function() {
        window.__settingsFormSnapshot = {
            dgis: document.getElementById('dgis-api-key-input')?.value ?? '',
            google: document.getElementById('google-api-key-input')?.value ?? ''
        };
    };

    window.isSettingsFormDirty = function() {
        const snap = window.__settingsFormSnapshot;
        if (!snap) return false;
        const dgis = document.getElementById('dgis-api-key-input')?.value ?? '';
        const google = document.getElementById('google-api-key-input')?.value ?? '';
        return dgis !== snap.dgis || google !== snap.google;
    };

    window.requestCloseSettingsModal = async function() {
        if (window.requestCloseIfDirty) {
            return window.requestCloseIfDirty(
                window.isSettingsFormDirty,
                'Введённые API-ключи не сохранены.',
                window.closeSettingsModal
            );
        }
        window.closeSettingsModal();
        return true;
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
        const mapOzonBtn = document.getElementById('map-provider-ozon-btn');
        const mapCartoBtn = document.getElementById('map-provider-carto-btn');
        const mapOpentopoBtn = document.getElementById('map-provider-opentopo-btn');
        const mapEsriBtn = document.getElementById('map-provider-esri-btn');
        const mapDgisBtn = document.getElementById('map-provider-dgis-btn');
        const mapGoogleBtn = document.getElementById('map-provider-google-btn');
        const provider = window.normalizeMapProvider
            ? window.normalizeMapProvider(window.currentMapProvider)
            : window.currentMapProvider;
        const setProv = (btn, id) => {
            if (!btn) return;
            btn.className = provider === id
                ? 'glass-seg__btn is-active is-active--accent'
                : 'glass-seg__btn';
        };
        setProv(mapYandexBtn, 'yandex');
        setProv(mapOzonBtn, 'ozon');
        setProv(mapMapboxBtn, 'mapbox');
        setProv(mapCartoBtn, 'carto');
        setProv(mapOpentopoBtn, 'opentopo');
        setProv(mapEsriBtn, 'esri');
        setProv(mapDgisBtn, 'dgis');
        setProv(mapGoogleBtn, 'googleearth');
        const freeSelect = document.getElementById('map-free-basemap-select');
        if (freeSelect) {
            const freeIds = window.MAPLIBRE_PROVIDER_IDS || [];
            freeSelect.value = freeIds.includes(provider) ? provider : '';
        }
        if (window.updateMapProviderHint) window.updateMapProviderHint();
        if (window.updateMapProviderKeyFields) window.updateMapProviderKeyFields();

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
        if (window.currentUser) {
            if (window.openMessagesModal) window.openMessagesModal(window.SUPPORT_LOGIN || 'support');
            return;
        }
        window.__pendingSupportOpen = true;
        if (window.openAuthModal) window.openAuthModal();
        else window.showToast('Войдите, чтобы написать в поддержку');
    };

    window.closeSupportModal = function() {
        const m = document.getElementById('support-modal');
        if (!m) return;
        m.classList.add('opacity-0', 'pointer-events-none');
        if (m.firstElementChild) m.firstElementChild.classList.add('scale-95');
        setTimeout(() => { if (m.classList.contains('opacity-0')) m.classList.add('hidden'); }, 300);
    };

    window.uploadProfilePhoto = async function(files) {
        if (!files || !files[0] || !window.currentUser) return;
        if (!window.getAuthToken || !window.getAuthToken()) {
            window.showToast('Войдите в аккаунт, чтобы сохранить фото');
            return;
        }
        const file = files[0];
        if (!file.type || !file.type.startsWith('image/')) {
            window.showToast('Выберите изображение');
            return;
        }
        window.showToast('Загрузка фото...');
        try {
            const blob = window.compressImageFile
                ? await window.compressImageFile(file, 720, 0.82)
                : file;
            const url = await window.uploadUserMedia(
                blob,
                `avatar_${Date.now()}.jpg`,
                'image/jpeg'
            );
            const avatar = document.getElementById('cabinet-avatar');
            const fallback = document.getElementById('cabinet-avatar-fallback');
            if (avatar) {
                avatar.src = url;
                avatar.classList.remove('hidden');
            }
            if (fallback) fallback.classList.add('hidden');
            const ok = await window.saveMyProfile({ avatar: url });
            if (ok) {
                if (window.evaluateFieldProgress) window.evaluateFieldProgress();
                if (window.refreshProfileButtonAvatar) window.refreshProfileButtonAvatar();
                window.showToast('Фото профиля обновлено');
            } else {
                window.showToast('Не удалось сохранить фото профиля');
            }
        } catch (err) {
            console.error(err);
            window.showToast(err.message || 'Не удалось загрузить фото');
        }
    };

    window.changePassword = async function() {
        const currentPassword = document.getElementById('cab-current-password')?.value || '';
        const newPassword = document.getElementById('cab-new-password')?.value || '';
        const confirmPassword = document.getElementById('cab-confirm-password')?.value || '';

        if (!newPassword || !confirmPassword) {
            return window.showToast('Заполните поля нового пароля');
        }
        if (newPassword.length < 4) {
            return window.showToast('Новый пароль слишком короткий (мин. 4)');
        }
        if (newPassword !== confirmPassword) {
            return window.showToast('Новые пароли не совпадают');
        }
        if (!window.currentUser) {
            return window.showToast('Сначала войдите в профиль');
        }
        if (!window.getAuthToken || !window.getAuthToken()) {
            return window.showToast('Сессия устарела — войдите снова');
        }

        try {
            await window.apiChangePassword(currentPassword, newPassword);
            if (document.getElementById('cab-current-password')) document.getElementById('cab-current-password').value = '';
            if (document.getElementById('cab-new-password')) document.getElementById('cab-new-password').value = '';
            if (document.getElementById('cab-confirm-password')) document.getElementById('cab-confirm-password').value = '';
            window.showToast('Пароль успешно обновлён');
        } catch (err) {
            if (err.code === 'bad_credentials') return window.showToast('Текущий пароль неверен');
            window.showToast(err.message || 'Не удалось сменить пароль');
        }
    };

    window.closeCabinet = function() {
        const content = document.getElementById('cabinet-modal-content');
        if (content && content.classList.contains('cabinet-in-dock')) {
            if (window.playSfx) window.playSfx('close');
            if (window.undockCabinetContent) window.undockCabinetContent();
            if (window.__dockView === 'cabinet' && window.openDockView) {
                window.openDockView(window.__sidebarTab || 'library');
            }
            window.__cabinetFormSnapshot = null;
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
        window.__cabinetFormSnapshot = null;
    };

    window.captureCabinetFormSnapshot = function() {
        const val = (id) => document.getElementById(id)?.value ?? '';
        window.__cabinetFormSnapshot = {
            name: val('profile-display-name'),
            email: val('profile-email'),
            bio: val('profile-bio'),
            gear: val('profile-gear'),
            links: val('profile-links')
        };
    };

    window.isCabinetFormDirty = function() {
        const pw = !!(
            (document.getElementById('cab-current-password')?.value || '').trim()
            || (document.getElementById('cab-new-password')?.value || '').trim()
            || (document.getElementById('cab-confirm-password')?.value || '').trim()
        );
        if (pw) return true;
        const snap = window.__cabinetFormSnapshot;
        if (!snap) return false;
        const val = (id) => document.getElementById(id)?.value ?? '';
        return val('profile-display-name') !== snap.name
            || val('profile-email') !== snap.email
            || val('profile-bio') !== snap.bio
            || val('profile-gear') !== snap.gear
            || val('profile-links') !== snap.links
            || !!(document.getElementById('email-code-input')?.value || '').trim();
    };

    window.requestCloseCabinet = async function() {
        if (window.requestCloseIfDirty) {
            return window.requestCloseIfDirty(
                window.isCabinetFormDirty,
                'Изменения профиля / пароля не сохранены.',
                window.closeCabinet
            );
        }
        window.closeCabinet();
        return true;
    };

    window.switchCabinetTab = function(tab) {
        const tabs = document.querySelectorAll('#cabinet-tabs [data-cab-tab]');
        const panels = document.querySelectorAll('[data-cab-panel]');
        if (!tabs.length) return;

        document.body.classList.remove('cab-mobile-sounds');

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
            document.body.classList.add('cab-mobile-home');
            window.renderCabinet();
        } else if (tab === 'profile') {
            document.body.classList.remove('cab-mobile-home');
            if (window.fillProfileSettingsForm) window.fillProfileSettingsForm();
        } else if (tab === 'quests') {
            document.body.classList.remove('cab-mobile-home');
            if (window.evaluateFieldProgress) window.evaluateFieldProgress({ refreshUi: false }).then(() => {
                if (window.renderQuestsPanel) window.renderQuestsPanel();
            });
            else if (window.renderQuestsPanel) window.renderQuestsPanel();
        } else if (tab === 'sessions') {
            document.body.classList.remove('cab-mobile-home');
            if (window.renderSessionsPanel) window.renderSessionsPanel();
        } else if (tab === 'analytics') {
            document.body.classList.remove('cab-mobile-home');
            if (window.renderMyAnalytics) window.renderMyAnalytics();
        } else if (tab === 'settings') {
            document.body.classList.remove('cab-mobile-home');
            if (window.fillProfileSettingsForm) window.fillProfileSettingsForm();
        } else if (tab === 'security') {
            document.body.classList.remove('cab-mobile-home');
        } else if (tab === 'admin') {
            if (window.openAdminPanel) window.openAdminPanel();
            else window.switchCabinetTab('sounds');
            return;
        }
        if (window.refreshCabinetMobileChrome) window.refreshCabinetMobileChrome(tab);
    };

    window.parseDuration = function(durStr) {
        if (durStr == null || durStr === '') return 0;
        if (typeof durStr === 'number' && isFinite(durStr)) return Math.max(0, durStr);
        const raw = String(durStr).trim();
        if (!raw || raw === '0:00') return 0;
        const parts = raw.split(':').map(p => Number(p));
        if (parts.some(n => !isFinite(n))) return 0;
        if (parts.length === 2) return (parts[0] * 60) + parts[1];
        if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
        const asNum = Number(raw);
        return isFinite(asNum) ? asNum : 0;
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
        const loginEl = document.getElementById('cabinet-user-login');
        if (loginEl) {
            loginEl.textContent = `@${login}`;
            loginEl.classList.remove('hidden');
        }
        const badgeEl = document.getElementById('cabinet-member-badge');
        if (badgeEl && window.getMyProgress && window.getLevelTitle) {
            const prog = window.getMyProgress();
            badgeEl.classList.remove('hidden');
            badgeEl.innerHTML = `<i class="fa-solid fa-circle-check"></i>${window.getLevelTitle(prog.level)}`;
        }
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
        if (window.refreshProfileButtonAvatar) window.refreshProfileButtonAvatar();
        
        window.refreshCabinetTabs();
        if (window.refreshCabinetProgressChip) window.refreshCabinetProgressChip();

        document.getElementById('cabinet-stat-count').textContent = mySounds.length;
        
        let totalSecs = 0;
        mySounds.forEach(s => totalSecs += window.parseDuration(s.duration));
        document.getElementById('cabinet-stat-duration').textContent = window.formatTotalDuration(totalSecs);

        // Досчитать длительность для записей с 0:00 (старые загрузки без метаданных)
        if (window.probeAudioDuration && window.formatTime) {
            const needProbe = mySounds.filter(s => window.parseDuration(s.duration) <= 0 && s.url);
            if (needProbe.length) {
                Promise.all(needProbe.map(async (s) => {
                    try {
                        const secs = await window.probeAudioDuration(s.url);
                        if (secs > 0) {
                            s.duration = window.formatTime(secs);
                            return true;
                        }
                    } catch (_) {}
                    return false;
                })).then((flags) => {
                    if (!flags.some(Boolean)) return;
                    let sum = 0;
                    mySounds.forEach(s => sum += window.parseDuration(s.duration));
                    const el = document.getElementById('cabinet-stat-duration');
                    if (el) el.textContent = window.formatTotalDuration(sum);
                });
            }
        }
        
        const list = document.getElementById('cabinet-sounds-list');
        if(mySounds.length === 0) {
            const statusSummaryEl = document.getElementById('cabinet-moderation-summary');
            if (statusSummaryEl) { statusSummaryEl.classList.add('hidden'); statusSummaryEl.innerHTML = ''; }
            list.innerHTML = `<div class="text-center py-12 text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm"><i class="fa-solid fa-microphone-slash text-4xl mb-3 opacity-30 block"></i><p class="font-medium text-sm">Вы еще не загрузили ни одного звука.</p><p class="text-xs mt-1">Опубликованные вами звуки появятся здесь.</p></div>`;
            return;
        }

        const mySessions = window.getMySessions ? window.getMySessions() : [];
        const sessionOptions = sel => '<option value="">Без сессии</option>' +
            mySessions.map(sess => `<option value="${sess.id}" ${sel === sess.id ? 'selected' : ''}>${sess.title}</option>`).join('');

        const isReturnedDraft = (s) => s.status === 'draft' && !!(s.rejectionReason || '').trim();
        const isRejectedLike = (s) => s.status === 'rejected' || isReturnedDraft(s);

        // "Уведомление о новых статусах": если админ поменял статус записи с момента последнего
        // визита в кабинет (seenByAuthor === false), показываем тост один раз и гасим флаг.
        const unseen = mySounds.filter(s => s.seenByAuthor === false);
        if (unseen.length > 0) {
            const approved = unseen.filter(s => s.status === 'published').length;
            const rejected = unseen.filter(s => isRejectedLike(s)).length;
            const parts = [];
            if (approved) parts.push(`${approved} одобрено`);
            if (rejected) parts.push(`${rejected} отклонено`);
            window.showToast(parts.length
                ? `Статус записей: ${parts.join(', ')}`
                : `Обновился статус ${unseen.length} ${unseen.length === 1 ? 'записи' : 'записей'}`);
            const updatedCloud = [...window.cloudDataCache];
            unseen.forEach(s => {
                s.seenByAuthor = true;
                const idx = updatedCloud.findIndex(x => x.id === s.id);
                if (idx >= 0) updatedCloud[idx] = { ...updatedCloud[idx], seenByAuthor: true };
                else updatedCloud.push(s);
            });
            window.syncCloudData(updatedCloud);
        }

        const pendingN = mySounds.filter(s => s.status === 'pending').length;
        const rejectedN = mySounds.filter(s => isRejectedLike(s)).length;
        const draftN = mySounds.filter(s => s.status === 'draft' && !isReturnedDraft(s)).length;
        const statusSummaryEl = document.getElementById('cabinet-moderation-summary');
        if (statusSummaryEl) {
            if (pendingN || rejectedN || draftN) {
                statusSummaryEl.classList.remove('hidden');
                statusSummaryEl.innerHTML = `
                    <div class="flex flex-wrap gap-2 text-[11px] font-semibold">
                        ${pendingN ? `<span class="pub-status-pill pub-status-pending">На модерации: ${pendingN}</span>` : ''}
                        ${rejectedN ? `<span class="pub-status-pill pub-status-rejected">Отклонено: ${rejectedN}</span>` : ''}
                        ${draftN ? `<span class="pub-status-pill pub-status-draft">Черновики: ${draftN}</span>` : ''}
                    </div>
                    ${rejectedN ? `<p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">Исправьте отклонённые записи и отправьте снова на модерацию.</p>` : ''}`;
            } else {
                statusSummaryEl.classList.add('hidden');
                statusSummaryEl.innerHTML = '';
            }
        }

        list.innerHTML = mySounds.map(s => {
            const isHardcoded = window.rawSoundsData.map(r => r.id).includes(s.id);
            const returned = isReturnedDraft(s);
            const st = returned
                ? { label: 'Отклонено → черновик', cls: 'pub-status-rejected' }
                : (window.STATUS_LABELS[s.status] || window.STATUS_LABELS.published);
            const canResubmit = s.status === 'rejected' || s.status === 'draft';
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
                        ${isRejectedLike(s) && s.rejectionReason ? `<p class="text-[11px] text-red-600 dark:text-red-400 mt-1 leading-snug"><i class="fa-solid fa-circle-exclamation mr-1"></i>${s.rejectionReason}</p>` : ''}
                        <select onchange="window.assignSoundToSession('${s.id}', this.value)" class="mt-1.5 text-[10px] font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 px-1.5 py-1 max-w-[180px]" title="Привязать к экспедиции">
                            ${sessionOptions(s.sessionId)}
                        </select>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0 sm:pr-2">
                    ${canResubmit ? `
                    <button onclick="window.editSound('${s.id}'); window.closeCabinet();" class="flex-1 sm:flex-none h-9 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors shadow-sm font-bold text-xs gap-1.5" title="Исправить и отправить снова">
                        <i class="fa-solid fa-paper-plane"></i><span>Исправить</span>
                    </button>` : `
                    <button onclick="window.editSound('${s.id}'); window.closeCabinet();" class="flex-1 sm:flex-none sm:w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors shadow-sm font-bold text-xs" title="Редактировать">
                        <i class="fa-solid fa-pen sm:mr-0 mr-1"></i> <span class="sm:hidden">Изменить</span>
                    </button>`}
                    <button onclick="window.deleteSoundFromCloud('${s.id}')" class="flex-1 sm:flex-none sm:w-9 h-9 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 flex items-center justify-center transition-colors shadow-sm font-bold text-xs" title="Удалить">
                        <i class="fa-solid fa-trash-can sm:mr-0 mr-1"></i> <span class="sm:hidden">Удалить</span>
                    </button>
                </div>
            </div>
        `}).join('');
    };

    // Переключатель очереди: все / pending / rejected
    window.__adminListFilter = window.__adminListFilter || 'all';
    window.__adminSearch = window.__adminSearch || { sounds: '', reports: '', support: '', events: '' };
    window.setAdminSearchQuery = function(section, value) {
        if (!window.__adminSearch) window.__adminSearch = { sounds: '', reports: '', support: '', events: '' };
        window.__adminSearch[section] = String(value || '').trim().toLowerCase();
        if (section === 'sounds' && window.renderAdminList) window.renderAdminList();
        else if (section === 'reports' && window.renderReportsList) window.renderReportsList();
        else if (section === 'support' && window.renderAdminSupportList) window.renderAdminSupportList();
        else if (section === 'events' && window.renderAdminEventsList) window.renderAdminEventsList();
    };
    window.setAdminListFilter = function(mode) {
        window.__adminListFilter = mode;
        ['all', 'pending', 'rejected'].forEach((m) => {
            const btn = document.getElementById(`admin-filter-btn-${m}`);
            if (btn) btn.classList.toggle('active', mode === m);
        });
        window.renderAdminList();
    };

    window.renderAdminList = function() {
        const list = document.getElementById('admin-sounds-list');
        if(!list) return;

        const rawIds = window.rawSoundsData.map(s => s.id);
        const isReturnedDraft = (s) => s.status === 'draft' && !!(s.rejectionReason || '').trim();
        const isRejectedLike = (s) => s.status === 'rejected' || isReturnedDraft(s);

        const pendingCount = window.soundsData.filter(s => s.status === 'pending').length;
        const rejectedCount = window.soundsData.filter(s => isRejectedLike(s)).length;
        const countEl = document.getElementById('admin-filter-pending-count');
        if (countEl) countEl.textContent = pendingCount;
        const rejectedCountEl = document.getElementById('admin-filter-rejected-count');
        if (rejectedCountEl) rejectedCountEl.textContent = rejectedCount;
        if (window.assignArchiveNumbers) window.assignArchiveNumbers();

        const filterMode = window.__adminListFilter || 'all';
        let sounds = window.soundsData.slice();
        if (filterMode === 'pending') sounds = sounds.filter(s => s.status === 'pending');
        else if (filterMode === 'rejected') sounds = sounds.filter(s => isRejectedLike(s));

        const q = (window.__adminSearch?.sounds || '').trim().toLowerCase();
        if (q) {
            sounds = sounds.filter((s) => {
                const hay = [
                    s.title, s.fileName, s.recordist, s.recordistId, s.id, s.publicId, s.archiveNum,
                    s.description, s.location, s.status, s.rejectionReason, s.keywords
                ].map((x) => String(x || '').toLowerCase()).join(' ');
                return hay.includes(q);
            });
        }

        // Очередь: сначала самые старые (дольше ждут)
        if (filterMode === 'pending' || filterMode === 'rejected') {
            sounds.sort((a, b) => {
                const ta = new Date(a.createdAt || a.date || 0).getTime();
                const tb = new Date(b.createdAt || b.date || 0).getTime();
                return ta - tb;
            });
        }

        if (!sounds.length) {
            const emptyMsg = q
                ? 'Ничего не найдено по запросу.'
                : (filterMode === 'rejected'
                    ? 'Отклонённых записей нет.'
                    : (filterMode === 'pending' ? 'Очередь модерации пуста.' : 'Записей пока нет.'));
            list.innerHTML = `<div class="text-center py-10 text-slate-400"><i class="fa-solid fa-clipboard-check text-3xl mb-2 opacity-30 block"></i><p class="text-sm font-medium">${emptyMsg}</p></div>`;
            if (window.refreshAdminRailBadge) window.refreshAdminRailBadge();
            return;
        }

        list.innerHTML = sounds.map(s => {
            const isHardcoded = rawIds.includes(s.id);
            const status = s.status || 'published';
            const publicId = String(s.publicId || s.archiveNum || s.id || '—');
            const internalId = String(s.id || '—');
            const idLine = (publicId !== internalId)
                ? `№ ${publicId}${isHardcoded ? ' · вшито' : ''} · ID ${internalId}`
                : `ID ${internalId}${isHardcoded ? ' · вшито' : ''}`;
            const returned = status === 'draft' && !!(s.rejectionReason || '').trim();
            const statusLabel = returned
                ? 'Отклонено → черновик'
                : (({ published: 'Опубликовано', pending: 'На модерации', rejected: 'Отклонено', draft: 'Черновик' })[status] || status);
            return `
                <div class="admin-entity-row">
                    <button type="button" class="admin-entity-main min-w-0 flex-1 text-left" onclick="window.openedFromAdmin=true; window.closeCabinet(); window.selectSound('${s.id}'); window.openDetailsModal();">
                        <p class="admin-entity-num">${idLine}</p>
                        <p class="admin-entity-title">${s.title || 'Без названия'}</p>
                        <p class="admin-entity-meta">${s.fileName || ''} · ${s.recordist || 'Автор'} · ${statusLabel}</p>
                        ${(status === 'rejected' || returned) && s.rejectionReason ? `<p class="text-[11px] text-red-500 mt-0.5 line-clamp-2"><i class="fa-solid fa-circle-exclamation mr-1"></i>${s.rejectionReason}</p>` : ''}
                    </button>
                    <button type="button" onclick="event.stopPropagation(); window.openAdminSoundActions('${s.id}', event)" class="admin-actions-btn shrink-0"><i class="fa-solid fa-ellipsis"></i> Действия</button>
                </div>
            `;
        }).join('');
        if (window.refreshAdminRailBadge) window.refreshAdminRailBadge();
    };

    window.getAdminSoundActionItems = function(soundId) {
        const s = window.soundsData.find(x => x.id === soundId);
        if (!s) return [];
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
        return items;
    };

    window.openAdminSoundActions = function(soundId, ev) {
        const items = window.getAdminSoundActionItems(soundId);
        const s = (window.soundsData || []).find((x) => x.id === soundId);
        if (items.length) {
            const opts = { title: s?.title || 'Запись', event: ev || (typeof event !== 'undefined' ? event : null) };
            if (window.openActionsMenu) window.openActionsMenu(items, opts);
            else window.ActionSheet.open(items);
        }
    };

    window.openDetailsAdminActions = function(ev) {
        const id = window.currentPlayingId;
        if (!id) return;
        const s = window.soundsData.find(x => x.id === id);
        if (!s) return;
        const status = s.status || 'published';
        const items = [
            { icon: 'fa-pen', label: 'Изменить', tone: 'primary', onClick: () => { window.closeDetailsModal(); window.editSound(id); } }
        ];
        if (status === 'pending') {
            items.push(
                { icon: 'fa-check', label: 'Одобрить', tone: 'success', onClick: () => window.setSoundStatus(id, 'published') },
                { icon: 'fa-xmark', label: 'Отклонить', tone: 'danger', onClick: () => window.setSoundStatus(id, 'rejected') }
            );
        } else if (status === 'rejected') {
            items.push(
                { icon: 'fa-check', label: 'Опубликовать', tone: 'success', onClick: () => window.setSoundStatus(id, 'published') },
                { icon: 'fa-clock', label: 'Вернуть на модерацию', tone: 'warning', onClick: () => window.setSoundStatus(id, 'pending') }
            );
        } else if (status === 'published') {
            items.push(
                { icon: 'fa-clock', label: 'Вернуть на модерацию', tone: 'warning', onClick: () => window.setSoundStatus(id, 'pending') },
                { icon: 'fa-ban', label: 'Отклонить', tone: 'danger', onClick: () => window.setSoundStatus(id, 'rejected') }
            );
        } else {
            items.push(
                { icon: 'fa-check', label: 'Опубликовать', tone: 'success', onClick: () => window.setSoundStatus(id, 'published') },
                { icon: 'fa-clock', label: 'На модерацию', tone: 'warning', onClick: () => window.setSoundStatus(id, 'pending') }
            );
        }
        items.push({ icon: 'fa-trash', label: 'Удалить', tone: 'danger', onClick: () => window.deleteSoundFromCloud(id) });
        const opts = { title: s.title || 'Запись', event: ev || (typeof event !== 'undefined' ? event : null), anchor: document.getElementById('details-admin-actions-btn') };
        if (window.openActionsMenu) window.openActionsMenu(items, opts);
        else window.ActionSheet.open(items);
    };

    // Смена статуса модерации прямо из списка админки (без открытия полной формы редактирования).
    // При отклонении и при возврате на модерацию всегда запрашиваем причину.
    window.setSoundStatus = async function(id, status) {
        const s = window.soundsData.find(x => x.id === id);
        if (!s) return;

        let reason = s.rejectionReason || '';
        let nextStatus = status;
        const needsReason = status === 'rejected' || status === 'pending';
        if (needsReason) {
            const isReject = status === 'rejected';
            const input = await window.CustomUI.open({
                title: isReject
                    ? '<i class="fa-solid fa-circle-exclamation mr-2 text-red-500"></i>Причина отклонения'
                    : '<i class="fa-solid fa-clock mr-2 text-amber-500"></i>Причина возврата на модерацию',
                message: isReject
                    ? 'Запись вернётся автору в черновик. Выберите пункт правил или напишите причину — она будет в уведомлении и в кабинете. <button type="button" class="text-blue-600 dark:text-blue-400 font-bold hover:underline" onclick="window.openPublishRulesModal()">Открыть правила</button>'
                    : 'Укажите, зачем запись снова в очереди модерации — причина сохранится в карточке и уйдёт автору при необходимости. <button type="button" class="text-blue-600 dark:text-blue-400 font-bold hover:underline" onclick="window.openPublishRulesModal()">Открыть правила</button>',
                confirmText: isReject ? 'Отклонить' : 'На модерацию',
                confirmClass: isReject
                    ? 'px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-md'
                    : 'px-5 py-2.5 text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors shadow-md',
                showInput: true,
                inputRows: 3,
                inputPlaceholder: 'Или свой текст причины…',
                suggestions: window.getRejectSuggestionChips ? window.getRejectSuggestionChips() : []
            });
            if (input === false) { window.renderAdminList(); return; }
            reason = String(input || '').trim();
            if (!reason) {
                window.showToast(isReject ? 'Укажите причину отклонения' : 'Укажите причину возврата на модерацию');
                return;
            }
            // Returned to author as draft for fixes + resubmit
            if (isReject) nextStatus = 'draft';
        } else {
            reason = '';
        }

        s.status = nextStatus;
        s.rejectionReason = reason;
        s.seenByAuthor = false;
        const updatedCloud = [...window.cloudDataCache];
        const idx = updatedCloud.findIndex(x => x.id === id);
        if (idx >= 0) updatedCloud[idx] = { ...updatedCloud[idx], status: nextStatus, rejectionReason: reason, seenByAuthor: false };
        else updatedCloud.push(s);
        const success = await window.syncCloudData(updatedCloud);
        if (success) {
            window.showToast(
                status === 'published'
                    ? 'Запись опубликована'
                    : (status === 'rejected'
                        ? 'Запись отклонена и возвращена в черновик'
                        : (status === 'pending' ? 'Запись возвращена на модерацию' : 'Статус обновлён'))
            );
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
                        soundTitle: s.title,
                        moderationStatus: 'published'
                    });
                    if (window.notifyFollowersAboutNewSound) window.notifyFollowersAboutNewSound(s);
                } else if (status === 'rejected') {
                    window.pushNotifications([s.recordistId], {
                        type: 'moderation',
                        text: `Ваша запись «${s.title}» отклонена и возвращена в черновик${reason ? ': ' + reason : ''}`,
                        fromId: adminLogin,
                        fromName: window.currentUser?.username || 'Администратор',
                        soundId: s.id,
                        soundTitle: s.title,
                        action: 'edit',
                        moderationStatus: 'rejected',
                        rejectionReason: reason
                    });
                } else if (status === 'pending') {
                    window.pushNotifications([s.recordistId], {
                        type: 'moderation',
                        text: `Ваша запись «${s.title}» снова на модерации${reason ? ': ' + reason : ''}`,
                        fromId: adminLogin,
                        fromName: window.currentUser?.username || 'Администратор',
                        soundId: s.id,
                        soundTitle: s.title,
                        action: 'edit',
                        moderationStatus: 'pending',
                        rejectionReason: reason
                    });
                }
            }
        }
    };

    // --- Жалобы (на записи и на комментарии) — очередь модерации в админ-панели ---
    window.__adminSection = 'sounds';

    window.openAdminPanel = function(section) {
        if (!window.isCurrentUserAdmin || !window.isCurrentUserAdmin()) {
            window.showToast('Нужны права администратора');
            return;
        }
        if (window.openDockView) window.openDockView('admin');
        if (section) window.switchAdminSection(section);
        else window.switchAdminSection(window.__adminSection || 'sounds');
    };

    window.switchAdminSection = function(section) {
        const allowed = ['sounds', 'reports', 'users', 'support', 'events', 'tools', 'stats', 'console'];
        window.__adminSection = allowed.includes(section) ? section : 'sounds';
        allowed.forEach((key) => {
            const panel = document.getElementById(`admin-section-${key}`);
            const btn = document.getElementById(`admin-tab-btn-${key}`);
            if (panel) panel.classList.toggle('hidden', key !== window.__adminSection);
            if (btn) btn.classList.toggle('active', key === window.__adminSection);
        });
        if (window.__adminSection === 'reports') window.renderReportsList();
        if (window.__adminSection === 'users') window.renderAdminUsersList();
        if (window.__adminSection === 'support') window.renderAdminSupportList();
        if (window.__adminSection === 'events' && window.renderAdminEventsList) window.renderAdminEventsList();
        if (window.__adminSection === 'sounds') {
            if (window.renderAdminList) window.renderAdminList();
            if (window.renderRegionStats) window.renderRegionStats('admin-stats-grid');
        }
        if (window.__adminSection === 'tools') window.renderAdminToolsSummary();
        if (window.__adminSection === 'stats') window.renderAdminRegStats();
        if (window.__adminSection === 'console') {
            const out = document.getElementById('admin-console-output');
            if (out && !out.childElementCount && window.runAdminConsoleCommand) {
                window.runAdminConsoleCommand('help');
            }
        }
    };

    window.renderAdminToolsSummary = function() {
        const el = document.getElementById('admin-ops-summary');
        if (!el) return;
        const all = window.soundsData || [];
        const pending = all.filter((s) => s.status === 'pending').length;
        const reports = window.getAllReports ? window.getAllReports().filter((r) => r.status !== 'resolved').length : 0;
        const users = (window.profilesData || []).length;
        const api = window.__apiHealth;
        el.innerHTML = `
            <div>Каталог: <strong>${all.length}</strong> · на модерации <strong>${pending}</strong></div>
            <div>Жалобы: <strong>${reports}</strong> · пользователи <strong>${users}</strong></div>
            <div>API: <strong>${api?.ok ? `v${api.version || '?'}` : 'нет данных'}</strong></div>
        `;
    };

    window.renderAdminRegStats = function() {
        const el = document.getElementById('admin-reg-stats');
        if (!el) return;
        const profiles = (window.profilesData || []).filter((p) => p && p.loginName && p.loginName !== (window.SUPPORT_LOGIN || 'support'));
        const skillLabels = {
            beginner: 'Новичок',
            intermediate: 'Любитель',
            advanced: 'Продвинутый',
            pro: 'Профи'
        };
        const intentLabels = {
            listen: 'Слушать карту',
            publish: 'Публиковать',
            research: 'Исследования',
            education: 'Обучение',
            community: 'Сообщество',
            other: 'Другое'
        };
        const skillCounts = {};
        const intentCounts = {};
        let withSurvey = 0;
        let withConsent = 0;
        profiles.forEach((p) => {
            if (p.pdConsent) withConsent += 1;
            if (p.skillLevel || (p.platformIntents && p.platformIntents.length)) withSurvey += 1;
            if (p.skillLevel) skillCounts[p.skillLevel] = (skillCounts[p.skillLevel] || 0) + 1;
            (p.platformIntents || []).forEach((intent) => {
                intentCounts[intent] = (intentCounts[intent] || 0) + 1;
            });
        });
        const bar = (label, n, total) => {
            const pct = total ? Math.round((n / total) * 100) : 0;
            return `<div class="space-y-1">
                <div class="flex justify-between text-xs"><span>${label}</span><span class="font-bold">${n} · ${pct}%</span></div>
                <div class="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div class="h-full bg-blue-500 rounded-full" style="width:${pct}%"></div></div>
            </div>`;
        };
        const total = profiles.length || 1;
        el.innerHTML = `
            <div class="rounded-2xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900/40 space-y-1 text-xs">
                <p>Всего профилей: <strong>${profiles.length}</strong></p>
                <p>С анкетой при регистрации: <strong>${withSurvey}</strong></p>
                <p>С согласием на ПДн: <strong>${withConsent}</strong></p>
            </div>
            <div class="rounded-2xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Уровень умений</p>
                ${Object.keys(skillLabels).map((k) => bar(skillLabels[k], skillCounts[k] || 0, total)).join('') || '<p class="text-xs text-slate-400">Пока нет данных</p>'}
            </div>
            <div class="rounded-2xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Цели использования</p>
                ${Object.keys(intentLabels).map((k) => bar(intentLabels[k], intentCounts[k] || 0, total)).join('')}
            </div>
        `;
    };

    window.refreshAdminRailBadge = function() {
        const badge = document.getElementById('rail-admin-badge');
        if (!badge) return;
        if (!window.isCurrentUserAdmin || !window.isCurrentUserAdmin()) {
            badge.classList.add('hidden');
            badge.textContent = '0';
            return;
        }
        const pending = (window.soundsData || []).filter((s) => s.status === 'pending').length;
        const reports = window.getAllReports
            ? window.getAllReports().filter((r) => r.status !== 'resolved').length
            : 0;
        let support = 0;
        const supportProfile = window.getProfileByLogin ? window.getProfileByLogin(window.SUPPORT_LOGIN) : null;
        const unreadPeers = new Set();
        (supportProfile?.inbox || []).forEach((msg) => {
            if (!msg?.fromId || msg.read || msg.deleted) return;
            if (String(msg.fromId).toLowerCase() === String(window.SUPPORT_LOGIN || '').toLowerCase()) return;
            unreadPeers.add(String(msg.fromId).toLowerCase());
        });
        support = unreadPeers.size;
        const total = pending + reports + support;
        badge.textContent = total > 99 ? '99+' : String(total);
        badge.classList.toggle('hidden', total === 0);
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
        let reports = window.getAllReports();
        const pendingCount = reports.filter(r => r.status !== 'resolved').length;
        if (countEl) countEl.textContent = pendingCount ? `(${pendingCount})` : '';
        if (tabCount) {
            tabCount.textContent = pendingCount ? String(pendingCount) : '';
            tabCount.hidden = !pendingCount;
        }
        if (window.refreshAdminRailBadge) window.refreshAdminRailBadge();

        const q = (window.__adminSearch?.reports || '').trim().toLowerCase();
        if (q) {
            reports = reports.filter((r) => {
                const hay = [
                    r.number, r.id, r.soundId, r.soundTitle, r.reason, r.reporterName, r.reporterId, r.type, r.status, r.commentId
                ].map((x) => String(x || '').toLowerCase()).join(' ');
                return hay.includes(q);
            });
        }

        if (!reports.length) {
            container.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">${q ? 'Ничего не найдено по запросу.' : 'Жалоб пока нет.'}</p>`;
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
                <button type="button" onclick="event.stopPropagation(); window.openAdminReportActions('${r.soundId}', '${r.id}', event)" class="admin-actions-btn shrink-0"><i class="fa-solid fa-ellipsis"></i> Действия</button>
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

    window.openAdminReportActions = function(soundId, reportId, ev) {
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
        const opts = { title: `Жалоба № ${r.number || '—'}`, event: ev || (typeof event !== 'undefined' ? event : null) };
        if (window.openActionsMenu) window.openActionsMenu(items, opts);
        else window.ActionSheet.open(items);
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
        el.innerHTML = profiles.filter(p => p.loginName !== window.SUPPORT_LOGIN).map(p => {
            const isAdmin = p.role === 'admin' || p.loginName === 'admin';
            const isBlocked = !!p.blocked;
            const badgeCount = (p.badges || []).length;
            const safeLogin = String(p.loginName || '').replace(/'/g, "\\'");
            const safeName = String(p.displayName || p.loginName || '').replace(/'/g, "\\'");
            return `
            <div class="admin-entity-row ${isBlocked ? 'is-muted' : ''}">
                <button type="button" class="admin-entity-main min-w-0 flex-1 text-left" onclick="window.openPublicProfile('${safeLogin}', '${safeName}')">
                    <div class="admin-user-row-name flex items-center gap-2">
                        ${p.avatar
                            ? `<img src="${p.avatar}" class="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-600 shrink-0" alt="">`
                            : `<span class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-user-astronaut opacity-60 text-sm"></i></span>`}
                        <span class="truncate font-semibold">${p.displayName || p.loginName}</span>
                        ${isAdmin ? `<span class="pub-status-pill pub-status-pending">Админ</span>` : ''}
                        ${isBlocked ? `<span class="pub-status-pill pub-status-rejected">Блок</span>` : ''}
                    </div>
                    <p class="admin-entity-meta mt-0.5">@${p.loginName}${p.joinedAt ? ' · рег. ' + new Date(p.joinedAt).toLocaleDateString('ru-RU') : ''}${badgeCount ? ` · ${badgeCount} зван.` : ''}</p>
                </button>
                <button type="button" onclick="window.openAdminUserActions('${safeLogin}', event)" class="admin-actions-btn shrink-0"><i class="fa-solid fa-ellipsis"></i> Действия</button>
            </div>`;
        }).join('');
    };

    window.renderAdminSupportList = function() {
        const el = document.getElementById('admin-support-list');
        if (window.refreshAdminSupportBadge) window.refreshAdminSupportBadge();
        if (!el) return;
        const supportProfile = window.getProfileByLogin ? window.getProfileByLogin(window.SUPPORT_LOGIN) : null;
        const byPeer = new Map();
        (supportProfile?.inbox || []).forEach(msg => {
            if (!msg.fromId || String(msg.fromId).toLowerCase() === String(window.SUPPORT_LOGIN || '').toLowerCase()) return;
            const peer = String(msg.fromId).toLowerCase();
            const prev = byPeer.get(peer);
            if (!prev || new Date(msg.date || 0) > new Date(prev.date || 0)) byPeer.set(peer, { ...msg, fromId: peer });
        });
        const rows = Array.from(byPeer.entries()).sort((a, b) => {
            const aUnread = !a[1].read ? 1 : 0;
            const bUnread = !b[1].read ? 1 : 0;
            if (bUnread !== aUnread) return bUnread - aUnread;
            return new Date(b[1].date || 0) - new Date(a[1].date || 0);
        });
        const q = (window.__adminSearch?.support || '').trim().toLowerCase();
        const filteredRows = q
            ? rows.filter(([peer, last]) => {
                const profile = window.getProfileByLogin ? window.getProfileByLogin(peer) : null;
                const hay = [
                    peer, last.fromName, last.fromId, last.text, profile?.displayName, profile?.loginName
                ].map((x) => String(x || '').toLowerCase()).join(' ');
                return hay.includes(q);
            })
            : rows;
        if (!filteredRows.length) {
            el.innerHTML = `<div class="text-center py-8 px-3">
                <i class="fa-solid fa-headset text-2xl text-slate-300 dark:text-slate-600 mb-3 block"></i>
                <p class="text-xs font-semibold text-slate-500">${q ? 'Ничего не найдено по запросу.' : 'Обращений пока нет'}</p>
                ${q ? '' : '<p class="text-[11px] text-slate-400 mt-1">Пользователи пишут из Сообщений или раздела «Помощь» в настройках.</p>'}
            </div>`;
            return;
        }
        el.innerHTML = filteredRows.map(([peer, last]) => {
            const profile = window.getProfileByLogin ? window.getProfileByLogin(peer) : null;
            const name = profile?.displayName || last.fromName || peer;
            const unread = !last.read;
            const preview = last.text || (last.image ? '📷 Фото' : '');
            const safePeer = String(peer).replace(/'/g, "\\'");
            const tickets = (supportProfile?.inbox || [])
                .filter((m) => String(m.fromId || '').toLowerCase() === peer && m.ticketNumber)
                .map((m) => Number(m.ticketNumber))
                .filter((n) => n > 0);
            const ticketLabel = tickets.length
                ? ` · № ${Math.max(...tickets)}`
                : '';
            return `
            <button type="button" onclick="window.openMessagesModal('${safePeer}', { asSupport: true })" class="notif-item ${unread ? 'unread' : ''} msg-support-row w-full text-left">
                <span class="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center shrink-0 overflow-hidden">
                    ${profile?.avatar ? `<img src="${profile.avatar}" class="w-full h-full object-cover" alt="">` : `<i class="fa-solid fa-headset"></i>`}
                </span>
                <div class="min-w-0 flex-1">
                    <p class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">${name}${ticketLabel}${unread ? ' · новое' : ''}</p>
                    <p class="text-[11px] text-slate-500 truncate">${preview}</p>
                    <p class="text-[10px] text-slate-400 mt-0.5">${last.date ? new Date(last.date).toLocaleString('ru-RU') : ''}</p>
                </div>
            </button>`;
        }).join('');
    };

    window.refreshAdminSupportBadge = function() {
        const tabCount = document.getElementById('admin-tab-support-count');
        if (!tabCount) return;
        if (!window.isCurrentUserAdmin || !window.isCurrentUserAdmin()) {
            tabCount.textContent = '';
            tabCount.hidden = true;
            return;
        }
        const supportProfile = window.getProfileByLogin ? window.getProfileByLogin(window.SUPPORT_LOGIN) : null;
        const unreadPeers = new Set();
        (supportProfile?.inbox || []).forEach((msg) => {
            if (!msg?.fromId || msg.read || msg.deleted) return;
            if (String(msg.fromId).toLowerCase() === String(window.SUPPORT_LOGIN || '').toLowerCase()) return;
            unreadPeers.add(String(msg.fromId).toLowerCase());
        });
        const n = unreadPeers.size;
        tabCount.textContent = n ? String(n) : '';
        tabCount.hidden = !n;
        if (window.refreshAdminRailBadge) window.refreshAdminRailBadge();
    };

    window.openAdminUserActions = function(login, ev) {
        const p = window.getProfileByLogin ? window.getProfileByLogin(login) : null;
        if (!p) return;
        const isAdmin = p.role === 'admin' || p.loginName === 'admin';
        const isBlocked = !!p.blocked;
        const items = [
            { icon: 'fa-id-badge', label: 'Открыть профиль', tone: 'primary', onClick: () => window.openPublicProfile(login, p.displayName || login) },
            { icon: 'fa-medal', label: 'Звания', tone: 'warning', onClick: () => window.openBadgeAssignModal(login) },
            { icon: 'fa-chart-simple', label: 'Сводка', tone: 'primary', onClick: () => window.openUserActivityModal(login) }
        ];
        if (login !== 'admin') {
            items.push({ icon: 'fa-user-shield', label: isAdmin ? 'Снять админа' : 'Сделать админом', tone: 'primary', onClick: () => window.setUserAdminRole(login, !isAdmin) });
            items.push({ icon: 'fa-ban', label: isBlocked ? 'Разблокировать' : 'Заблокировать', tone: isBlocked ? 'success' : 'danger', onClick: () => window.setUserBlocked(login, !isBlocked) });
        }
        const opts = { title: p.displayName || login, event: ev || (typeof event !== 'undefined' ? event : null) };
        if (window.openActionsMenu) window.openActionsMenu(items, opts);
        else window.ActionSheet.open(items);
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

    // Журнал действий пользователя (для админ-сводки). Пишется в profiles.json.
    window.logUserActivity = async function(entry, targetLogin = null) {
        const login = targetLogin
            || (window.currentUser && (window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase()));
        if (!login || !entry || !entry.type) return false;
        const updated = [...(window.profilesData || [])];
        let idx = updated.findIndex(p => p.loginName === login);
        if (idx < 0) {
            updated.push({ loginName: login, displayName: login, activityLog: [] });
            idx = updated.length - 1;
        }
        const item = {
            id: 'act' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            date: entry.date || new Date().toISOString(),
            type: entry.type,
            text: entry.text || '',
            soundId: entry.soundId || null,
            sessionId: entry.sessionId || null,
            questId: entry.questId || null
        };
        const log = [item, ...((updated[idx].activityLog || []))].slice(0, 200);
        updated[idx] = { ...updated[idx], activityLog: log };
        return await window.syncProfilesData(updated);
    };

    // Сводка всех действий пользователя для админа.
    window.getUserActivity = function(login) {
        const profile = window.getProfileByLogin ? window.getProfileByLogin(login) : null;
        const events = [];
        const push = (e) => {
            if (!e || !e.type) return;
            events.push({
                type: e.type,
                text: e.text || '',
                date: e.date || e.createdAt || null,
                soundId: e.soundId || null,
                sessionId: e.sessionId || null,
                questId: e.questId || null
            });
        };

        (profile?.activityLog || []).forEach(push);

        const sounds = (window.soundsData || []).filter(s => window.matchesRecordist(s, login, profile?.displayName));
        sounds.forEach(s => {
            push({
                type: 'sound_add',
                text: `Добавил запись «${s.title}»`,
                date: s.createdAt || s.date || null,
                soundId: s.id
            });
        });

        (window.soundsData || []).forEach(s => {
            (s.comments || []).forEach(c => {
                if (c.authorId === login) {
                    push({
                        type: 'comment',
                        text: `Написал комментарий к «${s.title}»: «${c.text}»`,
                        date: c.createdAt || c.date || null,
                        soundId: s.id
                    });
                }
                (c.replies || []).forEach(r => {
                    if (r.authorId === login) {
                        push({
                            type: 'reply',
                            text: `Ответил в «${s.title}»: «${r.text}»`,
                            date: r.createdAt || r.date || null,
                            soundId: s.id
                        });
                    }
                });
                if ((c.reactedBy || []).includes(login)) {
                    push({
                        type: 'reaction',
                        text: `Поставил реакцию на комментарий к «${s.title}»`,
                        date: null,
                        soundId: s.id
                    });
                }
            });
            if ((s.likedBy || []).includes(login)) {
                push({
                    type: 'like',
                    text: `Лайкнул запись «${s.title}»`,
                    date: null,
                    soundId: s.id
                });
            }
            if ((s.dislikedBy || []).includes(login)) {
                push({
                    type: 'dislike',
                    text: `Дизлайкнул запись «${s.title}»`,
                    date: null,
                    soundId: s.id
                });
            }
        });

        const completed = profile?.progress?.completedQuests || [];
        completed.forEach(qid => {
            const q = (window.QUEST_CATALOG || []).find(x => x.id === qid);
            const title = q && window.locQuestText ? window.locQuestText(q.title) : qid;
            push({
                type: 'quest',
                text: `Выполнил задание «${title}»`,
                date: null,
                questId: qid
            });
        });

        const sessions = window.getSessionsForUser ? window.getSessionsForUser(login) : [];
        sessions.forEach(s => {
            if (s.roleLabel === 'Участник') {
                push({
                    type: 'expedition_join',
                    text: `Стал участником экспедиции «${s.title}»`,
                    date: s.updatedAt || s.createdAt || s.date || null,
                    sessionId: s.id
                });
            }
        });

        // Дедуп: одинаковый type + soundId/sessionId/questId + text
        const seen = new Set();
        const unique = [];
        events.forEach(e => {
            const key = [e.type, e.soundId || '', e.sessionId || '', e.questId || '', e.text].join('|');
            if (seen.has(key)) return;
            seen.add(key);
            unique.push(e);
        });
        unique.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        return { profile, sounds, events: unique };
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
            if (!iso) return '';
            try {
                const d = new Date(iso);
                if (isNaN(d)) return String(iso);
                return d.toLocaleString('ru-RU');
            } catch (e) { return String(iso); }
        };

        const icons = {
            sound_add: 'fa-plus text-blue-500',
            sound_delete: 'fa-trash text-red-500',
            reply: 'fa-reply text-indigo-500',
            comment: 'fa-comment text-slate-500',
            quest: 'fa-trophy text-amber-500',
            expedition_join: 'fa-route text-emerald-500',
            like: 'fa-thumbs-up text-blue-500',
            dislike: 'fa-thumbs-down text-slate-400',
            reaction: 'fa-heart text-rose-500'
        };

        const typeLabels = {
            sound_add: 'Добавил',
            sound_delete: 'Удалил',
            reply: 'Ответил',
            comment: 'Комментарий',
            quest: 'Задание',
            expedition_join: 'Экспедиция',
            like: 'Лайк',
            dislike: 'Дизлайк',
            reaction: 'Реакция'
        };

        body.innerHTML = `
            <div class="rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 p-4 space-y-1.5">
                <p class="text-xs text-slate-500"><span class="font-bold text-slate-700 dark:text-slate-200">Логин:</span> @${login}</p>
                <p class="text-xs text-slate-500"><span class="font-bold text-slate-700 dark:text-slate-200">Регистрация:</span> ${fmt(p?.joinedAt) || '—'}</p>
                <p class="text-xs text-slate-500"><span class="font-bold text-slate-700 dark:text-slate-200">Роль:</span> ${p?.role === 'admin' || login === 'admin' ? 'Администратор' : 'Пользователь'}</p>
                <p class="text-xs text-slate-500"><span class="font-bold text-slate-700 dark:text-slate-200">Статус:</span> ${p?.blocked ? 'Заблокирован' : 'Активен'}</p>
                <p class="text-xs text-slate-500"><span class="font-bold text-slate-700 dark:text-slate-200">Email:</span> ${p?.email ? (p.emailVerified ? p.email + ' ✓' : p.email) : 'не привязан'}</p>
                <p class="text-xs text-slate-500"><span class="font-bold text-slate-700 dark:text-slate-200">Действий:</span> ${data.events.length}</p>
            </div>
            <div>
                <h5 class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Лента действий</h5>
                ${data.events.length ? data.events.map(e => {
                    const clickable = e.soundId
                        ? `onclick="window.closeUserActivityModal(); window.closeCabinet(); window.selectSound('${e.soundId}'); window.openDetailsModal && window.openDetailsModal();"`
                        : '';
                    return `
                    <div class="activity-row ${e.soundId ? 'cursor-pointer' : ''}" ${clickable}>
                        <i class="fa-solid ${icons[e.type] || 'fa-circle-info text-slate-400'} shrink-0 mt-0.5"></i>
                        <div class="min-w-0 flex-1">
                            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">${typeLabels[e.type] || e.type}</p>
                            <p class="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-snug">${e.text}</p>
                            ${fmt(e.date) ? `<p class="text-[10px] text-slate-400 mt-0.5">${fmt(e.date)}</p>` : ''}
                        </div>
                    </div>`;
                }).join('') : `<p class="text-xs text-slate-400">Действий пока нет</p>`}
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
            action: payload.action || null,
            moderationStatus: payload.moderationStatus || null,
            rejectionReason: payload.rejectionReason || null,
            date: new Date().toISOString(),
            read: false
        };

        targets.forEach(login => {
            let idx = updated.findIndex(p => String(p.loginName || '').toLowerCase() === String(login).toLowerCase());
            if (idx < 0) {
                updated.push({ loginName: String(login).toLowerCase(), displayName: login, notifications: [] });
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
        const list = [...((profile && profile.notifications) || [])].filter(n => n && !n.deleted);
        return list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    };

    window.refreshNotificationsUI = function() {
        const btn = document.getElementById('notif-btn');
        const btnMobile = document.getElementById('notif-btn-mobile');
        const badge = document.getElementById('notif-badge');
        const badgeMobile = document.getElementById('notif-badge-mobile');
        if (!window.currentUser) {
            if (btn) btn.classList.add('hidden');
            if (btnMobile) btnMobile.classList.add('hidden');
            if (badge) badge.classList.add('hidden');
            if (badgeMobile) badgeMobile.classList.add('hidden');
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
        if (typeof window.__lastNotifUnread === 'number'
            && unread > window.__lastNotifUnread
            && window.showDeviceNotificationFromInbox) {
            const newest = window.getMyNotifications().find((n) => !n.read);
            if (newest) window.showDeviceNotificationFromInbox(newest);
        }
        window.__lastNotifUnread = unread;
        if (document.getElementById('notif-panel') && !document.getElementById('notif-panel').classList.contains('hidden')) {
            window.renderNotificationsList();
        }
    };

    window.toggleNotificationsPanel = function(ev) {
        if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
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
            const sound = (window.soundsData || []).find((x) => x.id === n.soundId);
            const openAsEdit = n.action === 'edit'
                || n.moderationStatus === 'rejected'
                || n.moderationStatus === 'pending'
                || (sound && (sound.status === 'draft' || sound.status === 'rejected' || sound.status === 'pending'));
            if (n.type === 'moderation' && openAsEdit && window.editSound) {
                window.editSound(n.soundId);
            } else {
                window.selectSound(n.soundId);
                if (n.type === 'comment' || n.type === 'reply' || n.type === 'report' || n.type === 'reaction' || n.type === 'moderation' || n.type === 'like' || n.type === 'dislike' || n.type === 'new_sound') {
                    setTimeout(() => window.openDetailsModal(), 200);
                }
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

    window.clearAllNotifications = async function() {
        if (!window.currentUser) return;
        const ok = await window.CustomUI.open({
            title: '<i class="fa-solid fa-trash-can mr-2 text-red-500"></i>Очистить уведомления',
            message: 'Все уведомления будут удалены без возможности восстановления.',
            confirmText: 'Очистить',
            confirmClass: 'px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-md'
        });
        if (!ok) return;
        const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        const updated = [...(window.profilesData || [])];
        const idx = updated.findIndex(p => p.loginName === login);
        if (idx < 0) return;
        const now = new Date().toISOString();
        // Soft-delete: пустой массив при merge возвращает облачные уведомления обратно.
        const cleared = (updated[idx].notifications || []).map(n => ({
            ...n,
            deleted: true,
            read: true,
            date: now
        }));
        updated[idx] = {
            ...updated[idx],
            notifications: cleared,
            profileUpdatedAt: now
        };
        window.profilesData = updated;
        window.refreshNotificationsUI();
        const saved = await window.syncProfilesData(updated);
        window.refreshNotificationsUI();
        window.showToast(saved ? 'Уведомления очищены' : 'Не удалось очистить уведомления');
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
            text: 'Здравствуйте! Я бот поддержки RO·SMap. Опишите вопрос — отвечу из базы знаний. Если ответ не подойдёт, напишите «обращение» — создам тикет с номером для оператора.',
            date: new Date().toISOString(),
            read: true,
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
        if (window.refreshAdminSupportBadge) window.refreshAdminSupportBadge();
        if (window.syncAccountChrome) window.syncAccountChrome();
    };

    window.toggleMessagesPanel = function() {
        if (!window.currentUser) { if (window.openAuthModal) window.openAuthModal(); return; }
        window.openMessagesModal();
    };

    window.openMessagesModal = function(peerLogin = null, opts = {}) {
        const asSupport = !!(opts && opts.asSupport);
        if (window.bindMessagesKeyboardInset) window.bindMessagesKeyboardInset();
        if (window.openDockView) {
            if (window.playSfx) window.playSfx('open');
            window.openDockView('messages');
            window.touchMyPresence(true);
            if (peerLogin) window.openMessageThread(peerLogin, { asSupport });
            else window.showMessagesConversations();
            window.ensureSupportWelcome().then(() => {
                if (peerLogin) {
                    if (window.__activeMessagePeer === peerLogin) window.openMessageThread(peerLogin, { quiet: true, asSupport });
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

        if (peerLogin) window.openMessageThread(peerLogin, { asSupport });
        else window.showMessagesConversations();

        window.ensureSupportWelcome().then(() => {
            if (peerLogin) {
                if (window.__activeMessagePeer === peerLogin) window.openMessageThread(peerLogin, { quiet: true, asSupport });
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
        const peerKeyOf = (v) => String(v || '').toLowerCase();
        inbox.forEach(msg => {
            const peer = peerKeyOf(msg.fromId);
            if (!peer) return;
            const prev = byPeer.get(peer);
            if (!prev || new Date(msg.date) > new Date(prev.date)) byPeer.set(peer, { ...msg, fromId: peer });
        });

        const myLogin = String(window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase()).toLowerCase();

        (window.profilesData || []).forEach(p => {
            (p.inbox || []).forEach(msg => {
                if (peerKeyOf(msg.fromId) === myLogin) {
                    const peer = peerKeyOf(p.loginName);
                    const synthetic = { ...msg, fromId: peer, fromName: p.displayName || peer, _outgoingHint: true };
                    const prev = byPeer.get(peer);
                    if (!prev || new Date(msg.date) > new Date(prev.date)) byPeer.set(peer, synthetic);
                }
            });
        });

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
            const unread = inbox.filter(m => peerKeyOf(m.fromId) === peer && !m.read && !m.deleted).length;
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
            const openFn = `window.openMessageThread('${peer}')`;
            return `
            <button onclick="${openFn}" class="notif-item ${unread ? 'unread' : ''} ${isSupport ? 'msg-support-row' : ''} w-full text-left">
                <div class="relative shrink-0">${avatar}<span class="msg-online-dot ${online ? 'on' : ''}"></span></div>
                <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between gap-2">
                        <p class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">${window.escMsgHtml(name)}${isSupport ? ' <span class="text-[9px] text-blue-500 font-bold">поддержка</span>' : ''}</p>
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

    window.formatMsgTime = function(iso) {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            if (isNaN(d)) return '';
            const now = new Date();
            const sameDay = d.toDateString() === now.toDateString();
            if (sameDay) return d.toLocaleTimeString(window.currentLang === 'en' ? 'en-GB' : 'ru-RU', { hour: '2-digit', minute: '2-digit' });
            return d.toLocaleString(window.currentLang === 'en' ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        } catch (_) { return ''; }
    };

    window.renderMessageBubble = function(m) {
        if (m.deleted) {
            return `<div class="msg-bubble deleted ${m._mine ? 'mine' : ''}" data-msg-id="${m.id}">
                <p class="text-[13px] leading-snug">Сообщение удалено</p>
                <p class="msg-bubble-foot"><span>${window.formatMsgTime(m.date)}</span>${window.renderMessageTicks(m)}</p>
            </div>`;
        }
        const reply = m.replyTo
            ? `<div class="msg-bubble-reply">${window.escMsgHtml(m.replyTo.fromName || '')}: ${window.escMsgHtml(m.replyTo.text || (m.replyTo.image ? '📷 Фото' : ''))}</div>`
            : '';
        const img = m.image
            ? `<img src="${m.image}" class="msg-bubble-img" alt="" onclick="event.stopPropagation(); window.openMessageImage('${m.id}')">`
            : '';
        const edited = m.editedAt ? ' · изм.' : '';
        const reactions = m.reactions && Object.keys(m.reactions).length
            ? `<div class="msg-reactions">${Object.entries(m.reactions).map(([emoji, users]) =>
                users?.length ? `<span class="msg-reaction-chip">${emoji} ${users.length}</span>` : ''
            ).join('')}</div>`
            : '';
        return `<div class="msg-bubble ${m._mine ? 'mine' : ''} ${m._mine ? '' : 'swipe-reply-row'}" data-msg-id="${m.id}">
            ${m._mine ? '' : '<span class="swipe-reply-hint"><i class="fa-solid fa-reply"></i></span>'}
            ${reply}${img}
            ${m.text ? `<p class="text-[13px] leading-snug">${window.escMsgHtml(m.text)}</p>` : ''}
            ${reactions}
            <p class="msg-bubble-foot"><span>${window.formatMsgTime(m.date)}${edited}</span>${window.renderMessageTicks(m)}</p>
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
        if (window.__typingWatchTimer) clearInterval(window.__typingWatchTimer);
        window.__typingWatchTimer = setInterval(() => {
            if (!window.__activeMessagePeer) return;
            if (window.updateTypingIndicator) window.updateTypingIndicator(window.__activeMessagePeer);
        }, 1500);
        if (window.updateTypingIndicator) window.updateTypingIndicator(peerLogin);

        const myLogin = String(window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase()).toLowerCase();
        const peerKey = String(peerLogin || '').toLowerCase();
        const sameLogin = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
        let all = [];

        if (asSupport) {
            // Админ смотрит переписку пользователя с поддержкой
            const supportProfile = (window.getProfileByLogin ? window.getProfileByLogin(window.SUPPORT_LOGIN) : null) || {};
            const fromUser = (supportProfile.inbox || []).filter(m => sameLogin(m.fromId, peerLogin)).map(m => ({ ...m, _mine: false }));
            const userProfile = (window.getProfileByLogin ? window.getProfileByLogin(peerLogin) : null) || {};
            const fromSupport = (userProfile.inbox || []).filter(m => sameLogin(m.fromId, window.SUPPORT_LOGIN)).map(m => ({ ...m, _mine: true }));
            all = [...fromUser, ...fromSupport].sort((a, b) => new Date(a.date) - new Date(b.date));
        } else if (peerKey === String(window.SUPPORT_LOGIN || '').toLowerCase()) {
            const supportProfile = (window.getProfileByLogin ? window.getProfileByLogin(window.SUPPORT_LOGIN) : null) || {};
            const outgoing = (supportProfile.inbox || []).filter(m => sameLogin(m.fromId, myLogin)).map(m => ({ ...m, _mine: true }));
            const incoming = window.getMyInbox().filter(m => sameLogin(m.fromId, window.SUPPORT_LOGIN));
            all = [...incoming.map(m => ({ ...m, _mine: false })), ...outgoing].sort((a, b) => new Date(a.date) - new Date(b.date));
        } else {
            const incoming = window.getMyInbox().filter(m => sameLogin(m.fromId, peerLogin));
            const peerProfile = (window.getProfileByLogin ? window.getProfileByLogin(peerLogin) : null) || {};
            const outgoing = (peerProfile.inbox || []).filter(m => sameLogin(m.fromId, myLogin)).map(m => ({ ...m, _mine: true }));
            all = [...incoming.map(m => ({ ...m, _mine: false })), ...outgoing].sort((a, b) => new Date(a.date) - new Date(b.date));
        }

        if (list) {
            const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
            list.innerHTML = all.length
                ? all.map(m => window.renderMessageBubble(m)).join('')
                : `<p class="text-xs text-slate-400 text-center py-6">${peerKey === String(window.SUPPORT_LOGIN || '').toLowerCase() || asSupport
                    ? 'Опишите проблему с картой, публикацией или аккаунтом — ответим здесь.'
                    : 'Начните переписку'}</p>`;
            if (!quiet || nearBottom) list.scrollTop = list.scrollHeight;
            if (window.bindMessageBubbleMenus) window.bindMessageBubbleMenus(list);
            if (window.bindSwipeReplyRows) window.bindSwipeReplyRows(list, (id) => window.startMessageReply(id));
        }

        if (window.updateTypingIndicator) window.updateTypingIndicator(peerLogin);

        // Пометить прочитанными входящие в мой inbox
        const updated = [...(window.profilesData || [])];
        const myKey = String(myLogin || '').toLowerCase();
        const idx = updated.findIndex(p => String(p.loginName || '').toLowerCase() === myKey);
        if (idx >= 0 && !asSupport) {
            let changed = false;
            const peerKey = String(peerLogin || '').toLowerCase();
            const inbox = (updated[idx].inbox || []).map(m => {
                if (String(m.fromId || '').toLowerCase() === peerKey && !m.read) {
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
            const sIdx = updated.findIndex(p => String(p.loginName || '').toLowerCase() === String(window.SUPPORT_LOGIN || '').toLowerCase());
            if (sIdx >= 0) {
                let changed = false;
                const peerKey = String(peerLogin || '').toLowerCase();
                const inbox = (updated[sIdx].inbox || []).map(m => {
                    if (String(m.fromId || '').toLowerCase() === peerKey && !m.read) {
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
        const file = files[0];
        (async () => {
            try {
                window.showToast('Загрузка фото...');
                const blob = window.compressImageFile
                    ? await window.compressImageFile(file, 1280, 0.8)
                    : file;
                const url = await window.uploadUserMedia(
                    blob,
                    `msg_${Date.now()}.jpg`,
                    'image/jpeg'
                );
                window.__messagePendingImage = url;
                await window.sendMessageInThread();
            } catch (err) {
                console.error(err);
                window.showToast(err.message || 'Не удалось отправить фото');
            } finally {
                const input = document.getElementById('messages-photo-input');
                if (input) input.value = '';
            }
        })();
    };

    window.updateTypingIndicator = function(peerLogin) {
        const el = document.getElementById('messages-typing');
        const textEl = document.getElementById('messages-typing-text');
        if (!el) return;
        const peer = peerLogin || window.__activeMessagePeer;
        if (!peer || peer === window.SUPPORT_LOGIN) {
            el.classList.add('hidden');
            return;
        }
        const profile = window.getProfileByLogin ? window.getProfileByLogin(peer) : null;
        const typing = profile?.typing;
        const myLogin = window.currentUser?.loginName || String(window.currentUser?.username || '').toLowerCase();
        const fresh = typing && typing.to === myLogin && typing.at && (Date.now() - new Date(typing.at).getTime() < 4500);
        if (!fresh) {
            el.classList.add('hidden');
            return;
        }
        const name = profile?.displayName || peer;
        if (textEl) textEl.textContent = `${name} ${window.currentLang === 'en' ? 'is typing…' : 'печатает…'}`;
        el.classList.remove('hidden');
    };

    window.publishTypingStatus = async function(isTyping) {
        if (window.__sendingMessage) return;
        if (!window.currentUser || !window.__activeMessagePeer) return;
        if (window.__messagingAsSupport) return;
        const peer = window.__activeMessagePeer;
        if (peer === window.SUPPORT_LOGIN) return;
        const myLogin = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        const updated = [...(window.profilesData || [])];
        const idx = updated.findIndex(p => String(p.loginName || '').toLowerCase() === myLogin);
        if (idx < 0) return;
        const nextTyping = isTyping
            ? { to: peer, at: new Date().toISOString() }
            : null;
        const prev = updated[idx].typing;
        if (!isTyping && !prev) return;
        if (isTyping && prev?.to === peer && prev.at && Date.now() - new Date(prev.at).getTime() < 1200) return;
        updated[idx] = { ...updated[idx], typing: nextTyping, lastSeen: new Date().toISOString() };
        window.profilesData = updated;
        // Local-only: rewriting profiles.json on every keystroke caused multi-second freezes.
        // Peer typing indicators stay best-effort via lastSeen/poll until a lightweight channel exists.
    };

    window.onMessageComposeInput = function() {
        const input = document.getElementById('messages-compose-input');
        const hasText = !!(input && input.value.trim());
        if (window.__typingIdleTimer) clearTimeout(window.__typingIdleTimer);
        if (hasText) {
            window.publishTypingStatus(true);
            window.__typingIdleTimer = setTimeout(() => window.publishTypingStatus(false), 2800);
        } else {
            window.publishTypingStatus(false);
        }
        // auto-grow textarea
        if (input && input.tagName === 'TEXTAREA') {
            input.style.height = 'auto';
            input.style.height = Math.min(120, input.scrollHeight) + 'px';
        }
    };

    window.onMessageComposeKeydown = function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            window.sendMessageInThread();
        }
    };

    window.sendMessageInThread = async function() {
        const peer = window.__activeMessagePeer;
        if (!peer || !window.currentUser) return;
        const input = document.getElementById('messages-compose-input');
        const text = (input?.value || '').trim();
        const image = window.__messagePendingImage || null;
        if (!text && !image) return;
        const myLoginGuard = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        const guard = window.spamGuardCheck
            ? window.spamGuardCheck(`msg:${myLoginGuard}`, { minIntervalMs: 900, maxPerWindow: 30, windowMs: 60000 })
            : { ok: true };
        if (!guard.ok) { window.spamGuardToast(guard); return; }
        if (window.__typingIdleTimer) clearTimeout(window.__typingIdleTimer);
        window.__sendingMessage = true;

        try {
            const myLogin = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
            const asSupport = !!window.__messagingAsSupport;

            // Куда кладём сообщение и от чьего имени
            let targetLogin = peer;
            let fromId = myLogin;
            let fromName = window.currentUser.username;
            if (asSupport) {
                targetLogin = peer;
                fromId = window.SUPPORT_LOGIN;
                fromName = window.SUPPORT_NAME;
                await window.ensureSupportProfile();
            } else if (peer === window.SUPPORT_LOGIN) {
                targetLogin = window.SUPPORT_LOGIN;
                await window.ensureSupportProfile();
            }

            const updated = [...(window.profilesData || [])];
            // Снимаем «печатает» в том же write — без отдельной синхронизации перед отправкой.
            const myIdx = updated.findIndex(p => String(p.loginName || '').toLowerCase() === String(myLogin || '').toLowerCase());
            if (myIdx >= 0 && updated[myIdx].typing) {
                updated[myIdx] = { ...updated[myIdx], typing: null, lastSeen: new Date().toISOString() };
            }

            const targetKey = String(targetLogin || '').toLowerCase();
            let idx = updated.findIndex(p => String(p.loginName || '').toLowerCase() === targetKey);
            if (idx < 0) {
                updated.push({
                    loginName: targetKey,
                    displayName: targetKey === window.SUPPORT_LOGIN ? window.SUPPORT_NAME : targetLogin,
                    inbox: [],
                    notifications: []
                });
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

            let supportTicketNumber = null;
            if (!asSupport && peer === window.SUPPORT_LOGIN && !image && text && window.isSupportEscalationRequest?.(text)) {
                supportTicketNumber = window.getNextSupportTicketNumber ? window.getNextSupportTicketNumber() : null;
                if (supportTicketNumber != null) {
                    const subject = window.__supportBotLastQuestion && !window.isSupportEscalationRequest(window.__supportBotLastQuestion)
                        ? window.__supportBotLastQuestion
                        : text;
                    msg.text = `Обращение: ${subject}`;
                    msg.ticketNumber = supportTicketNumber;
                    msg.ticketStatus = 'open';
                    msg._ticket = true;
                }
            } else if (!asSupport && peer === window.SUPPORT_LOGIN && text) {
                window.__supportBotLastQuestion = text;
            }

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
                if (!asSupport && targetLogin === window.SUPPORT_LOGIN && window.notifyAdmins) {
                    const ticketLabel = supportTicketNumber != null ? `Обращение № ${supportTicketNumber}` : 'сообщение в поддержку';
                    window.notifyAdmins({
                        type: 'support',
                        text: `${window.currentUser.username || myLogin}: ${ticketLabel}`,
                        fromId: myLogin,
                        fromName: window.currentUser.username || myLogin
                    });
                }
                if (!asSupport && peer === window.SUPPORT_LOGIN && text && !image && window.appendSupportBotReply) {
                    if (supportTicketNumber != null) {
                        await window.appendSupportBotReply(
                            myLogin,
                            `Обращение № ${supportTicketNumber} создано. Оператор ответит в этом чате.`
                        );
                        window.showToast(`Обращение № ${supportTicketNumber} создано`);
                    } else {
                        const faq = window.matchSupportBotFaq ? window.matchSupportBotFaq(text) : null;
                        if (faq) {
                            await window.appendSupportBotReply(
                                myLogin,
                                `${faq.answer}\n\nПомогло? Если нет — напишите «обращение», и мы создадим тикет с номером.`
                            );
                        } else {
                            await window.appendSupportBotReply(
                                myLogin,
                                'Пока нет точного ответа в базе. Уточните вопрос или напишите «обращение» — создам тикет для оператора.'
                            );
                        }
                    }
                    if (window.openMessageThread) window.openMessageThread(window.SUPPORT_LOGIN);
                }
                if (window.refreshAdminSupportBadge) window.refreshAdminSupportBadge();
            } else {
                window.showToast('Не удалось отправить');
            }
        } finally {
            window.__sendingMessage = false;
        }
    };

    window.openMessageMenu = function(msgId, position) {
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
                label: 'Поставить реакцию',
                onClick: () => {
                    const reactItems = window.MSG_REACT_EMOJI.map(emoji => ({
                        icon: 'fa-heart',
                        label: emoji,
                        onClick: () => window.toggleMessageReaction(msgId, emoji)
                    }));
                    setTimeout(() => {
                        const reactOpts = {
                            title: 'Реакция',
                            clientX: position?.clientX,
                            clientY: position?.clientY
                        };
                        if (window.openActionsMenu) {
                            window.openActionsMenu(reactItems, reactOpts);
                        } else if (window.ActionSheet) {
                            window.ActionSheet.open(reactItems);
                        }
                    }, 40);
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
        if (!items.length) return;

        const menuOpts = {
            title: isMine ? 'Ваше сообщение' : (m.fromName || 'Сообщение'),
            clientX: position?.clientX,
            clientY: position?.clientY
        };
        if (window.openActionsMenu) {
            window.openActionsMenu(items, menuOpts);
        } else if (window.ActionSheet) {
            window.ActionSheet.open(items);
        }
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
    window.refreshProfileButtonAvatar = function() {
        const src = window.currentUser?.avatar || '';
        const pairs = [
            ['profile-btn', 'profile-btn-avatar'],
            ['profile-btn-mobile', 'profile-btn-mobile-avatar']
        ];
        pairs.forEach(([btnId, imgId]) => {
            const btn = document.getElementById(btnId);
            const img = document.getElementById(imgId);
            if (!btn || !img) return;
            if (src) {
                img.src = src;
                img.classList.remove('hidden');
                btn.classList.add('has-avatar');
            } else {
                img.removeAttribute('src');
                img.classList.add('hidden');
                btn.classList.remove('has-avatar');
            }
        });
    };

    window.fillProfileSettingsForm = function() {
        if (!window.currentUser) return;
        const nameEl = document.getElementById('profile-display-name');
        const bioEl = document.getElementById('profile-bio');
        const gearEl = document.getElementById('profile-gear');
        const linksEl = document.getElementById('profile-links');
        if (nameEl) nameEl.value = window.currentUser.username || '';
        if (bioEl) bioEl.value = window.currentUser.bio || '';
        if (gearEl) gearEl.value = (window.currentUser.gear || []).join(', ');
        if (linksEl) linksEl.value = (window.currentUser.links || []).join(', ');

        const emailEl = document.getElementById('profile-email');
        if (emailEl) emailEl.value = window.currentUser.email || '';
        window.refreshEmailVerificationUI();
        window.captureCabinetFormSnapshot();
    };

    window.saveDisplayNameFromSettings = async function() {
        if (!window.currentUser) return;
        const name = (document.getElementById('profile-display-name')?.value || '').trim();
        if (name.length < 2) { window.showToast('Имя слишком короткое'); return; }
        if (name.length > 40) { window.showToast('Имя слишком длинное'); return; }
        const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
        try {
            const usersDb = JSON.parse(localStorage.getItem('rosmap_users_db') || '{}');
            if (usersDb[login]) {
                usersDb[login].displayName = name;
                localStorage.setItem('rosmap_users_db', JSON.stringify(usersDb));
            }
        } catch (_) {}

        window.showToast('Сохранение имени...');
        const ok = await window.saveMyProfile({ username: name });
        if (ok) {
            (window.soundsData || []).forEach(s => {
                if (s.recordistId === login) s.recordist = name;
            });
            const cloud = [...(window.cloudDataCache || [])];
            let cloudChanged = false;
            cloud.forEach((s, i) => {
                if (s && s.recordistId === login && s.recordist !== name) {
                    cloud[i] = { ...s, recordist: name };
                    cloudChanged = true;
                }
            });
            if (cloudChanged && window.syncCloudData) await window.syncCloudData(cloud);
            if (window.renderCabinet) window.renderCabinet();
            window.showToast('Имя обновлено');
        } else {
            window.showToast('Не удалось сохранить имя');
        }
    };

    window.saveMyProfileFromSettingsForm = async function() {
        if (!window.currentUser) return;
        const bio = (document.getElementById('profile-bio')?.value || '').trim();
        const gear = (document.getElementById('profile-gear')?.value || '').split(',').map(g => g.trim()).filter(Boolean);
        const links = (document.getElementById('profile-links')?.value || '').split(',').map(l => l.trim()).filter(Boolean);
        window.showToast('Сохранение профиля...');
        const ok = await window.saveMyProfile({ bio, gear, links });
        if (ok) {
            window.currentUser.bio = bio;
            window.currentUser.gear = gear;
            window.currentUser.links = links;
            localStorage.setItem('rosmap_user', JSON.stringify(window.currentUser));
            if (window.fillProfileSettingsForm) window.fillProfileSettingsForm();
            window.showToast('Профиль обновлён');
            if (window.evaluateFieldProgress) window.evaluateFieldProgress();
        } else {
            window.showToast('Не удалось сохранить профиль');
        }
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