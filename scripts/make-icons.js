// Draws the sun icon as PNGs with nothing but zlib. Writes extension/icons/{16,48,128}.png and public/favicon.png.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x + 0.5, y + 0.5);
      raw.set([r, g, b, a], y * (size * 4 + 1) + 1 + x * 4);
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

function sun(size) {
  const c = size / 2, R = size * 0.27, rayIn = size * 0.36, rayOut = size * 0.47, rayW = size * 0.06;
  const col = [245, 190, 60];
  return (x, y) => {
    const dx = x - c, dy = y - c, d = Math.hypot(dx, dy);
    let a = 0;
    if (d < R) a = 1; else if (d < R + 1) a = R + 1 - d; // soft edge
    for (let k = 0; k < 8 && a < 1; k++) {
      const t = (k * Math.PI) / 4, px = Math.cos(t), py = Math.sin(t);
      const along = dx * px + dy * py, perp = Math.abs(-dx * py + dy * px);
      if (along > rayIn && along < rayOut && perp < rayW) a = Math.max(a, Math.min(1, rayW - perp + 0.5));
    }
    return [...col, Math.round(Math.min(1, a) * 255)];
  };
}

for (const s of [16, 48, 128]) {
  fs.mkdirSync(path.join(ROOT, "extension", "icons"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "extension", "icons", `${s}.png`), png(s, sun(s)));
}
fs.writeFileSync(path.join(ROOT, "public", "favicon.png"), png(64, sun(64)));
console.log("icons written");
