/**
 * POST /api/vocab/save
 *
 * 保存生成的练习册或丰富后的笔记到文件系统。
 *
 * Body:
 *   mode: "exercise" | "enrich"
 *   slug: string (源笔记 slug)
 *   content: string (要写入的 Markdown 内容)
 *   title?: string (练习册标题，仅 exercise 模式需要)
 */

export const prerender = false;

import { isAuthenticated, unauthorizedResponse } from "../../../lib/vocab-auth";
import { parseVocabNote, buildMarkdown } from "../../../lib/vocab-parser";
import { getBlogDir, resolveNotePath, sanitizeSlug } from "../../../lib/blog-dir";
import fs from "node:fs";

const BLOG_DIR = getBlogDir();

/** 防止目录遍历攻击 */
function safePath(slug: string): string {
  return resolveNotePath(slug);
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST({ request }: { request: Request }) {
  if (!isAuthenticated(request)) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { mode, slug, content, title, originalSlug } = body;

    if (!mode || !slug || !content) {
      return json(
        { error: "Missing required fields: mode, slug, content" },
        400,
      );
    }

    if (mode === "enrich") {
      // ── 覆盖原笔记，或（改名时）另存为新文件 ──
      const cleanSlug = sanitizeSlug(slug);
      if (!cleanSlug) return json({ error: "Invalid slug (empty after sanitization)" }, 400);
      const targetPath = safePath(cleanSlug);
      const origSlug = originalSlug ? sanitizeSlug(originalSlug) : cleanSlug;

      let frontmatter: string;
      if (cleanSlug === origSlug) {
        // 未改名：覆盖原文件，保留原 frontmatter
        if (!fs.existsSync(targetPath)) {
          return json({ error: `Original note not found: ${cleanSlug}` }, 404);
        }
        frontmatter = parseVocabNote(
          fs.readFileSync(targetPath, "utf-8"),
          cleanSlug,
        ).frontmatter;
      } else {
        // 改名：另存为新文件，拒绝覆盖其他已存在的文件
        if (fs.existsSync(targetPath)) {
          return json({ error: `文件已存在: ${cleanSlug}` }, 409);
        }
        const origPath = safePath(origSlug);
        if (fs.existsSync(origPath)) {
          // 原文件还在 → 复用其 frontmatter
          frontmatter = parseVocabNote(
            fs.readFileSync(origPath, "utf-8"),
            origSlug,
          ).frontmatter;
        } else {
          // 原文件已不存在 → 生成最小 frontmatter
          const today = new Date().toISOString().split("T")[0];
          const t = title || cleanSlug;
          frontmatter = `---
pubDate: ${today}
title: ${t}
categories: vocab-studio
draft: false
---`;
        }
      }

      // LLM 返回的是完整的笔记内容（含标题等），我们只提取 body 部分
      let bodyContent = content;

      // 如果 LLM 返回的内容包含 frontmatter，去除它
      if (bodyContent.startsWith("---")) {
        const fmEnd = bodyContent.indexOf("---", 4);
        if (fmEnd !== -1) {
          bodyContent = bodyContent.slice(fmEnd + 3).trim();
        }
      }

      // 如果 LLM 返回的内容以 # 标题开头，去除它
      bodyContent = bodyContent.replace(/^#\s+.+?\n+/m, "").trim();

      const finalMarkdown = buildMarkdown(frontmatter, bodyContent);
      fs.writeFileSync(targetPath, finalMarkdown, "utf-8");

      return json({ ok: true, path: `${cleanSlug}.md`, mode: "enrich" }, 200);
    } else if (mode === "exercise") {
      // ── 保存为新博客文章（slug 即完整文件名，客户端可自由改名）──
      const cleanSlug = sanitizeSlug(slug);
      if (!cleanSlug) return json({ error: "Invalid slug (empty after sanitization)" }, 400);
      const targetPath = safePath(cleanSlug);

      // Refuse to overwrite an existing file
      if (fs.existsSync(targetPath)) {
        return json({ error: `文件已存在: ${cleanSlug}` }, 409);
      }

      const today = new Date().toISOString().split("T")[0];
      const t = title || cleanSlug;

      // Build the full markdown file — frontmatter MUST NOT have leading
      // whitespace, so the template literal starts flush-left.
      const fullContent =
`---
tags:
  - IELTS
pubDate: ${today}
title: ${t}
description: 词汇练习册 — 自动生成
categories: vocab-studio
series: IELTS writing vocabulary
draft: false
---

${content}
`;
      fs.writeFileSync(targetPath, fullContent, "utf-8");

      console.log(`[vocab save] exercise → ${targetPath} (${Buffer.byteLength(fullContent, "utf-8")} bytes)`);

      return json({ ok: true, path: `${cleanSlug}.md`, mode: "exercise" }, 200);
    } else {
      return json({ error: "Invalid mode. Use 'exercise' or 'enrich'" }, 400);
    }
  } catch (err: any) {
    console.error("[vocab save]", err);
    return json({ error: err.message || "Save failed" }, 500);
  }
}
