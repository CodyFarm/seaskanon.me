import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createLibraryStore } from "../../src/lib/vocab/libraryStore";
import { createLibraryHandler } from "../../src/lib/vocab/libraryApi";

const entry = { word: "English", partOfSpeech: "noun", meaningZh: "英语", meaningEn: "a language", mastery: 1 as const };
test("authenticated CRUD preserves dates and rejects stale or duplicate writes", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "vocab-api-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = createLibraryStore(dir);
  const handle = createLibraryHandler(() => store, (r) => r.headers.get("authorization") === "test");
  const request = (method = "GET", body?: unknown, origin = "http://localhost") => handle(new Request("http://localhost/api/vocab/library", {
    method, headers: { authorization: "test", origin, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
  assert.equal((await handle(new Request("http://localhost/api/vocab/library"))).status, 401);
  const initial = await (await request()).json();
  assert.equal((await request("POST", { entry, expectedRevision: initial.revision }, "https://other.example")).status, 403);
  const response = await request("POST", { entry, expectedRevision: initial.revision });
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.equal((await request("POST", { entry, expectedRevision: created.revision })).status, 409);
  assert.equal((await request("PATCH", { originalWord: "English", patch: { mastery: 2 }, expectedRevision: initial.revision })).status, 409);
  assert.equal((await request("PATCH", { originalWord: "English", patch: { addedAt: "bad" }, expectedRevision: created.revision })).status, 400);
  const editedResponse = await request("PATCH", { originalWord: "English", patch: { mastery: 2, meaningEn: "English language" }, expectedRevision: created.revision });
  assert.equal(editedResponse.status, 200);
  const edited = await editedResponse.json();
  assert.equal(edited.entry.addedAt, created.entry.addedAt);
  assert.equal(edited.entry.mastery, 2);
  assert.equal((await request("DELETE", { word: "missing", expectedRevision: edited.revision })).status, 404);
  assert.equal((await request("DELETE", { word: "English", expectedRevision: edited.revision })).status, 200);
  assert.deepEqual((await store.read()).entries, []);
});

test("uses the configured public origin behind a TLS-terminating proxy", async () => {
  const handler = createLibraryHandler(() => { throw new Error("storage unavailable"); }, () => true, "https://seaskanon.me");
  const request = (origin: string) => handler(new Request("http://seaskanon.me/api/vocab/library", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ entry, expectedRevision: "revision" }),
  }));
  assert.equal((await request("https://evil.example")).status, 403);
  assert.equal((await request("https://seaskanon.me")).status, 503);
});

test("rejects malformed bodies and conceals storage failures", async () => {
  const handler = createLibraryHandler(() => { throw new Error("secret/server/path"); }, () => true);
  assert.equal((await handler(new Request("http://localhost/api/vocab/library", { method: "POST", headers: { origin: "http://localhost", "content-type": "application/json" }, body: "{" }))).status, 400);
  const response = await handler(new Request("http://localhost/api/vocab/library"));
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes("secret"));
});
