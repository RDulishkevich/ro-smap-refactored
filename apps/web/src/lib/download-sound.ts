import { apiPatchSound, type Sound } from '@polevka/core';

function fileName(sound: Sound) {
  const base = String(sound.title || 'sound').replace(/[\\/:*?"<>|]+/g, '').trim() || 'sound';
  const url = String(sound.url || '');
  const ext = (url.match(/\.(wav|mp3|flac|ogg|m4a|aac)(?:\?|$)/i) || [])[1] || 'wav';
  return `${base}.${ext}`;
}

export async function downloadSound(sound: Sound, toast: (msg: string) => void) {
  const href = String(sound.url || '');
  if (!href) {
    toast('Нет файла');
    return;
  }
  const name = fileName(sound);
  try {
    const res = await fetch(href, { mode: 'cors' });
    if (!res.ok) throw new Error('fetch');
    const blob = await res.blob();
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
  void apiPatchSound(sound.id, { incDownloads: 1 }).catch(() => {});
  toast('Скачивание началось');
}
