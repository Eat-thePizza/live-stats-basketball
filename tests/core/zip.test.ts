import { describe, it, expect } from "vitest";
import { buildZip } from "@/core/zip";

const ENC = new TextEncoder();
const DEC = new TextDecoder();

function readUint16LE(b: Uint8Array, off: number) {
  return b[off] | (b[off + 1] << 8);
}
function readUint32LE(b: Uint8Array, off: number) {
  return (
    b[off] |
    (b[off + 1] << 8) |
    (b[off + 2] << 16) |
    ((b[off + 3] << 24) >>> 0)
  );
}

describe("buildZip", () => {
  it("writes the local-header / EOCD signatures", () => {
    const zip = buildZip([{ name: "a.txt", content: "hello" }]);
    expect(readUint32LE(zip, 0)).toBe(0x04034b50); // local
    // EOCD is the last 22 bytes when there's no comment.
    expect(readUint32LE(zip, zip.length - 22)).toBe(0x06054b50);
    expect(readUint16LE(zip, zip.length - 22 + 8)).toBe(1); // 1 entry
  });

  it("contains the file name and content", () => {
    const zip = buildZip([{ name: "hi.txt", content: "hello world" }]);
    const s = DEC.decode(zip);
    expect(s).toContain("hi.txt");
    expect(s).toContain("hello world");
  });

  it("packages multiple files independently", () => {
    const zip = buildZip([
      { name: "one.csv", content: "a,b\n1,2\n" },
      { name: "two.json", content: JSON.stringify({ x: 1 }) },
      { name: "three.md", content: "# title" },
    ]);
    const s = DEC.decode(zip);
    expect(s).toContain("one.csv");
    expect(s).toContain("two.json");
    expect(s).toContain("three.md");
    expect(s).toContain('"x":1');
    // EOCD says 3 entries.
    expect(readUint16LE(zip, zip.length - 22 + 8)).toBe(3);
  });

  it("accepts raw Uint8Array content", () => {
    const bytes = ENC.encode("raw");
    const zip = buildZip([{ name: "raw.bin", content: bytes }]);
    expect(DEC.decode(zip)).toContain("raw");
  });
});
