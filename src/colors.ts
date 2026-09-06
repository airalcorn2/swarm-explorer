// Stable color per category name. Categories not seen at build time still get a
// deterministic color by hashing the string into the palette.
const PALETTE = [
  "#ff6b6b",
  "#ffd93d",
  "#6bcB77",
  "#4d96ff",
  "#c56cf0",
  "#ff9f45",
  "#38d9a9",
  "#f783ac",
  "#74c0fc",
  "#b197fc",
  "#ffa8a8",
  "#a9e34b",
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function categoryColor(category: string | null): string {
  if (!category) return "#9aa0a6";
  return PALETTE[hash(category) % PALETTE.length];
}
