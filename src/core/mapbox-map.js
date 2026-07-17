const MAPBOX_GL_VERSION = '3.9.4';
const MAPBOX_CSS_URL = `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl.css`;
const MAPBOX_JS_URL = `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl.js`;
const ROUTE_SOURCE_ID = 'rosmap-route';
const ROUTE_LAYER_ID = 'rosmap-route-line';

window.loadMapboxGL = function() {
    if (window.__mapboxGlLoading) return window.__mapboxGlLoading;
    if (window.mapboxgl) return Promise.resolve(window.mapboxgl);

    window.__mapboxGlLoading = new Promise((resolve, reject) => {
        if (!document.querySelector('link[data-mapbox-css]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = MAPBOX_CSS_URL;
            link.setAttribute('data-mapbox-css', '1');
            document.head.appendChild(link);
        }

        const existing = document.querySelector('script[data-mapbox-js]');
        if (existing) {
            existing.addEventListener('load', () => {
                if (window.mapboxgl) resolve(window.mapboxgl);
                else reject(new Error('Mapbox GL failed to load'));
            });
            existing.addEventListener('error', () => reject(new Error('Mapbox GL script error')));
            return;
        }

        const script = document.createElement('script');
        script.src = MAPBOX_JS_URL;
        script.async = true;
        script.setAttribute('data-mapbox-js', '1');
        script.onload = () => {
            if (window.mapboxgl) resolve(window.mapboxgl);
            else reject(new Error('Mapbox GL failed to load'));
        };
        script.onerror = () => reject(new Error('Mapbox GL script error'));
        document.head.appendChild(script);
    }).finally(() => {
        window.__mapboxGlLoading = null;
    });

    return window.__mapboxGlLoading;
};

window.getMapboxToken = function() {
    try {
        const saved = localStorage.getItem('rosmap_mapbox_token');
        if (saved && saved.trim()) return saved.trim();
    } catch (_) {}
    const fallback = String(window.MAPBOX_ACCESS_TOKEN || '').trim();
    if (fallback && !/ваш_|YOUR_|your_/i.test(fallback)) return fallback;
    return '';
};

window.hasValidMapboxToken = function() {
    const token = window.getMapboxToken();
    return Boolean(token && token.startsWith('pk.'));
};

window.saveMapboxToken = function(rawToken) {
    const token = String(rawToken || '').trim();
    try {
        if (token) localStorage.setItem('rosmap_mapbox_token', token);
        else localStorage.removeItem('rosmap_mapbox_token');
    } catch (_) {}
    const input = document.getElementById('mapbox-token-input');
    if (input && input.value !== token) input.value = token;
    if (window.showToast) {
        window.showToast(token ? 'Токен Mapbox сохранён' : 'Токен Mapbox очищен');
    }
    if (window.currentMapProvider === 'mapbox') {
        if (window.hasValidMapboxToken()) window.remountMainMap?.();
        else if (window.showToast) window.showToast('Укажите действительный Mapbox Access Token (pk.…)');
    }
};

window.toLngLat = function(latLng) {
    if (!latLng || latLng.length < 2) return null;
    return [Number(latLng[1]), Number(latLng[0])];
};

window.routeToLngLat = function(route) {
    if (!Array.isArray(route)) return [];
    return route.map((pt) => window.toLngLat(pt)).filter(Boolean);
};

window.applyMapboxBasemapConfig = function() {
    const map = window.mapboxMap;
    if (!map || typeof map.setConfigProperty !== 'function') return;
    const isMono = window.currentMapStyle === 'monochrome';
    const isDark = window.currentTheme === 'dark';
    try {
        map.setConfigProperty('basemap', 'theme', isMono ? 'monochrome' : 'default');
        map.setConfigProperty('basemap', 'lightPreset', isDark ? 'night' : 'day');
        map.setConfigProperty('basemap', 'show3dObjects', true);
    } catch (_) {}
};

window.createMapboxMarkerElement = function(sound, colorClass, isSelected) {
    const isSoundwalk = sound.recPrinciple && sound.recPrinciple.includes('Soundwalk');
    const isAmbisonic = sound.channels && String(sound.channels).toLowerCase().includes('ambisonics');
    const el = document.createElement('div');
    el.id = `marker-${sound.id}`;
    el.className = `w-6 h-6 md:w-7 md:h-7 custom-marker ${colorClass} ${isSelected ? 'selected' : ''} flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110`;
    if (isSoundwalk) el.innerHTML = '<i class="fa-solid fa-route text-[11px] md:text-[13px] opacity-90"></i>';
    else if (isAmbisonic) el.innerHTML = '<i class="fa-solid fa-cube text-[10px] md:text-[12px] opacity-90"></i>';
    el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.hideMarkerHoverCard) window.hideMarkerHoverCard(true);
        if (window.selectSound) window.selectSound(sound.id);
    });
    el.addEventListener('mouseenter', () => {
        if (window.showMarkerHoverCard) window.showMarkerHoverCard(sound);
    });
    el.addEventListener('mouseleave', () => {
        if (window.hideMarkerHoverCard) window.hideMarkerHoverCard();
    });
    return el;
};

window.updateMapboxMarkers = function() {
    if (!window.mapboxMap || !window.mapboxgl) return;

    const filtered = window.getFilteredSounds ? window.getFilteredSounds() : window.soundsData || [];
    const currentActiveId = window.currentPlayingId;
    if (currentActiveId && !filtered.some((sound) => sound.id === currentActiveId)) {
        window.currentPlayingId = null;
    }

    window.mapboxMarkerCache = window.mapboxMarkerCache || new Map();
    const visibleIds = new Set(filtered.map((sound) => sound.id));

    window.mapboxMarkerCache.forEach((marker, id) => {
        if (!visibleIds.has(id)) {
            marker.remove();
            window.mapboxMarkerCache.delete(id);
            if (window.__markerHoverSoundId === id && window.hideMarkerHoverCard) {
                window.hideMarkerHoverCard(true);
            }
        }
    });

    filtered.forEach((sound) => {
        const colorClass = sound.ecoCategory === 'geophony'
            ? 'marker-geo'
            : sound.ecoCategory === 'biophony'
                ? 'marker-bio'
                : 'marker-anthro';
        const isSelected = window.currentPlayingId === sound.id;
        const lngLat = window.toLngLat([sound.lat, sound.lng]);
        if (!lngLat) return;

        let marker = window.mapboxMarkerCache.get(sound.id);
        if (!marker) {
            const el = window.createMapboxMarkerElement(sound, colorClass, isSelected);
            marker = new window.mapboxgl.Marker({ element: el, anchor: 'center' })
                .setLngLat(lngLat)
                .addTo(window.mapboxMap);
            window.mapboxMarkerCache.set(sound.id, marker);
        } else {
            marker.setLngLat(lngLat);
            const el = marker.getElement();
            if (el) {
                el.className = `w-6 h-6 md:w-7 md:h-7 custom-marker ${colorClass} ${isSelected ? 'selected' : ''} flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110`;
                const isSoundwalk = sound.recPrinciple && sound.recPrinciple.includes('Soundwalk');
                const isAmbisonic = sound.channels && String(sound.channels).toLowerCase().includes('ambisonics');
                if (isSoundwalk) el.innerHTML = '<i class="fa-solid fa-route text-[11px] md:text-[13px] opacity-90"></i>';
                else if (isAmbisonic) el.innerHTML = '<i class="fa-solid fa-cube text-[10px] md:text-[12px] opacity-90"></i>';
                else el.innerHTML = '';
            }
            if (window.__markerHoverSoundId === sound.id) {
                window.__markerHoverCoords = [sound.lat, sound.lng];
                if (window.positionMarkerHoverCard) window.positionMarkerHoverCard();
            }
        }
    });
};

window.clearMapboxRoutes = function() {
    if (window.walkerMapboxMarker) {
        window.walkerMapboxMarker.remove();
        window.walkerMapboxMarker = null;
    }
    window.walkerMarker = null;
    window.activePolyline = null;

    const map = window.mapboxMap;
    if (!map) return;
    try {
        if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
        if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
    } catch (_) {}
};

window.mapboxAddRouteOverlay = function(route, colorClass) {
    window.clearMapboxRoutes();
    if (!window.mapboxMap || !window.mapboxgl || !route || route.length < 2) return;

    const coords = window.routeToLngLat(route);
    if (coords.length < 2) return;

    const ensureRoute = () => {
        if (!window.mapboxMap.getSource(ROUTE_SOURCE_ID)) {
            window.mapboxMap.addSource(ROUTE_SOURCE_ID, {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'LineString', coordinates: coords }
                }
            });
            window.mapboxMap.addLayer({
                id: ROUTE_LAYER_ID,
                type: 'line',
                source: ROUTE_SOURCE_ID,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': '#38bdf8',
                    'line-width': 4,
                    'line-opacity': 0.85,
                    'line-dasharray': [1.5, 1.2]
                }
            });
        } else {
            window.mapboxMap.getSource(ROUTE_SOURCE_ID).setData({
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: coords }
            });
        }

        const bounds = new window.mapboxgl.LngLatBounds(coords[0], coords[0]);
        coords.forEach((c) => bounds.extend(c));
        window.mapboxMap.fitBounds(bounds, {
            padding: 48,
            duration: 800,
            pitch: Math.max(window.mapboxMap.getPitch(), 45),
            essential: true
        });

        const walkerEl = document.createElement('div');
        walkerEl.className = `walker-marker ${colorClass || ''}`.trim();
        walkerEl.innerHTML = '<i class="fa-solid fa-person-walking"></i>';
        window.walkerMapboxMarker = new window.mapboxgl.Marker({ element: walkerEl, anchor: 'center' })
            .setLngLat(coords[0])
            .addTo(window.mapboxMap);
        window.walkerMarker = {
            geometry: {
                setCoordinates(latLng) {
                    const ll = window.toLngLat(latLng);
                    if (ll && window.walkerMapboxMarker) window.walkerMapboxMarker.setLngLat(ll);
                }
            }
        };
        window.activePolyline = { __mapbox: true };
    };

    if (window.mapboxMap.isStyleLoaded()) ensureRoute();
    else window.mapboxMap.once('load', ensureRoute);
};

window.mapboxSetView = function(lat, lng, zoom = 15) {
    if (!window.mapboxMap) return;
    window.mapboxMap.flyTo({
        center: [lng, lat],
        zoom,
        duration: 800,
        pitch: Math.max(window.mapboxMap.getPitch(), 50),
        essential: true
    });
};

window.positionMapboxHoverCard = function() {
    const card = document.getElementById('marker-hover-card');
    if (!card || !window.mapboxMap || !window.__markerHoverCoords) return;
    try {
        const lngLat = window.toLngLat(window.__markerHoverCoords);
        if (!lngLat) return;
        const point = window.mapboxMap.project(lngLat);
        const container = window.mapboxMap.getContainer();
        const rect = container.getBoundingClientRect();
        const cardW = card.offsetWidth || 196;
        const cardH = card.offsetHeight || 170;
        const pad = 10;
        let left = rect.left + point.x - cardW / 2;
        let top = rect.top + point.y - cardH - 18;
        left = Math.max(pad, Math.min(left, (window.innerWidth || 0) - cardW - pad));
        if (top < pad) top = rect.top + point.y + 22;
        top = Math.max(pad, Math.min(top, (window.innerHeight || 0) - cardH - pad));
        card.style.left = `${Math.round(left)}px`;
        card.style.top = `${Math.round(top)}px`;
    } catch (_) {}
};

window.destroyMapboxMap = function() {
    window.clearMapboxRoutes();
    if (window.mapboxMarkerCache) {
        window.mapboxMarkerCache.forEach((marker) => {
            try { marker.remove(); } catch (_) {}
        });
        window.mapboxMarkerCache.clear();
    }
    if (window.mapboxMap) {
        try { window.mapboxMap.remove(); } catch (_) {}
        window.mapboxMap = null;
    }
};

window.initMapboxMap = async function() {
    if (!window.hasValidMapboxToken()) {
        if (window.showToast) {
            window.showToast('Для Mapbox 3D нужен Access Token (pk.…) — укажите в настройках');
        }
        window.renderMapboxTokenPlaceholder();
        return;
    }

    try {
        await window.loadMapboxGL();
    } catch (err) {
        console.warn(err);
        if (window.showToast) window.showToast('Не удалось загрузить Mapbox GL JS');
        return;
    }

    const container = document.getElementById('map');
    if (!container || !window.mapboxgl) return;

    container.innerHTML = '';
    container.classList.add('is-mapbox');
    container.classList.remove('map-monochrome');

    window.mapboxgl.accessToken = window.getMapboxToken();
    const isMono = window.currentMapStyle === 'monochrome';
    const isDark = window.currentTheme === 'dark';

    window.mapboxMap = new window.mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/standard',
        center: [39.74427, 47.23371],
        zoom: 15,
        pitch: 58,
        bearing: -18,
        antialias: true,
        attributionControl: true,
        config: {
            basemap: {
                show3dObjects: true,
                lightPreset: isDark ? 'night' : 'day',
                theme: isMono ? 'monochrome' : 'default'
            }
        }
    });

    window.mapboxMap.addControl(
        new window.mapboxgl.NavigationControl({ visualizePitch: true }),
        'bottom-right'
    );

    window.map = {
        __provider: 'mapbox',
        setCenter(coords, zoom, opts) {
            const [lat, lng] = coords;
            window.mapboxMap.flyTo({
                center: [lng, lat],
                zoom: zoom ?? window.mapboxMap.getZoom(),
                duration: opts?.duration ?? 800,
                pitch: Math.max(window.mapboxMap.getPitch(), 50),
                essential: true
            });
        },
        getZoom() {
            return window.mapboxMap.getZoom();
        },
        container: {
            getElement() {
                return window.mapboxMap.getContainer();
            }
        },
        geoObjects: {
            add() {},
            remove() {}
        }
    };

    const onReady = () => {
        try {
            if (!window.mapboxMap.getSource('mapbox-dem')) {
                window.mapboxMap.addSource('mapbox-dem', {
                    type: 'raster-dem',
                    url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
                    tileSize: 512,
                    maxzoom: 14
                });
            }
            window.mapboxMap.setTerrain({ source: 'mapbox-dem', exaggeration: 1.15 });
        } catch (_) {}
        window.applyMapboxBasemapConfig();
        if (window.updateMapMarkers) window.updateMapMarkers();
        window.__mainMapReady = true;
    };

    if (window.mapboxMap.isStyleLoaded()) onReady();
    else window.mapboxMap.once('load', onReady);

    window.mapboxMap.on('contextmenu', (e) => {
        if (e.originalEvent && typeof e.originalEvent.preventDefault === 'function') {
            e.originalEvent.preventDefault();
        }
        window.showMapContextMenu(
            [e.lngLat.lat, e.lngLat.lng],
            {
                clientX: e.originalEvent?.clientX,
                clientY: e.originalEvent?.clientY,
                pageX: e.originalEvent?.pageX,
                pageY: e.originalEvent?.pageY
            }
        );
    });

    window.mapboxMap.on('click', () => {
        if (window.hideMapContextMenu) window.hideMapContextMenu();
        if (window.hideMarkerHoverCard) window.hideMarkerHoverCard(true);
    });
    window.mapboxMap.on('movestart', () => {
        if (window.hideMarkerHoverCard) window.hideMarkerHoverCard(true);
    });
    window.mapboxMap.on('move', () => {
        if (window.__markerHoverSoundId && window.positionMarkerHoverCard) {
            window.positionMarkerHoverCard();
        }
    });

    if (window.initMapLongPress) {
        const el = document.getElementById('map');
        if (el) el.__longPressBound = false;
        window.initMapLongPress();
    }
};

window.renderMapboxTokenPlaceholder = function() {
    const container = document.getElementById('map');
    if (!container) return;
    container.classList.add('is-mapbox');
    container.innerHTML = `
        <div class="mapbox-token-placeholder">
            <div class="mapbox-token-placeholder__card">
                <i class="fa-solid fa-cube mapbox-token-placeholder__icon"></i>
                <h3>Mapbox 3D</h3>
                <p>Вставьте публичный Access Token (начинается с <code>pk.</code>) в настройках, чтобы включить карту Standard с 3D-зданиями и рельефом.</p>
                <button type="button" class="mapbox-token-placeholder__btn" onclick="window.openSettingsForMapbox?.()">Открыть настройки</button>
            </div>
        </div>`;
    window.map = { __provider: 'mapbox-placeholder' };
    window.__mainMapReady = true;
};

window.openSettingsForMapbox = function() {
    if (window.openSettingsPanel) window.openSettingsPanel();
    setTimeout(() => {
        const wrap = document.getElementById('mapbox-token-wrap');
        if (wrap) wrap.classList.remove('hidden');
        document.getElementById('mapbox-token-input')?.focus();
    }, 220);
};
