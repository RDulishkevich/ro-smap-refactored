import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { color, spring } from '@polevka/design';
import { useTh } from '../state/ThemeContext';

export type HoverMenuItem = { label: string; danger?: boolean; onClick: () => void };

export function HoverMenu({
  items,
  title,
  align = 'right',
  children,
}: {
  items: HoverMenuItem[];
  title?: string;
  align?: 'left' | 'right';
  children: ReactNode;
}) {
  const th = useTh();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const timer = useRef(0);

  const show = () => {
    window.clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative" onMouseEnter={show} onMouseLeave={hide}>
      <span
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v); } }}
        className="inline-flex">
        {children}
      </span>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={spring.fade}
            className={`absolute top-[calc(100%+6px)] z-[640] min-w-[188px] rounded-2xl p-1.5 shadow-[0_12px_32px_rgba(45,60,57,0.16)] ${align === 'right' ? 'right-0' : 'left-0'}`}
            style={{ background: th.cardBg, border: `1px solid ${th.border}` }}>
            {title && <p className="text-[10px] uppercase tracking-wide px-2.5 py-1.5" style={{ color: color.sage }}>{title}</p>}
            {items.map((it) => (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                className="w-full text-left px-2.5 py-2 rounded-xl text-[13px] font-semibold"
                style={{ color: it.danger ? color.accent : th.inkText }}
                onClick={() => { setOpen(false); it.onClick(); }}>
                {it.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
