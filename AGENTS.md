# AGENTS.md — Moon Note

Express (ES module) wiki-style personal knowledge base. JSON-file persistence; no DB.

## Essential commands
- `npm start` (only script in package.json)
- `npm install`
- `docker compose up -d --build` / `docker compose down`
- Data lives at `data/notes.json`; ignored by `.gitignore`.

## Architecture
- `server.js`: Express routes (`/api/notes`, search, graph, stats) + static SPA fallback (`public/index.html`).
- `store.js`: In-memory array (`notes`) + `persist()` to JSON. All exports are pure over that array. Backlinks computed on read (`getNote`), not stored.

## Key patterns / gotchas
- Wikilinks: `[[Title]]` or `[[alias|Title]]`. `extractLinks()` splits on `|`, takes right side as target title. Case-insensitive match.
- `getGraph()` builds nodes + directional links; dedupes pairs for visual cleanliness but keeps directional source/target. Ghost links (links to missing notes) returned separately.
- Note IDs: `Date.now()` base36 + random suffix — not UUID.
- `normalizeTags()` accepts array or comma-separated string; `normalizeFolder()` defaults to `'Unfiled'`.
- `express.json({ limit: '5mb' })` set for large notes.
- No tests/lint configured in repo. Don't invent them.
- Only dependency: `express`.
