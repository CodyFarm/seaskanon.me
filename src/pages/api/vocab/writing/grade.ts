import type { APIRoute } from "astro";
import { isAuthenticated } from "../../../../lib/vocab-auth";
import { createLLMClient, getConfiguredLLM } from "../../../../lib/vocab/llmClient";
import { createLibraryStore } from "../../../../lib/vocab/libraryStore";
import { createWritingGradeHandler } from "../../../../lib/vocab/writingGradeApi";
import { resolveVocabDataDir } from "../../../../lib/vocab/dataDir";
export const prerender = false;
export const POST: APIRoute = ({ request }) => createWritingGradeHandler(
  isAuthenticated,
  (messages, options) => createLLMClient(getConfiguredLLM()).complete(messages, 45_000, options),
  (words) => createLibraryStore(resolveVocabDataDir()).markPracticed(words, new Date()),
)(request);
