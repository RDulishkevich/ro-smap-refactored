import { useRef, useState, type ReactNode } from 'react';

export function SwipeRow({
  children,
  onDismiss,
}: {
  children: ReactNode;
  onDismiss: () => void;
}) {
  const start = useRef(0);
  const [dx, setDx] = useState(0);

  return (
    <div
      className="relative overflow-hidden"
      onTouchStart={(e) => { start.current = e.touches[0].clientX; }}
      onTouchMove={(e) => {
        if (!start.current) return;
        setDx(Math.min(0, e.touches[0].clientX - start.current));
      }}
      onTouchEnd={() => {
        if (dx < -72) onDismiss();
        setDx(0);
        start.current = 0;
      }}>
      <div style={{ transform: `translateX(${dx}px)` }} className="will-change-transform">
        {children}
      </div>
    </div>
  );
}
