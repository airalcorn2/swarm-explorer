// Copies the Earth textures bundled with `three-globe` into public/textures/ so
// the globe works fully offline. Run automatically after `npm install`.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "three-globe", "example", "img");
const dest = join(root, "public", "textures");

const FILES = [
  "earth-night.jpg",
  "earth-blue-marble.jpg",
  "earth-day.jpg",
  "earth-topology.png",
  "night-sky.png",
];

if (!existsSync(src)) {
  console.warn("[copy-textures] three-globe not installed yet, skipping");
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
for (const f of FILES) {
  copyFileSync(join(src, f), join(dest, f));
}
console.log(`[copy-textures] copied ${FILES.length} textures to public/textures/`);
