import Phaser from "phaser";
import { assertScoring } from "./scoring";
import { MenuScene } from "./scenes/MenuScene";
import { PlayScene } from "./scenes/PlayScene";
import { ResultScene } from "./scenes/ResultScene";
import { H, W } from "./stage";

assertScoring();

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#6eaddf",
  banner: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: W,
    height: H,
  },
  input: { activePointers: 4 },
  scene: [MenuScene, PlayScene, ResultScene],
});
