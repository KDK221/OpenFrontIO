// The territory-pattern wire format (see shared/PatternDecoder.ts), encoded.

const B64URL =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Unpadded base64url, the encoding PatternDataSchema expects. */
export function toBase64url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (b0 << 16) | (b1 << 8) | b2;
    out += B64URL[(n >> 18) & 63] + B64URL[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64URL[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64URL[n & 63];
  }
  return out;
}

/**
 * Encodes a bitmap in the PatternDecoder wire format: version byte 0, then
 * scale (3 bits) and width-2 (7 bits) and height-2 (6 bits) packed into two
 * bytes, then row-major bits where 0 marks the primary colour.
 */
export function encodePattern(
  width: number,
  height: number,
  scale: number,
  primary: (x: number, y: number) => boolean,
): string {
  if (width < 2 || width > 129 || height < 2 || height > 65) {
    throw new Error("pattern size out of range");
  }
  if (scale < 0 || scale > 7) throw new Error("pattern scale out of range");
  const w = width - 2;
  const h = height - 2;
  const bits = width * height;
  const bytes = new Uint8Array(3 + ((bits + 7) >> 3));
  bytes[0] = 0;
  bytes[1] = (scale & 0x07) | ((w & 0x1f) << 3);
  bytes[2] = ((w >> 5) & 0x03) | ((h & 0x3f) << 2);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!primary(x, y)) {
        const idx = y * width + x;
        bytes[3 + (idx >> 3)] |= 1 << (idx & 7);
      }
    }
  }
  return toBase64url(bytes);
}
