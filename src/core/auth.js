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
            window.currentUser = { username: 'Admin', role: 'admin', settings: { theme: 'light', mapStyle: 'normal', lang: 'ru' } };
            localStorage.setItem('rosmap_user', JSON.stringify(window.currentUser));
            window.closeAuthModal();
            window.showToast('Успешный вход: Админ');
            window.applyUserSettings();
            window.openCabinet();
            return;
        }

        const userKey = name.toLowerCase();

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
            window.currentUser.avatar = e.target.result;
            localStorage.setItem('rosmap_user', JSON.stringify(window.currentUser));
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
        const btnSettings = document.getElementById('cab-tab-settings');
        const btnSecurity = document.getElementById('cab-tab-security');
        const btnSupport = document.getElementById('cab-tab-support');
        const btnFaq = document.getElementById('cab-tab-faq');
        const btnAdmin = document.getElementById('cab-tab-admin');
        
        const pnlSounds = document.getElementById('cab-panel-sounds');
        const pnlSettings = document.getElementById('cab-panel-settings');
        const pnlSecurity = document.getElementById('cab-panel-security');
        const pnlSupport = document.getElementById('cab-panel-support');
        const pnlFaq = document.getElementById('cab-panel-faq');
        const pnlAdmin = document.getElementById('cab-panel-admin');

        const activeClass = "py-3 px-3 text-[13px] font-bold text-blue-600 border-b-2 border-blue-600 transition-colors whitespace-nowrap";
        const activeAdminClass = "py-3 px-3 text-[13px] font-bold text-red-600 border-b-2 border-red-600 transition-colors whitespace-nowrap";
        const inactiveClass = "py-3 px-3 text-[13px] font-bold text-slate-500 dark:text-slate-400 border-b-2 border-transparent hover:text-slate-800 dark:hover:text-slate-200 transition-colors whitespace-nowrap";

        [btnSounds, btnSettings, btnSecurity, btnSupport, btnFaq, btnAdmin].forEach(btn => {
            if (!btn || btn.classList.contains('hidden')) return;
            btn.className = inactiveClass;
        });

        [pnlSounds, pnlSettings, pnlSecurity, pnlSupport, pnlFaq, pnlAdmin].forEach(panel => {
            if (panel) panel.classList.add('hidden');
        });

        if (tab === 'sounds') {
            if (btnSounds) btnSounds.className = activeClass;
            if (pnlSounds) pnlSounds.classList.remove('hidden');
            window.renderCabinet();
        } else if (tab === 'settings') {
            if (btnSettings) btnSettings.className = activeClass;
            if (pnlSettings) pnlSettings.classList.remove('hidden');
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

    window.renderCabinet = function() {
        if(!window.currentUser) return;
        
        document.getElementById('cabinet-user-name').textContent = window.currentUser.username;
        const joinedEl = document.getElementById('cabinet-user-joined');
        if (joinedEl) joinedEl.innerHTML = `<i class="fa-solid fa-calendar-days"></i>${new Date().toLocaleDateString('ru-RU')}`;
        const statsEl = document.getElementById('cabinet-user-stats');
        if (statsEl) statsEl.innerHTML = `<i class="fa-solid fa-microphone"></i>${window.soundsData.filter(s => s.recordist && s.recordist.toLowerCase() === window.currentUser.username.toLowerCase()).length} звуков`;

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
        
        const mySounds = window.soundsData.filter(s => s.recordist && s.recordist.toLowerCase() === window.currentUser.username.toLowerCase());
        
        document.getElementById('cabinet-stat-count').textContent = mySounds.length;
        
        let totalSecs = 0;
        mySounds.forEach(s => totalSecs += window.parseDuration(s.duration));
        document.getElementById('cabinet-stat-duration').textContent = window.formatTotalDuration(totalSecs);
        
        const list = document.getElementById('cabinet-sounds-list');
        if(mySounds.length === 0) {
            list.innerHTML = `<div class="text-center py-12 text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm"><i class="fa-solid fa-microphone-slash text-4xl mb-3 opacity-30 block"></i><p class="font-medium text-sm">Вы еще не загрузили ни одного звука.</p><p class="text-xs mt-1">Опубликованные вами звуки появятся здесь.</p></div>`;
            return;
        }
        
        list.innerHTML = mySounds.map(s => {
            const isHardcoded = window.rawSoundsData.map(r => r.id).includes(s.id);
            return `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow gap-3">
                <div class="flex items-center gap-3 overflow-hidden">
                    <button onclick="window.selectSound('${s.id}'); window.closeCabinet();" class="w-10 h-10 rounded-full bg-blue-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 hover:scale-105 transition-transform" title="Воспроизвести на карте">
                        <i class="fa-solid fa-play text-sm translate-x-[1px] pointer-events-none"></i>
                    </button>
                    <div class="flex-1 min-w-0 pr-2">
                        <p class="text-sm font-bold text-slate-800 dark:text-white truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400" onclick="window.selectSound('${s.id}'); window.closeCabinet(); window.openDetailsModal();">${s.title}</p>
                        <div class="flex items-center gap-2 mt-0.5">
                            <span class="text-[10px] text-slate-500 font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded truncate max-w-[120px] sm:max-w-none">${s.fileName}</span>
                            ${isHardcoded ? `<span class="text-[8px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded uppercase tracking-wider">Вшито</span>` : ''}
                        </div>
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

    window.renderAdminList = function() {
        const list = document.getElementById('admin-sounds-list');
        if(!list) return;
                
        const rawIds = window.rawSoundsData.map(s => s.id);
                
        list.innerHTML = window.soundsData.map(s => {
            const isHardcoded = rawIds.includes(s.id);
            return `
                <div class="flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer bg-white dark:bg-slate-800 rounded-xl" onclick="window.openedFromAdmin=true; window.closeCabinet(); window.selectSound('${s.id}'); window.openDetailsModal();">
                    <div class="flex-1 min-w-0 pr-4">
                        <p class="text-sm font-bold text-slate-800 dark:text-white truncate">${s.title}</p>
                        <p class="text-xs text-slate-500 truncate">${s.archiveNum}_${s.fileName}</p>
                    </div>
                    <div class="flex items-center gap-2" onclick="event.stopPropagation()">
                        ${isHardcoded ? `<span class="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">Вшито</span>` : ''}
                        <button onclick="window.openedFromAdmin=true; window.editSound('${s.id}'); window.closeCabinet();" class="text-blue-600 hover:text-white bg-blue-50 hover:bg-blue-500 dark:bg-blue-900/30 dark:hover:bg-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm">Изменить</button>
                        <button onclick="window.deleteSoundFromCloud('${s.id}')" class="text-red-600 hover:text-white bg-red-50 hover:bg-red-500 dark:bg-red-900/30 dark:hover:bg-red-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm">Удалить</button>
                    </div>
                </div>
            `;
        }).join('');
    };
}