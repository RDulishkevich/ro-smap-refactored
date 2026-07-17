/** Google Maps Photorealistic 3D (Maps JavaScript API maps3d) — UI label: Google Earth 3D. */

window.getGoogleMapsApiKey = function() {
    try {
        return (localStorage.getItem('rosmap_google_maps_key') || window.GOOGLE_MAPS_API_KEY || '').trim();
    } catch (_) {
        return String(window.GOOGLE_MAPS_API_KEY || '').trim();
    }
};

window.saveGoogleMapsApiKey = function(key) {
    const next = String(key || '').trim();
    try {
        if (next) localStorage.setItem('rosmap_google_maps_key', next);
        else localStorage.removeItem('rosmap_google_maps_key');
    } catch (_) {}
    window.GOOGLE_MAPS_API_KEY = next;
    if (window.refreshSettingsUI) window.refreshSettingsUI();
    if (window.currentMapProvider === 'googleearth') {
        if (next) window.remountMainMap();
        else if (window.showToast) window.showToast('Укажите ключ Google Maps');
    }
};

window.loadGoogleMaps3d = function(apiKey) {
    if (window.__googleMapsLoading) return window.__googleMapsLoading;

    window.__googleMapsLoading = (async () => {
        if (!window.google?.maps?.importLibrary) {
            await new Promise((resolve, reject) => {
                const existing = document.querySelector('script[data-google-maps-js]');
                if (existing) {
                    existing.addEventListener('load', resolve);
                    existing.addEventListener('error', () => reject(new Error('Google Maps script error')));
                    return;
                }
                // Official async bootstrap
                window.__googleMapsInitCallbacks = window.__googleMapsInitCallbacks || [];
                window.__googleMapsInitCallbacks.push(resolve);
                if (!window.__googleMapsCallback) {
                    window.__googleMapsCallback = () => {
                        (window.__googleMapsInitCallbacks || []).forEach((fn) => {
                            try { fn(); } catch (_) {}
                        });
                        window.__googleMapsInitCallbacks = [];
                    };
                }
                const script = document.createElement('script');
                script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=__googleMapsCallback`;
                script.async = true;
                script.defer = true;
                script.setAttribute('data-google-maps-js', '1');
                script.onerror = () => reject(new Error('Google Maps script error'));
                document.head.appendChild(script);
            });
        }
        if (!window.google?.maps?.importLibrary) {
            throw new Error('Google Maps importLibrary unavailable');
        }
        return window.google.maps.importLibrary('maps3d');
    })().finally(() => { window.__googleMapsLoading = null; });

    return window.__googleMapsLoading;
};

window.destroyGoogleEarthMap = function() {
    window.clearGoogleEarthRoutes();
    if (window.googleEarthMarkerCache) {
        window.googleEarthMarkerCache.forEach((marker) => {
            try { marker.remove(); } catch (_) {
                try { marker.parentElement?.removeChild(marker); } catch (__) {}
            }
        });
        window.googleEarthMarkerCache.clear();
    }
    if (window.googleEarthMapEl) {
        try { window.googleEarthMapEl.remove(); } catch (_) {}
        window.googleEarthMapEl = null;
    }
    window.googleEarthLibs = null;
};

window.clearGoogleEarthRoutes = function() {
    if (window.googleEarthPolyline) {
        try { window.googleEarthPolyline.remove(); } catch (_) {
            try { window.googleEarthPolyline.parentElement?.removeChild(window.googleEarthPolyline); } catch (__) {}
        }
        window.googleEarthPolyline = null;
    }
    if (window.googleEarthWalker) {
        try { window.googleEarthWalker.remove(); } catch (_) {
            try { window.googleEarthWalker.parentElement?.removeChild(window.googleEarthWalker); } catch (__) {}
        }
        window.googleEarthWalker = null;
    }
    if (window.activePolyline && window.activePolyline.__googleearth) window.activePolyline = null;
    if (window.walkerMarker && window.walkerMarker.__googleearth) window.walkerMarker = null;
};

window.createGoogleEarthMarkerElement = function(sound, colorClass, isSelected) {
    if (window.createMapboxMarkerElement) {
        return window.createMapboxMarkerElement(sound, colorClass, isSelected);
    }
    const el = document.createElement('div');
    el.id = `marker-${sound.id}`;
    el.className = `w-6 h-6 md:w-7 md:h-7 custom-marker ${colorClass} ${isSelected ? 'selected' : ''}`;
    return el;
};

window.updateGoogleEarthMarkers = function() {
    if (!window.googleEarthMapEl || !window.googleEarthLibs) return;
    const { Marker3DElement, AltitudeMode } = window.googleEarthLibs;
    const filtered = window.getFilteredSounds ? window.getFilteredSounds() : window.soundsData || [];
    const currentActiveId = window.currentPlayingId;
    if (currentActiveId && !filtered.some((s) => s.id === currentActiveId)) {
        window.currentPlayingId = null;
    }
    const activeId = window.currentPlayingId;
    window.googleEarthMarkerCache = window.googleEarthMarkerCache || new Map();
    const visibleIds = new Set(filtered.map((s) => s.id));

    window.googleEarthMarkerCache.forEach((marker, id) => {
        if (!visibleIds.has(id)) {
            try { marker.remove(); } catch (_) {}
            window.googleEarthMarkerCache.delete(id);
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
        let marker = window.googleEarthMarkerCache.get(sound.id);
        if (!marker) {
            const el = window.createGoogleEarthMarkerElement(sound, colorClass, isSelected);
            marker = new Marker3DElement({
                position: { lat: sound.lat, lng: sound.lng, altitude: 0 },
                altitudeMode: AltitudeMode?.CLAMP_TO_GROUND || 'CLAMP_TO_GROUND',
                drawsWhenOccluded: true
            });
            // Custom HTML content for Marker3DElement
            try {
                marker.append(el);
            } catch (_) {
                const slot = document.createElement('div');
                slot.appendChild(el);
                marker.append(slot);
            }
            window.googleEarthMapEl.append(marker);
            window.googleEarthMarkerCache.set(sound.id, marker);
        } else {
            try {
                marker.position = { lat: sound.lat, lng: sound.lng, altitude: 0 };
            } catch (_) {}
            const dom = document.getElementById(`marker-${sound.id}`);
            if (dom) {
                dom.classList.toggle('selected', !!isSelected);
                dom.classList.remove('marker-geo', 'marker-bio', 'marker-anthro');
                dom.classList.add(colorClass);
            }
        }
    });
};

window.googleEarthSetView = function(lat, lng, zoom = 15) {
    if (!window.googleEarthMapEl) return;
    // Map3DElement uses center + range (meters) instead of classic zoom
    const range = Math.max(180, Math.round(1200000 / Math.pow(2, zoom)));
    try {
        window.googleEarthMapEl.center = { lat, lng, altitude: 120 };
        window.googleEarthMapEl.range = range;
        window.googleEarthMapEl.tilt = Math.max(Number(window.googleEarthMapEl.tilt) || 0, 55);
    } catch (_) {}
};

window.googleEarthAddRouteOverlay = function(route, colorClass) {
    window.clearGoogleEarthRoutes();
    if (!window.googleEarthMapEl || !window.googleEarthLibs || !route || route.length < 2) return;
    const { Polyline3DElement, Marker3DElement, AltitudeMode } = window.googleEarthLibs;
    try {
        if (Polyline3DElement) {
            const poly = new Polyline3DElement({
                altitudeMode: AltitudeMode?.CLAMP_TO_GROUND || 'CLAMP_TO_GROUND',
                strokeColor: '#38bdf8',
                strokeWidth: 4
            });
            // coordinates as LatLngAltitudeLiteral path
            const path = route.map((pt) => ({ lat: pt[0], lng: pt[1], altitude: 0 }));
            try {
                poly.path = path;
            } catch (_) {
                path.forEach((p) => {
                    try { poly.append(JSON.stringify(p)); } catch (__) {}
                });
            }
            window.googleEarthMapEl.append(poly);
            window.googleEarthPolyline = poly;
        }
        if (Marker3DElement) {
            const el = document.createElement('div');
            el.className = `walker-marker ${colorClass || ''}`.trim();
            el.innerHTML = '<i class="fa-solid fa-person-walking"></i>';
            const walker = new Marker3DElement({
                position: { lat: route[0][0], lng: route[0][1], altitude: 0 },
                altitudeMode: AltitudeMode?.CLAMP_TO_GROUND || 'CLAMP_TO_GROUND'
            });
            walker.append(el);
            window.googleEarthMapEl.append(walker);
            window.googleEarthWalker = walker;
            window.walkerMarker = {
                __googleearth: true,
                geometry: {
                    setCoordinates(latLng) {
                        if (window.googleEarthWalker) {
                            try {
                                window.googleEarthWalker.position = {
                                    lat: latLng[0],
                                    lng: latLng[1],
                                    altitude: 0
                                };
                            } catch (_) {}
                        }
                    }
                }
            };
        }
        window.activePolyline = { __googleearth: true };
        const mid = route[Math.floor(route.length / 2)] || route[0];
        window.googleEarthSetView(mid[0], mid[1], 14);
    } catch (err) {
        console.warn('Google Earth route overlay failed', err);
    }
};

window.initGoogleEarthMap = async function() {
    const key = window.getGoogleMapsApiKey();
    const container = document.getElementById('map');
    if (!container) return;

    if (!key) {
        container.innerHTML = '';
        container.classList.add('is-map-provider-placeholder');
        container.innerHTML = `<div class="map-provider-placeholder">
            <i class="fa-solid fa-globe text-2xl mb-3 opacity-50"></i>
            <p class="font-bold">Нужен ключ Google Maps</p>
            <p class="text-sm opacity-80 mt-1">Photorealistic 3D (Google Earth) требует API-ключ Maps JavaScript API.</p>
            <p class="text-[11px] opacity-60 mt-2">Включите Maps JavaScript API в <a class="underline" href="https://console.cloud.google.com/google/maps-apis" target="_blank" rel="noopener">Google Cloud Console</a>.</p>
        </div>`;
        window.__mainMapReady = false;
        return;
    }

    let libs;
    try {
        libs = await window.loadGoogleMaps3d(key);
    } catch (err) {
        console.warn(err);
        if (window.showToast) window.showToast('Не удалось загрузить Google Earth 3D');
        return;
    }

    const { Map3DElement, MapMode, Marker3DElement, Polyline3DElement, AltitudeMode } = libs;
    if (!Map3DElement) {
        if (window.showToast) window.showToast('maps3d недоступен для этого ключа');
        return;
    }

    container.innerHTML = '';
    container.classList.remove('is-mapbox', 'is-dgis', 'map-monochrome', 'is-map-provider-placeholder');
    container.classList.add('is-googleearth');

    const map3d = new Map3DElement({
        center: { lat: 47.23371, lng: 39.74427, altitude: 180 },
        range: 2200,
        tilt: 60,
        heading: -18,
        mode: MapMode?.HYBRID || 'HYBRID'
    });
    map3d.style.width = '100%';
    map3d.style.height = '100%';
    map3d.style.display = 'block';
    container.appendChild(map3d);

    window.googleEarthMapEl = map3d;
    window.googleEarthLibs = { Map3DElement, MapMode, Marker3DElement, Polyline3DElement, AltitudeMode };

    window.map = {
        __provider: 'googleearth',
        setCenter(coords, zoom) {
            window.googleEarthSetView(coords[0], coords[1], zoom);
        },
        getZoom() { return 15; },
        container: {
            getElement() { return container; }
        },
        geoObjects: { add() {}, remove() {} }
    };

    map3d.addEventListener('gmp-click', () => {
        if (window.hideMarkerHoverCard) window.hideMarkerHoverCard(true);
    });

    // Context menu via container (browser event)
    if (!container.__googleCtxBound) {
        container.__googleCtxBound = true;
        container.addEventListener('contextmenu', (e) => {
            if (window.currentMapProvider !== 'googleearth') return;
            e.preventDefault();
            // Approximate: keep last center if unproject unavailable
            const center = window.googleEarthMapEl?.center;
            if (center && typeof center.lat === 'number') {
                window.showMapContextMenu([center.lat, center.lng], {
                    clientX: e.clientX,
                    clientY: e.clientY
                });
            }
        });
    }

    if (window.updateMapMarkers) window.updateMapMarkers();
    window.__mainMapReady = true;
};
