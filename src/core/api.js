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

window.apiRequestEmailVerification = function(email) {
    return window.apiRequest('requestEmailVerification', { email }, { auth: true });
};

window.apiConfirmEmailVerification = function(code) {
    return window.apiRequest('confirmEmailVerification', { code }, { auth: true });
};

window.apiGetMail = async function() {
    const data = await window.apiRequest('getMail', {}, { auth: true });
    return Array.isArray(data?.data) ? data.data : [];
};

window.apiHealth = function() {
    return window.apiRequest('health');
};

/** Browser-safe public config (Maps key with HTTP Referer lock). No auth secrets. */
window.apiPublicConfig = function() {
    return window.apiRequest('publicConfig');
};

/**
 * Load Yandex Maps JS API 2.1 (+ optional 3.x) after fetching key from Secure API.
 * Key is never committed to frontend source.
 */
window.ensureYandexMapsLoaded = async function() {
    if (typeof window.ymaps !== 'undefined') return true;
    if (window.__yandexMapsLoadPromise) return window.__yandexMapsLoadPromise;

    window.__yandexMapsLoadPromise = (async () => {
        let key = String(window.YANDEX_MAPS_API_KEY || '').trim();
        if (!key && window.apiPublicConfig) {
            try {
                const cfg = await window.apiPublicConfig();
                key = String(cfg?.yandexMapsApiKey || '').trim();
                if (cfg?.bucketUrl && !window.YANDEX_BUCKET_URL) {
                    window.YANDEX_BUCKET_URL = cfg.bucketUrl;
                }
            } catch (err) {
                console.warn('publicConfig failed', err);
            }
        }
        if (!key) throw new Error('Yandex Maps API key is not configured on the server');
        window.YANDEX_MAPS_API_KEY = key;

        const loadScript = (src, attrs = {}) => new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const s = document.createElement('script');
            s.src = src;
            s.async = true;
            Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
            s.onload = () => resolve();
            s.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(s);
        });

        await loadScript(`https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=ru_RU`);
        // API 3 — тихий режим; грузим заранее, включается только при провайдере yandex3
        try {
            await loadScript(`https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(key)}&lang=ru_RU`, { 'data-ymaps3': '1' });
        } catch (_) {}

        if (typeof window.ymaps === 'undefined') throw new Error('ymaps failed to initialize');
        return true;
    })().catch((err) => {
        window.__yandexMapsLoadPromise = null;
        throw err;
    });

    return window.__yandexMapsLoadPromise;
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

/** Patch plays / downloads / reactions without rewriting all of map_data.json. */
window.apiPatchSound = async function(soundId, ops) {
    return window.apiRequest('patchSound', { soundId, ops }, { auth: true });
};

window.apiPresignUpload = function(fileName, contentType, contentLength) {
    const payload = { fileName, contentType };
    if (contentLength > 0) payload.contentLength = contentLength;
    return window.apiRequest('presign', payload, { auth: true });
};

/** Yandex Translate via Secure API. Returns array of translated strings. */
window.apiTranslate = async function(texts, opts = {}) {
    const list = Array.isArray(texts) ? texts : [texts];
    const data = await window.apiRequest('translate', {
        texts: list,
        sourceLanguageCode: opts.sourceLanguageCode || 'ru',
        targetLanguageCode: opts.targetLanguageCode || 'en'
    }, { auth: true });
    return data.translations || [];
};

window.MAX_IMAGE_UPLOAD_BYTES = 30 * 1024 * 1024;       // 30 MB
window.MAX_AUDIO_UPLOAD_BYTES = 1024 * 1024 * 1024;     // 1 GB

window.isForbiddenMediaUrl = function(url) {
    return typeof url === 'string' && /^(data:|blob:)/i.test(url.trim());
};

window.isHttpMediaUrl = function(url) {
    return typeof url === 'string' && /^https?:\/\//i.test(url.trim()) && !window.isForbiddenMediaUrl(url);
};

/** Сжать картинку в JPEG blob (для аватара / вложений в чат). */
window.compressImageFile = function(file, maxSide = 720, quality = 0.82) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            try {
                const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
                const w = Math.max(1, Math.round((img.width || 1) * scale));
                const h = Math.max(1, Math.round((img.height || 1) * scale));
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                URL.revokeObjectURL(url);
                canvas.toBlob(
                    (blob) => (blob ? resolve(blob) : reject(new Error('compress_failed'))),
                    'image/jpeg',
                    quality
                );
            } catch (err) {
                URL.revokeObjectURL(url);
                reject(err);
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('image_load_failed'));
        };
        img.src = url;
    });
};

window.dataUrlToBlob = async function(dataUrl) {
    const res = await fetch(dataUrl);
    return res.blob();
};

/** Presigned PUT в uploads/{login}/… → публичный URL. */
window.uploadUserMedia = async function(blob, fileName, contentType) {
    const login = window.currentUser?.loginName
        || String(window.currentUser?.username || '').toLowerCase();
    if (!login) throw Object.assign(new Error('unauthorized'), { code: 'unauthorized' });
    const type = contentType || blob.type || 'application/octet-stream';
    const size = blob.size || 0;
    const isImage = /^image\//i.test(type);
    const isAudio = /^audio\//i.test(type);
    const max = isImage ? window.MAX_IMAGE_UPLOAD_BYTES : window.MAX_AUDIO_UPLOAD_BYTES;
    if (size > max) {
        const mb = Math.round(max / (1024 * 1024));
        const label = mb >= 1024 ? `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} ГБ` : `${mb} МБ`;
        throw Object.assign(new Error(isImage ? `Фото больше ${label}` : `Аудио больше ${label}`), {
            code: 'file_too_large'
        });
    }
    const safeName = String(fileName || `file_${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `uploads/${login}/${safeName}`;
    const pre = await window.apiPresignUpload(key, type, size);
    const putRes = await fetch(pre.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': type },
        body: blob
    });
    if (!putRes.ok) throw new Error('Ошибка загрузки файла в облако');
    return pre.publicUrl || `${window.YANDEX_BUCKET_URL}/${key}`;
};

/** Загрузить картинку (File/Blob/data-URL) → https URL в Object Storage. */
window.uploadImageToStorage = async function(input, fileNamePrefix = 'img') {
    let blob = input;
    if (typeof input === 'string') {
        if (window.isHttpMediaUrl(input)) return input;
        if (/^data:/i.test(input)) blob = await window.dataUrlToBlob(input);
        else throw new Error('bad_image');
    } else if (input instanceof Blob) {
        blob = /^image\//i.test(input.type || '')
            ? (window.compressImageFile ? await window.compressImageFile(input, 1600, 0.82) : input)
            : input;
    } else {
        throw new Error('bad_image');
    }
    return window.uploadUserMedia(blob, `${fileNamePrefix}_${Date.now()}.jpg`, 'image/jpeg');
};

/** Восстановить сессию после перезагрузки (JWT → me). */
window.restoreAuthSession = async function() {
    const token = window.getAuthToken();
    if (!token) return false;
    try {
        const data = await window.apiMe();
        if (data.token) window.setAuthSession(data.token, data.user);
        else window.setAuthSession(token, data.user);
        // PII (email и т.п.) приходят из private_meta через me, не из публичного profiles.json
        if (data.user && window.currentUser) {
            if (data.user.email !== undefined) window.currentUser.email = data.user.email || '';
            if (data.user.emailVerified !== undefined) window.currentUser.emailVerified = !!data.user.emailVerified;
            if (data.user.skillLevel !== undefined) window.currentUser.skillLevel = data.user.skillLevel || '';
            if (data.user.platformIntents !== undefined) {
                window.currentUser.platformIntents = Array.isArray(data.user.platformIntents)
                    ? data.user.platformIntents
                    : [];
            }
            if (data.user.pdConsent !== undefined) window.currentUser.pdConsent = !!data.user.pdConsent;
            if (data.user.pdConsentAt !== undefined) window.currentUser.pdConsentAt = data.user.pdConsentAt || '';
            try { localStorage.setItem('rosmap_user', JSON.stringify(window.currentUser)); } catch (_) {}
        }
        return true;
    } catch (err) {
        if (err.code === 'unauthorized' || err.code === 'blocked' || err.status === 401 || err.status === 403) {
            window.clearAuthSession();
        }
        return false;
    }
};
