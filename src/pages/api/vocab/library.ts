import type { APIRoute } from "astro";
import path from "node:path";
import { isAuthenticated } from "@/lib/vocab-auth";
import { createLibraryStore, type LibraryStore } from "@/lib/vocab/libraryStore";
import { createLibraryHandler } from "@/lib/vocab/libraryApi";

export const prerender = false;
let store: LibraryStore | undefined;
const handle = createLibraryHandler(() => {
  if (store) return store;
  const directory = process.env.VOCAB_DATA_DIR || import.meta.env.VOCAB_DATA_DIR;
  if (import.meta.env.PROD && !directory) throw new Error("Missing storage configuration");
  store = createLibraryStore(directory || path.resolve(".local/vocab"));
  return store;
}, isAuthenticated);
export const GET: APIRoute = ({ request }) => handle(request);
export const POST = GET;
export const PATCH = GET;
export const DELETE = GET;
