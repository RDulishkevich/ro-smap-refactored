import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import L from 'leaflet';
import { pinColor } from '@polevka/design';
import type { Sound } from '@polevka/core';
import { loadYandexMaps } from './pwa';

const ROSTOV: [number, number] = [47.2313, 39.7233];
const HIT_PX = 28;

type YMap = {
  destroy: () => void;
  geoObjects: { removeAll: () => void; add: (o: unknown) => void };
  panTo: (c: number[], o?: unknown) => void;
  setBounds: (b: number[][], o?: unknown) => void;
  container: { fitToViewport: () => void };
  controls: { remove: (id: string) => void };
  getZoom: () => number;
  setZoom: (z: number, o?: unknown) => void;
  setCenter: (c: number[], o?: unknown) => void;
  converter: {
    pageToGlobal: (p: number[]) => number[];
    globalToPage: (p: number[]) => number[];
  };
  options: {
    get: (k: string) => { fromGlobalPixels: (p: number[], z: number) => number[]; toGlobalPixels: (c: number[], z: number) => number[] };
    set: (k: string, v: unknown) => void;
  };
  events: {
    add: (e: string, fn: (ev: { get: (k: string) => unknown; preventDefault?: () => void; stopPropagation?: () => void }) => void) => void;
    remove: (e: string, fn: unknown) => void;
  };
};

type YMapsApi = {
  ready: (cb: () => void) => void;
  templateLayoutFactory: { createClass: (tpl: string) => unknown };
  Map: new (el: HTMLElement, opts: object, extra?: object) => YMap;
  Placemark: new (c: number[], p: object, o: object) => {
    events: { add: (e: string, fn: (ev?: { get: (k: string) => unknown; preventDefault?: () => void; stopPropagation?: () => void }) => void) => void };
  };
  Polyline: new (c: number[][], p: object, o: object) => unknown;
};

export type MapPoint = { lat: number; lng: number };
export type MapContext = MapPoint & { sound?: Sound; clientX: number; clientY: number };
export type MapHover = { sound: Sound; clientX: number; clientY: number };
export type SoundMapHandle = {
  zoomBy: (delta: number) => void;
  flyTo: (lat: number, lng: number, zoom?: number) => void;
};

function clientPoint(ev: { get?: (k: string) => unknown; originalEvent?: MouseEvent; clientX?: number; clientY?: number } | undefined): { clientX: number; clientY: number } {
  const dom = (ev?.get?.('domEvent') || ev) as { originalEvent?: MouseEvent; get?: (k: string) => unknown; clientX?: number; clientY?: number } | undefined;
  const orig = (dom && 'originalEvent' in (dom || {}) ? dom?.originalEvent : null) || (ev as { originalEvent?: MouseEvent })?.originalEvent;
  const read = (key: 'clientX' | 'clientY') => {
    if (orig && typeof orig[key] === 'number') return orig[key];
    if (dom && typeof dom[key] === 'number') return dom[key];
    if (typeof dom?.get === 'function') {
      const v = Number(dom.get(key));
      if (Number.isFinite(v)) return v;
    }
    return NaN;
  };
  const x = read('clientX');
  const y = read('clientY');
  return {
    clientX: Number.isFinite(x) ? x : 24,
    clientY: Number.isFinite(y) ? y : 24,
  };
}

function yandexPageToCoords(map: YMap, pageX: number, pageY: number): [number, number] | null {
  try {
    const zoom = map.getZoom();
    const proj = map.options.get('projection');
    const global = map.converter.pageToGlobal([pageX, pageY]);
    const coords = proj.fromGlobalPixels(global, zoom);
    if (!coords || coords.length < 2) return null;
    return [Number(coords[0]), Number(coords[1])];
  } catch {
    return null;
  }
}

function hitTest(sounds: Sound[], clientX: number, clientY: number, project: (s: Sound) => { x: number; y: number } | null): Sound | undefined {
  let best: Sound | undefined;
  let bestD = HIT_PX * HIT_PX;
  for (const s of sounds) {
    if (s.lat == null || s.lng == null) continue;
    const pt = project(s);
    if (!pt) continue;
    const d = (pt.x - clientX) ** 2 + (pt.y - clientY) ** 2;
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

export const SoundMap = forwardRef<SoundMapHandle, {
  sounds: Sound[];
  activeId: string | number | null;
  onSelect: (s: Sound) => void;
  onPick?: (pt: MapPoint, sound?: Sound) => void;
  onContext?: (info: MapContext) => void;
  onEmpty?: () => void;
  onHover?: (info: MapHover | null) => void;
  pickMode?: boolean;
  route?: MapPoint[];
  walks?: MapPoint[][];
  pickMarker?: MapPoint | null;
  nativeZoom?: boolean;
}>(function SoundMap({
  sounds,
  activeId,
  onSelect,
  onPick,
  onContext,
  onEmpty,
  onHover,
  pickMode = false,
  route = [],
  walks = [],
  pickMarker = null,
  nativeZoom = true,
}, ref) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const nativeZoomRef = useRef(nativeZoom);
  nativeZoomRef.current = nativeZoom;
  const leafletRef = useRef<L.Map | null>(null);
  const leafletLayer = useRef<L.LayerGroup | null>(null);
  const ymapRef = useRef<YMap | null>(null);
  const ymapsRef = useRef<YMapsApi | null>(null);
  const onSelectRef = useRef(onSelect);
  const onPickRef = useRef(onPick);
  const onContextRef = useRef(onContext);
  const onEmptyRef = useRef(onEmpty);
  const onHoverRef = useRef(onHover);
  const soundsRef = useRef(sounds);
  onSelectRef.current = onSelect;
  onPickRef.current = onPick;
  onContextRef.current = onContext;
  onEmptyRef.current = onEmpty;
  onHoverRef.current = onHover;
  soundsRef.current = sounds;
  const engine = useRef<'yandex' | 'leaflet' | null>(null);
  const [ready, setReady] = useState(0);
  const pressTimer = useRef<number | null>(null);
  const lastCtx = useRef(0);
  const soundsKey = sounds.map((s) => `${s.id}:${s.lat}:${s.lng}:${s.type}`).join('|');
  const routeKey = route.map((p) => `${p.lat},${p.lng}`).join('|');
  const walksKey = walks.map((w) => w.map((p) => `${p.lat},${p.lng}`).join(';')).join('|');

  useEffect(() => {
    const el = nodeRef.current;
    if (!el) return;
    let dead = false;

    (async () => {
      const ok = await loadYandexMaps();
      if (dead || leafletRef.current || ymapRef.current) return;
      const ymaps = (window as Window & { ymaps?: YMapsApi }).ymaps;
      if (ok && ymaps) {
        ymaps.ready(() => {
          if (dead || !nodeRef.current) return;
          const map = new ymaps.Map(nodeRef.current, {
            center: ROSTOV,
            zoom: 11,
            controls: nativeZoomRef.current ? ['zoomControl'] : [],
          }, {
            suppressMapOpenBlock: true,
            yandexMapDisablePoiInteractivity: true,
            copyrightLogoVisible: false,
            copyrightProvidersVisible: false,
            copyrightUaVisible: false,
          });
          try {
            map.controls.remove('copyrightControl');
            map.options.set('copyrightLogoVisible', false);
            map.options.set('copyrightProvidersVisible', false);
            map.options.set('copyrightUaVisible', false);
          } catch { /* */ }
          ymapRef.current = map;
          ymapsRef.current = ymaps;
          engine.current = 'yandex';
          setReady((n) => n + 1);
          setTimeout(() => map.container.fitToViewport(), 200);
        });
        return;
      }
      const map = L.map(el, { zoomControl: false, attributionControl: false }).setView(ROSTOV, 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      if (nativeZoomRef.current) L.control.zoom({ position: 'bottomright' }).addTo(map);
      leafletLayer.current = L.layerGroup().addTo(map);
      leafletRef.current = map;
      engine.current = 'leaflet';
      setReady((n) => n + 1);
      setTimeout(() => map.invalidateSize(), 200);
    })();

    const ro = new ResizeObserver(() => {
      ymapRef.current?.container.fitToViewport();
      leafletRef.current?.invalidateSize();
    });
    ro.observe(el);

    return () => {
      dead = true;
      ro.disconnect();
      ymapRef.current?.destroy();
      ymapRef.current = null;
      leafletRef.current?.remove();
      leafletRef.current = null;
      engine.current = null;
    };
  }, []);

  useEffect(() => {
    const firePick = (lat: number, lng: number, sound?: Sound) => {
      onPickRef.current?.({ lat, lng }, sound);
    };
    const fireContext = (lat: number, lng: number, sound: Sound | undefined, ev: { get?: (k: string) => unknown; originalEvent?: MouseEvent; clientX?: number; clientY?: number } | undefined) => {
      const now = Date.now();
      if (now - lastCtx.current < 80) return;
      lastCtx.current = now;
      const pt = ev && 'clientX' in (ev || {}) && typeof (ev as MouseEvent).clientX === 'number'
        ? { clientX: (ev as MouseEvent).clientX, clientY: (ev as MouseEvent).clientY }
        : clientPoint(ev);
      onContextRef.current?.({ lat, lng, sound, ...pt });
    };
    const projectYandex = (s: Sound) => {
      const map = ymapRef.current;
      if (!map || s.lat == null || s.lng == null) return null;
      try {
        const zoom = map.getZoom();
        const proj = map.options.get('projection');
        const page = map.converter.globalToPage(proj.toGlobalPixels([Number(s.lat), Number(s.lng)], zoom));
        return { x: page[0] - window.scrollX, y: page[1] - window.scrollY };
      } catch {
        return null;
      }
    };
    const projectLeaflet = (s: Sound) => {
      const map = leafletRef.current;
      if (!map || s.lat == null || s.lng == null) return null;
      const pt = map.latLngToContainerPoint([Number(s.lat), Number(s.lng)]);
      const rect = map.getContainer().getBoundingClientRect();
      return { x: rect.left + pt.x, y: rect.top + pt.y };
    };

    const el = nodeRef.current;
    const nativeCtx = (e: MouseEvent) => {
      e.preventDefault();
      const list = soundsRef.current;
      const pinEl = document.elementsFromPoint(e.clientX, e.clientY)
        .map((n) => (n instanceof Element ? n.closest('.pv-pin') : null))
        .find(Boolean);
      const pinId = pinEl?.getAttribute('data-id');
      if (pinId) {
        const sound = list.find((s) => String(s.id) === pinId);
        if (sound) {
          fireContext(Number(sound.lat), Number(sound.lng), sound, e);
          return;
        }
      }
      let lat = ROSTOV[0];
      let lng = ROSTOV[1];
      let sound: Sound | undefined;
      if (engine.current === 'yandex' && ymapRef.current) {
        const coords = yandexPageToCoords(ymapRef.current, e.pageX, e.pageY);
        if (coords) { lat = coords[0]; lng = coords[1]; }
        sound = hitTest(list, e.clientX, e.clientY, projectYandex);
      } else if (leafletRef.current) {
        const ll = leafletRef.current.mouseEventToLatLng(e);
        lat = ll.lat;
        lng = ll.lng;
        sound = hitTest(list, e.clientX, e.clientY, projectLeaflet);
      }
      if (sound) {
        fireContext(Number(sound.lat), Number(sound.lng), sound, e);
        return;
      }
      window.setTimeout(() => {
        if (Date.now() - lastCtx.current < 120) return;
        fireContext(lat, lng, undefined, e);
      }, 0);
    };
    el?.addEventListener('contextmenu', nativeCtx, true);
    const hoverOk = () => !(window.matchMedia && window.matchMedia('(hover: none)').matches);
    const nativeOver = (e: MouseEvent) => {
      if (!hoverOk()) return;
      const pin = e.target instanceof Element ? e.target.closest('.pv-pin') : null;
      if (!pin) return;
      const id = pin.getAttribute('data-id');
      const sound = soundsRef.current.find((s) => String(s.id) === id);
      if (sound) onHoverRef.current?.({ sound, clientX: e.clientX, clientY: e.clientY });
    };
    const nativeOut = (e: MouseEvent) => {
      const next = e.relatedTarget instanceof Element ? e.relatedTarget.closest('.pv-pin') : null;
      if (next) return;
      onHoverRef.current?.(null);
    };
    el?.addEventListener('mouseover', nativeOver);
    el?.addEventListener('mouseout', nativeOut);

    if (engine.current === 'yandex' && ymapRef.current && ymapsRef.current) {
      const map = ymapRef.current;
      const ymaps = ymapsRef.current;
      map.geoObjects.removeAll();
      walks.forEach((w) => {
        if (w.length < 2 || !ymaps.Polyline) return;
        const line = new ymaps.Polyline(w.map((p) => [p.lat, p.lng]), {}, {
          strokeColor: '#B5613F',
          strokeWidth: 3,
          strokeOpacity: 0.4,
        });
        map.geoObjects.add(line);
      });
      if (route.length >= 2 && ymaps.Polyline) {
        const line = new ymaps.Polyline(route.map((p) => [p.lat, p.lng]), {}, {
          strokeColor: '#B5613F',
          strokeWidth: 4,
          strokeOpacity: 0.9,
        });
        map.geoObjects.add(line);
      }
      if (pickMarker) {
        const mark = new ymaps.Placemark([pickMarker.lat, pickMarker.lng], {}, {
          preset: 'islands#circleDotIcon',
          iconColor: '#2D3C39',
        });
        map.geoObjects.add(mark);
      }
      sounds.forEach((s) => {
        if (s.lat == null || s.lng == null) return;
        const color = pinColor[String(s.type)] || pinColor.urban;
        const on = String(s.id) === String(activeId);
        const size = on ? 22 : 16;
        const id = String(s.id).replace(/"/g, '');
        let layout: unknown;
        try {
          layout = ymaps.templateLayoutFactory.createClass(
            `<div class="pv-pin" data-id="${id}" style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 2px 8px rgba(45,60,57,.35);cursor:pointer"></div>`,
          );
        } catch { layout = undefined; }
        const pm = new ymaps.Placemark([Number(s.lat), Number(s.lng)], {}, layout ? {
          iconLayout: layout,
          iconShape: { type: 'Circle', coordinates: [0, 0], radius: size },
          iconOffset: [-size / 2, -size / 2],
        } : {
          preset: 'islands#circleDotIcon',
          iconColor: color,
        });
        pm.events.add('click', (e) => {
          try { e?.stopPropagation?.(); } catch { /* */ }
          onSelectRef.current(s);
        });
        pm.events.add('mouseenter', (e) => {
          if (!hoverOk()) return;
          const pt = clientPoint(e);
          onHoverRef.current?.({ sound: s, ...pt });
        });
        pm.events.add('mouseleave', () => onHoverRef.current?.(null));
        pm.events.add('contextmenu', (e) => {
          try { e?.preventDefault?.(); e?.stopPropagation?.(); } catch { /* */ }
          const dom = e?.get?.('domEvent') as { preventDefault?: () => void } | undefined;
          dom?.preventDefault?.();
          fireContext(Number(s.lat), Number(s.lng), s, e);
        });
        map.geoObjects.add(pm);
      });
      const onClick = (ev: { get: (k: string) => unknown }) => {
        if (ev.get('target') !== map) return;
        if (pickMode) {
          const coords = ev.get('coords') as number[];
          if (coords) firePick(coords[0], coords[1]);
          return;
        }
        onEmptyRef.current?.();
      };
      const onCtx = (ev: { get: (k: string) => unknown; preventDefault?: () => void }) => {
        if (ev.get('target') !== map) return;
        try { ev.preventDefault?.(); } catch { /* */ }
        const dom = ev.get('domEvent') as { preventDefault?: () => void } | undefined;
        dom?.preventDefault?.();
        const coords = ev.get('coords') as number[];
        if (coords) fireContext(coords[0], coords[1], undefined, ev);
      };
      map.events.add('click', onClick);
      map.events.add('contextmenu', onCtx);
      return () => {
        el?.removeEventListener('contextmenu', nativeCtx, true);
        el?.removeEventListener('mouseover', nativeOver);
        el?.removeEventListener('mouseout', nativeOut);
        onHoverRef.current?.(null);
        map.events.remove('click', onClick);
        map.events.remove('contextmenu', onCtx);
      };
    }

    const map = leafletRef.current;
    const layer = leafletLayer.current;
    if (!map || !layer) {
      return () => {
        el?.removeEventListener('contextmenu', nativeCtx, true);
        el?.removeEventListener('mouseover', nativeOver);
        el?.removeEventListener('mouseout', nativeOut);
      };
    }
    layer.clearLayers();
    walks.forEach((w) => {
      if (w.length < 2) return;
      L.polyline(w.map((p) => [p.lat, p.lng] as [number, number]), { color: '#B5613F', weight: 3, opacity: 0.4 }).addTo(layer);
    });
    if (route.length >= 2) {
      L.polyline(route.map((p) => [p.lat, p.lng] as [number, number]), { color: '#B5613F', weight: 4, opacity: 0.9 }).addTo(layer);
    }
    if (pickMarker) {
      L.circleMarker([pickMarker.lat, pickMarker.lng], { radius: 8, color: '#2D3C39', fillColor: '#2D3C39', fillOpacity: 1 }).addTo(layer);
    }
    sounds.forEach((s) => {
      if (s.lat == null || s.lng == null) return;
      const color = pinColor[String(s.type)] || pinColor.urban;
      const on = String(s.id) === String(activeId);
      const size = on ? 22 : 16;
      const id = String(s.id).replace(/"/g, '');
      const icon = L.divIcon({
        className: '',
        html: `<div class="pv-pin" data-id="${id}" style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 2px 8px rgba(45,60,57,.35);cursor:pointer"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      const m = L.marker([Number(s.lat), Number(s.lng)], { icon });
      m.on('click', (e) => {
        L.DomEvent.stop(e);
        onSelectRef.current(s);
      });
      m.on('mouseover', (e) => {
        if (!(window.matchMedia && window.matchMedia('(hover: none)').matches)) {
          const oe = (e as L.LeafletMouseEvent).originalEvent;
          onHoverRef.current?.({ sound: s, clientX: oe.clientX, clientY: oe.clientY });
        }
      });
      m.on('mouseout', () => onHoverRef.current?.(null));
      m.on('contextmenu', (e) => {
        L.DomEvent.stop(e);
        const oe = (e as L.LeafletMouseEvent).originalEvent;
        fireContext(Number(s.lat), Number(s.lng), s, oe);
      });
      m.addTo(layer);
    });

    const onMapClick = (e: L.LeafletMouseEvent) => {
      if (pickMode) {
        firePick(e.latlng.lat, e.latlng.lng);
        return;
      }
      onEmptyRef.current?.();
    };
    const onCtx = (e: L.LeafletMouseEvent) => {
      L.DomEvent.preventDefault(e.originalEvent);
      fireContext(e.latlng.lat, e.latlng.lng, undefined, e.originalEvent);
    };
    const onDown = (e: L.LeafletMouseEvent) => {
      if (pressTimer.current) window.clearTimeout(pressTimer.current);
      pressTimer.current = window.setTimeout(() => {
        if (pickMode) firePick(e.latlng.lat, e.latlng.lng);
        else fireContext(e.latlng.lat, e.latlng.lng, undefined, e.originalEvent);
      }, 550);
    };
    const clearPress = () => {
      if (pressTimer.current) { window.clearTimeout(pressTimer.current); pressTimer.current = null; }
    };
    map.on('click', onMapClick);
    map.on('contextmenu', onCtx);
    map.on('mousedown', onDown);
    map.on('mouseup', clearPress);
    map.on('mousemove', clearPress);
    return () => {
      el?.removeEventListener('contextmenu', nativeCtx, true);
      el?.removeEventListener('mouseover', nativeOver);
      el?.removeEventListener('mouseout', nativeOut);
      onHoverRef.current?.(null);
      map.off('click', onMapClick);
      map.off('contextmenu', onCtx);
      map.off('mousedown', onDown);
      map.off('mouseup', clearPress);
      map.off('mousemove', clearPress);
    };
  }, [soundsKey, activeId, ready, pickMode, routeKey, walksKey, pickMarker, sounds, route, walks]);

  useEffect(() => {
    if (route.length >= 2) {
      const lats = route.map((p) => p.lat);
      const lngs = route.map((p) => p.lng);
      const sw: [number, number] = [Math.min(...lats), Math.min(...lngs)];
      const ne: [number, number] = [Math.max(...lats), Math.max(...lngs)];
      if (ymapRef.current) {
        try { ymapRef.current.setBounds([sw, ne], { checkZoomRange: true, zoomMargin: 48 }); } catch { /* */ }
      } else if (leafletRef.current) {
        leafletRef.current.fitBounds([sw, ne], { padding: [28, 28], maxZoom: 16 });
      }
      return;
    }
    const s = soundsRef.current.find((x) => String(x.id) === String(activeId));
    const c = s?.lat != null && s?.lng != null
      ? [Number(s.lat), Number(s.lng)] as [number, number]
      : pickMarker
        ? [pickMarker.lat, pickMarker.lng] as [number, number]
        : null;
    if (!c) return;
    if (ymapRef.current) ymapRef.current.panTo(c, { duration: 300 });
    else leafletRef.current?.panTo(c);
  }, [activeId, pickMarker, routeKey, ready, route]);

  useImperativeHandle(ref, () => ({
    zoomBy(delta: number) {
      const leaf = leafletRef.current;
      if (leaf) {
        if (delta > 0) leaf.zoomIn();
        else leaf.zoomOut();
        return;
      }
      const y = ymapRef.current;
      if (!y) return;
      try { y.setZoom(y.getZoom() + delta); } catch { /* */ }
    },
    flyTo(lat: number, lng: number, zoom?: number) {
      const y = ymapRef.current;
      if (y) {
        y.panTo([lat, lng], { duration: 400 });
        if (zoom != null) {
          try { y.setZoom(zoom); } catch { /* */ }
        }
        return;
      }
      const leaf = leafletRef.current;
      if (leaf) leaf.flyTo([lat, lng], zoom ?? leaf.getZoom(), { duration: 0.45 });
    },
  }), []);

  return <div ref={nodeRef} className="absolute inset-0 z-0 bg-[#E4EDE9] pv-map" onContextMenu={(e) => e.preventDefault()} />;
});
