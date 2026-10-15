import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKey, type ReactNode, type RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { color, spring, tap } from '@polevka/design';
import { useTh } from '../state/ThemeContext';
import { useUi } from '../state/UiContext';
import { useIsDesktop } from '../lib/use-media';

export type HoverMenuItem = { label: string; danger?: boolean; onClick: () => void };

const OPEN_MS = 150;
const CLOSE_MS = 400;

export function PopoverCaret({
  align = 'right',
  offset = 14,
  fill,
  border,
}: {
  align?: 'left' | 'right' | 'center';
  offset?: number;
  fill: string;
  border: string;
}) {
  const side = align === 'left'
    ? { left: offset }
    : align === 'center'
      ? { left: '50%' as const }
      : { right: offset };
  return (
    <span
      aria-hidden
      className="absolute -top-[5px] w-2.5 h-2.5 pointer-events-none"
      style={{
        background: fill,
        borderLeft: `1px solid ${border}`,
        borderTop: `1px solid ${border}`,
        transform: align === 'center' ? 'translateX(-50%) rotate(45deg)' : 'rotate(45deg)',
        ...side,
      }}
    />
  );
}

function SafeTriangle({ menuRef }: { menuRef: RefObject<HTMLElement | null> }) {
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const menu = menuRef.current?.getBoundingClientRect();
        if (!menu) return;
        path.setAttribute('d', `M ${e.clientX} ${e.clientY} L ${menu.left} ${menu.top} L ${menu.right} ${menu.top} Z`);
      });
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [menuRef]);

  return (
    <svg aria-hidden className="fixed inset-0 w-full h-full z-[639]" style={{ pointerEvents: 'none' }}>
      <path ref={pathRef} fill="rgba(0,0,0,0.001)" style={{ pointerEvents: 'auto' }} />
    </svg>
  );
}

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
  const desktop = useIsDesktop();
  const { openMenu } = useUi();
  const [open, setOpen] = useState(false);
  const [hot, setHot] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timer = useRef(0);
  const menuId = useId();

  const showNow = () => {
    window.clearTimeout(timer.current);
    setOpen(true);
  };
  const hideNow = () => {
    window.clearTimeout(timer.current);
    setOpen(false);
    setHot(0);
  };
  const showSoon = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), OPEN_MS);
  };
  const hideSoon = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { setOpen(false); setHot(0); }, CLOSE_MS);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) hideNow();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        hideNow();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const itemsEl = menuRef.current?.querySelectorAll('[role="menuitem"]');
    const el = itemsEl?.[hot] as HTMLElement | undefined;
    el?.focus();
  }, [open, hot]);

  const onTriggerKey = (e: ReactKey) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen((v) => !v);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      showNow();
      setHot(0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      showNow();
      setHot(items.length - 1);
    }
  };

  const onMenuKey = (e: ReactKey) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHot((i) => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHot((i) => (i - 1 + items.length) % items.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setHot(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setHot(items.length - 1);
    } else if (e.key === 'Tab') {
      hideNow();
    }
  };

  const openSheet = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    openMenu(items, title, { x: r.right - 220, y: r.bottom + 8, caret: 'right', sheet: true });
  };

  if (!desktop) {
    return (
      <span
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-label={title ? `Ещё: ${title}` : 'Ещё'}
        className="inline-flex min-h-11 min-w-11 items-center justify-center cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          openSheet(e.currentTarget as HTMLElement);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openSheet(e.currentTarget as HTMLElement);
          }
        }}>
        {children}
      </span>
    );
  }

  return (
    <div ref={wrap} className="relative" onMouseEnter={showSoon} onMouseLeave={hideSoon}>
      <motion.span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={title ? `Ещё: ${title}` : 'Ещё'}
        data-open={open ? 'true' : 'false'}
        whileTap={tap.btn}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        onKeyDown={onTriggerKey}
        className="inline-flex min-h-11 min-w-11 items-center justify-center cursor-pointer [&_svg]:origin-center [&_svg]:transition-transform [&_svg]:duration-200 [&[data-open=true]_svg]:rotate-180">
        {children}
      </motion.span>
      {open && <SafeTriangle menuRef={menuRef} />}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            id={menuId}
            role="menu"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={spring.fade}
            onKeyDown={onMenuKey}
            className={`absolute top-[calc(100%+8px)] z-[640] min-w-[188px] rounded-2xl p-1.5 shadow-[0_12px_32px_rgba(45,60,57,0.16)] ${align === 'right' ? 'right-0' : 'left-0'}`}
            style={{ background: th.cardBg, border: `1px solid ${th.border}` }}>
            <PopoverCaret align={align} fill={th.cardBg} border={th.border} />
            {title && <p className="pv-micro uppercase px-2.5 py-1.5" style={{ color: color.sage }}>{title}</p>}
            {items.map((it, i) => (
              <motion.button
                key={it.label}
                type="button"
                role="menuitem"
                whileTap={tap.btn}
                className="pv-subtitle w-full text-left min-h-11 px-2.5 py-2 rounded-xl cursor-pointer"
                style={{
                  color: it.danger ? color.accent : th.inkText,
                  background: hot === i ? th.lightBg : 'transparent',
                }}
                onMouseEnter={() => setHot(i)}
                onPointerEnter={() => setHot(i)}
                onClick={() => { hideNow(); it.onClick(); }}>
                {it.label}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
