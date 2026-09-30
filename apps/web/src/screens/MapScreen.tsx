import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Calendar, MoreHorizontal, Search, SlidersHorizontal } from 'lucide-react';
import { apiPatchSound, apiSyncJson, pendingSounds, type Sound } from '@polevka/core';
import { color } from '@polevka/design';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useData } from '../state/DataContext';
import { useUi } from '../state/UiContext';
import { useAuth } from '../state/AuthContext';
import { NavBar, PinPlayer } from '../primitives/ui';
import { MapFab } from '../primitives/chrome';
import { SoundMap, type MapPoint } from '../lib/SoundMap';
import { CatalogFilters } from '../primitives/filters';

export function MapScreen({ showNav = true }: { showNav?: boolean }) {
  const { push } = useNav();
  const { openMenu, toast, confirm } = useUi();
  const { isLoggedIn, isStaff } = useAuth();
  const th = useTh();
  const {
    filteredSounds, allSounds, playingId, playing, progress, togglePlay, seek, volume, muted, setVolume, toggleMute,
    pickMode, setPickMode, setPickedPoint, routeDraft, setRouteDraft, routePreview, reload,
  } = useData();
  const [active, setActive] = useState<Sound | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const onSelect = useCallback((s: Sound) => { setActive(s); setFabOpen(false); }, []);
  const closeAll = () => { setActive(null); setFabOpen(false); };

  const routes = useMemo(() => {
    if (routePreview.length) return routePreview;
    if (routeDraft.length) return routeDraft;
    return [];
  }, [routePreview, routeDraft]);

  const download = async (s: Sound) => {
    if (!s.url) { toast('Нет файла'); return; }
    const a = document.createElement('a');
    a.href = String(s.url);
    a.download = `${s.title || 'sound'}.wav`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    void apiPatchSound(s.id, { incDownloads: 1 }).catch(() => {});
    toast('Скачивание WAV');
  };

  const onPick = useCallback((pt: MapPoint, sound?: Sound) => {
    if (pickMode === 'point') {
      setPickedPoint(pt);
      setPickMode(null);
      toast('Точка выбрана');
      return;
    }
    if (pickMode === 'route') {
      setRouteDraft((prev) => [...prev, pt]);
      toast('Точка маршрута добавлена');
      return;
    }
    if (sound && isStaff) {
      openMenu([
        { label: 'Открыть', onClick: () => push({ type: 'sound-detail', sound }) },
        ...(sound.status === 'pending' ? [
          { label: 'Одобрить', onClick: () => {
            void (async () => {
              try { await apiSyncJson('map_data.json', [{ ...sound, status: 'published' }]); toast('Опубликовано'); await reload(); }
              catch (e: unknown) { toast((e as Error).message); }
            })();
          } },
          { label: 'Отклонить', danger: true, onClick: () => {
            void (async () => {
              const ok = await confirm({ title: 'Отклонить?', body: sound.title, ok: 'Отклонить' });
              if (!ok) return;
              try { await apiSyncJson('map_data.json', [{ ...sound, status: 'rejected' }]); toast('Отклонено'); await reload(); }
              catch (e: unknown) { toast((e as Error).message); }
            })();
          } },
        ] : []),
      ], sound.title);
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

  const pins = pickMode || isStaff ? [...filteredSounds, ...pendingSounds(allSounds).filter((s) => isStaff)] : filteredSounds;
  const uniquePins = pins.filter((s, i, arr) => arr.findIndex((x) => String(x.id) === String(s.id)) === i);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: th.phoneBg }}>
      <div className="relative flex-1" onClick={closeAll}>
        <SoundMap sounds={uniquePins} activeId={active?.id ?? null} onSelect={onSelect}
          onPick={onPick} pickMode={!!pickMode} route={routes} pickMarker={null} />
        <div className="absolute top-4 right-4 flex gap-2 z-[400]">
          <motion.button whileTap={{ scale: 0.88 }} onClick={(e) => { e.stopPropagation(); setShowFilters((v) => !v); }}
            className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-md" style={{ background: th.cardBg }}>
            <SlidersHorizontal size={14} style={{ color: color.olive }} />
          </motion.button>
          <motion.button whileTap={{ scale: 0.88 }} onClick={(e) => { e.stopPropagation(); push({ type: 'events' }); }}
            className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-md" style={{ background: th.cardBg }}>
            <Calendar size={14} style={{ color: color.olive }} />
          </motion.button>
          <motion.button whileTap={{ scale: 0.88 }} onClick={(e) => { e.stopPropagation(); push({ type: 'search' }); }}
            className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-md" style={{ background: th.cardBg }}>
            <Search size={14} style={{ color: color.olive }} />
          </motion.button>
          <motion.button whileTap={{ scale: 0.88 }} onClick={(e) => {
            e.stopPropagation();
            openMenu([
              { label: 'Открыть запись', onClick: () => active && push({ type: 'sound-detail', sound: active }) },
              { label: 'Указать точку публикации', onClick: () => { setPickMode('point'); toast('Коснитесь карты'); } },
              { label: 'Угадайка', onClick: () => push({ type: 'guessr' }) },
            ], 'Карта');
          }} className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-md" style={{ background: th.cardBg }}>
            <MoreHorizontal size={15} style={{ color: color.olive }} />
          </motion.button>
        </div>
        <AnimatePresence>
          {showFilters && (
            <motion.div className="absolute top-16 left-3 right-3 z-[400] rounded-2xl p-3 shadow-lg" style={{ background: th.cardBg }}
              initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}>
              <CatalogFilters />
            </motion.div>
          )}
        </AnimatePresence>
        {pickMode && (
          <div className="absolute top-16 left-3 right-3 z-[399] rounded-2xl px-3 py-2 text-[10px] font-semibold text-white" style={{ background: color.accent }}>
            {pickMode === 'route' ? 'Маршрут: нажимайте точки. Долгое нажатие или ПКМ.' : 'Выберите точку на карте (клик или долгое нажатие).'}
            <button className="ml-2 underline" onClick={() => setPickMode(null)}>готово</button>
          </div>
        )}
        <AnimatePresence>
          {active && (
            <motion.div className="absolute bottom-0 left-3 right-3 z-[400]" initial={{ y: 180, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 180, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}>
              <PinPlayer sound={active} onClose={() => setActive(null)} playing={playing && String(playingId) === String(active.id)}
                onToggle={() => togglePlay(active)} progress={progress}
                onOpen={() => push({ type: 'sound-detail', sound: active })}
                onSeek={seek} volume={volume} muted={muted} onVolume={setVolume} onMute={toggleMute}
                onDownload={() => void download(active)} />
            </motion.div>
          )}
        </AnimatePresence>
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
            <MapFab open={fabOpen} onToggle={() => { setFabOpen((o) => !o); setActive(null); }} />
          </div>
        </div>
      )}
    </div>
  );
}
