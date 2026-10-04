import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LocateFixed, Minus, MoreHorizontal, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { apiSyncJson, pendingSounds, type Sound } from '@polevka/core';
import { color, spring, tap, typeMeta } from '@polevka/design';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useData } from '../state/DataContext';
import { useUi } from '../state/UiContext';
import { useAuth } from '../state/AuthContext';
import { NavBar, PinPlayer, SoundTypeTag } from '../primitives/ui';
import { HoverMenu } from '../primitives/HoverMenu';
import { MapFab } from '../primitives/chrome';
import { SoundMap, type MapContext, type MapHover, type MapPoint, type SoundMapHandle } from '../lib/SoundMap';
import { CatalogFilters } from '../primitives/filters';
import { normalizeRoute, soundRoute } from '../lib/sound-media';
import { downloadSound } from '../lib/download-sound';
import { usePrefs } from '../state/PrefsContext';

export function MapScreen({ showNav = true, desktop = false, hidePlayer = false, onFabChange }: {
  showNav?: boolean;
  desktop?: boolean;
  hidePlayer?: boolean;
  onFabChange?: (open: boolean) => void;
}) {
  const { push } = useNav();
  const { openMenu, toast, confirm } = useUi();
  const { prefs } = usePrefs();
  const { isLoggedIn, isStaff } = useAuth();
  const th = useTh();
  const {
    filteredSounds, allSounds, playingId, playing, progress, togglePlay, seek, volume, muted, setVolume, toggleMute,
    pickMode, setPickMode, pickedPoint, setPickedPoint, routeDraft, setRouteDraft, routePreview, reload,
    focused, setFocused,
  } = useData();
  const active = focused;
  const setActive = setFocused;
  const [fabOpen, setFabOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [hover, setHover] = useState<MapHover | null>(null);
  const mapRef = useRef<SoundMapHandle | null>(null);
  useEffect(() => { onFabChange?.(fabOpen); }, [fabOpen, onFabChange]);
  const onSelect = useCallback((s: Sound) => {
    setActive(s);
    setFabOpen(false);
    if (prefs.autoplayPin) togglePlay(s);
  }, [setActive, prefs.autoplayPin, togglePlay]);
  const onEmpty = useCallback(() => {
    setActive(null);
    setFabOpen(false);
  }, [setActive]);

  const onContext = useCallback((info: MapContext) => {
    const at = { x: info.clientX, y: info.clientY };
    if (info.sound) {
      const s = info.sound;
      const items: Array<{ label: string; danger?: boolean; onClick: () => void }> = [
        { label: 'Слушать', onClick: () => togglePlay(s) },
        { label: 'Подробнее', onClick: () => push({ type: 'sound-detail', sound: s }) },
      ];
      if (isStaff && s.status === 'pending') {
        items.push(
          { label: 'Одобрить', onClick: () => {
            void (async () => {
              try { await apiSyncJson('map_data.json', [{ ...s, status: 'published' }]); toast('Опубликовано'); await reload(); }
              catch (e: unknown) { toast((e as Error).message); }
            })();
          } },
          { label: 'Отклонить', danger: true, onClick: () => {
            void (async () => {
              const ok = await confirm({ title: 'Отклонить?', body: s.title, ok: 'Отклонить' });
              if (!ok) return;
              try { await apiSyncJson('map_data.json', [{ ...s, status: 'rejected' }]); toast('Отклонено'); await reload(); }
              catch (e: unknown) { toast((e as Error).message); }
            })();
          } },
        );
      }
      openMenu(items, s.title, at);
      return;
    }
    openMenu([
      { label: 'Добавить запись здесь', onClick: () => {
        if (!isLoggedIn) {
          push({ type: 'auth' });
          toast('Войдите, чтобы поставить точку публикации');
          return;
        }
        setPickedPoint({ lat: info.lat, lng: info.lng });
        push({ type: 'add-sound' });
      } },
    ], 'Карта', at);
  }, [setActive, togglePlay, push, isStaff, isLoggedIn, setPickedPoint, toast, openMenu, reload, confirm]);

  const routes = useMemo(() => {
    if (routePreview.length) return routePreview;
    if (routeDraft.length) return routeDraft;
    return soundRoute(focused);
  }, [routePreview, routeDraft, focused]);

  const download = async (s: Sound) => downloadSound(s, toast);

  const onPick = useCallback((pt: MapPoint, sound?: Sound) => {
    if (pickMode === 'point') {
      setPickedPoint(pt);
      toast('Точка выбрана');
      return;
    }
    if (pickMode === 'route') {
      setRouteDraft((prev) => [...prev, pt]);
      toast('Точка маршрута добавлена');
      return;
    }
    if (sound && isStaff) {
      setActive(sound);
      return;
    }
    if (!isLoggedIn) {
      push({ type: 'auth' });
      toast('Войдите, чтобы поставить точку публикации');
      return;
    }
    setPickedPoint(pt);
    push({ type: 'add-sound' });
    toast('Точка для публикации');
  }, [pickMode, setPickedPoint, setPickMode, setRouteDraft, isStaff, isLoggedIn, push, toast, openMenu, allSounds, reload, confirm]);

  const uniquePins = useMemo(() => {
    const pins = isStaff ? [...filteredSounds, ...pendingSounds(allSounds)] : filteredSounds;
    return pins.filter((s, i, arr) => arr.findIndex((x) => String(x.id) === String(s.id)) === i);
  }, [isStaff, filteredSounds, allSounds]);

  const walks = useMemo(() => {
    return uniquePins
      .map((s) => normalizeRoute(s.route))
      .filter((r) => r.length >= 2);
  }, [uniquePins]);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: th.phoneBg }}>
      <div className="relative flex-1 min-h-0">
        <SoundMap ref={mapRef} sounds={uniquePins} activeId={active?.id ?? null} onSelect={onSelect}
          onPick={onPick} onContext={onContext} onEmpty={onEmpty} onHover={setHover} pickMode={!!pickMode}
          route={routes} walks={walks} pickMarker={pickedPoint} nativeZoom={desktop} />
        {!desktop && (
        <div className="absolute top-3 right-3 flex gap-2 z-[400]" onClick={(e) => e.stopPropagation()}>
          <motion.button whileTap={tap.cta} onClick={(e) => { e.stopPropagation(); push({ type: 'search' }); }}
            className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-md" style={{ background: th.cardBg }} aria-label="Поиск">
            <Search size={16} style={{ color: color.olive }} />
          </motion.button>
          <motion.button whileTap={tap.cta} onClick={(e) => { e.stopPropagation(); setShowFilters((v) => !v); }}
            className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-md" style={{ background: th.cardBg }} aria-label="Фильтры" aria-pressed={showFilters}>
            <SlidersHorizontal size={16} style={{ color: showFilters ? color.accent : color.olive }} />
          </motion.button>
          <HoverMenu title="Карта" items={[
            { label: 'Открыть запись', onClick: () => active && push({ type: 'sound-detail', sound: active }) },
            { label: 'Указать точку публикации', onClick: () => { setPickMode('point'); toast('Коснитесь карты'); } },
          ]}>
            <span className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-md" style={{ background: th.cardBg }}>
              <MoreHorizontal size={16} style={{ color: color.olive }} />
            </span>
          </HoverMenu>
        </div>
        )}
        {!desktop && (
        <div className="absolute bottom-3 left-3 z-[400] flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
          <motion.button whileTap={tap.cta} onClick={() => mapRef.current?.zoomBy(1)}
            className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-md" style={{ background: th.cardBg }} aria-label="Приблизить">
            <Plus size={16} style={{ color: color.olive }} />
          </motion.button>
          <motion.button whileTap={tap.cta} onClick={() => mapRef.current?.zoomBy(-1)}
            className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-md" style={{ background: th.cardBg }} aria-label="Отдалить">
            <Minus size={16} style={{ color: color.olive }} />
          </motion.button>
          <motion.button whileTap={tap.cta} onClick={() => {
            if (!navigator.geolocation) { toast('Геолокация недоступна'); return; }
            navigator.geolocation.getCurrentPosition(
              (pos) => mapRef.current?.flyTo(pos.coords.latitude, pos.coords.longitude, 14),
              () => toast('Не удалось определить место'),
              { enableHighAccuracy: true, timeout: 7000 },
            );
          }}
            className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-md" style={{ background: th.cardBg }} aria-label="Моё место">
            <LocateFixed size={16} style={{ color: color.olive }} />
          </motion.button>
        </div>
        )}
        {!desktop && (
        <AnimatePresence>
          {showFilters && (
            <motion.div className="absolute top-[4.25rem] left-3 right-3 z-[400] rounded-3xl p-3 shadow-lg" style={{ background: th.cardBg }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={spring.fade}
              onClick={(e) => e.stopPropagation()}>
              <CatalogFilters />
            </motion.div>
          )}
        </AnimatePresence>
        )}
        {pickMode && (
          <div className="absolute top-[4.25rem] left-3 right-3 z-[399] rounded-3xl px-3 py-2.5 text-[11px] font-semibold text-white" style={{ background: color.accent }}>
            {pickMode === 'route' ? 'Маршрут: нажимайте точки. Долгое нажатие или ПКМ.' : 'Выберите точку на карте (клик или долгое нажатие).'}
            <button className="ml-2 underline" onClick={() => setPickMode(null)}>готово</button>
          </div>
        )}
        {hover && (
          <MarkerHover sound={hover.sound} x={hover.clientX} y={hover.clientY} />
        )}
        <AnimatePresence>
          {active && !hidePlayer && !fabOpen && (
            <motion.div className={`absolute z-[400] ${desktop ? 'bottom-4 left-4 right-24 max-w-md' : 'bottom-0 left-3 right-3'}`}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
              transition={spring.sheet}
              onClick={(e) => e.stopPropagation()}>
              <PinPlayer sound={active} simple={desktop} onClose={() => setActive(null)} playing={playing && String(playingId) === String(active.id)}
                onToggle={() => togglePlay(active)} progress={progress}
                onOpen={() => push({ type: 'sound-detail', sound: active })}
                onSeek={seek} volume={volume} muted={muted} onVolume={setVolume} onMute={toggleMute}
                onDownload={() => void download(active)} />
            </motion.div>
          )}
        </AnimatePresence>
        {desktop && (
          <div className="absolute bottom-5 right-5 z-[400]" onClick={(e) => e.stopPropagation()}>
            <MapFab open={fabOpen} onToggle={() => { setFabOpen((o) => !o); }} />
          </div>
        )}
      </div>
      {showNav && (
        <div className="relative flex-shrink-0 z-[401]">
          <div style={{
            background: th.navBg,
            borderTop: `1px solid ${th.border}`,
            maskImage: 'radial-gradient(circle 36px at 50% 0%, transparent 34px, black 36px)',
            WebkitMaskImage: 'radial-gradient(circle 36px at 50% 0%, transparent 34px, black 36px)',
          }}>
            <NavBar hollowCenter />
          </div>
          <div className="absolute left-1/2 z-20" style={{ top: 0, transform: 'translate(-50%, -50%)' }} onClick={(e) => e.stopPropagation()}>
            <MapFab open={fabOpen} onToggle={() => setFabOpen((o) => !o)} from="center" />
          </div>
        </div>
      )}
    </div>
  );
}

const ECO: Record<string, string> = {
  geophony: 'Геофония',
  biophony: 'Биофония',
  anthrophony: 'Антропофония',
};

function MarkerHover({ sound, x, y }: { sound: Sound; x: number; y: number }) {
  const th = useTh();
  const photo = (sound.images || []).find(Boolean);
  const desc = (sound.description || '').trim();
  const short = desc.length > 90 ? `${desc.slice(0, 87)}…` : desc;
  const type = typeMeta[String(sound.type)];
  const left = Math.min(x + 14, typeof window !== 'undefined' ? window.innerWidth - 276 : x + 14);
  const top = Math.max(12, y - 12);
  return (
    <div className="fixed z-[450] pointer-events-none w-64 rounded-2xl overflow-hidden shadow-[0_12px_32px_rgba(45,60,57,0.22)]"
      style={{ left, top, transform: 'translateY(-100%)', background: th.cardBg, border: `1px solid ${th.border}` }}>
      {photo && (
        <div className="h-28 overflow-hidden">
          <img src={photo} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <SoundTypeTag type={String(sound.type)} />
          {sound.ecoCategory && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: th.lightBg, color: color.olive }}>
              {ECO[sound.ecoCategory] || type?.label || 'Звук'}
            </span>
          )}
        </div>
        <p className="text-xs font-bold leading-snug" style={{ color: th.inkText }}>{sound.title || 'Без названия'}</p>
        <p className="text-[10px] mt-0.5 truncate" style={{ color: color.olive }}>
          {[sound.duration, sound.recordist || sound.user, sound.location].filter(Boolean).join(' · ')}
        </p>
        {short && <p className="text-[10px] mt-1.5 leading-snug" style={{ color: color.sage }}>{short}</p>}
      </div>
    </div>
  );
}
