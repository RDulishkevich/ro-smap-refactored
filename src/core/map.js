window.hideMapContextMenu = function() {
    const menu = document.getElementById('map-context-menu');
    if (menu) {
        menu.classList.add('hidden');
        menu.style.left = '-9999px';
        menu.style.top = '-9999px';
    }
};

window.showMapContextMenu = function(coords, position) {
    const menu = document.getElementById('map-context-menu');
    const coordsLabel = document.getElementById('map-context-menu-coords');
    if (!menu || !coordsLabel) return;

    window.tempAddCoords = [coords[0], coords[1]];
    coordsLabel.textContent = `${Number(coords[0]).toFixed(5)}, ${Number(coords[1]).toFixed(5)}`;

    // position: fixed — координаты в системе viewport (clientX/clientY), без scrollX/scrollY.
    let x = 12;
    let y = 12;

    if (position && typeof position === 'object' && !Array.isArray(position)) {
        if (typeof position.clientX === 'number' && !Number.isNaN(position.clientX)) {
            x = position.clientX;
            y = typeof position.clientY === 'number' ? position.clientY : y;
        } else if (typeof position.pageX === 'number' && !Number.isNaN(position.pageX)) {
            x = position.pageX - (window.scrollX || 0);
            y = (typeof position.pageY === 'number' ? position.pageY : y) - (window.scrollY || 0);
        } else if (typeof position.x === 'number') {
            // Координаты относительно контейнера карты (ymaps position)
            const mapContainer = window.map?.container?.getElement?.();
            const mapRect = mapContainer?.getBoundingClientRect?.();
            if (mapRect) {
                x = mapRect.left + (position.x || 0);
                y = mapRect.top + (position.y || 0);
            }
        }
    } else if (Array.isArray(position)) {
        const mapContainer = window.map?.container?.getElement?.();
        const mapRect = mapContainer?.getBoundingClientRect?.();
        if (mapRect) {
            x = mapRect.left + (position[0] || 0);
            y = mapRect.top + (position[1] || 0);
        }
    }

    const menuWidth = 208;
    const menuHeight = 92;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const maxLeft = Math.max(12, viewportWidth - menuWidth - 12);
    const maxTop = Math.max(12, viewportHeight - menuHeight - 12);

    menu.style.position = 'fixed';
    menu.style.left = `${Math.min(maxLeft, Math.max(12, x))}px`;
    menu.style.top = `${Math.min(maxTop, Math.max(12, y))}px`;
    menu.classList.remove('hidden');
};

window.createMapMarkerFromContext = function() {
    window.hideMapContextMenu();
    if (window.toggleAddModal) window.toggleAddModal(false, window.tempAddCoords);
};

window.isOsmMap = function() {
    return (window.mapProvider || 'yandex') === 'osm';
};

window.destroyCurrentMap = function() {
    if (window.clearMapRoutes) window.clearMapRoutes();
    if (window.markerCache) {
        window.markerCache.clear();
    }
    window.markerLayoutCache = new Map();

    if (window.map) {
        try {
            const isLeaflet = typeof L !== 'undefined' && window.map instanceof L.Map;
            if (isLeaflet) window.map.remove();
            else if (typeof window.map.destroy === 'function') window.map.destroy();
        } catch (e) {
            console.warn('destroyCurrentMap:', e);
        }
    }
    window.map = null;
    window.leafletTileLayer = null;
    window.rostovMaskLayer = null;
    window.rostovBorderLayer = null;
    window.walkerLayout = null;

    const container = document.getElementById('map');
    if (container) {
        container.innerHTML = '';
        container.classList.remove('leaflet-container', 'leaflet-touch', 'leaflet-fade-anim', 'leaflet-grab', 'leaflet-touch-drag', 'leaflet-touch-zoom');
        container.__longPressBound = false;
    }
};

window.setMapProvider = async function(provider, skipSave = false) {
    const next = provider === 'osm' ? 'osm' : 'yandex';
    if (next === 'osm' && typeof L === 'undefined') {
        window.showToast('Leaflet не загрузился — OpenStreetMap недоступен');
        return;
    }
    if (next === 'yandex' && typeof ymaps === 'undefined') {
        window.showToast('Яндекс.Карты не загрузились');
        return;
    }
    if (next === window.mapProvider && window.map) {
        if (window.refreshSettingsUI) window.refreshSettingsUI();
        return;
    }

    const playingId = window.currentPlayingId;
    window.destroyCurrentMap();
    window.mapProvider = next;
    localStorage.setItem('rosmap_map_provider', next);
    if (!skipSave && window.saveUserSettings) window.saveUserSettings('mapProvider', next);

    if (next === 'osm') {
        await window.initLeafletMap();
    } else {
        await new Promise(resolve => {
            if (typeof ymaps !== 'undefined' && ymaps.ready) ymaps.ready(() => { window.initYandexMap(); resolve(); });
            else { window.initYandexMap(); resolve(); }
        });
    }

    if (window.setMapStyle) window.setMapStyle(window.currentMapStyle || 'normal', true);
    if (window.refreshSettingsUI) window.refreshSettingsUI();
    if (playingId && window.selectSound) window.selectSound(playingId);
    if (!skipSave) {
        window.showToast(next === 'osm' ? 'Карта: OpenStreetMap (Ростовская область)' : 'Карта: Яндекс.Карты');
    }
};

window.initMap = function() {
    const provider = window.mapProvider || localStorage.getItem('rosmap_map_provider') || 'yandex';
    window.mapProvider = provider === 'osm' ? 'osm' : 'yandex';
    if (window.mapProvider === 'osm') window.initLeafletMap();
    else window.initYandexMap();
};

window.initYandexMap = function() {
    if (typeof ymaps === 'undefined') return;
    window.map = new ymaps.Map('map', { center: [47.23371, 39.74427], zoom: 15, controls: ['zoomControl'] });
    window.walkerLayout = ymaps.templateLayoutFactory.createClass(
        '<div class="walker-marker $[properties.colorClass]"><i class="fa-solid fa-person-walking"></i></div>'
    );
    window.updateMapMarkers();

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
    });

    window.initMapLongPress();
};

window.getOsmTileUrl = function() {
    const dark = document.documentElement.classList.contains('dark');
    if (dark) return {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    };
    return {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    };
};

window.refreshOsmTilesAndMask = function() {
    if (!window.isOsmMap() || !window.map || typeof L === 'undefined') return;
    const tile = window.getOsmTileUrl();
    if (window.leafletTileLayer) {
        window.map.removeLayer(window.leafletTileLayer);
    }
    window.leafletTileLayer = L.tileLayer(tile.url, {
        maxZoom: 19,
        attribution: tile.attr
    }).addTo(window.map);

    if (window.rostovMaskLayer) {
        const fill = document.documentElement.classList.contains('dark') ? '#0b1220' : '#e2e8f0';
        const stroke = document.documentElement.classList.contains('dark') ? '#475569' : '#64748b';
        window.rostovMaskLayer.setStyle({ fillColor: fill, color: stroke });
        try { window.rostovMaskLayer.bringToFront(); } catch (_) {}
    }
    if (window.rostovBorderLayer) {
        try { window.rostovBorderLayer.bringToFront(); } catch (_) {}
    }
};

window.initLeafletMap = async function() {
    if (typeof L === 'undefined') {
        window.showToast('Leaflet не загружен');
        return;
    }
    const container = document.getElementById('map');
    if (!container) return;

    window.map = L.map('map', {
        center: [47.23371, 39.74427],
        zoom: 8,
        zoomControl: true,
        attributionControl: true
    });

    window.refreshOsmTilesAndMask();

    try {
        const res = await fetch('./src/data/rostov-oblast.geojson');
        const geo = await res.json();
        const ringLngLat = geo.features?.[0]?.geometry?.coordinates?.[0] || [];
        const hole = ringLngLat.map(([lng, lat]) => [lat, lng]);
        if (hole.length > 2) {
            const world = [[-85, -180], [-85, 180], [85, 180], [85, -180]];
            const fill = document.documentElement.classList.contains('dark') ? '#0b1220' : '#e2e8f0';
            const stroke = document.documentElement.classList.contains('dark') ? '#475569' : '#64748b';
            window.rostovMaskLayer = L.polygon([world, hole], {
                stroke: true,
                color: stroke,
                weight: 1,
                fillColor: fill,
                fillOpacity: 1,
                interactive: false
            }).addTo(window.map);

            window.rostovBorderLayer = L.geoJSON(geo, {
                style: {
                    color: '#2563eb',
                    weight: 2.5,
                    fillOpacity: 0,
                    opacity: 0.95
                },
                interactive: false
            }).addTo(window.map);

            const bounds = L.latLngBounds(hole);
            window.rostovBounds = bounds;
            window.map.setMaxBounds(bounds.pad(0.2));
            window.map.options.minZoom = 6;
            window.map.fitBounds(bounds.pad(0.04));
        }
    } catch (e) {
        console.warn('Не удалось загрузить границу Ростовской области:', e);
        window.showToast('Граница региона не загрузилась — показана обычная OSM-карта');
    }

    window.map.on('contextmenu', (e) => {
        if (e.originalEvent) e.originalEvent.preventDefault();
        window.showMapContextMenu(
            [e.latlng.lat, e.latlng.lng],
            {
                clientX: e.originalEvent?.clientX,
                clientY: e.originalEvent?.clientY,
                pageX: e.originalEvent?.pageX,
                pageY: e.originalEvent?.pageY
            }
        );
    });
    window.map.on('click', () => window.hideMapContextMenu());

    window.updateMapMarkers();
    window.initMapLongPress();
    setTimeout(() => { try { window.map.invalidateSize(); } catch (_) {} }, 200);
};

window.mapSetView = function(lat, lng, zoom = 15) {
    if (!window.map) return;
    if (window.isOsmMap()) window.map.setView([lat, lng], zoom, { animate: true });
    else window.map.setCenter([lat, lng], zoom, { duration: 800 });
};

window.mapFitRoute = function(route) {
    if (!window.map || !route || route.length < 2) return;
    if (window.isOsmMap()) {
        window.map.fitBounds(L.latLngBounds(route.map(p => L.latLng(p[0], p[1]))), { padding: [40, 40], maxZoom: 15 });
    } else if (window.activePolyline) {
        window.map.setBounds(window.activePolyline.geometry.getBounds(), { checkZoomRange: true, duration: 800, zoomMargin: 40 });
    }
};

window.mapAddRouteOverlay = function(route, colorClass) {
    window.clearMapRoutes();
    if (!window.map || !route || route.length < 2) return;

    if (window.isOsmMap()) {
        window.activePolyline = L.polyline(route.map(p => [p[0], p[1]]), {
            color: '#38bdf8',
            weight: 4,
            opacity: 0.85,
            dashArray: '8 10'
        }).addTo(window.map);
        window.mapFitRoute(route);
        window.walkerMarker = L.marker(route[0], {
            icon: L.divIcon({
                className: '',
                html: `<div class="walker-marker ${colorClass}"><i class="fa-solid fa-person-walking"></i></div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            }),
            zIndexOffset: 1000
        }).addTo(window.map);
    } else if (typeof ymaps !== 'undefined') {
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
    }
};

window.setWalkerPosition = function(coords) {
    if (!window.walkerMarker || !coords) return;
    if (window.isOsmMap()) window.walkerMarker.setLatLng(coords);
    else if (window.walkerMarker.geometry) window.walkerMarker.geometry.setCoordinates(coords);
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
            let coords = null;
            if (window.isOsmMap()) {
                const rect = container.getBoundingClientRect();
                const latlng = window.map.containerPointToLatLng([start.x - rect.left, start.y - rect.top]);
                coords = [latlng.lat, latlng.lng];
            } else {
                try {
                    const projection = window.map.options.get('projection');
                    const globalPixels = window.map.converter.pageToGlobal([start.pageX, start.pageY]);
                    coords = projection.fromGlobalPixels(globalPixels, window.map.getZoom());
                } catch (_) { return; }
            }
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
        hint.textContent = window.isSoundwalkPrinciple()
            ? 'Режим прогулки: кликайте по карте, чтобы добавить точки маршрута'
            : 'Нажмите на карту, чтобы выбрать точку';
    }

    if (!window.locationPickerMap) {
        window.locationPickerMap = new ymaps.Map('location-picker-map', {
            center: initialCoords,
            zoom: 12,
            controls: ['zoomControl', 'fullscreenControl']
        });

        window.locationPickerMap.events.add('click', function (e) {
            const coords = e.get('coords');
            const point = [coords[0], coords[1]];

            if (window.isSoundwalkPrinciple()) {
                window.addModalRoute = window.addModalRoute || [];
                window.addModalRoute.push(point);
                window.tempAddCoords = window.addModalRoute[0];
                window.redrawAddModalRouteOnPicker();
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
    if (window.isSoundwalkPrinciple() && window.addModalRoute && window.addModalRoute.length) {
        window.redrawAddModalRouteOnPicker();
    } else {
        window.placeLocationPickerMarker(initialCoords);
    }
}

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
    if (!window.map) return;

    const filtered = window.getFilteredSounds ? window.getFilteredSounds() : window.soundsData || [];
    const currentActiveId = window.currentPlayingId;

    if (currentActiveId && !filtered.some(sound => sound.id === currentActiveId)) {
        window.currentPlayingId = null;
    }

    window.markerCache = window.markerCache || new Map();
    window.markerLayoutCache = window.markerLayoutCache || new Map();

    const visibleIds = new Set(filtered.map(sound => sound.id));

    window.markerCache.forEach((placemark, id) => {
        if (!visibleIds.has(id)) {
            if (window.isOsmMap()) {
                try { window.map.removeLayer(placemark); } catch (_) {}
            } else {
                window.map.geoObjects.remove(placemark);
            }
            window.markerCache.delete(id);
        }
    });

    const markerHtml = (colorClass, isSoundwalk, isAmbisonic, isSelected) =>
        `<div class="w-6 h-6 md:w-7 md:h-7 custom-marker ${colorClass} ${isSelected ? 'selected' : ''} flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110">
            ${isSoundwalk ? '<i class="fa-solid fa-route text-[11px] md:text-[13px] opacity-90"></i>' : (isAmbisonic ? '<i class="fa-solid fa-cube text-[10px] md:text-[12px] opacity-90"></i>' : '')}
        </div>`;

    const createMarkerLayout = (colorClass, id, isSoundwalk, isAmbisonic, isSelected) => {
        const layoutKey = `${colorClass}|${isSelected ? 'selected' : 'normal'}|${isSoundwalk ? 'sw' : 'n'}|${isAmbisonic ? 'amb' : 'na'}`;
        if (window.markerLayoutCache.has(layoutKey)) return window.markerLayoutCache.get(layoutKey);
        const layout = ymaps.templateLayoutFactory.createClass(
            markerHtml(colorClass, isSoundwalk, isAmbisonic, isSelected).replace('class="', `id="marker-${id}" class="`)
        );
        window.markerLayoutCache.set(layoutKey, layout);
        return layout;
    };

    filtered.forEach(sound => {
        let colorClass = sound.ecoCategory === 'geophony' ? 'marker-geo' : sound.ecoCategory === 'biophony' ? 'marker-bio' : 'marker-anthro';
        const isSoundwalk = sound.recPrinciple && sound.recPrinciple.includes('Soundwalk');
        const isAmbisonic = sound.channels && sound.channels.toLowerCase().includes('ambisonics');
        const isSelected = currentActiveId === sound.id;
        const hitRadius = isSelected ? 40 : 28;

        if (window.isOsmMap()) {
            let marker = window.markerCache.get(sound.id);
            const icon = L.divIcon({
                className: '',
                html: markerHtml(colorClass, isSoundwalk, isAmbisonic, isSelected),
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });
            if (!marker) {
                marker = L.marker([sound.lat, sound.lng], { icon, riseOnHover: true });
                marker.on('click', () => window.selectSound(sound.id));
                marker.addTo(window.map);
                window.markerCache.set(sound.id, marker);
            } else {
                marker.setLatLng([sound.lat, sound.lng]);
                marker.setIcon(icon);
            }
            return;
        }

        let placemark = window.markerCache.get(sound.id);
        if (!placemark) {
            placemark = new ymaps.Placemark([sound.lat, sound.lng], {}, {
                iconLayout: createMarkerLayout(colorClass, sound.id, isSoundwalk, isAmbisonic, isSelected),
                iconShape: { type: 'Circle', coordinates: [0, 0], radius: hitRadius },
                iconOffset: [-14, -14]
            });
            placemark.events.add('click', () => window.selectSound(sound.id));
            window.map.geoObjects.add(placemark);
            window.markerCache.set(sound.id, placemark);
        } else {
            placemark.geometry.setCoordinates([sound.lat, sound.lng]);
            placemark.options.set('iconLayout', createMarkerLayout(colorClass, sound.id, isSoundwalk, isAmbisonic, isSelected));
            placemark.options.set('iconShape', { type: 'Circle', coordinates: [0, 0], radius: hitRadius });
            placemark.options.set('iconOffset', [-14, -14]);
        }
    });
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
    if (!window.map) {
        window.activePolyline = null;
        window.walkerMarker = null;
        return;
    }
    if (window.isOsmMap() || (typeof L !== 'undefined' && window.map instanceof L.Map)) {
        if (window.activePolyline) { try { window.map.removeLayer(window.activePolyline); } catch (_) {} }
        if (window.walkerMarker) { try { window.map.removeLayer(window.walkerMarker); } catch (_) {} }
    } else {
        if (window.activePolyline) { try { window.map.geoObjects.remove(window.activePolyline); } catch (_) {} }
        if (window.walkerMarker) { try { window.map.geoObjects.remove(window.walkerMarker); } catch (_) {} }
    }
    window.activePolyline = null;
    window.walkerMarker = null;
}