// Topical photo helper per .claude/rules/visual-content.md v0.6.3.
// Loremflickr only. NEVER picsum.

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) - h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const TAG_BY_ENTITY: Record<string, string> = {
  MenuItem: 'bakery,pastry,cake,vietnam',
  Material: 'baking,ingredient,flour,butter',
  Supplier: 'warehouse,delivery,vietnam',
  Customer: 'person,portrait,vietnam',
  Campaign: 'sale,celebration,bakery',
  Order: 'bakery,pastry,vietnam',
};

export function topicalImageUrl(seed: string, w: number, h: number, entityName?: string): string {
  const tags = (entityName && TAG_BY_ENTITY[entityName]) || 'bakery,vietnam,pastry';
  const lock = simpleHash(seed) || 1;
  return `https://loremflickr.com/${w}/${h}/${encodeURIComponent(tags)}?lock=${lock}`;
}
