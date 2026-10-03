import { useEffect, useState } from 'react';
import { formatClock, parseDurationLabel, peaksFromUrl } from './waveform';

const durCache = new Map<string, number>();

export const PLACEHOLDER_PEAKS = Array.from({ length: 80 }, () => 0.1);

export function probeDuration(url: string): Promise<number> {
  const hit = durCache.get(url);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    const el = document.createElement('audio');
    el.preload = 'metadata';
    let done = false;
    const finish = (sec: number) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      el.removeAttribute('src');
      el.load();
      const ok = sec > 0 && Number.isFinite(sec);
      if (ok) durCache.set(url, sec);
      resolve(ok ? sec : 0);
    };
    const timer = window.setTimeout(() => finish(el.duration), 2500);
    el.onloadedmetadata = () => finish(el.duration);
    el.ondurationchange = () => {
      if (el.duration > 0 && Number.isFinite(el.duration)) finish(el.duration);
    };
    el.onerror = () => finish(0);
    el.src = url;
  });
}

export function useSoundMeta(
  sound?: { id?: unknown; url?: string; duration?: string } | null,
  opts?: { peaks?: boolean; probe?: boolean },
) {
  const stored = parseDurationLabel(sound?.duration);
  const wantPeaks = !!opts?.peaks;
  const wantProbe = !!opts?.probe;
  const [durationSec, setDurationSec] = useState(stored);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  useEffect(() => {
    const next = parseDurationLabel(sound?.duration);
    if (next) setDurationSec(next);
    const url = String(sound?.url || '');
    if (!url) {
      setPeaks(null);
      return;
    }
    let dead = false;
    if (!next && wantProbe) {
      void probeDuration(url).then((sec) => {
        if (!dead && sec > 0) setDurationSec(sec);
      });
    }
    if (wantPeaks) {
      void peaksFromUrl(url, 80).then((p) => {
        if (!dead && p.length) setPeaks(p);
      }).catch(() => {});
    } else {
      setPeaks(null);
    }
    return () => { dead = true; };
  }, [sound?.url, sound?.id, sound?.duration, wantPeaks, wantProbe]);
  return {
    durationSec,
    peaks,
    durationLabel: durationSec > 0 ? formatClock(durationSec) : '—',
  };
}
