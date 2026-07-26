/**
 * Resolve the blog content directory at runtime.
 *
 * In development (`astro dev`), content lives at `src/content/blog`.
 * In production (standalone server), the postbuild step copies it to
 * `dist/content/blog`, so we prefer that location if it exists.
 */
import fs from "node:fs";
import path from "node:path";

const CANDIDATES = [
  path.resolve("src/content/blog"),   // primary (symlink to /data/blog in production)
  path.resolve("/data/blog"),          // Railway persistent volume (fallback)
  path.resolve("dist/content/blog"),  // production (postbuild copy)
];

let _blogDir: string | null = null;

export function getBlogDir(): string {
  if (_blogDir) return _blogDir;

  for (const dir of CANDIDATES) {
    if (fs.existsSync(dir)) {
      _blogDir = dir;
      return dir;
    }
  }

  // Last resort: default to src/ and let the caller handle missing files
  _blogDir = CANDIDATES[0];
  return _blogDir!;
}

/** Resolve a slug to an absolute .md file path. */
export function resolveNotePath(slug: string): string {
  const sanitized = slug.replace(/\.\./g, "").replace(/\\/g, "/");
  const full = path.resolve(getBlogDir(), `${sanitized}.md`);

  // Safety: verify we're still inside the blog dir
  const normalized = path.resolve(full);
  if (!normalized.startsWith(getBlogDir())) {
    throw new Error("Invalid slug: directory traversal detected");
  }
  return normalized;
}

/** List all .md files recursively under the blog directory. */
export function listMarkdownFiles(): string[] {
  const dir = getBlogDir();
  const results: string[] = [];
  _walk(dir, results);
  return results;

  function _walk(d: string, out: string[]) {
    if (!fs.existsSync(d)) return;
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        _walk(full, out);
      } else if (entry.name.endsWith(".md")) {
        out.push(full);
      }
    }
  }
}
