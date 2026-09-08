# Ant CMS — "a CMS for ants"

Single-file CMS: `index.html`. No build, no deps, no network. Open it from disk.

## Layers (all inside the one file)

1. **Core** (`<script id="antcms-core">`) — pure functions, no DOM, no storage.
   `slugify`, `validate`, `createPage`, `updatePage`, `deletePage`, `findPage`, `render` (tiny markup → safe HTML), `escapeHtml`.
   Every mutation takes `pages[]` and returns a new `pages[]`. Exposed as `AntCMSCore` on `globalThis` and `module.exports`, so `tests.js` can load it in Node.
2. **Store** — `localStorage` key `antcms.pages.v1`, JSON array of pages. Seeds a welcome page on first run.
3. **Router** — hash routes:
   - `#/` home (trail of all pages)
   - `#/p/<slug>` view a page
   - `#/colony` admin list
   - `#/colony/new` create
   - `#/colony/edit/<slug>` edit
4. **UI** — ant-themed: soil/sand palette, marching-ants header, tunnel cards, and an "ant scale" toggle that shrinks the site (the joke).

## Page model

```json
{ "slug": "queen", "title": "The Queen", "body": "text", "createdAt": 0, "updatedAt": 0 }
```

## Body markup (deliberately tiny)

- Blank line separates paragraphs
- `# ` / `## ` headings
- `- ` list items
- `**bold**`, `*italic*`, `[text](https://url)` (http/https/mailto/#only)
- Everything is HTML-escaped first; there is no raw HTML.

## Tests

`node tests.js` — extracts the core script from the HTML and runs assertions with `node:assert`. Zero libraries.
