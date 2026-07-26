/**
 * Startup script: sync blog content from dist/ to the persistent volume.
 *
 * Runs before the standalone server starts. If a Railway volume is mounted
 * at /data, this copies new files from the repo into /data/blog WITHOUT
 * overwriting existing files — so user-created and enriched notes survive
 * redeployments.
 *
 * If /data is not mounted (local dev / no volume), this is a no-op.
 */
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("dist/content/blog");
const VOLUME = "/data";
const DST = path.join(VOLUME, "blog");

if (!fs.existsSync(VOLUME)) {
  console.log("[sync-blog] /data not mounted — skipping sync (volume-less mode)");
  process.exit(0);
}

if (!fs.existsSync(SRC)) {
  console.warn("[sync-blog] dist/content/blog not found — skipping sync");
  process.exit(0);
}

// Ensure volume blog directory exists
fs.mkdirSync(DST, { recursive: true });

// Recursively walk src, copying files that don't already exist in dst
let copied = 0;
let skipped = 0;

function walk(srcDir, dstDir) {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const dstPath = path.join(dstDir, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(dstPath, { recursive: true });
      walk(srcPath, dstPath);
    } else {
      if (fs.existsSync(dstPath)) {
        skipped++;
      } else {
        fs.copyFileSync(srcPath, dstPath);
        copied++;
      }
    }
  }
}

walk(SRC, DST);
console.log(`[sync-blog] ${copied} new files copied, ${skipped} existing files preserved → ${DST}`);
