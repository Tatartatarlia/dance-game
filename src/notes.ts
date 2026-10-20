import Phaser from "phaser";
import {
  BUTTON_R,
  HOLD_APPROACH,
  HOLD_TRAVEL,
  INNER_R,
  MID_R,
  OUTER_R,
  RING_START,
  TAP_APPROACH,
  padPos,
  type NoteData,
} from "./chart";
import { JUDGE_LABEL, combineJudges, judgeTimed, type Judge } from "./scoring";

export interface PointerLike {
  id: number;
  x: number;
  y: number;
}

const HOLD_WINDOWS = { perfect: 90, good: 155, ok: 240 };

/** 从外向内：完美、不错、一般。缩过最内圈记为错过。 */
function ringJudge(scale: number): Judge | null {
  if (scale > 1.92) return null;
  if (scale > 1.56) return "perfect";
  if (scale > 1.18) return "good";
  if (scale >= 0.86) return "ok";
  return "miss";
}

function slideJudge(elapsed: number): Judge {
  if (elapsed <= 340) return "perfect";
  if (elapsed <= 500) return "good";
  if (elapsed <= 720) return "ok";
  return "miss";
}

export class ActiveNote {
  readonly data: NoteData;
  dead = false;

  private readonly scene: Phaser.Scene;
  private readonly onResolve: (judge: Judge, x: number, y: number) => void;
  private readonly root: Phaser.GameObjects.Container;
  private readonly dyn: Phaser.GameObjects.Graphics;
  private readonly cue: Phaser.GameObjects.Text;
  private resolved = false;
  private pressed = false;
  private first: Judge | null = null;
  private pointerId: number | null = null;
  private pressAt = 0;
  private scale = RING_START;

  constructor(
    scene: Phaser.Scene,
    data: NoteData,
    onResolve: (judge: Judge, x: number, y: number) => void,
  ) {
    this.scene = scene;
    this.data = data;
    this.onResolve = onResolve;
    const pos = padPos(data.pad);
    this.root = scene.add.container(pos.x, pos.y).setDepth(6);
    const base = scene.add.graphics();
    this.dyn = scene.add.graphics();
    this.cue = scene.add
      .text(0, 0, "", {
        fontFamily: 'KaiTi, STKaiti, "Microsoft YaHei", serif',
        fontSize: "22px",
        color: "#fffaf2",
        stroke: "#7a3040",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.root.add([base, this.dyn, this.cue]);
    this.drawBase(base);
  }

  get settled(): boolean {
    return this.resolved;
  }

  update(now: number): void {
    if (this.resolved) return;
    this.expire(now);
    if (this.resolved) return;
    this.redraw(now);
  }

  pressDistance(pointer: PointerLike, now: number): number | null {
    if (!this.canPress(now)) return null;
    const pos = padPos(this.data.pad);
    const distance = Math.hypot(pointer.x - pos.x, pointer.y - pos.y);
    return distance <= this.reach() ? distance : null;
  }

  tryPress(pointer: PointerLike, now: number): boolean {
    if (this.pressDistance(pointer, now) === null) return false;
    if (this.data.kind === "tap" || this.data.kind === "slide") {
      this.scale = this.scaleOf(now);
      const judge = ringJudge(this.scale);
      if (!judge) return false;
      if (this.data.kind === "tap") {
        this.finish(judge);
        return true;
      }
      this.pressed = true;
      this.first = judge;
      this.pointerId = pointer.id;
      this.pressAt = now;
      return true;
    }
    const judge = judgeTimed(now - this.data.time, HOLD_WINDOWS, false);
    if (!judge) return false;
    this.pressed = true;
    this.first = judge;
    this.pointerId = pointer.id;
    return true;
  }

  tryArrive(pointer: PointerLike, now: number): boolean {
    if (this.resolved || this.data.kind !== "slide" || !this.pressed || !this.first) return false;
    const dest = this.data.toPad;
    if (dest === undefined) return false;
    const pos = padPos(dest);
    if (Math.hypot(pointer.x - pos.x, pointer.y - pos.y) > BUTTON_R + 28) return false;
    this.finish(combineJudges(this.first, slideJudge(now - this.pressAt)));
    return true;
  }

  release(pointer: PointerLike, now: number): void {
    if (this.resolved || this.pointerId !== pointer.id) return;
    if (this.data.kind === "hold" && this.pressed && this.first) {
      const second = judgeTimed(now - this.releaseTime, HOLD_WINDOWS, true);
      this.finish(combineJudges(this.first, second ?? "miss"));
      return;
    }
    if (this.data.kind === "slide" && this.pressed && this.first) {
      this.finish(combineJudges(this.first, "miss"));
    }
  }

  forceMiss(): void {
    if (this.resolved) return;
    if (this.first) this.finish(combineJudges(this.first, "miss"));
    else this.finish("miss");
  }

  private get releaseTime(): number {
    return this.data.time + (this.data.duration ?? 0);
  }

  private canPress(now: number): boolean {
    if (this.resolved || this.pressed) return false;
    if (this.data.kind === "hold") return judgeTimed(now - this.data.time, HOLD_WINDOWS, false) !== null;
    return ringJudge(this.scaleOf(now)) !== null;
  }

  private reach(): number {
    if (this.data.kind === "hold") return BUTTON_R + 46;
    return Math.max(BUTTON_R + 28, this.scale * INNER_R + 16);
  }

  private scaleOf(now: number): number {
    const appear = this.data.time - TAP_APPROACH;
    if (now <= this.data.time) {
      const progress = Phaser.Math.Clamp((now - appear) / TAP_APPROACH, 0, 1);
      return RING_START - (RING_START - 1) * progress;
    }
    const late = Phaser.Math.Clamp((now - this.data.time) / 240, 0, 1);
    return 1 - 0.24 * late;
  }

  private fallOffset(hitTime: number, now: number): number {
    const speed = HOLD_TRAVEL / HOLD_APPROACH;
    const distance = (hitTime - now) * speed;
    return -Phaser.Math.Clamp(distance, -36, HOLD_TRAVEL);
  }

  private expire(now: number): void {
    if (this.data.kind === "hold") {
      if (!this.pressed && now > this.data.time + HOLD_WINDOWS.ok) this.finish("miss");
      else if (this.pressed && this.first && now > this.releaseTime + HOLD_WINDOWS.ok) {
        this.finish(combineJudges(this.first, "miss"));
      }
      return;
    }
    if (!this.pressed && now > this.data.time + 230) {
      this.finish("miss");
      return;
    }
    if (this.data.kind === "slide" && this.pressed && this.first && now > this.pressAt + 720) {
      this.finish(combineJudges(this.first, "miss"));
    }
  }

  private drawBase(g: Phaser.GameObjects.Graphics): void {
    if (this.data.kind === "hold") return;
    g.lineStyle(5, 0xe4548a, 1);
    g.strokeCircle(0, 0, OUTER_R);
    g.lineStyle(4, 0x3aa0d8, 1);
    g.strokeCircle(0, 0, MID_R);
    g.lineStyle(4, 0x3f9d62, 1);
    g.strokeCircle(0, 0, INNER_R);
  }

  private redraw(now: number): void {
    this.dyn.clear();
    if (this.data.kind === "hold") {
      this.drawBeam(now);
      return;
    }
    this.scale = this.pressed ? this.scale : this.scaleOf(now);
    const color = this.data.kind === "slide" ? 0xf0943a : 0xe25b6a;
    const radius = INNER_R * this.scale;
    const waiting = ringJudge(this.scale);
    this.dyn.lineStyle(8, color, waiting === null ? 0.45 : 1);
    this.dyn.strokeCircle(0, 0, radius);
    this.dyn.lineStyle(2, 0xffffff, 0.85);
    this.dyn.strokeCircle(0, 0, Math.max(4, radius - 7));
    if (waiting === "perfect") {
      this.dyn.lineStyle(14, 0xe4548a, 0.28);
      this.dyn.strokeCircle(0, 0, OUTER_R);
      this.cue.setText("完美").setAlpha(1);
    } else {
      this.cue.setAlpha(0);
    }
    if (this.data.kind === "slide") this.drawArrow(now);
  }

  private drawBeam(now: number): void {
    const head = this.fallOffset(this.data.time, now);
    const tail = this.fallOffset(this.releaseTime, now);
    const top = Math.min(head, tail);
    const height = Math.abs(head - tail);
    if (height > 8) {
      this.dyn.fillStyle(0x8fd4f8, 0.38);
      this.dyn.fillRoundedRect(-18, top, 36, height, 16);
      this.dyn.fillStyle(0xffffff, 0.28);
      this.dyn.fillRoundedRect(-6, top, 8, height, 6);
    }
    const pressHot = !this.pressed && Math.abs(now - this.data.time) <= HOLD_WINDOWS.ok;
    this.dyn.fillStyle(pressHot ? 0xfff4c4 : 0xf7fbff, 1);
    this.dyn.fillCircle(0, head, pressHot ? 18 : 14);
    this.dyn.lineStyle(3, 0x2b93cf, 1);
    this.dyn.strokeCircle(0, head, pressHot ? 18 : 14);
    const releaseHot = this.pressed && Math.abs(now - this.releaseTime) <= HOLD_WINDOWS.ok;
    this.dyn.fillStyle(releaseHot ? 0xffd56a : 0xffffff, 1);
    this.dyn.fillCircle(0, tail, releaseHot ? 11 : 7);
    if (!this.pressed && pressHot) this.cue.setText("按").setAlpha(1).setY(head - 36);
    else if (this.pressed && releaseHot) this.cue.setText("松").setAlpha(1).setY(-48);
    else if (this.pressed && this.first) this.cue.setText(JUDGE_LABEL[this.first]).setAlpha(1).setY(-48);
    else this.cue.setAlpha(0);
  }

  private drawArrow(now: number): void {
    const destIndex = this.data.toPad;
    if (destIndex === undefined) return;
    const dest = padPos(destIndex);
    const source = padPos(this.data.pad);
    const dx = dest.x - source.x;
    const dy = dest.y - source.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const inset = 56;
    const x1 = ux * inset;
    const y1 = uy * inset;
    const x2 = dx - ux * inset;
    const y2 = dy - uy * inset;
    const alpha = this.pressed ? 1 : 0.55;
    this.dyn.lineStyle(8, 0xf0943a, alpha);
    this.dyn.beginPath();
    this.dyn.moveTo(x1, y1);
    this.dyn.lineTo(x2, y2);
    this.dyn.strokePath();
    const px = -uy;
    const py = ux;
    this.dyn.fillStyle(0xf0943a, alpha);
    this.dyn.fillTriangle(
      x2,
      y2,
      x2 - ux * 20 + px * 11,
      y2 - uy * 20 + py * 11,
      x2 - ux * 20 - px * 11,
      y2 - uy * 20 - py * 11,
    );
    const pulse = this.pressed ? 0.45 + 0.4 * Math.sin(now / 110) : 0.28;
    this.dyn.lineStyle(5, 0xf0943a, pulse);
    this.dyn.strokeCircle(dx, dy, BUTTON_R + 10);
  }

  private finish(judge: Judge): void {
    if (this.resolved) return;
    this.resolved = true;
    const pos = padPos(this.data.pad);
    this.onResolve(judge, pos.x, pos.y);
    this.scene.tweens.add({
      targets: this.root,
      alpha: 0,
      duration: 180,
      onComplete: () => {
        this.root.destroy();
        this.dead = true;
      },
    });
  }
}
