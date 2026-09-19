// store.js — JSON-file persistence layer for Moon Note.
// Keeps all notes in memory and persists to a single JSON file.
// Perfect for a personal knowledge base: simple, fast, no native deps.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const STORE_FILE = join(DATA_DIR, 'notes.json');

/** @type {Array<{id:string,title:string,content:string,tags:string[],folder:string,createdAt:number,updatedAt:number}>} */
let notes = [];

// Ensure the data directory + seed file exist.
function ensureStore() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(STORE_FILE)) {
    notes = seedNotes();
    persist();
  } else {
    try {
      const saved = JSON.parse(readFileSync(STORE_FILE, 'utf-8'));
      notes = Array.isArray(saved) ? saved.map(normalizeNote) : [];
      persist();
    } catch {
      notes = [];
    }
  }
}

function persist() {
  writeFileSync(STORE_FILE, JSON.stringify(notes, null, 2), 'utf-8');
}

// --- backlink scanning -------------------------------------------------
// A wikilink looks like [[Title]] or [[alias|Title]]. We extract targets.
const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

/** Extract all wikilink targets from a note's content. */
export function extractLinks(content) {
  const targets = new Set();
  let m;
  WIKILINK_RE.lastIndex = 0;
  while ((m = WIKILINK_RE.exec(content)) !== null) {
    // support [[alias|Title]] -> take the part after the pipe as target
    const inner = m[1].trim();
    const target = inner.includes('|') ? inner.split('|')[1].trim() : inner;
    if (target) targets.add(target);
  }
  return [...targets];
}

/** Find a note by title (case-insensitive exact match). */
function findByTitle(title) {
  const lower = title.toLowerCase();
  return notes.find((n) => n.title.toLowerCase() === lower);
}

// --- API-facing helpers ------------------------------------------------
export function getAllNotes() {
  return notes.map((n) => ({ ...n }));
}

export function getNote(id) {
  const note = notes.find((n) => n.id === id);
  if (!note) return null;
  // Compute backlinks: every OTHER note that links to this note's title.
  const myTitle = note.title.toLowerCase();
  const backlinks = notes
    .filter((n) => n.id !== id)
    .filter((n) => {
      const targets = extractLinks(n.content).map((t) => t.toLowerCase());
      return targets.includes(myTitle);
    })
    .map((n) => ({ id: n.id, title: n.title, snippet: snippet(n.content) }));
  return { ...note, backlinks };
}

function snippet(content) {
  // strip markdown-y chars for a clean preview
  const text = content
    .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2')
    .replace(/[#>*_`~\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, 140);
}

function normalizeFolder(folder) {
  return String(folder || '').trim() || 'Unfiled';
}

function normalizeTags(tags) {
  return Array.isArray(tags) ? tags : String(tags || '').split(',').map((t) => t.trim()).filter(Boolean);
}

function normalizeNote(note) {
  return {
    ...note,
    tags: normalizeTags(note.tags || []),
    folder: normalizeFolder(note.folder),
  };
}

export function createNote({ title, content, tags = [], folder = 'Unfiled' }) {
  const now = Date.now();
  const note = {
    id: now.toString(36) + Math.random().toString(36).slice(2, 8),
    title: title?.trim() || 'Untitled',
    content: content || '',
    tags: normalizeTags(tags),
    folder: normalizeFolder(folder),
    createdAt: now,
    updatedAt: now,
  };
  notes.push(note);
  persist();
  return note;
}

export function updateNote(id, { title, content, tags, folder }) {
  const note = notes.find((n) => n.id === id);
  if (!note) return null;
  if (title !== undefined) note.title = title.trim() || 'Untitled';
  if (content !== undefined) note.content = content;
  if (tags !== undefined) note.tags = normalizeTags(tags);
  if (folder !== undefined) note.folder = normalizeFolder(folder);
  note.updatedAt = Date.now();
  persist();
  return note;
}

export function deleteNote(id) {
  const idx = notes.findIndex((n) => n.id === id);
  if (idx === -1) return false;
  notes.splice(idx, 1);
  persist();
  return true;
}

export function searchNotes(q) {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  return notes
    .filter(
      (n) =>
        n.title.toLowerCase().includes(query) ||
        n.content.toLowerCase().includes(query) ||
        (n.tags || []).some((t) => t.toLowerCase().includes(query)) ||
        (n.folder || 'Unfiled').toLowerCase().includes(query)
    )
    .map((n) => ({ id: n.id, title: n.title, snippet: snippet(n.content), tags: n.tags, folder: n.folder || 'Unfiled' }));
}

// Build graph data: nodes = notes, links = wikilink relationships.
export function getGraph() {
  const titleToId = new Map();
  notes.forEach((n) => titleToId.set(n.title.toLowerCase(), n.id));

  const nodes = notes.map((n) => {
    const outgoing = extractLinks(n.content);
    return {
      id: n.id,
      title: n.title,
      tags: n.tags || [],
      folder: n.folder || 'Unfiled',
      // count of links this node participates in (set later)
    };
  });

  const links = [];
  const seen = new Set();
  notes.forEach((n) => {
    const targets = extractLinks(n.content);
    targets.forEach((t) => {
      const targetId = titleToId.get(t.toLowerCase());
      if (!targetId) return; // link points to a non-existent note ("ghost")
      const a = n.id;
      const b = targetId;
      if (a === b) return;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      // keep directional but dedupe identical pairs for visual cleanliness
      if (seen.has(key)) return;
      seen.add(key);
      links.push({ source: a, target: b });
    });
  });

  // attach degree to each node
  const degree = new Map();
  links.forEach((l) => {
    degree.set(l.source, (degree.get(l.source) || 0) + 1);
    degree.set(l.target, (degree.get(l.target) || 0) + 1);
  });
  nodes.forEach((n) => (n.degree = degree.get(n.id) || 0));

  return { nodes, links, ghostLinks: collectGhosts(titleToId) };
}

// Notes whose title is referenced via [[ ]] but doesn't exist yet.
function collectGhosts(titleToId) {
  const ghost = new Map(); // title -> count
  notes.forEach((n) => {
    extractLinks(n.content).forEach((t) => {
      if (!titleToId.has(t.toLowerCase())) {
        ghost.set(t, (ghost.get(t) || 0) + 1);
      }
    });
  });
  return [...ghost.entries()].map(([title, count]) => ({ title, count }));
}

export function getStats() {
  return {
    noteCount: notes.length,
    linkCount: getGraph().links.length,
  };
}

// --- seed data ---------------------------------------------------------
function seedNotes() {
  return [
    {
      id: 'seed1moon',
      title: 'Moon Note',
      content: `# Moon Note

Welcome to your **personal knowledge base** — a wiki-style space where ideas link together like constellations.

Write notes in [[Markdown]] and connect them with [[backlinks]] — just wrap a title in double brackets, like \`\`\`[[backlinks]]\`\`\`. Every link becomes a two-way bridge between ideas.

Try these:

- Open the **Graph** view (top-right) to see how your notes connect.
- Glance at the live **moon phase** widget — it tracks the real lunar cycle.
- Search anything from the sidebar.

This is your second brain, lit by moonlight.`,
      tags: ['welcome', 'guide'],
      folder: 'Getting Started',
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
    },
    {
      id: 'seed2md',
      title: 'Markdown',
      content: `# Markdown

A lightweight markup language for formatting plain text. You can use:

- **bold** and *italics*
- \`inline code\` and code blocks
- [links](https://daringfireball.net/projects/markdown/)
- lists, headings, and more

In Moon Note, Markdown is rendered live in the preview pane. Combine it with [[backlinks]] to build a web of [[knowledge]].`,
      tags: ['formatting', 'reference'],
      folder: 'Reference',
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    },
    {
      id: 'seed3back',
      title: 'backlinks',
      content: `# Backlinks

A **backlink** is a reverse connection: if note A links to note B, then note B shows A in its backlinks panel.

This makes knowledge emergent. You don't have to plan the structure — just link as you write, and the connections surface themselves. It's how tools like Roam and Obsidian turn scattered notes into a [[knowledge]] graph.

See the [[Moon Note]] welcome note for an example — it links here, so we appear in its graph neighborhood.`,
      tags: ['concept', 'pkm'],
      folder: 'Concepts',
      createdAt: Date.now() - 1000 * 60 * 60 * 24,
      updatedAt: Date.now() - 1000 * 60 * 60 * 24,
    },
    {
      id: 'seed4know',
      title: 'knowledge',
      content: `# Knowledge

> "The mind is not a vessel to be filled, but a fire to be kindled." — Plutarch

Knowledge in a personal system isn't a filing cabinet — it's a living network. The [[D3 knowledge graph]] in Moon Note visualizes exactly that: each note a star, each [[backlinks|backlink]] a line of light between them.

Start small. Link liberally. Let patterns emerge.`,
      tags: ['philosophy', 'pkm'],
      folder: 'Concepts',
      createdAt: Date.now() - 1000 * 60 * 30,
      updatedAt: Date.now() - 1000 * 60 * 30,
    },
    {
      id: 'seed5d3',
      title: 'D3 knowledge graph',
      content: `# D3 knowledge graph

The graph view in Moon Note is built with [D3.js](https://d3js.org/) — a force-directed visualization where notes repel each other gently while links pull related notes together.

- **Click** a node to open that note.
- **Drag** nodes to rearrange the constellation.
- Node size scales with how many [[backlinks]] connect to it.

It's a map of how your [[knowledge]] is wired together.`,
      tags: ['visualization', 'feature'],
      folder: 'Reference',
      createdAt: Date.now() - 1000 * 60 * 20,
      updatedAt: Date.now() - 1000 * 60 * 20,
    },
  ];
}

ensureStore();
