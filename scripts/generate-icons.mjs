/**
 * Generates the installable app icons from code (no image editor, no native
 * dependency). Run with `node scripts/generate-icons.mjs` whenever the brand
 * mark changes.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const name = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

function encodePng(size, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const header = chunk("IHDR", ihdr);
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([signature, header, chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

function inRoundRect(x, y, x0, y0, x1, y1, radius) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + radius), x1 - radius);
  const cy = Math.min(Math.max(y, y0 + radius), y1 - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function render(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const unit = size / 512;

  const put = (x, y, color) => {
    const offset = (y * size + x) * 4;
    pixels[offset] = color[0];
    pixels[offset + 1] = color[1];
    pixels[offset + 2] = color[2];
    pixels[offset + 3] = 255;
  };

  const lime = [212, 255, 63];
  const limeSoft = [234, 255, 163];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // Subtle vertical gradient so the flat icon still has depth.
      const t = y / size;
      put(x, y, [
        Math.round(8 + t * 10),
        Math.round(9 + t * 13),
        Math.round(10 + t * 2),
      ]);

      const px = x / unit;
      const py = y / unit;

      // Glow behind the mark.
      const dx = px - 256;
      const dy = py - 250;
      if (dx * dx + dy * dy < 190 * 190) put(x, y, [13 + Math.round((1 - Math.sqrt(dx * dx + dy * dy) / 190) * 10), 20 + Math.round((1 - Math.sqrt(dx * dx + dy * dy) / 190) * 18), 12]);

      // Dumbbell: handle, inner plates, outer plates.
      if (inRoundRect(px, py, 236, 240, 276, 272, 10)) put(x, y, lime);
      if (inRoundRect(px, py, 190, 190, 240, 322, 18)) put(x, y, lime);
      if (inRoundRect(px, py, 272, 190, 322, 322, 18)) put(x, y, lime);
      if (inRoundRect(px, py, 150, 218, 194, 294, 14)) put(x, y, limeSoft);
      if (inRoundRect(px, py, 318, 218, 362, 294, 14)) put(x, y, limeSoft);

      // A tight ring keeps the mark readable at 48px.
      const ring = Math.abs(Math.hypot(px - 256, py - 256) - 190);
      if (ring < 1.2) put(x, y, [44, 56, 22]);
    }
  }
  return pixels;
}

mkdirSync("public/icons", { recursive: true });
for (const [size, name] of [
  [512, "icon-512.png"],
  [192, "icon-192.png"],
  [180, "apple-touch-icon.png"],
]) {
  const file = `public/icons/${name}`;
  writeFileSync(file, encodePng(size, render(size)));
  console.log(`wrote ${file}`);
}
