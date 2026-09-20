import test from "node:test";
import assert from "node:assert/strict";
import { createWritingGradeHandler } from "../../src/lib/vocab/writingGradeApi";

const task = {
  targetWords: [{ word: "sustain" }],
};

const request = (text = "We should sustain progress.") => new Request("http://localhost/api/vocab/writing/grade", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ task, text }),
});

test("keeps model thinking enabled for writing feedback", async () => {
  let practiced: string[] = [];
  const handler = createWritingGradeHandler(
    () => true,
    async (_messages, options) => {
      assert.deepEqual(options, { maxTokens: 8192, temperature: 0 });
      return '```json\n{"overallComment":"Clear","targetWordUsage":[{"word":"sustain","status":"used_correctly","comment":"Correct"}]}\n```';
    },
    async (words) => { practiced = words; return { updated: words }; },
  );

  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.deepEqual(practiced, ["sustain"]);
});

test("returns a diagnostic service error when grading provider fails", async () => {
  const handler = createWritingGradeHandler(
    () => true,
    async () => { throw new Error("LLM request failed (401): Authentication failed"); },
    async () => ({ updated: [] }),
  );

  const response = await handler(request());
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /AI 批改服务请求失败/);
});
