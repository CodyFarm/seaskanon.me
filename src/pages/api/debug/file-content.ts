/**
 * GET /api/debug/file-content?slug=xxx
 *
 * Debug: read a single markdown file's raw content from the blog directory.
 */
export const prerender = false;

import fs from "node:fs";
import { resolveNotePath } from "../../../lib/blog-dir";

export async function GET({ url }: { url: URL }) {
  const slug = url.searchParams.get("slug") || "";
  if (!slug) {
    return new Response(JSON.stringify({ error: "?slug= required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const filePath = resolveNotePath(slug);
    const exists = fs.existsSync(filePath);
    if (!exists) {
      return new Response(JSON.stringify({ slug, exists: false }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    const stat = fs.statSync(filePath);

    return new Response(
      JSON.stringify({
        slug,
        filePath,
        exists: true,
        sizeBytes: stat.size,
        content: raw,
      }, null, 2),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
