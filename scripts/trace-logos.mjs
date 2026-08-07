/**
 * Trace Polevka logo PNGs → compact SVG masters.
 * Usage: node scripts/trace-logos.mjs
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const ImageTracer = require('imagetracerjs');
const zlib = require('zlib');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readPngRgba(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf[0] !== 0x89 || buf.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error('Not a PNG: ' + filePath);
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 6;
  const idat = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') break;
    offset += 12 + len;
  }
  if (!width || !height) throw new Error('Bad PNG header');
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 4;
  const stride = width * bytesPerPixel;
  const raw = Buffer.alloc(height * stride);
  let src = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = inflated[src++];
    const row = inflated.subarray(src, src + stride);
    src += stride;
    const out = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const x = row[i];
      let v = x;
      if (filter === 1) v = (x + (i >= bytesPerPixel ? out[i - bytesPerPixel] : 0)) & 255;
      else if (filter === 2) v = (x + prev[i]) & 255;
      else if (filter === 3) {
        const a = i >= bytesPerPixel ? out[i - bytesPerPixel] : 0;
        v = (x + Math.floor((a + prev[i]) / 2)) & 255;
      } else if (filter === 4) {
        const a = i >= bytesPerPixel ? out[i - bytesPerPixel] : 0;
        const b = prev[i];
        const c = i >= bytesPerPixel ? prev[i - bytesPerPixel] : 0;
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        v = (x + pr) & 255;
      }
      out[i] = v;
    }
    out.copy(raw, y * stride);
    prev = out;
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, p = 0; i < width * height; i++) {
    if (colorType === 6) {
      data[p++] = raw[i * 4];
      data[p++] = raw[i * 4 + 1];
      data[p++] = raw[i * 4 + 2];
      data[p++] = raw[i * 4 + 3];
    } else if (colorType === 2) {
      data[p++] = raw[i * 3];
      data[p++] = raw[i * 3 + 1];
      data[p++] = raw[i * 3 + 2];
      data[p++] = 255;
    } else {
      const g = raw[i];
      data[p++] = g; data[p++] = g; data[p++] = g; data[p++] = 255;
    }
  }
  return { width, height, data };
}

function wrapSvg(svg, label) {
  return svg
    .replace('<svg ', `<svg role="img" aria-label="${label}" `)
    .replace('desc="Created with imagetracer.js version 1.2.6"', `desc="${label}"`)
    .replace(/opacity="0\.996078431372549"/g, '')
    .replace(/stroke="rgb\([^"]+\)" stroke-width="0" /g, '');
}

const jobs = [
  {
    src: path.join(root, 'assets', 'polevka-mark.png'),
    outs: [
      path.join(root, 'Logo.svg'),
      path.join(root, 'favicon.svg'),
      path.join(root, 'assets', 'polevka-mark.svg')
    ],
    label: 'Polevka',
    opts: {
      ...ImageTracer.optionpresets.posterized2,
      numberofcolors: 6,
      pathomit: 10,
      ltres: 1.4,
      qtres: 1.4,
      scale: 1,
      strokewidth: 0,
      viewbox: true
    }
  },
  {
    src: path.join(root, 'assets', 'polevka-app-icon.png'),
    outs: [path.join(root, 'assets', 'polevka-app-icon.svg')],
    label: 'Polevka app icon',
    opts: {
      ...ImageTracer.optionpresets.posterized2,
      numberofcolors: 8,
      pathomit: 10,
      ltres: 1.4,
      qtres: 1.4,
      scale: 1,
      strokewidth: 0,
      viewbox: true
    }
  }
];

for (const job of jobs) {
  const img = readPngRgba(job.src);
  let svg = ImageTracer.imagedataToSVG(img, job.opts);
  svg = wrapSvg(svg, job.label);
  for (const out of job.outs) {
    fs.writeFileSync(out, svg, 'utf8');
    console.log('wrote', path.relative(root, out), Buffer.byteLength(svg), 'bytes');
  }
}
