import type { APIRoute } from "astro";
import { isAuthenticated, unauthorizedResponse } from "../../../../lib/vocab-auth";
import { createLibraryStore } from "../../../../lib/vocab/libraryStore";
import { selectWritingWords } from "../../../../lib/vocab/selectWritingWords";
import path from "node:path";

export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
  if (!isAuthenticated(request)) return unauthorizedResponse();
  try {
    const body = await request.json();
    const store = createLibraryStore(process.env.VOCAB_DATA_DIR || path.resolve(".local/vocab"));
    const { entries } = await store.read();
    const count = Math.max(3, Math.min(6, Number(body.targetCount) || 5));
    const words = selectWritingWords(entries, { targetCount: count, mix: body.mix === "new" ? "new" : body.mix === "review" ? "review" : "balanced", now: new Date(), selectedWords: Array.isArray(body.selectedWords) ? body.selectedWords : undefined });
    const type = ["opinion", "reason", "example", "concession"].includes(body.paragraphType) ? body.paragraphType : "opinion";
    const topic = typeof body.topic === "string" && body.topic.trim() ? body.topic.trim() : "the role of education in modern society";
    const instructions: Record<string, string> = { opinion: `Write one paragraph stating your position on ${topic}.`, reason: `Write one paragraph explaining one important reason related to ${topic}.`, example: `Write one paragraph using a concrete example to discuss ${topic}.`, concession: `Write one paragraph that acknowledges a limitation before defending your view on ${topic}.` };
    return new Response(JSON.stringify({ task: { taskId: crypto.randomUUID(), createdAt: new Date().toISOString(), topic, paragraphType: type, instruction: instructions[type], structureHints: ["State a clear main idea", "Explain the relationship", "Add a specific example or result"], targetWords: words.map(({ word, partOfSpeech, meaningZh }) => ({ word, partOfSpeech, meaningZh })), wordLimit: { min: 80, max: 140 } } }));
  } catch (error) { return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unable to create task" }), { status: 400, headers: { "Content-Type": "application/json" } }); }
};
