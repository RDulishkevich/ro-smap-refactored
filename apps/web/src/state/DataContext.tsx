import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  apiGetMail, apiPatchSound, apiSyncJson, fetchEvents, fetchFeed, fetchMapData, fetchProfiles,
  filterSounds, markBoxNotificationsRead, mergeMailState, normalizeMail, publishedSounds, EMPTY_FILTER,
  type AppEvent, type CatalogFilter, type FeedPost, type MailBox, type Profile, type Sound,
} from '@polevka/core';
import { audioService } from '../lib/audio-player';
import { rememberSessionTitles } from '../lib/download-sound';
import { notifyNewMail, seedSeenMail, syncDevicePush } from '../lib/notify';
import { useAuth } from './AuthContext';
import { usePrefs } from './PrefsContext';

export type PickMode = null | 'point' | 'route';
export type MapPoint = { lat: number; lng: number };

type DataCtx = {
  sounds: Sound[];
  allSounds: Sound[];
  filteredSounds: Sound[];
  filter: CatalogFilter;
  setFilter: (f: CatalogFilter | ((prev: CatalogFilter) => CatalogFilter)) => void;
  feed: FeedPost[];
  events: AppEvent[];
  profiles: Profile[];
  mail: MailBox[];
  loading: boolean;
  catalogStatus: 'ok' | 'degraded' | 'down';
  reload: () => Promise<void>;
  reloadMail: () => Promise<void>;
  applyMail: (updater: (prev: MailBox[]) => MailBox[]) => void;
  /** Merge server mail projection (sync/getMail) into local state without dropping optimistic rows. */
  absorbMail: (raw: unknown) => void;
  markNotificationsRead: () => Promise<void>;
  playingId: string | number | null;
  playing: boolean;
  progress: number;
  volume: number;
  muted: boolean;
  togglePlay: (s: Sound) => void;
  seek: (ratio: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  focused: Sound | null;
  setFocused: (s: Sound | null) => void;
  pickMode: PickMode;
  setPickMode: (m: PickMode) => void;
  pickedPoint: MapPoint | null;
  setPickedPoint: (p: MapPoint | null) => void;
  routeDraft: MapPoint[];
  setRouteDraft: (p: MapPoint[] | ((prev: MapPoint[]) => MapPoint[])) => void;
  routePreview: MapPoint[];
  setRoutePreview: (p: MapPoint[]) => void;
  clearMapPick: () => void;
  patchSoundLocal: (id: string | number, patch: Partial<Sound> | ((s: Sound) => Sound)) => void;
  patchFeedLocal: (id: string | number | undefined, patch: Partial<FeedPost> | ((p: FeedPost) => FeedPost)) => void;
  patchFeedListLocal: (updater: (prev: FeedPost[]) => FeedPost[]) => void;
  patchProfilesLocal: (updater: (prev: Profile[]) => Profile[]) => void;
  patchEventsLocal: (updater: (prev: AppEvent[]) => AppEvent[]) => void;
};

const Ctx = createContext<DataCtx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn, user, patchUser } = useAuth();
  const { prefs } = usePrefs();
  const [allSounds, setAll] = useState<Sound[]>([]);
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [mail, setMail] = useState<MailBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogStatus, setCatalogStatus] = useState<'ok' | 'degraded' | 'down'>('ok');
  const [playingId, setPlayingId] = useState<string | number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMuted] = useState(false);
  const [focused, setFocusedState] = useState<Sound | null>(null);
  const [filter, setFilter] = useState<CatalogFilter>(EMPTY_FILTER);
  const [pickMode, setPickMode] = useState<PickMode>(null);
  const [pickedPoint, setPickedPoint] = useState<MapPoint | null>(null);
  const [routeDraft, setRouteDraft] = useState<MapPoint[]>([]);
  const [routePreview, setRoutePreview] = useState<MapPoint[]>([]);

  const absorbMail = useCallback((raw: unknown) => {
    const incoming = normalizeMail(Array.isArray(raw) ? raw : []);
    if (!incoming.length) return;
    setMail((prev) => mergeMailState(prev, incoming));
  }, []);

  const reloadMail = useCallback(async () => {
    if (!isLoggedIn) { setMail([]); return; }
    try {
      const raw = await apiGetMail();
      const next = normalizeMail(raw as unknown[]);
      const login = String(user?.loginName || '');
      if (login) {
        seedSeenMail(next, login);
        if (prefs.notifyDevice) void notifyNewMail(next, login);
      }
      setMail((prev) => mergeMailState(prev, next));
    } catch { /* keep last mailbox — do not wipe on a blip */ }
  }, [isLoggedIn, prefs.notifyDevice, user?.loginName]);

  const applyMail = useCallback((updater: (prev: MailBox[]) => MailBox[]) => {
    setMail((prev) => updater(prev));
  }, []);

  const markNotificationsRead = useCallback(async () => {
    const login = String(user?.loginName || '').toLowerCase();
    if (!login) return;
    const { boxes, patch } = markBoxNotificationsRead(mail, login);
    if (!patch) return;
    setMail(boxes);
    try { await apiSyncJson('mail.json', [patch]); } catch { await reloadMail(); }
  }, [mail, reloadMail, user?.loginName]);

  const hadCatalog = useRef(false);
  /** Skip setState when the public JSON fingerprint is unchanged — avoids list remounts. */
  const catalogFp = useRef({ sounds: '', feed: '', events: '', profiles: '' });
  const reload = useCallback(async () => {
    const results = await Promise.allSettled([fetchMapData(), fetchFeed(), fetchEvents(), fetchProfiles()]);
    const [s, f, e, p] = results;
    if (s.status === 'fulfilled') {
      const fp = JSON.stringify(s.value);
      if (fp !== catalogFp.current.sounds) {
        catalogFp.current.sounds = fp;
        setAll(s.value);
      }
      hadCatalog.current = true;
    }
    if (f.status === 'fulfilled') {
      const fp = JSON.stringify(f.value);
      if (fp !== catalogFp.current.feed) {
        catalogFp.current.feed = fp;
        setFeed(f.value);
      }
    }
    if (e.status === 'fulfilled') {
      const fp = JSON.stringify(e.value);
      if (fp !== catalogFp.current.events) {
        catalogFp.current.events = fp;
        setEvents(e.value);
      }
    }
    if (p.status === 'fulfilled') {
      const fp = JSON.stringify(p.value);
      if (fp !== catalogFp.current.profiles) {
        catalogFp.current.profiles = fp;
        setProfiles(p.value);
        rememberSessionTitles(p.value);
      }
    }
    const failed = results.some((row) => row.status === 'rejected');
    if (!failed) setCatalogStatus('ok');
    else setCatalogStatus(hadCatalog.current ? 'degraded' : 'down');
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
    const t = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void reload();
    }, 90_000);
    return () => clearInterval(t);
  }, [reload]);

  // Session user historically omitted avatar — keep it in sync with public profile card.
  useEffect(() => {
    if (!user?.loginName || !profiles.length) return;
    const mine = profiles.find((p) => String(p.loginName || '').toLowerCase() === String(user.loginName).toLowerCase());
    if (!mine) return;
    const nextAvatar = String(mine.avatar || '');
    const nextBio = mine.bio != null ? String(mine.bio) : undefined;
    const nextName = mine.displayName != null ? String(mine.displayName) : undefined;
    if (
      (nextAvatar && nextAvatar !== String(user.avatar || ''))
      || (nextBio != null && nextBio !== String(user.bio || ''))
      || (nextName && nextName !== String(user.displayName || user.username || ''))
    ) {
      patchUser({
        ...(nextAvatar ? { avatar: nextAvatar } : {}),
        ...(nextBio != null ? { bio: nextBio } : {}),
        ...(nextName ? { displayName: nextName, username: nextName } : {}),
      });
    }
  }, [profiles, user?.loginName, user?.avatar, user?.bio, user?.displayName, user?.username, patchUser]);

  useEffect(() => {
    if (!isLoggedIn) { setMail([]); return; }
    if (prefs.notifyDevice) void syncDevicePush(true);
    void reloadMail();
    const t = setInterval(() => { void reloadMail(); }, 20_000);
    const onVis = () => { if (!document.hidden) void reloadMail(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [isLoggedIn, prefs.notifyDevice, reloadMail]);

  useEffect(() => audioService.subscribe(() => {
    setPlayingId(audioService.soundId);
    setPlaying(audioService.playing);
    setProgress(audioService.progress());
    setVolumeState(audioService.volume);
    setMuted(audioService.muted);
  }), []);

  const setFocused = useCallback((s: Sound | null) => {
    setFocusedState(s);
    if (!s) {
      audioService.stop();
      return;
    }
    if (audioService.soundId != null && String(audioService.soundId) !== String(s.id)) {
      audioService.stop();
    }
  }, []);

  const togglePlay = useCallback((s: Sound) => {
    setFocusedState(s);
    const starting = !(audioService.soundId === s.id && audioService.playing);
    audioService.toggle(s.id, s.url ? String(s.url) : undefined);
    if (starting && s.url) {
      void apiPatchSound(s.id, { incPlays: 1 }).catch(() => {});
    }
  }, []);

  const seek = useCallback((ratio: number) => { audioService.seek(ratio); }, []);
  const setVolume = useCallback((v: number) => { audioService.setVolume(v); }, []);
  const toggleMute = useCallback(() => { audioService.toggleMute(); }, []);

  const patchSoundLocal = useCallback((id: string | number, patch: Partial<Sound> | ((s: Sound) => Sound)) => {
    setAll((prev) => prev.map((s) => {
      if (String(s.id) !== String(id)) return s;
      return typeof patch === 'function' ? patch(s) : { ...s, ...patch };
    }));
  }, []);

  const patchFeedLocal = useCallback((id: string | number | undefined, patch: Partial<FeedPost> | ((p: FeedPost) => FeedPost)) => {
    const key = String(id ?? '');
    setFeed((prev) => prev.map((p) => {
      if (String(p.id || p.title) !== key) return p;
      return typeof patch === 'function' ? patch(p) : { ...p, ...patch };
    }));
  }, []);

  const patchFeedListLocal = useCallback((updater: (prev: FeedPost[]) => FeedPost[]) => {
    setFeed(updater);
  }, []);

  const patchProfilesLocal = useCallback((updater: (prev: Profile[]) => Profile[]) => {
    setProfiles(updater);
  }, []);

  const patchEventsLocal = useCallback((updater: (prev: AppEvent[]) => AppEvent[]) => {
    setEvents(updater);
  }, []);

  // Keep own lastSeen fresh so peers see «в сети».
  useEffect(() => {
    if (!isLoggedIn || !user?.loginName) return;
    let lastTouch = 0;
    const touch = (force = false) => {
      const now = Date.now();
      if (!force && now - lastTouch < 120_000) return;
      lastTouch = now;
      const login = String(user.loginName).toLowerCase();
      const iso = new Date().toISOString();
      setProfiles((prev) => {
        const idx = prev.findIndex((p) => String(p.loginName || '').toLowerCase() === login);
        const next = idx >= 0
          ? prev.map((p, i) => (i === idx ? { ...p, lastSeen: iso } : p))
          : [...prev, { loginName: login, displayName: user.username || login, lastSeen: iso }];
        return next;
      });
      void apiSyncJson('profiles.json', [{
        loginName: login,
        displayName: user.username || login,
        lastSeen: iso,
      }]).catch(() => {});
    };
    touch(true);
    const t = window.setInterval(() => {
      if (!document.hidden) touch(false);
    }, 90_000);
    const onVis = () => { if (!document.hidden) touch(false); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [isLoggedIn, user?.loginName, user?.username]);

  const clearMapPick = useCallback(() => {
    setPickMode(null);
    setPickedPoint(null);
    setRouteDraft([]);
    setRoutePreview([]);
  }, []);

  const sounds = useMemo(() => publishedSounds(allSounds), [allSounds]);
  const filteredSounds = useMemo(() => filterSounds(sounds, filter), [sounds, filter]);

  const value = useMemo(() => ({
    sounds, allSounds, filteredSounds, filter, setFilter,
    feed, events, profiles, mail, loading, catalogStatus, reload, reloadMail, applyMail, absorbMail, markNotificationsRead,
    playingId, playing, progress, volume, muted, togglePlay, seek, setVolume, toggleMute,
    focused, setFocused,
    pickMode, setPickMode, pickedPoint, setPickedPoint, routeDraft, setRouteDraft, routePreview, setRoutePreview,
    clearMapPick, patchSoundLocal, patchFeedLocal, patchFeedListLocal, patchProfilesLocal, patchEventsLocal,
  }), [
    sounds, allSounds, filteredSounds, filter, feed, events, profiles, mail, loading, catalogStatus, reload, reloadMail, applyMail, absorbMail, markNotificationsRead,
    playingId, playing, progress, volume, muted, togglePlay, seek, setVolume, toggleMute,
    focused, patchSoundLocal, patchFeedLocal, patchFeedListLocal, patchProfilesLocal, patchEventsLocal, clearMapPick,
    pickMode, pickedPoint, routeDraft, routePreview,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const v = useContext(Ctx);
  if (!v) throw new Error('DataProvider');
  return v;
}
