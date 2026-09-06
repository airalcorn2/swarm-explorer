import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative asset paths so the same build works when served from a domain root
// OR a sub-path (GitHub Pages project sites live at /<repo>/), and when opening
// dist/index.html directly.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: "dist",
    // three.js is inherently large; this is a client-side tool, not a
    // latency-sensitive site, so the single-bundle warning is just noise.
    chunkSizeWarningLimit: 3500,
  },
});
