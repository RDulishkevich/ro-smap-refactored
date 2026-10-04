import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type CSSProperties } from 'react';

const EDGE = 36;
const DONE = 88;

function blocked(el: EventTarget | null) {
  const node = el as HTMLElement | null;
  if (!node?.closest) return false;
  return !!node.closest('input, textarea, select, [data-no-swipe], .pv-carousel');
}

export function SwipeBack({
  onBack, children, className, style, enabled = true,
}: {
  onBack: () => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  enabled?: boolean;
}) {
  const [x, setX] = useState(0);
  const xRef = useRef(0);
  const start = useRef<{ x: number; y: number } | null>(null);

  const onDown = (e: ReactPointerEvent) => {
    if (!enabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (blocked(e.target)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left > EDGE) return;
    start.current = { x: e.clientX, y: e.clientY };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ }
  };

  const onMove = (e: ReactPointerEvent) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (Math.abs(dy) > 18 && Math.abs(dy) > Math.abs(dx)) {
      start.current = null;
      xRef.current = 0;
      setX(0);
      return;
    }
    const next = Math.max(0, Math.min(rectWidth(e.currentTarget as HTMLElement), dx));
    xRef.current = next;
    setX(next);
  };

  const onUp = () => {
    const go = xRef.current > DONE;
    start.current = null;
    xRef.current = 0;
    setX(0);
    if (go) onBack();
  };

  return (
    <div
      className={className}
      style={{
        ...style,
        height: style?.height ?? '100%',
        minHeight: 0,
        transform: x ? `translate3d(${x}px,0,0)` : undefined,
        transition: start.current ? 'none' : 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'transform',
        touchAction: 'pan-y',
      }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}>
      {children}
    </div>
  );
}

function rectWidth(el: HTMLElement) {
  return el.getBoundingClientRect().width;
}
