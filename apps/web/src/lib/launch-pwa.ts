import { isStandaloneApp } from './standalone';

type LaunchParams = { targetURL?: string };

export function bootLinkCapture() {
  const w = window as Window & {
    launchQueue?: { setConsumer: (cb: (params: LaunchParams) => void) => void };
  };
  if (w.launchQueue?.setConsumer) {
    w.launchQueue.setConsumer((params) => {
      if (!params.targetURL) return;
      try {
        const next = new URL(params.targetURL, location.origin);
        if (next.origin !== location.origin) return;
        const path = `${next.pathname}${next.search}`;
        if (`${location.pathname}${location.search}` !== path) {
          history.replaceState({ polevka: true }, '', path);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      } catch { /* ignore */ }
    });
  }
}

export async function installedWebAppKnown() {
  const nav = navigator as Navigator & {
    getInstalledRelatedApps?: () => Promise<Array<{ platform?: string; url?: string }>>;
  };
  if (typeof nav.getInstalledRelatedApps !== 'function') return false;
  try {
    const apps = await nav.getInstalledRelatedApps();
    return apps.some((a) => a.platform === 'webapp' || a.url?.includes('polevka.art'));
  } catch {
    return false;
  }
}

export function shouldOfferOpenInApp() {
  return !isStandaloneApp() && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function tryOpenInstalledApp() {
  const path = `${location.pathname}${location.search}${location.hash}`;
  const host = location.host.replace(/^www\./, '');
  const https = `${location.protocol}//${location.host}${path}`;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) {
    location.href = `webapp://${host}${path}`;
    return;
  }
  if (/Android/i.test(ua)) {
    location.href = `intent://${host}${path}#Intent;scheme=https;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(https)};end`;
  }
}
