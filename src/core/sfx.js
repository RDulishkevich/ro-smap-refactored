/**
 * Лёгкие UI-звуки на Web Audio API (без внешних файлов).
 * Включается/выключается в настройках: uiSounds.
 */
(function initUiSfx() {
    const DEFAULT_VOLUME = 0.22;
    let ctx = null;
    let master = null;
    let unlocked = false;
    let lastPlayed = Object.create(null);

    window.uiSoundsEnabled = (() => {
        try {
            const v = localStorage.getItem('rosmap_ui_sounds');
            if (v === '0') return false;
            if (v === '1') return true;
        } catch (_) {}
        return true;
    })();

    function ensureCtx() {
        if (ctx) return ctx;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = DEFAULT_VOLUME;
        master.connect(ctx.destination);
        return ctx;
    }

    async function unlock() {
        const c = ensureCtx();
        if (!c) return;
        if (c.state === 'suspended') {
            try { await c.resume(); } catch (_) {}
        }
        unlocked = c.state === 'running';
    }

    // Первый жест пользователя разблокирует AudioContext (политика браузеров).
    const unlockOnce = () => {
        unlock();
        document.removeEventListener('pointerdown', unlockOnce, true);
        document.removeEventListener('keydown', unlockOnce, true);
    };
    document.addEventListener('pointerdown', unlockOnce, true);
    document.addEventListener('keydown', unlockOnce, true);

    function tone({ freq = 440, dur = 0.12, type = 'sine', gain = 1, attack = 0.008, release = 0.08, delay = 0, detune = 0 }) {
        const c = ensureCtx();
        if (!c || !master) return;
        const t0 = c.currentTime + delay;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        if (detune) osc.detune.setValueAtTime(detune, t0);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(attack + 0.01, dur));
        osc.connect(g);
        g.connect(master);
        osc.start(t0);
        osc.stop(t0 + dur + release + 0.02);
    }

    function noiseBurst({ dur = 0.05, gain = 0.35, filterFreq = 1800 }) {
        const c = ensureCtx();
        if (!c || !master) return;
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
        g.gain.setValueAtTime(gain, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(filter);
        filter.connect(g);
        g.connect(master);
        src.start(t0);
        src.stop(t0 + dur + 0.02);
    }

    const PRESETS = {
        click: () => {
            tone({ freq: 620, dur: 0.05, type: 'triangle', gain: 0.35, attack: 0.002, release: 0.04 });
            tone({ freq: 920, dur: 0.04, type: 'sine', gain: 0.18, delay: 0.012 });
        },
        select: () => {
            tone({ freq: 480, dur: 0.07, type: 'sine', gain: 0.28 });
            tone({ freq: 720, dur: 0.09, type: 'triangle', gain: 0.2, delay: 0.04 });
        },
        open: () => {
            tone({ freq: 320, dur: 0.1, type: 'sine', gain: 0.22 });
            tone({ freq: 480, dur: 0.12, type: 'triangle', gain: 0.18, delay: 0.05 });
            tone({ freq: 640, dur: 0.1, type: 'sine', gain: 0.12, delay: 0.1 });
        },
        close: () => {
            tone({ freq: 520, dur: 0.08, type: 'sine', gain: 0.18 });
            tone({ freq: 340, dur: 0.1, type: 'triangle', gain: 0.14, delay: 0.04 });
        },
        toast: () => {
            tone({ freq: 700, dur: 0.06, type: 'sine', gain: 0.2 });
        },
        success: () => {
            tone({ freq: 523.25, dur: 0.08, type: 'sine', gain: 0.28 });
            tone({ freq: 659.25, dur: 0.1, type: 'sine', gain: 0.24, delay: 0.07 });
            tone({ freq: 783.99, dur: 0.14, type: 'triangle', gain: 0.2, delay: 0.14 });
        },
        error: () => {
            tone({ freq: 220, dur: 0.12, type: 'square', gain: 0.12 });
            tone({ freq: 180, dur: 0.16, type: 'triangle', gain: 0.18, delay: 0.06 });
        },
        notify: () => {
            tone({ freq: 880, dur: 0.08, type: 'sine', gain: 0.26 });
            tone({ freq: 1174.66, dur: 0.14, type: 'sine', gain: 0.22, delay: 0.09 });
        },
        send: () => {
            tone({ freq: 660, dur: 0.06, type: 'triangle', gain: 0.22 });
            tone({ freq: 990, dur: 0.1, type: 'sine', gain: 0.16, delay: 0.05 });
            noiseBurst({ dur: 0.03, gain: 0.08, filterFreq: 2400 });
        },
        play: () => {
            tone({ freq: 440, dur: 0.07, type: 'sine', gain: 0.22 });
            tone({ freq: 660, dur: 0.08, type: 'triangle', gain: 0.16, delay: 0.04 });
        },
        pause: () => {
            tone({ freq: 360, dur: 0.08, type: 'sine', gain: 0.18 });
        },
        whoosh: () => {
            noiseBurst({ dur: 0.09, gain: 0.16, filterFreq: 900 });
            tone({ freq: 240, dur: 0.1, type: 'sine', gain: 0.1, delay: 0.01 });
        }
    };

    window.setUiSoundsEnabled = function(enabled, skipSave = false) {
        window.uiSoundsEnabled = !!enabled;
        try { localStorage.setItem('rosmap_ui_sounds', enabled ? '1' : '0'); } catch (_) {}
        if (!skipSave && window.saveUserSettings) window.saveUserSettings('uiSounds', !!enabled);
        if (window.refreshSettingsUI) window.refreshSettingsUI();
        if (enabled) window.playSfx('click');
    };

    window.playSfx = function(name, { force = false, throttleMs = 90 } = {}) {
        if (!force && !window.uiSoundsEnabled) return;
        if (!PRESETS[name]) return;
        const now = Date.now();
        if (!force && lastPlayed[name] && (now - lastPlayed[name]) < throttleMs) return;
        lastPlayed[name] = now;
        unlock().then(() => {
            if (!unlocked && ctx && ctx.state !== 'running') return;
            try { PRESETS[name](); } catch (_) {}
        });
    };

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
