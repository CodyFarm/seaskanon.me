import type { APIRoute } from "astro";
import { isAuthenticated, unauthorizedResponse } from "../../../../lib/vocab-auth";
import { createLibraryStore } from "../../../../lib/vocab/libraryStore";
import { selectWritingWords } from "../../../../lib/vocab/selectWritingWords";
import path from "node:path";
import { createLLMClient, getConfiguredLLM } from "../../../../lib/vocab/llmClient";

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
    const fallback = { topic, paragraphType: type, instruction: `Write one paragraph about ${topic}.`, structureHints: ["State a clear main idea", "Explain the relationship", "Add a specific example or result"] };
    let generated = fallback;
    try {
      const client = createLLMClient(getConfiguredLLM());
      const raw = await client.complete([{ role: "system", content: "You are an IELTS writing teacher. Return JSON only with topic, paragraphType, instruction, and structureHints. Create one short paragraph task, not a full essay. Do not provide a sample answer." }, { role: "user", content: JSON.stringify({ topic, paragraphType: type, targetWords: words.map(({ word, partOfSpeech, meaningZh }) => ({ word, partOfSpeech, meaningZh })) }) }]);
      const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""));
      if (typeof parsed.instruction === "string" && Array.isArray(parsed.structureHints)) generated = { topic: typeof parsed.topic === "string" ? parsed.topic : topic, paragraphType: type, instruction: parsed.instruction, structureHints: parsed.structureHints.slice(0, 3).map(String) };
    } catch { /* fallback remains usable when provider is unavailable */ }
    return new Response(JSON.stringify({ task: { taskId: crypto.randomUUID(), createdAt: new Date().toISOString(), ...generated, targetWords: words.map(({ word, partOfSpeech, meaningZh }) => ({ word, partOfSpeech, meaningZh })), wordLimit: { min: 80, max: 140 } } }));
  } catch (error) { return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unable to create task" }), { status: 400, headers: { "Content-Type": "application/json" } }); }
};
