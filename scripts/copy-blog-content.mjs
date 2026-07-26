/**
 * Post-build script: copy blog content into dist/ so the standalone
 * server can read raw .md files at runtime (vocab studio API routes).
 */
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("src/content/blog");
const DST = path.resolve("dist/content/blog");

if (!fs.existsSync(SRC)) {
  console.warn("[postbuild] src/content/blog not found — skipping copy");
  process.exit(0);
}

fs.cpSync(SRC, DST, { recursive: true });
console.log(`[postbuild] copied blog content → ${DST}`);
