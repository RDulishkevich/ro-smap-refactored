import { useEffect, useRef } from 'react';
import { parsePath } from './routes';
import { useData } from '../state/DataContext';
import { useNav } from '../state/NavContext';

export function DeepLinks() {
  const { loading, allSounds, sounds, profiles, events } = useData();
  const { reset } = useNav();
  const dataRef = useRef({ allSounds, sounds, profiles, events, reset });
  dataRef.current = { allSounds, sounds, profiles, events, reset };
  const booted = useRef(false);

  useEffect(() => {
    if (loading) return;

    const apply = () => {
      const { allSounds: all, sounds: pub, profiles: profs, events: evs, reset: rst } = dataRef.current;
      const route = parsePath(location.pathname);
      if (route.kind === 'home') return;
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
      if (route.kind === 'event') {
        void evs;
        rst({ type: 'events', focusId: route.id });
      }
    };

    if (!booted.current) {
      booted.current = true;
      apply();
    }
    window.addEventListener('popstate', apply);
    return () => window.removeEventListener('popstate', apply);
  }, [loading, allSounds, sounds, profiles, events]);

  return null;
}
