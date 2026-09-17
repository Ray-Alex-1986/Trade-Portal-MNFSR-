import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="32" fill="#006B3F"/>
  <g fill="#D4AF37" transform="translate(32 28)">
    <path d="M0-12c-3.5 2.5-6 6-6 10.5 0 4.5 2.5 7 6 8.5 3.5-1.5 6-4 6-8.5 0-4.5-2.5-8-6-10.5z"/>
    <circle cx="5" cy="-9" r="2"/>
    <rect x="-8" y="4" width="16" height="2" rx="0.5"/>
    <rect x="-9" y="7.5" width="18" height="1.5" rx="0.5" opacity="0.9"/>
    <ellipse cx="0" cy="12" rx="9" ry="2.5" fill="none" stroke="#D4AF37" stroke-width="1.4"/>
  </g>
</svg>`;

writeFileSync('public/favicon.svg', svg);

async function writePng(size, out) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out);
}

await writePng(32, 'public/icon.png');
await writePng(32, 'public/favicon.png');
await writePng(32, 'src/app/icon.png');
await writePng(180, 'public/apple-icon.png');
await writePng(180, 'src/app/apple-icon.png');

const { data, info } = await sharp('public/icon.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const w = info.width;
for (const [x, y] of [[0, 0], [31, 0], [0, 31], [31, 31], [16, 16]]) {
  const i = (y * w + x) * 4;
  console.log(`${x},${y} rgba(${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]})`);
}
console.log('favicon.svg + circular icons written');
