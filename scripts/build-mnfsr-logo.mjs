import { copyFileSync, existsSync } from 'node:fs';
import sharp from 'sharp';

const SRC = 'mnfsr-logo.jpg';
if (!existsSync(SRC)) throw new Error(`${SRC} not found in project root`);

async function toCirclePng(size, outPath) {
  const { data, info } = await sharp(SRC)
    .resize(size, size, { fit: 'cover' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const px = Buffer.from(data);
  const w = info.width;
  const h = info.height;
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const r = Math.min(w, h) / 2 - 0.5;
  const soft = 1.25;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const dist = Math.hypot(x - cx, y - cy);
      let a = px[i + 3] / 255;
      if (dist >= r) a = 0;
      else if (dist > r - soft) a *= (r - dist) / soft;
      px[i + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
    }
  }

  await sharp(px, { raw: { width: w, height: h, channels: 4 } }).png().toFile(outPath);
}

await toCirclePng(512, 'public/mnfsr-logo.png');
await toCirclePng(512, 'public/govt-pakistan-logo.png'); // keep old path working
await toCirclePng(32, 'public/icon.png');
await toCirclePng(32, 'src/app/icon.png');
await toCirclePng(180, 'public/apple-icon.png');
await toCirclePng(180, 'src/app/apple-icon.png');
copyFileSync('public/mnfsr-logo.png', 'public/favicon.png');

console.log('MNFSR circular logo + favicons written');
