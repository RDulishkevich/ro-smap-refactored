window.initMap = function() {
    window.map = new ymaps.Map('map', { center: [47.23371, 39.74427], zoom: 15, controls: ['zoomControl'] });
    window.walkerLayout = ymaps.templateLayoutFactory.createClass(
        '<div class="walker-marker $[properties.colorClass]"><i class="fa-solid fa-person-walking"></i></div>'
    );
    window.updateMapMarkers();

    window.map.events.add('contextmenu', async function (e) {
        const coords = e.get('coords');
        const lat = coords[0].toFixed(5);
        const lng = coords[1].toFixed(5);
        const dict = window.translations[window.currentLang];
        const confirmed = await window.CustomUI.open({
            title: `<i class="fa-solid fa-location-dot mr-2 text-blue-500"></i>${dict.add_here_title || 'Новая метка'}`,
            message: `${dict.add_here_msg || 'Создать аудиометку по координатам'} <br><b class="font-mono text-slate-800 dark:text-slate-200 mt-2 block text-center bg-slate-100 dark:bg-slate-700 py-2 rounded-lg">${lat}, ${lng}</b>`,
            confirmText: dict.create || 'Создать',
            cancelText: dict.cancel || 'Отмена',
            confirmClass: 'px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-md'
        });
        if(confirmed) {
            window.toggleAddModal(false, coords);
        }
    });
}

window.updateMapMarkers = function() {
    if (!window.map) return;
    window.map.geoObjects.each(function (obj) {
        if (obj !== window.activePolyline && obj !== window.walkerMarker) {
            window.map.geoObjects.remove(obj);
        }
    });

    const createMarkerLayout = (colorClass, id, isSoundwalk, isAmbisonic) => ymaps.templateLayoutFactory.createClass(
        `<div id="marker-${id}" class="w-6 h-6 md:w-7 md:h-7 custom-marker ${colorClass} ${window.currentPlayingId === id ? 'selected' : ''} flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110">
            ${isSoundwalk ? '<i class="fa-solid fa-route text-[11px] md:text-[13px] opacity-90"></i>' : (isAmbisonic ? '<i class="fa-solid fa-cube text-[10px] md:text-[12px] opacity-90"></i>' : '')}
        </div>`
    );
            
    const filtered = window.getFilteredSounds();
    filtered.forEach(sound => {
        let colorClass = sound.ecoCategory === 'geophony' ? 'marker-geo' : sound.ecoCategory === 'biophony' ? 'marker-bio' : 'marker-anthro';
        const isSoundwalk = sound.recPrinciple && sound.recPrinciple.includes('Soundwalk');
        const isAmbisonic = sound.channels && sound.channels.toLowerCase().includes('ambisonics');
        const hitRadius = window.currentPlayingId === sound.id ? 40 : 28; 
                
        const p = new ymaps.Placemark([sound.lat, sound.lng], {}, { 
            iconLayout: createMarkerLayout(colorClass, sound.id, isSoundwalk, isAmbisonic), 
            iconShape: { type: 'Circle', coordinates: [0, 0], radius: hitRadius }, 
            iconOffset: [-14, -14] 
        });
        p.events.add('click', () => window.selectSound(sound.id));
        window.map.geoObjects.add(p);
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