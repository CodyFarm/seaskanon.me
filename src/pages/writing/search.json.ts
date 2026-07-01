import { buildWritingSearchIndex, getPublishedWriting } from "@/lib/writing";

export const prerender = true;

export async function GET() {
  const posts = await getPublishedWriting();

  return new Response(JSON.stringify(buildWritingSearchIndex(posts)), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
