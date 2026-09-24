/** "qeeh" → onsets in beats, and the cards the child sees. */
export function parseRhythm(p: string) {
  const cards: { kind: string; beats: number; at: number }[] = [];
  const onsets: number[] = [];
  let t = 0;
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === "e") {
      onsets.push(t, t + 0.5);
      cards.push({ kind: "e", beats: 1, at: t });
      t += 1;
      i++;
    } else {
      if (c !== "r") onsets.push(t);
      const beats = c === "h" ? 2 : 1;
      cards.push({ kind: c, beats, at: t });
      t += beats;
    }
  }
  return { cards, onsets, beats: t };
}
/** Did the taps land on the pattern? Each onset needs a tap nearby; one stray tap is forgiven. */
export function judgeTaps(onsets: number[], taps: number[], tol: number) {
  const left = [...taps];
  const hits = onsets.map((o) => {
    const i = left.findIndex((t) => Math.abs(t - o) <= tol);
    if (i < 0) return false;
    left.splice(i, 1);
    return true;
  });
  return { hits, ok: hits.every(Boolean) && left.length <= 1 };
}
