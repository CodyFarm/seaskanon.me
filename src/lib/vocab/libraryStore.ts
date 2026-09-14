import { createHash } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeWordKey, validateEditable, type EditableEntry, type VocabEntry } from "./libraryRules";

export interface LibrarySnapshot { entries: VocabEntry[]; revision: string; }
export interface LibraryStore {
  read(): Promise<LibrarySnapshot>;
  create(entry: EditableEntry, expectedRevision: string): Promise<LibrarySnapshot>;
  update(originalWord: string, patch: Partial<EditableEntry>, expectedRevision: string): Promise<LibrarySnapshot>;
  remove(word: string, expectedRevision: string): Promise<LibrarySnapshot>;
  markPracticed(words: string[], practicedAt: Date): Promise<{ updated: string[]; skipped: string[] }>;
}

export function createLibraryStore(directory: string, clock = () => new Date()): LibraryStore {
  const file = path.join(directory, "vocab-library.json");
  let tail: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(fn: () => Promise<T>) => { const result = tail.then(fn); tail = result.catch(() => undefined); return result; };
  async function read(): Promise<LibrarySnapshot> {
    let raw: string;
    try { raw = await readFile(file, "utf8"); } catch (error: any) { if (error.code === "ENOENT") return snapshot([]); throw error; }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("Vocabulary library must be an array");
    parsed.forEach((entry) => validateStored(entry));
    return snapshot(parsed);
  }
  async function write(entries: VocabEntry[]): Promise<LibrarySnapshot> {
    await mkdir(directory, { recursive: true });
    const temporary = path.join(directory, `.vocab-library.${process.pid}.${Date.now()}.tmp`);
    try { await writeFile(temporary, JSON.stringify(entries, null, 2) + "\n", "utf8"); await rename(temporary, file); } catch (error) { try { await unlink(temporary); } catch {} throw error; }
    return snapshot(entries);
  }
  return {
    read,
    create: (input, expected) => enqueue(async () => { const current = await read(); ensureRevision(current, expected); const entry = validateEditable(input); if (current.entries.some((e) => normalizeWordKey(e.word) === normalizeWordKey(entry.word))) throw new Error("Word already exists"); return write([...current.entries, { ...entry, addedAt: clock().toISOString(), lastPracticedAt: null }]); }),
    update: (original, patch, expected) => enqueue(async () => {
      const current = await read();
      ensureRevision(current, expected);
      const index = current.entries.findIndex((e) => normalizeWordKey(e.word) === normalizeWordKey(original));
      if (index < 0) throw new Error("Word not found");
      const { addedAt, lastPracticedAt, ...editable } = current.entries[index];
      const merged = validateEditable({ ...editable, ...patch });
      if (current.entries.some((e, i) => i !== index && normalizeWordKey(e.word) === normalizeWordKey(merged.word))) throw new Error("Word already exists");
      const next = [...current.entries];
      next[index] = { ...merged, addedAt, lastPracticedAt };
      return write(next);
    }),
    remove: (word, expected) => enqueue(async () => { const current = await read(); ensureRevision(current, expected); const next = current.entries.filter((e) => normalizeWordKey(e.word) !== normalizeWordKey(word)); if (next.length === current.entries.length) throw new Error("Word not found"); return write(next); }),
    markPracticed: (words, practicedAt) => enqueue(async () => { const current = await read(); const keys = new Set(words.map(normalizeWordKey)); const updated: string[] = []; const skipped = [...keys]; const next = current.entries.map((entry) => { if (!keys.has(normalizeWordKey(entry.word))) return entry; updated.push(entry.word); skipped.splice(skipped.indexOf(normalizeWordKey(entry.word)), 1); const time = practicedAt.toISOString(); return { ...entry, lastPracticedAt: !entry.lastPracticedAt || entry.lastPracticedAt < time ? time : entry.lastPracticedAt }; }); if (updated.length) await write(next); return { updated, skipped }; }),
  };
}
function snapshot(entries: VocabEntry[]): LibrarySnapshot { return { entries, revision: createHash("sha256").update(JSON.stringify(entries)).digest("hex") }; }
function ensureRevision(current: LibrarySnapshot, expected: string) { if (expected !== current.revision) throw new Error("Revision conflict"); }
function validateStored(input: unknown) { const value = input as Record<string, unknown>; const editable = { word: value.word, partOfSpeech: value.partOfSpeech, meaningZh: value.meaningZh, meaningEn: value.meaningEn, mastery: value.mastery }; validateEditable(editable); if (typeof value.addedAt !== "string" || (value.lastPracticedAt !== null && typeof value.lastPracticedAt !== "string")) throw new Error("Invalid stored dates"); }
