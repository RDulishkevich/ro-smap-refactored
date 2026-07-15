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

window.rmsFromAnalyser = function(analyser) {
    if (!analyser) return 0;
    if (typeof analyser.getFloatTimeDomainData === 'function') {
        const buf = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        return Math.sqrt(sum / buf.length);
    }
    const buf = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
    }
    return Math.sqrt(sum / buf.length);
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

window.renderSpectrogramAxes = function() {
    const hzAxis = document.getElementById('spectrogram-hz-axis');
    const dbAxis = document.getElementById('spectrogram-db-axis');
    if (!hzAxis || !dbAxis) return;

    const sampleRate = window.audioContext ? window.audioContext.sampleRate : 48000;
    const maxFreq = (sampleRate / 2) * 0.55;
    const freqAtRatio = (ratio) => Math.pow(ratio, 1.4) * maxFreq;
    const hzTicks = [1, 0.72, 0.42, 0.18].map(r => window.formatHzLabel(freqAtRatio(r)));

    hzAxis.innerHTML = hzTicks.map(t => `<span>${t}</span>`).join('') +
        '<span class="spec-axis-unit">Hz</span>';

    dbAxis.innerHTML = ['-10', '-30', '-50', '-70']
        .map(t => `<span>${t}</span>`).join('') +
        '<span class="spec-axis-unit">dB</span>';
};

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

    const meta = document.getElementById('stereo-image-meta');
    if (meta) meta.textContent = `${layout.count} ch · ${layout.kind}`;

    const stereoWrap = document.getElementById('stereo-image-meters');
    if (stereoWrap) {
        stereoWrap.innerHTML = layout.labels.map((label, i) => `
            <div class="stereo-image-col">
                <div class="stereo-image-track">
                    <div id="stereo-fill-${i}" class="stereo-image-fill"></div>
                </div>
                <span class="stereo-image-label">${label}</span>
            </div>
        `).join('');
    }

    const loudnessWrap = document.getElementById('loudness-meter');
    if (loudnessWrap) {
        loudnessWrap.innerHTML = layout.labels.map((label, i) => `
            <div class="loudness-channel">
                <span class="loudness-ch-label">${label}</span>
                <div class="loudness-bar-track">
                    <div id="loudness-bar-${i}" class="loudness-bar-fill"></div>
                    <div id="loudness-peak-${i}" class="loudness-peak"></div>
                </div>
            </div>
        `).join('');
    }

    const panRow = document.getElementById('stereo-panner-row');
    const panSlider = document.getElementById('stereo-panner-slider');
    const canPan = layout.kind === 'stereo' || layout.kind === 'binaural';
    if (panRow) panRow.classList.toggle('hidden', !canPan || !!window.isAmbisonicMode);
    if (panSlider) panSlider.disabled = !canPan || !!window.isAmbisonicMode;

    window.loudnessPeaks = new Array(layout.count).fill(0);
    window.currentChannelLayout = layout;
    window.renderSpectrogramAxes();
};

window.freqToColor = function(value) {
    const v = Math.max(0, Math.min(1, value));
    if (v < 0.25) {
        const t = v / 0.25;
        return [0, Math.round(40 + t * 80), Math.round(80 + t * 100)];
    }
    if (v < 0.5) {
        const t = (v - 0.25) / 0.25;
        return [0, Math.round(120 + t * 100), Math.round(180 - t * 40)];
    }
    if (v < 0.75) {
        const t = (v - 0.5) / 0.25;
        return [Math.round(t * 240), Math.round(220 - t * 40), Math.round(40 - t * 40)];
    }
    const t = (v - 0.75) / 0.25;
    return [Math.round(240 + t * 15), Math.round(180 + t * 75), Math.round(t * 255)];
};

window.drawSpectrogramFrame = function() {
    const canvas = document.getElementById('spectrogram-canvas');
    if (!canvas || !window.analyserNode) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const binCount = window.analyserNode.frequencyBinCount;
    const data = new Uint8Array(binCount);
    window.analyserNode.getByteFrequencyData(data);

    const imageData = ctx.getImageData(1, 0, w - 1, h);
    ctx.putImageData(imageData, 0, 0);

    const usefulBins = Math.floor(binCount * 0.55);
    for (let y = 0; y < h; y++) {
        const ratio = 1 - y / h;
        const bin = Math.min(usefulBins - 1, Math.floor(Math.pow(ratio, 1.4) * usefulBins));
        const mag = data[bin] / 255;
        const [r, g, b] = window.freqToColor(mag);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(w - 1, y, 1, 1);
    }
};

window.drawChannelMetersFrame = function() {
    const analysers = window.channelAnalysers || [];
    const layout = window.currentChannelLayout || window.getCurrentChannelLayout();
    if (!analysers.length) return;

    if (!window.loudnessPeaks || window.loudnessPeaks.length !== analysers.length) {
        window.loudnessPeaks = new Array(analysers.length).fill(0);
    }

    let dbMax = -Infinity;

    analysers.forEach((analyser, i) => {
        const rms = window.rmsFromAnalyser(analyser);
        const db = window.dbFromRms(rms);
        const pct = window.dbToMeterPercent(db);
        if (isFinite(db) && db > dbMax) dbMax = db;

        window.loudnessPeaks[i] = Math.max((window.loudnessPeaks[i] || 0) * 0.985, pct);

        const stereoFill = document.getElementById(`stereo-fill-${i}`);
        const bar = document.getElementById(`loudness-bar-${i}`);
        const peak = document.getElementById(`loudness-peak-${i}`);
        if (stereoFill) stereoFill.style.height = `${pct}%`;
        if (bar) bar.style.width = `${pct}%`;
        if (peak) peak.style.left = `calc(${window.loudnessPeaks[i]}% - 1px)`;
    });

    const label = document.getElementById('loudness-db-label');
    if (label) {
        label.textContent = !isFinite(dbMax) || dbMax <= -90
            ? '−∞ dB'
            : `${dbMax.toFixed(1)} dB · ${layout.count} ch`;
    }
};

window.startAnalyzerLoop = function() {
    if (window.analyzerFrameId) cancelAnimationFrame(window.analyzerFrameId);

    window.buildAnalyzerMetersUI();

    const canvas = document.getElementById('spectrogram-canvas');
    if (canvas) {
        const wrap = canvas.parentElement;
        const cssW = wrap ? wrap.clientWidth : 300;
        const cssH = wrap ? wrap.clientHeight : 112;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(200, Math.floor(cssW * dpr));
        canvas.height = Math.max(80, Math.floor(cssH * dpr));
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    const tick = () => {
        if (!window.analyzersOpen) return;
        window.drawSpectrogramFrame();
        window.drawChannelMetersFrame();
        window.analyzerFrameId = requestAnimationFrame(tick);
    };
    window.analyzerFrameId = requestAnimationFrame(tick);
};

window.stopAnalyzerLoop = function() {
    if (window.analyzerFrameId) {
        cancelAnimationFrame(window.analyzerFrameId);
        window.analyzerFrameId = null;
    }
};

window.collapsePlayerAnalyzers = function() {
    window.analyzersOpen = false;
    window.stopAnalyzerLoop();

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

        window.startAnalyzerLoop();
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
