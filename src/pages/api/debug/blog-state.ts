/**
 * GET /api/debug/blog-state
 *
 * Debug endpoint: shows what's on disk vs what getPublishedWriting() returns.
 * Useful for diagnosing "new note doesn't appear" issues.
 */
export const prerender = false;

import fs from "node:fs";
import path from "node:path";
import { getBlogDir, listMarkdownFiles } from "../../../lib/blog-dir";
import { getPublishedWriting } from "../../../lib/writing";

export async function GET() {
  const blogDir = getBlogDir();
  const realPath = (() => { try { return fs.realpathSync(blogDir); } catch { return null; }; })();
  const isSymlink = (() => { try { return fs.lstatSync(blogDir).isSymbolicLink(); } catch { return false; }; })();

  // All files on disk (no slice limit)
  const allDiskFiles = listMarkdownFiles().map((f) => path.relative(blogDir, f).replace(/\\/g, "/")).sort();

  // Posts from getPublishedWriting
  const posts = await getPublishedWriting();
  const postIds = posts.map((p) => p.id);

  // Files on disk NOT in the post list (should be empty if everything works)
  const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, "-");
  const postIdSet = new Set(postIds.map(slugify));
  const missing = allDiskFiles.filter((f) => {
    const rawId = f.replace(/\.md$/, "");
    return !postIdSet.has(slugify(rawId));
  });

  // Check volume contents directly too
  let volumeFiles: string[] = [];
  const volumeDir = "/data/blog";
  try {
    if (fs.existsSync(volumeDir)) {
      volumeFiles = listFilesFlat(volumeDir).sort();
    }
  } catch {}

  return new Response(JSON.stringify({
    blogDir,
    realPath,
    isSymlink,
    diskFileCount: allDiskFiles.length,
    diskFiles: allDiskFiles,                          // ALL files, unsliced
    postCount: postIds.length,
    postIds,
    diskNotInPosts: missing,                           // files on disk but missing from posts
    volumeFileCount: volumeFiles.length,
    volumeFiles: volumeFiles.slice(0, 30),
  }, null, 2), { headers: { "Content-Type": "application/json" } });
}

function listFilesFlat(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesFlat(full));
    } else {
      results.push(path.relative(dir, full).replace(/\\/g, "/"));
    }
  }
  return results;
}
