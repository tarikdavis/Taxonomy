# Taxonomy Tree

Visual taxonomy editor. View the tree on GitHub Pages, edit nodes locally with autosaved drafts, and save changes back to GitHub via pull request.

## Features

- Interactive tree with drag-and-drop reordering and reparenting
- Create, rename, and delete tags
- Node detail panel for tags, status, and metadata
- Search by label, slug, or tag
- Local draft buffer in `localStorage`
- Export JSON backup without signing in
- Save to GitHub via OAuth + pull request (no separate database)

## Local development

```bash
npm install
npm run import
npm run dev
```

Copy `.env.example` to `.env.local` and set:

```env
VITE_BASE_PATH=/
VITE_GITHUB_REPO_OWNER=your-github-username
VITE_GITHUB_REPO_NAME=Taxonomy
```

For local dev, use `VITE_BASE_PATH=/` so assets load from the dev server root.

## Data model

Canonical source of truth: `public/data/taxonomy.json`

The markdown starter file can be re-imported manually when needed:

```bash
npm run import
```

Note: the deploy workflow does **not** run import automatically — `public/data/taxonomy.json` in the repo is always the source of truth.

## GitHub Pages setup

1. Push this repository to GitHub.
2. In **Settings → Pages**, set source to **GitHub Actions**.
3. On push to `main`, the deploy workflow builds and publishes the site.

Site URL: `https://<owner>.github.io/Taxonomy/`

## GitHub sign-in (personal access token)

GitHub OAuth/Device Flow cannot run directly from a static GitHub Pages site (browser CORS blocks `github.com` auth endpoints). Instead, each editor signs in with a **classic personal access token**:

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens) → **Generate new token (classic)**
2. Enable the **`repo`** scope
3. Copy the token (`ghp_...`)
4. In the app, click **Sign in with GitHub** and paste the token

The token is stored in `sessionStorage` for the current browser session only — it is never committed to the repo.

Add collaborators with write access so they can create pull requests when saving.

## Save workflow

1. Sign in with your personal access token.
2. Edit the tree (changes autosave to a local draft).
3. Click **Save to GitHub (PR)**.
4. The app creates branch `taxonomy/edit-<timestamp>`, commits `public/data/taxonomy.json`, and opens a pull request for review.

## Project structure

```
public/data/taxonomy.json   # published taxonomy data
scripts/import-from-markdown.ts
src/components/             # UI components
src/lib/                    # taxonomy, storage, GitHub helpers
```
