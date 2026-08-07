// Управление громкостью
window.changeVolume = function(val) {
    const num = parseFloat(val);
    if(window.audioElement) window.audioElement.volume = num;
    if(window.gainNode) window.gainNode.gain.value = num; 
            
    const icon = document.getElementById('volume-icon');
    if(icon) {
        icon.className = 'pointer-events-none text-sm w-4 text-center ' + 
            (num === 0 ? 'icon-volume-slash text-red-500' : (num < 0.5 ? 'icon-volume-low' : 'icon-volume-high'));
    }
    const slider = document.getElementById('volume-slider');
    if (slider) {
        const pct = Math.round(Math.max(0, Math.min(1, num)) * 100);
        slider.setAttribute('aria-valuenow', String(pct));
        slider.setAttribute('aria-valuetext', `${pct} процентов`);
    }
    if(num > 0) window.lastVolume = num;
};

window.toggleMute = function() {
    const slider = document.getElementById('volume-slider');
    if(!slider) return;
    if(parseFloat(slider.value) > 0) {
        slider.value = 0;
        window.changeVolume(0);
    } else {
        slider.value = window.lastVolume || 1;
        window.changeVolume(window.lastVolume || 1);
    }
};

window.formatTime = function(s) { 
    if(isNaN(s) || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60), sec = Math.floor(s % 60); 
    return `${m}:${sec < 10 ? '0' : ''}${sec}`; 
}

// --- Shared Web Audio graph ---
window.ensureAudioGraph = async function() {
    try {
        if (!window.audioContext) {
            window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (window.audioContext.state === 'suspended') {
            await window.audioContext.resume();
        }
        if (window.unlockUiSfx) window.unlockUiSfx();

        if (window.audioElement) {
            window.audioElement.crossOrigin = 'anonymous';
            if (!window.audioElementSource) {
                window.audioElementSource = window.audioContext.createMediaElementSource(window.audioElement);
            }
        }

        if (!window.gainNode) {
            window.gainNode = window.audioContext.createGain();
            const slider = document.getElementById('volume-slider');
            window.gainNode.gain.value = slider ? parseFloat(slider.value) : 1;
        }

        if (!window.stereoPannerNode) {
            window.stereoPannerNode = window.audioContext.createStereoPanner();
            window.stereoPannerNode.pan.value = window.currentStereoPan || 0;
        }

        if (!window.analyserNode) {
            window.analyserNode = window.audioContext.createAnalyser();
            window.analyserNode.fftSize = 2048;
            window.analyserNode.smoothingTimeConstant = 0.65;
            window.analyserNode.minDecibels = -90;
            window.analyserNode.maxDecibels = -10;
        }

        window.setupChannelAnalysers(window.getCurrentChannelLayout().count);

        if (!window.isAmbisonicMode && !window._normalAudioRouted) {
            window.routeNormalAudio();
        } else if (window.isAmbisonicMode && window.foaDecoder && !window._ambiAudioRouted) {
            window.routeAmbisonics();
        }

        return true;
    } catch (err) {
        console.error('Web Audio graph error:', err);
        return false;
    }
};

window.disconnectAudioGraph = function() {
    const nodes = [
        window.audioElementSource,
        window.stereoPannerNode,
        window.gainNode,
        window.analyserNode,
        window.channelSplitter,
        window.foaDecoder && window.foaDecoder.input,
        window.foaDecoder && window.foaDecoder.output
    ];
    if (Array.isArray(window.channelAnalysers)) {
        nodes.push(...window.channelAnalysers);
    }
    nodes.forEach(node => {
        if (!node) return;
        try { node.disconnect(); } catch (e) {}
    });
};

window.connectAnalyzerTaps = function(mixNode) {
    if (mixNode && window.analyserNode) {
        try { mixNode.connect(window.analyserNode); } catch (e) {}
    }
    if (window.audioElementSource && window.channelSplitter && Array.isArray(window.channelAnalysers)) {
        try { window.audioElementSource.connect(window.channelSplitter); } catch (e) {}
        window.channelAnalysers.forEach((analyser, i) => {
            try { window.channelSplitter.connect(analyser, i); } catch (e) {}
        });
    }
};

window.getCurrentChannelLayout = function() {
    const sound = window.soundsData && window.currentPlayingId
        ? window.soundsData.find(x => x.id === window.currentPlayingId)
        : null;
    return window.getChannelLayout(sound);
};

window.getChannelLayout = function(sound) {
    const raw = (sound && sound.channels ? String(sound.channels) : 'Stereo').toLowerCase();
    let layout;

    if (raw.includes('ambison')) {
        layout = { count: 4, labels: ['W', 'X', 'Y', 'Z'], kind: 'ambisonics' };
    } else if (raw.includes('mono')) {
        layout = { count: 1, labels: ['M'], kind: 'mono' };
    } else if (raw.includes('binaural')) {
        layout = { count: 2, labels: ['L', 'R'], kind: 'binaural' };
    } else {
        layout = { count: 2, labels: ['L', 'R'], kind: 'stereo' };
    }

    // Prefer real MediaElementSource channel count when browser exposes it
    const srcCount = window.audioElementSource && window.audioElementSource.channelCount
        ? window.audioElementSource.channelCount
        : 0;
    if (srcCount > layout.count && srcCount <= 8) {
        const labels = [];
        for (let i = 0; i < srcCount; i++) {
            labels.push(layout.labels[i] || `Ch${i + 1}`);
        }
        layout = { ...layout, count: srcCount, labels };
    }

    return layout;
};

window.setupChannelAnalysers = function(channelCount) {
    if (!window.audioContext) return false;
    const n = Math.max(1, Math.min(8, channelCount || 2));

    if (window.channelAnalysers && window.channelAnalysers.length === n && window.channelSplitter) {
        window.meterChannelCount = n;
        return false;
    }

    if (window.channelSplitter) {
        try { window.channelSplitter.disconnect(); } catch (e) {}
    }
    if (Array.isArray(window.channelAnalysers)) {
        window.channelAnalysers.forEach(a => { try { a.disconnect(); } catch (e) {} });
    }

    window.channelSplitter = window.audioContext.createChannelSplitter(n);
    window.channelAnalysers = [];
    for (let i = 0; i < n; i++) {
        const analyser = window.audioContext.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.5;
        window.channelAnalysers.push(analyser);
    }
    window.meterChannelCount = n;
    window.loudnessPeaks = new Array(n).fill(0);
    return true;
};

window.routeNormalAudio = function() {
    if (!window.audioElementSource || !window.gainNode || !window.stereoPannerNode || !window.audioContext) return;
    window.disconnectAudioGraph();
    window.audioElementSource.connect(window.stereoPannerNode);
    window.stereoPannerNode.connect(window.gainNode);
    window.gainNode.connect(window.audioContext.destination);
    window.connectAnalyzerTaps(window.stereoPannerNode);
    window._normalAudioRouted = true;
    window._ambiAudioRouted = false;
};

// --- Ambisonics ---
/** Stereo virtual-mic decode of FOA (Ambix/SN3D). Always available — no HRIR fetch. */
window.buildMatrixFoaDecoder = function() {
    const ctx = window.audioContext;
    if (!ctx) return null;

    const input = ctx.createGain();
    input.channelCount = 4;
    input.channelCountMode = 'explicit';
    input.channelInterpretation = 'discrete';

    const splitter = ctx.createChannelSplitter(4);
    input.connect(splitter);

    const pair = (ch) => {
        const gL = ctx.createGain();
        const gR = ctx.createGain();
        try { splitter.connect(gL, ch); } catch (_) {}
        try { splitter.connect(gR, ch); } catch (_) {}
        return { gL, gR };
    };
    const W = pair(0);
    const X = pair(1);
    const Y = pair(2);
    const Z = pair(3);

    const merger = ctx.createChannelMerger(2);
    [W, X, Y, Z].forEach(({ gL, gR }) => {
        try { gL.connect(merger, 0, 0); } catch (_) {}
        try { gR.connect(merger, 0, 1); } catch (_) {}
    });

    const output = ctx.createGain();
    merger.connect(output);

    const SQRT_HALF = Math.SQRT1_2;
    const apply = (yawDeg = 0, pitchDeg = 0) => {
        const yaw = (Number(yawDeg) || 0) * Math.PI / 180;
        const pitch = (Number(pitchDeg) || 0) * Math.PI / 180;
        const cy = Math.cos(yaw);
        const sy = Math.sin(yaw);
        const cp = Math.cos(pitch);
        const sp = Math.sin(pitch);
        // Same basis as Omnitone setRotationMatrix3 used elsewhere in this file.
        const m00 = cy * cp, m01 = -sy, m02 = cy * sp;
        const m10 = sy * cp, m11 = cy, m12 = sy * sp;
        // Stereo cardioids from rotated X'/Y' (+ light Z for pitch).
        W.gL.gain.value = SQRT_HALF;
        W.gR.gain.value = SQRT_HALF;
        X.gL.gain.value = 0.5 * m00 + 0.5 * m10;
        X.gR.gain.value = 0.5 * m00 - 0.5 * m10;
        Y.gL.gain.value = 0.5 * m01 + 0.5 * m11;
        Y.gR.gain.value = 0.5 * m01 - 0.5 * m11;
        Z.gL.gain.value = 0.35 * m02 + 0.35 * m12;
        Z.gR.gain.value = 0.35 * m02 - 0.35 * m12;
    };
    apply(0, 0);

    return {
        input,
        output,
        _matrix: true,
        _yaw: 0,
        _pitch: 0,
        setRenderingMode() {},
        setRotationMatrix3() {},
        setRotationMatrix() {},
        setRotation(yaw, pitch) {
            this._yaw = yaw;
            this._pitch = pitch;
            apply(yaw, pitch);
        }
    };
};

window.ensureOmnitoneLibrary = function() {
    if (window.Omnitone && typeof window.Omnitone.createFOARenderer === 'function') {
        return Promise.resolve(window.Omnitone);
    }
    if (window.__omnitoneLoadPromise) return window.__omnitoneLoadPromise;

    window.__omnitoneLoadPromise = new Promise((resolve) => {
        const tryUrls = [
            './vendor/omnitone.min.js',
            'https://cdn.jsdelivr.net/npm/omnitone@1.3.0/build/omnitone.min.js',
            'https://unpkg.com/omnitone@1.3.0/build/omnitone.min.js'
        ];
        let i = 0;
        const finish = () => {
            if (window.Omnitone && typeof window.Omnitone.createFOARenderer === 'function') {
                resolve(window.Omnitone);
            } else {
                resolve(null);
            }
        };
        const next = () => {
            if (window.Omnitone && typeof window.Omnitone.createFOARenderer === 'function') {
                finish();
                return;
            }
            if (i >= tryUrls.length) {
                finish();
                return;
            }
            const url = tryUrls[i++];
            const existing = document.querySelector(`script[data-omnitone-src="${url}"]`);
            if (existing) {
                existing.addEventListener('load', () => next());
                existing.addEventListener('error', () => next());
                // Already finished loading earlier
                setTimeout(() => next(), 0);
                return;
            }
            const s = document.createElement('script');
            s.src = url;
            s.async = true;
            s.dataset.omnitoneSrc = url;
            s.onload = () => next();
            s.onerror = () => next();
            document.head.appendChild(s);
        };
        next();
    }).finally(() => {
        if (!(window.Omnitone && window.Omnitone.createFOARenderer)) {
            window.__omnitoneLoadPromise = null;
        }
    });
    return window.__omnitoneLoadPromise;
};

window.initOmnitone = async function() {
    if (window.omnitoneInitialized && window.foaDecoder) return true;
    try {
        const ok = await window.ensureAudioGraph();
        if (!ok || !window.audioContext) return false;
        if (window.audioContext.state === 'suspended') {
            try { await window.audioContext.resume(); } catch (_) {}
        }

        // Prefer Omnitone HRTF when available; otherwise matrix FOA→stereo.
        let usedOmnitone = false;
        try {
            const Omni = await window.ensureOmnitoneLibrary();
            if (Omni && typeof Omni.createFOARenderer === 'function') {
                const renderer = Omni.createFOARenderer(window.audioContext, {});
                await Promise.race([
                    renderer.initialize(),
                    new Promise((_, rej) => setTimeout(() => rej(new Error('Omnitone init timeout')), 8000))
                ]);
                window.foaDecoder = renderer;
                usedOmnitone = true;
            }
        } catch (omniErr) {
            console.warn('Omnitone HRTF unavailable, using matrix FOA decode', omniErr);
            window.__lastOmnitoneError = omniErr && (omniErr.message || String(omniErr));
        }

        if (!usedOmnitone) {
            window.foaDecoder = window.buildMatrixFoaDecoder();
            if (!window.foaDecoder) return false;
        }

        window.omnitoneInitialized = true;
        window.__foaDecoderKind = usedOmnitone ? 'omnitone' : 'matrix';
        return true;
    } catch (err) {
        console.error('FOA decoder init error:', err);
        // Last resort: matrix path
        try {
            window.foaDecoder = window.buildMatrixFoaDecoder();
            if (window.foaDecoder) {
                window.omnitoneInitialized = true;
                window.__foaDecoderKind = 'matrix';
                return true;
            }
        } catch (_) {}
        window.omnitoneInitialized = false;
        window.foaDecoder = null;
        window.__lastOmnitoneError = err && (err.message || String(err));
        return false;
    }
};

window.routeAmbisonics = function() {
    if (!window.audioContext || !window.foaDecoder) return;
    window.disconnectAudioGraph();
    if (window.gainNode) {
        window.foaDecoder.output.connect(window.gainNode);
        window.gainNode.connect(window.audioContext.destination);
    } else {
        window.foaDecoder.output.connect(window.audioContext.destination);
    }
    window.connectAnalyzerTaps(window.foaDecoder.output);
    if (typeof window.foaDecoder.setRenderingMode === 'function') {
        try { window.foaDecoder.setRenderingMode('ambisonic'); } catch (_) {}
    }
    window._ambiAudioRouted = true;
    window._normalAudioRouted = false;
};

window.stopFoaBufferSource = function() {
    if (!window.__foaSourceNode) return;
    try { window.__foaSourceNode.onended = null; } catch (_) {}
    try { window.__foaSourceNode.stop(); } catch (_) {}
    try { window.__foaSourceNode.disconnect(); } catch (_) {}
    window.__foaSourceNode = null;
};

window.ensureFoaAudioBuffer = async function(url) {
    if (!url) return null;
    if (window.__foaBufferUrl === url && window.__foaAudioBuffer) return window.__foaAudioBuffer;
    const res = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'force-cache' });
    if (!res.ok) throw new Error(`foa fetch ${res.status}`);
    const ab = await res.arrayBuffer();
    const buffer = await window.__decodeAudioArrayBuffer(ab);
    window.__foaAudioBuffer = buffer;
    window.__foaBufferUrl = url;
    return buffer;
};

window.startFoaBufferPlayback = function(offsetSec) {
    if (!window.isAmbisonicMode || !window.foaDecoder || !window.__foaAudioBuffer || !window.audioContext) return;
    window.stopFoaBufferSource();
    let buffer = window.__foaAudioBuffer;
    // Pad mono/stereo up to 4 channels so splitter/FOA input always gets WXYZ.
    if (buffer.numberOfChannels < 4) {
        const ctx = window.audioContext;
        const out = ctx.createBuffer(4, buffer.length, buffer.sampleRate);
        for (let c = 0; c < 4; c++) {
            const src = buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1));
            out.copyToChannel(src, c);
        }
        // Silence X/Y/Z if we only had W (mono) / keep L/R mapped for stereo→W/X-ish
        if (buffer.numberOfChannels === 1) {
            out.getChannelData(1).fill(0);
            out.getChannelData(2).fill(0);
            out.getChannelData(3).fill(0);
        } else if (buffer.numberOfChannels === 2) {
            // Treat as W + Y mid/side-ish: keep ch0 as W, ch1 as Y, zero X/Z
            out.copyToChannel(buffer.getChannelData(0), 0);
            out.getChannelData(1).fill(0);
            out.copyToChannel(buffer.getChannelData(1), 2);
            out.getChannelData(3).fill(0);
        }
        buffer = out;
    }
    const src = window.audioContext.createBufferSource();
    src.buffer = buffer;
    src.channelCount = 4;
    src.channelCountMode = 'explicit';
    src.channelInterpretation = 'discrete';
    src.connect(window.foaDecoder.input);
    const rate = window.audioElement ? (window.audioElement.playbackRate || 1) : 1;
    try { src.playbackRate.value = rate; } catch (_) {}
    const offset = Math.max(0, Math.min(offsetSec || 0, Math.max(0, src.buffer.duration - 0.05)));
    src.onended = () => {
        if (window.__foaSourceNode !== src) return;
        window.__foaSourceNode = null;
        if (window.isAmbisonicMode && window.isPlaying) {
            window.isPlaying = false;
            if (window.audioElement) try { window.audioElement.pause(); } catch (_) {}
            if (window.updateUIState) window.updateUIState();
        }
    };
    try {
        src.start(0, offset);
        window.__foaSourceNode = src;
    } catch (err) {
        console.error('FOA start error:', err);
        window.__foaSourceNode = null;
    }
};

window.syncFoaBufferPlayback = function() {
    if (!window.isAmbisonicMode) return;
    const t = window.audioElement ? (window.audioElement.currentTime || 0) : 0;
    if (window.isPlaying) window.startFoaBufferPlayback(t);
    else window.stopFoaBufferSource();
};

window.updateAmbisonicRotation = function(yawAngle, pitchAngle) {
    if (!window.foaDecoder || !window.isAmbisonicMode) return;
    if (window.foaDecoder._matrix && typeof window.foaDecoder.setRotation === 'function') {
        window.foaDecoder.setRotation(yawAngle, pitchAngle);
        return;
    }
    const yaw = yawAngle * Math.PI / 180;
    const pitch = pitchAngle * Math.PI / 180;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const rotationMatrix = new Float32Array([
        cy*cp, -sy, cy*sp,
        sy*cp,  cy, sy*sp,
        -sp,    0,  cp
    ]);
    if (typeof window.foaDecoder.setRotationMatrix3 === 'function') {
        window.foaDecoder.setRotationMatrix3(rotationMatrix);
    } else if (typeof window.foaDecoder.setRotationMatrix === 'function') {
        window.foaDecoder.setRotationMatrix(rotationMatrix);
    } else if (window.foaDecoder.foaRotator && typeof window.foaDecoder.foaRotator.setRotationMatrix3 === 'function') {
        window.foaDecoder.foaRotator.setRotationMatrix3(rotationMatrix);
    }
};

window.setupAmbisonicSphere = function() {
    const pad = document.getElementById('ambi-sphere-pad');
    const dot = document.getElementById('ambi-dot');
    if (!pad || !dot) return;

    const updateFromEvent = (e) => {
        const rect = pad.getBoundingClientRect();
        let clientX = e.clientX, clientY = e.clientY;
        if(e.touches && e.touches.length > 0) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
        
        let x = clientX - rect.left, y = clientY - rect.top;
        const cx = rect.width / 2, cy = rect.height / 2, r = rect.width / 2;
        let dx = x - cx, dy = y - cy;
        const dist = Math.sqrt(dx*dx + dy*dy);
                
        if (dist > r) { dx = (dx / dist) * r; dy = (dy / dist) * r; }
        x = cx + dx; y = cy + dy;

        dot.style.left = `${x}px`; dot.style.top = `${y}px`;

        const yaw = (dx / r) * 180, pitch = (-dy / r) * 90;
        const angleDisplay = document.getElementById('ambi-angle-val');
        if(angleDisplay) angleDisplay.textContent = `Y: ${Math.round(yaw)}° | P: ${Math.round(pitch)}°`;
        window.updateAmbisonicRotation(yaw, pitch);
    };

    pad.addEventListener('mousedown', (e) => { window.isDraggingCompass = true; updateFromEvent(e); });
    window.addEventListener('mousemove', (e) => { if(window.isDraggingCompass) updateFromEvent(e); });
    window.addEventListener('mouseup', () => { window.isDraggingCompass = false; });
    pad.addEventListener('mouseleave', () => { window.isDraggingCompass = false; });
    pad.addEventListener('touchstart', (e) => { window.isDraggingCompass = true; updateFromEvent(e.touches[0]); }, {passive: false});
    window.addEventListener('touchmove', (e) => { if(window.isDraggingCompass) { e.preventDefault(); updateFromEvent(e.touches[0]); } }, {passive: false});
    window.addEventListener('touchend', () => { window.isDraggingCompass = false; });
}

window.enableAmbisonicMode = async function() {
    const okGraph = await window.ensureAudioGraph();
    if (!okGraph) {
        window.showToast('Амбисоник недоступен в этом браузере');
        return false;
    }
    if (!window.omnitoneInitialized) {
        const success = await window.initOmnitone();
        if (!success) {
            window.showToast('Не удалось включить амбисоник');
            return false;
        }
    } else if (window.audioContext && window.audioContext.state === 'suspended') {
        await window.audioContext.resume();
    }

    const s = (window.soundsData || []).find((x) => x.id === window.currentPlayingId);
    const url = s && (s.url || s.audioUrl);
    if (!url) {
        window.showToast('Нет аудио для амбисоника');
        return false;
    }
    try {
        await window.ensureFoaAudioBuffer(url);
    } catch (err) {
        console.error(err);
        window.showToast('Не удалось загрузить FOA-буфер');
        return false;
    }

    window.routeAmbisonics();
    window.syncFoaBufferPlayback();
    const panSlider = document.getElementById('stereo-panner-slider');
    if (panSlider) panSlider.disabled = true;
    return true;
}

window.disableAmbisonicMode = function() {
    window.stopFoaBufferSource();
    if (!window.audioContext || !window.audioElementSource) {
        window.isAmbisonicMode = false;
        window._ambiAudioRouted = false;
        return;
    }
    window.routeNormalAudio();
    const panSlider = document.getElementById('stereo-panner-slider');
    if (panSlider) panSlider.disabled = false;
}

window.toggleAmbisonics = async function() {
    const control = document.getElementById('ambisonics-control');
    const btn = document.getElementById('btn-ambi-toggle');
    if (!control || !btn) return;

    if (!window.isAmbisonicMode) {
        window.isAmbisonicMode = true;
        const ok = await window.enableAmbisonicMode();
        if (!ok) {
            window.isAmbisonicMode = false;
            control.classList.add('hidden');
            btn.classList.add('text-[color:var(--accent-ink)]');
            btn.classList.remove('text-[color:var(--accent)]');
            return;
        }
        control.classList.remove('hidden');
        btn.classList.remove('text-[color:var(--accent-ink)]');
        btn.classList.add('text-[color:var(--accent)]');
        window.showToast(translations[window.currentLang].ambisonics_pan + " ON");
        window.resizeAmbiGoniometerCanvas();
        window.syncAnalyzerAnimation();
    } else {
        window.isAmbisonicMode = false;
        window.disableAmbisonicMode();
        control.classList.add('hidden');
        btn.classList.add('text-[color:var(--accent-ink)]');
        btn.classList.remove('text-[color:var(--accent)]');
        const dot = document.getElementById('ambi-dot');
        if (dot) { dot.style.left = '50%'; dot.style.top = '50%'; }
        const angleDisplay = document.getElementById('ambi-angle-val');
        if (angleDisplay) angleDisplay.textContent = `Y: 0° | P: 0°`;
        window.updateAmbisonicRotation(0, 0);
        window.clearAmbiGoniometerCanvas();
        window.syncAnalyzerAnimation();
    }
    if (window.refreshAnalyzerMetersIfOpen) window.refreshAnalyzerMetersIfOpen();
}

// --- Analyzers panel ---
window.setStereoPan = function(val) {
    const pan = Math.max(-1, Math.min(1, parseFloat(val) || 0));
    window.currentStereoPan = pan;
    if (window.stereoPannerNode) window.stereoPannerNode.pan.value = pan;

    const label = document.getElementById('panner-value');
    if (!label) return;
    if (Math.abs(pan) < 0.02) label.textContent = 'C';
    else if (pan < 0) label.textContent = `L ${Math.round(Math.abs(pan) * 100)}%`;
    else label.textContent = `R ${Math.round(pan * 100)}%`;
};

window.resetStereoPan = function() {
    const slider = document.getElementById('stereo-panner-slider');
    if (slider) {
        slider.value = 0;
        slider.disabled = !!window.isAmbisonicMode;
    }
    window.setStereoPan(0);
};

window.currentPlaybackPitch = 0;

window.setPlaybackPitch = function(semitones) {
    const st = Math.max(-12, Math.min(12, Math.round(Number(semitones) || 0)));
    window.currentPlaybackPitch = st;
    const rate = Math.pow(2, st / 12);
    if (window.audioElement) {
        try { window.audioElement.preservesPitch = false; } catch (_) {}
        try { window.audioElement.mozPreservesPitch = false; } catch (_) {}
        try { window.audioElement.webkitPreservesPitch = false; } catch (_) {}
        window.audioElement.playbackRate = rate;
    }
    if (window.__foaSourceNode && window.__foaSourceNode.playbackRate) {
        try { window.__foaSourceNode.playbackRate.value = rate; } catch (_) {}
    }
    const label = document.getElementById('pitch-value');
    if (label) label.textContent = st === 0 ? '0 st' : `${st > 0 ? '+' : ''}${st} st`;
    const slider = document.getElementById('pitch-slider');
    if (slider && Number(slider.value) !== st) slider.value = String(st);
};

window.resetPlaybackPitch = function() {
    const slider = document.getElementById('pitch-slider');
    if (slider) slider.value = '0';
    window.setPlaybackPitch(0);
};

window.downloadPitchedSound = async function() {
    const s = (window.soundsData || []).find((x) => x.id === window.currentPlayingId);
    if (!s || !s.url || String(s.url).startsWith('blob:')) {
        window.showToast('Файл недоступен для скачивания.');
        return;
    }
    const st = window.currentPlaybackPitch || 0;
    const ratio = Math.pow(2, st / 12);
    const baseName = (s.fileName || 'recording.wav').replace(/\.wav$/i, '');
    const outName = st === 0 ? `${baseName}.wav` : `${baseName}_pitch${st > 0 ? '+' : ''}${st}.wav`;

    try {
        window.showToast(st === 0 ? 'Скачивание…' : 'Рендер питча…');
        const res = await fetch(s.url);
        if (!res.ok) throw new Error('fetch_failed');
        const blob = await res.blob();

        if (st === 0 && /\.wav$/i.test(s.fileName || s.url)) {
            const a = document.createElement('a');
            const objUrl = URL.createObjectURL(blob);
            a.href = objUrl;
            a.download = outName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(objUrl), 2000);
            if (window.incrementDownloadCount) window.incrementDownloadCount(s.id);
            return;
        }

        if (!window.decodeAudioFile || !window.audioBufferToWav) {
            throw new Error('convert_unavailable');
        }
        const file = new File([blob], s.fileName || 'audio.wav', { type: blob.type || 'audio/wav' });
        let buffer = await window.decodeAudioFile(file);
        if (st !== 0 && window.pitchShiftAudioBuffer) {
            buffer = window.pitchShiftAudioBuffer(buffer, ratio);
        }
        const wavBuf = window.audioBufferToWav(buffer, { bitDepth: 24 });
        const outBlob = new Blob([wavBuf], { type: 'audio/wav' });
        const a = document.createElement('a');
        const objUrl = URL.createObjectURL(outBlob);
        a.href = objUrl;
        a.download = outName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(objUrl), 2000);
        if (window.incrementDownloadCount) window.incrementDownloadCount(s.id);
        window.showToast('Готово');
    } catch (err) {
        console.warn(err);
        window.showToast('Не удалось подготовить файл');
    }
};

window.dbFromRms = function(rms) {
    if (!rms || rms < 1e-5) return -Infinity;
    return 20 * Math.log10(rms);
};

// Single-pass RMS + true peak measurement per channel analyser
window.measureChannel = function(analyser) {
    if (!analyser) return { rms: 0, peak: 0 };
    const n = analyser.fftSize;

    if (!window._measureBufs) window._measureBufs = new Map();
    let arr = window._measureBufs.get(analyser);
    if (!arr || arr.length !== n) { arr = new Float32Array(n); window._measureBufs.set(analyser, arr); }

    if (typeof analyser.getFloatTimeDomainData === 'function') {
        analyser.getFloatTimeDomainData(arr);
    } else {
        if (!window._measureByteBufs) window._measureByteBufs = new Map();
        let bytes = window._measureByteBufs.get(analyser);
        if (!bytes || bytes.length !== n) { bytes = new Uint8Array(n); window._measureByteBufs.set(analyser, bytes); }
        analyser.getByteTimeDomainData(bytes);
        for (let i = 0; i < n; i++) arr[i] = (bytes[i] - 128) / 128;
    }

    let sumSq = 0, peak = 0;
    for (let i = 0; i < n; i++) {
        const v = arr[i];
        sumSq += v * v;
        const av = Math.abs(v);
        if (av > peak) peak = av;
    }
    return { rms: Math.sqrt(sumSq / n), peak };
};

window.dbToMeterPercent = function(db) {
    if (!isFinite(db)) return 0;
    return Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
};

window.formatHzLabel = function(hz) {
    if (hz >= 1000) {
        const k = hz / 1000;
        return (k >= 10 ? Math.round(k) : Math.round(k * 10) / 10) + 'k';
    }
    return String(Math.round(hz));
};

// iZotope RX-style heatmap: dark floor for dark theme, light floor for light theme
window.izotopeColorStopsDark = [
    { t: 0.00, c: [10, 10, 30] },
    { t: 0.14, c: [30, 12, 55] },
    { t: 0.34, c: [138, 43, 226] },
    { t: 0.56, c: [255, 69, 0] },
    { t: 0.74, c: [255, 165, 0] },
    { t: 0.90, c: [255, 255, 0] },
    { t: 1.00, c: [255, 255, 255] }
];
window.izotopeColorStopsLight = [
    { t: 0.00, c: [248, 250, 252] },
    { t: 0.14, c: [226, 232, 240] },
    { t: 0.34, c: [167, 139, 250] },
    { t: 0.56, c: [249, 115, 22] },
    { t: 0.74, c: [234, 179, 8] },
    { t: 0.90, c: [220, 38, 38] },
    { t: 1.00, c: [127, 29, 29] }
];
window.izotopeColorStops = window.izotopeColorStopsDark;

window.isAnalyzerLightTheme = function() {
    if (window.currentTheme === 'dark') return false;
    if (window.currentTheme === 'light') return true;
    return !document.documentElement.classList.contains('dark');
};

window.getAnalyzerPalette = function() {
    const root = document.documentElement;
    const css = getComputedStyle(root);
    const read = (name, fallback) => {
        const v = css.getPropertyValue(name).trim();
        return v || fallback;
    };
    // CSS-переменные — единый источник правды со style.css (и для class=dark, и для html.dark)
    return {
        screenBg: read('--analyzer-screen-bg', window.isAnalyzerLightTheme() ? '#f8fafc' : '#0f172a'),
        fade: read('--analyzer-fade', window.isAnalyzerLightTheme() ? 'rgba(248, 250, 252, 0.42)' : 'rgba(15, 23, 42, 0.22)'),
        fadeAmbi: read('--analyzer-fade-ambi', window.isAnalyzerLightTheme() ? 'rgba(255, 255, 255, 0.22)' : 'rgba(15, 23, 42, 0.14)'),
        grid: read('--analyzer-grid', 'rgba(100, 116, 139, 0.4)'),
        gridSoft: read('--analyzer-grid-soft', 'rgba(100, 116, 139, 0.22)'),
        label: read('--analyzer-label', 'rgba(51, 65, 85, 0.92)'),
        stroke: read('--analyzer-stroke', '#FBAB57'),
        strokeGlow: read('--analyzer-stroke-glow', 'transparent'),
        ambiStroke: read('--analyzer-ambi-stroke', '#222222'),
        ambiGlow: read('--analyzer-ambi-glow', 'transparent')
    };
};

window.izotopeColor = function(value) {
    const rgb = window.izotopeColorRgb(value);
    return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
};

window.izotopeColorRgb = function(value) {
    const v = Math.max(0, Math.min(1, value));
    const stops = window.isAnalyzerLightTheme()
        ? window.izotopeColorStopsLight
        : window.izotopeColorStopsDark;
    for (let i = 0; i < stops.length - 1; i++) {
        const a = stops[i], b = stops[i + 1];
        if (v >= a.t && v <= b.t) {
            const localT = (v - a.t) / (b.t - a.t || 1);
            return [
                Math.round(a.c[0] + (b.c[0] - a.c[0]) * localT),
                Math.round(a.c[1] + (b.c[1] - a.c[1]) * localT),
                Math.round(a.c[2] + (b.c[2] - a.c[2]) * localT)
            ];
        }
    }
    const last = stops[stops.length - 1].c;
    return [last[0], last[1], last[2]];
};

window.refreshAnalyzersTheme = function() {
    const pal = window.getAnalyzerPalette();
    const gonio = document.getElementById('goniometer-canvas');
    if (gonio) {
        const ctx = gonio.getContext('2d');
        if (ctx) {
            ctx.fillStyle = pal.screenBg;
            ctx.fillRect(0, 0, gonio.width || 260, gonio.height || 130);
        }
    }
    if (window.clearAmbiGoniometerCanvas) window.clearAmbiGoniometerCanvas();
    if (window.resizeAnalyzerCanvases) window.resizeAnalyzerCanvases();
};

// Picks a channel pair for the Lissajous/vectorscope plot depending on layout
window.getGoniometerPair = function() {
    const analysers = window.channelAnalysers;
    if (!analysers || !analysers.length) return null;
    if (analysers.length === 1) return [analysers[0], analysers[0]];
    if (analysers.length >= 4) return [analysers[1], analysers[2]]; // Ambisonics X/Y
    return [analysers[0], analysers[1]];
};

window.getGoniometerLabel = function(layout) {
    if (!layout) return 'L / R';
    if (layout.kind === 'mono') return 'M (mono)';
    if (layout.kind === 'ambisonics') return 'X / Y (Ambisonics)';
    return 'L / R';
};

window.resizeAnalyzerCanvas = function(canvas, minCssHeight) {
    if (!canvas) return;
    const wrap = canvas.parentElement;
    const cssW = wrap ? wrap.clientWidth : 300;
    const cssH = wrap ? wrap.clientHeight : minCssHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(160, Math.floor(cssW * dpr));
    canvas.height = Math.max(Math.floor(minCssHeight * dpr), Math.floor(cssH * dpr));
};

window.primeSpectrogramCanvas = function() {
    const canvas = document.getElementById('spectrum-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pal = window.getAnalyzerPalette();
    // Светлая/тёмная «тишина» — из CSS-переменных темы, не из тёмной iZotope-палитры
    ctx.fillStyle = pal.screenBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
};

window.renderSpectrogramAxis = function() {
    const axis = document.getElementById('spectrum-freq-axis');
    if (!axis || axis.childElementCount) return;
    const ticks = ['20k', '5k', '1k', '200', '20'];
    axis.innerHTML = ticks.map(t => `<span>${t}</span>`).join('');
};

window.resizeAnalyzerCanvases = function() {
    window.resizeAnalyzerCanvas(document.getElementById('goniometer-canvas'), 130);
    window.resizeAnalyzerCanvas(document.getElementById('spectrum-canvas'), 130);
    window.primeSpectrogramCanvas();
    window.renderSpectrogramAxis();
};

// --- Mini goniometer overlaid inside the Ambisonic sphere pad ---
// Gives an at-a-glance hint of where the sound energy currently leans,
// so the user knows which way to drag the point.
window.resizeAmbiGoniometerCanvas = function() {
    const canvas = document.getElementById('ambi-goniometer-canvas');
    if (!canvas) return;
    const wrap = canvas.parentElement;
    // The pad is a perfect circle (width === height); keep the canvas backing store square too
    const size = wrap ? Math.max(wrap.clientWidth, wrap.clientHeight, 100) : 120;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(size * dpr);
    canvas.height = Math.floor(size * dpr);
};

window.clearAmbiGoniometerCanvas = function() {
    const canvas = document.getElementById('ambi-goniometer-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
};

window.drawAmbiGoniometerFrame = function() {
    const canvas = document.getElementById('ambi-goniometer-canvas');
    const analysers = window.channelAnalysers;
    if (!canvas || !analysers || analysers.length < 3) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2;
    const scale = Math.min(w, h) / 2 * 0.9;

    // Soft phosphor fade — цвет зависит от темы
    const pal = window.getAnalyzerPalette();
    ctx.fillStyle = pal.fadeAmbi;
    ctx.fillRect(0, 0, w, h);

    const analyserX = analysers[1]; // Ambisonic X: front(+) / back(-)
    const analyserY = analysers[2]; // Ambisonic Y: left(+) / right(-)
    const n = analyserX.fftSize;

    if (!window._ambiGonioX || window._ambiGonioX.length !== n) window._ambiGonioX = new Float32Array(n);
    if (!window._ambiGonioY || window._ambiGonioY.length !== n) window._ambiGonioY = new Float32Array(n);
    analyserX.getFloatTimeDomainData(window._ambiGonioX);
    analyserY.getFloatTimeDomainData(window._ambiGonioY);

    ctx.strokeStyle = pal.ambiStroke;
    ctx.lineWidth = 1.4;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    const step = Math.max(1, Math.floor(n / 220));
    // Повышенная чувствительность: большинство B-format материала сидит намного тише полной
    // шкалы, поэтому применяем усиление с мягким ограничением (tanh), чтобы даже тихий сигнал
    // давал заметный узор, а громкие пики просто плавно подходили к краю, а не обрезались.
    const AMBI_GONIO_GAIN = 2.6;
    for (let i = 0; i < n; i += step) {
        // Left/right on screen ← Y channel, up/down on screen ← X channel (up = front),
        // matching the pad's own yaw/pitch axes so the trail leans toward the source.
        const x = cx + Math.tanh(window._ambiGonioY[i] * AMBI_GONIO_GAIN) * scale;
        const y = cy - Math.tanh(window._ambiGonioX[i] * AMBI_GONIO_GAIN) * scale;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
};

// --- Module 1: Goniometer / Vectorscope (Lissajous, phosphor trail) ---
window.drawGoniometerFrame = function() {
    const canvas = document.getElementById('goniometer-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2;
    const scale = Math.min(w, h) / 2 * 0.82;

    const pal = window.getAnalyzerPalette();

    // Fade previous trail instead of clearing, for a smooth phosphor-like decay
    ctx.fillStyle = pal.fade;
    ctx.fillRect(0, 0, w, h);

    // Grid redrawn at full opacity every frame so it never fades out
    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, scale, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - scale, cy); ctx.lineTo(cx + scale, cy);
    ctx.moveTo(cx, cy - scale); ctx.lineTo(cx, cy + scale);
    ctx.stroke();
    ctx.strokeStyle = pal.gridSoft;
    ctx.beginPath();
    ctx.moveTo(cx - scale * 0.7, cy - scale * 0.7); ctx.lineTo(cx + scale * 0.7, cy + scale * 0.7);
    ctx.moveTo(cx - scale * 0.7, cy + scale * 0.7); ctx.lineTo(cx + scale * 0.7, cy - scale * 0.7);
    ctx.stroke();

    ctx.fillStyle = pal.label;
    ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText('M', cx - 4, cy - scale - 6);
    ctx.fillText('L', cx - scale - 12, cy + 4);
    ctx.fillText('R', cx + scale + 3, cy + 4);

    const pair = window.getGoniometerPair();
    if (!pair) return;
    const [analyserA, analyserB] = pair;
    const n = analyserA.fftSize;

    if (!window._gonioBufA || window._gonioBufA.length !== n) window._gonioBufA = new Float32Array(n);
    if (!window._gonioBufB || window._gonioBufB.length !== n) window._gonioBufB = new Float32Array(n);
    analyserA.getFloatTimeDomainData(window._gonioBufA);
    analyserB.getFloatTimeDomainData(window._gonioBufB);

    // Coral stroke — no glow
    ctx.strokeStyle = pal.stroke;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    const step = Math.max(1, Math.floor(n / 360));
    // Повышенная чувствительность: типичный полевой материал редко подходит к 0 dBFS, так что
    // сырые L/R сильно занижали бы узор. Усиливаем сигнал и мягко ограничиваем его tanh'ом —
    // тихие записи дают читаемую фигуру, а пики просто подходят к краю круга без обрезки.
    const GONIO_GAIN = 2.2;
    for (let i = 0; i < n; i += step) {
        const L = window._gonioBufA[i], R = window._gonioBufB[i];
        // Classic 45° goniometer rotation: mono (L=R) collapses to the vertical axis
        const x = cx + Math.tanh(((L - R) / Math.SQRT2) * GONIO_GAIN) * scale;
        const y = cy - Math.tanh(((L + R) / Math.SQRT2) * GONIO_GAIN) * scale;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
};

// --- Module 2: Spectrogram (scrolling heatmap / waterfall, iZotope RX style) ---
window.drawSpectrumFrame = function() {
    const canvas = document.getElementById('spectrum-canvas');
    if (!canvas || !window.analyserNode || !window.audioContext) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const w = canvas.width, h = canvas.height;

    // Scroll the whole heatmap 1px to the left; the new column is drawn at the right edge
    ctx.drawImage(canvas, -1, 0);

    const binCount = window.analyserNode.frequencyBinCount;
    if (!window._spectrumData || window._spectrumData.length !== binCount) {
        window._spectrumData = new Uint8Array(binCount);
    }
    window.analyserNode.getByteFrequencyData(window._spectrumData);

    const sampleRate = window.audioContext.sampleRate;
    const nyquist = sampleRate / 2;
    const minFreq = 20, maxFreq = Math.min(20000, nyquist);
    const minLog = Math.log10(minFreq), maxLog = Math.log10(maxFreq);

    // One ImageData column instead of h× fillRect — much cheaper on the main thread.
    if (!window._spectrumColumn || window._spectrumColumn.height !== h) {
        window._spectrumColumn = ctx.createImageData(1, h);
    }
    const col = window._spectrumColumn;
    const data = col.data;
    for (let y = 0; y < h; y++) {
        const t = 1 - y / h;
        const freq = Math.pow(10, minLog + t * (maxLog - minLog));
        const bin = Math.max(0, Math.min(binCount - 1, Math.round((freq / nyquist) * binCount)));
        const mag = Math.pow(window._spectrumData[bin] / 255, 0.85);
        const rgb = window.izotopeColorRgb(mag);
        const i = y * 4;
        data[i] = rgb[0];
        data[i + 1] = rgb[1];
        data[i + 2] = rgb[2];
        data[i + 3] = 255;
    }
    ctx.putImageData(col, w - 1, 0);
};

// --- Module 3: Loudness Meter (RMS bar + Peak hold) ---
window.buildAnalyzerMetersUI = function() {
    const layout = window.getCurrentChannelLayout();
    const rebuilt = window.setupChannelAnalysers(layout.count);

    if (rebuilt) {
        if (window.isAmbisonicMode && window.foaDecoder) {
            window.routeAmbisonics();
        } else if (window.audioElementSource && window.gainNode) {
            window.routeNormalAudio();
        }
    }

    const gonioMeta = document.getElementById('goniometer-meta');
    if (gonioMeta) gonioMeta.textContent = window.getGoniometerLabel(layout);

    const loudnessMeta = document.getElementById('loudness-meter-meta');
    if (loudnessMeta) loudnessMeta.textContent = `${layout.count} ch · ${layout.kind}`;

    const loudnessWrap = document.getElementById('loudness-meter-v');
    if (loudnessWrap) {
        loudnessWrap.innerHTML = layout.labels.map((label, i) => `
            <div class="loudness-channel-v">
                <div class="loudness-bar-track-v">
                    <div id="loudness-peak-${i}" class="loudness-peak-v"></div>
                    <div id="loudness-cover-${i}" class="loudness-cover-v"></div>
                </div>
                <span class="loudness-ch-label font-mono">${label}</span>
                <span id="loudness-db-${i}" class="loudness-db-label-v font-mono">−∞</span>
            </div>
        `).join('');
    }

    const panRow = document.getElementById('stereo-panner-row');
    const panSlider = document.getElementById('stereo-panner-slider');
    const canPan = layout.kind === 'stereo' || layout.kind === 'binaural';
    if (panRow) panRow.classList.toggle('hidden', !canPan || !!window.isAmbisonicMode);
    if (panSlider) panSlider.disabled = !canPan || !!window.isAmbisonicMode;

    window.loudnessPeaks = new Array(layout.count).fill(0);
    window.loudnessPeakHold = new Array(layout.count).fill(0);
    window.currentChannelLayout = layout;
};

// Peak-hold: jumps up instantly, holds briefly, then falls slowly
window.updateLoudnessPeak = function(i, pct) {
    if (!window.loudnessPeaks) window.loudnessPeaks = [];
    if (!window.loudnessPeakHold) window.loudnessPeakHold = [];
    const currentPeak = window.loudnessPeaks[i] || 0;

    if (pct >= currentPeak) {
        window.loudnessPeaks[i] = pct;
        window.loudnessPeakHold[i] = 84; // ~1.4s hold at 60fps before falling
    } else if ((window.loudnessPeakHold[i] || 0) > 0) {
        window.loudnessPeakHold[i] -= 1;
    } else {
        window.loudnessPeaks[i] = Math.max(pct, currentPeak - 1.4);
    }
    return window.loudnessPeaks[i];
};

window.drawLoudnessFrame = function() {
    const analysers = window.channelAnalysers || [];
    if (!analysers.length) return;

    let dbMax = -Infinity;

    analysers.forEach((analyser, i) => {
        const { rms, peak } = window.measureChannel(analyser);
        const rmsDb = window.dbFromRms(rms);
        const peakDb = window.dbFromRms(peak);
        const rmsPct = window.dbToMeterPercent(rmsDb);
        const peakPct = window.dbToMeterPercent(peakDb);
        if (isFinite(rmsDb) && rmsDb > dbMax) dbMax = rmsDb;

        const heldPeakPct = window.updateLoudnessPeak(i, peakPct);

        const cover = document.getElementById(`loudness-cover-${i}`);
        const peakEl = document.getElementById(`loudness-peak-${i}`);
        const dbLabel = document.getElementById(`loudness-db-${i}`);

        if (cover) cover.style.height = `${100 - rmsPct}%`;
        if (peakEl) peakEl.style.top = `${100 - heldPeakPct}%`;
        if (dbLabel) dbLabel.textContent = !isFinite(rmsDb) || rmsDb <= -90 ? '−∞' : rmsDb.toFixed(1);
    });

    const label = document.getElementById('loudness-db-label');
    if (label) {
        label.textContent = !isFinite(dbMax) || dbMax <= -90 ? '−∞ dB' : `${dbMax.toFixed(1)} dB`;
    }
};

// --- Animation loop: runs ONLY while something needs it AND audio is playing ---
// Cap ~30fps so spectrogram/gonio share the main thread with map/list work.
window.analyzerTick = function(ts) {
    window.analyzerFrameId = null;
    if (!window.isPlaying) return;
    const now = typeof ts === 'number' ? ts : performance.now();
    if (window.__analyzerLastTs == null) window.__analyzerLastTs = 0;
    if (now - window.__analyzerLastTs < 32) {
        if (window.analyzersOpen || window.isAmbisonicMode) {
            window.analyzerFrameId = requestAnimationFrame(window.analyzerTick);
        }
        return;
    }
    window.__analyzerLastTs = now;
    if (window.analyzersOpen) {
        window.drawGoniometerFrame();
        window.drawSpectrumFrame();
        window.drawLoudnessFrame();
    }
    if (window.isAmbisonicMode) {
        window.drawAmbiGoniometerFrame();
    }
    if (window.analyzersOpen || window.isAmbisonicMode) {
        window.analyzerFrameId = requestAnimationFrame(window.analyzerTick);
    }
};

window.syncAnalyzerAnimation = function() {
    const shouldRun = !!window.isPlaying && (!!window.analyzersOpen || !!window.isAmbisonicMode);
    if (shouldRun && !window.analyzerFrameId) {
        window.analyzerFrameId = requestAnimationFrame(window.analyzerTick);
    } else if (!shouldRun && window.analyzerFrameId) {
        cancelAnimationFrame(window.analyzerFrameId);
        window.analyzerFrameId = null;
    }
};

window.collapsePlayerAnalyzers = function() {
    const wasAnalyzerView = window.__dockView === 'analyzers';
    window.analyzersOpen = false;
    window.syncAnalyzerAnimation();

    const panel = document.getElementById('player-analyzers');
    const card = document.getElementById('player-card');
    const btn = document.getElementById('btn-analyzer-toggle');
    const icon = document.getElementById('btn-analyzer-icon');

    if (panel) panel.classList.add('hidden');
    if (card) card.classList.remove('analyzers-expanded');
    if (btn) btn.classList.remove('active');
    if (icon) icon.className = 'icon-chart-2 text-[12px] md:text-[13px] pointer-events-none';
    document.body.classList.remove('player-analyzers-open');

    if (wasAnalyzerView && window.openDockView && !window.__skipAnalyzerViewRestore) {
        window.openDockView(window.__sidebarTab || 'library');
    }
};

window.refreshAnalyzerMetersIfOpen = function() {
    if (!window.analyzersOpen) return;
    window.buildAnalyzerMetersUI();
};

window.togglePlayerAnalyzers = async function() {
    const panel = document.getElementById('player-analyzers');
    const card = document.getElementById('player-card');
    const btn = document.getElementById('btn-analyzer-toggle');
    const icon = document.getElementById('btn-analyzer-icon');
    if (!panel) return;

    window.analyzersOpen = !window.analyzersOpen;

    if (window.analyzersOpen) {
        const ok = await window.ensureAudioGraph();
        if (!ok) {
            window.analyzersOpen = false;
            window.showToast('Анализаторы недоступны в этом браузере');
            return;
        }

        panel.classList.remove('hidden');
        if (card) card.classList.remove('analyzers-expanded');
        if (btn) btn.classList.add('active');
        if (icon) icon.className = 'icon-arrow-down text-[12px] md:text-[13px] pointer-events-none';
        document.body.classList.add('player-analyzers-open');

        if (window.openDockView) window.openDockView('analyzers');

        window.buildAnalyzerMetersUI();
        if (window.refreshAnalyzersTheme) window.refreshAnalyzersTheme();
        else window.resizeAnalyzerCanvases();
        window.drawGoniometerFrame();
        window.drawSpectrumFrame();
        window.drawLoudnessFrame();

        window.syncAnalyzerAnimation();
    } else {
        window.collapsePlayerAnalyzers();
    }
};

// --- Playback ---
window.toggleMainPlay = function() {
    if (!window.currentPlayingId) return;
    const s = window.soundsData.find(x => x.id === window.currentPlayingId);
            
    if (window.isPlaying) { 
        window.isPlaying = false;
        if(window.audioElement) window.audioElement.pause();
        if (window.isAmbisonicMode) window.stopFoaBufferSource();
        if (window.mockInterval) clearInterval(window.mockInterval);
        if (window.animationFrameId) cancelAnimationFrame(window.animationFrameId);
        if (window.playSfx) window.playSfx('pause');
    } else { 
        window.isPlaying = true;
        if (window.playSfx) window.playSfx('play');
        if (s.url && window.audioElement && window.audioElement.src) {
            const playPromise = window.audioElement.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    if (window.isAmbisonicMode) window.syncFoaBufferPlayback();
                    window.startTimelineAnimation();
                }).catch((err) => { 
                    if (err.name !== 'AbortError') {
                        console.error("Audio playback error:", err);
                        window.startMockPlayback(s); 
                    }
                });
            }
        } else {
            window.showToast(translations[window.currentLang].err_no_audio);
            window.startMockPlayback(s);
        }
    }
    window.updateUIState();
}

window.prepareMockPlayback = function(s) {
    window.isPlaying = false;
    window.simulatedTime = 0;
    const parts = (s.duration || "1:00").split(':');
    window.simulatedDuration = parseInt(parts[0]) * 60 + parseInt(parts[1]);
            
    const tTotal = document.getElementById('time-total');
    if(tTotal) tTotal.textContent = s.duration;

    window.updatePlayerVisuals(0, window.simulatedDuration);
    window.updateUIState();
}

window.startMockPlayback = function(s) {
    if (window.mockInterval) clearInterval(window.mockInterval);
    window.mockInterval = setInterval(() => {
        if (!window.isPlaying) return;
        window.simulatedTime += 0.25; 
        if (window.simulatedTime >= window.simulatedDuration) {
            window.isPlaying = false; window.simulatedTime = 0;
            clearInterval(window.mockInterval);
            window.updateUIState();
            return;
        }
        window.updatePlayerVisuals(window.simulatedTime, window.simulatedDuration);
    }, 250);
}

window.updateUIState = function() {
    const p = document.getElementById('main-play-icon'), s = document.getElementById('main-pause-icon'), l = document.getElementById('main-load-icon');
    if(p && s && l) {
        if (window.isPlaying) { p.classList.add('hidden'); l.classList.add('hidden'); s.classList.remove('hidden'); } 
        else { l.classList.add('hidden'); s.classList.add('hidden'); p.classList.remove('hidden'); }
    }
    const wavePill = document.getElementById('player-wave-pill');
    if (wavePill) wavePill.classList.add('hidden');
    document.body.classList.toggle('audio-is-live', !!window.isPlaying);
    if (window.syncAnalyzerAnimation) window.syncAnalyzerAnimation();
    if (window.refreshPlayingListRow) window.refreshPlayingListRow();
    else if (window.renderList) window.renderList();
}

/** Extract normalized peak magnitudes (0–1). Multi-channel → { lanes, labels } when enabled. */
window.peaksFromAudioBuffer = function(buffer, sampleCount, opts = {}) {
    const n = Math.max(64, Math.min(220, sampleCount | 0 || 160));
    const multi = !!(opts.multi ?? (window.isMultiChannelWaveformEnabled && window.isMultiChannelWaveformEnabled()));
    if (!buffer || !buffer.length) {
        const fake = Array.from({ length: n }, (_, i) => 0.12 + 0.08 * Math.sin(i / 6));
        return multi ? { lanes: [fake], labels: ['M'] } : fake;
    }
    const channelCount = Math.max(1, buffer.numberOfChannels || 1);
    const useChannels = multi ? Math.min(8, channelCount) : 1;
    const labels = (opts.labels && opts.labels.length)
        ? opts.labels.slice(0, useChannels)
        : Array.from({ length: useChannels }, (_, i) => (useChannels === 1 ? 'M' : `Ch${i + 1}`));

    const buildLane = (ch) => {
        const len = buffer.length;
        const block = Math.max(1, Math.floor(len / n));
        const data = buffer.getChannelData(Math.min(ch, channelCount - 1));
        const peaks = new Array(n);
        let maxPeak = 0.0001;
        const stride = Math.max(1, Math.floor(block / 48));
        for (let i = 0; i < n; i++) {
            const start = i * block;
            const end = Math.min(len, start + block);
            let peak = 0;
            for (let j = start; j < end; j += stride) {
                const v = Math.abs(data[j]);
                if (v > peak) peak = v;
            }
            peaks[i] = peak;
            if (peak > maxPeak) maxPeak = peak;
        }
        for (let i = 0; i < n; i++) {
            const norm = peaks[i] / maxPeak;
            peaks[i] = Math.max(0.04, Math.min(1, Math.pow(norm, 0.72)));
        }
        return peaks;
    };

    if (!multi || useChannels <= 1) return buildLane(0);
    return {
        lanes: Array.from({ length: useChannels }, (_, c) => buildLane(c)),
        labels
    };
};

/** Fast PCM WAV → peaks without AudioContext.decodeAudioData (much quicker for large files). */
window.peaksFromWavArrayBuffer = function(ab, sampleCount, opts = {}) {
    if (!ab || ab.byteLength < 44) return null;
    const view = new DataView(ab);
    if (view.getUint32(0, false) !== 0x52494646 || view.getUint32(8, false) !== 0x57415645) return null; // RIFF / WAVE
    let offset = 12;
    let channels = 1;
    let bits = 16;
    let dataOffset = -1;
    let dataSize = 0;
    while (offset + 8 <= view.byteLength) {
        const id = view.getUint32(offset, false);
        const size = view.getUint32(offset + 4, true);
        const next = offset + 8 + size + (size % 2);
        if (id === 0x666d7420) { // fmt
            channels = Math.max(1, view.getUint16(offset + 10, true) || 1);
            bits = view.getUint16(offset + 22, true) || 16;
            const format = view.getUint16(offset + 8, true);
            if (format !== 1 && format !== 3) return null; // PCM or IEEE float
            if (format === 3) bits = 32;
        } else if (id === 0x64617461) { // data
            dataOffset = offset + 8;
            dataSize = size;
            break;
        }
        offset = next;
    }
    if (dataOffset < 0 || dataSize <= 0) return null;
    const n = Math.max(64, Math.min(220, sampleCount | 0 || 160));
    const bytesPerSample = Math.max(1, bits / 8);
    const frameSize = bytesPerSample * channels;
    const totalFrames = Math.floor(dataSize / frameSize);
    if (totalFrames < 8) return null;
    const block = Math.max(1, Math.floor(totalFrames / n));
    const stride = Math.max(1, Math.floor(block / 48));
    const endByte = Math.min(view.byteLength, dataOffset + dataSize);
    const multi = !!(opts.multi ?? (window.isMultiChannelWaveformEnabled && window.isMultiChannelWaveformEnabled()));
    const useChannels = multi ? Math.min(8, channels) : 1;

    const readSample = (byteOffset) => {
        if (byteOffset + bytesPerSample > endByte) return 0;
        if (bits === 8) return (view.getUint8(byteOffset) - 128) / 128;
        if (bits === 16) return view.getInt16(byteOffset, true) / 32768;
        if (bits === 24) {
            const b0 = view.getUint8(byteOffset);
            const b1 = view.getUint8(byteOffset + 1);
            const b2 = view.getUint8(byteOffset + 2);
            let sample = (b2 << 16) | (b1 << 8) | b0;
            if (sample & 0x800000) sample |= ~0xffffff;
            return sample / 8388608;
        }
        if (bits === 32) return view.getFloat32(byteOffset, true);
        return null;
    };

    const buildLane = (ch) => {
        const peaks = new Array(n);
        let maxPeak = 0.0001;
        for (let i = 0; i < n; i++) {
            const startFrame = i * block;
            const endFrame = Math.min(totalFrames, startFrame + block);
            let peak = 0;
            for (let f = startFrame; f < endFrame; f += stride) {
                const o = dataOffset + f * frameSize + ch * bytesPerSample;
                const v = readSample(o);
                if (v == null) return null;
                const a = Math.abs(v);
                if (a > peak) peak = a;
            }
            peaks[i] = peak;
            if (peak > maxPeak) maxPeak = peak;
        }
        for (let i = 0; i < n; i++) {
            const norm = peaks[i] / maxPeak;
            peaks[i] = Math.max(0.04, Math.min(1, Math.pow(norm, 0.72)));
        }
        return peaks;
    };

    if (!multi || useChannels <= 1) return buildLane(0);
    const lanes = [];
    for (let c = 0; c < useChannels; c++) {
        const lane = buildLane(c);
        if (!lane) return null;
        lanes.push(lane);
    }
    const defaultLabels = channels === 2 ? ['L', 'R']
        : (channels === 4 ? ['W', 'X', 'Y', 'Z'] : Array.from({ length: useChannels }, (_, i) => `Ch${i + 1}`));
    return { lanes, labels: (opts.labels || defaultLabels).slice(0, useChannels) };
};

window.isMultiChannelWaveformEnabled = function() {
    try { return localStorage.getItem('rosmap_multi_waveform') === '1'; } catch (_) { return false; }
};

window.setMultiChannelWaveformEnabled = function(enabled, skipSave = false) {
    const on = !!enabled;
    if (!skipSave) {
        try { localStorage.setItem('rosmap_multi_waveform', on ? '1' : '0'); } catch (_) {}
    }
    const sw = document.getElementById('multi-wave-glass-switch');
    if (sw) sw.setAttribute('aria-checked', on ? 'true' : 'false');
    // Bust peak cache so lanes rebuild for the current track.
    window.__waveformPeaksCache = Object.create(null);
    window.__waveformInflight = Object.create(null);
    const s = (window.soundsData || []).find((x) => x.id === window.currentPlayingId);
    if (s && window.loadWaveformForSound) window.loadWaveformForSound(s);
    else if (window.drawWaveformCanvas) window.drawWaveformCanvas();
};

window.__waveformPeaksCache = window.__waveformPeaksCache || Object.create(null);
window.__waveformInflight = window.__waveformInflight || Object.create(null);
window.__waveformRequestId = window.__waveformRequestId || 0;
window.__waveformPeaks = window.__waveformPeaks ?? null;
window.__waveformProgress = window.__waveformProgress || 0;
window.__waveformBuffered = window.__waveformBuffered || 0;

window.__waveformCacheKey = function(soundOrUrl) {
    if (!soundOrUrl) return '';
    const base = typeof soundOrUrl === 'string'
        ? soundOrUrl
        : (soundOrUrl.url || soundOrUrl.audioUrl || soundOrUrl.id || '');
    const multi = window.isMultiChannelWaveformEnabled && window.isMultiChannelWaveformEnabled() ? 'm' : 's';
    return `${base}|${multi}`;
};

window.__normalizeWaveformPeaks = function(peaks) {
    if (!peaks) return null;
    if (Array.isArray(peaks)) return { lanes: [peaks], labels: [''] };
    if (peaks.lanes && Array.isArray(peaks.lanes) && peaks.lanes.length) {
        return { lanes: peaks.lanes, labels: peaks.labels || [] };
    }
    return null;
};

window.__fetchWaveformPeaks = async function(url) {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'force-cache' });
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    const ab = await res.arrayBuffer();
    const multi = window.isMultiChannelWaveformEnabled && window.isMultiChannelWaveformEnabled();
    const fast = window.peaksFromWavArrayBuffer ? window.peaksFromWavArrayBuffer(ab, 160, { multi }) : null;
    if (fast && (Array.isArray(fast) ? fast.length : fast.lanes?.length)) return fast;
    const buffer = await window.__decodeAudioArrayBuffer(ab);
    return window.peaksFromAudioBuffer(buffer, 160, { multi });
};

/** Prefetch peaks into cache without forcing a canvas redraw (unless this sound is current). */
window.ensureWaveformPeaks = function(soundOrUrl, opts = {}) {
    const sound = (soundOrUrl && typeof soundOrUrl === 'object') ? soundOrUrl : null;
    const url = typeof soundOrUrl === 'string'
        ? soundOrUrl
        : (sound && (sound.url || sound.audioUrl)) || '';
    const cacheKey = window.__waveformCacheKey(soundOrUrl);
    if (!url || url.length < 8 || !cacheKey) return Promise.resolve(null);

    if (window.__waveformPeaksCache[cacheKey]) {
        if (opts.render) window.renderWaveformBars(window.__waveformPeaksCache[cacheKey]);
        return Promise.resolve(window.__waveformPeaksCache[cacheKey]);
    }
    if (window.__waveformInflight[cacheKey]) {
        return window.__waveformInflight[cacheKey].then((peaks) => {
            if (opts.render && peaks) window.renderWaveformBars(peaks);
            return peaks;
        });
    }

    const job = window.__fetchWaveformPeaks(url).then((peaks) => {
        if (peaks) window.__waveformPeaksCache[cacheKey] = peaks;
        delete window.__waveformInflight[cacheKey];
        if (opts.render || (sound && sound.id && sound.id === window.currentPlayingId)
            || (url && window.audioElement && (window.audioElement.src === url || window.audioElement.src.endsWith(url)))) {
            window.renderWaveformBars(peaks);
        }
        return peaks;
    }).catch((err) => {
        delete window.__waveformInflight[cacheKey];
        console.warn('waveform prefetch failed', err);
        return null;
    });
    window.__waveformInflight[cacheKey] = job;
    return job;
};

window.loadWaveformForSound = async function(soundOrUrl) {
    const reqId = ++window.__waveformRequestId;
    const sound = (soundOrUrl && typeof soundOrUrl === 'object') ? soundOrUrl : null;
    const url = typeof soundOrUrl === 'string'
        ? soundOrUrl
        : (sound && (sound.url || sound.audioUrl)) || '';
    const cacheKey = window.__waveformCacheKey(soundOrUrl);

    if (!url || url.length < 8) {
        window.renderWaveformBars(null);
        return;
    }

    if (cacheKey && window.__waveformPeaksCache[cacheKey]) {
        window.renderWaveformBars(window.__waveformPeaksCache[cacheKey]);
        return;
    }

    /* Keep previous visual while warming — avoid empty flash if possible */
    if (!window.__waveformPeaks) window.renderWaveformBars(null);

    try {
        const peaks = await window.ensureWaveformPeaks(soundOrUrl, { render: false });
        if (reqId !== window.__waveformRequestId) return;
        if (peaks) window.renderWaveformBars(peaks);
        else window.renderWaveformBars(null);
    } catch (err) {
        console.warn('waveform load failed', err);
        if (reqId !== window.__waveformRequestId) return;
        window.renderWaveformBars(null);
    }
};

/** Idle-prefetch waveforms for visible / upcoming sounds. */
window.prefetchVisibleWaveforms = function(limit = 10) {
    const list = (window.getFilteredSounds ? window.getFilteredSounds() : (window.soundsData || []))
        .filter((s) => s && (s.url || s.audioUrl) && (!s.status || s.status === 'published'));
    if (!list.length) return;
    const queue = [];
    for (const s of list) {
        const key = window.__waveformCacheKey(s);
        if (!key || window.__waveformPeaksCache[key] || window.__waveformInflight[key]) continue;
        queue.push(s);
        if (queue.length >= limit) break;
    }
    if (!queue.length) return;

    let i = 0;
    const step = () => {
        if (i >= queue.length) return;
        const s = queue[i++];
        window.ensureWaveformPeaks(s).finally(() => {
            if (typeof requestIdleCallback === 'function') {
                requestIdleCallback(step, { timeout: 1800 });
            } else {
                setTimeout(step, 120);
            }
        });
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(step, { timeout: 1200 });
    else setTimeout(step, 250);
};

window.scheduleWaveformPrefetch = function() {
    if (window.__waveformPrefetchTimer) clearTimeout(window.__waveformPrefetchTimer);
    window.__waveformPrefetchTimer = setTimeout(() => {
        if (window.prefetchVisibleWaveforms) window.prefetchVisibleWaveforms(12);
    }, 600);
};

window.drawWaveformCanvas = function() {
    const canvas = document.getElementById('waveform-canvas');
    const wrap = document.getElementById('waveform-wrapper');
    if (!canvas || !wrap) return;

    if (!window.__waveformResizeBound) {
        window.__waveformResizeBound = true;
        let t = null;
        window.addEventListener('resize', () => {
            clearTimeout(t);
            t = setTimeout(() => window.drawWaveformCanvas(), 80);
        });
        if (typeof ResizeObserver !== 'undefined') {
            try {
                const ro = new ResizeObserver(() => window.drawWaveformCanvas());
                ro.observe(wrap);
            } catch (_) {}
        }
    }

    const normalized = window.__normalizeWaveformPeaks(window.__waveformPeaks)
        || { lanes: [Array.from({ length: 96 }, (_, i) => 0.1 + 0.06 * Math.abs(Math.sin(i * 0.35)))], labels: [''] };
    const laneCount = Math.max(1, normalized.lanes.length);
    const multi = laneCount > 1;
    wrap.classList.toggle('waveform-wrapper--multi', multi);
    wrap.style.setProperty('--wave-lanes', String(laneCount));
    if (multi) {
        const targetH = Math.min(120, Math.max(56, 28 * laneCount + 8));
        wrap.style.height = `${targetH}px`;
    } else {
        wrap.style.height = '';
    }

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = Math.max(1, Math.round(wrap.clientWidth || 280));
    const cssH = Math.max(28, Math.round(wrap.clientHeight || 48));
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const progress = Math.max(0, Math.min(1, Number(window.__waveformProgress) || 0));
    const buffered = Math.max(progress, Math.min(1, Number(window.__waveformBuffered) || 0));
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#222222';
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#FBAB57';
    const laneH = cssH / laneCount;
    const gap = multi ? 2 : 0;

    const paintLane = (peaks, top, height) => {
        const mid = top + height / 2;
        const amp = (height - gap) * 0.42;
        const buildPath = () => {
            const step = cssW / Math.max(1, peaks.length - 1);
            ctx.beginPath();
            ctx.moveTo(0, mid);
            for (let i = 0; i < peaks.length; i++) {
                const x = i * step;
                const y = mid - peaks[i] * amp;
                ctx.lineTo(x, y);
            }
            for (let i = peaks.length - 1; i >= 0; i--) {
                const x = i * step;
                const y = mid + peaks[i] * amp * 0.92;
                ctx.lineTo(x, y);
            }
            ctx.closePath();
        };

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, top, cssW * buffered, height);
        ctx.clip();
        buildPath();
        ctx.fillStyle = ink;
        ctx.globalAlpha = 0.22;
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.rect(cssW * buffered, top, cssW * (1 - buffered) + 1, height);
        ctx.clip();
        buildPath();
        ctx.fillStyle = ink;
        ctx.globalAlpha = 0.14;
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, top, cssW * progress, height);
        ctx.clip();
        buildPath();
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.95;
        ctx.fill();
        ctx.restore();

        ctx.globalAlpha = 0.16;
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, mid);
        ctx.lineTo(cssW, mid);
        ctx.stroke();
        ctx.globalAlpha = 1;
    };

    normalized.lanes.forEach((lane, idx) => {
        const top = idx * laneH;
        paintLane(lane, top, laneH);
        const label = normalized.labels[idx];
        if (multi && label) {
            ctx.globalAlpha = 0.45;
            ctx.fillStyle = ink;
            ctx.font = '600 9px Geologica, system-ui, sans-serif';
            ctx.fillText(label, 4, top + 11);
            ctx.globalAlpha = 1;
        }
    });

    if (window.renderWaveformTimeMarkers) window.renderWaveformTimeMarkers();
};

window.renderWaveformBars = function(peaks) {
    const norm = window.__normalizeWaveformPeaks(peaks);
    window.__waveformPeaks = norm || null;
    window.drawWaveformCanvas();
};

window.renderWaveform = function(peaks) {
    window.renderWaveformBars(peaks);
};

window.renderWaveformTimeMarkers = function() {
    const wrap = document.getElementById('waveform-wrapper');
    let layer = document.getElementById('waveform-markers');
    if (!wrap) return;
    if (!layer) {
        layer = document.createElement('div');
        layer.id = 'waveform-markers';
        layer.className = 'waveform-markers';
        layer.setAttribute('aria-hidden', 'true');
        wrap.appendChild(layer);
    }
    const s = (window.soundsData || []).find((x) => x.id === window.currentPlayingId);
    const markers = Array.isArray(s?.timeMarkers) ? s.timeMarkers : [];
    const duration = (window.audioElement && window.audioElement.duration)
        || (s && s.durationSec)
        || 0;
    if (!markers.length || !(duration > 0)) {
        layer.innerHTML = '';
        layer.classList.add('hidden');
        return;
    }
    layer.classList.remove('hidden');
    const esc = (t) => String(t ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    layer.innerHTML = markers
        .slice()
        .sort((a, b) => (Number(a.t) || 0) - (Number(b.t) || 0))
        .map((m) => {
            const sec = Math.max(0, Number(m.t) || 0);
            const pct = Math.max(0, Math.min(100, (sec / duration) * 100));
            const label = String(m.label || '').trim();
            const time = window.formatTime ? window.formatTime(sec) : `${sec}s`;
            const tip = label || time;
            const edge = pct < 12 ? 'is-edge-left' : (pct > 88 ? 'is-edge-right' : '');
            return `<button type="button" class="waveform-marker ${edge}" style="left:${pct}%" data-t="${sec}" aria-label="${esc(tip)}">`
                + `<span class="waveform-marker__tip" role="tooltip">${esc(tip)}</span>`
                + `</button>`;
        })
        .join('');
    if (layer.dataset.bound !== '1') {
        layer.dataset.bound = '1';
        layer.addEventListener('click', (e) => {
            const btn = e.target.closest('.waveform-marker');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            const sec = Number(btn.dataset.t) || 0;
            if (window.audioElement && window.audioElement.duration) {
                const ratio = (sec / window.audioElement.duration) * 100;
                if (window.seekAudio) window.seekAudio(ratio);
            }
        });
    }
};

window.seekToTimeMarker = function(sec) {
    if (!window.audioElement || !window.audioElement.duration) return;
    const ratio = (Math.max(0, Number(sec) || 0) / window.audioElement.duration) * 100;
    if (window.seekAudio) window.seekAudio(ratio);
};

window.__decodeAudioArrayBuffer = async function(ab) {
    if (!ab || !ab.byteLength) throw new Error('empty audio');
    if (window.ensureAudioGraph) {
        try { await window.ensureAudioGraph(); } catch (_) {}
    }
    const ctx = window.audioContext
        || new (window.AudioContext || window.webkitAudioContext)();
    const copy = ab.slice(0);
    if (ctx.decodeAudioData.length === 1) {
        return await ctx.decodeAudioData(copy);
    }
    return await new Promise((resolve, reject) => {
        ctx.decodeAudioData(copy, resolve, reject);
    });
};

window.updateBufferProgress = function() {
    if (!window.audioElement) return;
    const buffered = window.audioElement.buffered;
    const duration = window.audioElement.duration;
    if (duration > 0 && buffered.length > 0) {
        let end = 0;
        for (let i = 0; i < buffered.length; i++) {
            if (buffered.start(i) <= window.audioElement.currentTime && buffered.end(i) >= window.audioElement.currentTime) {
                end = buffered.end(i); break;
            }
        }
        if (end === 0) end = buffered.end(buffered.length - 1);
        window.__waveformBuffered = end / duration;
        window.drawWaveformCanvas();
    }
};

window.startTimelineAnimation = function() {
    if (window.animationFrameId) cancelAnimationFrame(window.animationFrameId);
    const a = () => {
        if (!window.isPlaying || !window.audioElement || !window.audioElement.src) return;
        window.updatePlayerVisuals(window.audioElement.currentTime, window.audioElement.duration || 1);
        window.updateBufferProgress();
        window.animationFrameId = requestAnimationFrame(a);
    };
    a();
};

window.updatePlayerVisuals = function(current, total) {
    if (isNaN(total) || total === 0) return;
    const r = current / total;

    const tCur = document.getElementById('time-current');
    const pHead = document.getElementById('playhead');
    const aTime = document.getElementById('audio-timeline');

    if (tCur) tCur.textContent = window.formatTime(current);
    window.__waveformProgress = r;
    window.drawWaveformCanvas();
    if (pHead) pHead.style.left = `${r * 100}%`;
    if (aTime) aTime.value = r * 100;

    if (window.walkerMarker && window.currentPlayingId) {
        const s = window.soundsData.find(x => x.id === window.currentPlayingId);
        if (s && s.route) {
            const newPos = window.getPointAlongRoute(s.route, r);
            if (newPos) {
                if (window.setWalkerPosition) window.setWalkerPosition(newPos);
                else if (window.walkerMarker.geometry) window.walkerMarker.geometry.setCoordinates(newPos);
            }
        }
    }
};

window.seekAudio = function(v) { 
    const ratio = v / 100;
    const s = window.soundsData.find(x => x.id === window.currentPlayingId);
    if (s && s.url && window.audioElement) { 
        if (window.audioElement.duration) { 
            window.audioElement.currentTime = ratio * window.audioElement.duration;
            if (window.isAmbisonicMode) window.syncFoaBufferPlayback();
            if (!window.isPlaying) window.updatePlayerVisuals(window.audioElement.currentTime, window.audioElement.duration);
        } 
    } else {
        window.simulatedTime = ratio * window.simulatedDuration;
        if (!window.isPlaying) window.updatePlayerVisuals(window.simulatedTime, window.simulatedDuration);
    }
}
        
window.setupAudioEvents = function() { 
    if(!window.audioElement) return;
            
    window.audioElement.onended = () => { window.isPlaying = false; window.updateUIState(); }; 
    window.audioElement.onloadedmetadata = () => { 
        const tTotal = document.getElementById('time-total');
        if(tTotal) tTotal.textContent = window.formatTime(window.audioElement.duration);
        if (window.renderWaveformTimeMarkers) window.renderWaveformTimeMarkers();
    };
            
    window.audioElement.onwaiting = () => {
        const p = document.getElementById('main-play-icon'), s = document.getElementById('main-pause-icon'), l = document.getElementById('main-load-icon');
        if(p && s && l) { p.classList.add('hidden'); s.classList.add('hidden'); l.classList.remove('hidden'); }
    };
    window.audioElement.onplaying = () => { window.updateUIState(); };
    window.audioElement.oncanplay = () => { window.updateUIState(); };
    window.audioElement.onprogress = () => { window.updateBufferProgress(); };
}

    window.restorePlayerCard = function() {
        const card = document.getElementById('player-card');
        if (card) {
            card.classList.remove('translate-y-[150%]', 'opacity-0');
            card.classList.add('translate-y-0');
        }
        document.body.classList.add('player-visible');
    };

window.closePlayerCard = function(opts) {
    const card = document.getElementById('player-card');
    const skipAnim = !!(opts && opts.skipAnim);

    if (window.isPlaying || window.audioElement) {
        window.isPlaying = false;
        if (window.audioElement) {
            window.audioElement.pause();
            window.audioElement.currentTime = 0;
            window.audioElement.src = '';
            window.audioElement.removeAttribute('src');
        }
        if (window.animationFrameId) cancelAnimationFrame(window.animationFrameId);
        if (window.mockInterval) clearInterval(window.mockInterval);
    }

    window.collapsePlayerAnalyzers();
    window.resetStereoPan();
    if (window.resetPlaybackPitch) window.resetPlaybackPitch();
    if (window.collapsePlayerSheet) window.collapsePlayerSheet();

    if (card) {
        card.classList.remove('is-dragging', 'is-gesture-settle', 'is-gesture-closing');
        card.style.transform = '';
        card.style.opacity = '';
        if (skipAnim) {
            card.style.transition = 'none';
            card.classList.add('translate-y-[150%]', 'opacity-0');
            void card.offsetWidth;
            card.style.transition = '';
        } else {
            card.classList.add('translate-y-[150%]', 'opacity-0');
        }
    }
    document.body.classList.remove('player-visible');
    if (window.playSfx) window.playSfx('close');

    const ambiControl = document.getElementById('ambisonics-control');
    if (ambiControl) ambiControl.classList.add('hidden');
    if (window.isAmbisonicMode && window.disableAmbisonicMode) window.disableAmbisonicMode();
    window.isAmbisonicMode = false;
    window.stopFoaBufferSource?.();
    window.__foaAudioBuffer = null;
    window.__foaBufferUrl = '';

    window.currentPlayingId = null;
    window.clearMapRoutes();
    window.updateMapMarkers();
    if (window.updateUIState) window.updateUIState();
}

// Canvas backing stores are sized from their CSS box on open; keep them in sync with the
// actual box when the viewport changes (desktop window resize, phone rotation, DevTools
// docking, etc.) so the analyzers never render stretched/blurry on either device class.
let _analyzerResizeRaf = null;
window.addEventListener('resize', () => {
    if (_analyzerResizeRaf) cancelAnimationFrame(_analyzerResizeRaf);
    _analyzerResizeRaf = requestAnimationFrame(() => {
        _analyzerResizeRaf = null;
        if (window.analyzersOpen) {
            window.resizeAnalyzerCanvases();
            window.drawGoniometerFrame();
            window.drawSpectrumFrame();
        }
        if (window.isAmbisonicMode) {
            window.resizeAmbiGoniometerCanvas();
        }
    });
});
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        if (window.analyzersOpen) window.resizeAnalyzerCanvases();
        if (window.isAmbisonicMode) window.resizeAmbiGoniometerCanvas();
    }, 150);
});
