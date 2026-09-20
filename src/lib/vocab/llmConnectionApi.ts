import {
  LLMRequestError,
  type LLMCompletionOptions,
  type LLMConfig,
  type LLMMessage,
} from "./llmClient";

type Complete = (
  config: LLMConfig,
  messages: LLMMessage[],
  options: LLMCompletionOptions,
) => Promise<string>;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

function endpointHost(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return "配置地址无效";
  }
}

function diagnosticMessage(error: unknown): string {
  if (error instanceof LLMRequestError) {
    if (error.status === 401 || error.status === 403) return `上游返回 ${error.status}：API 密钥无效或无权访问该模型`;
    if (error.status === 404) return `上游返回 404：接口地址或模型名称不存在`;
    if (error.status === 429) return "上游返回 429：额度不足或请求频率受限";
    return `上游返回 ${error.status}：${error.message.replace(/^LLM request failed \([^)]*\)(?: \[[^\]]*\])?:\s*/, "")}`;
  }
  if (error instanceof Error && error.name === "AbortError") return "连接超时，请检查服务地址或网络";
  return error instanceof Error ? error.message : "未知连接错误";
}

export function createLLMConnectionHandler(
  authenticated: (request: Request) => boolean,
  getConfig: () => LLMConfig,
  complete: Complete,
  now: () => number = Date.now,
) {
  return async (request: Request): Promise<Response> => {
    if (!authenticated(request)) return json({ error: "Unauthorized" }, 401);

    let config: LLMConfig;
    try {
      config = getConfig();
    } catch (error) {
      const detail = error instanceof Error && error.message ? error.message : "未找到模型配置";
      return json({ connected: false, error: `${detail}（请检查 .env 后重启服务）` }, 503);
    }

    const startedAt = now();
    try {
      await complete(
        config,
        [{ role: "user", content: 'Return JSON only: {"status":"OK"}' }],
        { disableThinking: true, maxTokens: 512, temperature: 0 },
      );
      return json({
        connected: true,
        provider: config.provider,
        model: config.model,
        endpoint: endpointHost(config.endpoint),
        elapsedMs: Math.max(0, now() - startedAt),
      });
    } catch (error) {
      return json({
        connected: false,
        provider: config.provider,
        model: config.model,
        endpoint: endpointHost(config.endpoint),
        elapsedMs: Math.max(0, now() - startedAt),
        error: diagnosticMessage(error),
      }, 502);
    }
  };
}
