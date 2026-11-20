import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");
const pwaDir = path.join(publicDir, "pwa");

fs.mkdirSync(pwaDir, { recursive: true });

// 1. Write crisp vector icon.svg matching BrandMark.tsx and DESIGN.md tokens
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FAF8F4" />
      <stop offset="100%" stop-color="#E6EFEA" />
    </linearGradient>
    <linearGradient id="barGrad" x1="0" y1="160" x2="0" y2="416" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#29302C" />
      <stop offset="100%" stop-color="#161A18" />
    </linearGradient>
  </defs>
  <rect x="16" y="16" width="480" height="480" rx="112" fill="url(#bgGrad)" stroke="#4A7C64" stroke-opacity="0.28" stroke-width="12" />
  <rect x="92" y="294" width="54" height="122" rx="20" fill="url(#barGrad)" />
  <rect x="182" y="232" width="54" height="184" rx="20" fill="url(#barGrad)" />
  <rect x="272" y="262" width="54" height="154" rx="20" fill="url(#barGrad)" />
  <rect x="362" y="182" width="54" height="234" rx="20" fill="#4A7C64" />
  <path d="M96 244L204 162L292 194L412 96M412 96H338M412 96V170" stroke="#1F4D3A" stroke-width="34" stroke-linecap="round" stroke-linejoin="round" />
</svg>
`;

fs.writeFileSync(path.join(pwaDir, "icon.svg"), svgIcon, "utf8");

// Minimal deterministic PNG encoder using Node built-in zlib
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter none
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", compressed),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function sdRoundedBox(px, py, cx, cy, halfW, halfH, r) {
  const qx = Math.abs(px - cx) - halfW + r;
  const qy = Math.abs(py - cy) - halfH + r;
  const outDist = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inDist = Math.min(Math.max(qx, qy), 0);
  return outDist + inDist - r;
}

function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay || 1), 0, 1);
  return Math.hypot(pax - bax * h, pay - bay * h);
}

function blendPixel(buf, idx, r, g, b, alpha) {
  if (alpha <= 0) return;
  const a = clamp(alpha, 0, 1);
  const inv = 1 - a;
  const dstA = buf[idx + 3] / 255;
  const outA = a + dstA * inv;
  if (outA <= 0) return;
  buf[idx] = Math.round((r * a + buf[idx] * dstA * inv) / outA);
  buf[idx + 1] = Math.round((g * a + buf[idx + 1] * dstA * inv) / outA);
  buf[idx + 2] = Math.round((b * a + buf[idx + 2] * dstA * inv) / outA);
  buf[idx + 3] = Math.round(outA * 255);
}

function renderBrandIcon(size, maskable = false) {
  const rgba = Buffer.alloc(size * size * 4, 0);
  const scale = size / 512;
  const aa = 1.25 / scale;

  // Safe zone inset for maskable icons
  const contentScale = maskable ? 0.8 : 1.0;
  const toDesignCoord = (v) => (v - 256) / contentScale + 256;

  const bars = [
    { cx: 119, cy: 355, hw: 27, hh: 61, r: 18, color: [22, 26, 24] },
    { cx: 209, cy: 324, hw: 27, hh: 92, r: 18, color: [22, 26, 24] },
    { cx: 299, cy: 339, hw: 27, hh: 77, r: 18, color: [22, 26, 24] },
    { cx: 389, cy: 299, hw: 27, hh: 117, r: 18, color: [74, 124, 100] },
  ];

  const arrowSegments = [
    [96, 244, 204, 162],
    [204, 162, 292, 194],
    [292, 194, 412, 96],
    [412, 96, 338, 96],
    [412, 96, 412, 170],
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const gx = (x + 0.5) / scale;
      const gy = (y + 0.5) / scale;

      // Background rounded tile (full-bleed if maskable)
      const bgDist = maskable ? -100 : sdRoundedBox(gx, gy, 256, 256, 240, 240, 108);
      if (bgDist < aa) {
        const bgAlpha = maskable ? 1 : clamp(0.5 - bgDist / (2 * aa), 0, 1);
        const t = clamp((gx + gy) / 1024, 0, 1);
        // Warm Ivory #FAF8F4 (250,248,244) -> Ambient Sage #E6EFEA (230,239,234)
        const br = Math.round(250 + (230 - 250) * t);
        const bg = Math.round(248 + (239 - 248) * t);
        const bb = Math.round(244 + (234 - 244) * t);
        blendPixel(rgba, idx, br, bg, bb, bgAlpha);

        // Subtle outer border for non-maskable icon
        if (!maskable) {
          const borderDist = Math.abs(bgDist + 4) - 4;
          if (borderDist < aa) {
            const bAlpha = clamp(0.5 - borderDist / (2 * aa), 0, 1) * 0.28 * bgAlpha;
            blendPixel(rgba, idx, 74, 124, 100, bAlpha);
          }
        }

        const dx = toDesignCoord(gx);
        const dy = toDesignCoord(gy);

        // Render 4 analytical bars
        for (const bar of bars) {
          const dBar = sdRoundedBox(dx, dy, bar.cx, bar.cy, bar.hw, bar.hh, bar.r);
          if (dBar < aa) {
            const aBar = clamp(0.5 - dBar / (2 * aa), 0, 1);
            blendPixel(rgba, idx, bar.color[0], bar.color[1], bar.color[2], aBar);
          }
        }

        // Render Forest Sage trend arrow (#1F4D3A = 31, 77, 58)
        let minArrowDist = Infinity;
        for (const seg of arrowSegments) {
          const dSeg = sdSegment(dx, dy, seg[0], seg[1], seg[2], seg[3]) - 17;
          if (dSeg < minArrowDist) minArrowDist = dSeg;
        }
        if (minArrowDist < aa) {
          const aArrow = clamp(0.5 - minArrowDist / (2 * aa), 0, 1);
          blendPixel(rgba, idx, 31, 77, 58, aArrow);
        }
      }
    }
  }

  return encodePng(size, size, rgba);
}

fs.writeFileSync(path.join(pwaDir, "icon-192.png"), renderBrandIcon(192, false));
fs.writeFileSync(path.join(pwaDir, "icon-512.png"), renderBrandIcon(512, false));
fs.writeFileSync(path.join(pwaDir, "icon-maskable-512.png"), renderBrandIcon(512, true));
fs.writeFileSync(path.join(publicDir, "apple-touch-icon.png"), renderBrandIcon(180, true));

console.log("Generated Tip Autopsy PWA icons successfully.");
