// Builds the Windows desktop version:  cd desktop && npm install && npm run dist
//   1. copies the game (index.html, styles.css, src/) into desktop/app
//   2. draws the app icon (icon.ico) from the same pixel design as the favicon
//   3. packages a Windows x64 app with @electron/packager into desktop/dist
//   4. zips it as desktop/dist/Part-Time-Pilot-win.zip, ready to send to testers
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const here = __dirname;
const root = path.join(here, '..');
const appDir = path.join(here, 'app');
const dist = path.join(here, 'dist');

// ---------- 1. copy the game ----------
fs.rmSync(appDir, { recursive: true, force: true });
fs.mkdirSync(appDir, { recursive: true });
for (const f of ['index.html', 'styles.css']) fs.copyFileSync(path.join(root, f), path.join(appDir, f));
fs.cpSync(path.join(root, 'src'), path.join(appDir, 'src'), { recursive: true });
console.log('copied game into desktop/app');

// ---------- 2. icon ----------
// 16x16 pixel art: the rusty dumpster-mech head from the favicon, with a glowing eye.
const ART = [
  '................',
  '...o........o...',
  '...o........o...',
  '.RRRRRRRRRRRRRR.',
  '.RrrrrrrrrrrrrR.',
  '.RrrrrrrttttrrR.',
  '.RrrrrrrtggtrrR.',
  '.RrrrrrrtggtrrR.',
  '.RrrrrrrttttrrR.',
  '.RrrrrrrrrrrrrR.',
  '.RooooooooooooR.',
  '.RrrrrrrrrrrrrR.',
  '.RRRRRRRRRRRRRR.',
  '...KKK....KKK...',
  '..KKKK....KKKK..',
  '................',
];
const PAL = { '.': [0, 0, 0, 0], ' ': [0, 0, 0, 0], R: [110, 52, 22, 255], r: [184, 100, 47, 255], o: [230, 160, 70, 255], t: [29, 58, 64, 255], g: [120, 255, 230, 255], K: [40, 36, 44, 255] };
function png(size) {
  const k = size / 16;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const c = PAL[ART[Math.floor(y / k)][Math.floor(x / k)]] || PAL['.'];
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = c[0];
      raw[o + 1] = c[1];
      raw[o + 2] = c[2];
      raw[o + 3] = c[3];
    }
  }
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const sizes = [16, 32, 48, 256];
const images = sizes.map(png);
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((s, i) => {
  const e = 6 + i * 16;
  header[e] = s === 256 ? 0 : s;
  header[e + 1] = s === 256 ? 0 : s;
  header.writeUInt16LE(1, e + 4); // planes
  header.writeUInt16LE(32, e + 6); // bpp
  header.writeUInt32LE(images[i].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += images[i].length;
});
fs.writeFileSync(path.join(here, 'icon.ico'), Buffer.concat([header, ...images]));
fs.writeFileSync(path.join(here, 'icon.png'), images[3]);
console.log('wrote icon.ico');

// ---------- 3. package ----------
(async () => {
  const { packager } = require('@electron/packager');
  const pkg = require('./package.json');
  const out = await packager({
    dir: here,
    out: dist,
    name: 'Part-Time Pilot',
    executableName: 'Part-Time Pilot',
    platform: 'win32',
    arch: 'x64',
    icon: path.join(here, 'icon.ico'),
    overwrite: true,
    asar: true,
    prune: true,
    appVersion: pkg.version,
    appCopyright: 'Part-Time Pilot',
    win32metadata: { CompanyName: 'Part-Time Pilot', FileDescription: 'Part-Time Pilot', ProductName: 'Part-Time Pilot', InternalName: 'Part-Time Pilot' },
    ignore: [/^\/dist($|\/)/, /^\/build\.js$/, /^\/icon\.png$/, /^\/README\.md$/],
  });
  console.log('packaged:', out[0]);

  // ---------- 4. zip for testers ----------
  const zip = path.join(dist, 'Part-Time-Pilot-win.zip');
  fs.rmSync(zip, { force: true });
  if (process.platform === 'win32') {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path '${out[0]}\\*' -DestinationPath '${zip}' -Force`], { stdio: 'inherit' });
    console.log('zipped:', zip);
  } else console.log('zip skipped (not on Windows); send the folder', out[0]);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
