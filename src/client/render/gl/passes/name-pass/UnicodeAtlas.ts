import type { GlyphTables } from "./AtlasData";
import { CHAR_RANGE, STATIC_CHAR_RANGE, type ParsedAtlas } from "./Types";

const SIZE = 2048;
const CELL = 48;
const COLUMNS = Math.floor(SIZE / CELL);
const FONT_SIZE = 36;
const PAD = 5;

/** Rasterize missing glyphs with the browser's native Unicode font fallback.
 * Stable atlas indices, rather than truncated character codes, go to the GPU.
 * Each unique glyph is drawn/uploaded once per game, never once per frame.
 */
export class UnicodeAtlas {
  readonly texture: WebGLTexture;
  private readonly canvas = document.createElement("canvas");
  private readonly ctx: CanvasRenderingContext2D;
  private readonly indices = new Map<string, number>();

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly metrics: WebGLTexture,
    private readonly glyph: GlyphTables,
    private readonly atlas: ParsedAtlas,
  ) {
    this.canvas.width = this.canvas.height = CELL;
    this.ctx = this.canvas.getContext("2d")!;
    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      SIZE,
      SIZE,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
  }

  encode(character: string): number {
    const code = character.codePointAt(0)!;
    if (code < STATIC_CHAR_RANGE && this.glyph.advance[code] > 0) return code;
    const cached = this.indices.get(character);
    if (cached !== undefined) return cached;
    const cell = this.indices.size;
    const index = STATIC_CHAR_RANGE + cell;
    // Never wrap an overflowing code point into an unrelated Latin character.
    if (index >= CHAR_RANGE || cell >= COLUMNS * COLUMNS) return 63;
    const x = (cell % COLUMNS) * CELL;
    const y = Math.floor(cell / COLUMNS) * CELL;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CELL, CELL);
    ctx.font = `bold ${FONT_SIZE}px system-ui, sans-serif`;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "white";
    ctx.fillText(character, PAD, FONT_SIZE, CELL - 2 * PAD);
    const scale = this.atlas.fontSize / FONT_SIZE;
    const advance =
      Math.min(ctx.measureText(character).width, CELL - 2 * PAD) * scale;
    this.glyph.advance[index] = advance;
    this.glyph.xOffset[index] = -PAD * scale;
    this.glyph.visW[index] = CELL * scale;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      x,
      y,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.canvas,
    );
    gl.bindTexture(gl.TEXTURE_2D, this.metrics);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      index,
      0,
      1,
      1,
      gl.RGBA,
      gl.FLOAT,
      new Float32Array([
        advance,
        -PAD * scale,
        this.atlas.base - FONT_SIZE * scale,
        CELL * scale,
      ]),
    );
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      index,
      1,
      1,
      1,
      gl.RGBA,
      gl.FLOAT,
      new Float32Array([CELL * scale, x / SIZE, y / SIZE, (x + CELL) / SIZE]),
    );
    this.indices.set(character, index);
    return index;
  }

  dispose(): void {
    this.gl.deleteTexture(this.texture);
  }
}
