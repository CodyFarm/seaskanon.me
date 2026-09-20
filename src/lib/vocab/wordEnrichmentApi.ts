import { validateEditable } from "./libraryRules";
import type { LLMCompletionOptions, LLMMessage } from "./llmClient";

type Complete = (messages: LLMMessage[], options?: LLMCompletionOptions) => Promise<string>;

function parseAttributes(raw: string): Record<string, unknown> {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  if (!candidate.trim()) throw new Error("Missing JSON object");
  const parsed = JSON.parse(candidate.trim());
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid JSON object");
  }
  return parsed as Record<string, unknown>;
}

function firstField(value: Record<string, unknown>, keys: string[]): unknown {
  return keys.map((key) => value[key]).find((field) => typeof field === "string" && field.trim());
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  },
});

export function createWordEnrichmentHandler(
  authenticated: (request: Request) => boolean,
  complete: Complete,
) {
  return async (request: Request): Promise<Response> => {
    if (!authenticated(request)) return json({ error: "Unauthorized" }, 401);

    try {
      const body = await request.json();
      const word = typeof body.word === "string" ? body.word.trim() : "";
      if (!word || word.length > 80) {
        return json({ error: "请输入有效的单词或短语" }, 400);
      }

      const current = body.current && typeof body.current === "object"
        ? {
            partOfSpeech: String(body.current.partOfSpeech || "").trim(),
            meaningZh: String(body.current.meaningZh || "").trim(),
            meaningEn: String(body.current.meaningEn || "").trim(),
          }
        : undefined;
      let raw: string;
      try {
        raw = await complete(
          [
            {
              role: "system",
              content: "You are an English lexicographer for IELTS learners. Return JSON only with partOfSpeech, meaningZh, and meaningEn. Give concise, accurate definitions for the supplied word or phrase. If current attributes are supplied, correct or improve them. Do not include the word itself or mastery level.",
            },
            { role: "user", content: JSON.stringify({ word, current }) },
          ],
          { disableThinking: true, maxTokens: 512, temperature: 0 },
        );
      } catch (error) {
        console.warn("[vocab enrichment] provider request failed:", error instanceof Error ? error.message : "unknown error");
        return json({ error: "AI 服务请求失败，请检查模型配置或稍后重试" }, 502);
      }

      const parsed = parseAttributes(raw);
      const validated = validateEditable({
        word,
        partOfSpeech: firstField(parsed, ["partOfSpeech", "part_of_speech", "pos", "wordClass"]),
        meaningZh: firstField(parsed, ["meaningZh", "meaning_zh", "chineseMeaning", "meaningChinese", "definitionZh"]),
        meaningEn: firstField(parsed, ["meaningEn", "meaning_en", "englishMeaning", "meaningEnglish", "definitionEn"]),
        mastery: 1,
      });

      return json({
        attributes: {
          partOfSpeech: validated.partOfSpeech,
          meaningZh: validated.meaningZh,
          meaningEn: validated.meaningEn,
        },
      });
    } catch (error) {
      console.warn("[vocab enrichment] invalid model output:", error instanceof Error ? error.message : "unknown error");
      return json({ error: "AI 返回格式不完整，请重试；若持续出现请检查服务端日志" }, 502);
    }
  };
}
