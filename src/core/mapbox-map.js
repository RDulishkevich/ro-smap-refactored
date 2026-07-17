const MAPLIBRE_CSS_URL = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
const MAPLIBRE_JS_URL = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
const ROUTE_SOURCE_ID = 'rosmap-route';
const ROUTE_LAYER_ID = 'rosmap-route-line';

/** Free OpenFreeMap styles — no API key / login required */
window.OPENFREEMAP_STYLES = {
    normal: 'https://tiles.openfreemap.org/styles/liberty',
    monochrome: 'https://tiles.openfreemap.org/styles/positron',
    dark: 'https://tiles.openfreemap.org/styles/dark'
};

/** Free MapLibre-based providers (no paid key). `mapbox` id is historical = OSM 3D. */
window.MAPLIBRE_PROVIDER_IDS = ['mapbox', 'ozon', 'carto', 'opentopo', 'esri'];

window.isMapLibreProvider = function(provider) {
    const id = window.normalizeMapProvider
        ? window.normalizeMapProvider(provider)
        : String(provider || '');
    return (window.MAPLIBRE_PROVIDER_IDS || []).includes(id);
};

window.buildRasterMapStyle = function(tiles, attribution) {
    const list = Array.isArray(tiles) ? tiles : [tiles];
    return {
        version: 8,
        name: 'rosmap-raster',
        sources: {
            'rosmap-raster': {
                type: 'raster',
                tiles: list,
                tileSize: 256,
                attribution: attribution || '© OpenStreetMap'
            }
        },
        layers: [{
            id: 'rosmap-raster-layer',
            type: 'raster',
            source: 'rosmap-raster',
            minzoom: 0,
            maxzoom: 22
        }]
    };
};

window.getMapLibreProviderConfig = function(provider) {
    const id = window.normalizeMapProvider
        ? window.normalizeMapProvider(provider || window.currentMapProvider)
        : (provider || window.currentMapProvider);
    const mono = window.currentMapStyle === 'monochrome';
    const dark = window.currentTheme === 'dark';

    if (id === 'mapbox') {
        return {
            id: 'mapbox',
            style: window.getOpenFreeMapStyleUrl(),
            pitch: 58,
            bearing: -18,
            buildings: true,
            minPitchForView: 50
        };
    }

    if (id === 'ozon') {
        // «Ozon Maps» = бесплатные OSM-тайлы (отдельного API Ozon нет).
        // Carto Voyager — стабильный бесплатный CDN на данных OSM.
        const tiles = mono
            ? [
                'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
            ]
            : dark
                ? [
                    'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                    'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                    'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
                ]
                : [
                    'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
                    'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
                    'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
                ];
        return {
            id: 'ozon',
            style: window.buildRasterMapStyle(tiles, '© OpenStreetMap © CARTO'),
            pitch: 0,
            bearing: 0,
            buildings: false,
            minPitchForView: 0
        };
    }

    if (id === 'carto') {
        const tiles = mono
            ? [
                'https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png',
                'https://b.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png',
                'https://c.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png'
            ]
            : dark
                ? [
                    'https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
                    'https://b.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
                    'https://c.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png'
                ]
                : [
                    'https://a.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}.png',
                    'https://b.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}.png',
                    'https://c.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}.png'
                ];
        return {
            id: 'carto',
            style: window.buildRasterMapStyle(tiles, '© OpenStreetMap © CARTO'),
            pitch: 0,
            bearing: 0,
            buildings: false,
            minPitchForView: 0
        };
    }

    if (id === 'opentopo') {
        return {
            id: 'opentopo',
            style: window.buildRasterMapStyle([
                'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
                'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
                'https://c.tile.opentopomap.org/{z}/{x}/{y}.png'
            ], '© OpenStreetMap © OpenTopoMap (CC-BY-SA)'),
            pitch: 42,
            bearing: -12,
            buildings: false,
            minPitchForView: 35
        };
    }

    if (id === 'esri') {
        // Esri World Imagery — бесплатные публичные тайлы (с атрибуцией).
        return {
            id: 'esri',
            style: window.buildRasterMapStyle(
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                'Tiles © Esri'
            ),
            pitch: 48,
            bearing: -10,
            buildings: false,
            minPitchForView: 40
        };
    }

    return {
        id: 'mapbox',
        style: window.getOpenFreeMapStyleUrl(),
        pitch: 58,
        bearing: -18,
        buildings: true,
        minPitchForView: 50
    };
};

window.getOpenFreeMapStyleUrl = function() {
    if (window.currentMapStyle === 'monochrome') return window.OPENFREEMAP_STYLES.monochrome;
    if (window.currentTheme === 'dark') return window.OPENFREEMAP_STYLES.dark;
    return window.OPENFREEMAP_STYLES.normal;
};

window.loadMapLibreGL = function() {
    if (window.__mapLibreLoading) return window.__mapLibreLoading;
    if (window.maplibregl) {
        window.mapboxgl = window.maplibregl;
        return Promise.resolve(window.maplibregl);
    }

    window.__mapLibreLoading = new Promise((resolve, reject) => {
        if (!document.querySelector('link[data-maplibre-css]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = MAPLIBRE_CSS_URL;
            link.setAttribute('data-maplibre-css', '1');
            document.head.appendChild(link);
        }

        const existing = document.querySelector('script[data-maplibre-js]');
        if (existing) {
            existing.addEventListener('load', () => {
                if (window.maplibregl) {
                    window.mapboxgl = window.maplibregl;
                    resolve(window.maplibregl);
                } else reject(new Error('MapLibre GL failed to load'));
            });
            existing.addEventListener('error', () => reject(new Error('MapLibre GL script error')));
            return;
        }

        const script = document.createElement('script');
        script.src = MAPLIBRE_JS_URL;
        script.async = true;
        script.setAttribute('data-maplibre-js', '1');
        script.onload = () => {
            if (window.maplibregl) {
                window.mapboxgl = window.maplibregl;
                resolve(window.maplibregl);
            } else reject(new Error('MapLibre GL failed to load'));
        };
        script.onerror = () => reject(new Error('MapLibre GL script error'));
        document.head.appendChild(script);
    }).finally(() => {
        window.__mapLibreLoading = null;
    });

    return window.__mapLibreLoading;
};

/** @deprecated kept as no-ops so old settings UI / localStorage do not break */
window.getMapboxToken = function() { return ''; };
window.hasValidMapboxToken = function() { return true; };
window.saveMapboxToken = function() {};

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
    if (!map || typeof map.setStyle !== 'function') return;
    if (!window.isMapLibreProvider || !window.isMapLibreProvider(window.currentMapProvider)) return;
    const cfg = window.getMapLibreProviderConfig(window.currentMapProvider);
    const nextStyle = cfg.style;
    const styleKey = typeof nextStyle === 'string' ? nextStyle : JSON.stringify(nextStyle);
    if (window.__mapLibreStyleUrl === styleKey) return;
    window.__mapLibreStyleUrl = styleKey;
    const center = map.getCenter();
    const zoom = map.getZoom();
    const pitch = map.getPitch();
    const bearing = map.getBearing();
    map.setStyle(nextStyle, { diff: false });
    map.once('style.load', () => {
        try {
            map.jumpTo({
                center,
                zoom,
                pitch: cfg.buildings ? pitch : Math.min(pitch, cfg.pitch || 0),
                bearing
            });
        } catch (_) {}
        if (cfg.buildings && window.ensureMapLibre3DBuildings) window.ensureMapLibre3DBuildings(map);
        if (window.updateMapMarkers) window.updateMapMarkers();
    });
};

/** Extruded OSM buildings for a true 3D look on OpenFreeMap / MapLibre. */
window.ensureMapLibre3DBuildings = function(map) {
    if (!map || typeof map.getStyle !== 'function') return;
    if (map.getLayer('rosmap-3d-buildings')) return;
    let style;
    try { style = map.getStyle(); } catch (_) { return; }
    if (!style?.sources) return;

    let sourceId = null;
    Object.entries(style.sources).forEach(([id, src]) => {
        if (!sourceId && src && src.type === 'vector') sourceId = id;
    });
    if (!sourceId) return;

    const beforeId = (style.layers || []).find((l) => l.type === 'symbol' && l.layout && l.layout['text-field'])?.id;
    const layer = {
        id: 'rosmap-3d-buildings',
        source: sourceId,
        'source-layer': 'building',
        type: 'fill-extrusion',
        minzoom: 13,
        paint: {
            'fill-extrusion-color': window.currentTheme === 'dark' ? '#475569' : '#c4cdd5',
            'fill-extrusion-height': [
                'coalesce',
                ['get', 'render_height'],
                ['get', 'height'],
                ['get', 'levels'],
                12
            ],
            'fill-extrusion-base': [
                'coalesce',
                ['get', 'render_min_height'],
                ['get', 'min_height'],
                0
            ],
            'fill-extrusion-opacity': 0.72
        }
    };
    try {
        if (beforeId) map.addLayer(layer, beforeId);
        else map.addLayer(layer);
    } catch (err) {
        // Some styles already include extrusion or use another source-layer name.
        console.warn('OSM 3D buildings layer skipped', err);
    }
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
    el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.openMarkerAdminContext) window.openMarkerAdminContext(sound.id, e);
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
    const activeId = window.currentPlayingId;

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

    document.querySelectorAll('.custom-marker.selected').forEach((el) => el.classList.remove('selected'));

    filtered.forEach((sound) => {
        const colorClass = sound.ecoCategory === 'geophony'
            ? 'marker-geo'
            : sound.ecoCategory === 'biophony'
                ? 'marker-bio'
                : 'marker-anthro';
        const isSelected = activeId === sound.id;
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
                el.classList.toggle('selected', !!isSelected);
                el.classList.remove('marker-geo', 'marker-bio', 'marker-anthro');
                el.classList.add(colorClass);
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
    const cfg = window.getMapLibreProviderConfig
        ? window.getMapLibreProviderConfig(window.currentMapProvider)
        : { minPitchForView: 50 };
    window.mapboxMap.flyTo({
        center: [lng, lat],
        zoom,
        duration: 800,
        pitch: Math.max(window.mapboxMap.getPitch(), cfg.minPitchForView || 0),
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
    window.__mapLibreStyleUrl = null;
};

window.initMapboxMap = async function() {
    try {
        await window.loadMapLibreGL();
    } catch (err) {
        console.warn(err);
        if (window.showToast) window.showToast('Не удалось загрузить MapLibre GL');
        return;
    }

    const container = document.getElementById('map');
    if (!container || !window.mapboxgl) return;

    const providerId = window.normalizeMapProvider
        ? window.normalizeMapProvider(window.currentMapProvider)
        : window.currentMapProvider;
    const cfg = window.getMapLibreProviderConfig
        ? window.getMapLibreProviderConfig(providerId)
        : { style: window.getOpenFreeMapStyleUrl(), pitch: 58, bearing: -18, buildings: true, minPitchForView: 50 };

    container.innerHTML = '';
    container.classList.add('is-mapbox');
    container.classList.remove('map-monochrome', 'is-dgis', 'is-googleearth', 'is-map-provider-placeholder');

    const styleKey = typeof cfg.style === 'string' ? cfg.style : JSON.stringify(cfg.style);
    window.__mapLibreStyleUrl = styleKey;

    window.mapboxMap = new window.mapboxgl.Map({
        container: 'map',
        style: cfg.style,
        center: [39.74427, 47.23371],
        zoom: 15,
        pitch: cfg.pitch || 0,
        bearing: cfg.bearing || 0,
        antialias: true,
        attributionControl: true,
        maxPitch: 85
    });

    window.mapboxMap.addControl(
        new window.mapboxgl.NavigationControl({ visualizePitch: true }),
        'bottom-right'
    );

    const minPitch = cfg.minPitchForView || 0;
    window.map = {
        __provider: providerId,
        setCenter(coords, zoom, opts) {
            const [lat, lng] = coords;
            window.mapboxMap.flyTo({
                center: [lng, lat],
                zoom: zoom ?? window.mapboxMap.getZoom(),
                duration: opts?.duration ?? 800,
                pitch: Math.max(window.mapboxMap.getPitch(), minPitch),
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
        if (cfg.buildings && window.ensureMapLibre3DBuildings) {
            window.ensureMapLibre3DBuildings(window.mapboxMap);
        }
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
