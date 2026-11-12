import { html, LitElement } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import {
  cloneGrid,
  floodFill,
  paintLine,
  setCell,
  type Grid,
} from "../steam/SteamDrawing";

export type PixelTool = "pen" | "fill";

const MAX_UNDO = 40;

/**
 * A pixel canvas: click or drag to paint cells, or bucket-fill a region.
 * The grid is owned by the parent, which gets every edit as a `grid-change`
 * event with a fresh Grid and passes it back in.
 */
@customElement("pixel-editor")
export class PixelEditor extends LitElement {
  @property({ attribute: false }) grid!: Grid;
  /** CSS colour for each cell value. */
  @property({ attribute: false }) colors: string[] = [];
  /** The value painted by the pen and the fill. */
  @property({ type: Number }) value = 1;
  @property() tool: PixelTool = "pen";

  @query("canvas") private canvas?: HTMLCanvasElement;

  private history: Grid[] = [];
  private working: Grid | null = null;
  private last: [number, number] | null = null;

  createRenderRoot() {
    return this;
  }

  /** Steps back one stroke. Returns false when there is nothing to undo. */
  undo(): boolean {
    const prev = this.history.pop();
    if (prev === undefined) return false;
    this.emit(prev);
    return true;
  }

  canUndo(): boolean {
    return this.history.length > 0;
  }

  /** Forgets the undo history, e.g. when a picture replaces the drawing. */
  resetHistory(): void {
    this.history = [];
  }

  /** Records the current grid so the next change can be undone. */
  remember(): void {
    this.history.push(cloneGrid(this.grid));
    if (this.history.length > MAX_UNDO) this.history.shift();
  }

  render() {
    return html`<canvas
      class="pixel-editor-canvas block w-full touch-none cursor-crosshair rounded-md"
      @pointerdown=${this.onDown}
      @pointermove=${this.onMove}
      @pointerup=${this.onUp}
      @pointercancel=${this.onUp}
      @contextmenu=${(e: Event) => e.preventDefault()}
    ></canvas>`;
  }

  updated() {
    this.draw();
  }

  private cellAt(e: PointerEvent): [number, number] {
    const rect = this.canvas!.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * this.grid.width);
    const y = Math.floor(
      ((e.clientY - rect.top) / rect.height) * this.grid.height,
    );
    return [
      Math.max(0, Math.min(this.grid.width - 1, x)),
      Math.max(0, Math.min(this.grid.height - 1, y)),
    ];
  }

  private readonly onDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const [x, y] = this.cellAt(e);
    this.remember();
    const next = cloneGrid(this.grid);
    if (this.tool === "fill") {
      floodFill(next, x, y, this.value);
      this.emit(next);
      return;
    }
    setCell(next, x, y, this.value);
    this.working = next;
    this.last = [x, y];
    this.canvas!.setPointerCapture(e.pointerId);
    this.emit(cloneGrid(next));
  };

  private readonly onMove = (e: PointerEvent) => {
    if (this.working === null || this.last === null) return;
    const [x, y] = this.cellAt(e);
    if (x === this.last[0] && y === this.last[1]) return;
    paintLine(this.working, this.last[0], this.last[1], x, y, this.value);
    this.last = [x, y];
    this.emit(cloneGrid(this.working));
  };

  private readonly onUp = () => {
    this.working = null;
    this.last = null;
  };

  private emit(grid: Grid) {
    this.dispatchEvent(
      new CustomEvent<Grid>("grid-change", { detail: grid, bubbles: true }),
    );
  }

  private draw() {
    const canvas = this.canvas;
    const g = this.grid;
    if (canvas === undefined || g === undefined) return;
    // Integer cells so the drawing stays crisp; about 480px on the long side.
    const cell = Math.max(4, Math.floor(480 / Math.max(g.width, g.height)));
    canvas.width = g.width * cell;
    canvas.height = g.height * cell;
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;
    for (let y = 0; y < g.height; y++) {
      for (let x = 0; x < g.width; x++) {
        ctx.fillStyle = this.colors[g.cells[y * g.width + x]] ?? "#000";
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    if (cell >= 8) {
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 1; x < g.width; x++) {
        ctx.moveTo(x * cell + 0.5, 0);
        ctx.lineTo(x * cell + 0.5, canvas.height);
      }
      for (let y = 1; y < g.height; y++) {
        ctx.moveTo(0, y * cell + 0.5);
        ctx.lineTo(canvas.width, y * cell + 0.5);
      }
      ctx.stroke();
    }
  }
}
