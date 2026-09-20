import test from "node:test";
import assert from "node:assert/strict";
import { createLLMClient, LLMRequestError, resolveLLMConfig } from "../../src/lib/vocab/llmClient";

test("extracts content from an OpenAI-compatible response", async () => {
  const client = createLLMClient({ provider: "openai", apiKey: "test", endpoint: "https://example.test/chat/completions", model: "test" }, async () => new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), { status: 200 }));
  assert.equal(await client.complete([{ role: "user", content: "hello" }]), "OK");
});

test("rejects an empty model response", async () => {
  const client = createLLMClient({ provider: "openai", apiKey: "test", endpoint: "https://example.test/chat/completions", model: "test" }, async () => new Response(JSON.stringify({ choices: [{ message: { content: "" } }] }), { status: 200 }));
  await assert.rejects(() => client.complete([{ role: "user", content: "hello" }]));
});

test("disables DeepSeek thinking for short structured completions", async () => {
  let sentBody: Record<string, unknown> | undefined;
  const client = createLLMClient(
    {
      provider: "custom",
      apiKey: "test",
      endpoint: "https://api.deepseek.com/chat/completions",
      model: "deepseek-v4-flash",
    },
    async (_input, init) => {
      sentBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        choices: [{ message: { content: '{"ok":true}' } }],
      }), { status: 200 });
    },
  );

  await client.complete(
    [{ role: "user", content: "return JSON" }],
    15_000,
    { disableThinking: true, maxTokens: 512, temperature: 0 },
  );

  assert.deepEqual(sentBody?.thinking, { type: "disabled" });
  assert.deepEqual(sentBody?.response_format, { type: "json_object" });
  assert.equal(sentBody?.max_tokens, 512);
  assert.equal(sentBody?.temperature, 0);
});

test("preserves safe upstream error details for diagnostics", async () => {
  const client = createLLMClient(
    { provider: "custom", apiKey: "secret", endpoint: "https://example.test/chat/completions", model: "bad-model" },
    async () => new Response(JSON.stringify({
      error: { message: "Model does not exist", type: "invalid_request_error", code: "model_not_found" },
    }), { status: 404 }),
  );

  await assert.rejects(
    () => client.complete([{ role: "user", content: "hello" }]),
    (error: unknown) => error instanceof LLMRequestError
      && error.status === 404
      && error.code === "model_not_found"
      && error.message.includes("Model does not exist")
      && !error.message.includes("secret"),
  );
});

test("LLM_PROVIDER=custom outranks ambient keys from other projects", () => {
  const config = resolveLLMConfig({
    LLM_PROVIDER: "custom",
    CUSTOM_LLM_API_KEY: "custom-key",
    CUSTOM_LLM_ENDPOINT: "https://api.deepseek.com",
    CUSTOM_LLM_MODEL: "deepseek-flash",
    OPENAI_API_KEY: "leftover-machine-key",
    ANTHROPIC_API_KEY: "leftover-machine-key",
  });
  assert.deepEqual(config, {
    provider: "custom",
    apiKey: "custom-key",
    endpoint: "https://api.deepseek.com/chat/completions",
    model: "deepseek-flash",
  });
});

test("keeps the legacy provider priority when LLM_PROVIDER is unset", () => {
  assert.equal(resolveLLMConfig({ ANTHROPIC_API_KEY: "k", OPENAI_API_KEY: "k" }).provider, "anthropic");
  assert.equal(
    resolveLLMConfig({ OPENAI_API_KEY: "k", CUSTOM_LLM_API_KEY: "k", CUSTOM_LLM_ENDPOINT: "https://x.test" }).provider,
    "openai",
  );
  assert.equal(
    resolveLLMConfig({ CUSTOM_LLM_API_KEY: "k", CUSTOM_LLM_ENDPOINT: "https://x.test/v1/chat/completions/" }).endpoint,
    "https://x.test/v1/chat/completions",
  );
});

test("reports actionable errors for a missing or invalid LLM_PROVIDER", () => {
  assert.throws(() => resolveLLMConfig({ LLM_PROVIDER: "custom" }), /CUSTOM_LLM_API_KEY/);
  assert.throws(() => resolveLLMConfig({ LLM_PROVIDER: "nope" }), /LLM_PROVIDER/);
  assert.throws(() => resolveLLMConfig({}), /未配置任何模型/);
});
