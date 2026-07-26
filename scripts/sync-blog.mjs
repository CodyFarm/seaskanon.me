/**
 * Startup script: sync blog content to the persistent volume and set up
 * a symlink so Astro's content collection reads from the volume too.
 *
 * Runs before the standalone server starts. If a Railway volume is mounted
 * at /data:
 *   1. Copy new repo files from dist/ into /data/blog WITHOUT overwriting
 *      existing files — user-created and enriched notes survive redeploys.
 *   2. Replace src/content/blog with a symlink to /data/blog so Astro's
 *      getCollection("blog") reads from the persistent volume at runtime.
 *
 * If /data is not mounted (local dev / no volume), this is a no-op.
 */
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("dist/content/blog");
const VOLUME = "/data";
const DST = path.join(VOLUME, "blog");
const BLOG_DIR = path.resolve("src/content/blog");

if (!fs.existsSync(VOLUME)) {
  console.log("[sync-blog] /data not mounted — skipping sync (volume-less mode)");
  process.exit(0);
}

if (!fs.existsSync(SRC)) {
  console.warn("[sync-blog] dist/content/blog not found — skipping sync");
  process.exit(0);
}

// ── Step 1: ensure volume blog directory exists ──
fs.mkdirSync(DST, { recursive: true });

// ── Step 2: copy new repo files to volume (don't overwrite existing) ──
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

// ── Step 3: symlink src/content/blog → /data/blog ──
// After the symlink is in place, Astro's getCollection("blog") and the
// Vocab Studio API both read/write through src/content/blog → /data/blog.

try {
  const stat = fs.lstatSync(BLOG_DIR);
  if (stat.isSymbolicLink()) {
    const target = fs.readlinkSync(BLOG_DIR);
    console.log(`[sync-blog] src/content/blog already symlinked → ${target}`);
  } else if (stat.isDirectory()) {
    // Merge any remaining files from src/content/blog into the volume
    // (these might be files added between build and deploy)
    walk(BLOG_DIR, DST);
    console.log(`[sync-blog] merged src/content/blog → ${DST}`);

    // Rename the original directory as backup, then create the symlink
    const bak = path.resolve(`src/content/blog.bak`);
    fs.renameSync(BLOG_DIR, bak);
    fs.symlinkSync(DST, BLOG_DIR, "dir");
    console.log(`[sync-blog] symlinked src/content/blog → ${DST} (backup at src/content/blog.bak)`);
  }
} catch (err) {
  // src/content/blog doesn't exist — create the symlink directly
  if (err.code === "ENOENT") {
    fs.symlinkSync(DST, BLOG_DIR, "dir");
    console.log(`[sync-blog] created symlink src/content/blog → ${DST}`);
  } else {
    console.error("[sync-blog] symlink error:", err.message);
  }
}
