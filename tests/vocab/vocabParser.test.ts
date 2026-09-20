import test from "node:test";
import assert from "node:assert/strict";
import { parseVocabNote } from "../../src/lib/vocab-parser";

test("removes a dash separator between an English term and its Chinese meaning", () => {
  const parsed = parseVocabNote("1. compulsory education — 义务教育", "education");

  assert.equal(parsed.entries[0].english, "compulsory education");
  assert.equal(parsed.entries[0].chinese, "义务教育");
});

test("ignores indented examples and annotations while retaining English sub-entries", () => {
  const parsed = parseVocabNote([
    "1. play truant — 逃学",
    "   > 例句：Students sometimes play truant.",
    "   （同义：skip school）",
    "   💡 truant 源自法语。",
    "   juvenile delinquent 青少年犯罪者",
  ].join("\n"), "education");

  assert.deepEqual(parsed.entries[0].subEntries, [{
    index: 1,
    english: "juvenile delinquent",
    chinese: "青少年犯罪者",
  }]);
});
