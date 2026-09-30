import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { pinColor } from '@polevka/design';
import type { Sound } from '@polevka/core';
import { loadYandexMaps } from './pwa';

const ROSTOV: [number, number] = [47.2313, 39.7233];

type YMap = {
  destroy: () => void;
  geoObjects: { removeAll: () => void; add: (o: unknown) => void };
  panTo: (c: number[], o?: unknown) => void;
  container: { fitToViewport: () => void };
  events: { add: (e: string, fn: (ev: { get: (k: string) => unknown }) => void) => { remove: (e: string, fn: unknown) => void } };
};

type YMapsApi = {
  ready: (cb: () => void) => void;
  Map: new (el: HTMLElement, opts: object, extra?: object) => YMap;
  Placemark: new (c: number[], p: object, o: object) => {
    events: { add: (e: string, fn: () => void) => void };
  };
  Polyline: new (c: number[][], p: object, o: object) => unknown;
};

export type MapPoint = { lat: number; lng: number };

export function SoundMap({
  sounds,
  activeId,
  onSelect,
  onPick,
  pickMode = false,
  route = [],
  pickMarker = null,
}: {
  sounds: Sound[];
  activeId: string | number | null;
  onSelect: (s: Sound) => void;
  onPick?: (pt: MapPoint, sound?: Sound) => void;
  pickMode?: boolean;
  route?: MapPoint[];
  pickMarker?: MapPoint | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const leafletLayer = useRef<L.LayerGroup | null>(null);
  const ymapRef = useRef<YMap | null>(null);
  const ymapsRef = useRef<YMapsApi | null>(null);
  const onSelectRef = useRef(onSelect);
  const onPickRef = useRef(onPick);
  onSelectRef.current = onSelect;
  onPickRef.current = onPick;
  const engine = useRef<'yandex' | 'leaflet' | null>(null);
  const [ready, setReady] = useState(0);
  const pressTimer = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let dead = false;

    (async () => {
      const ok = await loadYandexMaps();
      if (dead || leafletRef.current || ymapRef.current) return;
      const ymaps = (window as Window & { ymaps?: YMapsApi }).ymaps;
      if (ok && ymaps) {
        ymaps.ready(() => {
          if (dead || !ref.current) return;
          const map = new ymaps.Map(ref.current, {
            center: ROSTOV,
            zoom: 11,
            controls: ['zoomControl'],
          }, { suppressMapOpenBlock: true });
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
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      leafletLayer.current = L.layerGroup().addTo(map);
      leafletRef.current = map;
      engine.current = 'leaflet';
      setReady((n) => n + 1);
      setTimeout(() => map.invalidateSize(), 200);
    })();

    return () => {
      dead = true;
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

    if (engine.current === 'yandex' && ymapRef.current && ymapsRef.current) {
      const map = ymapRef.current;
      const ymaps = ymapsRef.current;
      map.geoObjects.removeAll();
      if (route.length >= 2 && ymaps.Polyline) {
        const line = new ymaps.Polyline(route.map((p) => [p.lat, p.lng]), {}, {
          strokeColor: '#B5613F',
          strokeWidth: 4,
          strokeOpacity: 0.85,
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
        const pm = new ymaps.Placemark([Number(s.lat), Number(s.lng)], {}, {
          preset: 'islands#circleDotIcon',
          iconColor: color,
          iconCaption: on ? s.title : undefined,
        });
        pm.events.add('click', () => onSelectRef.current(s));
        pm.events.add('contextmenu', () => firePick(Number(s.lat), Number(s.lng), s));
        map.geoObjects.add(pm);
      });
      const onClick = (ev: { get: (k: string) => unknown }) => {
        if (!pickMode) return;
        const coords = ev.get('coords') as number[];
        if (coords) firePick(coords[0], coords[1]);
      };
      const onCtx = (ev: { get: (k: string) => unknown }) => {
        const coords = ev.get('coords') as number[];
        if (coords) firePick(coords[0], coords[1]);
      };
      map.events.add('click', onClick);
      map.events.add('contextmenu', onCtx);
      return () => {
        map.events.add('click', onClick); /* ymaps has no easy off; redraw owns listeners on next pass */
      };
    }

    const map = leafletRef.current;
    const layer = leafletLayer.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (route.length >= 2) {
      L.polyline(route.map((p) => [p.lat, p.lng] as [number, number]), { color: '#B5613F', weight: 4, opacity: 0.85 }).addTo(layer);
    }
    if (pickMarker) {
      L.circleMarker([pickMarker.lat, pickMarker.lng], { radius: 8, color: '#2D3C39', fillColor: '#2D3C39', fillOpacity: 1 }).addTo(layer);
    }
    sounds.forEach((s) => {
      if (s.lat == null || s.lng == null) return;
      const color = pinColor[String(s.type)] || pinColor.urban;
      const on = String(s.id) === String(activeId);
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:${on ? 22 : 16}px;height:${on ? 22 : 16}px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 2px 8px rgba(45,60,57,.35)"></div>`,
        iconSize: [on ? 22 : 16, on ? 22 : 16],
        iconAnchor: [on ? 11 : 8, on ? 11 : 8],
      });
      const m = L.marker([Number(s.lat), Number(s.lng)], { icon });
      m.on('click', () => onSelectRef.current(s));
      m.on('contextmenu', (e) => {
        L.DomEvent.stop(e);
        firePick(Number(s.lat), Number(s.lng), s);
      });
      m.addTo(layer);
    });

    const onMapClick = (e: L.LeafletMouseEvent) => {
      if (!pickMode) return;
      firePick(e.latlng.lat, e.latlng.lng);
    };
    const onCtx = (e: L.LeafletMouseEvent) => {
      firePick(e.latlng.lat, e.latlng.lng);
    };
    const onDown = (e: L.LeafletMouseEvent) => {
      if (pressTimer.current) window.clearTimeout(pressTimer.current);
      pressTimer.current = window.setTimeout(() => firePick(e.latlng.lat, e.latlng.lng), 550);
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
      map.off('click', onMapClick);
      map.off('contextmenu', onCtx);
      map.off('mousedown', onDown);
      map.off('mouseup', clearPress);
      map.off('mousemove', clearPress);
    };
  }, [sounds, activeId, ready, pickMode, route, pickMarker]);

  useEffect(() => {
    const s = sounds.find((x) => String(x.id) === String(activeId));
    if (s?.lat == null || s?.lng == null) return;
    const c = [Number(s.lat), Number(s.lng)] as [number, number];
    if (ymapRef.current) ymapRef.current.panTo(c, { duration: 300 });
    else leafletRef.current?.panTo(c);
  }, [activeId, sounds]);

  return <div ref={ref} className="absolute inset-0 z-0 bg-[#E4EDE9]" />;
}
