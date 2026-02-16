#!/usr/bin/env node
/**
 * Generate icon.png and icon.ico for StudioFlow Timer
 * Run: node generate-icons.js
 *
 * Creates a purple clock/timer icon programmatically.
 * Generates both PNG and ICO format.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Distance from point to line segment
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt((px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2);
}

function generateIcon(size) {
  // RGBA raw pixel buffer
  const pixels = Buffer.alloc(size * size * 4, 0);

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 1;
  const ringWidth = Math.max(2, size * 0.12);
  const innerR = outerR - ringWidth;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 4;
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let r = 0, g = 0, b = 0, a = 0;

      // Anti-aliased circle ring (purple #a657f0)
      if (dist <= outerR && dist >= innerR) {
        const edgeO = outerR - dist;
        const edgeI = dist - innerR;
        a = Math.min(1, edgeO * 2, edgeI * 2);
        r = 0xa6; g = 0x57; b = 0xf0;
      }
      // Dark clock face
      else if (dist < innerR) {
        const edge = innerR - dist;
        a = Math.min(1, edge * 2);
        r = 0x1a; g = 0x1a; b = 0x2e;

        // Clock hands
        const hourAngle = -60 * Math.PI / 180;
        const hourLen = innerR * 0.5;
        const hourEx = cx + Math.sin(hourAngle) * hourLen;
        const hourEy = cy - Math.cos(hourAngle) * hourLen;

        const minAngle = 60 * Math.PI / 180;
        const minLen = innerR * 0.78;
        const minEx = cx + Math.sin(minAngle) * minLen;
        const minEy = cy - Math.cos(minAngle) * minLen;

        const thick = Math.max(1, size * 0.04);

        const hDist = distToSeg(x + 0.5, y + 0.5, cx, cy, hourEx, hourEy);
        const mDist = distToSeg(x + 0.5, y + 0.5, cx, cy, minEx, minEy);

        if (hDist <= thick + 0.5) {
          const ha = Math.min(1, (thick + 0.5 - hDist) * 1.5) * a;
          r = Math.round(0xff * ha + r * (1 - ha));
          g = Math.round(0xff * ha + g * (1 - ha));
          b = Math.round(0xff * ha + b * (1 - ha));
        }
        if (mDist <= thick + 0.5) {
          const ma = Math.min(1, (thick + 0.5 - mDist) * 1.5) * a;
          r = Math.round(0xff * ma + r * (1 - ma));
          g = Math.round(0xff * ma + g * (1 - ma));
          b = Math.round(0xff * ma + b * (1 - ma));
        }

        // Center dot
        const cdR = Math.max(1.5, size * 0.06);
        if (dist <= cdR) {
          r = 0xff; g = 0xff; b = 0xff;
        }

        // Tick marks at 12, 3, 6, 9
        for (let h = 0; h < 4; h++) {
          const angle = h * 90 * Math.PI / 180;
          const markInner = innerR * 0.82;
          const markOuter = innerR * 0.95;
          const markCx = cx + Math.sin(angle);
          const markCy = cy - Math.cos(angle);
          // Check if pixel is on this tick mark
          const msx = cx + Math.sin(angle) * markInner;
          const msy = cy - Math.cos(angle) * markInner;
          const mex = cx + Math.sin(angle) * markOuter;
          const mey = cy - Math.cos(angle) * markOuter;
          const tDist = distToSeg(x + 0.5, y + 0.5, msx, msy, mex, mey);
          const tThick = Math.max(0.8, size * 0.025);
          if (tDist <= tThick + 0.3) {
            const ta = Math.min(1, (tThick + 0.3 - tDist) * 2) * a;
            r = Math.round(0xaa * ta + r * (1 - ta));
            g = Math.round(0x77 * ta + g * (1 - ta));
            b = Math.round(0xdd * ta + b * (1 - ta));
          }
        }
      }

      pixels[o]     = Math.round(r);
      pixels[o + 1] = Math.round(g);
      pixels[o + 2] = Math.round(b);
      pixels[o + 3] = Math.round(a * 255);
    }
  }
  return pixels;
}

// Minimal PNG encoder
function createPNG(width, height, rgbaPixels) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type (RGBA)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // IDAT chunk — raw pixel data with filter byte 0 per row
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // filter: none
    rgbaPixels.copy(rawData, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeB, data]);
  const crc = crc32(crcData);
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crc >>> 0);
  return Buffer.concat([len, typeB, data, crcB]);
}

// CRC-32
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c;
    }
    crc32.table = table;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Create ICO file with multiple sizes
function createICO(sizes) {
  const images = sizes.map(size => {
    const pixels = generateIcon(size);
    const png = createPNG(size, size, pixels);
    return { size, png };
  });

  // ICO header: 6 bytes
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * images.length;
  let dataOffset = headerSize + dirSize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);     // reserved
  header.writeUInt16LE(1, 2);     // type: ICO
  header.writeUInt16LE(images.length, 4);

  const dirEntries = [];
  const pngBuffers = [];

  for (const img of images) {
    const entry = Buffer.alloc(dirEntrySize);
    entry[0] = img.size >= 256 ? 0 : img.size;  // width (0 = 256)
    entry[1] = img.size >= 256 ? 0 : img.size;  // height
    entry[2] = 0;  // color palette
    entry[3] = 0;  // reserved
    entry.writeUInt16LE(1, 4);   // color planes
    entry.writeUInt16LE(32, 6);  // bits per pixel
    entry.writeUInt32LE(img.png.length, 8);  // data size
    entry.writeUInt32LE(dataOffset, 12);     // data offset
    dirEntries.push(entry);
    pngBuffers.push(img.png);
    dataOffset += img.png.length;
  }

  return Buffer.concat([header, ...dirEntries, ...pngBuffers]);
}

// Main
console.log('Generating StudioFlow Timer icons...');

const png256 = createPNG(256, 256, generateIcon(256));
fs.writeFileSync(path.join(__dirname, 'icon.png'), png256);
console.log('  ✓ icon.png (256x256)');

const ico = createICO([16, 32, 48, 256]);
fs.writeFileSync(path.join(__dirname, 'icon.ico'), ico);
console.log('  ✓ icon.ico (16, 32, 48, 256)');

console.log('Done!');
