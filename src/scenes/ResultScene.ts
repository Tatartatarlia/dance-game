import Phaser from "phaser";
import { audio } from "../audio";
import { rememberBest } from "../best";
import {
  JUDGE_COLOR,
  JUDGE_LABEL,
  activityPoints,
  emptyScore,
  scoreTier,
  totalScore,
  type Judge,
  type ScoreState,
} from "../scoring";
import { FONT, makeButton, paintStage } from "../stage";

interface ResultInit {
  score?: ScoreState;
}

export class ResultScene extends Phaser.Scene {
  private score: ScoreState = emptyScore();
  private leaving = false;

  constructor() {
    super("result");
  }

  init(data: ResultInit): void {
    this.score = data.score ?? emptyScore();
    this.leaving = false;
  }

  create(): void {
    paintStage(this);
    this.cameras.main.fadeIn(200);
    const score = this.score;
    const total = totalScore(score);
    const activity = activityPoints(total);
    const tier = scoreTier(total);
    const record = rememberBest(total);

    const card = this.add.graphics().setDepth(4);
    card.fillStyle(0xfff7f6, 0.95);
    card.fillRoundedRect(36, 48, 468, 690, 28);
    card.lineStyle(4, 0xf3b7c6, 1);
    card.strokeRoundedRect(36, 48, 468, 690, 28);

    this.add
      .text(270, 86, "舞会结束", {
        fontFamily: FONT,
        fontSize: "34px",
        color: "#e25b6a",
      })
      .setOrigin(0.5)
      .setDepth(10);
    this.add
      .text(270, 136, tier.name, {
        fontFamily: FONT,
        fontSize: "48px",
        color: tier.color,
      })
      .setOrigin(0.5)
      .setDepth(10);

    const tiers = [
      scoreTier(400),
      scoreTier(200),
      scoreTier(0),
    ];
    tiers.forEach((item, index) => {
      const current = item.name === tier.name;
      this.add
        .text(120 + index * 150, 186, `${item.name}  ${item.range}`, {
          fontFamily: FONT,
          fontSize: current ? "18px" : "16px",
          color: current ? item.color : "#c4a8b0",
        })
        .setOrigin(0.5)
        .setDepth(10);
    });

    const judges: Judge[] = ["perfect", "good", "ok", "miss"];
    judges.forEach((judge, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = column === 0 ? 78 : 300;
      const y = 230 + row * 36;
      this.add
        .text(x, y, `${JUDGE_LABEL[judge]}    ${score.counts[judge]}`, {
          fontFamily: FONT,
          fontSize: "22px",
          color: JUDGE_COLOR[judge],
        })
        .setDepth(10);
    });

    const lines: Array<[string, string, string]> = [
      ["按键得分", String(score.noteScore), "#7a3040"],
      ["连击得分", String(score.comboScore), "#7a3040"],
      ["完美连击得分", String(score.perfectScore), "#7a3040"],
      ["最终得分", String(total), "#e25b6a"],
    ];
    lines.forEach((line, index) => {
      const y = 320 + index * 40;
      this.add.text(78, y, line[0], { fontFamily: FONT, fontSize: "22px", color: line[2] }).setDepth(10);
      this.add
        .text(462, y, line[1], { fontFamily: FONT, fontSize: "22px", color: line[2] })
        .setOrigin(1, 0)
        .setDepth(10);
    });

    this.add
      .text(270, 500, `活动积分  ${activity}`, {
        fontFamily: FONT,
        fontSize: "32px",
        color: "#c9841d",
      })
      .setOrigin(0.5)
      .setDepth(10);
    this.add
      .text(270, 542, "活动积分 = 最终得分 ÷ 2.5 + 80", {
        fontFamily: FONT,
        fontSize: "16px",
        color: "#9a5364",
      })
      .setOrigin(0.5)
      .setDepth(10);
    const bestLine =
      record.best === null
        ? "历史最高分  暂无"
        : record.isNew
          ? `历史最高分  ${record.best}    新纪录`
          : `历史最高分  ${record.best}`;
    this.add
      .text(270, 586, bestLine, {
        fontFamily: FONT,
        fontSize: "22px",
        color: record.isNew ? "#e4548a" : "#c9841d",
      })
      .setOrigin(0.5)
      .setDepth(10);
    this.add
      .text(270, 628, `最高连击 ${score.maxCombo}      最高完美连击 ${score.maxPerfectCombo}`, {
        fontFamily: FONT,
        fontSize: "18px",
        color: "#7a3040",
      })
      .setOrigin(0.5)
      .setDepth(10);
    this.add
      .text(270, 668, "最终得分 = 按键得分 + 连击得分 + 完美连击得分", {
        fontFamily: FONT,
        fontSize: "15px",
        color: "#b07d8b",
        align: "center",
        wordWrap: { width: 400, useAdvancedWrap: true },
      })
      .setOrigin(0.5)
      .setDepth(10);

    const go = (target: string) => {
      if (this.leaving) return;
      this.leaving = true;
      if (target === "play") {
        void audio.unlock().then(() => this.scene.start(target));
        return;
      }
      this.scene.start(target);
    };
    makeButton(this, 270, 820, "再来一局", () => go("play"));
    makeButton(this, 270, 900, "返回", () => go("menu"), 160);
  }
}
