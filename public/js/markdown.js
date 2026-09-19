// markdown.js — Markdown rendering with [[wikilink]] support.
// Uses markdown-it (CDN) + a custom inline rule that turns [[Title]]
// (and [[alias|Title]]) into clickable internal links.

/* global markdownit */
export function createRenderer() {
  // Prefer markdown-it when the CDN has loaded, but keep the preview usable
  // offline (or when the CDN is blocked) with a small built-in renderer.
  if (!window.markdownit) return createFallbackRenderer();

  const md = window.markdownit({
    html: false,
    linkify: true,
    typographer: true,
    breaks: false,
  });

  // --- wikilink plugin -------------------------------------------------
  // Matches [[Title]] or [[alias|Title]]. Renders as an internal link
  // whose target is the (case-insensitive) note title. The app wires up
  // the click handler via delegation on [data-wikilink].
  md.inline.ruler.before('link', 'wikilink', function (state, silent) {
    const src = state.src.slice(state.pos);
    const match = src.match(/^\[\[([^\]\n]+)\]\]/);
    if (!match) return false;
    if (!silent) {
      const inner = match[1].trim();
      const [alias, target] = inner.includes('|') ? inner.split('|') : [inner, inner];
      const t = state.push('wikilink', '', 0);
      t.meta = { target: target.trim(), display: alias.trim() };
      t.content = alias.trim();
    }
    state.pos += match[0].length;
    return true;
  });

  md.renderer.rules.wikilink = function (tokens, idx) {
    const { target, display } = tokens[idx].meta;
    const enc = encodeURIComponent(target);
    return `<a class="wikilink" data-wikilink="${escAttr(target)}" href="#/n/${enc}">${escHtml(display)}</a>`;
  };

  // Open external links in a new tab.
  const defaultLink =
    md.renderer.rules.link_open ||
    function (tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options);
    };
  md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    const aIndex = tokens[idx].attrIndex('href');
    let href = '';
    if (aIndex >= 0) href = tokens[idx].attrs[aIndex][1] || '';
    if (/^https?:\/\//i.test(href)) {
      tokens[idx].attrSet('target', '_blank');
      tokens[idx].attrSet('rel', 'noopener noreferrer');
      tokens[idx].attrPush(['class', 'ext-link']);
    }
    return defaultLink(tokens, idx, options, env, self);
  };

  return md;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function escAttr(s) {
  return escHtml(s).replace(/"/g, '&quot;');
}

function renderInline(s) {
  return escHtml(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[\[([^\]\n]+)\]\]/g, (_m, inner) => {
      const [alias, target] = inner.includes('|') ? inner.split('|') : [inner, inner];
      const cleanTarget = target.trim();
      return `<a class="wikilink" data-wikilink="${escAttr(cleanTarget)}" href="#/n/${encodeURIComponent(cleanTarget)}">${escHtml(alias.trim())}</a>`;
    })
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a class="ext-link" href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function createFallbackRenderer() {
  return {
    render(content = '') {
      const lines = String(content).replace(/\r\n?/g, '\n').split('\n');
      const out = [];
      let paragraph = [];
      let list = null;
      let inCode = false;
      let code = [];

      const flushParagraph = () => {
        if (paragraph.length) {
          out.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
          paragraph = [];
        }
      };
      const closeList = () => {
        if (list) {
          out.push(`<${list.type}>${list.items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</${list.type}>`);
          list = null;
        }
      };

      for (const line of lines) {
        if (/^```/.test(line)) {
          if (inCode) {
            out.push(`<pre><code>${escHtml(code.join('\n'))}</code></pre>`);
            code = [];
            inCode = false;
          } else {
            flushParagraph();
            closeList();
            inCode = true;
          }
          continue;
        }
        if (inCode) {
          code.push(line);
          continue;
        }
        if (!line.trim()) {
          flushParagraph();
          closeList();
          continue;
        }
        const heading = line.match(/^(#{1,6})\s+(.+)$/);
        if (heading) {
          flushParagraph();
          closeList();
          out.push(`<h${heading[1].length}>${renderInline(heading[2])}</h${heading[1].length}>`);
          continue;
        }
        const quote = line.match(/^>\s?(.+)$/);
        if (quote) {
          flushParagraph();
          closeList();
          out.push(`<blockquote>${renderInline(quote[1])}</blockquote>`);
          continue;
        }
        const bullet = line.match(/^[-*+]\s+(.+)$/);
        const ordered = line.match(/^\d+\.\s+(.+)$/);
        if (bullet || ordered) {
          flushParagraph();
          const type = bullet ? 'ul' : 'ol';
          if (!list || list.type !== type) closeList();
          if (!list) list = { type, items: [] };
          list.items.push((bullet || ordered)[1]);
          continue;
        }
        paragraph.push(line.trim());
      }
      flushParagraph();
      closeList();
      if (inCode) out.push(`<pre><code>${escHtml(code.join('\n'))}</code></pre>`);
      return out.join('\n');
    },
  };
}

// Tiny HTML-escape utility for rendering note content into preview safely.
export function renderNote(md, content) {
  return md.render(content || '');
}
