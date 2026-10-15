import { useEffect, useState } from 'react';
import { useAuth } from '../state/AuthContext';
import { useData } from '../state/DataContext';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useUi } from '../state/UiContext';
import { useT } from '../state/PrefsContext';
import { finishOAuthFromUrl } from '../lib/oauth';

/** Handles `/oauth/callback` after VK / Yandex redirect (login or link). */
export function OAuthReturn() {
  const th = useTh();
  const t = useT();
  const { applySession, refreshUser, restoring } = useAuth();
  const { reload } = useData();
  const { reset } = useNav();
  const { toast } = useUi();
  const [msg, setMsg] = useState(t('loading'));
  const active = typeof location !== 'undefined' && location.pathname.startsWith('/oauth/callback');

  useEffect(() => {
    if (!active || restoring) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await finishOAuthFromUrl(location.search) as {
          intent?: 'login' | 'link';
          token?: string; refreshToken?: string; user?: Record<string, unknown>; rememberMe?: boolean;
          provider?: string;
        };
        if (cancelled) return;
        if (data.intent === 'link') {
          await refreshUser();
          toast(t('oauthLinked'));
          history.replaceState({}, '', '/profile');
          await reset({ type: 'cabinet' });
          return;
        }
        applySession(data);
        await reload();
        toast('Добро пожаловать');
        history.replaceState({}, '', '/');
        void reset();
      } catch (e: unknown) {
        if (cancelled) return;
        const err = e as { message?: string; code?: string };
        const text = err.code === 'provider_taken'
          ? t('oauthProviderTaken')
          : (err.message || t('oauthFailed'));
        setMsg(text);
        toast(text);
        window.setTimeout(() => {
          history.replaceState({}, '', '/');
          void reset();
        }, 1600);
      }
    })();
    return () => { cancelled = true; };
  }, [active, applySession, refreshUser, reload, reset, restoring, t, toast]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center p-6" style={{ background: th.phoneBg }}>
      <p className="pv-body text-center" style={{ color: th.inkText }}>{msg}</p>
    </div>
  );
}
