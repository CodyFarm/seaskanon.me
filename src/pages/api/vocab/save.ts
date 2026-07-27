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
import { getBlogDir, resolveNotePath } from "../../../lib/blog-dir";
import fs from "node:fs";

const BLOG_DIR = getBlogDir();

/** 防止目录遍历攻击 */
function safePath(slug: string): string {
  return resolveNotePath(slug);
}

export async function POST({ request }: { request: Request }) {
  if (!isAuthenticated(request)) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { mode, slug, content } = body;

    if (!mode || !slug || !content) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: mode, slug, content" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (mode === "enrich") {
      // ── 直接覆盖原文件 ──
      const targetPath = safePath(slug);

      if (!fs.existsSync(targetPath)) {
        return new Response(
          JSON.stringify({ error: `Original note not found: ${slug}` }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        );
      }

      // 读取原文件的 frontmatter
      const original = fs.readFileSync(targetPath, "utf-8");
      const parsed = parseVocabNote(original, slug);

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

      const finalMarkdown = buildMarkdown(parsed.frontmatter, bodyContent);
      fs.writeFileSync(targetPath, finalMarkdown, "utf-8");

      return new Response(
        JSON.stringify({ ok: true, path: `${slug}.md`, mode: "enrich" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    } else if (mode === "exercise") {
      // ── 保存为新博客文章 ──
      const exerciseSlug = `${slug}-练习册`;

      // Refuse to overwrite an existing exercise workbook
      if (fs.existsSync(resolveNotePath(exerciseSlug))) {
        return new Response(
          JSON.stringify({ error: `练习册已存在: ${exerciseSlug}` }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      }

      const today = new Date().toISOString().split("T")[0];
      const title = body.title || `${slug} 练习册`;

      // Build the full markdown file — frontmatter MUST NOT have leading
      // whitespace, so the template literal starts flush-left.
      const fullContent =
`---
tags:
  - IELTS
pubDate: ${today}
title: ${title}
description: 词汇练习册 — 自动生成
categories: list
series: IELTS writing vocabulary
draft: false
---

${content}
`;
      const targetPath = resolveNotePath(exerciseSlug);
      fs.writeFileSync(targetPath, fullContent, "utf-8");

      console.log(`[vocab save] exercise → ${targetPath} (${Buffer.byteLength(fullContent, "utf-8")} bytes)`);

      return new Response(
        JSON.stringify({
          ok: true,
          path: `${exerciseSlug}.md`,
          mode: "exercise",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid mode. Use 'exercise' or 'enrich'" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
  } catch (err: any) {
    console.error("[vocab save]", err);
    return new Response(
      JSON.stringify({ error: err.message || "Save failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
