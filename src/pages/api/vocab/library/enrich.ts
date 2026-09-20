import type { APIRoute } from "astro";
import { isAuthenticated } from "../../../../lib/vocab-auth";
import { createLLMClient, getConfiguredLLM } from "../../../../lib/vocab/llmClient";
import { createWordEnrichmentHandler } from "../../../../lib/vocab/wordEnrichmentApi";

export const prerender = false;

export const POST: APIRoute = ({ request }) => createWordEnrichmentHandler(
  isAuthenticated,
  (messages, options) => createLLMClient(getConfiguredLLM()).complete(messages, 60000, options),
)(request);
