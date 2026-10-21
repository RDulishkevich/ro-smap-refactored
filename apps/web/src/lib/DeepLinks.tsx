import { useEffect, useRef } from 'react';
import { parsePath } from './routes';
import { useData } from '../state/DataContext';
import { useNav } from '../state/NavContext';

/**
 * Apply URL → stack once on boot and on popstate.
 * Do NOT re-apply on catalog/mail polls — that remounted auth/add-sound/sound
 * screens and wiped in-progress input (and felt like the whole site "refreshed").
 */
export function DeepLinks() {
  const { loading, allSounds, sounds, profiles, events } = useData();
  const { reset, applyRoute, stack } = useNav();
  const dataRef = useRef({ allSounds, sounds, profiles, events, reset, applyRoute, stack });
  dataRef.current = { allSounds, sounds, profiles, events, reset, applyRoute, stack };
  const booted = useRef(false);

  useEffect(() => {
    if (loading) return;

    const apply = () => {
      const {
        allSounds: all, sounds: pub, profiles: profs, events: evs, reset: rst, applyRoute: go,
      } = dataRef.current;
      const route = parsePath(location.pathname);

      // Keep /oauth/callback?code=… intact — rewriting to `/` drops the auth code.
      if (route.kind === 'oauth') return;

      if (route.kind === 'sound') {
        const s = all.find((x) => String(x.id) === route.id) || pub.find((x) => String(x.id) === route.id);
        if (s) rst({ type: 'sound-detail', sound: s });
        return;
      }
      if (route.kind === 'user') {
        const login = route.login.replace(/^@/, '').toLowerCase();
        const p = profs.find((pr) => String(pr.loginName || '').toLowerCase() === login
          || String(pr.displayName || '').toLowerCase() === login);
        rst({
          type: 'user-profile',
          name: String(p?.displayName || p?.username || login),
          avatar: String(p?.avatar || '🎙️'),
          username: `@${login}`,
        });
        return;
      }
      void evs;
      go(route);
    };

    if (!booted.current) {
      booted.current = true;
      apply();
    }

    window.addEventListener('popstate', apply);
    return () => window.removeEventListener('popstate', apply);
  }, [loading]);

  // Late-resolve /s/:id and /u/:login once catalog/profiles land — only if stack is
  // still empty (first boot raced ahead of data). Never remount an open screen.
  useEffect(() => {
    if (loading || !booted.current) return;
    const {
      allSounds: all, sounds: pub, profiles: profs, reset: rst, stack: st,
    } = dataRef.current;
    if (st.length > 0) return;
    const route = parsePath(location.pathname);

    if (route.kind === 'sound') {
      const s = all.find((x) => String(x.id) === route.id) || pub.find((x) => String(x.id) === route.id);
      if (s) void rst({ type: 'sound-detail', sound: s });
      return;
    }
    if (route.kind === 'user') {
      const login = route.login.replace(/^@/, '').toLowerCase();
      const p = profs.find((pr) => String(pr.loginName || '').toLowerCase() === login
        || String(pr.displayName || '').toLowerCase() === login);
      void rst({
        type: 'user-profile',
        name: String(p?.displayName || p?.username || login),
        avatar: String(p?.avatar || '🎙️'),
        username: `@${login}`,
      });
    }
  }, [loading, allSounds, sounds, profiles, events, stack]);

  return null;
}
