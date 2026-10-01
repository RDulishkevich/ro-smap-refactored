import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  apiGetMail, apiPatchSound, fetchEvents, fetchFeed, fetchMapData, fetchProfiles,
  filterSounds, normalizeMail, publishedSounds, EMPTY_FILTER,
  type AppEvent, type CatalogFilter, type FeedPost, type MailBox, type Profile, type Sound,
} from '@polevka/core';
import { audioService } from '../lib/audio-player';
import { useAuth } from './AuthContext';

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
  reload: () => Promise<void>;
  reloadMail: () => Promise<void>;
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
};

const Ctx = createContext<DataCtx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth();
  const [allSounds, setAll] = useState<Sound[]>([]);
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [mail, setMail] = useState<MailBox[]>([]);
  const [loading, setLoading] = useState(true);
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

  const reloadMail = useCallback(async () => {
    if (!isLoggedIn) { setMail([]); return; }
    try {
      const raw = await apiGetMail();
      setMail(normalizeMail(raw as unknown[]));
    } catch {
      setMail([]);
    }
  }, [isLoggedIn]);

  const reload = useCallback(async () => {
    const [s, f, e, p] = await Promise.all([fetchMapData(), fetchFeed(), fetchEvents(), fetchProfiles()]);
    setAll(s);
    setFeed(f);
    setEvents(e);
    setProfiles(p);
    setLoading(false);
    await reloadMail();
  }, [reloadMail]);

  useEffect(() => { void reload(); const t = setInterval(() => void reload(), 45000); return () => clearInterval(t); }, [reload]);

  useEffect(() => audioService.subscribe(() => {
    setPlayingId(audioService.soundId);
    setPlaying(audioService.playing);
    setProgress(audioService.progress());
    setVolumeState(audioService.volume);
    setMuted(audioService.muted);
  }), []);

  const setFocused = useCallback((s: Sound | null) => {
    setFocusedState(s);
    if (s && audioService.soundId != null && String(audioService.soundId) !== String(s.id)) {
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

  const sounds = useMemo(() => publishedSounds(allSounds), [allSounds]);
  const filteredSounds = useMemo(() => filterSounds(sounds, filter), [sounds, filter]);

  const value = useMemo(() => ({
    sounds, allSounds, filteredSounds, filter, setFilter,
    feed, events, profiles, mail, loading, reload, reloadMail,
    playingId, playing, progress, volume, muted, togglePlay, seek, setVolume, toggleMute,
    focused, setFocused,
    pickMode, setPickMode, pickedPoint, setPickedPoint, routeDraft, setRouteDraft, routePreview, setRoutePreview,
  }), [
    sounds, allSounds, filteredSounds, filter, feed, events, profiles, mail, loading, reload, reloadMail,
    playingId, playing, progress, volume, muted, togglePlay, seek, setVolume, toggleMute,
    focused,
    pickMode, pickedPoint, routeDraft, routePreview,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const v = useContext(Ctx);
  if (!v) throw new Error('DataProvider');
  return v;
}
