export interface TaxonomyNode {
  id: string;
  label: string;
  slug: string;
  tags: string[];
  metadata: Record<string, string>;
  status?: 'tbc';
  children: TaxonomyNode[];
}

export interface TaxonomyDocument {
  version: number;
  updatedAt: string;
  root: TaxonomyNode;
}

export interface ArboristNodeData {
  id: string;
  label: string;
  slug: string;
  tags: string[];
  metadata: Record<string, string>;
  status?: 'tbc';
}

let idCounter = 0;

export function resetIdCounter(): void {
  idCounter = 0;
}

export function generateId(prefix = 'node'): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function slugFromTag(tag: string): string {
  return tag.replace(/^#/, '').trim();
}

export function labelFromSlug(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function parseTagsFromLine(line: string): string[] {
  const matches = line.match(/#[\w-]+/g) ?? [];
  return matches.map((tag) => slugFromTag(tag));
}

export function createNode(
  partial: Partial<TaxonomyNode> & Pick<TaxonomyNode, 'label'>,
): TaxonomyNode {
  const slug = partial.slug ?? partial.label.toLowerCase().replace(/\s+/g, '-');
  return {
    id: partial.id ?? generateId(),
    label: partial.label,
    slug,
    tags: partial.tags ?? [slug],
    metadata: partial.metadata ?? {},
    status: partial.status,
    children: partial.children ?? [],
  };
}

export function cloneDocument(doc: TaxonomyDocument): TaxonomyDocument {
  return JSON.parse(JSON.stringify(doc)) as TaxonomyDocument;
}

export function findNode(
  root: TaxonomyNode,
  id: string,
): TaxonomyNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function updateNode(
  root: TaxonomyNode,
  id: string,
  updater: (node: TaxonomyNode) => TaxonomyNode,
): TaxonomyNode {
  if (root.id === id) {
    return updater({ ...root, children: [...root.children] });
  }
  return {
    ...root,
    children: root.children.map((child) => updateNode(child, id, updater)),
  };
}

export function deleteNode(root: TaxonomyNode, id: string): TaxonomyNode {
  if (root.id === id) return root;
  return {
    ...root,
    children: root.children
      .filter((child) => child.id !== id)
      .map((child) => deleteNode(child, id)),
  };
}

export function toArboristData(node: TaxonomyNode): ArboristNodeData & { children?: ArboristNodeData[] } {
  return {
    id: node.id,
    label: node.label,
    slug: node.slug,
    tags: node.tags,
    metadata: node.metadata,
    status: node.status,
    children: node.children.map(toArboristData),
  };
}

export function fromArboristData(
  data: ArboristNodeData & { children?: ArboristNodeData[] },
): TaxonomyNode {
  return {
    id: data.id,
    label: data.label,
    slug: data.slug,
    tags: data.tags,
    metadata: data.metadata,
    status: data.status,
    children: (data.children ?? []).map(fromArboristData),
  };
}

export function flattenNodes(node: TaxonomyNode): TaxonomyNode[] {
  return [node, ...node.children.flatMap(flattenNodes)];
}

export function matchesSearch(node: TaxonomyNode, query: string): boolean {
  const q = query.toLowerCase();
  return (
    node.label.toLowerCase().includes(q) ||
    node.slug.toLowerCase().includes(q) ||
    node.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}

export function emptyDocument(): TaxonomyDocument {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    root: createNode({
      id: 'root',
      label: 'Avios Taxonomy',
      slug: 'avios-taxonomy',
      tags: [],
      metadata: {},
      children: [],
    }),
  };
}
