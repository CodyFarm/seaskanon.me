import type { APIRoute } from "astro";
import { isAuthenticated, unauthorizedResponse } from "../../../../lib/vocab-auth";
import { parseVocabNote } from "../../../../lib/vocab-parser";
import { createLibraryStore } from "../../../../lib/vocab/libraryStore";
import path from "node:path";
import { createHash } from "node:crypto";
export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
  if (!isAuthenticated(request)) return unauthorizedResponse();
  try { const { text, scope = "entries" } = await request.json(); if (typeof text !== "string" || !text.trim() || text.length > 20000) throw new Error("请输入有效文本"); const parsed = parseVocabNote(text, "candidate"); const entries = parsed.entries.flatMap(e => [e, ...(e.subEntries || [])]); const source = scope === "expanded" ? text.match(/\b[A-Za-z][A-Za-z'-]{2,}\b/g) || [] : entries.map(e => e.english); const unique = [...new Map(source.map(word => [word.toLowerCase(), word])).values()].slice(0, 100); const { entries: existing } = await createLibraryStore(process.env.VOCAB_DATA_DIR || path.resolve(".local/vocab")).read(); const candidates = unique.map(word => { const old = existing.find(e => e.word.toLowerCase() === word.toLowerCase()); const sourceEntry = entries.find(e => e.english.toLowerCase() === word.toLowerCase()); return { entry: { word, partOfSpeech: old?.partOfSpeech || "phrase", meaningZh: old?.meaningZh || sourceEntry?.chinese || "待补充", meaningEn: old?.meaningEn || "Meaning to review", mastery: old?.mastery || 1 }, evidence: sourceEntry ? `${sourceEntry.english} ${sourceEntry.chinese}` : word, existing: !!old }; }); return new Response(JSON.stringify({ sourceHash: createHash("sha256").update(text).digest("hex"), scope, candidates, revision: (await createLibraryStore(process.env.VOCAB_DATA_DIR || path.resolve(".local/vocab")).read()).revision }), { headers: { "Content-Type": "application/json" } }); } catch (error) { return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "提取失败" }), { status: 400, headers: { "Content-Type": "application/json" } }); }
};
