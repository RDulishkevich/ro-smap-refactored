/** Клиент безопасного API (Yandex Cloud Function). */

window.getAuthToken = function() {
    try { return localStorage.getItem('rosmap_token') || ''; } catch (_) { return ''; }
};

window.setAuthSession = function(token, user) {
    try {
        if (token) localStorage.setItem('rosmap_token', token);
        else localStorage.removeItem('rosmap_token');
    } catch (_) {}
    if (user) {
        window.currentUser = {
            ...(window.currentUser || {}),
            username: user.username || user.displayName || user.login,
            loginName: user.loginName || user.login,
            role: user.role === 'admin' ? 'admin' : 'user',
            settings: (window.currentUser && window.currentUser.settings) || { theme: 'light', mapStyle: 'normal', lang: 'ru' }
        };
        try { localStorage.setItem('rosmap_user', JSON.stringify(window.currentUser)); } catch (_) {}
    }
};

window.clearAuthSession = function() {
    try {
        localStorage.removeItem('rosmap_token');
        localStorage.removeItem('rosmap_user');
    } catch (_) {}
    window.currentUser = null;
};

window.apiRequest = async function(action, payload = {}, { auth = false } = {}) {
    const url = window.YANDEX_FUNCTION_URL;
    if (!url) throw new Error('YANDEX_FUNCTION_URL is empty');

    const headers = { 'Content-Type': 'application/json' };
    const body = { action, ...payload };
    if (auth) {
        const token = window.getAuthToken();
        if (!token) {
            const err = new Error('unauthorized');
            err.code = 'unauthorized';
            throw err;
        }
        // Важно: НЕ слать Authorization: Bearer — у functions.yandexcloud.net
        // этот заголовок означает IAM-токен вызова функции, а не наш JWT.
        body.token = token;
        headers['X-Rosmap-Token'] = token;
    }

    const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });

    let data = null;
    try { data = await res.json(); } catch (_) { data = null; }

    if (!res.ok || (data && data.ok === false)) {
        const err = new Error((data && (data.message || data.error)) || `HTTP ${res.status}`);
        err.code = (data && data.error) || `http_${res.status}`;
        err.status = res.status;
        err.data = data;
        throw err;
    }
    return data || { ok: true };
};

window.apiRegister = function(login, password, displayName) {
    return window.apiRequest('register', { login, password, displayName: displayName || login });
};

window.apiLogin = function(login, password) {
    return window.apiRequest('login', { login, password });
};

window.apiMe = function() {
    return window.apiRequest('me', {}, { auth: true });
};

window.apiChangePassword = function(currentPassword, newPassword) {
    return window.apiRequest('changePassword', { currentPassword, newPassword }, { auth: true });
};

window.apiSyncJson = async function(fileName, data) {
    const login = window.currentUser?.loginName
        || String(window.currentUser?.username || '').toLowerCase();
    if (!login) throw Object.assign(new Error('unauthorized'), { code: 'unauthorized' });

    const raw = JSON.stringify(Array.isArray(data) ? data : []);
    // Мелкие файлы — сразу sync; крупные — staging в бакет + commit (лимит CF ~3.5MB)
    if (raw.length < 2_000_000) {
        try {
            return await window.apiRequest('sync', { fileName, data }, { auth: true });
        } catch (err) {
            if (err.code !== 'payload_too_large' && err.status !== 413) throw err;
        }
    }

    const stagingKey = `staging/${login}/${fileName}`;
    const pre = await window.apiPresignUpload(stagingKey, 'application/json');
    const putRes = await fetch(pre.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: raw
    });
    if (!putRes.ok) throw new Error('Ошибка staging-загрузки в облако');
    return window.apiRequest('commit', { fileName }, { auth: true });
};

window.apiPresignUpload = function(fileName, contentType) {
    return window.apiRequest('presign', { fileName, contentType }, { auth: true });
};

/** Восстановить сессию после перезагрузки (JWT → me). */
window.restoreAuthSession = async function() {
    const token = window.getAuthToken();
    if (!token) return false;
    try {
        const data = await window.apiMe();
        if (data.token) window.setAuthSession(data.token, data.user);
        else window.setAuthSession(token, data.user);
        return true;
    } catch (err) {
        if (err.code === 'unauthorized' || err.code === 'blocked' || err.status === 401 || err.status === 403) {
            window.clearAuthSession();
        }
        return false;
    }
};
