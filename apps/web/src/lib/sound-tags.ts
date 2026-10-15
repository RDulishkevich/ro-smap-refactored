import type { Sound } from '@polevka/core';

function pretty(raw: string) {
  return raw
    .toLowerCase()
    .replace(/\b([a-zа-яё])/g, (ch) => ch.toUpperCase());
}

export function soundTagLines(sound: Sound, typeLabel: string): { primary: string; secondary: string } {
  const cat = String(sound.ucsCat || sound.ucsCategory || sound.ucsCatId || '').trim();
  const primary = cat ? pretty(cat) : typeLabel;

  const extra = [
    sound.fxName && String(sound.fxName) !== String(sound.title) ? String(sound.fxName) : '',
    ...(Array.isArray(sound.tagArray) ? sound.tagArray.map(String) : []),
  ].filter(Boolean);
  const skip = new Set([primary.toLowerCase(), String(sound.title || '').toLowerCase()]);
  const secondary = extra.filter((x) => !skip.has(x.toLowerCase())).join(', ');
  return { primary, secondary };
}
