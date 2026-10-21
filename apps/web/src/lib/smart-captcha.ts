import { apiPublicConfig } from '@polevka/core';

type SmartCaptchaApi = {
  render: (container: HTMLElement | string, params: Record<string, unknown>) => number;
  execute: (widgetId?: number) => void;
  reset: (widgetId?: number) => void;
  destroy: (widgetId?: number) => void;
};

declare global {
  interface Window {
    smartCaptcha?: SmartCaptchaApi;
    __polevkaSmartCaptchaOnload?: () => void;
  }
}

const SCRIPT_SRC = 'https://smartcaptcha.cloud.yandex.ru/captcha.js?render=onload&onload=__polevkaSmartCaptchaOnload';

let sitekeyPromise: Promise<string | null> | null = null;
let scriptPromise: Promise<void> | null = null;
let widgetId: number | null = null;
let containerEl: HTMLDivElement | null = null;
let pending: { resolve: (token: string) => void; reject: (err: Error) => void } | null = null;

export async function getSmartCaptchaSitekey(): Promise<string | null> {
  if (!sitekeyPromise) {
    sitekeyPromise = apiPublicConfig()
      .then((cfg) => {
        const sc = (cfg as { smartCaptcha?: { enabled?: boolean; sitekey?: string } }).smartCaptcha;
        if (!sc?.enabled || !sc.sitekey) return null;
        return String(sc.sitekey);
      })
      .catch(() => null);
  }
  return sitekeyPromise;
}

function loadScript(): Promise<void> {
  if (window.smartCaptcha) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const prev = document.querySelector(`script[src^="https://smartcaptcha.cloud.yandex.ru/captcha.js"]`);
    if (prev && window.smartCaptcha) {
      resolve();
      return;
    }
    window.__polevkaSmartCaptchaOnload = () => resolve();
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.defer = true;
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('Не удалось загрузить SmartCaptcha'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

function ensureContainer() {
  if (containerEl && document.body.contains(containerEl)) return containerEl;
  containerEl = document.createElement('div');
  containerEl.id = 'polevka-smart-captcha';
  containerEl.setAttribute('aria-hidden', 'true');
  containerEl.style.cssText = 'position:fixed;left:-9999px;bottom:0;width:1px;height:1px;overflow:hidden;';
  document.body.appendChild(containerEl);
  return containerEl;
}

/**
 * Runs invisible Yandex SmartCaptcha. Returns null when captcha is not configured on the API.
 */
export async function runSmartCaptcha(): Promise<string | null> {
  const sitekey = await getSmartCaptchaSitekey();
  if (!sitekey) return null;

  await loadScript();
  if (!window.smartCaptcha) throw Object.assign(new Error('SmartCaptcha недоступна'), { code: 'captcha_unavailable' });

  const box = ensureContainer();

  return new Promise<string>((resolve, reject) => {
    pending = { resolve, reject };

    const onToken = (token: string) => {
      const p = pending;
      pending = null;
      if (!token) {
        p?.reject(Object.assign(new Error('Проверка не пройдена'), { code: 'captcha_failed' }));
        return;
      }
      p?.resolve(token);
      try { window.smartCaptcha?.reset(widgetId ?? undefined); } catch { /* */ }
    };

    try {
      if (widgetId == null) {
        widgetId = window.smartCaptcha!.render(box, {
          sitekey,
          invisible: true,
          hl: 'ru',
          shieldPosition: 'bottom-right',
          callback: onToken,
        });
      }
      window.smartCaptcha!.execute(widgetId);
    } catch (e) {
      pending = null;
      reject(e instanceof Error ? e : new Error('captcha_failed'));
    }
  });
}
