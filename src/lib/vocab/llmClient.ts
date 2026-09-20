export interface LLMMessage { role: "system" | "user" | "assistant"; content: string; }
export interface LLMConfig { provider: "anthropic" | "openai" | "custom"; apiKey: string; endpoint: string; model: string; }
export interface LLMCompletionOptions {
  disableThinking?: boolean;
  maxTokens?: number;
  temperature?: number;
}
type Fetcher = typeof fetch;

export class LLMRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(`LLM request failed (${status})${code ? ` [${code}]` : ""}: ${message}`);
    this.name = "LLMRequestError";
  }
}

async function readUpstreamError(response: Response): Promise<LLMRequestError> {
  let message = response.statusText || "Upstream request failed";
  let code = "";
  try {
    const body = await response.json();
    const error = body?.error;
    if (typeof error?.message === "string") message = error.message.slice(0, 300);
    if (typeof error?.code === "string") code = error.code.slice(0, 80);
    else if (typeof error?.type === "string") code = error.type.slice(0, 80);
  } catch {
    // Some compatible providers return an empty or non-JSON error response.
  }
  return new LLMRequestError(response.status, code, message);
}

export function createLLMClient(config: LLMConfig, fetcher: Fetcher = fetch) {
  return { complete: async (
    messages: LLMMessage[],
    timeoutMs = 60000,
    options: LLMCompletionOptions = {},
  ): Promise<string> => {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let body: Record<string, unknown>;
      if (config.provider === "anthropic") { headers["x-api-key"] = config.apiKey; headers["anthropic-version"] = "2023-06-01"; body = { model: config.model, max_tokens: options.maxTokens ?? 8192, system: messages.find((m) => m.role === "system")?.content || "", messages: messages.filter((m) => m.role !== "system") }; }
      else {
        headers.Authorization = `Bearer ${config.apiKey}`;
        body = {
          model: config.model,
          messages,
          max_tokens: options.maxTokens ?? 8192,
          temperature: options.temperature ?? 0.4,
        };
        const isDeepSeek = config.endpoint.includes("api.deepseek.com") || config.model.toLowerCase().includes("deepseek");
        if (options.disableThinking && isDeepSeek) {
          body.thinking = { type: "disabled" };
          body.response_format = { type: "json_object" };
        }
      }
      const response = await fetcher(config.endpoint, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
      if (!response.ok) throw await readUpstreamError(response);
      const json = await response.json(); const content = json.content?.[0]?.text || json.choices?.[0]?.message?.content || json.choices?.[0]?.text || json.response || "";
      if (!content || typeof content !== "string") throw new Error("LLM returned empty response");
      return content;
    } finally { clearTimeout(timer); }
  } };
}

export type LLMEnv = Record<string, string | undefined>;

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-5-20250929";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o";

/** Accepts a base URL or a full endpoint and normalizes it to a chat-completions URL. */
export function normalizeChatEndpoint(endpoint: string): string {
  const base = endpoint.replace(/\/+$/, "");
  return base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
}

function readCustomConfig(env: LLMEnv): LLMConfig | null {
  if (!env.CUSTOM_LLM_API_KEY || !env.CUSTOM_LLM_ENDPOINT) return null;
  return {
    provider: "custom",
    apiKey: env.CUSTOM_LLM_API_KEY,
    endpoint: normalizeChatEndpoint(env.CUSTOM_LLM_ENDPOINT),
    model: env.CUSTOM_LLM_MODEL || "kimi-k3",
  };
}

/**
 * Resolve the active LLM provider from environment values.
 *
 * `LLM_PROVIDER` (anthropic | openai | custom) pins the provider explicitly and
 * takes precedence over the legacy heuristic. Without it, a key that merely
 * happens to exist on the machine (for example a leftover user-level
 * `OPENAI_API_KEY` from another project) silently outranks the provider this
 * site actually configured, which is how the vocab-studio probe ended up
 * calling api.openai.com.
 *
 * When `LLM_PROVIDER` is unset the legacy priority is preserved:
 * ANTHROPIC → OPENAI → CUSTOM.
 */
export function resolveLLMConfig(env: LLMEnv): LLMConfig {
  const preferred = (env.LLM_PROVIDER || "").trim().toLowerCase();

  if (preferred === "custom") {
    const config = readCustomConfig(env);
    if (!config) throw new Error("LLM_PROVIDER=custom 需要同时配置 CUSTOM_LLM_API_KEY 和 CUSTOM_LLM_ENDPOINT");
    return config;
  }
  if (preferred === "anthropic") {
    if (!env.ANTHROPIC_API_KEY) throw new Error("LLM_PROVIDER=anthropic 需要配置 ANTHROPIC_API_KEY");
    return { provider: "anthropic", apiKey: env.ANTHROPIC_API_KEY, endpoint: ANTHROPIC_ENDPOINT, model: ANTHROPIC_MODEL };
  }
  if (preferred === "openai") {
    if (!env.OPENAI_API_KEY) throw new Error("LLM_PROVIDER=openai 需要配置 OPENAI_API_KEY");
    return { provider: "openai", apiKey: env.OPENAI_API_KEY, endpoint: OPENAI_ENDPOINT, model: OPENAI_MODEL };
  }
  if (preferred) throw new Error(`LLM_PROVIDER 取值无效：${preferred}（可选 anthropic | openai | custom）`);

  if (env.ANTHROPIC_API_KEY) return { provider: "anthropic", apiKey: env.ANTHROPIC_API_KEY, endpoint: ANTHROPIC_ENDPOINT, model: ANTHROPIC_MODEL };
  if (env.OPENAI_API_KEY) return { provider: "openai", apiKey: env.OPENAI_API_KEY, endpoint: OPENAI_ENDPOINT, model: OPENAI_MODEL };
  const custom = readCustomConfig(env);
  if (custom) return custom;
  throw new Error("未配置任何模型：请设置 LLM_PROVIDER=custom 并补全 CUSTOM_LLM_*，或设置 ANTHROPIC_API_KEY / OPENAI_API_KEY");
}

export function getConfiguredLLM(): LLMConfig {
  return resolveLLMConfig(import.meta.env);
}
