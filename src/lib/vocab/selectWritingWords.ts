import { normalizeWordKey, type VocabEntry } from "./libraryRules";

export type Mix = "balanced" | "review" | "new";
export function selectWritingWords(entries: VocabEntry[], options: { targetCount: number; mix: Mix; now: Date; selectedWords?: string[] }): VocabEntry[] {
  const n = Math.max(3, Math.min(6, Math.trunc(options.targetCount)));
  if (entries.length < 3) throw new Error("Need at least three words");
  if (options.selectedWords) {
    const keys = [...new Set(options.selectedWords.map(normalizeWordKey))];
    if (keys.length < 3 || keys.some((key) => !entries.some((e) => normalizeWordKey(e.word) === key))) throw new Error("Invalid selected words");
    return keys.slice(0, n).map((key) => entries.find((e) => normalizeWordKey(e.word) === key)!);
  }
  const cutoff = options.now.getTime() - 14 * 86400000;
  const fresh = entries.filter((e) => Date.parse(e.addedAt) >= cutoff);
  const weak = entries.filter((e) => e.mastery <= 2);
  const stable = entries.filter((e) => e.mastery >= 4);
  const used = new Set<string>(); const result: VocabEntry[] = [];
  const take = (pool: VocabEntry[], count: number) => { for (const item of [...pool].sort(compare)) { const key = normalizeWordKey(item.word); if (!used.has(key) && result.length < n && count > 0) { used.add(key); result.push(item); count--; } } };
  if (options.mix === "new") take(fresh, Math.min(2, n - 1)); else take(fresh, 1);
  take(weak, options.mix === "review" ? n - result.length : Math.max(0, n - result.length - (stable.length ? 1 : 0)));
  if (options.mix === "balanced") take(stable, 1);
  take(entries, n - result.length);
  return result;
  function compare(a: VocabEntry, b: VocabEntry) { const at = a.lastPracticedAt ? Date.parse(a.lastPracticedAt) : -Infinity; const bt = b.lastPracticedAt ? Date.parse(b.lastPracticedAt) : -Infinity; return at - bt || a.mastery - b.mastery || normalizeWordKey(a.word).localeCompare(normalizeWordKey(b.word)); }
}
