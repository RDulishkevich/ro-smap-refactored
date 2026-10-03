import { apiPatchSound, buildUcsFileName, resolveProjectSourceId, type Profile, type Sound } from '@polevka/core';
import { fetchAudioBlob } from './waveform';

const sessionTitles = new Map<string, string>();

export function rememberSessionTitles(profiles: Profile[]) {
  sessionTitles.clear();
  for (const profile of profiles || []) {
    for (const session of profile.sessions || []) {
      if (session?.id && session?.title) sessionTitles.set(String(session.id), String(session.title));
    }
  }
}

function extFromUrl(url: string) {
  return (url.match(/\.(wav|mp3|flac|ogg|m4a|aac)(?:\?|$)/i) || [])[1] || 'wav';
}

function safeName(raw: string) {
  return String(raw || '').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim();
}

export function ucsDownloadName(sound: Sound) {
  const ext = extFromUrl(String(sound.url || ''));
  const sourceTitle = sessionTitles.get(String(sound.sessionId || '')) || '';
  const built = String(buildUcsFileName({
    catId: sound.ucsCatId || sound.ucsCat || 'AMBMisc',
    fxName: sound.fxName || sound.title || 'Untitled',
    creatorId: String(sound.recordistId || sound.recordist || sound.user || 'Anon').replace(/^@/, ''),
    sourceId: resolveProjectSourceId(sound.sessionId, sourceTitle),
    channels: sound.channels,
    location: sound.location,
  }) || '');
  const base = built.replace(/\.wav$/i, '') || safeName(String(sound.fileName || '').replace(/\.[a-z0-9]+$/i, '')) || safeName(sound.title) || 'sound';
  return `${base}.${ext}`;
}

export async function downloadSound(sound: Sound, toast: (msg: string) => void) {
  const href = String(sound.url || '');
  if (!href) {
    toast('Нет файла');
    return;
  }
  const name = ucsDownloadName(sound);
  toast('Скачивание началось');
  void apiPatchSound(sound.id, { incDownloads: 1 }).catch(() => {});
  try {
    const blob = await fetchAudioBlob(href);
    const local = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = local;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(local), 4000);
  } catch {
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    a.rel = 'noopener';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}
