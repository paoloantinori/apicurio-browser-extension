import { defineConfig, Plugin } from "vite";
import webExtension from "vite-plugin-web-extension";
import { readFileSync, writeFileSync, cpSync, existsSync } from "fs";
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

function copyEditorAssets(): Plugin {
  return {
    name: "copy-editor-assets",
    writeBundle() {
      const editorDist = resolve(__dirname, "editor", "dist");
      if (!existsSync(editorDist)) {
        console.warn("editor/dist not found — run `npm run build:editor` first");
        return;
      }
      const outDir = resolve(__dirname, "dist", target, "viewer");
      cpSync(editorDist, outDir, { recursive: true });

      // Remove external CDN references from the viewer HTML
      const indexPath = resolve(outDir, "index.html");
      if (existsSync(indexPath)) {
        let html = readFileSync(indexPath, "utf-8");
        html = html.replace(/<link[^>]*unpkg\.com[^>]*>\n?/g, "");
        writeFileSync(indexPath, html);
      }

      // Copy icons directory
      const iconsSrc = resolve(__dirname, "src", "icons");
      if (existsSync(iconsSrc)) {
        const iconsDest = resolve(__dirname, "dist", target, "icons");
        cpSync(iconsSrc, iconsDest, { recursive: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [
    webExtension({
      browser: target,
      manifest: mergeManifest(),
    }),
    copyEditorAssets(),
  ],
  build: {
    outDir: resolve(__dirname, "dist", target),
    emptyOutDir: true,
  },
});
