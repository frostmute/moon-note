// server.js — Express API server for Moon Note.
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  getAllNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  searchNotes,
  getGraph,
  getStats,
} from './store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb' }));
app.use(express.static(join(__dirname, 'public')));

// --- API routes --------------------------------------------------------

// List all notes (lightweight: id, title, folder, tags, timestamps)
app.get('/api/notes', (req, res) => {
  const notes = getAllNotes().map((n) => ({
    id: n.id,
    title: n.title,
    tags: n.tags,
    folder: n.folder || 'Unfiled',
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    preview: n.content.slice(0, 80),
  }));
  res.json({ notes });
});

// Single note + computed backlinks
app.get('/api/notes/:id', (req, res) => {
  const note = getNote(req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  res.json({ note });
});

// Create
app.post('/api/notes', (req, res) => {
  const { title, content, tags, folder } = req.body || {};
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  const note = createNote({ title, content, tags, folder });
  res.status(201).json({ note });
});

// Update
app.put('/api/notes/:id', (req, res) => {
  const { title, content, tags, folder } = req.body || {};
  const note = updateNote(req.params.id, { title, content, tags, folder });
  if (!note) return res.status(404).json({ error: 'Note not found' });
  res.json({ note });
});

// Delete
app.delete('/api/notes/:id', (req, res) => {
  const ok = deleteNote(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Note not found' });
  res.json({ ok: true });
});

// Search
app.get('/api/search', (req, res) => {
  const q = String(req.query.q || '');
  res.json({ results: searchNotes(q) });
});

// Graph data
app.get('/api/graph', (req, res) => {
  res.json(getGraph());
});

// Stats
app.get('/api/stats', (req, res) => {
  res.json(getStats());
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  🌙  Moon Note is glowing on http://localhost:${PORT}\n`);
});
