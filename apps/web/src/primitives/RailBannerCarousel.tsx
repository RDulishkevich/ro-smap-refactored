import { useEffect, useState, type MouseEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { color, spring, tap } from '@polevka/design';
import { RAIL_BANNER_MS, RAIL_BANNERS, type RailBanner } from '../lib/rail-banners';
import { useNav, type DesktopView } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';

export function RailBannerCarousel() {
  const th = useTh();
  const { setDesktopView, reset, push } = useNav();
  const [i, setI] = useState(0);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const n = RAIL_BANNERS.length;
  const banner = RAIL_BANNERS[((i % n) + n) % n];

  useEffect(() => {
    const id = window.setInterval(() => setI((v) => v + 1), RAIL_BANNER_MS);
    return () => window.clearInterval(id);
  }, [i]);

  const open = (item: RailBanner) => {
    if (item.action === 'guessr') {
      void reset().then((ok) => { if (ok) push({ type: 'guessr' }); });
      return;
    }
    void reset().then((ok) => { if (ok) setDesktopView(item.action as DesktopView); });
  };

  const prev = (e: MouseEvent) => {
    e.stopPropagation();
    setI((v) => v - 1);
  };
  const next = (e: MouseEvent) => {
    e.stopPropagation();
    setI((v) => v + 1);
  };

  const showImg = !!banner.image && !broken[banner.id];

  return (
    <div className="flex-1 min-h-[10.5rem] flex flex-col justify-end px-1 pb-3">
      <div className="relative h-[10.25rem] rounded-2xl overflow-hidden group" style={{ background: banner.tint }}>
        <AnimatePresence mode="wait">
          <motion.button
            key={banner.id}
            type="button"
            onClick={() => open(banner)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={spring.fade}
            className="absolute inset-0 text-left"
            aria-label={banner.title}>
            {showImg && (
              <img
                src={banner.image}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{ objectPosition: banner.objectPosition || 'center' }}
                onError={() => setBroken((m) => ({ ...m, [banner.id]: true }))} />
            )}
            <span className="absolute inset-0" style={{ background: showImg ? 'linear-gradient(180deg, rgba(26,26,26,0) 42%, rgba(26,26,26,0.48) 100%)' : 'transparent' }} />
            <span className="absolute inset-x-2.5 bottom-2.5">
              <span className="pv-caption block font-semibold" style={{ color: '#fff' }}>{banner.title}</span>
              <span className="pv-micro block mt-0.5" style={{ color: 'rgba(255,255,255,0.84)' }}>{banner.hint}</span>
            </span>
          </motion.button>
        </AnimatePresence>
        {n > 1 && (
          <>
            <motion.button type="button" whileTap={tap.cta} onClick={prev}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 z-[2] w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(26,26,26,0.45)' }}
              aria-label="Предыдущий баннер">
              <ChevronLeft size={14} color="#fff" />
            </motion.button>
            <motion.button type="button" whileTap={tap.cta} onClick={next}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 z-[2] w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(26,26,26,0.45)' }}
              aria-label="Следующий баннер">
              <ChevronRight size={14} color="#fff" />
            </motion.button>
          </>
        )}
      </div>
      <div className="flex justify-center gap-1 mt-1.5">
        {RAIL_BANNERS.map((b, idx) => (
          <button
            key={b.id}
            type="button"
            aria-label={`Баннер ${idx + 1}`}
            onClick={() => setI(idx)}
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: idx === ((i % n) + n) % n ? color.mist : th.border }} />
        ))}
      </div>
    </div>
  );
}
