// Управление громкостью
window.changeVolume = function(val) {
    const num = parseFloat(val);
    if(window.audioElement) window.audioElement.volume = num;
    if(window.gainNode) window.gainNode.gain.value = num; 
            
    const icon = document.getElementById('volume-icon');
    if(icon) {
        icon.className = 'pointer-events-none text-sm w-4 text-center fa-solid ' + 
            (num === 0 ? 'fa-volume-xmark text-red-500' : (num < 0.5 ? 'fa-volume-low' : 'fa-volume-high'));
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
window.initOmnitone = async function() {
    if (window.omnitoneInitialized) return true;
    try {
        const ok = await window.ensureAudioGraph();
        if (!ok) return false;

        window.foaDecoder = Omnitone.createFOARenderer(window.audioContext, {
            hrirPathUrl: 'https://cdn.jsdelivr.net/npm/omnitone@1.3.0/build/resources/'
        });
        await window.foaDecoder.initialize();

        window.omnitoneInitialized = true;
        return true;
    } catch (err) {
        console.error("Omnitone error:", err);
        return false;
    }
}

window.routeAmbisonics = function() {
    if (!window.audioContext || !window.foaDecoder || !window.audioElementSource) return;
    window.disconnectAudioGraph();
    window.audioElementSource.connect(window.foaDecoder.input);
    window.foaDecoder.output.connect(window.audioContext.destination);
    window.connectAnalyzerTaps(window.foaDecoder.output);
    window.foaDecoder.setRenderingMode('ambisonic');
    window._ambiAudioRouted = true;
    window._normalAudioRouted = false;
}

window.updateAmbisonicRotation = function(yawAngle, pitchAngle) {
    if (window.foaDecoder && window.isAmbisonicMode) {
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
    }
}

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
    if (!window.omnitoneInitialized) {
        const success = await window.initOmnitone();
        if (success) window.routeAmbisonics();
    } else {
        if(window.audioContext && window.audioContext.state === 'suspended') window.audioContext.resume();
        window.routeAmbisonics();
    }
    const panSlider = document.getElementById('stereo-panner-slider');
    if (panSlider) panSlider.disabled = true;
}

window.disableAmbisonicMode = function() {
    if (!window.audioContext || !window.audioElementSource) return;
    window.routeNormalAudio();
    const panSlider = document.getElementById('stereo-panner-slider');
    if (panSlider) panSlider.disabled = false;
}

window.toggleAmbisonics = function() {
    const control = document.getElementById('ambisonics-control');
    const btn = document.getElementById('btn-ambi-toggle');
    if (!control || !btn) return;
            
    window.isAmbisonicMode = !window.isAmbisonicMode;
    if(window.isAmbisonicMode) {
        window.enableAmbisonicMode(); 
        control.classList.remove('hidden');
        btn.classList.remove('text-indigo-500'); btn.classList.add('text-green-500');
        window.showToast(translations[window.currentLang].ambisonics_pan + " ON");
    } else {
        window.disableAmbisonicMode(); 
        control.classList.add('hidden');
        btn.classList.add('text-indigo-500'); btn.classList.remove('text-green-500');
        const dot = document.getElementById('ambi-dot');
        if(dot) { dot.style.left = '50%'; dot.style.top = '50%'; }
        const angleDisplay = document.getElementById('ambi-angle-val');
        if(angleDisplay) angleDisplay.textContent = `Y: 0° | P: 0°`;
        window.updateAmbisonicRotation(0, 0);
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

// iZotope RX-style heatmap colormap: near-black/navy → magenta → red/orange → yellow/white
window.izotopeColorStops = [
    { t: 0.00, c: [10, 10, 30] },
    { t: 0.14, c: [30, 12, 55] },
    { t: 0.34, c: [138, 43, 226] },
    { t: 0.56, c: [255, 69, 0] },
    { t: 0.74, c: [255, 165, 0] },
    { t: 0.90, c: [255, 255, 0] },
    { t: 1.00, c: [255, 255, 255] }
];

window.izotopeColor = function(value) {
    const v = Math.max(0, Math.min(1, value));
    const stops = window.izotopeColorStops;
    for (let i = 0; i < stops.length - 1; i++) {
        const a = stops[i], b = stops[i + 1];
        if (v >= a.t && v <= b.t) {
            const localT = (v - a.t) / (b.t - a.t || 1);
            const r = Math.round(a.c[0] + (b.c[0] - a.c[0]) * localT);
            const g = Math.round(a.c[1] + (b.c[1] - a.c[1]) * localT);
            const bch = Math.round(a.c[2] + (b.c[2] - a.c[2]) * localT);
            return `rgb(${r},${g},${bch})`;
        }
    }
    const last = stops[stops.length - 1].c;
    return `rgb(${last[0]},${last[1]},${last[2]})`;
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
    ctx.fillStyle = window.izotopeColor(0);
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

// --- Module 1: Goniometer / Vectorscope (Lissajous, phosphor trail) ---
window.drawGoniometerFrame = function() {
    const canvas = document.getElementById('goniometer-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2;
    const scale = Math.min(w, h) / 2 * 0.82;

    // Fade previous trail instead of clearing, for a smooth phosphor-like decay
    ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
    ctx.fillRect(0, 0, w, h);

    // Grid redrawn at full opacity every frame so it never fades out
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, scale, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - scale, cy); ctx.lineTo(cx + scale, cy);
    ctx.moveTo(cx, cy - scale); ctx.lineTo(cx, cy + scale);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.beginPath();
    ctx.moveTo(cx - scale * 0.7, cy - scale * 0.7); ctx.lineTo(cx + scale * 0.7, cy + scale * 0.7);
    ctx.moveTo(cx - scale * 0.7, cy + scale * 0.7); ctx.lineTo(cx + scale * 0.7, cy - scale * 0.7);
    ctx.stroke();

    ctx.fillStyle = 'rgba(203, 213, 225, 0.85)';
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

    // Neon teal/cyan stroke with a soft glow — kept light to protect frame rate
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(56, 189, 248, 0.55)';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    const step = Math.max(1, Math.floor(n / 360));
    for (let i = 0; i < n; i += step) {
        const L = window._gonioBufA[i], R = window._gonioBufB[i];
        // Classic 45° goniometer rotation: mono (L=R) collapses to the vertical axis
        const x = cx + ((L - R) / Math.SQRT2) * scale;
        const y = cy - ((L + R) / Math.SQRT2) * scale;
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

    // Bottom = bass (more screen space via log scale), top = highs
    for (let y = 0; y < h; y++) {
        const t = 1 - y / h;
        const freq = Math.pow(10, minLog + t * (maxLog - minLog));
        const bin = Math.max(0, Math.min(binCount - 1, Math.round((freq / nyquist) * binCount)));
        const mag = Math.pow(window._spectrumData[bin] / 255, 0.85);
        ctx.fillStyle = window.izotopeColor(mag);
        ctx.fillRect(w - 1, y, 1, 1);
    }
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

// --- Animation loop: runs ONLY while the panel is open AND audio is playing ---
window.analyzerTick = function() {
    window.analyzerFrameId = null;
    if (!window.analyzersOpen || !window.isPlaying) return;
    window.drawGoniometerFrame();
    window.drawSpectrumFrame();
    window.drawLoudnessFrame();
    window.analyzerFrameId = requestAnimationFrame(window.analyzerTick);
};

window.syncAnalyzerAnimation = function() {
    const shouldRun = !!window.analyzersOpen && !!window.isPlaying;
    if (shouldRun && !window.analyzerFrameId) {
        window.analyzerFrameId = requestAnimationFrame(window.analyzerTick);
    } else if (!shouldRun && window.analyzerFrameId) {
        cancelAnimationFrame(window.analyzerFrameId);
        window.analyzerFrameId = null;
    }
};

window.collapsePlayerAnalyzers = function() {
    window.analyzersOpen = false;
    window.syncAnalyzerAnimation();

    const panel = document.getElementById('player-analyzers');
    const card = document.getElementById('player-card');
    const btn = document.getElementById('btn-analyzer-toggle');
    const icon = document.getElementById('btn-analyzer-icon');

    if (panel) panel.classList.add('hidden');
    if (card) card.classList.remove('analyzers-expanded');
    if (btn) btn.classList.remove('active');
    if (icon) icon.className = 'fa-solid fa-chart-simple text-[12px] md:text-[13px] pointer-events-none';
    document.body.classList.remove('player-analyzers-open');
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
    if (!panel || !card) return;

    window.analyzersOpen = !window.analyzersOpen;

    if (window.analyzersOpen) {
        const ok = await window.ensureAudioGraph();
        if (!ok) {
            window.analyzersOpen = false;
            window.showToast('Web Audio API недоступен в этом браузере');
            return;
        }

        panel.classList.remove('hidden');
        card.classList.add('analyzers-expanded');
        if (btn) btn.classList.add('active');
        if (icon) icon.className = 'fa-solid fa-chevron-down text-[12px] md:text-[13px] pointer-events-none';
        document.body.classList.add('player-analyzers-open');

        window.buildAnalyzerMetersUI();
        window.resizeAnalyzerCanvases();
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
        if (window.mockInterval) clearInterval(window.mockInterval);
        if (window.animationFrameId) cancelAnimationFrame(window.animationFrameId);
    } else { 
        window.isPlaying = true;
        if (s.url && window.audioElement && window.audioElement.src) {
            const playPromise = window.audioElement.play();
            if (playPromise !== undefined) {
                playPromise.then(() => window.startTimelineAnimation()).catch((err) => { 
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
    if (window.syncAnalyzerAnimation) window.syncAnalyzerAnimation();
    window.renderList();
}

window.renderWaveform = function() {
    const data = [15, 25, 45, 20, 60, 40, 80, 55, 30, 15, 40, 70, 90, 50, 35, 20, 25, 45, 65, 85, 55, 35, 20, 25, 45, 65, 10, 35, 55, 75, 15, 40, 60, 35, 15, 50, 70, 90, 55, 30, 25, 45, 75, 85];
    let h = ''; data.forEach(v => h += `<div class="flex-1 bg-current rounded-full" style="height: ${v}%;"></div>`);
    const wBg = document.getElementById('waveform-bg'), wBuf = document.getElementById('waveform-buffered'), wAct = document.getElementById('waveform-active');
    if(wBg) wBg.innerHTML = h; if(wBuf) wBuf.innerHTML = h; if(wAct) wAct.innerHTML = h;
}

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
        const ratio = end / duration;
        const wBuf = document.getElementById('waveform-buffered');
        if(wBuf) wBuf.style.clipPath = `inset(0 ${100 - ratio * 100}% 0 0)`;
    }
}

window.startTimelineAnimation = function() {
    if (window.animationFrameId) cancelAnimationFrame(window.animationFrameId);
    const a = () => { 
        if (!window.isPlaying || !window.audioElement || !window.audioElement.src) return; 
        window.updatePlayerVisuals(window.audioElement.currentTime, window.audioElement.duration || 1);
        window.updateBufferProgress();
        window.animationFrameId = requestAnimationFrame(a); 
    };
    a();
}
        
window.updatePlayerVisuals = function(current, total) {
    if(isNaN(total) || total === 0) return;
    const r = current / total;
            
    const tCur = document.getElementById('time-current'), wAct = document.getElementById('waveform-active');
    const pHead = document.getElementById('playhead'), aTime = document.getElementById('audio-timeline');

    if(tCur) tCur.textContent = window.formatTime(current); 
    if(wAct) wAct.style.clipPath = `inset(0 ${100 - r * 100}% 0 0)`; 
    if(pHead) pHead.style.left = `${r * 100}%`;
    if(aTime) aTime.value = r * 100;

    if (window.walkerMarker && window.currentPlayingId) {
        const s = window.soundsData.find(x => x.id === window.currentPlayingId);
        if (s && s.route) {
            const newPos = window.getPointAlongRoute(s.route, r);
            if (newPos && window.walkerMarker.geometry) window.walkerMarker.geometry.setCoordinates(newPos);
        }
    }
}

window.seekAudio = function(v) { 
    const ratio = v / 100;
    const s = window.soundsData.find(x => x.id === window.currentPlayingId);
    if (s && s.url && window.audioElement) { 
        if (window.audioElement.duration) { 
            window.audioElement.currentTime = ratio * window.audioElement.duration; 
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

window.closePlayerCard = function() {
    const card = document.getElementById('player-card');

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

    if (card) card.classList.add('translate-y-[150%]', 'opacity-0');
    document.body.classList.remove('player-visible');

    const ambiControl = document.getElementById('ambisonics-control');
    if (ambiControl) ambiControl.classList.add('hidden');
    window.isAmbisonicMode = false;

    window.currentPlayingId = null;
    window.clearMapRoutes();
    window.updateMapMarkers();
    if (window.updateUIState) window.updateUIState();
    window.renderList();
}
