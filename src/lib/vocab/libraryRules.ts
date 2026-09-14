export type Mastery = 1 | 2 | 3 | 4 | 5;

export interface EditableEntry {
  word: string;
  partOfSpeech: string;
  meaningZh: string;
  meaningEn: string;
  mastery: Mastery;
}

export interface VocabEntry extends EditableEntry {
  addedAt: string;
  lastPracticedAt: string | null;
}

export function normalizeWordKey(word: string): string {
  return word.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function validateEditable(input: unknown): EditableEntry {
  if (!input || typeof input !== "object") throw new Error("Invalid entry");
  const value = input as Record<string, unknown>;
  const allowed = ["word", "partOfSpeech", "meaningZh", "meaningEn", "mastery"];
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw new Error("Unknown field");
  for (const key of ["word", "partOfSpeech", "meaningZh", "meaningEn"]) {
    if (typeof value[key] !== "string" || !value[key].trim()) throw new Error(`${key} is required`);
  }
  const limits = { word: 80, partOfSpeech: 40, meaningZh: 200, meaningEn: 300 } as const;
  for (const key of Object.keys(limits) as Array<keyof typeof limits>) {
    if ((value[key] as string).length > limits[key]) throw new Error(`${key} is too long`);
  }
  if (!Number.isInteger(value.mastery) || (value.mastery as number) < 1 || (value.mastery as number) > 5) {
    throw new Error("mastery must be an integer from 1 to 5");
  }
  return { word: value.word as string, partOfSpeech: value.partOfSpeech as string, meaningZh: value.meaningZh as string, meaningEn: value.meaningEn as string, mastery: value.mastery as Mastery };
}
