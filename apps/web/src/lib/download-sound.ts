import { apiPatchSound, type Sound } from '@polevka/core';

export function downloadSound(sound: Sound, toast: (msg: string) => void) {
  if (!sound.url) {
    toast('Нет файла');
    return;
  }
  const a = document.createElement('a');
  a.href = String(sound.url);
  a.download = `${sound.title || 'sound'}.wav`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  void apiPatchSound(sound.id, { incDownloads: 1 }).catch(() => {});
  toast('Скачивание WAV');
}
