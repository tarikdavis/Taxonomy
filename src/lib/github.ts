import type { TaxonomyDocument } from './taxonomy';

const TOKEN_KEY = 'github-oauth-token';
const REPO_OWNER = import.meta.env.VITE_GITHUB_REPO_OWNER as string | undefined;
const REPO_NAME = import.meta.env.VITE_GITHUB_REPO_NAME as string | undefined;
const TAXONOMY_PATH = 'public/data/taxonomy.json';

export function isGitHubConfigured(): boolean {
  return Boolean(REPO_OWNER && REPO_NAME);
}

export function getRepoDisplayName(): string {
  if (!REPO_OWNER || !REPO_NAME) return 'repository';
  return `${REPO_OWNER}/${REPO_NAME}`;
}

export function getTokenCreateUrl(): string {
  const repo = REPO_OWNER && REPO_NAME ? `${REPO_OWNER}/${REPO_NAME}` : '';
  if (repo) {
    return `https://github.com/settings/tokens/new?description=Avios%20Taxonomy%20Tree&scopes=repo`;
  }
  return 'https://github.com/settings/tokens/new';
}

export function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token.trim());
}

export function clearStoredToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

async function githubFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API error (${response.status}): ${body}`);
  }

  return response.json() as Promise<T>;
}

export async function validateToken(token: string): Promise<{ login: string }> {
  if (!REPO_OWNER || !REPO_NAME) {
    throw new Error('GitHub repository is not configured.');
  }

  const user = await githubFetch<{ login: string }>('/user', token);
  await githubFetch(`/repos/${REPO_OWNER}/${REPO_NAME}`, token);
  return user;
}

export async function fetchRemoteTaxonomy(): Promise<{
  document: TaxonomyDocument;
  sha: string;
}> {
  const token = getStoredToken();
  if (!token || !REPO_OWNER || !REPO_NAME) {
    throw new Error('Not signed in to GitHub.');
  }

  const data = await githubFetch<{
    content: string;
    sha: string;
  }>(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/${TAXONOMY_PATH}`, token);

  const decoded = atob(data.content.replace(/\n/g, ''));
  return {
    document: JSON.parse(decoded) as TaxonomyDocument,
    sha: data.sha,
  };
}

export interface SaveResult {
  branch: string;
  commitSha: string;
  pullRequestUrl: string;
}

export async function saveTaxonomyViaPullRequest(
  document: TaxonomyDocument,
  remoteSha: string,
  message = 'Update taxonomy tree',
): Promise<SaveResult> {
  const token = getStoredToken();
  if (!token || !REPO_OWNER || !REPO_NAME) {
    throw new Error('Not signed in to GitHub.');
  }

  const branch = `taxonomy/edit-${Date.now()}`;
  const mainRef = await githubFetch<{ object: { sha: string } }>(
    `/repos/${REPO_OWNER}/${REPO_NAME}/git/ref/heads/main`,
    token,
  );

  await githubFetch(`/repos/${REPO_OWNER}/${REPO_NAME}/git/refs`, token, {
    method: 'POST',
    body: JSON.stringify({
      ref: `refs/heads/${branch}`,
      sha: mainRef.object.sha,
    }),
  });

  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(document, null, 2))));

  const commit = await githubFetch<{ commit: { sha: string } }>(
    `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${TAXONOMY_PATH}`,
    token,
    {
      method: 'PUT',
      body: JSON.stringify({
        message,
        content: encoded,
        branch,
        sha: remoteSha,
      }),
    },
  );

  const pullRequest = await githubFetch<{ html_url: string }>(
    `/repos/${REPO_OWNER}/${REPO_NAME}/pulls`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        title: message,
        head: branch,
        base: 'main',
        body: 'Taxonomy tree update created from the visual editor.',
      }),
    },
  );

  return {
    branch,
    commitSha: commit.commit.sha,
    pullRequestUrl: pullRequest.html_url,
  };
}

export async function loadPublishedTaxonomy(): Promise<TaxonomyDocument> {
  const url = `${import.meta.env.BASE_URL}data/taxonomy.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load taxonomy (${response.status}).`);
  }
  return response.json() as Promise<TaxonomyDocument>;
}

export async function fetchPublishedSha(): Promise<string | null> {
  if (!REPO_OWNER || !REPO_NAME || !getStoredToken()) {
    return null;
  }

  try {
    const remote = await fetchRemoteTaxonomy();
    return remote.sha;
  } catch {
    return null;
  }
}
