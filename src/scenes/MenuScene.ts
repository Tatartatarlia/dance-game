import Phaser from "phaser";
import { audio } from "../audio";
import { readBest } from "../best";
import { FONT, makeButton, paintStage } from "../stage";

export class MenuScene extends Phaser.Scene {
  private starting = false;

  constructor() {
    super("menu");
  }

  create(): void {
    paintStage(this);
    this.cameras.main.fadeIn(220);
    this.input.mouse?.disableContextMenu();

    const card = this.add.graphics().setDepth(4);
    card.fillStyle(0xfff7f6, 0.94);
    card.fillRoundedRect(36, 168, 468, 560, 28);
    card.lineStyle(4, 0xf3b7c6, 1);
    card.strokeRoundedRect(36, 168, 468, 560, 28);

    this.add
      .text(270, 92, "宫廷舞会", {
        fontFamily: FONT,
        fontSize: "64px",
        color: "#e25b6a",
        stroke: "#fffaf6",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(10);
    this.add
      .text(270, 142, "试玩一局  ·  60 秒", {
        fontFamily: FONT,
        fontSize: "22px",
        color: "#9a5364",
      })
      .setOrigin(0.5)
      .setDepth(10);

    const rules: Array<[string, string, string]> = [
      ["红键 · 点击", "圆圈从外到内是完美、不错、一般。光圈缩到最外圈时点击。", "#d45366"],
      ["蓝键 · 长按", "光柱落到键上时按下，末端光点到达时松开。两次合在一起算。", "#2b93cf"],
      ["橙键 · 滑动", "缩到最外圈时按下，再顺着箭头滑到下一个键。", "#e07d22"],
    ];
    rules.forEach((rule, index) => {
      const y = 230 + index * 118;
      this.add
        .text(68, y, rule[0], { fontFamily: FONT, fontSize: "26px", color: rule[2] })
        .setDepth(10);
      this.add
        .text(68, y + 40, rule[1], {
          fontFamily: FONT,
          fontSize: "18px",
          color: "#7a3040",
          wordWrap: { width: 390, useAdvancedWrap: true },
          lineSpacing: 6,
        })
        .setDepth(10);
    });

    const best = readBest();
    this.add
      .text(270, 600, "完美 +11    不错 +10    一般 +8    错过 +0\n连击、完美连击另有额外加分", {
        fontFamily: FONT,
        fontSize: "18px",
        color: "#9a5364",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(10);
    this.add
      .text(270, 668, best === null ? "历史最高分  暂无" : `历史最高分  ${best}`, {
        fontFamily: FONT,
        fontSize: "22px",
        color: "#c9841d",
      })
      .setOrigin(0.5)
      .setDepth(10);

    makeButton(this, 270, 800, "开始试玩", () => {
      if (this.starting) return;
      this.starting = true;
      void audio.unlock().then(() => this.scene.start("play"));
    });

    this.add
      .text(270, 868, "电脑键位   左 A    中 S    右 D", {
        fontFamily: FONT,
        fontSize: "16px",
        color: "#7a3040",
      })
      .setOrigin(0.5)
      .setDepth(10);
  }
}
