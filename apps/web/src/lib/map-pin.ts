import type { Sound } from '@polevka/core';
import { pinColor } from '@polevka/design';

const GLYPH: Record<string, string> = {
  nature: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 19c8-1 11-8 11-14 0 0-8 1-12 8-1 2 0 5 1 6Z" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M9 13c2 2 5 4 8 5" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
  water: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 3c0 0-7 8-7 12a7 7 0 0 0 14 0C19 11 12 3 12 3Z" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>',
  urban: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M4 20V9l6-4 4 3v2h6v10H4Z" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>',
  forest: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 3 6 12h4l-3 6h10l-3-6h4L12 3Z" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>',
  birds: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M4 14c4-1 6-5 6-8 3 2 6 6 6 9 3-1 5-2 6-2-2 3-6 6-12 6-4 0-7-2-6-5Z" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>',
};

function esc(v: string) {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export const PIN_SIZE = { w: 28, h: 36, anchorX: 14, anchorY: 34 };

export function pinMarkup(sound: Sound, on: boolean) {
  const type = String(sound.type || 'urban');
  const fill = pinColor[type] || pinColor.urban;
  const id = esc(String(sound.id));
  const face = GLYPH[type] || GLYPH.urban;
  return `<div class="pv-pin${on ? ' pv-pin--on' : ''}" data-id="${id}"><span class="pv-pin-head" style="background:${fill}"></span><span class="pv-pin-face">${face}</span></div>`;
}

export function pinMarkupYandex(sound: Sound, on: boolean) {
  return `<div class="pv-pin-anchor">${pinMarkup(sound, on)}</div>`;
}
