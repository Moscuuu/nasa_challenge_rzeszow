/// <reference types="vitest" />
import { cpSync, createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const TYPES: Record<string, string> = {
  ".json": "application/json",
  ".geojson": "application/geo+json",
  ".png": "image/png",
};

/** Serves <repo>/out at /data/ in dev and copies it to dist/data on build. */
function repoData(): Plugin {
  const outDir = resolve(__dirname, "..", "out");
  let distDir = resolve(__dirname, "dist");
  return {
    name: "repo-data",
    configResolved(config) {
      distDir = resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use("/data", (req, res, next) => {
        const rel = normalize(decodeURIComponent((req.url ?? "/").split("?")[0])).replace(new RegExp("^[\\/]+"), "");
        const file = join(outDir, rel);
        if (!file.startsWith(outDir) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader("Content-Type", TYPES[extname(file)] ?? "application/octet-stream");
        createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      if (existsSync(outDir)) cpSync(outDir, join(distDir, "data"), { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), repoData()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
