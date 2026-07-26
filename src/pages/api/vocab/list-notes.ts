/**
 * GET /api/vocab/list-notes
 *
 * 列出 src/content/blog/ 下所有 Markdown 笔记。
 * 返回笔记的 slug、标题、词汇数量、英文单词数、修改时间等信息。
 */

export const prerender = false;

import { isAuthenticated, unauthorizedResponse } from "../../../lib/vocab-auth";
import { getBlogDir, listMarkdownFiles } from "../../../lib/blog-dir";
import fs from "node:fs";
import path from "node:path";

interface NoteInfo {
  slug: string;
  title: string;
  entryCount: number;     // numbered-list entries found
  englishWordCount: number; // total English words in those entries
  mtime: number;           // file modification time (ms)
  isVocabNote: boolean;    // true if likely a vocabulary note
}

export async function GET({ request }: { request: Request }) {
  if (!isAuthenticated(request)) return unauthorizedResponse();

  const blogDir = getBlogDir();
  const files = listMarkdownFiles();

  const notes: NoteInfo[] = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const slug = path
        .relative(blogDir, file)
        .replace(/\\/g, "/")
        .replace(/\.md$/, "");

      const stat = fs.statSync(file);

      // Quick parse: count numbered entries and English words
      const entryRe = /^(\d+)\.\s+(.+?)\s+([一-鿿（].+)$/gm;
      let entryCount = 0;
      let englishWordCount = 0;
      let match;
      while ((match = entryRe.exec(content)) !== null) {
        entryCount++;
        const englishPart = match[2];
        englishWordCount += (englishPart.match(/[a-zA-Z]+/g) || []).length;
      }

      // Extract title from frontmatter
      let title = slug;
      if (content.startsWith("---")) {
        const fmEnd = content.indexOf("---", 4);
        if (fmEnd !== -1) {
          const fm = content.slice(4, fmEnd);
          const titleMatch = fm.match(/^title:\s*(.+)$/m);
          if (titleMatch) title = titleMatch[1].trim();
        }
      }

      // Consider it a vocab note if ≥5 entries with at least 15 English words
      const isVocabNote = entryCount >= 5 && englishWordCount >= 15;

      notes.push({
        slug,
        title,
        entryCount,
        englishWordCount,
        mtime: stat.mtimeMs,
        isVocabNote,
      });
    } catch {
      // Skip files that can't be read
    }
  }

  // Sort: vocab notes first, then by englishWordCount desc
  notes.sort((a, b) => {
    if (a.isVocabNote !== b.isVocabNote) return a.isVocabNote ? -1 : 1;
    return b.englishWordCount - a.englishWordCount;
  });

  return new Response(JSON.stringify(notes), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
