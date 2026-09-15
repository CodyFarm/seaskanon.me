import test from "node:test";
import assert from "node:assert/strict";
import { createLLMClient } from "../../src/lib/vocab/llmClient";

test("extracts content from an OpenAI-compatible response", async () => {
  const client = createLLMClient({ provider: "openai", apiKey: "test", endpoint: "https://example.test/chat/completions", model: "test" }, async () => new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), { status: 200 }));
  assert.equal(await client.complete([{ role: "user", content: "hello" }]), "OK");
});

test("rejects an empty model response", async () => {
  const client = createLLMClient({ provider: "openai", apiKey: "test", endpoint: "https://example.test/chat/completions", model: "test" }, async () => new Response(JSON.stringify({ choices: [{ message: { content: "" } }] }), { status: 200 }));
  await assert.rejects(() => client.complete([{ role: "user", content: "hello" }]));
});
