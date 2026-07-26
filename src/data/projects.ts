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
  tx?: number;  // micro-shift X in px for free-form layout
  ty?: number;  // micro-shift Y in px for free-form layout
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

// Numbered placeholder for context images — large digit so you can
// identify each slot at a glance while adjusting layouts.
function numberedPlaceholder(num: number, bg: string, fg = "#1a1a1a"): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">
    <rect width="320" height="200" fill="${bg}"/>
    <text x="160" y="115" dominant-baseline="middle" text-anchor="middle" fill="${fg}" font-family="sans-serif" font-size="80" font-weight="900">${num}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// 15 colours evenly spaced on the hue wheel
const PALETTE = Array.from({ length: 15 }, (_, i) => `hsl(${(i * 24) % 360} 75% 78%)`);

// ── Context image helpers ──
function ctx(
  col: number,
  row: number,
  colSpan = 1,
  rowSpan = 1,
  tx = 0,
  ty = 0
): ContextImage {
  return { col, row, colSpan, rowSpan, tx, ty };
}

function proj(
  index: number,
  col: number,
  row: number,
  context: ContextImage[]
): Project {
  const title = `project${String(index).padStart(2, "0")}`;
  const color = PALETTE[index - 1];
  // slightly lighter tint for context chips so they stand apart from the cover
  const ctxBg = `hsl(${(index * 24) % 360} 60% 86%)`;
  return {
    id: title,
    title,
    href: "/blog/whoIsThatguy",
    cover: placeholderSvg(title, color),
    color,
    col,
    row,
    context: context.map((c, i) => ({
      ...c,
      delay: i * 100,
      src: numberedPlaceholder(i + 1, ctxBg),
    })),
  };
}

// ── Micro-shift sets — 7 pairs per project for organic "scattered" feel ──
// Each set of 7 (tx, ty) pairs is rotated across images 0–6.
type ShiftSet = [number, number, number, number, number, number, number];
const txSet: ShiftSet = [-5, 4, -3, 6, -7, 3, -2];
const tySet: ShiftSet = [3, -6, 5, -4, 2, -5, -3];

const s = (i: number): [number, number] => [txSet[i % 7], tySet[i % 7]];

// ═══════════════════════════════════════════════
// 15 projects — cover positions & context clusters
// Grid: 7 cols × 5 rows. Title at cols 3-5, rows 2-4.
// Context images use larger spans (2×1 / 1×2 / 2×2)
// so they read visibly larger than project covers.
// ═══════════════════════════════════════════════

export const projects: Project[] = [
  // ─────────────────────────────────────────────
  // 1. Philosopher's Roundtable — cover (1,1)
  //    Real images from /images/projects/project01/
  // ─────────────────────────────────────────────
  {
    id: "roundtable",
    title: "Phils Roundtable",
    href: "/writing/roundtable-tutorial/",
    cover: "/images/projects/project01/roundtableposter.png",
    color: PALETTE[0],
    col: 1,
    row: 1,
    context: [
      { col: 6, row: 1, colSpan: 2, rowSpan: 1, src: "/images/projects/project01/1.avif",  tx: s(0)[0], ty: s(0)[1] },
      { col: 2, row: 1, colSpan: 1, rowSpan: 2, src: "/images/projects/project01/2.avif",  tx: s(1)[0], ty: s(1)[1] },
      { col: 1, row: 3, colSpan: 1, rowSpan: 2, src: "/images/projects/project01/3.avif",  tx: s(2)[0], ty: s(2)[1] },
      { col: 7, row: 2, colSpan: 1, rowSpan: 2, src: "/images/projects/project01/4.jpg",   tx: s(3)[0], ty: s(3)[1] },
      { col: 6, row: 4, colSpan: 2, rowSpan: 1, src: "/images/projects/project01/c3.png",   tx: s(4)[0], ty: s(4)[1] },
      { col: 1, row: 5, colSpan: 2, rowSpan: 1, src: "/images/projects/project01/c9.png",   tx: s(5)[0], ty: s(5)[1] },
      { col: 4, row: 5, colSpan: 2, rowSpan: 1, src: "/images/projects/project01/e1.png",   tx: s(6)[0], ty: s(6)[1] },
    ],
  },

  // ─────────────────────────────────────────────
  // 2. Cover (3,1) — top-centre edge
  // ─────────────────────────────────────────────
  proj(2, 3, 1, [
    ctx(6, 1, 2, 1, ...s(0)),   // top-right wide
    ctx(1, 1, 1, 2, ...s(1)),   // top-left tall
    ctx(7, 2, 1, 2, ...s(2)),   // right tall
    ctx(1, 3, 1, 2, ...s(3)),   // left mid tall
    ctx(6, 4, 2, 1, ...s(4)),   // bottom-right wide
    ctx(1, 5, 2, 1, ...s(5)),   // bottom-left wide
    ctx(5, 5, 2, 1, ...s(6)),   // bottom-centre wide
  ]),

  // ─────────────────────────────────────────────
  // 3. Cover (5,1) — top-centre edge (mirrored)
  // ─────────────────────────────────────────────
  proj(3, 5, 1, [
    ctx(1, 1, 2, 1, ...s(0)),   // top-left wide
    ctx(7, 1, 1, 2, ...s(1)),   // top-right tall
    ctx(1, 3, 1, 2, ...s(2)),   // left tall
    ctx(7, 3, 1, 2, ...s(3)),   // right tall
    ctx(1, 5, 2, 1, ...s(4)),   // bottom-left wide
    ctx(5, 5, 2, 1, ...s(5)),   // bottom-centre wide
    ctx(2, 2, 1, 2, ...s(6)),   // left-upper tall
  ]),

  // ─────────────────────────────────────────────
  // 4. Cover (7,1) — top-right
  // ─────────────────────────────────────────────
  proj(4, 7, 1, [
    ctx(1, 1, 2, 1, ...s(0)),   // top-left wide
    ctx(6, 2, 1, 2, ...s(1)),   // near-right tall
    ctx(2, 3, 1, 2, ...s(2)),   // left tall
    ctx(6, 4, 2, 1, ...s(3)),   // right-bottom wide
    ctx(1, 4, 2, 1, ...s(4)),   // mid-left wide
    ctx(1, 5, 2, 1, ...s(5)),   // bottom-left wide
    ctx(5, 5, 2, 1, ...s(6)),   // bottom-centre wide
  ]),

  // ─────────────────────────────────────────────
  // 5. Cover (1,2) — left mid
  // ─────────────────────────────────────────────
  proj(5, 1, 2, [
    ctx(6, 1, 2, 1, ...s(0)),   // top-right wide
    ctx(2, 1, 1, 2, ...s(1)),   // top-left tall
    ctx(7, 2, 1, 2, ...s(2)),   // right tall
    ctx(6, 4, 2, 1, ...s(3)),   // bottom-right wide
    ctx(1, 5, 2, 1, ...s(4)),   // bottom-left wide
    ctx(5, 5, 2, 1, ...s(5)),   // bottom-centre wide
    ctx(2, 3, 1, 2, ...s(6)),   // left-mid tall
  ]),

  // ─────────────────────────────────────────────
  // 6. Cover (7,2) — right mid
  // ─────────────────────────────────────────────
  proj(6, 7, 2, [
    ctx(1, 1, 2, 1, ...s(0)),   // top-left wide
    ctx(2, 2, 1, 2, ...s(1)),   // top-left tall
    ctx(1, 3, 1, 2, ...s(2)),   // left tall
    ctx(6, 3, 2, 1, ...s(3)),   // mid-right wide
    ctx(1, 5, 2, 1, ...s(4)),   // bottom-left wide
    ctx(5, 5, 2, 1, ...s(5)),   // bottom-centre wide
    ctx(6, 4, 2, 1, ...s(6)),   // bottom-right wide
  ]),

  // ─────────────────────────────────────────────
  // 7. Cover (2,2) — near title, left side
  // ─────────────────────────────────────────────
  proj(7, 2, 2, [
    ctx(6, 1, 2, 1, ...s(0)),   // top-right wide
    ctx(7, 2, 1, 2, ...s(1)),   // top-right tall
    ctx(1, 1, 1, 2, ...s(2)),   // top-left tall
    ctx(6, 4, 2, 1, ...s(3)),   // bottom-right wide
    ctx(1, 4, 2, 1, ...s(4)),   // bottom-left wide
    ctx(1, 5, 2, 1, ...s(5)),   // bottom-left wide
    ctx(5, 5, 2, 1, ...s(6)),   // bottom-centre wide
  ]),

  // ─────────────────────────────────────────────
  // 8. Cover (6,4) — lower-right
  // ─────────────────────────────────────────────
  proj(8, 6, 4, [
    ctx(1, 1, 2, 1, ...s(0)),   // top-left wide
    ctx(2, 2, 1, 2, ...s(1)),   // top-left tall
    ctx(7, 1, 1, 2, ...s(2)),   // right tall
    ctx(1, 3, 1, 2, ...s(3)),   // left tall
    ctx(1, 5, 2, 1, ...s(4)),   // bottom-left wide
    ctx(5, 5, 2, 1, ...s(5)),   // bottom wide
    ctx(6, 2, 1, 2, ...s(6)),   // near-cover tall
  ]),

  // ─────────────────────────────────────────────
  // 9. Cover (1,4) — lower-left
  // ─────────────────────────────────────────────
  proj(9, 1, 4, [
    ctx(6, 1, 2, 1, ...s(0)),   // top-right wide
    ctx(7, 2, 1, 2, ...s(1)),   // right tall
    ctx(2, 1, 1, 2, ...s(2)),   // top-left tall
    ctx(6, 4, 2, 1, ...s(3)),   // right-bottom wide
    ctx(5, 5, 2, 1, ...s(4)),   // bottom-centre wide
    ctx(2, 5, 2, 1, ...s(5)),   // bottom-mid wide
    ctx(2, 3, 1, 2, ...s(6)),   // left-mid tall
  ]),

  // ─────────────────────────────────────────────
  // 10. Cover (7,4) — lower-right edge
  // ─────────────────────────────────────────────
  proj(10, 7, 4, [
    ctx(1, 1, 2, 1, ...s(0)),   // top-left wide
    ctx(2, 2, 1, 2, ...s(1)),   // left-upper tall
    ctx(6, 1, 1, 2, ...s(2)),   // top-right tall
    ctx(1, 3, 1, 2, ...s(3)),   // left tall
    ctx(1, 5, 2, 1, ...s(4)),   // bottom-left wide
    ctx(4, 5, 2, 1, ...s(5)),   // bottom-mid wide
    ctx(6, 5, 2, 1, ...s(6)),   // bottom-right wide
  ]),

  // ─────────────────────────────────────────────
  // 11. Cover (1,5) — bottom-left corner
  // ─────────────────────────────────────────────
  proj(11, 1, 5, [
    ctx(6, 1, 2, 1, ...s(0)),   // top-right wide
    ctx(2, 1, 1, 2, ...s(1)),   // top-left tall
    ctx(7, 2, 1, 2, ...s(2)),   // right tall
    ctx(6, 4, 2, 1, ...s(3)),   // right-bottom wide
    ctx(1, 3, 1, 2, ...s(4)),   // left tall
    ctx(5, 5, 2, 1, ...s(5)),   // bottom-centre wide
    ctx(2, 4, 1, 2, ...s(6)),   // left-mid tall
  ]),

  // ─────────────────────────────────────────────
  // 12. Cover (3,5) — bottom-centre
  // ─────────────────────────────────────────────
  proj(12, 3, 5, [
    ctx(6, 1, 2, 1, ...s(0)),   // top-right wide
    ctx(1, 1, 2, 1, ...s(1)),   // top-left wide
    ctx(7, 2, 1, 2, ...s(2)),   // right tall
    ctx(1, 3, 1, 2, ...s(3)),   // left tall
    ctx(6, 4, 2, 1, ...s(4)),   // right-bottom wide
    ctx(1, 5, 2, 1, ...s(5)),   // bottom-left wide
    ctx(6, 5, 2, 1, ...s(6)),   // bottom-right wide
  ]),

  // ─────────────────────────────────────────────
  // 13. Cover (4,5) — bottom-centre
  // ─────────────────────────────────────────────
  proj(13, 4, 5, [
    ctx(1, 1, 2, 1, ...s(0)),   // top-left wide
    ctx(6, 1, 2, 1, ...s(1)),   // top-right wide
    ctx(7, 2, 1, 2, ...s(2)),   // right tall
    ctx(1, 3, 1, 2, ...s(3)),   // left tall
    ctx(6, 4, 2, 1, ...s(4)),   // right-bottom wide
    ctx(1, 5, 2, 1, ...s(5)),   // bottom-left wide
    ctx(6, 5, 2, 1, ...s(6)),   // bottom-right wide
  ]),

  // ─────────────────────────────────────────────
  // 14. Cover (5,5) — bottom-centre
  // ─────────────────────────────────────────────
  proj(14, 5, 5, [
    ctx(6, 1, 2, 1, ...s(0)),   // top-right wide
    ctx(1, 1, 2, 1, ...s(1)),   // top-left wide
    ctx(7, 2, 1, 2, ...s(2)),   // right tall
    ctx(1, 3, 1, 2, ...s(3)),   // left tall
    ctx(6, 4, 2, 1, ...s(4)),   // right-bottom wide
    ctx(1, 5, 2, 1, ...s(5)),   // bottom-left wide
    ctx(6, 5, 2, 1, ...s(6)),   // bottom-right wide
  ]),

  // ─────────────────────────────────────────────
  // 15. Cover (7,5) — bottom-right corner
  // ─────────────────────────────────────────────
  proj(15, 7, 5, [
    ctx(1, 1, 2, 1, ...s(0)),   // top-left wide
    ctx(2, 2, 1, 2, ...s(1)),   // top-left tall
    ctx(6, 2, 1, 2, ...s(2)),   // near-right tall
    ctx(1, 2, 1, 2, ...s(3)),   // left tall
    ctx(1, 4, 2, 1, ...s(4)),   // mid-left wide
    ctx(1, 5, 2, 1, ...s(5)),   // bottom-left wide
    ctx(5, 5, 2, 1, ...s(6)),   // bottom-centre wide
  ]),
];
