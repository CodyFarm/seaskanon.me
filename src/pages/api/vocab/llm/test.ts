import type { APIRoute } from "astro";
import { isAuthenticated } from "../../../../lib/vocab-auth";
import { createLLMClient, getConfiguredLLM } from "../../../../lib/vocab/llmClient";
import { createLLMConnectionHandler } from "../../../../lib/vocab/llmConnectionApi";

export const prerender = false;

export const POST: APIRoute = ({ request }) => createLLMConnectionHandler(
  isAuthenticated,
  getConfiguredLLM,
  (config, messages, options) => createLLMClient(config).complete(messages, 15_000, options),
)(request);
