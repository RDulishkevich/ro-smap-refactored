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

// --- Ambisonics ---
window.initOmnitone = async function() {
    if (window.omnitoneInitialized) return true;
    try {
        window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        window.foaDecoder = Omnitone.createFOARenderer(window.audioContext, {
            hrirPathUrl: 'https://cdn.jsdelivr.net/npm/omnitone@1.3.0/build/resources/'
        });
        await window.foaDecoder.initialize();
                
        if (window.audioElement) {
            window.audioElement.crossOrigin = "anonymous";
            if (!window.audioElementSource) {
                window.audioElementSource = window.audioContext.createMediaElementSource(window.audioElement);
            }
        }
                
        window.gainNode = window.audioContext.createGain();
        if (window.audioElementSource) window.audioElementSource.connect(window.gainNode);
        window.gainNode.connect(window.audioContext.destination);

        window.omnitoneInitialized = true;
        return true;
    } catch (err) {
        console.error("Omnitone error:", err);
        return false;
    }
}

window.routeAmbisonics = function() {
    if (!window.audioContext || !window.foaDecoder || !window.audioElementSource) return;
    try { window.audioElementSource.disconnect(); } catch(e){}
    try { window.gainNode.disconnect(); } catch(e){}
    window.audioElementSource.connect(window.foaDecoder.input);
    window.foaDecoder.output.connect(window.audioContext.destination);
    window.foaDecoder.setRenderingMode('ambisonic');
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
}

window.disableAmbisonicMode = function() {
    if (!window.audioContext || !window.foaDecoder || !window.audioElementSource) return;
    try { window.audioElementSource.disconnect(); } catch(e){}
    try { window.foaDecoder.output.disconnect(); } catch(e){}
    window.audioElementSource.connect(window.gainNode);
    window.gainNode.connect(window.audioContext.destination);
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
}

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

    if (card) card.classList.add('translate-y-[150%]', 'opacity-0');
    document.body.classList.remove('player-visible');

    const ambiControl = document.getElementById('ambisonics-control');
    if (ambiControl) ambiControl.classList.add('hidden');

    window.currentPlayingId = null;
    window.clearMapRoutes();
    window.updateMapMarkers();
    if (window.updateUIState) window.updateUIState();
    window.renderList();
}