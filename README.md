# 🌙 Moon Note

A wiki-style personal knowledge base with folders, `[[backlinks]]`, Markdown,
a D3 knowledge graph, and a live moon-phase widget.

## Run

```bash
npm install
npm start
```

Then open **http://localhost:3000**.

> Requires Node.js 18+. No database — notes persist to `data/notes.json`.
> On first launch it auto-seeds a handful of linked demo notes.

## Features

- **Folders** — set a folder on each note and the sidebar groups notes by it.
  Existing notes without a folder are shown under `Unfiled`.
- **Backlinks** — write `[[Note Title]]` (or `[[alias|Note Title]]`) to link
  notes. Each note's right panel shows every other note that links to it.
  Clicking a link to a note that doesn't exist yet offers to create it.
- **Markdown** — full rendering with a live Write ↔ Preview toggle.
- **D3 knowledge graph** — force-directed map of how your notes connect.
  Click a node to open it, drag to rearrange, scroll to zoom.
- **Live moon phase** — astronomically accurate lunar-phase widget that
  renders the illuminated disk and tracks the real synodic cycle.

## Project layout

```
moon-note/
  package.json        deps + start script
  server.js            Express API + static host
  store.js             JSON-file persistence + backlink/graph logic
  data/notes.json      your notes (auto-created)
  public/
    index.html         app shell
    css/style.css      moonlit dark theme
    js/
      app.js           controller (notes, editor, search, graph)
      markdown.js      markdown-it + [[wikilink]] plugin
      moonphase.js      lunar-phase math + SVG renderer
      graph.js          D3 force-directed graph
```

## API

| Method | Route | Purpose |
|--------|-------|---------|
| GET    | `/api/notes`           | list all notes, including folder metadata |
| GET    | `/api/notes/:id`       | one note + computed backlinks |
| POST   | `/api/notes`           | create (`title`, `content`, `tags`, `folder`) |
| PUT    | `/api/notes/:id`       | update (`title`, `content`, `tags`, `folder`) |
| DELETE | `/api/notes/:id`       | delete |
| GET    | `/api/search?q=`       | full-text search |
| GET    | `/api/graph`           | nodes + links for the graph |

## Shortcuts

- `Ctrl/Cmd + N` — new note
- `Ctrl/Cmd + S` — save
- `Esc` — close graph view
