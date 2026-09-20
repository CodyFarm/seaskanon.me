import test from "node:test";
import assert from "node:assert/strict";
import { createWordEnrichmentHandler } from "../../src/lib/vocab/wordEnrichmentApi";

const request = (body: unknown) => new Request("http://localhost/api/vocab/library/enrich", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

test("requires an authenticated admin before requesting AI word attributes", async () => {
  let called = false;
  const handle = createWordEnrichmentHandler(
    () => false,
    async () => {
      called = true;
      return "{}";
    },
  );

  const response = await handle(request({ word: "sustain" }));

  assert.equal(response.status, 401);
  assert.equal(called, false);
});

test("returns validated editable attributes from a fenced AI response", async () => {
  const handle = createWordEnrichmentHandler(
    () => true,
    async (messages, options) => {
      assert.match(messages[1].content, /sustain/);
      assert.match(messages[1].content, /维持/);
      assert.deepEqual(options, {
        disableThinking: true,
        maxTokens: 512,
        temperature: 0,
      });
      return '```json\n{"partOfSpeech":"verb","meaningZh":"维持；支撑","meaningEn":"to keep something going over time"}\n```';
    },
  );

  const response = await handle(request({
    word: " sustain ",
    current: { partOfSpeech: "verb", meaningZh: "维持", meaningEn: "maintain" },
  }));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    attributes: {
      partOfSpeech: "verb",
      meaningZh: "维持；支撑",
      meaningEn: "to keep something going over time",
    },
  });
});

test("rejects missing words and incomplete AI attributes", async () => {
  const handle = createWordEnrichmentHandler(
    () => true,
    async () => '{"partOfSpeech":"noun","meaningZh":"结果"}',
  );

  assert.equal((await handle(request({ word: "" }))).status, 400);
  assert.equal((await handle(request({ word: "outcome" }))).status, 502);
});

test("extracts JSON surrounded by model commentary and accepts common field aliases", async () => {
  const handle = createWordEnrichmentHandler(
    () => true,
    async () => [
      "Here is the completed entry:",
      "```JSON",
      '{"part_of_speech":"adjective","chineseMeaning":"可持续的","englishMeaning":"able to continue without exhausting resources"}',
      "```",
    ].join("\n"),
  );

  const response = await handle(request({ word: "sustainable" }));

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).attributes, {
    partOfSpeech: "adjective",
    meaningZh: "可持续的",
    meaningEn: "able to continue without exhausting resources",
  });
});

test("distinguishes provider failures from invalid model output", async () => {
  const providerFailure = createWordEnrichmentHandler(
    () => true,
    async () => { throw new Error("LLM request failed (401)"); },
  );
  const invalidOutput = createWordEnrichmentHandler(
    () => true,
    async () => "I cannot provide that entry.",
  );

  const providerResponse = await providerFailure(request({ word: "sustain" }));
  const outputResponse = await invalidOutput(request({ word: "sustain" }));

  assert.equal(providerResponse.status, 502);
  assert.match((await providerResponse.json()).error, /AI 服务请求失败/);
  assert.match((await outputResponse.json()).error, /返回格式/);
});
