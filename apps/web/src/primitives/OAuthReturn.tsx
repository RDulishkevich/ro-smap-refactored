import { useEffect, useState } from 'react';
import { useAuth } from '../state/AuthContext';
import { useData } from '../state/DataContext';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useUi } from '../state/UiContext';
import { useT } from '../state/PrefsContext';
import { captureOauthCallbackSearch, finishOAuthFromUrlOnce } from '../lib/oauth';

// Capture ?code= before any nav effect can replace the URL with `/`.
if (typeof location !== 'undefined') captureOauthCallbackSearch();

/** Handles `/oauth/callback` after VK / Yandex redirect (login or link). */
export function OAuthReturn() {
  const th = useTh();
  const t = useT();
  const { applySession, refreshUser, patchUser, restoring } = useAuth();
  const { reload } = useData();
  const { reset } = useNav();
  const { toast } = useUi();
  const [msg, setMsg] = useState(t('loading'));
  const active = typeof location !== 'undefined' && location.pathname.startsWith('/oauth/callback');

  useEffect(() => {
    if (!active) return;
    captureOauthCallbackSearch();
  }, [active]);

  useEffect(() => {
    if (!active || restoring) return;
    let live = true;
    void (async () => {
      try {
        const data = await finishOAuthFromUrlOnce() as {
          intent?: 'login' | 'link';
          token?: string; refreshToken?: string; user?: Record<string, unknown>; rememberMe?: boolean;
          provider?: string;
          oauth?: { yandex?: boolean; vk?: boolean; oauthOnly?: boolean };
        };
        if (!live) return;
        if (data.intent === 'link') {
          if (data.oauth) {
            patchUser({
              oauth: {
                yandex: !!data.oauth.yandex,
                vk: !!data.oauth.vk,
                oauthOnly: !!data.oauth.oauthOnly,
              },
            });
          }
          await refreshUser();
          if (!live) return;
          toast(t('oauthLinked'));
          history.replaceState({}, '', '/profile');
          await reset({ type: 'cabinet' });
          return;
        }
        applySession(data);
        await reload();
        if (!live) return;
        toast('Добро пожаловать');
        history.replaceState({}, '', '/');
        void reset();
      } catch (e: unknown) {
        if (!live) return;
        const err = e as { message?: string; code?: string };
        const text = err.code === 'provider_taken'
          ? t('oauthProviderTaken')
          : err.code === 'pd_consent'
            ? 'Нужно согласие на обработку персональных данных'
            : (err.message || t('oauthFailed'));
        setMsg(text);
        toast(text);
        window.setTimeout(() => {
          history.replaceState({}, '', '/auth');
          void reset({ type: 'auth', mode: 'in' });
        }, 2800);
      }
    })();
    return () => { live = false; };
  }, [active, applySession, patchUser, refreshUser, reload, reset, restoring, t, toast]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center p-6" style={{ background: th.phoneBg }}>
      <p className="pv-body text-center" style={{ color: th.inkText }}>{msg}</p>
    </div>
  );
}
