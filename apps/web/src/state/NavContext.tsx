import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Expedition, FeedPost, Sound } from '@polevka/core';
import { parsePath, pathForEvent, pathForSound, pathForUser, type DeepRoute } from '../lib/routes';

export type ScreenConfig =
  | { type: 'sound-detail'; sound: Sound }
  | { type: 'user-profile'; name: string; avatar: string; username: string }
  | { type: 'expedition-detail'; exp: Expedition }
  | { type: 'expedition-edit'; exp?: Expedition }
  | { type: 'settings' }
  | { type: 'events'; focusId?: string }
  | { type: 'auth'; mode?: 'in' | 'up' }
  | { type: 'feed-post'; post: FeedPost }
  | { type: 'record' }
  | { type: 'add-sound'; edit?: Sound }
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
  | { type: 'delete-account' }
  | { type: 'guessr' }
  | { type: 'reset-password' }
  | { type: 'catalog' }
  | { type: 'feed' }
  | { type: 'expeditions' };

export type TabId = 'menu' | 'map' | 'messages' | 'profile';
export type DesktopView = 'map' | 'library' | 'feed' | 'expeditions' | 'help' | 'staff' | 'cabinet';

type NavCtx = {
  push: (s: ScreenConfig) => void;
  pop: () => void;
  reset: (s?: ScreenConfig) => void;
  applyRoute: (route: DeepRoute) => void;
  stack: Array<ScreenConfig & { _id: number }>;
  activeTab: TabId;
  setActiveTab: (t: TabId) => void;
  prevTab: TabId;
  desktopView: DesktopView;
  setDesktopView: (v: DesktopView) => void;
  requireAuth: (s: ScreenConfig) => void;
};

const Ctx = createContext<NavCtx | null>(null);

function isDesktop() {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
}

function urlForScreen(s?: ScreenConfig | null): string | null {
  if (!s) return null;
  if (s.type === 'sound-detail') return pathForSound(s.sound.id);
  if (s.type === 'user-profile') return pathForUser(s.username);
  if (s.type === 'events') return s.focusId ? pathForEvent(s.focusId) : '/events';
  if (s.type === 'catalog') return '/catalog';
  if (s.type === 'feed') return '/feed';
  if (s.type === 'expeditions') return '/expeditions';
  if (s.type === 'messages' || s.type === 'conversation') return '/messages';
  if (s.type === 'settings') return '/settings';
  if (s.type === 'help') return '/help';
  if (s.type === 'staff') return '/staff';
  if (s.type === 'guessr') return '/guessr';
  if (s.type === 'cabinet') return '/profile';
  return null;
}

function urlForChrome(tab: TabId, desktopView: DesktopView) {
  if (isDesktop()) {
    if (desktopView === 'library') return '/catalog';
    if (desktopView === 'feed') return '/feed';
    if (desktopView === 'expeditions') return '/expeditions';
    if (desktopView === 'help') return '/help';
    if (desktopView === 'staff') return '/staff';
    if (desktopView === 'cabinet') return '/profile';
    return '/';
  }
  if (tab === 'messages') return '/messages';
  if (tab === 'profile') return '/profile';
  if (tab === 'menu') return '/menu';
  return '/';
}

function pathFromNav(stack: Array<ScreenConfig>, tab: TabId, desktopView: DesktopView) {
  for (let i = stack.length - 1; i >= 0; i--) {
    const p = urlForScreen(stack[i]);
    if (p) return p;
  }
  return urlForChrome(tab, desktopView);
}

function writeUrl(path: string, mode: 'push' | 'replace') {
  if (`${location.pathname}${location.search}` === path) return;
  if (mode === 'push') history.pushState({ polevka: true }, '', path);
  else history.replaceState({ polevka: true }, '', path);
}

export function NavProvider({ children, isLoggedIn, onNeedAuth }: { children: ReactNode; isLoggedIn: boolean; onNeedAuth: () => void }) {
  const [activeTab, setActiveTabState] = useState<TabId>('map');
  const [prevTab, setPrevTab] = useState<TabId>('map');
  const [stack, setStack] = useState<Array<ScreenConfig & { _id: number }>>([]);
  const [desktopView, setDesktopViewState] = useState<DesktopView>('map');
  const nextId = useRef(0);
  const skipUrl = useRef(false);
  const tabRef = useRef(activeTab);
  const viewRef = useRef(desktopView);
  tabRef.current = activeTab;
  viewRef.current = desktopView;

  const sync = useCallback((nextStack: Array<ScreenConfig>, tab: TabId, view: DesktopView, mode: 'push' | 'replace') => {
    writeUrl(pathFromNav(nextStack, tab, view), mode);
  }, []);

  const push = useCallback((s: ScreenConfig) => {
    setStack((p) => {
      const next = [...p, { ...s, _id: nextId.current++ }];
      skipUrl.current = false;
      sync(next, tabRef.current, viewRef.current, 'push');
      return next;
    });
  }, [sync]);
  const pop = useCallback(() => {
    setStack((p) => {
      const next = p.slice(0, -1);
      skipUrl.current = false;
      sync(next, tabRef.current, viewRef.current, 'replace');
      return next;
    });
  }, [sync]);
  const reset = useCallback((s?: ScreenConfig) => {
    setStack(() => {
      const next = s ? [{ ...s, _id: nextId.current++ }] : [];
      skipUrl.current = true;
      sync(next, tabRef.current, viewRef.current, 'replace');
      return next;
    });
  }, [sync]);
  const setActiveTab = useCallback((t: TabId) => {
    setPrevTab(tabRef.current);
    setActiveTabState(t);
    tabRef.current = t;
    setStack([]);
    skipUrl.current = false;
    sync([], t, viewRef.current, 'push');
  }, [sync]);
  const setDesktopView = useCallback((v: DesktopView) => {
    setDesktopViewState(v);
    viewRef.current = v;
    skipUrl.current = false;
    sync([], tabRef.current, v, 'push');
  }, [sync]);

  const applyRoute = useCallback((route: DeepRoute) => {
    const desk = isDesktop();
    skipUrl.current = true;
    const setTab = (t: TabId) => {
      setActiveTabState(t);
      tabRef.current = t;
    };
    const setView = (v: DesktopView) => {
      setDesktopViewState(v);
      viewRef.current = v;
    };
    const screen = (s?: ScreenConfig): Array<ScreenConfig & { _id: number }> => (
      s ? [{ ...s, _id: nextId.current++ }] : []
    );

    if (route.kind === 'sound' || route.kind === 'user') return;

    if (route.kind === 'catalog') {
      setView('library');
      setTab(desk ? 'map' : 'menu');
      setStack(desk ? [] : screen({ type: 'catalog' }));
      writeUrl('/catalog', 'replace');
      return;
    }
    if (route.kind === 'feed') {
      setView('feed');
      setTab(desk ? 'map' : 'menu');
      setStack(desk ? [] : screen({ type: 'feed' }));
      writeUrl('/feed', 'replace');
      return;
    }
    if (route.kind === 'expeditions') {
      setView('expeditions');
      setTab(desk ? 'map' : 'menu');
      setStack(desk ? [] : screen({ type: 'expeditions' }));
      writeUrl('/expeditions', 'replace');
      return;
    }
    if (route.kind === 'events') {
      setTab(desk ? 'map' : 'menu');
      setStack(screen({ type: 'events', focusId: route.id }));
      writeUrl(route.id ? pathForEvent(route.id) : '/events', 'replace');
      return;
    }
    if (route.kind === 'messages') {
      setTab('messages');
      setView('map');
      setStack(desk ? screen({ type: 'messages' }) : []);
      writeUrl('/messages', 'replace');
      return;
    }
    if (route.kind === 'settings') {
      setTab(desk ? 'map' : 'menu');
      setStack(screen({ type: 'settings' }));
      writeUrl('/settings', 'replace');
      return;
    }
    if (route.kind === 'help') {
      setView('help');
      setTab(desk ? 'map' : 'menu');
      setStack(screen({ type: 'help' }));
      writeUrl('/help', 'replace');
      return;
    }
    if (route.kind === 'staff') {
      setView('staff');
      setTab(desk ? 'map' : 'menu');
      setStack(desk ? [] : screen({ type: 'staff' }));
      writeUrl('/staff', 'replace');
      return;
    }
    if (route.kind === 'guessr') {
      setTab(desk ? 'map' : 'menu');
      setStack(screen({ type: 'guessr' }));
      writeUrl('/guessr', 'replace');
      return;
    }
    if (route.kind === 'profile') {
      setTab('profile');
      setView('cabinet');
      setStack([]);
      writeUrl('/profile', 'replace');
      return;
    }
    if (route.kind === 'menu') {
      setTab('menu');
      setView('map');
      setStack([]);
      writeUrl('/menu', 'replace');
      return;
    }
    setTab('map');
    setView('map');
    setStack([]);
    writeUrl('/', 'replace');
  }, []);

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
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const value = useMemo(() => ({
    push, pop, reset, applyRoute, stack, activeTab, setActiveTab, prevTab, desktopView, setDesktopView, requireAuth,
  }), [push, pop, reset, applyRoute, stack, activeTab, setActiveTab, prevTab, desktopView, setDesktopView, requireAuth]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNav() {
  const v = useContext(Ctx);
  if (!v) throw new Error('NavProvider');
  return v;
}

export { parsePath };
