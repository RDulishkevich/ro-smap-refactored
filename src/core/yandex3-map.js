/**
 * Quiet parallel engine: Yandex Maps JS API 3.x
 * Provider id: `yandex3` — opt-in from Settings. Default remains API 2.1 (`yandex`).
 * Hides basemap POI via scheme customization (not possible in 2.1).
 * Scheme colors stay stock Yandex (light|dark theme only) — no UI palette tint.
 * Attribution/HTML overlays still use --font-ui via CSS.
 *
 * API 3 requires a non-empty HTTP Referer list on the key. Domains only
 * (polevka.art, localhost, 127.0.0.1) — no https:// or /*. Propagation ~15 min.
 */

window.YANDEX3_POI_CUSTOMIZATION = [
    {
        tags: { any: ['poi', 'transit_location'] },
        stylers: [{ visibility: 'off' }]
    }
];

window.getYandex3ThemeId = function getYandex3ThemeId() {
    return window.currentTheme === 'dark' ? 'dark' : 'light';
};

/** Stock scheme: POI off + optional mono. No palette/accent recolor. */
window.buildYandex3Customization = function buildYandex3Customization() {
    const rules = [
        {
            tags: { any: ['poi', 'transit_location'] },
            stylers: [{ visibility: 'off' }]
        }
    ];
    if (window.currentMapStyle === 'monochrome') {
        rules.push({ stylers: [{ saturation: -1 }] });
    }
    return rules;
};

/** Re-apply after theme / mono change. */
window.scheduleYandex3MapAppearance = function scheduleYandex3MapAppearance() {
    if (!window.applyYandex3MapAppearance) return;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            try { window.applyYandex3MapAppearance(); } catch (_) {}
        });
    });
};

/** Sync Yandex 3 map theme + stock customization (no palette tint). */
window.applyYandex3MapAppearance = function applyYandex3MapAppearance() {
    if (!window.yandex3Map) return;
    if (window.normalizeMapProvider && window.normalizeMapProvider(window.currentMapProvider) !== 'yandex3') return;

    const theme = window.getYandex3ThemeId();
    const container = document.getElementById('map');
    if (container) {
        if (window.currentMapStyle === 'monochrome') container.classList.add('map-monochrome');
        else container.classList.remove('map-monochrome');
    }

    try {
        if (typeof window.yandex3Map.update === 'function') {
            window.yandex3Map.update({ theme });
        }
    } catch (err) {
        console.warn('[yandex3] theme update failed', err);
    }

    const customization = window.buildYandex3Customization();
    const layer = window.yandex3SchemeLayer;
    if (layer && typeof layer.update === 'function') {
        try {
            layer.update({ customization });
            return;
        } catch (err) {
            console.warn('[yandex3] customization update failed', err);
        }
    }

    if (window.ymaps3?.YMapDefaultSchemeLayer && window.yandex3Map) {
        try {
            if (layer) {
                try { window.yandex3Map.removeChild(layer); } catch (_) {}
            }
            const next = new window.ymaps3.YMapDefaultSchemeLayer({ customization });
            window.yandex3Map.addChild(next);
            window.yandex3SchemeLayer = next;
        } catch (err) {
            console.warn('[yandex3] scheme recreate failed', err);
        }
    }
};

window.getYandexMapsApiKey = function getYandexMapsApiKey() {
    const fromWindow = String(window.YANDEX_MAPS_API_KEY || '').trim();
    if (fromWindow && fromWindow !== 'ваш_api_ключ_яндекс') return fromWindow;
    try {
        const scripts = document.querySelectorAll('script[src*="api-maps.yandex.ru"]');
        for (const s of scripts) {
            const m = String(s.src || '').match(/[?&]apikey=([^&]+)/i);
            if (m && m[1]) {
                const key = decodeURIComponent(m[1]);
                if (key && key !== 'ваш_api_ключ_яндекс') return key;
            }
        }
    } catch (_) {}
    return '';
};

window.__resetYmaps3Load = function __resetYmaps3Load() {
    window.__ymaps3LoadPromise = null;
};

window.loadYmaps3 = function loadYmaps3() {
    if (window.__ymaps3LoadPromise) return window.__ymaps3LoadPromise;

    window.__ymaps3LoadPromise = (async () => {
        const host = (typeof location !== 'undefined' && location.hostname) || '';

        // Prefer statically included v3 script from index.html.
        if (!window.ymaps3) {
            const key = window.getYandexMapsApiKey();
            if (!key) throw new Error('Нет API-ключа Яндекс Карт');

            await new Promise((resolve, reject) => {
                const existing = document.querySelector('script[data-ymaps3]');
                if (existing && window.ymaps3) {
                    resolve();
                    return;
                }
                if (existing) {
                    existing.addEventListener('load', () => resolve(), { once: true });
                    existing.addEventListener('error', () => reject(new Error('Скрипт API 3 не загрузился')), { once: true });
                    // Already in DOM but load may have finished before listeners.
                    setTimeout(() => {
                        if (window.ymaps3) resolve();
                    }, 50);
                    return;
                }
                const script = document.createElement('script');
                script.src = `https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(key)}&lang=ru_RU`;
                script.async = true;
                script.dataset.ymaps3 = '1';
                script.onload = () => resolve();
                script.onerror = () => reject(new Error('Скрипт API 3 не загрузился'));
                document.head.appendChild(script);
            });
        }

        if (!window.ymaps3 || !window.ymaps3.ready) {
            throw new Error(
                `ymaps3 недоступен (хост: ${host || 'unknown'}). Добавь «${host || 'localhost'}» в HTTP Referer ключа`
            );
        }

        await Promise.race([
            window.ymaps3.ready,
            new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(
                        `Таймаут API 3. Добавь домен «${host || 'localhost'}» в HTTP Referer (без https://) и подожди ~15 мин`
                    ));
                }, 15000);
            })
        ]);

        return window.ymaps3;
    })().catch((err) => {
        window.__resetYmaps3Load();
        throw err;
    });

    return window.__ymaps3LoadPromise;
};

window.destroyYandex3Map = function destroyYandex3Map() {
    if (window.clearYandex3Routes) window.clearYandex3Routes();
    if (window.yandex3MarkerCache) {
        window.yandex3MarkerCache.forEach((entry) => {
            try { entry?.marker?.remove?.(); } catch (_) {}
            try { window.yandex3Map?.removeChild?.(entry.marker); } catch (_) {}
        });
        window.yandex3MarkerCache.clear();
    }
    if (window.yandex3Map) {
        try { window.yandex3Map.destroy?.(); } catch (_) {}
        window.yandex3Map = null;
    }
    window.yandex3Listener = null;
    window.yandex3FeaturesLayer = null;
    window.yandex3SchemeLayer = null;
    window.__yandex3PointerCoords = null;
    if (window.map && window.map.__provider === 'yandex3') window.map = null;
    const container = document.getElementById('map');
    if (container) container.classList.remove('is-yandex3');
};

window.yandex3MarkerHtml = function yandex3MarkerHtml(sound, isSelected) {
    const colorClass = sound.ecoCategory === 'geophony' ? 'marker-geo'
        : sound.ecoCategory === 'biophony' ? 'marker-bio' : 'marker-anthro';
    const isSoundwalk = sound.recPrinciple && sound.recPrinciple.includes('Soundwalk');
    const isAmbisonic = sound.channels && String(sound.channels).toLowerCase().includes('ambisonics');
    const icon = isSoundwalk
        ? '<i class="icon-routing text-[11px] md:text-[13px] opacity-90"></i>'
        : (isAmbisonic ? '<i class="icon-3dcube text-[10px] md:text-[12px] opacity-90"></i>' : '');
    const el = document.createElement('div');
    el.id = `marker-${sound.id}`;
    el.className = `w-6 h-6 md:w-7 md:h-7 custom-marker ${colorClass} ${isSelected ? 'selected' : ''} flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110`;
    el.innerHTML = icon;
    el.style.cursor = 'pointer';
    el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.selectSound) window.selectSound(sound.id);
    });
    el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.openMarkerContext) window.openMarkerContext(sound.id, e);
    });
    el.addEventListener('mouseenter', () => {
        if (window.showMarkerHoverCard) window.showMarkerHoverCard(sound);
    });
    el.addEventListener('mouseleave', () => {
        if (window.hideMarkerHoverCard) window.hideMarkerHoverCard();
    });
    if (window.bindMarkerLongPress) window.bindMarkerLongPress(el, sound.id);
    return el;
};

window.updateYandex3Markers = function updateYandex3Markers() {
    if (!window.yandex3Map || !window.ymaps3) return;
    const { YMapMarker } = window.ymaps3;
    if (!YMapMarker) return;
    window.yandex3MarkerCache = window.yandex3MarkerCache || new Map();

    const filtered = window.getFilteredSounds ? window.getFilteredSounds() : (window.soundsData || []);
    const activeId = window.currentPlayingId;
    const visible = new Set(filtered.map((s) => s.id));

    window.yandex3MarkerCache.forEach((entry, id) => {
        if (!visible.has(id)) {
            try { window.yandex3Map.removeChild(entry.marker); } catch (_) {}
            window.yandex3MarkerCache.delete(id);
            if (window.__markerHoverSoundId === id && window.hideMarkerHoverCard) {
                window.hideMarkerHoverCard(true);
            }
        }
    });

    document.querySelectorAll('.custom-marker.selected').forEach((el) => el.classList.remove('selected'));

    filtered.forEach((sound) => {
        if (!Number.isFinite(sound.lat) || !Number.isFinite(sound.lng)) return;
        const isSelected = activeId === sound.id;
        const layoutKey = `${sound.id}|${sound.ecoCategory}|${isSelected ? 1 : 0}|${sound.recPrinciple || ''}|${sound.channels || ''}`;
        let entry = window.yandex3MarkerCache.get(sound.id);
        const coords = [sound.lng, sound.lat];

        if (!entry) {
            const el = window.yandex3MarkerHtml(sound, isSelected);
            const marker = new YMapMarker({ coordinates: coords, zIndex: isSelected ? 20 : 10 }, el);
            window.yandex3Map.addChild(marker);
            entry = { marker, el, layoutKey, coords };
            window.yandex3MarkerCache.set(sound.id, entry);
        } else {
            const [lng, lat] = entry.coords || [];
            if (lng !== sound.lng || lat !== sound.lat) {
                try { entry.marker.update({ coordinates: coords }); } catch (_) {
                    try { window.yandex3Map.removeChild(entry.marker); } catch (__) {}
                    const el = window.yandex3MarkerHtml(sound, isSelected);
                    entry.marker = new YMapMarker({ coordinates: coords, zIndex: isSelected ? 20 : 10 }, el);
                    entry.el = el;
                    window.yandex3Map.addChild(entry.marker);
                }
                entry.coords = coords;
            }
            if (entry.layoutKey !== layoutKey) {
                try { window.yandex3Map.removeChild(entry.marker); } catch (_) {}
                const el = window.yandex3MarkerHtml(sound, isSelected);
                entry.marker = new YMapMarker({ coordinates: coords, zIndex: isSelected ? 20 : 10 }, el);
                entry.el = el;
                entry.layoutKey = layoutKey;
                window.yandex3Map.addChild(entry.marker);
            } else if (isSelected && entry.el) {
                entry.el.classList.add('selected');
            }
        }
    });
};

window.yandex3SetView = function yandex3SetView(lat, lng, zoom = 15) {
    if (!window.yandex3Map) return;
    try {
        window.yandex3Map.setLocation({
            center: [lng, lat],
            zoom,
            duration: 800
        });
    } catch (_) {
        try {
            window.yandex3Map.setLocation({ center: [lng, lat], zoom });
        } catch (__) {}
    }
};

window.clearYandex3Routes = function clearYandex3Routes() {
    if (window.yandex3RouteFeature && window.yandex3Map) {
        try { window.yandex3Map.removeChild(window.yandex3RouteFeature); } catch (_) {}
        window.yandex3RouteFeature = null;
    }
    if (window.yandex3WalkerMarker && window.yandex3Map) {
        try { window.yandex3Map.removeChild(window.yandex3WalkerMarker); } catch (_) {}
        window.yandex3WalkerMarker = null;
    }
    if (window.activePolyline && window.activePolyline.__yandex3) window.activePolyline = null;
    if (window.walkerMarker && window.walkerMarker.__yandex3) window.walkerMarker = null;
};

window.yandex3AddRouteOverlay = function yandex3AddRouteOverlay(route) {
    window.clearYandex3Routes();
    if (!window.yandex3Map || !window.ymaps3 || !route || route.length < 2) return;
    const { YMapFeature, YMapMarker } = window.ymaps3;
    if (!YMapFeature || !YMapMarker) return;
    const coords = route.map((pt) => [pt[1], pt[0]]);
    try {
        window.yandex3RouteFeature = new YMapFeature({
            geometry: { type: 'LineString', coordinates: coords },
            style: {
                stroke: [{ width: 4, color: 'rgba(56, 189, 248, 0.85)' }]
            }
        });
        window.yandex3Map.addChild(window.yandex3RouteFeature);
        window.activePolyline = { __yandex3: true };

        const walkerEl = document.createElement('div');
        walkerEl.className = 'walker-marker';
        walkerEl.innerHTML = '<i class="icon-man"></i>';
        window.yandex3WalkerMarker = new YMapMarker({ coordinates: coords[0], zIndex: 30 }, walkerEl);
        window.yandex3Map.addChild(window.yandex3WalkerMarker);
        window.walkerMarker = { __yandex3: true };
        window.walkerMarker.setCoordinates = (latLng) => {
            if (!window.yandex3WalkerMarker || !latLng) return;
            try {
                window.yandex3WalkerMarker.update({ coordinates: [latLng[1], latLng[0]] });
            } catch (_) {}
        };

        const lngs = coords.map((c) => c[0]);
        const lats = coords.map((c) => c[1]);
        const bounds = [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)]
        ];
        try {
            window.yandex3Map.setLocation({ bounds, duration: 800 });
        } catch (_) {}
    } catch (err) {
        console.warn('yandex3 route overlay failed', err);
    }
};

window.__yandex3FallbackToClassic = function __yandex3FallbackToClassic(err) {
    console.warn('[yandex3]', err);
    const host = (typeof location !== 'undefined' && location.hostname) || '';
    const detail = String(err?.message || err || '').slice(0, 160);
    if (window.showToast) {
        window.showToast(
            detail
                || `Тихий режим недоступен с «${host}». Добавь этот домен в HTTP Referer ключа Яндекса`
        );
    }
    if (window.normalizeMapProvider && window.normalizeMapProvider(window.currentMapProvider) === 'yandex3') {
        if (window.setMapProvider) window.setMapProvider('yandex');
    }
};

window.initYandex3Map = async function initYandex3Map() {
    let ymaps3;
    try {
        ymaps3 = await window.loadYmaps3();
    } catch (err) {
        window.__yandex3FallbackToClassic(err);
        return;
    }

    const container = document.getElementById('map');
    if (!container) return;

    try {
        if (window.destroyYandex3Map) window.destroyYandex3Map();
        container.innerHTML = '';
        container.classList.add('is-yandex3');
        container.classList.remove('is-mapbox', 'is-dgis', 'is-googleearth', 'is-map-provider-placeholder');
        if (window.currentMapStyle === 'monochrome') container.classList.add('map-monochrome');
        else container.classList.remove('map-monochrome');

        const {
            YMap,
            YMapDefaultSchemeLayer,
            YMapDefaultFeaturesLayer,
            YMapListener
        } = ymaps3;

        if (!YMap || !YMapDefaultSchemeLayer) {
            throw new Error('Компоненты YMap не найдены после ymaps3.ready');
        }

        // Ensure layout has real pixels before WebGL init (absolute inset-0 can be 0 during remount).
        const rect = container.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) {
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        }

        const map = new YMap(container, {
            location: {
                center: [39.74427, 47.23371],
                zoom: 15
            },
            theme: window.getYandex3ThemeId ? window.getYandex3ThemeId() : (window.currentTheme === 'dark' ? 'dark' : 'light'),
            showScaleInCopyrights: true
        });

        // Scheme first with theme-aware customization (POI off + palette tint).
        let schemeLayer;
        const customization = window.buildYandex3Customization
            ? window.buildYandex3Customization()
            : window.YANDEX3_POI_CUSTOMIZATION;
        try {
            schemeLayer = new YMapDefaultSchemeLayer({ customization });
            map.addChild(schemeLayer);
        } catch (custErr) {
            console.warn('[yandex3] customization failed, plain scheme', custErr);
            schemeLayer = new YMapDefaultSchemeLayer();
            map.addChild(schemeLayer);
        }
        window.yandex3SchemeLayer = schemeLayer;
        if (YMapDefaultFeaturesLayer) {
            try { map.addChild(new YMapDefaultFeaturesLayer()); } catch (_) {}
        }

        // Force a paint after children attach.
        try {
            map.setLocation({
                center: [39.74427, 47.23371],
                zoom: 15,
                duration: 0
            });
        } catch (_) {}
        requestAnimationFrame(() => {
            try {
                window.dispatchEvent(new Event('resize'));
            } catch (__) {}
        });

        // Zoom controls via separate package — optional, never block map init.
        if (window.innerWidth >= 768 && typeof ymaps3.import === 'function') {
            ymaps3.import('@yandex/ymaps3-controls@0.0.1').then((controls) => {
                try {
                    const { YMapControls, YMapZoomControl } = controls || {};
                    if (YMapControls && YMapZoomControl && window.yandex3Map === map) {
                        map.addChild(new YMapControls({ position: 'right' }).addChild(new YMapZoomControl({})));
                    }
                } catch (_) {}
            }).catch(() => {});
        }

        if (YMapListener) {
            const listener = new YMapListener({
                layer: 'any',
                onClick: () => {
                    if (window.hideMarkerHoverCard) window.hideMarkerHoverCard(true);
                    if (window.hideMapContextMenu) window.hideMapContextMenu();
                },
                onActionStart: () => {
                    if (window.hideMarkerHoverCard) window.hideMarkerHoverCard(true);
                },
                onMouseMove: (_obj, event) => {
                    if (event?.coordinates) window.__yandex3PointerCoords = event.coordinates;
                }
            });
            map.addChild(listener);
            window.yandex3Listener = listener;
        }

        window.yandex3Map = map;
        window.yandex3MarkerCache = new Map();
        window.__yandex3PointerCoords = null;

        window.map = {
            __provider: 'yandex3',
            setCenter(coords, zoom, _opts) {
                const [lat, lng] = coords;
                window.yandex3SetView(lat, lng, zoom ?? 15);
            },
            getZoom() {
                try {
                    return map.zoom ?? map.location?.zoom ?? 15;
                } catch (_) {
                    return 15;
                }
            },
            container: {
                getElement() {
                    return container;
                }
            },
            geoObjects: {
                add() {},
                remove() {}
            },
            destroy() {
                window.destroyYandex3Map();
            }
        };

        container.addEventListener('contextmenu', (e) => {
            if (window.currentMapProvider !== 'yandex3') return;
            e.preventDefault();
            e.stopPropagation();
            let coords = null;
            if (Array.isArray(window.__yandex3PointerCoords) && window.__yandex3PointerCoords.length >= 2) {
                const [lng, lat] = window.__yandex3PointerCoords;
                coords = [lat, lng];
            }
            if (!coords) {
                try {
                    const center = map.center || map.location?.center;
                    if (center) coords = [center[1], center[0]];
                } catch (_) {}
            }
            if (coords && window.showMapContextMenu) {
                window.showMapContextMenu(coords, {
                    clientX: e.clientX,
                    clientY: e.clientY,
                    pageX: e.pageX,
                    pageY: e.pageY
                });
            }
        }, { capture: true });

        if (window.initMapLongPress) {
            container.__longPressBound = false;
            window.initMapLongPress();
        }

        window.__mainMapReady = true;
        if (window.updateMapMarkers) window.updateMapMarkers();
    } catch (err) {
        window.__yandex3FallbackToClassic(err);
    }
};
