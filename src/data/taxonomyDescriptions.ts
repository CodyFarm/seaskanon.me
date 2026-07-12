export type TaxonomyType = "categories" | "tags" | "series";

export const taxonomyDescriptions: Record<TaxonomyType, Record<string, string>> = {
  categories: {
    // slug: "描述文本"
    // 示例：
    // "travel": "关于旅行、城市漫游与文化观察的随笔。",
  },
  tags: {
    // slug: "描述文本"
  },
  series: {
    // slug: "描述文本"
  },
};

export function getTaxonomyDescription(type: TaxonomyType, slug: string): string | undefined {
  return taxonomyDescriptions[type][slug];
}
