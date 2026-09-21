import type { APIRoute } from "astro";
import { isAuthenticated, unauthorizedResponse } from "../../../../lib/vocab-auth";
import { createLibraryStore } from "../../../../lib/vocab/libraryStore";
import { resolveVocabDataDir } from "../../../../lib/vocab/dataDir";
export const prerender = false;
export const POST: APIRoute = async ({ request }) => { if (!isAuthenticated(request)) return unauthorizedResponse(); try { const body = await request.json(); const store = createLibraryStore(resolveVocabDataDir()); const result = await store.importReviewed(body.items, body.expectedRevision); return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } }); } catch (error) { return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "导入失败" }), { status: 400, headers: { "Content-Type": "application/json" } }); } };
