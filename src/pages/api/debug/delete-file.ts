/**
 * POST /api/debug/delete-file
 *
 * Debug: delete a file from the blog directory.
 * Body: { slug: "xxx" }
 */
export const prerender = false;

import fs from "node:fs";
import { isAuthenticated, unauthorizedResponse } from "../../../lib/vocab-auth";
import { resolveNotePath } from "../../../lib/blog-dir";

export async function POST({ request }: { request: Request }) {
  if (!isAuthenticated(request)) return unauthorizedResponse();

  try {
    const { slug } = await request.json();
    if (!slug) {
      return new Response(JSON.stringify({ error: "slug required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const filePath = resolveNotePath(slug);
    if (!fs.existsSync(filePath)) {
      return new Response(JSON.stringify({ error: `file not found: ${slug}` }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    fs.unlinkSync(filePath);
    console.log(`[debug] deleted: ${filePath}`);

    return new Response(JSON.stringify({ ok: true, deleted: slug }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
