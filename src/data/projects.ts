// ───────────────────────────────────────────────
// Project data for the context gallery.
// To use real images: put your files in
//   public/images/projects/<project-id>/
// and set `cover` / `context` images to the
// corresponding paths, e.g.:
//   cover: "/images/projects/project01/cover.jpg"
//   context: [
//     { col:2, row:1, src:"/images/projects/project01/ctx-1.jpg" },
//     ...
//   ]
// ───────────────────────────────────────────────

export interface ContextImage {
  col: number;
  row: number;
  colSpan?: number; // default 1
  rowSpan?: number; // default 1
  delay?: number;
  src?: string; // per-image override; falls back to project.cover
}

export interface Project {
  id: string;
  title: string;
  href: string;
  cover: string;
  color: string;
  col: number;
  row: number;
  context: ContextImage[];
}

function placeholderSvg(title: string, bg: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">
    <rect width="320" height="200" fill="${bg}"/>
    <text x="160" y="100" dominant-baseline="middle" text-anchor="middle" fill="#111111" font-family="sans-serif" font-size="28" font-weight="bold">${title}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// 15 colours evenly spaced on the hue wheel
const PALETTE = Array.from({ length: 15 }, (_, i) => `hsl(${(i * 24) % 360} 75% 78%)`);

function ctx(col: number, row: number, colSpan = 1, rowSpan = 1): ContextImage {
  return { col, row, colSpan, rowSpan };
}

function proj(
  index: number,
  col: number,
  row: number,
  context: ContextImage[]
): Project {
  const title = `project${String(index).padStart(2, "0")}`;
  return {
    id: title,
    title,
    href: "/blog/whoIsThatguy",
    cover: placeholderSvg(title, PALETTE[index - 1]),
    color: PALETTE[index - 1],
    col,
    row,
    context: context.map((c, i) => ({ ...c, delay: i * 100 })),
  };
}

// ── 15 projects — cover positions & context clusters ──
// Grid is 7 cols × 5 rows. Central title at cols 3‑5, rows 2‑4 — avoid it.
// To adjust a context image: change its col / row / colSpan / rowSpan.
// colSpan & rowSpan default to 1 (single cell).

export const projects: Project[] = [
  {
    id: "roundtable",
    title: "Philosopher's Roundtable",
    href: "https://roundtable.seaskanon.me",
    cover: placeholderSvg("Roundtable", PALETTE[0]),
    color: PALETTE[0],
    col: 1,
    row: 1,
    context: [
      ctx(7, 5),
      ctx(3, 1, 2),
      ctx(7, 2, 1, 2),
      ctx(1, 4),
      ctx(1, 5),
      ctx(3, 5, 2),
      ctx(1, 2, 1, 2),
    ],
  },
  proj(2, 3, 1, [
    ctx(7, 5),
    ctx(3, 1, 2),
    ctx(7, 2, 1, 2),
    ctx(1, 4),
    ctx(1, 5),
    ctx(3, 5, 2),
    ctx(1, 2, 1, 2),
  ]),
  proj(2, 3, 1, [
    ctx(7, 4),
    ctx(3, 5),
    ctx(2, 4),
    ctx(2, 2, 1, 2),
    ctx(5, 5),
    ctx(7, 5),
    ctx(7, 3),
  ]),
  proj(3, 5, 1, [
    ctx(2, 3, 1, 2),
    ctx(7, 5),
    ctx(4, 5),
    ctx(6, 3),
    ctx(1, 5, 2),
    ctx(6, 5),
    ctx(2, 1, 2),
  ]),
  proj(4, 7, 1, [
    ctx(6, 1),
    ctx(1, 3),
    ctx(2, 1, 1, 2),
    ctx(7, 3),
    ctx(3, 5, 2),
    ctx(5, 5),
    ctx(7, 4),
  ]),
  proj(5, 1, 2, [
    ctx(7, 5),
    ctx(7, 4),
    ctx(2, 4, 1, 2),
    ctx(5, 1, 2),
    ctx(1, 5),
    ctx(3, 1),
    ctx(4, 1),
  ]),
  proj(6, 7, 2, [
    ctx(7, 4),
    ctx(1, 1),
    ctx(7, 1),
    ctx(7, 5),
    ctx(4, 5),
    ctx(3, 1, 2),
    ctx(7, 3),
  ]),
  proj(7, 2, 2, [
    ctx(2, 3),
    ctx(7, 3),
    ctx(6, 4, 2, 2),
    ctx(1, 5, 2),
    ctx(5, 5),
    ctx(7, 2),
    ctx(5, 1, 2),
  ]),
  proj(8, 6, 4, [
    ctx(6, 1, 2),
    ctx(2, 5),
    ctx(1, 5),
    ctx(1, 2, 2, 2),
    ctx(6, 5, 2),
    ctx(2, 1),
    ctx(7, 2, 1, 2),
  ]),
  proj(9, 1, 4, [
    ctx(7, 5),
    ctx(2, 2, 1, 2),
    ctx(5, 1),
    ctx(3, 5, 2),
    ctx(1, 1, 2),
    ctx(6, 3, 2),
    ctx(6, 4),
  ]),
  proj(10, 7, 4, [
    ctx(7, 5),
    ctx(5, 1),
    ctx(2, 2),
    ctx(2, 4),
    ctx(3, 1),
    ctx(5, 5),
    ctx(7, 2, 1, 2),
  ]),
  proj(11, 1, 5, [
    ctx(2, 3),
    ctx(3, 1, 2),
    ctx(2, 2),
    ctx(6, 4, 2),
    ctx(7, 5),
    ctx(7, 1, 1, 2),
    ctx(5, 5, 2),
  ]),
  proj(12, 3, 5, [
    ctx(6, 1),
    ctx(1, 2, 2),
    ctx(4, 1),
    ctx(7, 5),
    ctx(5, 1),
    ctx(6, 2, 2),
    ctx(1, 4),
  ]),
  proj(13, 4, 5, [
    ctx(7, 5),
    ctx(6, 5),
    ctx(6, 4),
    ctx(2, 4),
    ctx(3, 5),
    ctx(5, 1, 2),
    ctx(6, 2),
  ]),
  proj(14, 5, 5, [
    ctx(7, 4),
    ctx(7, 3),
    ctx(3, 1, 2),
    ctx(6, 4),
    ctx(2, 1, 1, 2),
    ctx(7, 1, 1, 2),
    ctx(3, 5, 2),
  ]),
  proj(15, 7, 5, [
    ctx(2, 3, 1, 2),
    ctx(6, 4, 1, 2),
    ctx(6, 2),
    ctx(4, 5),
    ctx(4, 1),
    ctx(2, 1, 2),
    ctx(1, 3, 1, 2),
  ]),
];
