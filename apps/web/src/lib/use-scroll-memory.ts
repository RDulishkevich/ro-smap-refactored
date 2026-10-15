import { useEffect, useRef } from 'react';

export function useScrollMemory(id: string) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    try {
      const saved = sessionStorage.getItem(`pv-scroll:${id}`);
      if (saved) el.scrollTop = Number(saved) || 0;
    } catch { /* */ }
    let raf = 0;
    const on = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        try { sessionStorage.setItem(`pv-scroll:${id}`, String(el.scrollTop)); } catch { /* */ }
      });
    };
    el.addEventListener('scroll', on, { passive: true });
    return () => {
      el.removeEventListener('scroll', on);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [id]);
  return ref;
}
