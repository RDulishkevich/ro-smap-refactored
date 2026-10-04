import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { color, spring } from '@polevka/design';
import { useTh } from '../state/ThemeContext';

const SWIPE = 48;
const CLOSE = 96;

function wrap(i: number, n: number) {
  if (n <= 0) return 0;
  return ((i % n) + n) % n;
}

export function PhotoLightbox({
  images, index, title, onClose, onIndex,
}: {
  images: string[];
  index: number;
  title?: string;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const n = images.length;
  const go = (d: number) => onIndex(wrap(index + d, n));
  const start = useRef<{ x: number; y: number } | null>(null);
  const dragY = useRef(0);
  const [y, setY] = useState(0);
  const [closing, setClosing] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const goRef = useRef(go);
  goRef.current = go;

  const finish = () => {
    if (closing) return;
    setClosing(true);
    setY((cur) => (cur >= 0 ? Math.max(cur, 160) : Math.min(cur, -160)));
  };

  useEffect(() => {
    if (!closing) return;
    const t = window.setTimeout(() => onCloseRef.current(), 280);
    return () => clearTimeout(t);
  }, [closing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowLeft') goRef.current(-1);
      if (e.key === 'ArrowRight') goRef.current(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (typeof document === 'undefined' || !n) return null;
  const fade = Math.max(0.28, 1 - Math.abs(y) / 420);

  return createPortal(
    <motion.div
      className="pv-zoomable flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Фото'}
      initial={{ opacity: 0 }}
      animate={{ opacity: closing ? 0 : fade }}
      transition={closing ? spring.fade : { type: 'tween', duration: y ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
      style={{ position: 'fixed', inset: 0, zIndex: 800, background: '#000', touchAction: 'none' }}>
      <div className="flex items-center justify-between px-3 pv-safe-top" style={{ paddingBottom: 8 }}>
        <p className="text-[12px] font-semibold text-white/80 truncate px-2">{title || 'Фото'} · {index + 1}/{n}</p>
        <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); finish(); }}
          className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }} aria-label="Закрыть">
          <X size={18} color="#fff" />
        </button>
      </div>
      <div
        className="relative flex-1 min-h-0 overflow-hidden flex items-center justify-center"
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          start.current = { x: e.clientX, y: e.clientY };
          dragY.current = 0;
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ }
        }}
        onPointerMove={(e) => {
          if (!start.current) return;
          const dx = e.clientX - start.current.x;
          const dy = e.clientY - start.current.y;
          if (Math.abs(dy) >= Math.abs(dx)) {
            dragY.current = dy;
            setY(dy);
          }
        }}
        onPointerUp={(e) => {
          if (!start.current) return;
          const dx = e.clientX - start.current.x;
          const dy = e.clientY - start.current.y;
          start.current = null;
          if (Math.abs(dy) > CLOSE && Math.abs(dy) >= Math.abs(dx)) {
            finish();
            return;
          }
          if (n > 1 && Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy)) {
            setY(0);
            if (dx > 0) go(-1);
            else go(1);
            return;
          }
          setY(0);
        }}
        onPointerCancel={() => { start.current = null; setY(0); }}>
        <motion.img
          src={images[index]}
          alt={title || ''}
          draggable={false}
          className="block mx-auto max-w-full object-contain select-none"
          style={{ maxHeight: '100%', width: 'auto', height: 'auto' }}
          animate={{ y: closing ? (y >= 0 ? y + 80 : y - 80) : y, scale: closing ? 0.92 : 1 - Math.min(0.08, Math.abs(y) / 900) }}
          transition={start.current ? { type: 'tween', duration: 0 } : spring.sheet}
        />
        {n > 1 && (
          <>
            <button type="button" aria-label="Предыдущее фото" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); go(-1); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.16)' }}>
              <ChevronLeft size={20} color="#fff" />
            </button>
            <button type="button" aria-label="Следующее фото" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); go(1); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.16)' }}>
              <ChevronRight size={20} color="#fff" />
            </button>
          </>
        )}
      </div>
    </motion.div>,
    document.body,
  );
}

export function PhotoCarousel({ images, title }: { images: string[]; title?: string }) {
  const th = useTh();
  const [i, setI] = useState(0);
  const [full, setFull] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const moved = useRef(false);
  const n = images.length;
  if (!n) return null;
  const go = (d: number) => setI((cur) => wrap(cur + d, n));

  const bindSwipe = {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      startX.current = e.clientX;
      startY.current = e.clientY;
      moved.current = false;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ }
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      if (startX.current == null) return;
      if (Math.abs(e.clientX - startX.current) > 8 || Math.abs(e.clientY - (startY.current ?? e.clientY)) > 8) moved.current = true;
    },
    onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
      if (startX.current == null) return;
      const dx = e.clientX - startX.current;
      const dy = e.clientY - (startY.current ?? e.clientY);
      startX.current = null;
      startY.current = null;
      if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) go(-1);
        else go(1);
      } else if (!moved.current) setFull(true);
    },
    onPointerCancel: () => { startX.current = null; startY.current = null; },
  };

  return (
    <>
      <div className="relative mx-4 mt-4 rounded-3xl overflow-hidden pv-carousel" style={{ background: th.lightBg, aspectRatio: '16 / 10' }} {...bindSwipe}>
        <AnimatePresence mode="wait">
          <motion.img
            key={images[i]}
            src={images[i]}
            alt={title || ''}
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={spring.fade}
          />
        </AnimatePresence>
        {n > 1 && (
          <>
            <button type="button" aria-label="Предыдущее фото" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); go(-1); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center shadow-md z-[1]"
              style={{ background: 'rgba(255,255,255,0.92)' }}>
              <ChevronLeft size={16} color={color.olive} />
            </button>
            <button type="button" aria-label="Следующее фото" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); go(1); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center shadow-md z-[1]"
              style={{ background: 'rgba(255,255,255,0.92)' }}>
              <ChevronRight size={16} color={color.olive} />
            </button>
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-[1] pointer-events-none">
              {images.map((_, nDot) => (
                <span key={nDot} className="h-1.5 rounded-full"
                  style={{ width: nDot === i ? 16 : 6, background: nDot === i ? '#fff' : 'rgba(255,255,255,0.45)' }} />
              ))}
            </div>
          </>
        )}
      </div>
      {full && (
        <PhotoLightbox images={images} index={i} title={title} onClose={() => setFull(false)} onIndex={setI} />
      )}
    </>
  );
}

export function PhotoStrip({ images, title }: { images: string[]; title?: string }) {
  const [full, setFull] = useState<number | null>(null);
  if (!images.length) return null;
  return (
    <>
      <div className="flex gap-2 overflow-x-auto mb-3 scrollbar-none px-0.5 pv-carousel">
        {images.map((src, i) => (
          <button key={src} type="button" onClick={() => setFull(i)} className="flex-shrink-0" aria-label={`${title || 'Фото'} ${i + 1}`}>
            <img src={src} alt="" className="w-20 h-20 rounded-2xl object-cover" />
          </button>
        ))}
      </div>
      {full != null && (
        <PhotoLightbox images={images} index={full} title={title} onClose={() => setFull(null)} onIndex={setFull} />
      )}
    </>
  );
}
