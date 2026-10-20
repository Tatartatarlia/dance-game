import Phaser from "phaser";
import { audio } from "../audio";
import {
  BEAT,
  BUTTON_R,
  HOLD_APPROACH,
  PAD_XS,
  PAD_Y,
  SONG_MS,
  TAP_APPROACH,
  buildChart,
  hintFor,
  padPos,
  type NoteData,
} from "../chart";
import { ActiveNote, type PointerLike } from "../notes";
import {
  JUDGE_COLOR,
  JUDGE_LABEL,
  applyJudge,
  emptyScore,
  totalScore,
  type Judge,
  type ScoreState,
} from "../scoring";
import { FONT, paintStage } from "../stage";

const KEY_TO_PAD: Record<string, number> = { KeyA: 0, KeyS: 1, KeyD: 2 };

export class PlayScene extends Phaser.Scene {
  private readonly chart: NoteData[] = buildChart();
  private readonly queue: NoteData[] = [];
  private readonly active: ActiveNote[] = [];
  private readonly score: ScoreState = emptyScore();
  private ending = false;
  private paused = false;
  private pauseNodes: Phaser.GameObjects.GameObject[] = [];
  private timeText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private bar!: Phaser.GameObjects.Graphics;
  private pulse!: Phaser.GameObjects.Graphics;
  private muteText!: Phaser.GameObjects.Text;

  constructor() {
    super("play");
  }

  create(): void {
    paintStage(this);
    this.cameras.main.fadeIn(180);
    this.input.mouse?.disableContextMenu();
    this.ending = false;
    this.paused = false;
    this.pauseNodes = [];
    this.active.length = 0;
    Object.assign(this.score, emptyScore());
    this.queue.splice(0, this.queue.length, ...this.chart.map((note) => ({ ...note })));
    audio.beginRound();
    audio.schedule(this.chart);
    this.drawPads();
    this.drawHud();
    this.bindInput();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      audio.stop();
    });
  }

  update(): void {
    if (this.paused) return;
    const now = audio.now();
    while (this.queue.length > 0) {
      const next = this.queue[0];
      if (!next) break;
      const lead = next.kind === "hold" ? HOLD_APPROACH : TAP_APPROACH;
      if (now < next.time - lead) break;
      const note = this.queue.shift();
      if (!note) break;
      this.active.push(new ActiveNote(this, note, (judge, x, y) => this.onJudge(judge, x, y)));
    }

    for (const note of this.active) note.update(now);
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      if (this.active[i]?.dead) this.active.splice(i, 1);
    }

    const left = Phaser.Math.Clamp((SONG_MS - now) / 1000, 0, 60);
    this.timeText.setText(`剩余  ${left.toFixed(1)}`);
    this.scoreText.setText(`得分  ${totalScore(this.score)}`);
    this.comboText.setText(this.score.combo >= 2 ? `${this.score.combo} 连击` : "");
    const upcoming = this.active.find((note) => !note.settled)?.data.kind ?? this.queue[0]?.kind;
    const hint = hintFor(upcoming);
    this.hintText.setText(hint.text).setColor(hint.color);
    this.drawBar(now);
    this.maybeEnd(now);
  }

  private drawPads(): void {
    const g = this.add.graphics().setDepth(4);
    g.lineStyle(2, 0xffffff, 0.28);
    for (const x of PAD_XS) g.lineBetween(x, 330, x, PAD_Y - BUTTON_R - 8);
    const keys = ["A", "S", "D"];
    PAD_XS.forEach((x, index) => {
      g.fillStyle(0xfff7f4, 0.95);
      g.fillCircle(x, PAD_Y, BUTTON_R);
      g.lineStyle(3, 0xf0b7c6, 1);
      g.strokeCircle(x, PAD_Y, BUTTON_R);
      this.add
        .text(x, PAD_Y + 50, keys[index] ?? "", {
          fontFamily: FONT,
          fontSize: "16px",
          color: "#b57d8c",
        })
        .setOrigin(0.5)
        .setDepth(4);
    });
  }

  private drawHud(): void {
    this.add
      .text(36, 32, "宫廷舞会", { fontFamily: FONT, fontSize: "24px", color: "#7a3040" })
      .setDepth(20);
    this.timeText = this.add
      .text(36, 72, "剩余  60.0", { fontFamily: FONT, fontSize: "24px", color: "#7a3040" })
      .setDepth(20);
    this.scoreText = this.add
      .text(504, 72, "得分  0", { fontFamily: FONT, fontSize: "24px", color: "#7a3040" })
      .setOrigin(1, 0.5)
      .setDepth(20);
    this.bar = this.add.graphics().setDepth(20);
    this.pulse = this.add.graphics().setDepth(1);
    this.hintText = this.add
      .text(270, 168, hintFor(undefined).text, {
        fontFamily: FONT,
        fontSize: "18px",
        color: hintFor(undefined).color,
        align: "center",
        wordWrap: { width: 470, useAdvancedWrap: true },
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.comboText = this.add
      .text(270, 236, "", {
        fontFamily: FONT,
        fontSize: "40px",
        color: "#e25b6a",
        stroke: "#fffaf6",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(20);
    const pauseText = this.add
      .text(392, 40, "暂停", {
        fontFamily: FONT,
        fontSize: "16px",
        color: "#7a3040",
      })
      .setOrigin(1, 0.5)
      .setDepth(21)
      .setInteractive({ useHandCursor: true });
    pauseText.on("pointerdown", () => this.pauseGame());
    this.muteText = this.add
      .text(504, 40, audio.muted ? "声音关" : "声音开", {
        fontFamily: FONT,
        fontSize: "16px",
        color: "#7a3040",
      })
      .setOrigin(1, 0.5)
      .setDepth(21)
      .setInteractive({ useHandCursor: true });
    this.muteText.on("pointerdown", () => {
      audio.setMuted(!audio.muted);
      this.muteText.setText(audio.muted ? "声音关" : "声音开");
    });
  }

  private drawBar(now: number): void {
    const progress = Phaser.Math.Clamp(now / SONG_MS, 0, 1);
    this.bar.clear();
    this.bar.fillStyle(0xffffff, 0.28);
    this.bar.fillRoundedRect(36, 118, 468, 8, 4);
    this.bar.fillStyle(0xf0c14d, 0.95);
    if (progress > 0) this.bar.fillRoundedRect(36, 118, Math.max(8, 468 * progress), 8, 4);
    const pulse = Math.max(0, 1 - ((now % BEAT) / BEAT) * 4);
    this.pulse.clear();
    if (pulse > 0) {
      this.pulse.fillStyle(0xffffff, 0.2 * pulse);
      this.pulse.fillEllipse(270, 730, 300, 130);
    }
  }

  private bindInput(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.press({ id: pointer.id, x: pointer.x, y: pointer.y });
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      this.move({ id: pointer.id, x: pointer.x, y: pointer.y });
    });
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      this.release({ id: pointer.id, x: pointer.x, y: pointer.y });
    });

    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.addCapture(["A", "S", "D", "ESC"]);
    keyboard.on("keydown", (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.code === "Escape") {
        if (this.paused) this.resumeGame();
        else this.pauseGame();
        return;
      }
      if (this.paused || this.ending) return;
      const pad = KEY_TO_PAD[event.code];
      if (pad === undefined) return;
      const pos = padPos(pad);
      this.press({ id: -10 - pad, x: pos.x, y: pos.y });
    });
    keyboard.on("keyup", (event: KeyboardEvent) => {
      const pad = KEY_TO_PAD[event.code];
      if (pad === undefined) return;
      const pos = padPos(pad);
      this.release({ id: -10 - pad, x: pos.x, y: pos.y });
    });
  }

  private press(pointer: PointerLike): void {
    if (this.paused || this.ending) return;
    const now = audio.now();
    for (const note of this.active) {
      if (note.tryArrive(pointer, now)) return;
    }
    const ranked = this.active
      .map((note) => ({ note, distance: note.pressDistance(pointer, now) }))
      .filter((item): item is { note: ActiveNote; distance: number } => item.distance !== null)
      .sort((a, b) => a.distance - b.distance);
    ranked[0]?.note.tryPress(pointer, now);
  }

  private move(pointer: PointerLike): void {
    if (this.paused || this.ending) return;
    const now = audio.now();
    for (const note of this.active) note.tryArrive(pointer, now);
  }

  private release(pointer: PointerLike): void {
    if (this.ending) return;
    const now = audio.now();
    for (const note of this.active) note.release(pointer, now);
  }

  private onJudge(judge: Judge, x: number, y: number): void {
    const gained = applyJudge(this.score, judge);
    audio.playJudge(judge);
    const label = this.add
      .text(x, y - 78, gained > 0 ? `${JUDGE_LABEL[judge]}  +${gained}` : JUDGE_LABEL[judge], {
        fontFamily: FONT,
        fontSize: "30px",
        color: JUDGE_COLOR[judge],
        stroke: "#fffaf6",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.tweens.add({
      targets: label,
      y: y - 140,
      alpha: 0,
      duration: 680,
      onComplete: () => label.destroy(),
    });
    if (judge === "perfect") {
      const burst = this.add.circle(x, y, 16, 0xffe08a, 0.45).setDepth(7);
      this.tweens.add({
        targets: burst,
        scale: 3,
        alpha: 0,
        duration: 320,
        onComplete: () => burst.destroy(),
      });
    }
    if (this.score.combo >= 2) {
      this.tweens.killTweensOf(this.comboText);
      this.comboText.setScale(1.2);
      this.tweens.add({ targets: this.comboText, scale: 1, duration: 160 });
    }
  }

  private pauseGame(): void {
    if (this.paused || this.ending) return;
    this.paused = true;
    audio.suspend();
    const dim = this.add.rectangle(270, 480, 540, 960, 0x1b2430, 0.46).setDepth(50);
    const card = this.add.graphics().setDepth(51);
    card.fillStyle(0xfff7f6, 0.98);
    card.fillRoundedRect(70, 310, 400, 320, 24);
    card.lineStyle(4, 0xf3b7c6, 1);
    card.strokeRoundedRect(70, 310, 400, 320, 24);
    const title = this.add
      .text(270, 370, "已暂停", { fontFamily: FONT, fontSize: "40px", color: "#e25b6a" })
      .setOrigin(0.5)
      .setDepth(52);
    const tip = this.add
      .text(270, 424, "继续跳舞，或按当前分数结算", {
        fontFamily: FONT,
        fontSize: "18px",
        color: "#7a3040",
      })
      .setOrigin(0.5)
      .setDepth(52);
    this.pauseNodes.push(dim, card, title, tip);
    this.addPauseChoice(270, 490, "继续", () => this.resumeGame());
    this.addPauseChoice(270, 566, "直接结算", () => this.settleNow());
  }

  private addPauseChoice(x: number, y: number, label: string, onClick: () => void): void {
    const width = 220;
    const height = 56;
    const g = this.add.graphics().setDepth(52);
    g.fillStyle(0xe25b6a, 1);
    g.fillRoundedRect(x - width / 2, y - height / 2, width, height, 28);
    const text = this.add
      .text(x, y, label, { fontFamily: FONT, fontSize: "26px", color: "#fffaf6" })
      .setOrigin(0.5)
      .setDepth(53);
    text.setInteractive(
      new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
      Phaser.Geom.Rectangle.Contains,
    );
    text.input!.cursor = "pointer";
    text.on("pointerdown", () => onClick());
    this.pauseNodes.push(g, text);
  }

  private resumeGame(): void {
    if (!this.paused || this.ending) return;
    for (const node of this.pauseNodes) node.destroy();
    this.pauseNodes = [];
    this.time.delayedCall(0, () => {
      if (this.ending) return;
      this.paused = false;
      audio.resume();
    });
  }

  private settleNow(): void {
    if (this.ending) return;
    this.ending = true;
    this.paused = true;
    this.scene.start("result", { score: this.score });
  }

  private maybeEnd(now: number): void {
    if (this.ending) return;
    const settled = this.queue.length === 0 && this.active.every((note) => note.settled);
    const timedOut = now > SONG_MS + 1800;
    if (!settled && !timedOut) return;
    if (timedOut) for (const note of this.active) note.forceMiss();
    this.ending = true;
    this.time.delayedCall(760, () => {
      this.scene.start("result", { score: this.score });
    });
  }
}
