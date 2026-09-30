/**
 * Second pass: map bare `fa-*` icon tokens and `fa-solid ${icon}` templates.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['re-design', '.agents', 'node_modules', '.git', 'backups']);

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

function mapFaToken(token) {
  const name = String(token || '').replace(/^fa-/, '');
  const mapped = MAP[name] || 'help-circle';
  return `iconoir-${mapped}`;
}

function listFiles(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) listFiles(p, out);
    else if (/\.(html|js|css)$/i.test(ent.name)) out.push(p);
  }
  return out;
}

function transform(text) {
  let hits = 0;
  let next = text;

  // icon: 'fa-xxx' / "fa-xxx"
  next = next.replace(/\bicon:\s*(['"])fa-([a-z0-9-]+)\1/g, (_, q, name) => {
    hits++;
    return `icon: ${q}${mapFaToken('fa-' + name)}${q}`;
  });

  // Standalone 'fa-xxx' / "fa-xxx" that look like icon tokens (not fa-solid)
  next = next.replace(/(['"])fa-([a-z0-9-]+)\1/g, (full, q, name) => {
    if (name === 'solid' || name === 'regular' || name === 'brands' || name === 'spin') return full;
    hits++;
    return `${q}${mapFaToken('fa-' + name)}${q}`;
  });

  // Templates: fa-solid ${icon} → ${icon} (icon already mapped to iconoir-*)
  next = next.replace(/fa-solid\s+\$\{/g, () => {
    hits++;
    return '${';
  });
  next = next.replace(/fa-regular\s+\$\{/g, () => {
    hits++;
    return '${';
  });

  // audio.js style: '... fa-solid ' + ( ... 'fa-volume...'
  next = next.replace(
    /(['"])pointer-events-none text-sm w-4 text-center fa-solid \1\s*\+/g,
    () => {
      hits++;
      return `'pointer-events-none text-sm w-4 text-center ' +`;
    }
  );

  return { next, hits };
}

let total = 0;
let touched = 0;
for (const file of listFiles(root)) {
  const raw = fs.readFileSync(file, 'utf8');
  if (!/\bfa-/.test(raw)) continue;
  const { next, hits } = transform(raw);
  if (next !== raw) {
    fs.writeFileSync(file, next, 'utf8');
    touched++;
    total += hits;
    console.log(`${path.relative(root, file)} (+${hits})`);
  }
}
console.log(`Done. Files: ${touched}, replacements: ${total}`);
