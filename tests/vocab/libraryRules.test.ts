import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWordKey, validateEditable } from "../../src/lib/vocab/libraryRules";

test("normalizes a phrase key without discarding display case", () => {
  assert.equal(normalizeWordKey("  Take   Part  "), "take part");
  const input = { word: "English", partOfSpeech: "noun", meaningZh: "英语", meaningEn: "a language", mastery: 1 };
  assert.equal(validateEditable(input).word, "English");
  assert.throws(() => validateEditable({ ...input, mastery: 6 }));
  assert.throws(() => validateEditable({ ...input, addedAt: "2020-01-01" }));
});
