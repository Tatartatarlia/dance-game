const KEY = "dance-game-best-score";

export function readBest(): number | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return null;
    const score = Number(raw);
    return Number.isFinite(score) ? score : null;
  } catch {
    return null;
  }
}

export function rememberBest(total: number): { best: number | null; isNew: boolean } {
  const previous = readBest();
  const isNew = previous === null ? total > 0 : total > previous;
  if (!isNew) return { best: previous, isNew: false };
  try {
    localStorage.setItem(KEY, String(total));
  } catch {
    return { best: previous ?? total, isNew: false };
  }
  return { best: total, isNew: true };
}
