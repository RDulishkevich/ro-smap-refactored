import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { color, spring } from '@polevka/design';
import { RAIL_BANNER_MS, RAIL_BANNERS, type RailBanner } from '../lib/rail-banners';
import { useNav, type DesktopView } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';

export function RailBannerCarousel() {
  const th = useTh();
  const { setDesktopView, reset, push } = useNav();
  const [i, setI] = useState(0);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const banner = RAIL_BANNERS[i % RAIL_BANNERS.length];

  useEffect(() => {
    const id = window.setInterval(() => setI((n) => n + 1), RAIL_BANNER_MS);
    return () => window.clearInterval(id);
  }, []);

  const open = (item: RailBanner) => {
    if (item.action === 'guessr') {
      reset();
      push({ type: 'guessr' });
      return;
    }
    reset();
    setDesktopView(item.action as DesktopView);
  };

  const showImg = !!banner.image && !broken[banner.id];

  return (
    <div className="flex-1 min-h-[10.5rem] flex flex-col justify-end px-1 pb-3">
      <div className="relative h-[10.25rem] rounded-2xl overflow-hidden" style={{ background: banner.tint }}>
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
      </div>
      <div className="flex justify-center gap-1 mt-1.5">
        {RAIL_BANNERS.map((b, idx) => (
          <button
            key={b.id}
            type="button"
            aria-label={`Баннер ${idx + 1}`}
            onClick={() => setI(idx)}
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: idx === i % RAIL_BANNERS.length ? color.mist : th.border }} />
        ))}
      </div>
    </div>
  );
}
