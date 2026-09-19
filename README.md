<div align="center">

# 🌙 Moon Note

**A lightweight, self-hosted personal knowledge base for connected notes.**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Storage](https://img.shields.io/badge/storage-JSON%20file-7C3AED)](#data-and-backups)

Moon Note combines Markdown, `[[wikilinks]]`, backlinks, folders, a visual knowledge graph, and a live moon-phase widget — all in a small Node.js app with no database to manage.

</div>

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Installation Options](#installation-options)
  - [One-Line Installer](#one-line-installer)
  - [Docker Compose](#docker-compose)
  - [Node.js](#nodejs)
- [Managing the App](#managing-the-app)
- [Data and Backups](#data-and-backups)
- [Configuration](#configuration)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [License](#license)

## Features

| Feature | Description |
| --- | --- |
| **Markdown notes** | Write notes in Markdown with a live Write/Preview workflow. |
| **Wikilinks** | Link notes with `[[Note Title]]` or `[[alias\|Note Title]]`. |
| **Backlinks** | See which notes reference the note you are viewing. |
| **Folders** | Organize notes by folder in the sidebar. |
| **Knowledge graph** | Explore connections between notes with a D3-powered graph. |
| **Moon phase widget** | Track the current lunar phase from inside the app. |
| **Simple persistence** | Notes are stored in `data/notes.json`; no database required. |

## Quick Start

The fastest way to run Moon Note is with Docker:

```bash
curl -fsSL https://raw.githubusercontent.com/frostmute/moon-note/main/install.sh | bash
```

Then open:

```text
http://localhost:3000
```

By default, the installer clones the app to:

```text
~/moon-note
```

## Installation Options

### One-Line Installer

**Requirements:** Git, Docker, and Docker Compose.

```bash
curl -fsSL https://raw.githubusercontent.com/frostmute/moon-note/main/install.sh | bash
```

The installer will:

1. Clone or update the repository.
2. Create the local `data/` directory if needed.
3. Build and start the Docker container.
4. Expose the app at `http://localhost:3000`.

#### Custom directory or port

```bash
curl -fsSL https://raw.githubusercontent.com/frostmute/moon-note/main/install.sh -o install.sh
MOON_NOTE_DIR=/opt/moon-note PORT=8080 bash install.sh
```

Then open:

```text
http://localhost:8080
```

### Docker Compose

```bash
git clone https://github.com/frostmute/moon-note.git
cd moon-note
docker compose up -d --build
```

Open:

```text
http://localhost:3000
```

### Node.js

**Requirements:** Node.js 18+ and npm.

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

## Managing the App

From the Moon Note directory:

```bash
# View logs
docker compose logs -f

# Stop the app
docker compose down

# Start the app
docker compose up -d

# Rebuild and restart
docker compose up -d --build

# Update to the latest version
git pull
docker compose up -d --build
```

If you used the installer, you can update by running:

```bash
bash ~/moon-note/install.sh
```

## Data and Backups

Moon Note stores user notes in a single JSON file:

```text
data/notes.json
```

For the default installer location, that file is:

```text
~/moon-note/data/notes.json
```

Back it up with:

```bash
cd ~/moon-note
cp data/notes.json moon-note-backup-$(date +%Y-%m-%d).json
```

> `data/notes.json` is intentionally ignored by Git so personal notes are not committed to the repository.

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | Host port for the web app. |
| `MOON_NOTE_DIR` | `~/moon-note` | Install directory used by `install.sh`. |
| `MOON_NOTE_REPO_URL` | `https://github.com/frostmute/moon-note.git` | Repository URL used by `install.sh`. |

Examples:

```bash
PORT=8080 docker compose up -d
```

```bash
MOON_NOTE_DIR=/srv/moon-note PORT=8080 bash install.sh
```

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd + N` | Create a new note |
| `Ctrl/Cmd + S` | Save the current note |
| `Esc` | Close the graph view |

## API Reference

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/notes` | List all notes. |
| `GET` | `/api/notes/:id` | Get one note with computed backlinks. |
| `POST` | `/api/notes` | Create a note. |
| `PUT` | `/api/notes/:id` | Update a note. |
| `DELETE` | `/api/notes/:id` | Delete a note. |
| `GET` | `/api/search?q=` | Search notes. |
| `GET` | `/api/graph` | Get graph nodes and links. |
| `GET` | `/api/stats` | Get note statistics. |

## Project Structure

```text
moon-note/
├── Dockerfile
├── docker-compose.yml
├── install.sh
├── package.json
├── server.js
├── store.js
├── data/
│   └── notes.json          # created on first launch; ignored by Git
└── public/
    ├── index.html
    ├── css/
    │   └── style.css
    └── js/
        ├── app.js
        ├── graph.js
        ├── markdown.js
        └── moonphase.js
```

## License

No license has been selected yet. Add a license before distributing or accepting contributions widely.
