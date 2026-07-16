// Audio Guessr — мини-игра «угадай место по звуку» (аналог GeoGuessr).
(function initAudioGuessr() {
    const R_EARTH_KM = 6371;

    window.haversineKm = function(a, b) {
        const toRad = (d) => d * Math.PI / 180;
        const dLat = toRad(b[0] - a[0]);
        const dLng = toRad(b[1] - a[1]);
        const lat1 = toRad(a[0]);
        const lat2 = toRad(b[0]);
        const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
        return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
    };

    window.guessrScoreFromKm = function(km) {
        if (!Number.isFinite(km)) return 0;
        // ~5000 за точное попадание, ~0 после ~300 км
        return Math.max(0, Math.round(5000 * Math.exp(-km / 80)));
    };

    window.__guessr = {
        map: null,
        placemark: null,
        truthMark: null,
        line: null,
        sound: null,
        guess: null,
        totalScore: 0,
        round: 0,
        audio: null
    };

    window.getGuessrPool = function() {
        return (window.soundsData || []).filter(s =>
            (!s.status || s.status === 'published')
            && Number.isFinite(s.lat) && Number.isFinite(s.lng)
        );
    };

    window.openAudioGuessr = function() {
        const pool = window.getGuessrPool();
        if (pool.length < 1) {
            window.showToast('Недостаточно точек на карте для игры');
            return;
        }
        window.__guessr.totalScore = 0;
        window.__guessr.round = 0;
        const m = document.getElementById('guessr-modal');
        const c = document.getElementById('guessr-modal-content');
        if (!m || !c) return;
        m.classList.remove('hidden');
        void m.offsetWidth;
        m.classList.remove('opacity-0', 'pointer-events-none');
        c.classList.remove('scale-95');
        setTimeout(() => {
            window.initGuessrMap();
            window.startGuessrRound();
        }, 220);
    };

    window.closeAudioGuessr = function() {
        window.stopGuessrAudio();
        if (window.__guessr.map) {
            try { window.__guessr.map.destroy(); } catch (_) {}
            window.__guessr.map = null;
        }
        window.__guessr.placemark = null;
        window.__guessr.truthMark = null;
        window.__guessr.line = null;
        window.__guessr.sound = null;
        window.__guessr.guess = null;
        const m = document.getElementById('guessr-modal');
        const c = document.getElementById('guessr-modal-content');
        if (!m || !c) return;
        m.classList.add('opacity-0', 'pointer-events-none');
        c.classList.add('scale-95');
        setTimeout(() => { if (m.classList.contains('opacity-0')) m.classList.add('hidden'); }, 300);
    };

    window.initGuessrMap = function() {
        if (typeof ymaps === 'undefined') {
            window.showToast('Карта недоступна');
            return;
        }
        const el = document.getElementById('guessr-map');
        if (!el) return;
        ymaps.ready(() => {
            if (window.__guessr.map) {
                try { window.__guessr.map.destroy(); } catch (_) {}
                window.__guessr.map = null;
            }
            el.innerHTML = '';
            window.__guessr.map = new ymaps.Map('guessr-map', {
                center: [47.23371, 39.74427],
                zoom: 8,
                controls: ['zoomControl']
            });
            window.__guessr.map.events.add('click', (e) => {
                if (window.__guessr.revealed) return;
                const coords = e.get('coords');
                window.__guessr.guess = coords;
                if (window.__guessr.placemark) {
                    window.__guessr.placemark.geometry.setCoordinates(coords);
                } else {
                    window.__guessr.placemark = new ymaps.Placemark(coords, {}, { preset: 'islands#blueCircleDotIcon' });
                    window.__guessr.map.geoObjects.add(window.__guessr.placemark);
                }
                const btn = document.getElementById('guessr-submit');
                if (btn) btn.disabled = false;
            });
        });
    };

    window.stopGuessrAudio = function() {
        const a = window.__guessr.audio;
        if (a) {
            try { a.pause(); a.removeAttribute('src'); } catch (_) {}
        }
        window.__guessr.audio = null;
        const playBtn = document.getElementById('guessr-play');
        if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-play mr-1"></i>Слушать';
    };

    window.toggleGuessrAudio = function() {
        const sound = window.__guessr.sound;
        if (!sound) return;
        if (!window.__guessr.audio) {
            const a = new Audio();
            a.crossOrigin = 'anonymous';
            if (sound.url) a.src = sound.url;
            else {
                window.showToast('У этой точки нет файла — режим симуляции 15 сек');
                // короткий тихий буфер не обязателен — просто таймер UI
            }
            window.__guessr.audio = a;
            a.onended = () => {
                const playBtn = document.getElementById('guessr-play');
                if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-play mr-1"></i>Слушать';
            };
        }
        const a = window.__guessr.audio;
        const playBtn = document.getElementById('guessr-play');
        if (!sound.url) {
            window.showToast('Симуляция: представьте звук локации');
            return;
        }
        if (a.paused) {
            a.play().catch(() => window.showToast('Не удалось воспроизвести'));
            if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-pause mr-1"></i>Пауза';
        } else {
            a.pause();
            if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-play mr-1"></i>Слушать';
        }
    };

    window.startGuessrRound = function() {
        const pool = window.getGuessrPool();
        if (!pool.length) return;
        window.stopGuessrAudio();
        window.__guessr.revealed = false;
        window.__guessr.guess = null;
        window.__guessr.round += 1;
        window.__guessr.sound = pool[Math.floor(Math.random() * pool.length)];

        if (window.__guessr.map) {
            window.__guessr.map.geoObjects.removeAll();
            window.__guessr.placemark = null;
            window.__guessr.truthMark = null;
            window.__guessr.line = null;
            window.__guessr.map.setCenter([47.23371, 39.74427], 8);
        }

        const roundEl = document.getElementById('guessr-round');
        const scoreEl = document.getElementById('guessr-score');
        const resultEl = document.getElementById('guessr-result');
        const submitBtn = document.getElementById('guessr-submit');
        const nextBtn = document.getElementById('guessr-next');
        if (roundEl) roundEl.textContent = `Раунд ${window.__guessr.round}`;
        if (scoreEl) scoreEl.textContent = `Очки: ${window.__guessr.totalScore}`;
        if (resultEl) { resultEl.classList.add('hidden'); resultEl.textContent = ''; }
        if (submitBtn) { submitBtn.disabled = true; submitBtn.classList.remove('hidden'); }
        if (nextBtn) nextBtn.classList.add('hidden');
        const hint = document.getElementById('guessr-hint');
        if (hint) hint.textContent = 'Слушайте запись и отметьте место на карте';
    };

    window.submitGuessrGuess = function() {
        const sound = window.__guessr.sound;
        const guess = window.__guessr.guess;
        if (!sound || !guess || !window.__guessr.map) return;
        window.__guessr.revealed = true;
        window.stopGuessrAudio();

        const truth = [sound.lat, sound.lng];
        const km = window.haversineKm(guess, truth);
        const pts = window.guessrScoreFromKm(km);
        window.__guessr.totalScore += pts;

        window.__guessr.truthMark = new ymaps.Placemark(truth, {}, { preset: 'islands#redCircleDotIcon' });
        window.__guessr.map.geoObjects.add(window.__guessr.truthMark);
        window.__guessr.line = new ymaps.Polyline([guess, truth], {}, {
            strokeColor: '#ef4444', strokeWidth: 3, strokeOpacity: 0.85, strokeStyle: 'shortdash'
        });
        window.__guessr.map.geoObjects.add(window.__guessr.line);
        try {
            window.__guessr.map.setBounds(window.__guessr.line.geometry.getBounds(), { checkZoomRange: true, zoomMargin: 40 });
        } catch (_) {}

        const resultEl = document.getElementById('guessr-result');
        if (resultEl) {
            resultEl.classList.remove('hidden');
            resultEl.innerHTML = `<strong>+${pts}</strong> · ошибка ${km < 1 ? Math.round(km * 1000) + ' м' : km.toFixed(1) + ' км'} · «${sound.title || 'Звук'}»`;
        }
        const scoreEl = document.getElementById('guessr-score');
        if (scoreEl) scoreEl.textContent = `Очки: ${window.__guessr.totalScore}`;
        const submitBtn = document.getElementById('guessr-submit');
        const nextBtn = document.getElementById('guessr-next');
        if (submitBtn) submitBtn.classList.add('hidden');
        if (nextBtn) nextBtn.classList.remove('hidden');
        const hint = document.getElementById('guessr-hint');
        if (hint) hint.textContent = 'Красная точка — настоящее место записи';
    };
})();
