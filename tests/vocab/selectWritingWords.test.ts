import test from "node:test";
import assert from "node:assert/strict";
import { selectWritingWords } from "../../src/lib/vocab/selectWritingWords";
const now = new Date("2026-09-14T00:00:00.000Z");
const e=(word,mastery,addedAt,lastPracticedAt=null)=>({word,partOfSpeech:"noun",meaningZh:word,meaningEn:word,mastery,addedAt,lastPracticedAt});
const entries=[e("newest",1,"2026-09-13T00:00:00.000Z"),e("review",2,"2026-08-01T00:00:00.000Z"),e("stable",4,"2026-08-01T00:00:00.000Z","2026-09-01T00:00:00.000Z"),e("other",3,"2026-07-01T00:00:00.000Z")];
test("selects unique balanced words with new and stable slots",()=>{const s=selectWritingWords(entries,{targetCount:4,mix:"balanced",now}); assert.equal(s.length,4); assert.equal(new Set(s.map(x=>x.word)).size,4); assert.ok(s.some(x=>x.word==="newest"));});
test("rejects fewer than three words",()=>assert.throws(()=>selectWritingWords(entries.slice(0,2),{targetCount:3,mix:"balanced",now})));
