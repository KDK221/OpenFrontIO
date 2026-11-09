/**
 * GoldenLandPass — paints the golden lands (rich farmland that speeds up
 * troop growth) as gold paddy fields over the territory, following each
 * patch's real shape. The patches come as a per-tile mask; only their
 * bounding box is uploaded and drawn.
 */

import { createProgram } from "../utils/GlUtils";

import fragSrc from "../shaders/golden-land/golden-land.frag.glsl?raw";
import vertSrc from "../shaders/golden-land/golden-land.vert.glsl?raw";

export class GoldenLandPass {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private texture: WebGLTexture | null = null;

  private uCamera: WebGLUniformLocation;
  private uRect: WebGLUniformLocation;
  private uMask: WebGLUniformLocation;
  private uTime: WebGLUniformLocation;

  // Bounding box in tiles; width 0 = nothing to draw.
  private rect: [number, number, number, number] = [0, 0, 0, 0];

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = createProgram(gl, vertSrc, fragSrc, "GoldenLandPass");

    this.uCamera = gl.getUniformLocation(this.program, "uCamera")!;
    this.uRect = gl.getUniformLocation(this.program, "uRect")!;
    this.uMask = gl.getUniformLocation(this.program, "uMask")!;
    this.uTime = gl.getUniformLocation(this.program, "uTime")!;

    // Unit quad [0,1]
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  /** The golden-land mask (255 on golden tiles), one byte per map tile. */
  setMask(mask: Uint8Array, mapWidth: number, mapHeight: number): void {
    let x0 = mapWidth;
    let y0 = mapHeight;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < mapHeight; y++) {
      const row = y * mapWidth;
      for (let x = 0; x < mapWidth; x++) {
        if (mask[row + x] === 0) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    if (x1 < 0) {
      this.rect = [0, 0, 0, 0];
      return;
    }
    // One empty tile of margin so the linear edge fades to nothing.
    x0 = Math.max(0, x0 - 1);
    y0 = Math.max(0, y0 - 1);
    x1 = Math.min(mapWidth - 1, x1 + 1);
    y1 = Math.min(mapHeight - 1, y1 + 1);
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const crop = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      crop.set(
        mask.subarray((y0 + y) * mapWidth + x0, (y0 + y) * mapWidth + x0 + w),
        y * w,
      );
    }

    const gl = this.gl;
    if (this.texture === null) this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    // The renderer keeps UNPACK_ALIGNMENT at 1 for every byte texture.
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      w,
      h,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      crop,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.rect = [x0, y0, w, h];
  }

  draw(cameraMatrix: Float32Array): void {
    if (this.texture === null || this.rect[2] === 0) return;

    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uCamera, false, cameraMatrix);
    gl.uniform4f(this.uRect, ...this.rect);
    gl.uniform1f(this.uTime, performance.now() / 1000);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.uMask, 0);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteVertexArray(this.vao);
    if (this.texture !== null) gl.deleteTexture(this.texture);
  }
}
