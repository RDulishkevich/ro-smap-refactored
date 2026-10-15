import { ucsByCatId, type Sound } from '@polevka/core';

type UcsMeta = { category?: string; subCategory?: string };

function pretty(raw: string) {
  return raw
    .toLowerCase()
    .replace(/\b([a-zа-яё])/g, (ch) => ch.toUpperCase());
}

export function soundTagLines(sound: Sound, typeLabel: string): { primary: string; secondary: string } {
  const id = String(sound.ucsCatId || '');
  const cat = String(sound.ucsCat || sound.ucsCategory || '');
  const meta = (ucsByCatId as Record<string, UcsMeta>)[id];
  let primary = typeLabel;
  if (meta?.category) {
    primary = pretty(meta.category);
    if (meta.subCategory && meta.subCategory !== 'MISC') primary += ` · ${pretty(meta.subCategory)}`;
  } else if (cat) primary = pretty(cat);

  const extra = [
    sound.fxName && String(sound.fxName) !== String(sound.title) ? String(sound.fxName) : '',
    ...(Array.isArray(sound.tagArray) ? sound.tagArray.map(String) : []),
  ].filter(Boolean);
  const skip = new Set([primary.toLowerCase(), String(sound.title || '').toLowerCase()]);
  const secondary = extra.filter((x) => !skip.has(x.toLowerCase())).join(', ');
  return { primary, secondary };
}
