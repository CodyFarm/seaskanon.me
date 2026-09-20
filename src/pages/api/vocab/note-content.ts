import type { APIRoute } from "astro";
import fs from "node:fs";
import { resolveNotePath } from "../../../lib/blog-dir";
import { isAuthenticated } from "../../../lib/vocab-auth";
import { createNoteContentHandler } from "../../../lib/vocab/noteContentApi";

export const prerender = false;

const handle = createNoteContentHandler(
  isAuthenticated,
  (slug) => fs.readFileSync(resolveNotePath(slug), "utf8"),
);

export const GET: APIRoute = ({ request }) => handle(request);
