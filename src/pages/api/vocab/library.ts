import type { APIRoute } from "astro";
import { isAuthenticated } from "@/lib/vocab-auth";
import { createLibraryStore, type LibraryStore } from "@/lib/vocab/libraryStore";
import { createLibraryHandler } from "@/lib/vocab/libraryApi";
import { resolveVocabDataDir } from "@/lib/vocab/dataDir";

export const prerender = false;
let store: LibraryStore | undefined;
const publicOrigin = import.meta.env.PROD && import.meta.env.SITE
  ? new URL(import.meta.env.SITE).origin
  : undefined;
const handle = createLibraryHandler(() => {
  if (store) return store;
  store = createLibraryStore(resolveVocabDataDir());
  return store;
}, isAuthenticated, publicOrigin);
export const GET: APIRoute = ({ request }) => handle(request);
export const POST = GET;
export const PATCH = GET;
export const DELETE = GET;
