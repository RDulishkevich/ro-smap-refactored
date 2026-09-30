/**
 * Replace Iconoir class strings with Iconsax font classes (iconsax-font-icon).
 * Run: node scripts/migrate-iconoir-to-iconsax.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['re-design', '.agents', 'node_modules', '.git', 'scripts']);

/** iconoir name (without prefix) → iconsax-font-icon name (without icon-) */
const MAP = {
  'antenna': 'radar',
  'archive': 'archive',
  'arrow-left': 'arrow-left',
  'arrow-right': 'arrow-right',
  'bell': 'notification',
  'bold': 'text-bold',
  'book': 'book',
  'calendar': 'calendar',
  'calendar-plus': 'calendar-add',
  'camera': 'camera',
  'chat-bubble': 'message',
  'chat-lines': 'messages-2',
  'check': 'tick-circle',
  'check-circle': 'tick-circle',
  'circle': 'record-circle',
  'city': 'building',
  'clipboard-check': 'clipboard-tick',
  'clock': 'clock',
  'cloud': 'cloud',
  'cloud-download': 'document-download',
  'cloud-upload': 'document-upload',
  'compact-disc': 'cd',
  'compass': 'discover',
  'control-slider': 'slider-horizontal',
  'crop': 'crop',
  'cube': '3dcube',
  'double-check': 'tick-circle',
  'download': 'document-download',
  'droplet': 'dropbox',
  'edit': 'edit',
  'edit-pencil': 'edit-2',
  'emoji': 'emoji-happy',
  'eye': 'eye',
  'filter': 'filter',
  'fingerprint': 'finger-cricle',
  'flash': 'flash',
  'floppy-disk': 'save-2',
  'folder': 'folder-2',
  'gift': 'gift',
  'globe': 'global',
  'gps': 'gps',
  'graph-up': 'chart',
  'group': 'people',
  'half-moon': 'moon',
  'hashtag': 'hashtag',
  'headset': 'headphone',
  'heart': 'heart',
  'help-circle': 'message-question',
  'info-circle': 'info-circle',
  'italic': 'text-italic',
  'journal': 'note-2',
  'key': 'key',
  'label': 'tag',
  'language': 'language-circle',
  'laptop': 'monitor',
  'leaf': 'tree',
  'light-bulb': 'lamp-on',
  'link': 'link-2',
  'list': 'task',
  'lock': 'lock',
  'log-out': 'logout',
  'mail': 'sms',
  'map': 'map',
  'map-pin': 'location',
  'medal': 'medal',
  'media-image': 'gallery',
  'media-video': 'video',
  'menu': 'menu',
  'microphone': 'microphone',
  'microphone-mute': 'microphone-slash',
  'more-horiz': 'more',
  'multiple-pages': 'document-text',
  'music-double-note': 'musicnote',
  'nav-arrow-down': 'arrow-down',
  'nav-arrow-left': 'arrow-left-2',
  'nav-arrow-right': 'arrow-right-2',
  'nav-arrow-up': 'arrow-up',
  'open-new-window': 'export',
  'page': 'document',
  'palette': 'colorfilter',
  'path-arrow': 'routing',
  'pause': 'pause',
  'pin': 'location-tick',
  'play': 'play',
  'plus': 'add',
  'prohibition': 'forbidden',
  'quote': 'quote-down',
  'refresh-circle': 'refresh-2',
  'reply': 'undo',
  'scale-frame-enlarge': 'maximize-3',
  'search': 'search-normal',
  'send-diagonal': 'send-2',
  'settings': 'setting-2',
  'shield': 'shield-tick',
  'sine-wave': 'sound',
  'smartphone-device': 'mobile',
  'sound-high': 'volume-high',
  'sound-min': 'volume-low',
  'sound-off': 'volume-slash',
  'square-wave': 'sound',
  'star': 'star-1',
  'stats-up-square': 'chart-2',
  'task-list': 'task-square',
  'terminal': 'code',
  'text-size': 'text',
  'thumbs-down': 'dislike',
  'thumbs-up': 'like-1',
  'tools': 'candle',
  'trash': 'trash',
  'triangle-flag': 'flag',
  'trophy': 'cup',
  'type': 'text',
  'user': 'user',
  'user-badge-check': 'user-tick',
  'user-circle': 'profile-circle',
  'user-xmark': 'user-remove',
  'vr-tag': 'glass',
  'walking': 'man',
  'warning-circle': 'danger',
  'warning-triangle': 'warning-2',
  'xmark': 'close-circle',
};

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(html|js|css|md)$/i.test(ent.name)) out.push(p);
  }
  return out;
}

const files = walk(root);
let total = 0;
const missing = new Set();

for (const file of files) {
  let text = fs.readFileSync(file, 'utf8');
  if (!text.includes('iconoir-')) continue;
  let hits = 0;
  text = text.replace(/iconoir-([a-z0-9-]+)/g, (full, name) => {
    if (name === 'spin') {
      hits++;
      return 'icon-spin';
    }
    const dest = MAP[name];
    if (!dest) {
      missing.add(name);
      return full;
    }
    hits++;
    return `icon-${dest}`;
  });
  if (hits) {
    fs.writeFileSync(file, text);
    total += hits;
    console.log(`${hits}\t${path.relative(root, file)}`);
  }
}

console.log(`\nReplaced ${total} icons in ${files.length} scanned files.`);
if (missing.size) {
  console.error('Unmapped iconoir names:', [...missing].sort().join(', '));
  process.exitCode = 1;
}
