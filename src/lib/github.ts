import type { TaxonomyDocument } from './taxonomy';

const TOKEN_KEY = 'github-oauth-token';
const REPO_OWNER = import.meta.env.VITE_GITHUB_REPO_OWNER as string | undefined;
const REPO_NAME = import.meta.env.VITE_GITHUB_REPO_NAME as string | undefined;
const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined;
const TAXONOMY_PATH = 'public/data/taxonomy.json';

export interface DeviceAuthSession {
  userCode: string;
  verificationUri: string;
  expiresIn: number;
}

export function isGitHubConfigured(): boolean {
  return Boolean(CLIENT_ID && REPO_OWNER && REPO_NAME);
}

export function getRepoDisplayName(): string {
  if (!REPO_OWNER || !REPO_NAME) return 'repository';
  return `${REPO_OWNER}/${REPO_NAME}`;
}

export function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function clearStoredToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function startDeviceFlow(): Promise<DeviceAuthSession & { poll: () => Promise<string> }> {
  if (!CLIENT_ID) {
    throw new Error('VITE_GITHUB_CLIENT_ID is not configured.');
  }

  const response = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      scope: 'repo',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to start GitHub device authorization.');
  }

  const payload = (await response.json()) as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  };

  const poll = async (): Promise<string> => {
    const deadline = Date.now() + payload.expires_in * 1000;
    let intervalMs = payload.interval * 1000;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));

      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          device_code: payload.device_code,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      });

      const tokenData = (await tokenResponse.json()) as {
        access_token?: string;
        error?: string;
        interval?: number;
      };

      if (tokenData.access_token) {
        sessionStorage.setItem(TOKEN_KEY, tokenData.access_token);
        return tokenData.access_token;
      }

      if (tokenData.error === 'authorization_pending') {
        continue;
      }

      if (tokenData.error === 'slow_down' && tokenData.interval) {
        intervalMs = tokenData.interval * 1000;
        continue;
      }

      throw new Error(tokenData.error ?? 'GitHub authorization failed.');
    }

    throw new Error('GitHub authorization timed out.');
  };

  return {
    userCode: payload.user_code,
    verificationUri: payload.verification_uri,
    expiresIn: payload.expires_in,
    poll,
  };
}

async function githubFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();
  if (!token) {
    throw new Error('Not signed in to GitHub.');
  }

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

export interface RemoteFileInfo {
  sha: string;
  content: string;
}

export async function fetchRemoteTaxonomy(): Promise<{
  document: TaxonomyDocument;
  sha: string;
}> {
  if (!REPO_OWNER || !REPO_NAME) {
    throw new Error('GitHub repository is not configured.');
  }

  const data = await githubFetch<{
    content: string;
    sha: string;
  }>(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/${TAXONOMY_PATH}`);

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
  if (!REPO_OWNER || !REPO_NAME) {
    throw new Error('GitHub repository is not configured.');
  }

  if (!getStoredToken()) {
    throw new Error('Not signed in to GitHub.');
  }

  const branch = `taxonomy/edit-${Date.now()}`;
  const mainRef = await githubFetch<{ object: { sha: string } }>(
    `/repos/${REPO_OWNER}/${REPO_NAME}/git/ref/heads/main`,
  );

  await githubFetch(`/repos/${REPO_OWNER}/${REPO_NAME}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({
      ref: `refs/heads/${branch}`,
      sha: mainRef.object.sha,
    }),
  });

  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(document, null, 2))));

  const commit = await githubFetch<{ commit: { sha: string } }>(
    `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${TAXONOMY_PATH}`,
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
