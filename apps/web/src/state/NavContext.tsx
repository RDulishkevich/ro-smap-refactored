import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppEvent, Expedition, Sound } from '@polevka/core';
import { pathForEvent, pathForSound, pathForUser } from '../lib/routes';

export type ScreenConfig =
  | { type: 'sound-detail'; sound: Sound }
  | { type: 'user-profile'; name: string; avatar: string; username: string }
  | { type: 'expedition-detail'; exp: Expedition }
  | { type: 'expedition-edit'; exp?: Expedition }
  | { type: 'settings' }
  | { type: 'events'; focusId?: string }
  | { type: 'auth' }
  | { type: 'record' }
  | { type: 'add-sound' }
  | { type: 'messages' }
  | { type: 'conversation'; name: string; avatar: string; peer: string }
  | { type: 'notifications' }
  | { type: 'search' }
  | { type: 'edit-profile' }
  | { type: 'map-location'; sound: Sound }
  | { type: 'pick-location'; mode?: 'point' | 'route' }
  | { type: 'staff' }
  | { type: 'help' }
  | { type: 'legal'; doc: 'privacy' | 'terms' | 'publish' }
  | { type: 'cabinet' }
  | { type: 'guessr' }
  | { type: 'reset-password' };

export type TabId = 'feed' | 'map' | 'profile';
export type DesktopView = 'map' | 'library' | 'feed' | 'expeditions' | 'help' | 'staff' | 'cabinet';

type NavCtx = {
  push: (s: ScreenConfig) => void;
  pop: () => void;
  reset: (s?: ScreenConfig) => void;
  stack: Array<ScreenConfig & { _id: number }>;
  activeTab: TabId;
  setActiveTab: (t: TabId) => void;
  prevTab: TabId;
  desktopView: DesktopView;
  setDesktopView: (v: DesktopView) => void;
  requireAuth: (s: ScreenConfig) => void;
};

const Ctx = createContext<NavCtx | null>(null);

function urlFor(s?: ScreenConfig | null): string | null {
  if (!s) return '/';
  if (s.type === 'sound-detail') return pathForSound(s.sound.id);
  if (s.type === 'user-profile') return pathForUser(s.username);
  if (s.type === 'events' && s.focusId) return pathForEvent(s.focusId);
  return null;
}

function syncUrl(stack: Array<ScreenConfig>) {
  let path = '/';
  for (let i = stack.length - 1; i >= 0; i--) {
    const p = urlFor(stack[i]);
    if (p && p !== '/') { path = p; break; }
  }
  if (`${location.pathname}${location.search}` !== path) {
    history.replaceState({ polevka: true }, '', path);
  }
}

export function NavProvider({ children, isLoggedIn, onNeedAuth }: { children: ReactNode; isLoggedIn: boolean; onNeedAuth: () => void }) {
  const [activeTab, setActiveTabState] = useState<TabId>('map');
  const [prevTab, setPrevTab] = useState<TabId>('map');
  const [stack, setStack] = useState<Array<ScreenConfig & { _id: number }>>([]);
  const [desktopView, setDesktopView] = useState<DesktopView>('map');
  const nextId = useRef(0);
  const skipUrl = useRef(false);

  const push = useCallback((s: ScreenConfig) => {
    setStack((p) => {
      const next = [...p, { ...s, _id: nextId.current++ }];
      skipUrl.current = false;
      syncUrl(next);
      return next;
    });
  }, []);
  const pop = useCallback(() => {
    setStack((p) => {
      const next = p.slice(0, -1);
      skipUrl.current = false;
      syncUrl(next);
      return next;
    });
  }, []);
  const reset = useCallback((s?: ScreenConfig) => {
    setStack(() => {
      const next = s ? [{ ...s, _id: nextId.current++ }] : [];
      skipUrl.current = true;
      syncUrl(next);
      return next;
    });
  }, []);
  const setActiveTab = useCallback((t: TabId) => {
    setPrevTab(activeTab);
    setActiveTabState(t);
  }, [activeTab]);
  const requireAuth = useCallback((s: ScreenConfig) => {
    if (!isLoggedIn) {
      onNeedAuth();
      push({ type: 'auth' });
      return;
    }
    push(s);
  }, [isLoggedIn, onNeedAuth, push]);

  useEffect(() => {
    const onPop = () => {
      if (skipUrl.current) { skipUrl.current = false; return; }
      /* DeepLinks applies pathname after popstate */
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const value = useMemo(() => ({
    push, pop, reset, stack, activeTab, setActiveTab, prevTab, desktopView, setDesktopView, requireAuth,
  }), [push, pop, reset, stack, activeTab, setActiveTab, prevTab, desktopView, requireAuth]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNav() {
  const v = useContext(Ctx);
  if (!v) throw new Error('NavProvider');
  return v;
}
