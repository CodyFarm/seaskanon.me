/**
 * Minimal markdown-to-HTML renderer for runtime-generated posts that
 * aren't in Astro's content collection store.
 *
 * Covers the most common formatting used in LLM-generated exercise
 * workbooks: headings, bold/italic, lists, tables, code blocks, links.
 */
export function renderMarkdown(md: string): string {
  if (!md) return "";

  let html = md;

  // ── Fenced code blocks (must run before inline code) ──
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_: string, lang: string, code: string) => {
    const escaped = escapeHtml(code.trim());
    const cls = lang ? ` class="language-${lang}"` : "";
    return `<pre><code${cls}>${escaped}</code></pre>`;
  });

  // ── Tables ──
  html = html.replace(/^\|(.+)\|\n\|[-:| ]+\|\n((?:^\|.+\|\n?)+)/gm, (_m: string, header: string, body: string) => {
    const thead = `<thead><tr>${header
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => `<th>${c}</th>`)
      .join("")}</tr></thead>`;
    const tbody = `<tbody>${body
      .trim()
      .split("\n")
      .map((row) => {
        return `<tr>${row
          .split("|")
          .map((c) => c.trim())
          .filter(Boolean)
          .map((c) => `<td>${c}</td>`)
          .join("")}</tr>`;
      })
      .join("")}</tbody>`;
    return `<table>${thead}${tbody}</table>`;
  });

  // ── Headings ──
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // ── Horizontal rules ──
  html = html.replace(/^(?:---|\*\*\*|___)\s*$/gm, "<hr>");

  // ── Blockquotes ──
  html = html.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");
  html = html.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");

  // ── Unordered lists ──
  html = html.replace(/((?:^[*-] .+\n?)+)/gm, (block: string) => {
    const items = block
      .trim()
      .split("\n")
      .filter((line) => /^[*-] /.test(line))
      .map((line) => `<li>${line.replace(/^[*-] /, "")}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  });

  // ── Ordered lists ──
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (block: string) => {
    const items = block
      .trim()
      .split("\n")
      .filter((line) => /^\d+\. /.test(line))
      .map((line) => `<li>${line.replace(/^\d+\. /, "")}</li>`)
      .join("");
    return `<ol>${items}</ol>`;
  });

  // ── Bold & italic (inline) ──
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/___(.+?)___/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");

  // ── Images ──
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

  // ── Links ──
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // ── Inline code ──
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // ── Paragraphs: wrap remaining text blocks in <p> ──
  html = html.replace(/\n\n+/g, "\n\n");
  const blocks = html.split("\n\n");
  html = blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      // Skip blocks that are already HTML tags
      if (
        /^<(h[1-6]|ul|ol|li|table|thead|tbody|tr|th|td|pre|blockquote|hr|img|a|strong|em|code|p|div)[^>]*>/i.test(
          trimmed,
        )
      ) {
        return trimmed;
      }
      // Wrap text in <p>
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
