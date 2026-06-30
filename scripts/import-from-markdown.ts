import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createNode,
  generateId,
  labelFromSlug,
  parseTagsFromLine,
  resetIdCounter,
  type TaxonomyDocument,
  type TaxonomyNode,
} from '../src/lib/taxonomy';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const markdownPath = join(rootDir, 'Avios Taxonomy Starter.md');
const outputPath = join(rootDir, 'public', 'data', 'taxonomy.json');

function headingLevel(line: string): number | null {
  const match = line.match(/^(#{2,6})\s+(.+)$/);
  if (!match) return null;
  return match[1].length;
}

function headingLabel(line: string): string | null {
  const match = line.match(/^#{2,6}\s+(.+)$/);
  return match ? match[1].trim() : null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const tag of tags) {
    const fixed = tag === 'shop-onine' ? 'shop-online' : tag;
    if (!seen.has(fixed)) {
      seen.add(fixed);
      normalized.push(fixed);
    }
  }
  return normalized;
}

function primaryLabelFromTags(tags: string[]): string {
  const skip = new Set([
    'partner',
    'merchant',
    'tier-1',
    'tier-2',
    'tier-3',
    'tier-4',
    'financial-services',
    'travel',
    'shop-online',
    'collect-avios',
    'manage-avios',
    'spend-avios',
    'british-airways',
    'aer-lingus',
  ]);
  const primary = [...tags].reverse().find((tag) => !skip.has(tag));
  return primary ? labelFromSlug(primary) : labelFromSlug(tags[tags.length - 1] ?? 'tag');
}

function metadataFromTags(tags: string[]): Record<string, string> {
  const metadata: Record<string, string> = {};
  const tier = tags.find((tag) => /^tier-\d$/.test(tag));
  if (tier) metadata.tier = tier;
  if (tags.includes('partner')) metadata.type = 'partner';
  if (tags.includes('merchant')) metadata.type = 'merchant';
  if (tags.includes('british-airways')) metadata.opco = 'british-airways';
  if (tags.includes('aer-lingus')) metadata.opco = 'aer-lingus';
  if (tags.includes('financial-services')) metadata.category = 'financial-services';
  return metadata;
}

function addChild(parent: TaxonomyNode, child: TaxonomyNode): void {
  parent.children.push(child);
}

function parseMarkdown(content: string): TaxonomyDocument {
  resetIdCounter();
  const root = createNode({
    id: 'root',
    label: 'Avios Taxonomy',
    slug: 'avios-taxonomy',
    tags: [],
    metadata: {},
    children: [],
  });

  const stack: { level: number; node: TaxonomyNode }[] = [{ level: 1, node: root }];
  const lines = content.split('\n');
  let inTbc = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line === '---') continue;
    if (line.startsWith('|---') || line.startsWith('| Locale')) continue;
    if (line.startsWith('>')) continue;
    if (line.startsWith('---')) continue;

    const level = headingLevel(line);
    if (level) {
      const label = headingLabel(line);
      if (!label) continue;
      inTbc = label.toLowerCase() === 'tbc';

      const section = createNode({
        id: generateId('section'),
        label,
        slug: slugify(label),
        tags: [slugify(label)],
        metadata: inTbc ? { section: 'tbc' } : {},
        children: [],
      });

      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }
      addChild(stack[stack.length - 1].node, section);
      stack.push({ level, node: section });
      continue;
    }

    if (line.startsWith('|') && line.includes('#')) {
      const tags = parseTagsFromLine(line.replace(/<br>/g, ' '));
      for (const tag of tags) {
        const node = createNode({
          id: generateId('tag'),
          label: labelFromSlug(tag),
          slug: tag,
          tags: [tag],
          metadata: {},
          children: [],
        });
        addChild(stack[stack.length - 1].node, node);
      }
      continue;
    }

    if (line.startsWith('#')) {
      const tags = normalizeTags(parseTagsFromLine(line));
      if (tags.length === 0) continue;

      const node = createNode({
        id: generateId('tag'),
        label: primaryLabelFromTags(tags),
        slug: tags[tags.length - 1],
        tags,
        metadata: metadataFromTags(tags),
        children: [],
      });
      addChild(stack[stack.length - 1].node, node);
      continue;
    }

    if (inTbc && line.length > 0) {
      const node = createNode({
        id: generateId('tbc'),
        label: line,
        slug: slugify(line),
        tags: [],
        metadata: {},
        status: 'tbc',
        children: [],
      });
      addChild(stack[stack.length - 1].node, node);
    }
  }

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    root,
  };
}

const markdown = readFileSync(markdownPath, 'utf-8');
const document = parseMarkdown(markdown);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf-8');
console.log(`Wrote ${outputPath}`);
