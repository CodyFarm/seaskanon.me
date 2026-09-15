import type { APIRoute } from "astro";
import { isAuthenticated, unauthorizedResponse } from "../../../../lib/vocab-auth";
import { createLLMClient, getConfiguredLLM } from "../../../../lib/vocab/llmClient";
import { createLibraryStore } from "../../../../lib/vocab/libraryStore";
import path from "node:path";
export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
  if (!isAuthenticated(request)) return unauthorizedResponse();
  try { const { task, text } = await request.json(); if (!task || typeof text !== "string" || !text.trim()) throw new Error("作文不能为空"); const client = createLLMClient(getConfiguredLLM()); const raw = await client.complete([{ role: "system", content: "You are an IELTS paragraph writing tutor. Return JSON only with overallComment, priorities, scores, targetWordUsage, sentenceFeedback, improvedParagraph, referenceParagraph, masterySuggestions. Score the paragraph as practice feedback, not an official IELTS score. Each target word must appear exactly once in targetWordUsage with status used_correctly, used_with_issue, or not_used and evidence copied from the submission." }, { role: "user", content: JSON.stringify({ task, submission: text }) }]); const feedback = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "")); const used = feedback.targetWordUsage.filter((u: any) => u.status !== "not_used").map((u: any) => u.word); const store = createLibraryStore(process.env.VOCAB_DATA_DIR || path.resolve(".local/vocab")); const practice = await store.markPracticed(used, new Date()); return new Response(JSON.stringify({ feedback, practice: { ...practice, saved: true } }), { headers: { "Content-Type": "application/json" } }); } catch (error) { return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "批改失败" }), { status: 400, headers: { "Content-Type": "application/json" } }); }
};
