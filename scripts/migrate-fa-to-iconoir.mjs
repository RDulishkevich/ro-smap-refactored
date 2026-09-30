/**
 * One-shot: replace Font Awesome class strings with Iconoir across the app.
 * Run: node scripts/migrate-fa-to-iconoir.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SKIP = new Set(['re-design', '.agents', 'node_modules', '.git', 'tmp-iconoir-names.txt', 'migrate-fa-to-iconoir.mjs']);

/** FA icon name (without fa-) → Iconoir name (without iconoir-) */
const MAP = {
  'arrow-down': 'nav-arrow-down',
  'arrow-left': 'arrow-left',
  'arrow-right': 'arrow-right',
  'arrow-up': 'nav-arrow-up',
  'arrow-up-from-bracket': 'upload',
  'arrow-up-right-from-square': 'open-new-window',
  'award': 'medal',
  'ban': 'prohibition',
  'bars': 'menu',
  'bell': 'bell',
  'bold': 'bold',
  'bolt': 'flash',
  'book-open': 'book',
  'box-archive': 'archive',
  'calendar': 'calendar',
  'calendar-days': 'calendar',
  'calendar-plus': 'calendar-plus',
  'camera': 'camera',
  'chart-line': 'graph-up',
  'chart-pie': 'stats-up-square',
  'chart-simple': 'stats-up-square',
  'check': 'check',
  'check-double': 'double-check',
  'chevron-down': 'nav-arrow-down',
  'chevron-left': 'nav-arrow-left',
  'chevron-right': 'nav-arrow-right',
  'circle': 'circle',
  'circle-check': 'check-circle',
  'circle-exclamation': 'warning-circle',
  'circle-half-stroke': 'half-moon',
  'circle-info': 'info-circle',
  'circle-notch': 'refresh-circle',
  'circle-question': 'help-circle',
  'city': 'city',
  'clipboard-check': 'clipboard-check',
  'clipboard-list': 'task-list',
  'clock': 'clock',
  'cloud': 'cloud',
  'cloud-arrow-down': 'cloud-download',
  'cloud-arrow-up': 'cloud-upload',
  'cloud-sun': 'cloud',
  'comment': 'chat-bubble',
  'comments': 'chat-lines',
  'compass': 'compass',
  'crop': 'crop',
  'cube': 'cube',
  'download': 'download',
  'ear-listen': 'headset',
  'earth-europe': 'globe',
  'ellipsis': 'more-horiz',
  'envelope': 'mail',
  'envelope-circle-check': 'mail',
  'expand': 'expand',
  'eye': 'eye',
  'face-smile': 'emoji',
  'file-audio': 'music-double-note',
  'file-contract': 'page',
  'file-csv': 'page',
  'file-pdf': 'page',
  'file-waveform': 'sine-wave',
  'file-zipper': 'archive',
  'film': 'media-video',
  'filter': 'filter',
  'filter-circle-xmark': 'filter',
  'fingerprint': 'fingerprint',
  'flag': 'triangle-flag',
  'floppy-disk': 'floppy-disk',
  'folder-tree': 'folder',
  'font': 'type',
  'gear': 'settings',
  'gift': 'gift',
  'globe': 'globe',
  'hashtag': 'hashtag',
  'headphones': 'headset',
  'headset': 'headset',
  'heart': 'heart',
  'heart-pulse': 'heart',
  'id-badge': 'user-circle',
  'id-card': 'user-circle',
  'image': 'media-image',
  'info': 'info-circle',
  'italic': 'italic',
  'key': 'key',
  'language': 'language',
  'laptop-slash': 'laptop',
  'layer-group': 'multiple-pages',
  'leaf': 'leaf',
  'lightbulb': 'light-bulb',
  'link': 'link',
  'list': 'list',
  'list-check': 'task-list',
  'list-ul': 'list',
  'location-crosshairs': 'gps',
  'location-dot': 'map-pin',
  'lock': 'lock',
  'magnifying-glass': 'search',
  'map': 'map',
  'map-location-dot': 'map-pin',
  'map-pin': 'map-pin',
  'medal': 'medal',
  'microphone': 'microphone',
  'microphone-lines': 'microphone',
  'microphone-slash': 'microphone-mute',
  'mobile-screen-button': 'smartphone-device',
  'music': 'music-double-note',
  'newspaper': 'journal',
  'palette': 'palette',
  'paper-plane': 'send-diagonal',
  'pause': 'pause',
  'pen': 'edit-pencil',
  'pen-to-square': 'edit',
  'person-walking': 'walking',
  'play': 'play',
  'plus': 'plus',
  'quote-left': 'quote',
  'record-vinyl': 'compact-disc',
  'reply': 'reply',
  'right-from-bracket': 'log-out',
  'route': 'path-arrow',
  'scale-balanced': 'scale-frame-enlarge',
  'screwdriver-wrench': 'tools',
  'shield-halved': 'shield',
  'shoe-prints': 'walking',
  'sliders': 'control-slider',
  'star': 'star',
  'street-view': 'walking',
  'sun': 'sun-light',
  'tag': 'label',
  'tags': 'label',
  'terminal': 'terminal',
  'text-height': 'text-size',
  'thumbs-down': 'thumbs-down',
  'thumbs-up': 'thumbs-up',
  'thumbtack': 'pin',
  'trash': 'trash',
  'trash-can': 'trash',
  'triangle-exclamation': 'warning-triangle',
  'trophy': 'trophy',
  'user': 'user',
  'user-astronaut': 'user-circle',
  'user-check': 'user-badge-check',
  'user-group': 'group',
  'users': 'group',
  'user-shield': 'user',
  'user-slash': 'user-xmark',
  'user-xmark': 'user-xmark',
  'volume-high': 'sound-high',
  'volume-low': 'sound-min',
  'volume-xmark': 'sound-off',
  'vr-cardboard': 'vr-tag',
  'walkie-talkie': 'antenna',
  'water': 'droplet',
  'wave-square': 'square-wave',
  'xmark': 'xmark'
};

function listFiles(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) listFiles(p, out);
    else if (/\.(html|js|css|md)$/i.test(ent.name)) out.push(p);
  }
  return out;
}

function replaceInText(text) {
  let next = text;
  let hits = 0;

  // fa-solid|regular|brands fa-name (+ optional fa-spin)
  next = next.replace(
    /\b(?:fa-solid|fa-regular|fa-brands)\s+fa-([a-z0-9-]+)(?:\s+fa-spin)?/g,
    (full, name) => {
      const mapped = MAP[name];
      if (!mapped) {
        console.warn('Unmapped icon:', name);
        return `iconoir-help-circle`;
      }
      hits++;
      const spin = /\bfa-spin\b/.test(full) ? ' iconoir-spin' : '';
      return `iconoir-${mapped}${spin}`;
    }
  );

  // leftover standalone fa-spin (rare)
  next = next.replace(/\bfa-spin\b/g, () => {
    hits++;
    return 'iconoir-spin';
  });

  // Query selectors that look for FA icons
  next = next.replace(
    /:scope\s*>\s*i\.fa-solid,\s*:scope\s*>\s*i\.fa-regular,\s*:scope\s*>\s*i\.fa-brands/g,
    () => {
      hits++;
      return ':scope > i[class*="iconoir-"]';
    }
  );
  next = next.replace(/i\.fa-solid,\s*i\.fa-regular,\s*i\.fa-brands/g, () => {
    hits++;
    return 'i[class*="iconoir-"]';
  });
  next = next.replace(/\.fa-solid|\.fa-regular|\.fa-brands/g, (m) => {
    // avoid breaking comments about FA; only simple selector leftovers
    hits++;
    return '[class*="iconoir-"]';
  });

  return { next, hits };
}

const files = listFiles(root);
let total = 0;
let touched = 0;
for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  if (!/\bfa-(solid|regular|brands|spin)\b|\.fa-solid/.test(raw)) continue;
  const { next, hits } = replaceInText(raw);
  if (next !== raw) {
    fs.writeFileSync(file, next, 'utf8');
    touched++;
    total += hits;
    console.log(`${path.relative(root, file)} (+${hits})`);
  }
}
console.log(`Done. Files: ${touched}, replacements: ${total}`);
