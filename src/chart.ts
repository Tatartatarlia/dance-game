export const BEAT = 600;
export const SONG_MS = 60_000;
export const TAP_APPROACH = 1100;
export const HOLD_APPROACH = 1000;
export const HOLD_TRAVEL = 300;

export const PAD_XS = [90, 270, 450] as const;
export const PAD_Y = 648;
export const BUTTON_R = 36;
/** 收缩光圈的起始倍率。1 表示缩到最内圈。 */
export const RING_START = 2.12;
export const INNER_R = 46;
export const MID_R = 64;
export const OUTER_R = 80;

export type NoteKind = "tap" | "hold" | "slide";

export interface NoteData {
  id: number;
  kind: NoteKind;
  time: number;
  pad: number;
  duration?: number;
  toPad?: number;
}

export function padPos(pad: number): { x: number; y: number } {
  return { x: PAD_XS[pad] ?? 270, y: PAD_Y };
}

/** 完美落在最外圈，比内圈时刻早多少毫秒。 */
export function ringPerfectLead(): number {
  const perfectScale = OUTER_R / INNER_R;
  const progress = (RING_START - perfectScale) / (RING_START - 1);
  return Math.round(TAP_APPROACH * (1 - progress));
}

export function hintFor(kind: NoteKind | undefined): { text: string; color: string } {
  if (kind === "tap") return { text: "红键：从外到内是完美、不错、一般，缩到外圈时点击", color: "#d45366" };
  if (kind === "hold") return { text: "蓝键：光柱落到键上时按下，末端光点到达时松开", color: "#2b93cf" };
  if (kind === "slide") return { text: "橙键：缩到最外圈时按下，再沿箭头滑到下一键", color: "#e07d22" };
  return { text: "跟着节拍，看光圈和光柱", color: "#7a3040" };
}

type Step =
  | { kind: "tap"; pad: number }
  | { kind: "slide"; pad: number; to: number }
  | { kind: "hold"; pad: number; holdBeats?: number };

const STEPS: Step[] = [
  { kind: "tap", pad: 0 },
  { kind: "tap", pad: 1 },
  { kind: "tap", pad: 2 },
  { kind: "tap", pad: 1 },
  { kind: "tap", pad: 0 },
  { kind: "tap", pad: 2 },
  { kind: "tap", pad: 1 },
  { kind: "tap", pad: 0 },

  { kind: "slide", pad: 0, to: 1 },
  { kind: "slide", pad: 1, to: 2 },
  { kind: "slide", pad: 2, to: 1 },
  { kind: "slide", pad: 1, to: 0 },
  { kind: "slide", pad: 0, to: 2 },
  { kind: "slide", pad: 2, to: 0 },

  { kind: "hold", pad: 0, holdBeats: 2 },
  { kind: "tap", pad: 2 },
  { kind: "hold", pad: 1, holdBeats: 2 },
  { kind: "tap", pad: 0 },
  { kind: "hold", pad: 2, holdBeats: 2 },

  { kind: "tap", pad: 0 },
  { kind: "tap", pad: 1 },
  { kind: "slide", pad: 1, to: 2 },
  { kind: "tap", pad: 0 },
  { kind: "hold", pad: 1, holdBeats: 2 },
  { kind: "slide", pad: 2, to: 1 },
  { kind: "tap", pad: 0 },
  { kind: "tap", pad: 2 },
  { kind: "tap", pad: 1 },
  { kind: "slide", pad: 1, to: 0 },
  { kind: "tap", pad: 2 },
  { kind: "hold", pad: 0, holdBeats: 2 },
  { kind: "tap", pad: 1 },
  { kind: "tap", pad: 2 },
  { kind: "tap", pad: 1 },
  { kind: "tap", pad: 0 },
  { kind: "slide", pad: 0, to: 1 },
  { kind: "tap", pad: 2 },
];

function endTime(note: NoteData): number {
  if (note.kind === "hold") return note.time + (note.duration ?? 0) + 280;
  if (note.kind === "slide") return note.time + 860;
  return note.time + 280;
}

export function buildChart(): NoteData[] {
  const notes: NoteData[] = [];
  let beat = 5;

  for (const step of STEPS) {
    const note: NoteData = {
      id: notes.length,
      kind: step.kind,
      time: beat * BEAT,
      pad: step.pad,
    };
    if (step.kind === "slide") note.toPad = step.to;
    if (step.kind === "hold") note.duration = (step.holdBeats ?? 2) * BEAT;
    if (endTime(note) > SONG_MS + 500) break;
    if (step.kind === "slide" && step.to === step.pad) throw new Error("滑动终点不能是同一个键");
    if (note.pad < 0 || note.pad > 2) throw new Error("键位超出范围");
    notes.push(note);
    if (step.kind === "hold") beat += (step.holdBeats ?? 2) + 3;
    else if (step.kind === "slide") beat += 3;
    else beat += 2;
  }

  if (notes.length < 12) throw new Error("谱面过短");
  return notes;
}
