import type { TaxonomyDocument } from './taxonomy';

const DRAFT_KEY = 'taxonomy-draft';
const SHA_KEY = 'taxonomy-remote-sha';

export function loadDraft(): TaxonomyDocument | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TaxonomyDocument;
  } catch {
    return null;
  }
}

export function saveDraft(doc: TaxonomyDocument): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(doc));
}

export function clearDraft(): void {
  localStorage.removeItem(DRAFT_KEY);
}

export function loadRemoteSha(): string | null {
  return sessionStorage.getItem(SHA_KEY);
}

export function saveRemoteSha(sha: string): void {
  sessionStorage.setItem(SHA_KEY, sha);
}

export function clearRemoteSha(): void {
  sessionStorage.removeItem(SHA_KEY);
}

export function downloadJson(doc: TaxonomyDocument, filename = 'taxonomy.json'): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
