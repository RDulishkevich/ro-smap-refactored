import { forwardRef, useRef, useState, type ReactNode, type TouchEvent, type UIEvent } from 'react';
import { useData } from '../state/DataContext';
import { useT } from '../state/PrefsContext';
import { color } from '@polevka/design';
import { useTh } from '../state/ThemeContext';

export const PullToRefresh = forwardRef<HTMLDivElement, {
  children: ReactNode;
  className?: string;
  onScroll?: (e: UIEvent<HTMLDivElement>) => void;
}>(function PullToRefresh({ children, className = '', onScroll }, ref) {
  const { reload, catalogStatus } = useData();
  const th = useTh();
  const t = useT();
  const startY = useRef(0);
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const degraded = catalogStatus === 'degraded';

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop > 0) { startY.current = 0; return; }
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (!startY.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setPull(Math.min(72, dy * 0.42));
  };
  const onTouchEnd = () => {
    if (pull > 48 && !busy) {
      setBusy(true);
      void reload().finally(() => { setBusy(false); setPull(0); });
    } else setPull(0);
    startY.current = 0;
  };

  return (
    <div
      ref={ref}
      className={className}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onScroll={onScroll}>
      <div
        aria-hidden
        className="overflow-hidden flex items-center justify-center pv-caption"
        style={{ height: pull, color: th.soft, opacity: pull > 8 ? 1 : 0 }}>
        {busy || pull > 48 ? t('pullToRefresh') : ''}
      </div>
      {degraded && (
        <button
          type="button"
          onClick={() => { void reload(); }}
          className="w-full py-2 pv-caption"
          style={{ color: color.accent }}>
          Нет свежих данных — повторить
        </button>
      )}
      {children}
    </div>
  );
});
