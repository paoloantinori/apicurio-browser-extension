import { defineConfig } from "vite";
import webExtension from "vite-plugin-web-extension";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const target = process.env.TARGET || "chrome";

function mergeManifest(): string {
  const root = resolve(__dirname, "src");
  const base = JSON.parse(readFileSync(resolve(root, "manifest.base.json"), "utf-8"));
  const overrides = JSON.parse(
    readFileSync(resolve(root, `manifest.${target}.json`), "utf-8")
  );
  const merged = { ...base, ...overrides };
  const outPath = resolve(__dirname, "src", "manifest.json");
  writeFileSync(outPath, JSON.stringify(merged, null, 2));
  return outPath;
}

export default defineConfig({
  plugins: [
    webExtension({
      browser: target,
      manifest: mergeManifest(),
    }),
  ],
  build: {
    outDir: resolve(__dirname, "dist", target),
    emptyOutDir: true,
  },
});
