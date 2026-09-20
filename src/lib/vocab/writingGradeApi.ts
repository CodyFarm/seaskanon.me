import type { LLMCompletionOptions, LLMMessage } from "./llmClient";

type Complete = (messages: LLMMessage[], options: LLMCompletionOptions) => Promise<string>;
type MarkPracticed = (words: string[]) => Promise<unknown>;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

function parseJsonObject(raw: string): Record<string, any> {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  if (!candidate.trim()) throw new Error("AI 返回内容不是有效 JSON");
  return JSON.parse(candidate.trim());
}

export function createWritingGradeHandler(
  authenticated: (request: Request) => boolean,
  complete: Complete,
  markPracticed: MarkPracticed,
) {
  return async (request: Request): Promise<Response> => {
    if (!authenticated(request)) return json({ error: "Unauthorized" }, 401);

    let task: any;
    let text: string;
    try {
      const body = await request.json();
      task = body.task;
      text = typeof body.text === "string" ? body.text.trim() : "";
      if (!task || !text) return json({ error: "作文不能为空" }, 400);
    } catch {
      return json({ error: "请求内容无效" }, 400);
    }

    let raw: string;
    try {
      raw = await complete([
        {
          role: "system",
          content: "You are an IELTS paragraph writing tutor. Return JSON only with overallComment, priorities, scores, targetWordUsage, sentenceFeedback, improvedParagraph, referenceParagraph, masterySuggestions. Score the paragraph as practice feedback, not an official IELTS score. Each target word must appear exactly once in targetWordUsage with status used_correctly, used_with_issue, or not_used and evidence copied from the submission.",
        },
        { role: "user", content: JSON.stringify({ task, submission: text }) },
      ], { maxTokens: 8192, temperature: 0 });
    } catch (error) {
      console.warn("[vocab writing grade] provider request failed:", error instanceof Error ? error.message : "unknown error");
      return json({ error: `AI 批改服务请求失败：${error instanceof Error ? error.message : "请检查模型配置"}` }, 502);
    }

    try {
      const feedback = parseJsonObject(raw);
      if (!Array.isArray(feedback.targetWordUsage) || typeof feedback.overallComment !== "string") {
        throw new Error("缺少批改字段");
      }
      const targetWords = Array.isArray(task.targetWords) ? task.targetWords : [];
      const allowed = new Set(targetWords.map((word: any) => String(word.word).toLowerCase()));
      const used = feedback.targetWordUsage
        .filter((usage: any) => usage.status !== "not_used" && allowed.has(String(usage.word).toLowerCase()))
        .map((usage: any) => String(usage.word));
      const practice = await markPracticed(used);
      return json({ feedback, practice: { ...(practice as object), saved: true } });
    } catch (error) {
      console.warn("[vocab writing grade] invalid model output:", error instanceof Error ? error.message : "unknown error");
      return json({ error: "AI 返回的批改格式不完整，请重试" }, 502);
    }
  };
}
