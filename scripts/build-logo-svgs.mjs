/**
 * Flatten + trace Polevka logo masters → SVG.
 * One-shot: node scripts/build-logo-svgs.mjs
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const require = createRequire(import.meta.url);
const ImageTracer = require('imagetracerjs');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function flattenWithPowerShell(src, dest, r, g, b) {
  const ps = `
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('${src.replace(/'/g, "''")}')
$bmp = New-Object System.Drawing.Bitmap $img.Width, $img.Height
$gr = [System.Drawing.Graphics]::FromImage($bmp)
$gr.Clear([System.Drawing.Color]::FromArgb(255, ${r}, ${g}, ${b}))
$gr.DrawImage($img, 0, 0, $img.Width, $img.Height)
$bmp.Save('${dest.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)
$gr.Dispose(); $bmp.Dispose(); $img.Dispose()
`;
  execFileSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'inherit' });
}

function enhance(svg, label) {
  let s = svg
    .replace(/\srole="[^"]*"/g, '')
    .replace(/\saria-label="[^"]*"/g, '')
    .replace(/\sdesc="[^"]*"/g, '')
    .replace(/<title>[\s\S]*?<\/title>/g, '');
  if (!s.includes('xmlns')) s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  s = s.replace(
    /<svg([^>]*)>/,
    `<svg$1 role="img" aria-label="${label}"><title>${label}</title>`
  );
  return s;
}

function traceFile(srcPng, outSvg, opts, label) {
  // Use nodecli for reliable PNG decode
  const tmpOut = outSvg + '.tmp.svg';
  const args = [
    path.join(root, 'node_modules/imagetracerjs/nodecli/nodecli.js'),
    srcPng,
    'outfilename', tmpOut,
    'numberofcolors', String(opts.numberofcolors),
    'pathomit', String(opts.pathomit),
    'ltres', String(opts.ltres),
    'qtres', String(opts.qtres),
    'viewbox', 'true',
    'blurradius', String(opts.blurradius ?? 1),
    'linefilter', 'true',
    'strokewidth', '0',
    'roundcoords', '0'
  ];
  execFileSync('node', args, { cwd: root, stdio: 'inherit' });
  let svg = fs.readFileSync(tmpOut, 'utf8');
  fs.unlinkSync(tmpOut);
  svg = enhance(svg, label);
  fs.writeFileSync(outSvg, svg, 'utf8');
  console.log('wrote', path.relative(root, outSvg), fs.statSync(outSvg).size);
}

const tmp = path.join(root, 'assets', '_trace-tmp');
if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });

// Circular favicon on olive
flattenWithPowerShell(
  path.join(root, 'assets/polevka-favicon.png'),
  path.join(tmp, 'favicon.png'),
  111, 124, 78
);
traceFile(path.join(tmp, 'favicon.png'), path.join(root, 'assets/polevka-mark.svg'), {
  numberofcolors: 5, pathomit: 40, ltres: 2, qtres: 2
}, 'Полёвка');
fs.copyFileSync(path.join(root, 'assets/polevka-mark.svg'), path.join(root, 'Logo.svg'));
fs.copyFileSync(path.join(root, 'assets/polevka-mark.svg'), path.join(root, 'favicon.svg'));

// App icon on sky
flattenWithPowerShell(
  path.join(root, 'assets/polevka-app-icon.png'),
  path.join(tmp, 'app.png'),
  157, 177, 112
);
traceFile(path.join(tmp, 'app.png'), path.join(root, 'assets/polevka-app-icon.svg'), {
  numberofcolors: 8, pathomit: 28, ltres: 2, qtres: 2
}, 'Полёвка');

// Theme marks: keep black bg in SVG as intentional plate, OR strip later — use cream/black plates
// Light UI mark (charcoal vole) on cream for readable SVG badge
flattenWithPowerShell(
  path.join(root, 'assets/polevka-mark-light.png'),
  path.join(tmp, 'mark-light.png'),
  255, 243, 226
);
traceFile(path.join(tmp, 'mark-light.png'), path.join(root, 'assets/polevka-mark-light.svg'), {
  numberofcolors: 5, pathomit: 36, ltres: 2, qtres: 2
}, 'Полёвка');

// Dark UI mark (cream vole) on charcoal
flattenWithPowerShell(
  path.join(root, 'assets/polevka-mark-dark.png'),
  path.join(tmp, 'mark-dark.png'),
  34, 34, 34
);
traceFile(path.join(tmp, 'mark-dark.png'), path.join(root, 'assets/polevka-mark-dark.svg'), {
  numberofcolors: 5, pathomit: 36, ltres: 2, qtres: 2
}, 'Полёвка');

// Alt terracotta on charcoal
flattenWithPowerShell(
  path.join(root, 'assets/polevka-mark-alt.png'),
  path.join(tmp, 'mark-alt.png'),
  34, 34, 34
);
traceFile(path.join(tmp, 'mark-alt.png'), path.join(root, 'assets/polevka-mark-alt.svg'), {
  numberofcolors: 5, pathomit: 36, ltres: 2, qtres: 2
}, 'Полёвка');

for (const f of fs.readdirSync(tmp)) fs.unlinkSync(path.join(tmp, f));
fs.rmdirSync(tmp);
console.log('done');
