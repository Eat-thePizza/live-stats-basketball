// Minimal store-only (compression method 0) ZIP writer.
// No external dependencies. Sufficient for packaging small text artifacts
// such as CSV / TXT / Markdown / JSON game-export files.

const TEXT_ENCODER = new TextEncoder();

// CRC-32 (IEEE 802.3) — table-driven.
let CRC_TABLE: Uint32Array | null = null;
function crcTable(): Uint32Array {
  if (CRC_TABLE) return CRC_TABLE;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  CRC_TABLE = t;
  return t;
}
function crc32(data: Uint8Array): number {
  const t = crcTable();
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = t[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipFile {
  name: string;
  // Either provide string content (UTF-8 encoded) or raw bytes.
  content: string | Uint8Array;
}

interface Entry {
  nameBytes: Uint8Array;
  data: Uint8Array;
  crc: number;
  size: number;
  offset: number;
  // 1980-01-01 00:00:00 in DOS format (constant — keeps output deterministic).
  modTime: number;
  modDate: number;
}

function dosTime(d: Date): { time: number; date: number } {
  const time =
    (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date =
    ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time: time & 0xffff, date: date & 0xffff };
}

function writeUint16LE(view: DataView, off: number, val: number) {
  view.setUint16(off, val, true);
}
function writeUint32LE(view: DataView, off: number, val: number) {
  view.setUint32(off, val, true);
}

/**
 * Build a ZIP archive (store/no-compression) from the given files.
 * Returns the full archive as a Uint8Array.
 */
export function buildZip(files: ZipFile[], at: Date = new Date()): Uint8Array {
  const { time: modTime, date: modDate } = dosTime(at);

  const entries: Entry[] = files.map(f => {
    const nameBytes = TEXT_ENCODER.encode(f.name);
    const data =
      typeof f.content === "string" ? TEXT_ENCODER.encode(f.content) : f.content;
    return {
      nameBytes,
      data,
      crc: crc32(data),
      size: data.length,
      offset: 0,
      modTime,
      modDate,
    };
  });

  // Compute total size and offsets.
  let localTotal = 0;
  for (const e of entries) {
    e.offset = localTotal;
    localTotal += 30 + e.nameBytes.length + e.size;
  }
  let centralSize = 0;
  for (const e of entries) {
    centralSize += 46 + e.nameBytes.length;
  }
  const total = localTotal + centralSize + 22;

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  let p = 0;

  // Local file headers + data.
  for (const e of entries) {
    writeUint32LE(view, p, 0x04034b50); // local header sig
    writeUint16LE(view, p + 4, 20); // version needed to extract
    writeUint16LE(view, p + 6, 1 << 11); // general purpose flag (bit 11 = UTF-8)
    writeUint16LE(view, p + 8, 0); // compression method = store
    writeUint16LE(view, p + 10, e.modTime);
    writeUint16LE(view, p + 12, e.modDate);
    writeUint32LE(view, p + 14, e.crc);
    writeUint32LE(view, p + 18, e.size); // compressed size
    writeUint32LE(view, p + 22, e.size); // uncompressed size
    writeUint16LE(view, p + 26, e.nameBytes.length);
    writeUint16LE(view, p + 28, 0); // extra field length
    p += 30;
    out.set(e.nameBytes, p);
    p += e.nameBytes.length;
    out.set(e.data, p);
    p += e.size;
  }

  // Central directory.
  const centralStart = p;
  for (const e of entries) {
    writeUint32LE(view, p, 0x02014b50); // central dir sig
    writeUint16LE(view, p + 4, 20); // version made by
    writeUint16LE(view, p + 6, 20); // version needed
    writeUint16LE(view, p + 8, 1 << 11); // flag (UTF-8)
    writeUint16LE(view, p + 10, 0); // method
    writeUint16LE(view, p + 12, e.modTime);
    writeUint16LE(view, p + 14, e.modDate);
    writeUint32LE(view, p + 16, e.crc);
    writeUint32LE(view, p + 20, e.size);
    writeUint32LE(view, p + 24, e.size);
    writeUint16LE(view, p + 28, e.nameBytes.length);
    writeUint16LE(view, p + 30, 0); // extra field
    writeUint16LE(view, p + 32, 0); // comment
    writeUint16LE(view, p + 34, 0); // disk number
    writeUint16LE(view, p + 36, 0); // internal attrs
    writeUint32LE(view, p + 38, 0); // external attrs
    writeUint32LE(view, p + 42, e.offset);
    p += 46;
    out.set(e.nameBytes, p);
    p += e.nameBytes.length;
  }

  // EOCD.
  writeUint32LE(view, p, 0x06054b50);
  writeUint16LE(view, p + 4, 0); // disk
  writeUint16LE(view, p + 6, 0); // disk with central dir
  writeUint16LE(view, p + 8, entries.length);
  writeUint16LE(view, p + 10, entries.length);
  writeUint32LE(view, p + 12, centralSize);
  writeUint32LE(view, p + 16, centralStart);
  writeUint16LE(view, p + 20, 0); // comment len

  return out;
}
