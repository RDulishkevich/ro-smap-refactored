/**
 * Лёгкие UI-звуки на Web Audio API (без внешних файлов).
 * Включается/выключается в настройках: uiSounds.
 */
(function initUiSfx() {
    const DEFAULT_VOLUME = 0.45;
    let ctx = null;
    let master = null;
    let unlocked = false;
    let lastPlayed = Object.create(null);
    const pending = [];

    window.uiSoundsEnabled = (() => {
        try {
            const v = localStorage.getItem('rosmap_ui_sounds');
            if (v === '0') return false;
            if (v === '1') return true;
        } catch (_) {}
        return true;
    })();

    function ensureCtx() {
        // Переиспользуем основной граф плеера, если он уже есть — он точно разблокируется при play.
        const shared = window.audioContext;
        if (shared && shared.state !== 'closed') {
            if (ctx !== shared) {
                ctx = shared;
                master = null;
            }
        }
        if (ctx && ctx.state !== 'closed') {
            if (!master) {
                master = ctx.createGain();
                master.gain.value = DEFAULT_VOLUME;
                master.connect(ctx.destination);
            }
            return ctx;
        }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = DEFAULT_VOLUME;
        master.connect(ctx.destination);
        return ctx;
    }

    /** Короткий silent-буфер — нужен Safari/iOS, одного resume() часто мало. */
    function tickSilent(c) {
        try {
            const buf = c.createBuffer(1, 1, c.sampleRate || 44100);
            const src = c.createBufferSource();
            src.buffer = buf;
            src.connect(master || c.destination);
            src.start(0);
        } catch (_) {}
    }

    function flushPending() {
        if (!pending.length) return;
        const names = pending.splice(0, pending.length);
        names.forEach((name) => {
            try { if (PRESETS[name]) PRESETS[name](); } catch (_) {}
        });
    }

    function unlockFromGesture() {
        const c = ensureCtx();
        if (!c) return;
        if (c.state === 'suspended') {
            try { c.resume(); } catch (_) {}
        }
        tickSilent(c);
        unlocked = c.state === 'running';
        if (unlocked) flushPending();
        if (c.state === 'suspended') {
            c.resume().then(() => {
                unlocked = c.state === 'running';
                tickSilent(c);
                if (unlocked) flushPending();
            }).catch(() => {});
        }
    }

    // Жест пользователя разблокирует AudioContext (политика браузеров).
    // Не снимаем слушатели сразу — resume может завершиться чуть позже.
    const onGesture = () => unlockFromGesture();
    document.addEventListener('pointerdown', onGesture, true);
    document.addEventListener('keydown', onGesture, true);
    document.addEventListener('touchstart', onGesture, { capture: true, passive: true });
    document.addEventListener('click', onGesture, true);

    function tone({ freq = 440, dur = 0.12, type = 'sine', gain = 1, attack = 0.008, release = 0.08, delay = 0, detune = 0 }) {
        const c = ensureCtx();
        if (!c || !master || c.state !== 'running') return;
        const t0 = c.currentTime + delay;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        if (detune) osc.detune.setValueAtTime(detune, t0);
        const peak = Math.max(0.0001, gain);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(peak, t0 + Math.max(0.001, attack));
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(attack + 0.02, dur));
        osc.connect(g);
        g.connect(master);
        osc.start(t0);
        osc.stop(t0 + dur + release + 0.05);
    }

    function noiseBurst({ dur = 0.05, gain = 0.35, filterFreq = 1800 }) {
        const c = ensureCtx();
        if (!c || !master || c.state !== 'running') return;
        const n = Math.max(1, Math.floor(c.sampleRate * dur));
        const buf = c.createBuffer(1, n, c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
        const src = c.createBufferSource();
        src.buffer = buf;
        const filter = c.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = filterFreq;
        filter.Q.value = 0.8;
        const g = c.createGain();
        const t0 = c.currentTime;
        g.gain.setValueAtTime(Math.max(0.0001, gain), t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(filter);
        filter.connect(g);
        g.connect(master);
        src.start(t0);
        src.stop(t0 + dur + 0.02);
    }

    const PRESETS = {
        click: () => {
            tone({ freq: 620, dur: 0.06, type: 'triangle', gain: 0.55, attack: 0.002, release: 0.04 });
            tone({ freq: 920, dur: 0.05, type: 'sine', gain: 0.28, delay: 0.012 });
        },
        select: () => {
            tone({ freq: 480, dur: 0.08, type: 'sine', gain: 0.45 });
            tone({ freq: 720, dur: 0.1, type: 'triangle', gain: 0.32, delay: 0.04 });
        },
        open: () => {
            tone({ freq: 320, dur: 0.11, type: 'sine', gain: 0.4 });
            tone({ freq: 480, dur: 0.13, type: 'triangle', gain: 0.3, delay: 0.05 });
            tone({ freq: 640, dur: 0.11, type: 'sine', gain: 0.2, delay: 0.1 });
        },
        close: () => {
            tone({ freq: 520, dur: 0.09, type: 'sine', gain: 0.32 });
            tone({ freq: 340, dur: 0.11, type: 'triangle', gain: 0.24, delay: 0.04 });
        },
        toast: () => {
            tone({ freq: 700, dur: 0.07, type: 'sine', gain: 0.38 });
        },
        success: () => {
            tone({ freq: 523.25, dur: 0.09, type: 'sine', gain: 0.45 });
            tone({ freq: 659.25, dur: 0.11, type: 'sine', gain: 0.38, delay: 0.07 });
            tone({ freq: 783.99, dur: 0.15, type: 'triangle', gain: 0.32, delay: 0.14 });
        },
        error: () => {
            tone({ freq: 220, dur: 0.13, type: 'square', gain: 0.22 });
            tone({ freq: 180, dur: 0.17, type: 'triangle', gain: 0.3, delay: 0.06 });
        },
        notify: () => {
            tone({ freq: 880, dur: 0.09, type: 'sine', gain: 0.42 });
            tone({ freq: 1174.66, dur: 0.15, type: 'sine', gain: 0.36, delay: 0.09 });
        },
        send: () => {
            tone({ freq: 660, dur: 0.07, type: 'triangle', gain: 0.38 });
            tone({ freq: 990, dur: 0.11, type: 'sine', gain: 0.28, delay: 0.05 });
            noiseBurst({ dur: 0.03, gain: 0.12, filterFreq: 2400 });
        },
        play: () => {
            tone({ freq: 440, dur: 0.08, type: 'sine', gain: 0.38 });
            tone({ freq: 660, dur: 0.09, type: 'triangle', gain: 0.28, delay: 0.04 });
        },
        pause: () => {
            tone({ freq: 360, dur: 0.09, type: 'sine', gain: 0.32 });
        },
        whoosh: () => {
            noiseBurst({ dur: 0.1, gain: 0.28, filterFreq: 900 });
            tone({ freq: 240, dur: 0.11, type: 'sine', gain: 0.18, delay: 0.01 });
        }
    };

    window.setUiSoundsEnabled = function(enabled, skipSave = false) {
        window.uiSoundsEnabled = !!enabled;
        try { localStorage.setItem('rosmap_ui_sounds', enabled ? '1' : '0'); } catch (_) {}
        if (!skipSave && window.saveUserSettings) window.saveUserSettings('uiSounds', !!enabled);
        if (window.refreshSettingsUI) window.refreshSettingsUI();
        if (enabled) window.playSfx('click', { force: true });
    };

    window.playSfx = function(name, { force = false, throttleMs = 90 } = {}) {
        if (!force && !window.uiSoundsEnabled) return;
        if (!PRESETS[name]) return;
        const now = Date.now();
        if (!force && lastPlayed[name] && (now - lastPlayed[name]) < throttleMs) return;
        lastPlayed[name] = now;

        const c = ensureCtx();
        if (!c) return;

        const playNow = () => {
            try { PRESETS[name](); } catch (err) {
                console.warn('[sfx]', name, err);
            }
        };

        // Синхронный путь: контекст уже running (после жеста / плеера).
        if (c.state === 'running') {
            unlocked = true;
            playNow();
            return;
        }

        // Пытаемся resume в этом же тике (если вызов из click/pointerdown — жест ещё «живой»).
        try { c.resume(); } catch (_) {}
        tickSilent(c);

        if (c.state === 'running') {
            unlocked = true;
            playNow();
            return;
        }

        c.resume().then(() => {
            if (c.state === 'running') {
                unlocked = true;
                tickSilent(c);
                playNow();
            } else if (!pending.includes(name)) {
                pending.push(name);
            }
        }).catch(() => {
            if (!pending.includes(name)) pending.push(name);
        });
    };

    // Плеер разблокирует тот же AudioContext — подхватываем и сбрасываем очередь.
    window.unlockUiSfx = unlockFromGesture;

    window.sfxFromToastMessage = function(message) {
        const m = String(message || '').toLowerCase();
        if (/ошибк|неверн|не удалось|заблокир|занят|заполните|нужно |сначала |недоступ|wrong|failed|error|blocked/.test(m)) {
            return 'error';
        }
        if (/успеш|сохран|обновл|опублик|отправл|создан|одобр|подписк|разблокир|готово|success|saved|sent|created|published/.test(m)) {
            return 'success';
        }
        return 'toast';
    };
})();
