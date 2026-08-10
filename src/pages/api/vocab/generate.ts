/**
 * POST /api/vocab/generate
 *
 * 调用 LLM 生成练习册或丰富笔记内容。
 *
 * Body:
 *   mode: "exercise" | "enrich"
 *   slug: string (源笔记 slug)
 *   types?: string[] (exercise mode: 题型列表)
 *   customFormat?: string (exercise mode: 自定义题型描述)
 *   enrichOptions?: { examples?, synonymsEn?, synonymsCn?, roots?, categories? }
 */

export const prerender = false;

import { isAuthenticated, unauthorizedResponse } from "../../../lib/vocab-auth";
import { parseVocabNote } from "../../../lib/vocab-parser";
import { resolveNotePath } from "../../../lib/blog-dir";
import {
  buildExercisePrompt,
  buildExercisePromptFromText,
  buildEnrichPrompt,
  type EnrichOptions,
} from "../../../lib/vocab-prompts";
import fs from "node:fs";
import path from "node:path";

/** Count English word tokens in a string using a character-based regex. */
function countEnglishWords(text: string): number {
  const matches = text.match(/[A-Za-z]+/g);
  return matches ? matches.length : 0;
}

// ── LLM Client ──

interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LLMConfig {
  provider: "anthropic" | "openai" | "custom";
  apiKey: string;
  endpoint: string;
  model: string;
}

function getLLMConfig(): LLMConfig {
  const anthropicKey = import.meta.env.ANTHROPIC_API_KEY;
  const openaiKey = import.meta.env.OPENAI_API_KEY;
  const customKey = import.meta.env.CUSTOM_LLM_API_KEY;
  const customEndpoint = import.meta.env.CUSTOM_LLM_ENDPOINT;
  const customModel = import.meta.env.CUSTOM_LLM_MODEL;

  if (anthropicKey) {
    return {
      provider: "anthropic",
      apiKey: anthropicKey,
      endpoint: "https://api.anthropic.com/v1/messages",
      model: "claude-sonnet-4-5-20250929",
    };
  }

  if (openaiKey) {
    return {
      provider: "openai",
      apiKey: openaiKey,
      endpoint: "https://api.openai.com/v1/chat/completions",
      model: "gpt-4o",
    };
  }

  if (customKey && customEndpoint) {
    // Normalize: strip trailing slashes, then append /chat/completions
    let endpoint = customEndpoint.replace(/\/+$/, "");
    if (!endpoint.endsWith("/chat/completions")) {
      endpoint += "/chat/completions";
    }
    return {
      provider: "custom",
      apiKey: customKey,
      endpoint,
      model: customModel || "kimi-k3",
    };
  }

  throw new Error(
    "No LLM provider configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or CUSTOM_LLM_API_KEY in .env",
  );
}

async function callLLM(
  messages: LLMMessage[],
  config: LLMConfig,
): Promise<string> {
  if (config.provider === "anthropic") {
    return callAnthropic(messages, config);
  }
  // OpenAI and custom endpoints use the same Chat Completions API format
  return callOpenAICompatible(messages, config);
}

async function callAnthropic(
  messages: LLMMessage[],
  config: LLMConfig,
): Promise<string> {
  // Convert to Anthropic format: separate system from messages
  const systemMsg = messages.find((m) => m.role === "system");
  const chatMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const body = {
    model: config.model,
    // Generous cap: reasoning-capable models spend many tokens "thinking"
    // before the final content (4096 got fully consumed by reasoning on
    // larger inputs, leaving content empty). Claude's max output is 64000;
    // 32768 gives plenty of headroom for reasoning + long workbooks.
    max_tokens: 32768,
    system: systemMsg?.content || "",
    messages: chatMessages,
  };

  const res = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errText}`);
  }

  const json = await res.json();
  return json.content?.[0]?.text || "";
}

async function callOpenAICompatible(
  messages: LLMMessage[],
  config: LLMConfig,
): Promise<string> {
  const body = {
    model: config.model,
    messages,
    // Generous cap (billed on actual output, not the cap). Reasoning models
    // can exhaust small budgets on "thinking" alone for long inputs; DeepSeek
    // accepts up to 131072, so 65536 gives 8x headroom for big workbooks.
    max_tokens: 65536,
    temperature: 0.7,
  };

  const res = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[LLM] ${config.endpoint} → ${res.status}: ${errText}`);
    throw new Error(`LLM API error ${res.status} (${config.endpoint}): ${errText}`);
  }

  const json = await res.json();
  console.error("[LLM response]", JSON.stringify(json).slice(0, 300));

  // Try all common content locations
  let content =
    json.choices?.[0]?.message?.content ||
    json.choices?.[0]?.text ||
    json.content?.[0]?.text ||
    json.response ||
    "";

  // DeepSeek sometimes nests content inside an array
  if (!content && json.choices?.[0]?.message) {
    content = json.choices[0].message.content || "";
  }

  // Some providers return content as a list of parts
  if (Array.isArray(content)) {
    content = content.map((c: any) => (typeof c === "string" ? c : c.text || "")).join("");
  }

  if (!content) {
    console.error("[LLM] No content found in response:", JSON.stringify(json).slice(0, 500));
    throw new Error("LLM returned empty response. Check server logs for details.");
  }

  return content;
}

// ── Main POST handler ──

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST({ request }: { request: Request }) {
  if (!isAuthenticated(request)) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { mode, slug, types, customFormat, enrichOptions, text, title } = body;

    if (!mode) {
      return json({ error: "Missing required field: mode" }, 400);
    }

    const llmConfig = getLLMConfig();

    // ── analyze: test the LLM connection + count English words locally ──
    if (mode === "analyze") {
      if (!text || !text.trim()) {
        return json({ error: "Missing required field: text" }, 400);
      }
      const wordCount = countEnglishWords(text);
      try {
        // Minimal call to verify the configured LLM provider works.
        await callLLM(
          [{ role: "user", content: "Reply with exactly: OK" }],
          llmConfig,
        );
        return json({ wordCount, connected: true }, 200);
      } catch (err: any) {
        return json(
          { wordCount, connected: false, error: err.message || "Connection failed" },
          200,
        );
      }
    }

    // ── build prompt from the right source ──
    let system: string;
    let user: string;
    let responseTitle: string;
    let entryCount: number | null = null;

    if (mode === "exercise" && text?.trim()) {
      // Paste-text path: LLM extracts vocab + builds the workbook in one call.
      const p = buildExercisePromptFromText(
        text,
        types || ["en_to_cn", "fill_blank"],
        customFormat,
      );
      system = p.system;
      user = p.user;
      responseTitle = title || "粘贴文本词汇";
    } else {
      // File-based path: exercise-from-note, and enrich (always reads the file)
      if (!slug) {
        return json({ error: "Missing required field: slug" }, 400);
      }
      const filePath = resolveNotePath(slug);
      if (!fs.existsSync(filePath)) {
        return json({ error: `Note not found: ${slug}` }, 404);
      }
      const parsed = parseVocabNote(fs.readFileSync(filePath, "utf-8"), slug);
      if (parsed.entries.length === 0) {
        return json(
          { error: "No vocabulary entries found in this note" },
          400,
        );
      }

      if (mode === "exercise") {
        const p = buildExercisePrompt(
          parsed.entries,
          types || ["en_to_cn", "fill_blank"],
          customFormat,
        );
        system = p.system;
        user = p.user;
      } else if (mode === "enrich") {
        const p = buildEnrichPrompt(parsed.entries, enrichOptions || {});
        system = p.system;
        user = p.user;
      } else {
        return json(
          { error: "Invalid mode. Use 'analyze', 'exercise', or 'enrich'" },
          400,
        );
      }
      responseTitle = parsed.title;
      entryCount = parsed.entries.length;
    }

    const generated = await callLLM(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      llmConfig,
    );

    // Paste-text mode: derive the workbook title from the generated heading
    // `# 练习册：{主题}` so the client can name the saved file without a prompt.
    if (mode === "exercise" && text?.trim()) {
      const themeMatch = generated.match(/^#\s*练习册[:：]\s*(.+)$/m);
      if (themeMatch) responseTitle = themeMatch[1].replace(/[*_`]/g, "").trim();
    }

    return json(
      {
        generated,
        slug: slug || null,
        mode,
        title: responseTitle,
        entryCount,
      },
      200,
    );
  } catch (err: any) {
    console.error("[vocab generate]", err);
    return json({ error: err.message || "Generation failed" }, 500);
  }
}
