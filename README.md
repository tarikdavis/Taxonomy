# Avios Taxonomy Tree

Visual taxonomy editor for the Avios/IAG hashtag taxonomy. View the tree on GitHub Pages, edit nodes locally with autosaved drafts, and save changes back to GitHub via pull request.

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
VITE_GITHUB_CLIENT_ID=your_oauth_app_client_id
VITE_GITHUB_REPO_OWNER=your-github-username
VITE_GITHUB_REPO_NAME=Taxonomy
```

For local dev, use `VITE_BASE_PATH=/` so assets load from the dev server root.

## Data model

Canonical source of truth: `public/data/taxonomy.json`

The markdown starter file can be re-imported with:

```bash
npm run import
```

## GitHub Pages setup

1. Push this repository to GitHub.
2. In **Settings → Pages**, set source to **GitHub Actions**.
3. Add repository variables (Settings → Secrets and variables → Actions → Variables):
   - `VITE_GITHUB_CLIENT_ID` — OAuth App client ID
4. On push to `main`, the deploy workflow builds and publishes the site.

Site URL: `https://<owner>.github.io/Taxonomy/`

## GitHub OAuth App setup

Create an OAuth App at [GitHub Developer Settings](https://github.com/settings/developers):

| Field | Value |
|-------|-------|
| Application name | Avios Taxonomy Tree |
| Homepage URL | `https://<owner>.github.io/Taxonomy/` |
| Authorization callback URL | `https://<owner>.github.io/Taxonomy/` |

Use the **Client ID** as `VITE_GITHUB_CLIENT_ID`. The app uses **GitHub Device Flow** (no client secret in the browser), which works on static GitHub Pages without a backend.

Add collaborators with write access so they can create pull requests when saving.

## Save workflow

1. Sign in with GitHub.
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
