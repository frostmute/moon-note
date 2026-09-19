// app.js — Moon Note main controller. Wires notes, editor, backlinks,
// search, the D3 graph and the live moon-phase widget together.
import { createRenderer, renderNote } from './markdown.js';
import { calculateMoonPhase, moonSVG } from './moonphase.js';
import { createGraph } from './graph.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  notes: [], // sidebar list
  current: null, // full note object (with backlinks)
  view: 'edit', // 'edit' | 'preview'
  graph: null, // graph controller
  showGraph: false,
};

const md = createRenderer();

// --- API helpers ------------------------------------------------------
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

// --- Sidebar ----------------------------------------------------------
async function refreshNotesList() {
  const { notes } = await api('/api/notes');
  state.notes = notes;
  renderSidebar();
}

function renderSidebar() {
  const list = $('#note-list');
  const q = $('#search-input').value.trim().toLowerCase();
  let items = state.notes;
  if (q) {
    items = items.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        (n.folder || 'Unfiled').toLowerCase().includes(q) ||
        (n.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  }
  items = [...items].sort((a, b) => {
    const folderCmp = (a.folder || 'Unfiled').localeCompare(b.folder || 'Unfiled');
    return folderCmp || b.updatedAt - a.updatedAt;
  });

  list.innerHTML = '';
  if (items.length === 0) {
    list.innerHTML = `<li class="empty">${q ? 'No matches.' : 'No notes yet.'}</li>`;
    return;
  }

  let lastFolder = null;
  for (const n of items) {
    const folder = n.folder || 'Unfiled';
    if (folder !== lastFolder) {
      const heading = document.createElement('li');
      heading.className = 'folder-heading';
      heading.textContent = folder;
      list.appendChild(heading);
      lastFolder = folder;
    }

    const li = document.createElement('li');
    li.className = 'note-item' + (state.current?.id === n.id ? ' active' : '');
    li.dataset.id = n.id;
    const date = new Date(n.updatedAt);
    li.innerHTML = `
      <div class="ni-title">${esc(n.title)}</div>
      <div class="ni-meta">
        <span class="ni-date">${fmtDate(date)}</span>
        ${(n.tags || []).slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}
      </div>`;
    li.addEventListener('click', () => openNote(n.id));
    list.appendChild(li);
  }
}

// --- Note open / save / delete ---------------------------------------
async function openNote(id, { edit = false } = {}) {
  try {
    const { note } = await api(`/api/notes/${id}`);
    state.current = note;
    if (!edit) state.view = state.view === 'edit' ? 'edit' : 'preview';
    renderEditor();
    renderSidebar();
    closeGraph();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function openByTitle(title) {
  const lower = title.toLowerCase();
  const found = state.notes.find((n) => n.title.toLowerCase() === lower);
  if (found) {
    openNote(found.id);
  } else {
    // ghost link — offer to create
    if (confirm(`No note titled "${title}". Create it now?`)) {
      const { note } = await api('/api/notes', {
        method: 'POST',
        body: JSON.stringify({ title, content: `# ${title}\n\n`, folder: currentFolder() }),
      });
      await refreshNotesList();
      openNote(note.id);
    }
  }
}

function newNote() {
  state.current = null;
  state.view = 'edit';
  $('#editor-title').value = '';
  $('#editor-folder').value = 'Unfiled';
  $('#editor-tags').value = '';
  editor.setValue('');
  renderBacklinks([]);
  renderEditor();
  $('#editor-title').focus();
}

let saveTimer = null;
function scheduleAutosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveCurrent, 900);
}

async function saveCurrent() {
  const title = $('#editor-title').value.trim();
  const content = editor.getValue();
  const folder = currentFolder();
  const tags = $('#editor-tags').value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  if (!title) {
    toast('A title is required', 'error');
    return;
  }
  if (state.current) {
    // update
    if (
      title === state.current.title &&
      content === state.current.content &&
      folder === (state.current.folder || 'Unfiled') &&
      sameArr(tags, state.current.tags || [])
    ) {
      return; // nothing changed
    }
    try {
      const { note } = await api(`/api/notes/${state.current.id}`, {
        method: 'PUT',
        body: JSON.stringify({ title, content, tags, folder }),
      });
      state.current = note;
      $('#save-status').textContent = 'saved';
      setTimeout(() => ($('#save-status').textContent = ''), 1500);
      await refreshNotesList();
      // refresh backlinks in background
      loadBacklinks(note.id);
    } catch (e) {
      toast(e.message, 'error');
    }
  } else {
    try {
      const { note } = await api('/api/notes', {
        method: 'POST',
        body: JSON.stringify({ title, content, tags, folder }),
      });
      state.current = note;
      $('#save-status').textContent = 'created';
      setTimeout(() => ($('#save-status').textContent = ''), 1500);
      await refreshNotesList();
      loadBacklinks(note.id);
    } catch (e) {
      toast(e.message, 'error');
    }
  }
}

function sameArr(a, b) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function currentFolder() {
  return $('#editor-folder').value.trim() || 'Unfiled';
}

async function deleteCurrent() {
  if (!state.current) return;
  if (!confirm(`Delete "${state.current.title}"? This cannot be undone.`)) return;
  try {
    await api(`/api/notes/${state.current.id}`, { method: 'DELETE' });
    state.current = null;
    await refreshNotesList();
    newNote();
    toast('Note deleted');
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function loadBacklinks(id) {
  try {
    const { note } = await api(`/api/notes/${id}`);
    if (state.current?.id === id) {
      state.current = note;
      renderBacklinks(note.backlinks || []);
    }
  } catch {}
}

// --- Editor / Preview rendering ---------------------------------------
function renderEditor() {
  const note = state.current;
  $('#editor-title').value = note ? note.title : '';
  $('#editor-folder').value = note ? note.folder || 'Unfiled' : 'Unfiled';
  $('#editor-tags').value = note ? (note.tags || []).join(', ') : '';
  if (note) editor.setValue(note.content);
  else editor.setValue('');

  // title + tag inputs always visible; body switches edit/preview
  toggleView(state.view);
  renderBacklinks(note ? note.backlinks || [] : []);
}

function toggleView(view) {
  state.view = view;
  const editBtn = $('#btn-edit');
  const prevBtn = $('#btn-preview');
  editBtn.classList.toggle('active', view === 'edit');
  prevBtn.classList.toggle('active', view === 'preview');
  const editorWrap = $('#editor-wrap');
  const previewWrap = $('#preview');
  if (view === 'edit') {
    editorWrap.style.display = '';
    previewWrap.style.display = 'none';
    editor.refresh();
    editor.focus();
  } else {
    editorWrap.style.display = 'none';
    // The stylesheet hides .preview by default, so clearing the inline
    // display value would keep it hidden. Explicitly show it for preview mode.
    previewWrap.style.display = 'block';
    renderPreview();
  }
}

function renderPreview() {
  const content = editor.getValue();
  const title = $('#editor-title').value || 'Untitled';
  let html;
  try {
    html = renderNote(md, content);
  } catch (e) {
    console.error('Markdown preview failed:', e);
    html = `<p class="muted">Preview failed to render.</p><pre><code>${esc(content)}</code></pre>`;
  }
  $('#preview').innerHTML = `<div class="preview-title">${esc(title)}</div>${html}`;
  wireWikilinks($('#preview'));
}

function renderBacklinks(backlinks) {
  const panel = $('#backlinks');
  if (!backlinks || backlinks.length === 0) {
    panel.innerHTML = `<p class="muted">No backlinks yet. Use <code>[[Title]]</code> to link from other notes.</p>`;
    return;
  }
  panel.innerHTML = '';
  for (const b of backlinks) {
    const item = document.createElement('div');
    item.className = 'backlink';
    item.innerHTML = `
      <div class="bl-title">${esc(b.title)}</div>
      <div class="bl-snippet">${esc(b.snippet)}</div>`;
    item.addEventListener('click', () => openNote(b.id));
    panel.appendChild(item);
  }
}

// Make [[wikilinks]] in preview navigable.
function wireWikilinks(root) {
  root.querySelectorAll('[data-wikilink]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      openByTitle(a.dataset.wikilink);
    });
  });
}

// --- Moon phase widget ------------------------------------------------
function renderMoon() {
  const moon = calculateMoonPhase();
  const svg = moonSVG(new Date(), 104);
  const widget = $('#moon-widget');
  widget.innerHTML = `
    <div class="moon-disk">${svg}</div>
    <div class="moon-info">
      <div class="moon-name">${moon.emoji} ${moon.phaseName}</div>
      <div class="moon-illum">${moon.illumination.toFixed(1)}% lit</div>
      <div class="moon-age">age ${moon.age.toFixed(1)}d · ${moon.waxing ? 'waxing' : 'waning'}</div>
      <div class="moon-next">next full in ${moon.nextFull}d</div>
    </div>`;
}

// --- Graph view -------------------------------------------------------
function openGraph() {
  state.showGraph = true;
  $('#graph-overlay').classList.add('open');
  $('#app').classList.add('blurred');
  const container = $('#graph-canvas');
  // build graph lazily
  if (!state.graph) {
    state.graph = createGraph(container, {
      onNodeClick: (d) => openNote(d.id),
    });
    state.graph.render();
  } else {
    state.graph.refresh();
  }
}

function closeGraph() {
  state.showGraph = false;
  $('#graph-overlay').classList.remove('open');
  $('#app').classList.remove('blurred');
}

// --- Toast ------------------------------------------------------------
function toast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2600);
}

// --- utils ------------------------------------------------------------
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function fmtDate(d) {
  const now = new Date();
  const diff = (now - d) / 86400000;
  if (diff < 1 && d.getDate() === now.getDate())
    return 'today';
  if (diff < 2) return 'yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// --- CodeMirror-style editor (textarea + tab support) ----------------
// Lightweight: a textarea with monospace styling and tab handling.
function makeEditor() {
  const ta = $('#editor-textarea');
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = ta.selectionStart,
        en = ta.selectionEnd;
      ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(en);
      ta.selectionStart = ta.selectionEnd = s + 2;
      scheduleAutosave();
    }
    // Cmd/Ctrl+S to save
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      saveCurrent();
    }
  });
  ta.addEventListener('input', () => {
    scheduleAutosave();
    if (state.view === 'preview') renderPreview();
  });
  return {
    getValue: () => ta.value,
    setValue: (v) => (ta.value = v || ''),
    refresh: () => ta,
    focus: () => ta.focus(),
  };
}
let editor;

// --- init -------------------------------------------------------------
async function init() {
  editor = makeEditor();
  renderMoon();
  // refresh moon every minute (live widget)
  setInterval(renderMoon, 60000);

  // toolbar buttons
  $('#btn-new').addEventListener('click', newNote);
  $('#btn-save').addEventListener('click', saveCurrent);
  $('#btn-delete').addEventListener('click', deleteCurrent);
  $('#btn-edit').addEventListener('click', () => toggleView('edit'));
  $('#btn-preview').addEventListener('click', () => toggleView('preview'));
  $('#btn-graph').addEventListener('click', () => {
    if (state.showGraph) closeGraph();
    else openGraph();
  });
  $('#graph-close').addEventListener('click', closeGraph);

  // title / folder / tag edits
  $('#editor-title').addEventListener('input', () => {
    scheduleAutosave();
    if (state.view === 'preview') renderPreview();
  });
  $('#editor-folder').addEventListener('input', scheduleAutosave);
  $('#editor-tags').addEventListener('input', scheduleAutosave);

  // search
  let searchTimer = null;
  $('#search-input').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      renderSidebar();
      if ($('#search-input').value.trim()) doSearch();
    }, 180);
  });

  // global shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault();
      newNote();
    }
    if (e.key === 'Escape' && state.showGraph) closeGraph();
  });

  // resize graph
  window.addEventListener('resize', () => state.graph?.resize());

  await refreshNotesList();
  // open the welcome note if present
  const welcome = state.notes.find((n) => n.title === 'Moon Note');
  if (welcome) openNote(welcome.id, { edit: false });
  else if (state.notes[0]) openNote(state.notes[0].id, { edit: false });
  else newNote();
}

async function doSearch() {
  const q = $('#search-input').value.trim();
  if (!q) return;
  // already filtered sidebar; this is a fallback full-text on server
  const { results } = await api(`/api/search?q=${encodeURIComponent(q)}`);
  if (!results.length) return;
  // ensure sidebar shows server results too (merge by id)
  const have = new Set(state.notes.map((n) => n.id));
  results.forEach((r) => {
    if (!have.has(r.id)) state.notes.push(r);
  });
  renderSidebar();
}

document.addEventListener('DOMContentLoaded', init);
