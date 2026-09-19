# 🌙 Moon Note

Moon Note is a small, self-hosted personal knowledge base with folders, `[[backlinks]]`, Markdown editing, a D3 knowledge graph, and a live moon-phase widget.

It runs as a single Node.js web app and stores notes in one local JSON file. No database required.

## Quick install

### One-line install/run

Requires Git, Docker, and Docker Compose.

```bash
curl -fsSL https://raw.githubusercontent.com/frostmute/moon-note/main/install.sh | bash
```

Then open:

```text
http://localhost:3000
```

The installer clones Moon Note to:

```text
~/moon-note
```

Your notes are stored at:

```text
~/moon-note/data/notes.json
```

### Custom install location or port

```bash
curl -fsSL https://raw.githubusercontent.com/frostmute/moon-note/main/install.sh -o install.sh
MOON_NOTE_DIR=/opt/moon-note PORT=8080 bash install.sh
```

## Manual Docker install

```bash
git clone https://github.com/frostmute/moon-note.git
cd moon-note
docker compose up -d --build
```

Open:

```text
http://localhost:3000
```

Useful commands:

```bash
# View logs
docker compose logs -f

# Stop the app
docker compose down

# Start again
docker compose up -d

# Update
git pull
docker compose up -d --build
```

## Manual Node.js install

Requires Node.js 18+.

```bash
git clone https://github.com/frostmute/moon-note.git
cd moon-note
npm install
npm start
```

Open:

```text
http://localhost:3000
```

You can change the port:

```bash
PORT=8080 npm start
```

## Features

- **Folders** — group notes by folder in the sidebar.
- **Backlinks** — write `[[Note Title]]` or `[[alias|Note Title]]` to connect notes.
- **Markdown** — write Markdown with a live Write/Preview toggle.
- **Knowledge graph** — visualize note relationships with D3.
- **Live moon phase** — real lunar phase widget.
- **No database** — notes persist to `data/notes.json`.

## Backups

Back up this file regularly:

```text
data/notes.json
```

For a Docker install, from the app directory:

```bash
cp data/notes.json moon-note-backup-$(date +%Y-%m-%d).json
```

## Project layout

```text
moon-note/
  Dockerfile           container image definition
  docker-compose.yml   easy self-hosted deployment
  install.sh           one-line installer/updater
  package.json         dependencies and start script
  server.js            Express API and static host
  store.js             JSON-file persistence and backlink/graph logic
  data/notes.json      your notes, created on first launch
  public/
    index.html         app shell
    css/style.css      theme/styles
    js/app.js          app controller
    js/markdown.js     Markdown and wikilinks
    js/moonphase.js    lunar phase renderer
    js/graph.js        D3 force-directed graph
```

## API

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/notes` | List all notes |
| GET | `/api/notes/:id` | Get one note with backlinks |
| POST | `/api/notes` | Create a note |
| PUT | `/api/notes/:id` | Update a note |
| DELETE | `/api/notes/:id` | Delete a note |
| GET | `/api/search?q=` | Search notes |
| GET | `/api/graph` | Graph nodes and links |
| GET | `/api/stats` | Note statistics |

## Shortcuts

- `Ctrl/Cmd + N` — new note
- `Ctrl/Cmd + S` — save
- `Esc` — close graph view

## License

Add your preferred license before publishing widely.
