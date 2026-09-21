import { normalizeWordKey, validateEditable, type EditableEntry } from "./libraryRules";
import type { LibraryStore } from "./libraryStore";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const failure = (code: string, message: string, status: number) => json({ error: { code, message } }, status);

export function createLibraryHandler(
  getStore: () => LibraryStore,
  authenticated: (request: Request) => boolean,
  publicOrigin?: string,
) {
  return async (request: Request): Promise<Response> => {
    if (!authenticated(request)) return failure("unauthorized", "请重新登录", 401);
    const method = request.method;
    if (!["GET", "POST", "PATCH", "DELETE"].includes(method)) return failure("method", "不支持此操作", 405);
    let body: Record<string, unknown> = {};
    if (method !== "GET") {
      const expectedOrigin = publicOrigin ?? new URL(request.url).origin;
      if (request.headers.get("origin") !== expectedOrigin) return failure("origin", "请求来源不匹配", 403);
      if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return failure("type", "请使用 JSON 请求", 415);
      try {
        const reader = request.body?.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        if (reader) while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 65536) { await reader.cancel(); return failure("size", "请求过大", 413); }
          chunks.push(value);
        }
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
        const allowed = method === "POST" ? ["entry", "expectedRevision"] : method === "PATCH" ? ["originalWord", "patch", "expectedRevision"] : ["word", "expectedRevision"];
        if (Object.keys(body).some((key) => !allowed.includes(key)) || typeof body.expectedRevision !== "string") throw new Error();
        if (method === "POST") body.entry = validateEditable(body.entry);
        if (method === "PATCH") {
          if (typeof body.originalWord !== "string" || !body.originalWord.trim() || !body.patch || typeof body.patch !== "object" || Array.isArray(body.patch)) throw new Error();
          const patch = body.patch as Record<string, unknown>;
          validateEditable({ word: "example", partOfSpeech: "noun", meaningZh: "示例", meaningEn: "example", mastery: 1, ...patch });
          if (!Object.keys(patch).length) throw new Error();
        }
        if (method === "DELETE" && (typeof body.word !== "string" || !body.word.trim())) throw new Error();
      } catch { return failure("input", "字段或格式无效，请检查输入", 400); }
    }
    try {
      const store = getStore();
      if (method === "GET") return json(await store.read());
      const revision = body.expectedRevision as string;
      if (method === "DELETE") return json({ revision: (await store.remove(body.word as string, revision)).revision });
      const result = method === "POST"
        ? await store.create(body.entry as EditableEntry, revision)
        : await store.update(body.originalWord as string, body.patch as Partial<EditableEntry>, revision);
      const word = method === "POST" ? (body.entry as EditableEntry).word : (body.patch as Partial<EditableEntry>).word ?? body.originalWord as string;
      return json({ entry: result.entries.find((e) => normalizeWordKey(e.word) === normalizeWordKey(word)), revision: result.revision }, method === "POST" ? 201 : 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "Revision conflict") return failure("conflict", "词库已变化，请刷新后确认保存", 409);
      if (message === "Word already exists") return failure("duplicate", "该词已存在", 409);
      if (message === "Word not found") return failure("missing", "该词已被删除，请刷新", 404);
      return failure("storage", "词库暂时不可用，请检查存储配置或稍后重试", 503);
    }
  };
}
