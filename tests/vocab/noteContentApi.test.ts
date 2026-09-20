import test from "node:test";
import assert from "node:assert/strict";
import { createNoteContentHandler } from "../../src/lib/vocab/noteContentApi";

test("requires an authenticated admin before reading note content", async () => {
  let readCalled = false;
  const handle = createNoteContentHandler(
    () => false,
    () => {
      readCalled = true;
      return "secret note";
    },
  );

  const response = await handle(new Request("http://localhost/api/vocab/note-content?slug=lesson-one"));

  assert.equal(response.status, 401);
  assert.equal(readCalled, false);
});

test("returns the saved Markdown for the selected note slug", async () => {
  const handle = createNoteContentHandler(
    () => true,
    (slug) => {
      assert.equal(slug, "IELTS/lesson one");
      return "# Vocabulary\n\n1. sustain 维持";
    },
  );

  const response = await handle(new Request("http://localhost/api/vocab/note-content?slug=IELTS%2Flesson%20one"));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    slug: "IELTS/lesson one",
    content: "# Vocabulary\n\n1. sustain 维持",
  });
});

test("reports missing notes without exposing filesystem details", async () => {
  const handle = createNoteContentHandler(
    () => true,
    () => {
      const error = new Error("D:/private/content/missing.md");
      Object.assign(error, { code: "ENOENT" });
      throw error;
    },
  );

  const response = await handle(new Request("http://localhost/api/vocab/note-content?slug=missing"));
  const body = await response.text();

  assert.equal(response.status, 404);
  assert.match(body, /笔记不存在/);
  assert.doesNotMatch(body, /D:\/private/);
});
