import { describe, expect, it, vi } from "vitest";
import { layoutString } from "../../../../src/client/render/gl/passes/name-pass/TextLayout";
import { UnicodeAtlas } from "../../../../src/client/render/gl/passes/name-pass/UnicodeAtlas";
import {
  CHAR_RANGE,
  MAX_CHARS,
} from "../../../../src/client/render/gl/passes/name-pass/Types";

describe("Unicode map names", () => {
  function setup() {
    const gl: any = {
      createTexture: vi.fn(() => ({})),
      bindTexture: vi.fn(),
      texParameteri: vi.fn(),
      texImage2D: vi.fn(),
      texSubImage2D: vi.fn(),
      deleteTexture: vi.fn(),
    };
    const glyph = {
      advance: new Float32Array(CHAR_RANGE),
      xOffset: new Float32Array(CHAR_RANGE),
      visW: new Float32Array(CHAR_RANGE),
    };
    glyph.advance[65] = 24;
    glyph.visW[65] = 24;
    const atlas = new UnicodeAtlas(gl, {} as WebGLTexture, glyph, {
      fontSize: 48,
      base: 36,
    } as any);
    return { gl, glyph, atlas };
  }
  it.each([
    "백제",
    "고구려",
    "손권군",
    "孫権軍",
    "織田信長",
    "孙权军",
    "A😀한",
  ])("preserves %s as distinct stable glyphs", (name) => {
    const { gl, glyph, atlas } = setup();
    const codes = new Uint16Array(MAX_CHARS);
    const cursors = new Float32Array(MAX_CHARS);
    const kern = new Int8Array(CHAR_RANGE * CHAR_RANGE);
    const width = layoutString(name, glyph, kern, codes, cursors, (c) =>
      atlas.encode(c),
    );
    const characters = Array.from(name);
    expect(width).toBeGreaterThan(0);
    expect(Number.isFinite(width)).toBe(true);
    expect(new Set(codes.slice(0, characters.length)).size).toBe(
      new Set(characters).size,
    );
    characters.forEach((c, i) => {
      expect(codes[i]).toBe(atlas.encode(c));
      if (c !== "A") expect(codes[i]).toBeGreaterThanOrEqual(384);
    });
    const uploads = gl.texSubImage2D.mock.calls.length;
    layoutString(name, glyph, kern, codes, cursors, (c) => atlas.encode(c));
    expect(gl.texSubImage2D.mock.calls.length).toBe(uploads);
    expect(codes[characters.length]).toBe(0);
  });
  it("handles empty labels without NaN", () => {
    const { glyph } = setup();
    expect(
      layoutString(
        "",
        glyph,
        new Int8Array(CHAR_RANGE * CHAR_RANGE),
        new Uint16Array(MAX_CHARS),
        new Float32Array(MAX_CHARS),
      ),
    ).toBe(0);
  });
});
