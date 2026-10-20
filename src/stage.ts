import Phaser from "phaser";

export const W = 540;
export const H = 960;
export const FONT = 'KaiTi, STKaiti, "Microsoft YaHei", serif';

export function paintStage(scene: Phaser.Scene): void {
    if (!scene.textures.exists("garden-bg-2")) {
    const texture = scene.textures.createCanvas("garden-bg-2", W, H);
    const ctx = texture?.getContext();
    if (texture && ctx) {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#6eaddf");
      sky.addColorStop(0.38, "#d7f1fb");
      sky.addColorStop(0.68, "#f8e4ec");
      sky.addColorStop(1, "#e8c3ae");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = "rgba(255,252,240,0.92)";
      ctx.beginPath();
      ctx.arc(300, 168, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      for (const [x, y, rx, ry] of [
        [120, 96, 78, 22],
        [230, 78, 96, 26],
        [340, 130, 70, 18],
      ] as const) {
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = "rgba(86, 138, 116, 0.8)";
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      const branches: Array<[number, number, number, number, number, number]> = [
        [8, 0, 70, 90, 18, 210],
        [0, 0, 110, 70, 46, 250],
        [18, 0, 40, 140, -6, 280],
        [532, 0, 470, 80, 520, 220],
        [540, 0, 430, 120, 500, 270],
        [520, 0, 490, 40, 548, 180],
      ];
      for (const [x0, y0, cx, cy, x1, y1] of branches) {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(cx, cy, x1, y1);
        ctx.stroke();
        ctx.fillStyle = "rgba(244, 168, 186, 0.85)";
        ctx.beginPath();
        ctx.arc(x1, y1, 7, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "rgba(126, 86, 112, 0.28)";
      ctx.beginPath();
      ctx.moveTo(150, 292);
      ctx.lineTo(270, 236);
      ctx.lineTo(390, 292);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(168, 292, 204, 14);
      ctx.fillRect(186, 306, 12, 58);
      ctx.fillRect(342, 306, 12, 58);
      ctx.fillRect(258, 306, 12, 58);

      const floor = ctx.createRadialGradient(270, 700, 40, 270, 700, 280);
      floor.addColorStop(0, "rgba(255, 236, 228, 0.72)");
      floor.addColorStop(1, "rgba(255, 214, 214, 0)");
      ctx.fillStyle = floor;
      ctx.beginPath();
      ctx.ellipse(270, 700, 250, 150, 0, 0, Math.PI * 2);
      ctx.fill();
      texture.refresh();
    }
  }

  scene.add.image(W / 2, H / 2, "garden-bg-2").setDepth(0);

  for (let i = 0; i < 12; i += 1) {
    const petal = scene.add
      .ellipse(
        Phaser.Math.Between(24, 516),
        Phaser.Math.Between(-80, 880),
        9,
        14,
        i % 2 === 0 ? 0xf7b6c8 : 0xfff4f6,
        0.8,
      )
      .setDepth(2)
      .setAngle(Phaser.Math.Between(-40, 40));
    scene.tweens.add({
      targets: petal,
      y: 1020,
      angle: petal.angle + Phaser.Math.Between(80, 200),
      duration: Phaser.Math.Between(8000, 13000),
      repeat: -1,
      delay: Phaser.Math.Between(0, 5000),
    });
  }

  const frame = scene.add.graphics().setDepth(8);
  frame.lineStyle(5, 0xf3b7c6, 0.95);
  frame.strokeRoundedRect(12, 12, W - 24, H - 24, 26);
  frame.lineStyle(2, 0xfff6ea, 0.8);
  frame.strokeRoundedRect(20, 20, W - 40, H - 40, 22);
}

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  width = 240,
): Phaser.GameObjects.Zone {
  const height = 62;
  const g = scene.add.graphics().setDepth(20);
  g.fillStyle(0xe25b6a, 1);
  g.fillRoundedRect(x - width / 2, y - height / 2, width, height, 31);
  g.lineStyle(3, 0xfff1c9, 0.95);
  g.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 31);
  scene.add
    .text(x, y, label, {
      fontFamily: FONT,
      fontSize: "28px",
      color: "#fffaf6",
    })
    .setOrigin(0.5)
    .setDepth(21);
  const zone = scene.add.zone(x, y, width, height).setDepth(22).setInteractive({ useHandCursor: true });
  zone.on("pointerdown", onClick);
  return zone;
}
