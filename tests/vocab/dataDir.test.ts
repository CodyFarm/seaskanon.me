import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { DEFAULT_VOCAB_DATA_DIR, resolveVocabDataDir } from "../../src/lib/vocab/dataDir";

test("prefers the configured VOCAB_DATA_DIR", () => {
  assert.equal(resolveVocabDataDir({ VOCAB_DATA_DIR: "/data/vocab" }), "/data/vocab");
});

test("falls back to a local directory instead of failing when production has no data directory", () => {
  assert.equal(resolveVocabDataDir({ NODE_ENV: "production" }), DEFAULT_VOCAB_DATA_DIR);
  assert.equal(DEFAULT_VOCAB_DATA_DIR, path.resolve(".local/vocab"));
});
