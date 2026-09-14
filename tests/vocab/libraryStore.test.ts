import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createLibraryStore } from "../../src/lib/vocab/libraryStore";

const entry = { word: "compulsory", partOfSpeech: "adjective", meaningZh: "强制的", meaningEn: "required", mastery: 1 as const };

test("initializes an empty library and creates an entry", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "vocab-store-"));
  const store = createLibraryStore(dir, () => new Date("2026-09-14T00:00:00.000Z"));
  const initial = await store.read();
  assert.deepEqual(initial.entries, []);
  const saved = await store.create(entry, initial.revision);
  assert.equal(saved.entries[0].word, "compulsory");
  assert.equal(saved.entries[0].lastPracticedAt, null);
});

test("rejects stale revisions without changing the file", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "vocab-store-"));
  const store = createLibraryStore(dir, () => new Date("2026-09-14T00:00:00.000Z"));
  const initial = await store.read();
  const saved = await store.create(entry, initial.revision);
  await assert.rejects(() => store.create({ ...entry, word: "access" }, initial.revision));
  assert.equal((await store.read()).revision, saved.revision);
});

test("marks only existing words as practiced", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "vocab-store-"));
  const store = createLibraryStore(dir, () => new Date("2026-09-14T00:00:00.000Z"));
  const initial = await store.read();
  const saved = await store.create(entry, initial.revision);
  const result = await store.markPracticed(["compulsory", "missing"], new Date("2026-09-14T01:00:00.000Z"));
  assert.deepEqual(result.updated, ["compulsory"]);
  assert.deepEqual(result.skipped, ["missing"]);
  assert.equal((await store.read()).entries[0].mastery, 1);
  assert.match(await readFile(path.join(dir, "vocab-library.json"), "utf8"), /compulsory/);
  assert.notEqual(saved.revision, (await store.read()).revision);
});
