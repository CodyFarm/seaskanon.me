import test from "node:test";
import assert from "node:assert/strict";
import { createLLMConnectionHandler } from "../../src/lib/vocab/llmConnectionApi";
import { LLMRequestError, type LLMConfig } from "../../src/lib/vocab/llmClient";

const request = new Request("http://localhost/api/vocab/llm/test", { method: "POST" });
const config: LLMConfig = {
  provider: "custom",
  apiKey: "never-return-this-key",
  endpoint: "https://api.deepseek.com/chat/completions",
  model: "deepseek-chat",
};

test("requires admin authentication before testing the model", async () => {
  const handler = createLLMConnectionHandler(() => false, () => config, async () => "OK");
  assert.equal((await handler(request)).status, 401);
});

test("returns a safe configuration summary after a successful model probe", async () => {
  const handler = createLLMConnectionHandler(
    () => true,
    () => config,
    async (_config, messages, options) => {
      assert.match(messages[0].content, /OK/);
      assert.match(messages[0].content, /JSON/i);
      assert.deepEqual(options, { disableThinking: true, maxTokens: 512, temperature: 0 });
      return "OK";
    },
    () => 1250,
  );

  const response = await handler(request);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    connected: true,
    provider: "custom",
    model: "deepseek-chat",
    endpoint: "api.deepseek.com",
    elapsedMs: 0,
  });
  assert.doesNotMatch(JSON.stringify(body), /never-return-this-key/);
});

test("reports actionable upstream status without exposing the API key", async () => {
  const handler = createLLMConnectionHandler(
    () => true,
    () => config,
    async () => { throw new LLMRequestError(401, "invalid_api_key", "Authentication failed"); },
  );

  const response = await handler(request);
  const body = await response.json();

  assert.equal(response.status, 502);
  assert.equal(body.connected, false);
  assert.match(body.error, /401/);
  assert.match(body.error, /密钥/);
  assert.doesNotMatch(JSON.stringify(body), /never-return-this-key/);
});
