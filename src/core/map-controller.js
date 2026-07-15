export function createMapController() {
    const state = {
        map: null,
        activePolyline: null,
        walkerMarker: null,
        walkerLayout: null,
    };

    function ensureMap() {
        return state.map || window.map || null;
    }

    function clearRoutes() {
        const map = ensureMap();
        if (state.activePolyline && map) {
            map.geoObjects.remove(state.activePolyline);
            state.activePolyline = null;
        }
        if (state.walkerMarker && map) {
            map.geoObjects.remove(state.walkerMarker);
            state.walkerMarker = null;
        }
    }

    function centerOnSound(sound) {
        const map = ensureMap();
        if (!map) return;
        if (sound.route && sound.route.length > 1) {
            state.activePolyline = new ymaps.Polyline(sound.route, {}, {
                strokeColor: '#38bdf8',
                strokeWidth: 4,
                strokeOpacity: 0.8,
                strokeStyle: 'shortdash'
            });
            map.geoObjects.add(state.activePolyline);
            map.setBounds(state.activePolyline.geometry.getBounds(), {
                checkZoomRange: true,
                duration: 800,
                zoomMargin: 40
            });
        } else {
            map.setCenter([sound.lat, sound.lng], 15, { duration: 800 });
        }
    }

    return {
        state,
        clearRoutes,
        centerOnSound,
        ensureMap
    };
}
