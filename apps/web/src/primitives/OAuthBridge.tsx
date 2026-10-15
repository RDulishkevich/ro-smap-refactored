import { useEffect, useState } from 'react';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useUi } from '../state/UiContext';
import { useT } from '../state/PrefsContext';
import { consumeOauthBridge } from '../lib/oauth';

/** www → apex handoff before IdP redirect (keeps JWT on the registered callback host). */
export function OAuthBridge() {
  const th = useTh();
  const t = useT();
  const { reset } = useNav();
  const { toast } = useUi();
  const [msg, setMsg] = useState(t('loading'));
  const active = typeof location !== 'undefined' && location.pathname.startsWith('/oauth/bridge');

  useEffect(() => {
    if (!active) return;
    let live = true;
    void (async () => {
      try {
        await consumeOauthBridge();
        // beginOAuth navigates away; if not, show waiting state
        if (live) setMsg(t('loading'));
      } catch (e: unknown) {
        if (!live) return;
        const err = e as { message?: string };
        const text = err.message || t('oauthFailed');
        setMsg(text);
        toast(text);
        window.setTimeout(() => {
          history.replaceState({}, '', '/');
          void reset();
        }, 1800);
      }
    })();
    return () => { live = false; };
  }, [active, reset, t, toast]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center p-6" style={{ background: th.phoneBg }}>
      <p className="pv-body text-center" style={{ color: th.inkText }}>{msg}</p>
    </div>
  );
}
