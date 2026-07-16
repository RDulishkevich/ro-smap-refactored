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

    let x = 0;
    let y = 0;
    let source = null;

    if (position && typeof position === 'object' && !Array.isArray(position)) {
        if (typeof position.clientX === 'number' || typeof position.pageX === 'number') {
            x = position.clientX ?? position.pageX ?? 0;
            y = position.clientY ?? position.pageY ?? 0;
            source = 'dom';
        } else if (typeof position.x === 'number' || typeof position.y === 'number') {
            x = position.x ?? 0;
            y = position.y ?? 0;
            source = 'map';
        }
    }

    if (position && Array.isArray(position)) {
        x = position[0] ?? 0;
        y = position[1] ?? 0;
        source = 'map-array';
    }

    const mapContainer = window.map?.container?.getElement?.();
    const mapRect = mapContainer?.getBoundingClientRect ? mapContainer.getBoundingClientRect() : null;

    if (source === 'map' || source === 'map-array') {
        if (mapRect) {
            x = mapRect.left + x;
            y = mapRect.top + y;
        }
    } else if (source === 'dom') {
        x = x + (window.scrollX || 0);
        y = y + (window.scrollY || 0);
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

window.initMap = function() {
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

        const position = domEvent ? {
            clientX: domEvent.clientX ?? domEvent.pageX ?? 0,
            clientY: domEvent.clientY ?? domEvent.pageY ?? 0,
            pageX: domEvent.pageX ?? domEvent.clientX ?? 0,
            pageY: domEvent.pageY ?? domEvent.clientY ?? 0
        } : (Array.isArray(mapPosition) ? mapPosition : (mapPosition ? { x: mapPosition[0], y: mapPosition[1] } : null));

        window.showMapContextMenu(coords, position);
    });

    window.map.events.add('click', function () {
        window.hideMapContextMenu();
    });

    window.initMapLongPress();
}

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
            const projection = window.map.options.get('projection');
            const globalPixels = window.map.converter.pageToGlobal([start.pageX, start.pageY]);
            const coords = projection.fromGlobalPixels(globalPixels, window.map.getZoom());
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

window.initLocationPickerMap = function() {
    const container = document.getElementById('location-picker-map');
    if (!container || typeof ymaps === 'undefined') return;

    const initialCoords = window.tempAddCoords || window.parseCoordinateString(document.getElementById('add-coords')?.value) || [47.222, 39.718];

    if (!window.locationPickerMap) {
        window.locationPickerMap = new ymaps.Map('location-picker-map', {
            center: initialCoords,
            zoom: 12,
            controls: ['zoomControl', 'fullscreenControl']
        });

        window.locationPickerMap.events.add('click', function (e) {
            const coords = e.get('coords');
            window.tempAddCoords = [coords[0], coords[1]];
            window.placeLocationPickerMarker(window.tempAddCoords);
            const coordsInput = document.getElementById('add-coords');
            if (coordsInput) coordsInput.value = `${Number(coords[0]).toFixed(5)}, ${Number(coords[1]).toFixed(5)}`;
            const locationInput = document.getElementById('add-loc');
            if (locationInput && !locationInput.value.trim()) locationInput.value = 'Точка выбрана на карте';
        });
    }

    window.locationPickerMap.setCenter(initialCoords, 12);
    window.placeLocationPickerMarker(initialCoords);
}

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
            window.map.geoObjects.remove(placemark);
            window.markerCache.delete(id);
        }
    });

    const createMarkerLayout = (colorClass, id, isSoundwalk, isAmbisonic, isSelected) => {
        const layoutKey = `${colorClass}|${isSelected ? 'selected' : 'normal'}|${isSoundwalk ? 'sw' : 'n'}|${isAmbisonic ? 'amb' : 'na'}`;
        if (window.markerLayoutCache.has(layoutKey)) return window.markerLayoutCache.get(layoutKey);

        const layout = ymaps.templateLayoutFactory.createClass(
            `<div id="marker-${id}" class="w-6 h-6 md:w-7 md:h-7 custom-marker ${colorClass} ${isSelected ? 'selected' : ''} flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110">
                ${isSoundwalk ? '<i class="fa-solid fa-route text-[11px] md:text-[13px] opacity-90"></i>' : (isAmbisonic ? '<i class="fa-solid fa-cube text-[10px] md:text-[12px] opacity-90"></i>' : '')}
            </div>`
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
    if (window.activePolyline && window.map) { window.map.geoObjects.remove(window.activePolyline); window.activePolyline = null; }
    if (window.walkerMarker && window.map) { window.map.geoObjects.remove(window.walkerMarker); window.walkerMarker = null; }
}