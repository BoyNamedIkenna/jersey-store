export const COLOR_FAMILIES = ["red", "orange", "yellow", "green", "blue", "purple", "pink", "black", "white", "grey"] as const;
export type ColorFamily = (typeof COLOR_FAMILIES)[number];

// Maps a hex colour to a coarse family a shopper would use. It is a heuristic: print the results
// (see the backfill script) and tune the thresholds if a jersey lands in the wrong family.
export function colorFamily(hex: string): ColorFamily {
  const digits = /^#?([0-9a-f]{6})$/i.exec(hex.trim())?.[1];
  if (!digits) throw new Error(`Invalid hex colour: ${hex}`);

  const n = parseInt(digits, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  // Greys, near-blacks and near-whites have no meaningful hue.
  if (s < 0.15 || l < 0.1 || l > 0.92) {
    if (l < 0.25) return "black";
    if (l > 0.8) return "white";
    return "grey";
  }

  if (h < 12 || h >= 330) return l > 0.78 ? "pink" : "red"; // includes dark reds like maroon and claret
  if (h < 38) return "orange";
  if (h < 70) return "yellow"; // includes gold
  if (h < 165) return "green";
  if (h < 260) return "blue"; // includes navy and sky blue
  if (h < 315) return "purple";
  return "pink";
}