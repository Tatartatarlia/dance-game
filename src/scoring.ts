export type Judge = "perfect" | "good" | "ok" | "miss";

export const JUDGE_POINTS: Record<Judge, number> = {
  perfect: 11,
  good: 10,
  ok: 8,
  miss: 0,
};

export const JUDGE_LABEL: Record<Judge, string> = {
  perfect: "完美",
  good: "不错",
  ok: "一般",
  miss: "错过",
};

export const JUDGE_COLOR: Record<Judge, string> = {
  perfect: "#e4548a",
  good: "#3aa0d8",
  ok: "#3f9d62",
  miss: "#9a939c",
};

/** 连击达到这一次时，这一下额外加的分。1–3 不加。 */
export function comboBonus(combo: number): number {
  if (combo <= 3) return 0;
  if (combo <= 6) return 1;
  if (combo <= 10) return 2;
  return 3;
}

/** 完美连击达到这一次时，这一下额外加的分。第 1 次不加。 */
export function perfectComboBonus(streak: number): number {
  if (streak <= 1) return 0;
  if (streak <= 6) return 1;
  if (streak <= 12) return 2;
  return 3;
}

const RANK: Record<Judge, number> = { perfect: 3, good: 2, ok: 1, miss: 0 };

/** 长按、滑动的两次判定按档位相加，再合成一次评价。 */
export function combineJudges(a: Judge, b: Judge): Judge {
  const sum = RANK[a] + RANK[b];
  if (sum >= 6) return "perfect";
  if (sum >= 4) return "good";
  if (sum >= 2) return "ok";
  return "miss";
}

export interface ScoreState {
  noteScore: number;
  comboScore: number;
  perfectScore: number;
  combo: number;
  perfectCombo: number;
  maxCombo: number;
  maxPerfectCombo: number;
  counts: Record<Judge, number>;
}

export function emptyScore(): ScoreState {
  return {
    noteScore: 0,
    comboScore: 0,
    perfectScore: 0,
    combo: 0,
    perfectCombo: 0,
    maxCombo: 0,
    maxPerfectCombo: 0,
    counts: { perfect: 0, good: 0, ok: 0, miss: 0 },
  };
}

export function totalScore(state: ScoreState): number {
  return state.noteScore + state.comboScore + state.perfectScore;
}

/** 活动积分 = 最终得分 ÷ 2.5 + 80 */
export function activityPoints(total: number): number {
  return Math.round(total / 2.5 + 80);
}

export interface ScoreTier {
  name: "一档" | "二档" | "三档";
  color: string;
  range: string;
}

/** 最终得分分三档：400 及以上、200–399、200 以下。 */
export function scoreTier(total: number): ScoreTier {
  if (total >= 400) return { name: "一档", color: "#e4548a", range: "≥ 400" };
  if (total >= 200) return { name: "二档", color: "#3aa0d8", range: "200–399" };
  return { name: "三档", color: "#3f9d62", range: "< 200" };
}

export interface Windows {
  perfect: number;
  good: number;
  ok: number;
}

/**
 * deltaMs = 实际时刻 − 应判定时刻。
 * 按下过早时返回 null，表示这次点击不算、可以再点。
 * 松开过早时直接记为错过。
 */
export function judgeTimed(deltaMs: number, windows: Windows, earlyIsMiss: boolean): Judge | null {
  if (deltaMs < -windows.ok) return earlyIsMiss ? "miss" : null;
  const abs = Math.abs(deltaMs);
  if (abs <= windows.perfect) return "perfect";
  if (abs <= windows.good) return "good";
  if (abs <= windows.ok) return "ok";
  return "miss";
}

/** 返回这一下实际加进总分的分数（含连击与完美连击）。 */
export function applyJudge(state: ScoreState, judge: Judge): number {
  const before = totalScore(state);
  state.counts[judge] += 1;
  state.noteScore += JUDGE_POINTS[judge];
  if (judge === "miss") {
    state.combo = 0;
    state.perfectCombo = 0;
    return totalScore(state) - before;
  }
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.comboScore += comboBonus(state.combo);
  if (judge === "perfect") {
    state.perfectCombo += 1;
    state.maxPerfectCombo = Math.max(state.maxPerfectCombo, state.perfectCombo);
    state.perfectScore += perfectComboBonus(state.perfectCombo);
  } else {
    state.perfectCombo = 0;
  }
  return totalScore(state) - before;
}

export function assertScoring(): void {
  const perfects = emptyScore();
  for (let i = 0; i < 7; i += 1) applyJudge(perfects, "perfect");
  if (perfects.noteScore !== 77) throw new Error("按键分");
  if (perfects.perfectScore !== 7) throw new Error("完美连击分");
  if (perfects.comboScore !== 5) throw new Error("连击分");
  if (perfects.maxCombo !== 7 || perfects.maxPerfectCombo !== 7) throw new Error("最高连击");

  const broken = emptyScore();
  applyJudge(broken, "perfect");
  applyJudge(broken, "perfect");
  applyJudge(broken, "miss");
  applyJudge(broken, "perfect");
  if (broken.combo !== 1 || broken.perfectCombo !== 1) throw new Error("错过应中断连击");
  if (broken.perfectScore !== 1 || broken.noteScore !== 33) throw new Error("中断后的分数");

  const mixed = emptyScore();
  applyJudge(mixed, "perfect");
  applyJudge(mixed, "good");
  if (mixed.perfectCombo !== 0 || mixed.combo !== 2) throw new Error("非完美应中断完美连击");

  if (combineJudges("perfect", "perfect") !== "perfect") throw new Error("合成完美");
  if (combineJudges("perfect", "good") !== "good") throw new Error("合成不错");
  if (combineJudges("perfect", "miss") !== "ok") throw new Error("合成一般");
  if (combineJudges("ok", "miss") !== "miss") throw new Error("合成错过");
  if (activityPoints(0) !== 80) throw new Error("活动积分底分");
  if (activityPoints(250) !== 180) throw new Error("活动积分");
  if (judgeTimed(-400, { perfect: 90, good: 150, ok: 230 }, false) !== null) throw new Error("过早点按应忽略");
  if (judgeTimed(-400, { perfect: 90, good: 150, ok: 230 }, true) !== "miss") throw new Error("过早松开应错过");
  if (judgeTimed(0, { perfect: 90, good: 150, ok: 230 }, false) !== "perfect") throw new Error("准时应为完美");
  if (scoreTier(400).name !== "一档" || scoreTier(399).name !== "二档") throw new Error("档位");
  if (scoreTier(200).name !== "二档" || scoreTier(199).name !== "三档" || scoreTier(0).name !== "三档") {
    throw new Error("档位边界");
  }
}
