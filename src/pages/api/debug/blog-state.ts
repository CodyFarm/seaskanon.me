/**
 * GET /api/debug/blog-state
 *
 * Debug endpoint: shows what's on disk and in the content store.
 * Returns file listings from both locations so we can compare.
 */
export const prerender = false;

import fs from "node:fs";
import path from "node:path";
import { getBlogDir, listMarkdownFiles } from "../../../lib/blog-dir";
import { getPublishedWriting } from "../../../lib/writing";

export async function GET() {
  const blogDir = getBlogDir();
  const realPath = (() => {
    try { return fs.realpathSync(blogDir); } catch { return null; }
  })();
  const isSymlink = (() => {
    try { return fs.lstatSync(blogDir).isSymbolicLink(); } catch { return false; }
  })();

  // Files on disk
  const diskFiles = listMarkdownFiles().map((f) => path.relative(blogDir, f).replace(/\\/g, "/"));

  // Posts from getPublishedWriting (collection + filesystem merge)
  const posts = await getPublishedWriting();
  const postIds = posts.map((p) => p.id);

  // Try reading one specific file to verify content
  const sampleFile = diskFiles[0];
  let sampleContent = "";
  let sampleError = "";
  if (sampleFile) {
    try {
      sampleContent = fs.readFileSync(path.join(blogDir, sampleFile), "utf-8").slice(0, 500);
    } catch (e: any) {
      sampleError = e.message;
    }
  }

  return new Response(
    JSON.stringify(
      {
        blogDir,
        realPath,
        isSymlink,
        diskFileCount: diskFiles.length,
        diskFiles: diskFiles.slice(0, 20),
        postCount: postIds.length,
        postIds: postIds.slice(0, 20),
        sampleFile,
        sampleContent,
        sampleError,
      },
      null,
      2,
    ),
    { headers: { "Content-Type": "application/json" } },
  );
}
