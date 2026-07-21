window.hideMapContextMenu = function() {
    const menu = document.getElementById('map-context-menu');
    if (menu) {
        menu.classList.add('hidden');
        menu.style.left = '-9999px';
        menu.style.top = '-9999px';
    }
    if (window.CtxPopup) window.CtxPopup.close();
};

window.showMapContextMenu = function(coords, position) {
    window.tempAddCoords = [coords[0], coords[1]];
    const lat = Number(coords[0]).toFixed(5);
    const lng = Number(coords[1]).toFixed(5);
    if (window.hideMarkerHoverCard) window.hideMarkerHoverCard(true);

    let clientX = 24;
    let clientY = 24;
    if (position && typeof position === 'object' && !Array.isArray(position)) {
        if (typeof position.clientX === 'number' && !Number.isNaN(position.clientX)) {
            clientX = position.clientX;
            clientY = typeof position.clientY === 'number' ? position.clientY : clientY;
        } else if (typeof position.pageX === 'number') {
            clientX = position.pageX - (window.scrollX || 0);
            clientY = (typeof position.pageY === 'number' ? position.pageY : clientY) - (window.scrollY || 0);
        } else if (typeof position.x === 'number') {
            const mapContainer = window.map?.container?.getElement?.();
            const mapRect = mapContainer?.getBoundingClientRect?.();
            if (mapRect) {
                clientX = mapRect.left + (position.x || 0);
                clientY = mapRect.top + (position.y || 0);
            }
        }
    } else if (Array.isArray(position)) {
        const mapContainer = window.map?.container?.getElement?.();
        const mapRect = mapContainer?.getBoundingClientRect?.();
        if (mapRect) {
            clientX = mapRect.left + (position[0] || 0);
            clientY = mapRect.top + (position[1] || 0);
        }
    }

    const items = [
        {
            icon: 'fa-plus',
            label: 'Добавить запись здесь',
            tone: 'primary',
            onClick: () => window.createMapMarkerFromContext()
        }
    ];
    if (window.openActionsMenu) {
        window.openActionsMenu(items, {
            title: 'Карта',
            subtitle: `${lat}, ${lng}`,
            clientX,
            clientY
        });
        return;
    }

    const menu = document.getElementById('map-context-menu');
    const coordsLabel = document.getElementById('map-context-menu-coords');
    if (!menu || !coordsLabel) return;
    coordsLabel.textContent = `${lat}, ${lng}`;
    const menuWidth = 208;
    const menuHeight = 92;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const maxLeft = Math.max(12, viewportWidth - menuWidth - 12);
    const maxTop = Math.max(12, viewportHeight - menuHeight - 12);
    menu.style.position = 'fixed';
    menu.style.left = `${Math.min(maxLeft, Math.max(12, clientX))}px`;
    menu.style.top = `${Math.min(maxTop, Math.max(12, clientY))}px`;
    menu.classList.remove('hidden');
};

window.createMapMarkerFromContext = function() {
    window.hideMapContextMenu();
    if (window.toggleAddModal) window.toggleAddModal(false, window.tempAddCoords);
};

/** ПКМ / долгое нажатие по метке: CtxPopup, как у кнопок «⋯». */
window.openMarkerAdminContext = function(soundId, e) {
    if (!window.isCurrentUserAdmin || !window.isCurrentUserAdmin()) return false;
    if (e) {
        try {
            if (typeof e.preventDefault === 'function') e.preventDefault();
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            const dom = e.get?.('domEvent');
            if (dom && typeof dom.preventDefault === 'function') dom.preventDefault();
            if (dom && typeof dom.stopPropagation === 'function') dom.stopPropagation();
        } catch (_) {}
    }
    if (window.hideMarkerHoverCard) window.hideMarkerHoverCard(true);

    const s = (window.soundsData || []).find(x => x.id === soundId);
    if (!s || !window.getAdminSoundActionItems) return false;

    const items = window.getAdminSoundActionItems(soundId);
    if (!items.length) return false;

    const point = window.eventClientPoint
        ? window.eventClientPoint(e)
        : { clientX: 24, clientY: 24 };

    if (window.openActionsMenu) {
        window.openActionsMenu(items, {
            title: s.title || 'Метка',
            subtitle: `${Number(s.lat).toFixed(5)}, ${Number(s.lng).toFixed(5)}`,
            clientX: point.clientX,
            clientY: point.clientY
        });
    } else if (window.openAdminSoundActions) {
        window.openAdminSoundActions(soundId);
    }
    return true;
};

window.destroyYandexMap = function() {
    if (window.markerCache) {
        window.markerCache.forEach((placemark) => {
            try {
                if (window.map?.geoObjects) window.map.geoObjects.remove(placemark);
            } catch (_) {}
        });
        window.markerCache.clear();
    }
    if (window.map && typeof window.map.destroy === 'function') {
        try { window.map.destroy(); } catch (_) {}
    }
};

window.destroyMainMap = function() {
    if (window.clearMapRoutes) window.clearMapRoutes();
    if (window.hideMarkerHoverCard) window.hideMarkerHoverCard(true);
    if (window.hideMapContextMenu) window.hideMapContextMenu();
    if (window.destroyMapboxMap) window.destroyMapboxMap();
    if (window.destroyDgisMap) window.destroyDgisMap();
    if (window.destroyGoogleEarthMap) window.destroyGoogleEarthMap();
    if (window.destroyYandex3Map) window.destroyYandex3Map();
    window.destroyYandexMap();
    window.map = null;
    window.__mainMapReady = false;
    const container = document.getElementById('map');
    if (container) {
        container.innerHTML = '';
        container.classList.remove('is-mapbox', 'is-dgis', 'is-googleearth', 'is-yandex3', 'is-map-provider-placeholder', 'map-monochrome');
        container.__longPressBound = false;
        container.__dgisCtxBound = false;
        container.__googleCtxBound = false;
    }
};

window.normalizeMapProvider = function(provider) {
    const raw = String(provider || '').toLowerCase().replace(/\s+/g, '');
    if (raw === 'mapbox' || raw === 'osm3d' || raw === 'openfreemap') return 'mapbox';
    if (raw === 'ozon' || raw === 'ozom' || raw === 'ozonmaps' || raw === 'osm' || raw === 'openstreetmap') return 'ozon';
    if (raw === 'carto' || raw === 'cartodb') return 'carto';
    if (raw === 'opentopo' || raw === 'opentopomap' || raw === 'topo') return 'opentopo';
    if (raw === 'esri' || raw === 'satellite' || raw === 'imagery' || raw === 'esrisat') return 'esri';
    if (raw === 'esristreet' || raw === 'street') return 'esristreet';
    if (raw === 'esritopo' || raw === 'worldtopo') return 'esritopo';
    if (raw === 'cyclosm' || raw === 'cycle') return 'cyclosm';
    if (raw === 'hot' || raw === 'humanitarian') return 'hot';
    if (raw === 'osmde' || raw === 'osmgermany') return 'osmde';
    if (raw === 'osmbright' || raw === 'bright') return 'osmbright';
    if (raw === 'dgis' || raw === '2gis') return 'dgis';
    if (raw === 'googleearth' || raw === 'google' || raw === 'earth') return 'googleearth';
    if (raw === 'yandex3' || raw === 'yandexv3' || raw === 'ymaps3') return 'yandex3';
    return 'yandex';
};

window.startMainMap = function() {
    const provider = window.normalizeMapProvider(window.currentMapProvider);
    window.currentMapProvider = provider;
    if (window.isMapLibreProvider && window.isMapLibreProvider(provider)) {
        if (window.initMapboxMap) window.initMapboxMap();
        return;
    }
    if (provider === 'dgis') {
        if (window.initDgisMap) window.initDgisMap();
        return;
    }
    if (provider === 'googleearth') {
        if (window.initGoogleEarthMap) window.initGoogleEarthMap();
        return;
    }
    const startYandex = () => {
        if (provider === 'yandex3') {
            if (window.initYandex3Map) window.initYandex3Map();
            return;
        }
        if (typeof ymaps !== 'undefined') ymaps.ready(window.initYandexMap);
    };
    if (window.ensureYandexMapsLoaded) {
        window.ensureYandexMapsLoaded().then(startYandex).catch((err) => {
            console.error(err);
            if (window.showToast) window.showToast('Не удалось загрузить Яндекс.Карты');
        });
    } else {
        startYandex();
    }
};

window.remountMainMap = function() {
    window.destroyMainMap();
    window.startMainMap();
};

window.setMapProvider = function(provider, skipSave = false) {
    const next = window.normalizeMapProvider(provider);
    const prev = window.normalizeMapProvider(window.currentMapProvider);
    window.currentMapProvider = next;
    try { localStorage.setItem('rosmap_map_provider', next); } catch (_) {}

    if (window.updateMapProviderHint) window.updateMapProviderHint();
    if (window.updateMapProviderKeyFields) window.updateMapProviderKeyFields();

    if (!skipSave && window.saveUserSettings) window.saveUserSettings('mapProvider', next);
    if (window.refreshSettingsUI) window.refreshSettingsUI();

    if (!skipSave && prev !== next) {
        window.remountMainMap();
    }
};

window.updateMapProviderHint = function() {
    const hint = document.getElementById('map-provider-hint');
    if (!hint || !window.translations) return;
    const lang = window.currentLang || 'ru';
    const t = window.translations[lang] || {};
    const p = window.normalizeMapProvider(window.currentMapProvider);
    const keyMap = {
        mapbox: 'map_provider_osm_hint',
        ozon: 'map_provider_ozon_hint',
        carto: 'map_provider_carto_hint',
        opentopo: 'map_provider_opentopo_hint',
        esri: 'map_provider_esri_hint',
        esristreet: 'map_provider_esristreet_hint',
        esritopo: 'map_provider_esritopo_hint',
        cyclosm: 'map_provider_cyclosm_hint',
        hot: 'map_provider_hot_hint',
        osmde: 'map_provider_osmde_hint',
        osmbright: 'map_provider_osmbright_hint',
        dgis: 'map_provider_dgis_hint',
        googleearth: 'map_provider_google_hint',
        yandex3: 'map_provider_yandex3_hint',
        yandex: 'map_provider_yandex_hint'
    };
    const key = keyMap[p] || 'map_provider_yandex_hint';
    hint.textContent = t[key] || hint.textContent;
};

window.updateMapProviderKeyFields = function() {
    const dgisWrap = document.getElementById('dgis-key-wrap');
    const googleWrap = document.getElementById('google-key-wrap');
    const p = window.normalizeMapProvider(window.currentMapProvider);
    if (dgisWrap) dgisWrap.classList.toggle('hidden', p !== 'dgis');
    if (googleWrap) googleWrap.classList.toggle('hidden', p !== 'googleearth');
    const dgisInput = document.getElementById('dgis-api-key-input');
    const googleInput = document.getElementById('google-api-key-input');
    if (dgisInput && window.getDgisApiKey) dgisInput.value = window.getDgisApiKey();
    if (googleInput && window.getGoogleMapsApiKey) googleInput.value = window.getGoogleMapsApiKey();
};

window.initMap = function() {
    window.startMainMap();
};

window.initYandexMap = function() {
    if (typeof ymaps === 'undefined') return;
    const container = document.getElementById('map');
    if (container) {
        container.innerHTML = '';
        container.classList.remove('is-mapbox');
    }
    const isMobile = window.innerWidth < 768;
    window.map = new ymaps.Map('map', {
        center: [47.23371, 39.74427],
        zoom: 15,
        controls: isMobile ? [] : ['zoomControl']
    }, {
        suppressMapOpenBlock: true,
        // POI icons stay on the basemap (API 2.1 cannot hide them), but disable ads/org popups.
        yandexMapDisablePoiInteractivity: true
    });
    if (container) {
        if (window.currentMapStyle === 'monochrome') container.classList.add('map-monochrome');
        else container.classList.remove('map-monochrome');
    }
    window.walkerLayout = ymaps.templateLayoutFactory.createClass(
        '<div class="walker-marker $[properties.colorClass]"><i class="fa-solid fa-person-walking"></i></div>'
    );
    window.updateMapMarkers();
    window.__mainMapReady = true;

    window.map.events.add('contextmenu', function (e) {
        const coords = e.get('coords');
        const domEvent = e.get('domEvent');
        const mapPosition = e.get('position');
        if (domEvent && typeof domEvent.preventDefault === 'function') domEvent.preventDefault();

        const original = (domEvent && domEvent.originalEvent) || null;
        const read = (key) => {
            if (original && typeof original[key] === 'number') return original[key];
            if (domEvent && typeof domEvent.get === 'function') {
                const v = domEvent.get(key);
                if (typeof v === 'number') return v;
            }
            if (domEvent && typeof domEvent[key] === 'number') return domEvent[key];
            return null;
        };

        const clientX = read('clientX');
        const clientY = read('clientY');
        const pageX = read('pageX');
        const pageY = read('pageY');

        let position = null;
        if (clientX != null || pageX != null) {
            position = {
                clientX: clientX ?? (pageX != null ? pageX - (window.scrollX || 0) : 0),
                clientY: clientY ?? (pageY != null ? pageY - (window.scrollY || 0) : 0),
                pageX: pageX ?? clientX,
                pageY: pageY ?? clientY
            };
        } else if (Array.isArray(mapPosition)) {
            position = mapPosition;
        } else if (mapPosition) {
            position = { x: mapPosition[0] ?? mapPosition.x, y: mapPosition[1] ?? mapPosition.y };
        }

        window.showMapContextMenu(coords, position);
    });

    window.map.events.add('click', function () {
        window.hideMapContextMenu();
        window.hideMarkerHoverCard(true);
    });
    window.map.events.add('actionbegin', () => window.hideMarkerHoverCard(true));
    window.map.events.add('boundschange', () => {
        if (window.__markerHoverSoundId) window.positionMarkerHoverCard();
    });

    window.initMapLongPress();
};

window.escapeHoverText = function(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};

window.hideMarkerHoverCard = function(immediate = false) {
    if (window.__markerHoverHideTimer) {
        clearTimeout(window.__markerHoverHideTimer);
        window.__markerHoverHideTimer = null;
    }
    const hide = () => {
        const card = document.getElementById('marker-hover-card');
        if (!card) return;
        card.classList.remove('is-visible');
        card.setAttribute('aria-hidden', 'true');
        card.hidden = true;
        window.__markerHoverSoundId = null;
        window.__markerHoverCoords = null;
    };
    if (immediate) hide();
    else window.__markerHoverHideTimer = setTimeout(hide, 80);
};

window.positionMarkerHoverCard = function() {
    const card = document.getElementById('marker-hover-card');
    if (!card || !window.map || !window.__markerHoverCoords) return;

    if (window.mapboxMap && window.isMapLibreProvider && window.isMapLibreProvider(window.currentMapProvider)) {
        if (window.positionMapboxHoverCard) window.positionMapboxHoverCard();
        return;
    }
    if (window.currentMapProvider === 'dgis' || window.currentMapProvider === 'googleearth' || window.currentMapProvider === 'yandex3') {
        // HTML markers share screen space; skip projection-based hover for non-2.1 providers.
        return;
    }

    try {
        const projection = window.map.options.get('projection');
        const zoom = window.map.getZoom();
        const globalPixels = projection.toGlobalPixels(window.__markerHoverCoords, zoom);
        const pagePixels = window.map.converter.globalToPage(globalPixels);
        const cardW = card.offsetWidth || 196;
        const cardH = card.offsetHeight || 170;
        const pad = 10;
        let left = pagePixels[0] - cardW / 2;
        let top = pagePixels[1] - cardH - 18;
        left = Math.max(pad, Math.min(left, (window.innerWidth || 0) - cardW - pad));
        if (top < pad) top = pagePixels[1] + 22;
        top = Math.max(pad, Math.min(top, (window.innerHeight || 0) - cardH - pad));
        card.style.left = `${Math.round(left)}px`;
        card.style.top = `${Math.round(top)}px`;
    } catch (_) {}
};

window.showMarkerHoverCard = function(sound) {
    if (!sound || !window.map) return;
    if (window.matchMedia && window.matchMedia('(hover: none)').matches) return;

    if (window.__markerHoverHideTimer) {
        clearTimeout(window.__markerHoverHideTimer);
        window.__markerHoverHideTimer = null;
    }

    const card = document.getElementById('marker-hover-card');
    const photoEl = document.getElementById('marker-hover-photo');
    const photoWrap = document.getElementById('marker-hover-photo-wrap');
    const ecoEl = document.getElementById('marker-hover-eco');
    const titleEl = document.getElementById('marker-hover-title');
    const metaEl = document.getElementById('marker-hover-meta');
    const descEl = document.getElementById('marker-hover-desc');
    if (!card || !photoEl || !ecoEl || !titleEl || !metaEl || !descEl) return;

    const ecoMap = {
        geophony: { label: 'Геофония', cls: 'is-geo' },
        biophony: { label: 'Биофония', cls: 'is-bio' },
        anthrophony: { label: 'Антропофония', cls: 'is-anthro' }
    };
    const eco = ecoMap[sound.ecoCategory] || { label: 'Звук', cls: '' };
    const photo = (sound.images && sound.images[0]) || '';
    const desc = (sound.description || '').trim();
    const shortDesc = desc.length > 90 ? `${desc.slice(0, 87)}…` : desc;

    const fillMeta = (durationLabel) => {
        metaEl.innerHTML = [
            `<span><i class="fa-solid fa-fingerprint"></i>${window.escapeHoverText(window.getSoundDisplayId ? window.getSoundDisplayId(sound) : sound.id)}</span>`,
            durationLabel ? `<span><i class="fa-regular fa-clock"></i>${window.escapeHoverText(durationLabel)}</span>` : '',
            sound.recordist ? `<span><i class="fa-regular fa-user"></i>${window.escapeHoverText(sound.recordist)}</span>` : '',
            sound.ucsCat ? `<span><i class="fa-solid fa-tag"></i>${window.escapeHoverText(sound.ucsCat)}</span>` : ''
        ].filter(Boolean).join('');
    };

    ecoEl.className = `marker-hover-card__eco ${eco.cls}`.trim();
    ecoEl.textContent = eco.label;
    titleEl.textContent = sound.title || 'Без названия';
    const knownSecs = window.parseDuration ? window.parseDuration(sound.duration) : 0;
    fillMeta(knownSecs > 0 ? sound.duration : (sound.duration && sound.duration !== '0:00' ? sound.duration : '…'));
    descEl.textContent = shortDesc;
    descEl.style.display = shortDesc ? '' : 'none';

    const hasPhoto = !!photo;
    card.classList.toggle('no-photo', !hasPhoto);
    if (photoWrap) photoWrap.hidden = !hasPhoto;
    if (hasPhoto) {
        photoEl.alt = sound.title || '';
        if (photoEl.getAttribute('src') !== photo) photoEl.src = photo;
    } else {
        photoEl.removeAttribute('src');
        photoEl.alt = '';
    }

    window.__markerHoverSoundId = sound.id;
    window.__markerHoverCoords = [sound.lat, sound.lng];
    card.hidden = false;
    card.setAttribute('aria-hidden', 'false');
    window.positionMarkerHoverCard();
    requestAnimationFrame(() => card.classList.add('is-visible'));

    // Если в данных 0:00 — пробуем длительность из аудиофайла
    if (knownSecs <= 0 && sound.url && window.probeAudioDuration) {
        const sid = sound.id;
        window.probeAudioDuration(sound.url).then(secs => {
            if (window.__markerHoverSoundId !== sid) return;
            const label = window.formatTime ? window.formatTime(secs) : `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
            sound.duration = label;
            fillMeta(label);
            // Обновим кэш в soundsData без обязательного sync
            const live = (window.soundsData || []).find(s => s.id === sid);
            if (live) live.duration = label;
        }).catch(() => {
            if (window.__markerHoverSoundId === sid) fillMeta(sound.duration && sound.duration !== '0:00' ? sound.duration : '');
        });
    }
};

window.bindMarkerHover = function(placemark, soundId) {
    if (!placemark || placemark.__hoverBound) return;
    placemark.__hoverBound = true;
    placemark.events.add('mouseenter', () => {
        const sound = (window.soundsData || []).find(s => s.id === soundId);
        if (sound) window.showMarkerHoverCard(sound);
    });
    placemark.events.add('mouseleave', () => window.hideMarkerHoverCard());
    placemark.events.add('click', () => window.hideMarkerHoverCard(true));
};

window.mapSetView = function(lat, lng, zoom = 15) {
    const p = window.normalizeMapProvider ? window.normalizeMapProvider(window.currentMapProvider) : window.currentMapProvider;
    if (window.isMapLibreProvider && window.isMapLibreProvider(p) && window.mapboxMap) {
        if (window.mapboxSetView) window.mapboxSetView(lat, lng, zoom);
        return;
    }
    if (p === 'dgis' && window.dgisMap) {
        if (window.dgisSetView) window.dgisSetView(lat, lng, zoom);
        return;
    }
    if (p === 'googleearth' && window.googleEarthMapEl) {
        if (window.googleEarthSetView) window.googleEarthSetView(lat, lng, zoom);
        return;
    }
    if (p === 'yandex3' && window.yandex3Map) {
        if (window.yandex3SetView) window.yandex3SetView(lat, lng, zoom);
        return;
    }
    if (!window.map) return;
    window.map.setCenter([lat, lng], zoom, { duration: 800 });
};

window.mapAddRouteOverlay = function(route, colorClass) {
    const p = window.normalizeMapProvider ? window.normalizeMapProvider(window.currentMapProvider) : window.currentMapProvider;
    if (window.isMapLibreProvider && window.isMapLibreProvider(p)) {
        if (window.mapboxAddRouteOverlay) window.mapboxAddRouteOverlay(route, colorClass);
        return;
    }
    if (p === 'dgis') {
        if (window.dgisAddRouteOverlay) window.dgisAddRouteOverlay(route, colorClass);
        return;
    }
    if (p === 'googleearth') {
        if (window.googleEarthAddRouteOverlay) window.googleEarthAddRouteOverlay(route, colorClass);
        return;
    }
    if (p === 'yandex3') {
        if (window.yandex3AddRouteOverlay) window.yandex3AddRouteOverlay(route, colorClass);
        return;
    }
    window.clearMapRoutes();
    if (!window.map || !route || route.length < 2 || typeof ymaps === 'undefined') return;

    window.activePolyline = new ymaps.Polyline(route, {}, { strokeColor: '#38bdf8', strokeWidth: 4, strokeOpacity: 0.8, strokeStyle: 'shortdash' });
    window.map.geoObjects.add(window.activePolyline);
    window.map.setBounds(window.activePolyline.geometry.getBounds(), { checkZoomRange: true, duration: 800, zoomMargin: 40 });
    if (window.walkerLayout) {
        window.walkerMarker = new ymaps.Placemark(route[0], { colorClass }, {
            iconLayout: window.walkerLayout,
            iconOffset: [-14, -14],
            iconShape: { type: 'Circle', coordinates: [0, 0], radius: 14 },
            zIndex: 1000
        });
        window.map.geoObjects.add(window.walkerMarker);
    }
};

window.setWalkerPosition = function(coords) {
    if (window.walkerMapboxMarker && coords) {
        const ll = window.toLngLat ? window.toLngLat(coords) : [coords[1], coords[0]];
        if (ll) window.walkerMapboxMarker.setLngLat(ll);
        return;
    }
    if (window.dgisWalkerMarker && coords) {
        try { window.dgisWalkerMarker.setCoordinates([coords[1], coords[0]]); } catch (_) {}
        return;
    }
    if (window.googleEarthWalker && coords) {
        try {
            window.googleEarthWalker.position = { lat: coords[0], lng: coords[1], altitude: 0 };
        } catch (_) {}
        return;
    }
    if (window.walkerMarker && window.walkerMarker.__yandex3 && coords) {
        if (typeof window.walkerMarker.setCoordinates === 'function') {
            window.walkerMarker.setCoordinates(coords);
        }
        return;
    }
    if (!window.walkerMarker || !coords || !window.walkerMarker.geometry) return;
    window.walkerMarker.geometry.setCoordinates(coords);
};

// Долгое нажатие на карте (мобильные устройства) — открывает то же меню, что и ПКМ на десктопе
window.initMapLongPress = function() {
    const container = document.getElementById('map');
    if (!container || container.__longPressBound) return;
    container.__longPressBound = true;

    const LONG_PRESS_MS = 500;
    const MOVE_TOLERANCE_PX = 10;
    let timer = null;
    let moved = false;
    let start = null;

    const cancel = () => {
        if (timer) { clearTimeout(timer); timer = null; }
    };

    container.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) { cancel(); return; }
        const touch = e.touches[0];
        moved = false;
        start = { x: touch.clientX, y: touch.clientY, pageX: touch.pageX, pageY: touch.pageY };
        timer = setTimeout(() => {
            timer = null;
            if (moved || !window.map) return;
            let coords;
            try {
                if (window.mapboxMap && window.isMapLibreProvider && window.isMapLibreProvider(window.currentMapProvider)) {
                    const rect = container.getBoundingClientRect();
                    const point = window.mapboxMap.unproject([start.x - rect.left, start.y - rect.top]);
                    coords = [point.lat, point.lng];
                } else if (window.yandex3Map && window.currentMapProvider === 'yandex3') {
                    if (Array.isArray(window.__yandex3PointerCoords) && window.__yandex3PointerCoords.length >= 2) {
                        const [lng, lat] = window.__yandex3PointerCoords;
                        coords = [lat, lng];
                    } else {
                        const rect = container.getBoundingClientRect();
                        const px = [start.x - rect.left, start.y - rect.top];
                        if (typeof window.yandex3Map.getCoordinatesFromPixels === 'function') {
                            const [lng, lat] = window.yandex3Map.getCoordinatesFromPixels(px);
                            coords = [lat, lng];
                        } else {
                            return;
                        }
                    }
                } else {
                    const projection = window.map.options.get('projection');
                    const globalPixels = window.map.converter.pageToGlobal([start.pageX, start.pageY]);
                    coords = projection.fromGlobalPixels(globalPixels, window.map.getZoom());
                }
            } catch (_) { return; }
            if (navigator.vibrate) navigator.vibrate(15);
            window.showMapContextMenu(coords, { clientX: start.x, clientY: start.y, pageX: start.pageX, pageY: start.pageY });
        }, LONG_PRESS_MS);
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
        if (!timer || !start) return;
        const touch = e.touches[0];
        if (!touch) return;
        const dx = touch.clientX - start.x, dy = touch.clientY - start.y;
        if (Math.sqrt(dx * dx + dy * dy) > MOVE_TOLERANCE_PX) {
            moved = true;
            cancel();
        }
    }, { passive: true });

    container.addEventListener('touchend', cancel, { passive: true });
    container.addEventListener('touchcancel', cancel, { passive: true });
};

window.parseCoordinateString = function(value) {
    if (!value) return null;
    const parts = String(value).split(',').map(part => parseFloat(part.trim())).filter(part => Number.isFinite(part));
    if (parts.length >= 2) return [parts[0], parts[1]];
    return null;
}

window.isSoundwalkPrinciple = function(value) {
    const v = value || document.getElementById('add-principle')?.value || '';
    return String(v).includes('Soundwalk');
};

window.initLocationPickerMap = function() {
    const container = document.getElementById('location-picker-map');
    if (!container || typeof ymaps === 'undefined') return;

    const initialCoords = window.tempAddCoords || window.parseCoordinateString(document.getElementById('add-coords')?.value) || [47.222, 39.718];
    const hint = document.getElementById('location-picker-hint');
    if (hint) {
        hint.textContent = window.isSoundwalkPrinciple() || window.__sessionRoutePicking
            ? 'Кликайте по карте, чтобы добавить точки. Удалить точку можно в списке сверху.'
            : 'Нажмите на карту, чтобы выбрать точку';
    }

    // Тема карты как у основной (монохром / стандарт)
    if (window.currentMapStyle === 'monochrome') container.classList.add('map-monochrome');
    else container.classList.remove('map-monochrome');

    if (!window.locationPickerMap) {
        window.locationPickerMap = new ymaps.Map('location-picker-map', {
            center: initialCoords,
            zoom: 12,
            controls: ['zoomControl', 'fullscreenControl']
        }, {
            yandexMapDisablePoiInteractivity: true,
            suppressMapOpenBlock: true
        });

        window.locationPickerMap.events.add('click', function (e) {
            const coords = e.get('coords');
            const point = [coords[0], coords[1]];

            if (window.__sessionRoutePicking) {
                window.__sessionRouteStops = window.__sessionRouteStops || [];
                window.__sessionRouteStops.push({ lat: point[0], lng: point[1], title: `Точка ${window.__sessionRouteStops.length + 1}` });
                window.redrawSessionRouteOnPicker();
                window.renderLocationPickerRouteChips();
                window.showToast(`Точка маршрута ${window.__sessionRouteStops.length}`);
                return;
            }

            if (window.isSoundwalkPrinciple()) {
                window.addModalRoute = window.addModalRoute || [];
                window.addModalRoute.push(point);
                window.tempAddCoords = window.addModalRoute[0];
                window.redrawAddModalRouteOnPicker();
                window.renderLocationPickerRouteChips();
                window.showToast(`Точка маршрута ${window.addModalRoute.length}`);
            } else {
                window.tempAddCoords = point;
                window.placeLocationPickerMarker(window.tempAddCoords);
            }

            const coordsInput = document.getElementById('add-coords');
            if (coordsInput && window.tempAddCoords) {
                coordsInput.value = `${Number(window.tempAddCoords[0]).toFixed(5)}, ${Number(window.tempAddCoords[1]).toFixed(5)}`;
            }
            const locationInput = document.getElementById('add-loc');
            if (locationInput && !locationInput.value.trim()) locationInput.value = 'Точка выбрана на карте';
        });
    }

    window.locationPickerMap.setCenter(initialCoords, 12);
    if (window.__sessionRoutePicking) {
        window.redrawSessionRouteOnPicker();
        window.renderLocationPickerRouteChips();
    } else if (window.isSoundwalkPrinciple() && window.addModalRoute && window.addModalRoute.length) {
        window.redrawAddModalRouteOnPicker();
        window.renderLocationPickerRouteChips();
    } else {
        window.placeLocationPickerMarker(initialCoords);
        window.renderLocationPickerRouteChips();
    }
};

window.renderLocationPickerRouteChips = function() {
    const box = document.getElementById('location-picker-route-points');
    if (!box) return;
    if (window.__sessionRoutePicking) {
        const stops = window.__sessionRouteStops || [];
        if (!stops.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }
        box.classList.remove('hidden');
        box.innerHTML = stops.map((st, i) => `
            <span class="picker-route-chip">${i + 1}. ${Number(st.lat).toFixed(3)}, ${Number(st.lng).toFixed(3)}
                <button type="button" onclick="window.removeSessionRoutePointAt(${i})" title="Удалить"><i class="fa-solid fa-xmark"></i></button>
            </span>`).join('');
        return;
    }
    if (!window.isSoundwalkPrinciple()) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    const route = window.addModalRoute || [];
    if (!route.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    box.classList.remove('hidden');
    box.innerHTML = route.map((pt, i) => `
        <span class="picker-route-chip">${i + 1}. ${Number(pt[0]).toFixed(3)}, ${Number(pt[1]).toFixed(3)}
            <button type="button" onclick="window.removeAddModalRoutePoint(${i})" title="Удалить"><i class="fa-solid fa-xmark"></i></button>
        </span>`).join('');
};

window.removeAddModalRoutePoint = function(index) {
    if (!window.addModalRoute || index < 0 || index >= window.addModalRoute.length) return;
    window.addModalRoute.splice(index, 1);
    window.tempAddCoords = window.addModalRoute[0] || null;
    window.redrawAddModalRouteOnPicker();
    window.renderLocationPickerRouteChips();
    window.updateSoundwalkRouteUI && window.updateSoundwalkRouteUI();
};

window.removeSessionRoutePointAt = function(index) {
    if (!window.__sessionRouteStops || index < 0 || index >= window.__sessionRouteStops.length) return;
    window.__sessionRouteStops.splice(index, 1);
    window.__sessionRouteStops.forEach((st, i) => { st.title = `Точка ${i + 1}`; });
    window.redrawSessionRouteOnPicker();
    window.renderLocationPickerRouteChips();
};

window.redrawSessionRouteOnPicker = function() {
    if (!window.locationPickerMap) return;
    window.locationPickerMap.geoObjects.removeAll();
    window.locationPickerPlacemark = null;
    window.addModalPolyline = null;
    const stops = window.__sessionRouteStops || [];
    const route = stops.map(s => [s.lat, s.lng]);
    if (!route.length) return;
    route.forEach((pt, i) => {
        const mark = new ymaps.Placemark(pt, {}, {
            preset: i === 0 ? 'islands#blueDotIcon' : 'islands#lightBlueCircleIcon'
        });
        window.locationPickerMap.geoObjects.add(mark);
        if (i === 0) window.locationPickerPlacemark = mark;
    });
    if (route.length > 1) {
        window.addModalPolyline = new ymaps.Polyline(route, {}, {
            strokeColor: '#38bdf8', strokeWidth: 4, strokeOpacity: 0.85, strokeStyle: 'shortdash'
        });
        window.locationPickerMap.geoObjects.add(window.addModalPolyline);
        window.locationPickerMap.setBounds(window.addModalPolyline.geometry.getBounds(), { checkZoomRange: true, zoomMargin: 40 });
    }
};

window.redrawAddModalRouteOnPicker = function() {
    if (!window.locationPickerMap) return;
    if (window.locationPickerPlacemark) {
        window.locationPickerMap.geoObjects.remove(window.locationPickerPlacemark);
        window.locationPickerPlacemark = null;
    }
    if (window.addModalPolyline) {
        window.locationPickerMap.geoObjects.remove(window.addModalPolyline);
        window.addModalPolyline = null;
    }
    // clear previous route marks (keep map instance)
    const toRemove = [];
    window.locationPickerMap.geoObjects.each((obj) => toRemove.push(obj));
    toRemove.forEach(obj => window.locationPickerMap.geoObjects.remove(obj));

    const route = window.addModalRoute || [];
    if (!route.length) return;
    route.forEach((pt, i) => {
        const mark = new ymaps.Placemark(pt, {}, {
            preset: i === 0 ? 'islands#blueDotIcon' : 'islands#lightBlueCircleIcon'
        });
        window.locationPickerMap.geoObjects.add(mark);
        if (i === 0) window.locationPickerPlacemark = mark;
    });
    if (route.length > 1) {
        window.addModalPolyline = new ymaps.Polyline(route, {}, {
            strokeColor: '#38bdf8', strokeWidth: 4, strokeOpacity: 0.85, strokeStyle: 'shortdash'
        });
        window.locationPickerMap.geoObjects.add(window.addModalPolyline);
        window.locationPickerMap.setBounds(window.addModalPolyline.geometry.getBounds(), { checkZoomRange: true, zoomMargin: 40 });
    }
};

// Облегчённая карта для публичного профиля — только точки конкретного автора, без кластеризации
// и фильтров основной карты. Инициализируется лениво при первом открытии профиля и переиспользуется
// (как window.locationPickerMap) — очищается и перерисовывается при каждом новом открытии.
window.renderProfileMiniMap = function(containerId, sounds) {
    const container = document.getElementById(containerId);
    if (!container || typeof ymaps === 'undefined') return;

    if (!window.profileMiniMap) {
        window.profileMiniMap = new ymaps.Map(containerId, {
            center: [47.23371, 39.74427],
            zoom: 9,
            controls: []
        }, {
            yandexMapDisablePoiInteractivity: true,
            suppressMapOpenBlock: true
        });
    } else {
        window.profileMiniMap.geoObjects.removeAll();
    }

    const pts = (sounds || []).filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng));
    if (!pts.length) return;

    pts.forEach(s => {
        const preset = s.ecoCategory === 'geophony' ? 'islands#lightBlueCircleIcon'
            : s.ecoCategory === 'biophony' ? 'islands#greenCircleIcon'
            : 'islands#orangeCircleIcon';
        const mark = new ymaps.Placemark([s.lat, s.lng], {}, { preset });
        mark.events.add('click', () => { if (window.closePublicProfileModal) window.closePublicProfileModal(); window.selectSound(s.id); });
        window.profileMiniMap.geoObjects.add(mark);
    });

    if (pts.length === 1) {
        window.profileMiniMap.setCenter([pts[0].lat, pts[0].lng], 12);
    } else {
        window.profileMiniMap.setBounds(window.profileMiniMap.geoObjects.getBounds(), { checkZoomRange: true, zoomMargin: 24 });
    }
};

window.placeLocationPickerMarker = function(coords) {
    if (!window.locationPickerMap) return;
    if (window.locationPickerPlacemark) {
        window.locationPickerMap.geoObjects.remove(window.locationPickerPlacemark);
    }
    window.locationPickerPlacemark = new ymaps.Placemark(coords, {}, { preset: 'islands#blueDotIcon' });
    window.locationPickerMap.geoObjects.add(window.locationPickerPlacemark);
}

window.updateMapMarkers = function() {
    const p = window.normalizeMapProvider ? window.normalizeMapProvider(window.currentMapProvider) : window.currentMapProvider;
    if (window.isMapLibreProvider && window.isMapLibreProvider(p)) {
        if (window.updateMapboxMarkers) window.updateMapboxMarkers();
        return;
    }
    if (p === 'dgis') {
        if (window.updateDgisMarkers) window.updateDgisMarkers();
        return;
    }
    if (p === 'googleearth') {
        if (window.updateGoogleEarthMarkers) window.updateGoogleEarthMarkers();
        return;
    }
    if (p === 'yandex3') {
        if (window.updateYandex3Markers) window.updateYandex3Markers();
        return;
    }
    if (!window.map || typeof ymaps === 'undefined') return;

    const filtered = window.getFilteredSounds ? window.getFilteredSounds() : window.soundsData || [];
    const currentActiveId = window.currentPlayingId;

    if (currentActiveId && !filtered.some(sound => sound.id === currentActiveId)) {
        window.currentPlayingId = null;
    }
    const activeId = window.currentPlayingId;

    window.markerCache = window.markerCache || new Map();
    window.markerLayoutCache = window.markerLayoutCache || new Map();

    const visibleIds = new Set(filtered.map(sound => sound.id));

    window.markerCache.forEach((placemark, id) => {
        if (!visibleIds.has(id)) {
            window.map.geoObjects.remove(placemark);
            window.markerCache.delete(id);
            if (window.__markerHoverSoundId === id) window.hideMarkerHoverCard(true);
        }
    });

    // Снять «selected» со всех DOM-маркеров до пересчёта (иначе прошлый остаётся подсвеченным).
    document.querySelectorAll('.custom-marker.selected').forEach((el) => el.classList.remove('selected'));

    const createMarkerLayout = (colorClass, id, isSoundwalk, isAmbisonic, isSelected) => {
        const layoutKey = `${id}|${colorClass}|${isSelected ? 'selected' : 'normal'}|${isSoundwalk ? 'sw' : 'n'}|${isAmbisonic ? 'amb' : 'na'}`;
        if (window.markerLayoutCache.has(layoutKey)) return window.markerLayoutCache.get(layoutKey);
        const layout = ymaps.templateLayoutFactory.createClass(
            `<div id="marker-${id}" class="w-6 h-6 md:w-7 md:h-7 custom-marker ${colorClass} ${isSelected ? 'selected' : ''} flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110">
                ${isSoundwalk ? '<i class="fa-solid fa-route text-[11px] md:text-[13px] opacity-90"></i>' : (isAmbisonic ? '<i class="fa-solid fa-cube text-[10px] md:text-[12px] opacity-90"></i>' : '')}
            </div>`
        );
        window.markerLayoutCache.set(layoutKey, layout);
        return layout;
    };

    const selectedDomIds = [];
    filtered.forEach(sound => {
        let colorClass = sound.ecoCategory === 'geophony' ? 'marker-geo' : sound.ecoCategory === 'biophony' ? 'marker-bio' : 'marker-anthro';
        const isSoundwalk = sound.recPrinciple && sound.recPrinciple.includes('Soundwalk');
        const isAmbisonic = sound.channels && sound.channels.toLowerCase().includes('ambisonics');
        const isSelected = activeId === sound.id;
        const hitRadius = isSelected ? 40 : 28;
        const layoutKey = `${sound.id}|${colorClass}|${isSelected ? 'selected' : 'normal'}|${isSoundwalk ? 'sw' : 'n'}|${isAmbisonic ? 'amb' : 'na'}`;

        let placemark = window.markerCache.get(sound.id);
        if (!placemark) {
            placemark = new ymaps.Placemark([sound.lat, sound.lng], {}, {
                iconLayout: createMarkerLayout(colorClass, sound.id, isSoundwalk, isAmbisonic, isSelected),
                iconShape: { type: 'Circle', coordinates: [0, 0], radius: hitRadius },
                iconOffset: [-14, -14]
            });
            placemark.__rosmapLayoutKey = layoutKey;
            placemark.__rosmapHitRadius = hitRadius;
            placemark.events.add('click', () => window.selectSound(sound.id));
            placemark.events.add('contextmenu', (e) => {
                try {
                    e.preventDefault();
                    e.stopPropagation();
                } catch (_) {}
                window.openMarkerAdminContext(sound.id, e);
            });
            window.bindMarkerHover(placemark, sound.id);
            window.map.geoObjects.add(placemark);
            window.markerCache.set(sound.id, placemark);
        } else {
            const coords = placemark.geometry.getCoordinates();
            if (!coords || coords[0] !== sound.lat || coords[1] !== sound.lng) {
                placemark.geometry.setCoordinates([sound.lat, sound.lng]);
            }
            // Rebuild Yandex iconLayout only when selection/style actually changed.
            if (placemark.__rosmapLayoutKey !== layoutKey) {
                placemark.options.set('iconLayout', createMarkerLayout(colorClass, sound.id, isSoundwalk, isAmbisonic, isSelected));
                placemark.__rosmapLayoutKey = layoutKey;
            }
            if (placemark.__rosmapHitRadius !== hitRadius) {
                placemark.options.set('iconShape', { type: 'Circle', coordinates: [0, 0], radius: hitRadius });
                placemark.options.set('iconOffset', [-14, -14]);
                placemark.__rosmapHitRadius = hitRadius;
            }
            if (window.__markerHoverSoundId === sound.id) {
                window.__markerHoverCoords = [sound.lat, sound.lng];
                window.positionMarkerHoverCard();
            }
        }
        if (isSelected) selectedDomIds.push(sound.id);
    });

    if (selectedDomIds.length) {
        requestAnimationFrame(() => {
            selectedDomIds.forEach((id) => {
                const el = document.getElementById(`marker-${id}`);
                if (el) el.classList.add('selected');
            });
        });
    }
}

window.getDistance = function(p1, p2) {
    const dx = p1[0] - p2[0], dy = p1[1] - p2[1];
    return Math.sqrt(dx*dx + dy*dy);
}

window.getPointAlongRoute = function(route, ratio) {
    if (!route || route.length === 0) return null;
    if (route.length === 1) return route[0];
    if (ratio <= 0) return route[0];
    if (ratio >= 1) return route[route.length - 1];

    let totalDist = 0;
    const segments = [];
    for (let i = 0; i < route.length - 1; i++) {
        const dist = window.getDistance(route[i], route[i+1]);
        segments.push({ start: route[i], end: route[i+1], dist: dist });
        totalDist += dist;
    }

    const targetDist = totalDist * ratio;
    let currentDist = 0;

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (currentDist + seg.dist >= targetDist) {
            const segRatio = (targetDist - currentDist) / seg.dist;
            const lat = seg.start[0] + (seg.end[0] - seg.start[0]) * segRatio;
            const lng = seg.start[1] + (seg.end[1] - seg.start[1]) * segRatio;
            return [lat, lng];
        }
        currentDist += seg.dist;
    }
    return route[route.length - 1];
}

window.clearMapRoutes = function() {
    if (window.mapboxMap || window.walkerMapboxMarker || (window.activePolyline && window.activePolyline.__mapbox)) {
        if (window.clearMapboxRoutes) window.clearMapboxRoutes();
    }
    if (window.dgisMap || window.dgisWalkerMarker || (window.activePolyline && window.activePolyline.__dgis)) {
        if (window.clearDgisRoutes) window.clearDgisRoutes();
    }
    if (window.googleEarthMapEl || window.googleEarthWalker || (window.activePolyline && window.activePolyline.__googleearth)) {
        if (window.clearGoogleEarthRoutes) window.clearGoogleEarthRoutes();
    }
    if (window.yandex3Map || (window.activePolyline && window.activePolyline.__yandex3)) {
        if (window.clearYandex3Routes) window.clearYandex3Routes();
    }
    if (window.activePolyline && window.map?.geoObjects && !window.activePolyline.__mapbox && !window.activePolyline.__dgis && !window.activePolyline.__googleearth && !window.activePolyline.__yandex3) {
        try { window.map.geoObjects.remove(window.activePolyline); } catch (_) {}
        window.activePolyline = null;
    }
    if (window.walkerMarker && window.map?.geoObjects && !window.walkerMapboxMarker && !window.walkerMarker.__dgis && !window.walkerMarker.__googleearth && !window.walkerMarker.__yandex3) {
        try { window.map.geoObjects.remove(window.walkerMarker); } catch (_) {}
        window.walkerMarker = null;
    }
};