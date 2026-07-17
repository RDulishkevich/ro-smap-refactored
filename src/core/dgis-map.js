/** 2GIS MapGL — immersive 3D / globe map engine. */

const DGIS_JS_URL = 'https://mapgl.2gis.com/api/js/v1';

window.getDgisApiKey = function() {
    try {
        return (localStorage.getItem('rosmap_dgis_key') || window.DGIS_API_KEY || '').trim();
    } catch (_) {
        return String(window.DGIS_API_KEY || '').trim();
    }
};

window.saveDgisApiKey = function(key) {
    const next = String(key || '').trim();
    try {
        if (next) localStorage.setItem('rosmap_dgis_key', next);
        else localStorage.removeItem('rosmap_dgis_key');
    } catch (_) {}
    window.DGIS_API_KEY = next;
    if (window.refreshSettingsUI) window.refreshSettingsUI();
    if (window.currentMapProvider === 'dgis') {
        if (next) window.remountMainMap();
        else if (window.showToast) window.showToast('Укажите ключ 2GIS MapGL');
    }
};

window.loadDgisMapGL = function() {
    if (window.__dgisLoading) return window.__dgisLoading;
    if (window.mapgl) return Promise.resolve(window.mapgl);

    window.__dgisLoading = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-dgis-js]');
        if (existing) {
            existing.addEventListener('load', () => {
                if (window.mapgl) resolve(window.mapgl);
                else reject(new Error('2GIS MapGL failed to load'));
            });
            existing.addEventListener('error', () => reject(new Error('2GIS MapGL script error')));
            return;
        }
        const script = document.createElement('script');
        script.src = DGIS_JS_URL;
        script.async = true;
        script.setAttribute('data-dgis-js', '1');
        script.onload = () => {
            if (window.mapgl) resolve(window.mapgl);
            else reject(new Error('2GIS MapGL failed to load'));
        };
        script.onerror = () => reject(new Error('2GIS MapGL script error'));
        document.head.appendChild(script);
    }).finally(() => { window.__dgisLoading = null; });

    return window.__dgisLoading;
};

window.createDgisMarkerElement = function(sound, colorClass, isSelected) {
    if (window.createMapboxMarkerElement) {
        return window.createMapboxMarkerElement(sound, colorClass, isSelected);
    }
    const el = document.createElement('div');
    el.id = `marker-${sound.id}`;
    el.className = `w-6 h-6 md:w-7 md:h-7 custom-marker ${colorClass} ${isSelected ? 'selected' : ''} flex items-center justify-center text-white shadow-lg`;
    return el;
};

window.destroyDgisMap = function() {
    window.clearDgisRoutes();
    if (window.dgisMarkerCache) {
        window.dgisMarkerCache.forEach((marker) => {
            try { marker.destroy(); } catch (_) {}
        });
        window.dgisMarkerCache.clear();
    }
    if (window.dgisMap) {
        try { window.dgisMap.destroy(); } catch (_) {}
        window.dgisMap = null;
    }
};

window.clearDgisRoutes = function() {
    if (window.dgisRoutePolyline) {
        try { window.dgisRoutePolyline.destroy(); } catch (_) {}
        window.dgisRoutePolyline = null;
    }
    if (window.dgisWalkerMarker) {
        try { window.dgisWalkerMarker.destroy(); } catch (_) {}
        window.dgisWalkerMarker = null;
    }
    if (window.activePolyline && window.activePolyline.__dgis) window.activePolyline = null;
    if (window.walkerMarker && window.walkerMarker.__dgis) window.walkerMarker = null;
};

window.updateDgisMarkers = function() {
    if (!window.dgisMap || !window.mapgl) return;
    const filtered = window.getFilteredSounds ? window.getFilteredSounds() : window.soundsData || [];
    const currentActiveId = window.currentPlayingId;
    if (currentActiveId && !filtered.some((s) => s.id === currentActiveId)) {
        window.currentPlayingId = null;
    }
    const activeId = window.currentPlayingId;
    window.dgisMarkerCache = window.dgisMarkerCache || new Map();
    const visibleIds = new Set(filtered.map((s) => s.id));

    window.dgisMarkerCache.forEach((marker, id) => {
        if (!visibleIds.has(id)) {
            try { marker.destroy(); } catch (_) {}
            window.dgisMarkerCache.delete(id);
        }
    });

    document.querySelectorAll('.custom-marker.selected').forEach((el) => el.classList.remove('selected'));

    filtered.forEach((sound) => {
        const colorClass = sound.ecoCategory === 'geophony'
            ? 'marker-geo'
            : sound.ecoCategory === 'biophony'
                ? 'marker-bio'
                : 'marker-anthro';
        const isSelected = activeId === sound.id;
        let marker = window.dgisMarkerCache.get(sound.id);
        if (!marker) {
            const el = window.createDgisMarkerElement(sound, colorClass, isSelected);
            marker = new window.mapgl.HtmlMarker(window.dgisMap, {
                coordinates: [sound.lng, sound.lat],
                html: el,
                anchor: [16, 16]
            });
            window.dgisMarkerCache.set(sound.id, marker);
        } else {
            try { marker.setCoordinates([sound.lng, sound.lat]); } catch (_) {}
            const el = marker.getContent && marker.getContent();
            const node = el instanceof HTMLElement ? el : (typeof marker.getHtml === 'function' ? null : null);
            const dom = document.getElementById(`marker-${sound.id}`);
            if (dom) {
                dom.classList.toggle('selected', !!isSelected);
                dom.classList.remove('marker-geo', 'marker-bio', 'marker-anthro');
                dom.classList.add(colorClass);
            }
        }
    });
};

window.dgisSetView = function(lat, lng, zoom = 15) {
    if (!window.dgisMap) return;
    try {
        window.dgisMap.setCenter([lng, lat]);
        window.dgisMap.setZoom(zoom);
        if (typeof window.dgisMap.setPitch === 'function') {
            window.dgisMap.setPitch(Math.max(window.dgisMap.getPitch?.() || 0, 45));
        }
    } catch (_) {}
};

window.dgisAddRouteOverlay = function(route, colorClass) {
    window.clearDgisRoutes();
    if (!window.dgisMap || !window.mapgl || !route || route.length < 2) return;
    const coords = route.map((pt) => [pt[1], pt[0]]);
    try {
        window.dgisRoutePolyline = new window.mapgl.Polyline(window.dgisMap, {
            coordinates: coords,
            width: 4,
            color: '#38bdf8'
        });
        const el = document.createElement('div');
        el.className = `walker-marker ${colorClass || ''}`.trim();
        el.innerHTML = '<i class="fa-solid fa-person-walking"></i>';
        window.dgisWalkerMarker = new window.mapgl.HtmlMarker(window.dgisMap, {
            coordinates: coords[0],
            html: el,
            anchor: [14, 14]
        });
        window.activePolyline = { __dgis: true };
        window.walkerMarker = {
            __dgis: true,
            geometry: {
                setCoordinates(latLng) {
                    if (window.dgisWalkerMarker) {
                        try { window.dgisWalkerMarker.setCoordinates([latLng[1], latLng[0]]); } catch (_) {}
                    }
                }
            }
        };
        const lats = route.map((p) => p[0]);
        const lngs = route.map((p) => p[1]);
        window.dgisMap.fitBounds(
            [
                [Math.min(...lngs), Math.min(...lats)],
                [Math.max(...lngs), Math.max(...lats)]
            ],
            { padding: 48, animation: { duration: 800 } }
        );
    } catch (err) {
        console.warn('2GIS route overlay failed', err);
    }
};

window.initDgisMap = async function() {
    const key = window.getDgisApiKey();
    const container = document.getElementById('map');
    if (!container) return;

    if (!key) {
        container.innerHTML = '';
        container.classList.add('is-map-provider-placeholder');
        container.innerHTML = `<div class="map-provider-placeholder">
            <i class="fa-solid fa-key text-2xl mb-3 opacity-50"></i>
            <p class="font-bold">Нужен ключ 2GIS MapGL</p>
            <p class="text-sm opacity-80 mt-1">Вставьте API-ключ в настройках → Движок карты.</p>
            <p class="text-[11px] opacity-60 mt-2">Ключ: <a class="underline" href="https://platform.2gis.ru/" target="_blank" rel="noopener">platform.2gis.ru</a></p>
        </div>`;
        window.__mainMapReady = false;
        return;
    }

    try {
        await window.loadDgisMapGL();
    } catch (err) {
        console.warn(err);
        if (window.showToast) window.showToast('Не удалось загрузить 2GIS MapGL');
        return;
    }

    container.innerHTML = '';
    container.classList.remove('is-mapbox', 'map-monochrome', 'is-map-provider-placeholder');
    container.classList.add('is-dgis');

    window.dgisMap = new window.mapgl.Map('map', {
        center: [39.74427, 47.23371],
        zoom: 15,
        key,
        pitch: 52,
        rotation: -18,
        graphicsPreset: 'immersive',
        styleState: { globeEnabled: true }
    });

    window.map = {
        __provider: 'dgis',
        setCenter(coords, zoom) {
            window.dgisSetView(coords[0], coords[1], zoom);
        },
        getZoom() {
            try { return window.dgisMap.getZoom(); } catch (_) { return 15; }
        },
        container: {
            getElement() { return document.getElementById('map'); }
        },
        geoObjects: { add() {}, remove() {} }
    };

    window.dgisMap.on('click', () => {
        if (window.hideMarkerHoverCard) window.hideMarkerHoverCard(true);
    });

    // ПКМ / долгое нажатие через контейнер (MapGL contextmenu)
    const mapEl = document.getElementById('map');
    if (mapEl && !mapEl.__dgisCtxBound) {
        mapEl.__dgisCtxBound = true;
        mapEl.addEventListener('contextmenu', (e) => {
            if (!window.dgisMap || window.currentMapProvider !== 'dgis') return;
            e.preventDefault();
            try {
                const rect = mapEl.getBoundingClientRect();
                const point = window.dgisMap.unproject?.([e.clientX - rect.left, e.clientY - rect.top]);
                if (point && Array.isArray(point) && point.length >= 2) {
                    window.showMapContextMenu([point[1], point[0]], {
                        clientX: e.clientX,
                        clientY: e.clientY
                    });
                }
            } catch (_) {}
        });
    }

    const ready = () => {
        if (window.updateMapMarkers) window.updateMapMarkers();
        window.__mainMapReady = true;
    };
    try {
        window.dgisMap.on('idle', ready);
    } catch (_) {}
    setTimeout(ready, 400);
};
