import { apiPublicConfig } from '@polevka/core';

export async function loadYandexMaps(): Promise<boolean> {
  const w = window as Window & { ymaps?: unknown; YANDEX_MAPS_API_KEY?: string };
  if (w.ymaps) return true;
  try {
    const cfg = await apiPublicConfig() as { yandexMapsApiKey?: string };
    const key = String(cfg?.yandexMapsApiKey || '').trim();
    if (!key) return false;
    w.YANDEX_MAPS_API_KEY = key;
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=ru_RU`;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('ymaps'));
      document.head.appendChild(s);
    });
    return !!w.ymaps;
  } catch {
    return false;
  }
}

export function registerPwa() {
  if (!('serviceWorker' in navigator)) return;
  if (!window.isSecureContext && location.hostname !== 'localhost') return;
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
