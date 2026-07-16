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

        // DomEvent Яндекс.Карт — обёртка: clientX/pageX часто undefined на самом объекте,
        // значения нужно брать через .get() или originalEvent.
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