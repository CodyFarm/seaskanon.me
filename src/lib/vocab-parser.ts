/**
 * 词汇笔记 Markdown 解析器
 *
 * 支持的格式：
 *   数字. 英文短语 中文释义
 *   数字. 英文短语  中文释义 （备注）
 *   数字. 英文变体1 / 英文变体2  中文释义
 *
 * 子条目（缩进条目，如 juvenile delinquent）被视为前一条的补充信息。
 */

export interface VocabEntry {
  index: number;
  english: string;
  chinese: string;
  notes?: string;
  /** 子条目，如 juvenile delinquent → 青少年犯罪者 */
  subEntries?: VocabEntry[];
}

export interface ParsedNote {
  /** 文件 slug（不含 .md 后缀） */
  slug: string;
  /** 笔记标题（来自 frontmatter） */
  title: string;
  /** 原始 frontmatter 行（用于写回时保留元数据） */
  frontmatter: string;
  /** 解析出的词汇条目 */
  entries: VocabEntry[];
  /** frontmatter 之后、第一个条目之前的原始行 */
  preamble: string;
}

/**
 * Parse a vocabulary markdown note into structured data.
 *
 * Expected frontmatter is standard YAML between --- delimiters.
 * After frontmatter, each line should be one of:
 *   - "数字. 英文 中文"          → new entry
 *   - "   英文 中文" (indented)  → sub-entry of previous
 *   - blank / comment            → preserved as preamble
 */
export function parseVocabNote(markdown: string, slug: string): ParsedNote {
  const lines = markdown.split("\n");

  // ── Extract frontmatter ──
  let fmLines: string[] = [];
  let contentStart = 0;
  if (lines[0]?.trim() === "---") {
    contentStart = 1;
    while (contentStart < lines.length && lines[contentStart].trim() !== "---") {
      fmLines.push(lines[contentStart]);
      contentStart++;
    }
    contentStart++; // skip closing ---
  }

  const frontmatter = "---\n" + fmLines.join("\n") + "\n---";
  const title = fmLines.find((l) => l.startsWith("title:"))?.replace(/^title:\s*/, "").trim() || slug;

  // ── Parse body entries ──
  const entries: VocabEntry[] = [];
  const preambleLines: string[] = [];
  let lastEntry: VocabEntry | null = null;

  // Regex: "1. English phrase 中文释义"
  // Uses CJK character boundary to split English from Chinese
  const ENTRY_RE = /^(\d+)\.\s+(.+?)\s+([一-鿿（　].+)$/;
  // Sub-entry: indented (2+ spaces) with English Chinese pattern
  const SUB_RE = /^\s{2,}(.+?)\s+([一-鿿（].+)$/;
  // Notes in parentheses at end
  const NOTES_RE = /（(.+?)）$/;

  for (let i = contentStart; i < lines.length; i++) {
    const line = lines[i];
    const entryMatch = line.match(ENTRY_RE);

    if (entryMatch) {
      const index = parseInt(entryMatch[1], 10);
      let english = entryMatch[2].trim();
      let chinese = entryMatch[3].trim();

      // Extract notes like "（表示"溺爱" 后面直接加宾语）"
      const notesMatch = chinese.match(NOTES_RE);
      const notes = notesMatch ? notesMatch[1] : undefined;
      if (notes) {
        chinese = chinese.replace(NOTES_RE, "").trim();
      }

      const entry: VocabEntry = { index, english, chinese, notes };
      entries.push(entry);
      lastEntry = entry;
    } else if (lastEntry && SUB_RE.test(line)) {
      // Sub-entry of the previous main entry
      const subMatch = line.match(SUB_RE)!;
      const subEntry: VocabEntry = {
        index: lastEntry.index,
        english: subMatch[1].trim(),
        chinese: subMatch[2].trim(),
      };
      if (!lastEntry.subEntries) lastEntry.subEntries = [];
      lastEntry.subEntries.push(subEntry);
    } else if (line.trim()) {
      preambleLines.push(line);
    }
  }

  return {
    slug,
    title,
    frontmatter,
    entries,
    preamble: preambleLines.join("\n"),
  };
}

/**
 * Convert parsed entries back to a formatted markdown body string.
 * Used for enrichment — the enriched content replaces the original body.
 */
export function entriesToMarkdown(entries: VocabEntry[]): string {
  return entries
    .map((e) => {
      let line = `${e.index}. ${e.english}  ${e.chinese}`;
      if (e.notes) line += ` （${e.notes}）`;
      const subLines = (e.subEntries || []).map(
        (s) => `   ${s.english}  ${s.chinese}`
      );
      return [line, ...subLines].join("\n");
    })
    .join("\n");
}

/**
 * Combine frontmatter + body into a complete markdown file.
 */
export function buildMarkdown(frontmatter: string, body: string): string {
  return frontmatter + "\n" + body + "\n";
}
