export interface LLMMessage { role: "system" | "user" | "assistant"; content: string; }
export interface LLMConfig { provider: "anthropic" | "openai" | "custom"; apiKey: string; endpoint: string; model: string; }
type Fetcher = typeof fetch;
export function createLLMClient(config: LLMConfig, fetcher: Fetcher = fetch) {
  return { complete: async (messages: LLMMessage[], timeoutMs = 60000): Promise<string> => {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let body: Record<string, unknown>;
      if (config.provider === "anthropic") { headers["x-api-key"] = config.apiKey; headers["anthropic-version"] = "2023-06-01"; body = { model: config.model, max_tokens: 8192, system: messages.find((m) => m.role === "system")?.content || "", messages: messages.filter((m) => m.role !== "system") }; }
      else { headers.Authorization = `Bearer ${config.apiKey}`; body = { model: config.model, messages, max_tokens: 8192, temperature: 0.4 }; }
      const response = await fetcher(config.endpoint, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
      if (!response.ok) throw new Error(`LLM request failed (${response.status})`);
      const json = await response.json(); const content = json.content?.[0]?.text || json.choices?.[0]?.message?.content || json.choices?.[0]?.text || json.response || "";
      if (!content || typeof content !== "string") throw new Error("LLM returned empty response");
      return content;
    } finally { clearTimeout(timer); }
  } };
}

export function getConfiguredLLM(): LLMConfig {
  const env = import.meta.env;
  if (env.ANTHROPIC_API_KEY) return { provider: "anthropic", apiKey: env.ANTHROPIC_API_KEY, endpoint: "https://api.anthropic.com/v1/messages", model: "claude-sonnet-4-5-20250929" };
  if (env.OPENAI_API_KEY) return { provider: "openai", apiKey: env.OPENAI_API_KEY, endpoint: "https://api.openai.com/v1/chat/completions", model: "gpt-4o" };
  if (env.CUSTOM_LLM_API_KEY && env.CUSTOM_LLM_ENDPOINT) return { provider: "custom", apiKey: env.CUSTOM_LLM_API_KEY, endpoint: env.CUSTOM_LLM_ENDPOINT.replace(/\/+$/, "").endsWith("/chat/completions") ? env.CUSTOM_LLM_ENDPOINT : `${env.CUSTOM_LLM_ENDPOINT.replace(/\/+$/, "")}/chat/completions`, model: env.CUSTOM_LLM_MODEL || "kimi-k3" };
  throw new Error("No LLM provider configured");
}
