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
        headers.Authorization = `Bearer ${token}`;
        body.token = token;
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

window.apiSyncJson = function(fileName, data) {
    return window.apiRequest('sync', { fileName, data }, { auth: true });
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
