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
  buildEnrichPrompt,
  type EnrichOptions,
} from "../../../lib/vocab-prompts";
import fs from "node:fs";
import path from "node:path";

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
    max_tokens: 4096,
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
    max_tokens: 4096,
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

export async function POST({ request }: { request: Request }) {
  if (!isAuthenticated(request)) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { mode, slug, types, customFormat, enrichOptions } = body;

    if (!mode || !slug) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: mode, slug" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Read and parse the note
    const filePath = resolveNotePath(slug);
    if (!fs.existsSync(filePath)) {
      return new Response(
        JSON.stringify({ error: `Note not found: ${slug}` }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    const markdown = fs.readFileSync(filePath, "utf-8");
    const parsed = parseVocabNote(markdown, slug);

    if (parsed.entries.length === 0) {
      return new Response(
        JSON.stringify({ error: "No vocabulary entries found in this note" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Get LLM config
    const llmConfig = getLLMConfig();

    // Build prompt and call LLM
    let system: string;
    let user: string;

    if (mode === "exercise") {
      const prompt = buildExercisePrompt(
        parsed.entries,
        types || ["en_to_cn", "fill_blank"],
        customFormat,
      );
      system = prompt.system;
      user = prompt.user;
    } else if (mode === "enrich") {
      const prompt = buildEnrichPrompt(parsed.entries, enrichOptions || {});
      system = prompt.system;
      user = prompt.user;
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid mode. Use 'exercise' or 'enrich'" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const generated = await callLLM(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      llmConfig,
    );

    return new Response(
      JSON.stringify({
        generated,
        slug,
        mode,
        title: parsed.title,
        entryCount: parsed.entries.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("[vocab generate]", err);
    return new Response(
      JSON.stringify({ error: err.message || "Generation failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
