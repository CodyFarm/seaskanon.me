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
import fs from "node:fs";
import path from "node:path";

const BLOG_DIR = path.resolve("src/content/blog");

/** 防止目录遍历攻击 */
function safePath(slug: string): string {
  // Normalize: only allow alphanumeric, Chinese chars, hyphens, underscores, slashes
  const sanitized = slug.replace(/\.\./g, "").replace(/\\/g, "/");
  const fullPath = path.resolve(BLOG_DIR, `${sanitized}.md`);
  // Verify the resolved path stays within BLOG_DIR
  if (!fullPath.startsWith(BLOG_DIR)) {
    throw new Error("Invalid path: directory traversal detected");
  }
  return fullPath;
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
      // 重新组合：原 frontmatter + LLM 生成的主体内容
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

      // Build frontmatter for the new blog post
      const today = new Date().toISOString().split("T")[0];
      const frontmatter = `---
tags:
  - IELTS
pubDate: ${today}
title: ${body.title || slug + " 练习册"}
description: 词汇练习册 — 自动生成
categories: list
series: IELTS writing vocabulary
draft: false
---`;

      const fullContent = buildMarkdown(frontmatter, content);
      const targetPath = safePath(exerciseSlug);
      fs.writeFileSync(targetPath, fullContent, "utf-8");

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
