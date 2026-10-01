import { useEffect } from 'react';

function zoomAllowed(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return !!target.closest('.pv-map, .pv-zoomable');
}

/** Block page pan/bounce and pinch-zoom. Map and fullscreen photos keep their own gestures. */
export function useLockPageGestures(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    const prevOverscroll = body.style.overscrollBehavior;
    html.classList.add('pv-lock');
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';

    const meta = document.querySelector('meta[name="viewport"]');
    const prevMeta = meta?.getAttribute('content') || '';
    meta?.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');

    const onTouchMove = (e: TouchEvent) => {
      if (zoomAllowed(e.target)) return;
      const scale = (e as TouchEvent & { scale?: number }).scale;
      if (e.touches.length > 1 || (typeof scale === 'number' && scale !== 1)) e.preventDefault();
    };
    const onGesture = (e: Event) => {
      if (!zoomAllowed(e.target)) e.preventDefault();
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey && !zoomAllowed(e.target)) e.preventDefault();
    };

    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('gesturestart', onGesture, { passive: false });
    document.addEventListener('gesturechange', onGesture, { passive: false });
    document.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      html.classList.remove('pv-lock');
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      body.style.overscrollBehavior = prevOverscroll;
      if (prevMeta) meta?.setAttribute('content', prevMeta);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('gesturestart', onGesture);
      document.removeEventListener('gesturechange', onGesture);
      document.removeEventListener('wheel', onWheel);
    };
  }, [active]);
}
