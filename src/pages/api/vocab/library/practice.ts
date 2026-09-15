import type { APIRoute } from "astro";
import { isAuthenticated, unauthorizedResponse } from "../../../../lib/vocab-auth";
import { createLibraryStore } from "../../../../lib/vocab/libraryStore";
import path from "node:path";

export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
  if (!isAuthenticated(request)) return unauthorizedResponse();
  try {
    const body = await request.json();
    if (!Array.isArray(body.words) || body.words.length > 20 || body.words.some((word: unknown) => typeof word !== "string")) throw new Error("invalid words");
    const result = await createLibraryStore(process.env.VOCAB_DATA_DIR || path.resolve(".local/vocab")).markPracticed(body.words, new Date());
    return new Response(JSON.stringify({ ...result, saved: true }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch { return new Response(JSON.stringify({ error: "词汇练习时间保存失败，请稍后重试" }), { status: 503, headers: { "Content-Type": "application/json" } }); }
};
