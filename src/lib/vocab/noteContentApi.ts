type ReadNote = (slug: string) => string;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  },
});

export function createNoteContentHandler(
  authenticated: (request: Request) => boolean,
  readNote: ReadNote,
) {
  return async (request: Request): Promise<Response> => {
    if (!authenticated(request)) return json({ error: "Unauthorized" }, 401);

    const slug = new URL(request.url).searchParams.get("slug")?.trim();
    if (!slug) return json({ error: "请选择要读取的笔记" }, 400);

    try {
      return json({ slug, content: readNote(slug) });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return json({ error: "笔记不存在或已被移动" }, 404);
      }
      return json({ error: "读取笔记失败" }, 500);
    }
  };
}
