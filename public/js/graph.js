// graph.js — D3 force-directed knowledge graph.
// Nodes = notes, links = [[backlink]] edges. Click a node to open it,
// hover to highlight its neighborhood, drag to reposition.

/* global d3 */
export function createGraph(container, { onNodeClick, onNodeEnter, onNodeLeave } = {}) {
  let svg, simulation, linkSel, nodeSel, labelSel, g, zoom;
  let width = 0, height = 0;
  let nodes = [], links = [];
  let highlighted = null;

  async function load() {
    const res = await fetch('/api/graph');
    const data = await res.json();
    // D3 mutates these objects (adds x,y,vx,vy), so keep fresh copies.
    nodes = data.nodes.map((n) => ({ ...n }));
    links = data.links.map((l) => ({ source: l.source, target: l.target }));
    return data;
  }

  function init() {
    width = container.clientWidth;
    height = container.clientHeight;

    svg = d3
      .select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('class', 'graph-svg');

    // defs for glow + gradients
    const defs = svg.append('defs');
    defs
      .append('radialGradient')
      .attr('id', 'nodeGlow')
      .attr('cx', '50%')
      .attr('cy', '50%')
      .attr('r', '50%')
      .selectAll('stop')
      .data([
        [0, 'rgba(200,215,255,0.9)'],
        [1, 'rgba(140,160,220,0)'],
      ])
      .enter()
      .append('stop')
      .attr('offset', (d) => d[0])
      .attr('stop-color', (d) => d[1]);

    g = svg.append('g');
    linkSel = g.append('g').attr('class', 'links').selectAll('line');
    labelSel = g.append('g').attr('class', 'labels').selectAll('text');
    nodeSel = g.append('g').attr('class', 'nodes').selectAll('circle');

    zoom = d3
      .zoom()
      .scaleExtent([0.3, 4])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);

    // pan with background drag (not on a node)
    svg.on('click', (event) => {
      if (event.target.tagName === 'svg' || event.target === container) {
        clearHighlight();
      }
    });
  }

  function radiusFor(deg) {
    return 7 + Math.min(deg, 8) * 1.6;
  }

  function build(data) {
    const colorByTag = {};
    let hue = 200;
    // assign a stable color per tag
    data.nodes.forEach((n) => {
      (n.tags || []).forEach((t) => {
        if (!(t in colorByTag)) {
          colorByTag[t] = `hsl(${hue}, 45%, 70%)`;
          hue = (hue + 47) % 360;
        }
      });
    });

    simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance((d) => 60 + (d.source.degree || 0) * 4)
          .strength(0.5)
      )
      .force('charge', d3.forceManyBody().strength(-220))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force(
        'collide',
        d3.forceCollide().radius((d) => radiusFor(d.degree) + 6)
      )
      .force('x', d3.forceX(width / 2).strength(0.04))
      .force('y', d3.forceY(height / 2).strength(0.04));

    // links
    linkSel = linkSel
      .data(links)
      .enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', 'rgba(160,175,220,0.25)')
      .attr('stroke-width', 1.2);

    // nodes
    const node = nodeSel.data(nodes).enter().append('g').attr('class', 'node');

    node
      .append('circle')
      .attr('class', 'node-hit')
      .attr('r', (d) => radiusFor(d.degree))
      .attr('fill', (d) => {
        const t = (d.tags || [])[0];
        return t ? colorByTag[t] : 'rgba(200,215,255,0.85)';
      })
      .attr('stroke', 'rgba(255,255,255,0.25)')
      .attr('stroke-width', 1.2);

    // glow ring
    node
      .insert('circle', '.node-hit')
      .attr('r', (d) => radiusFor(d.degree) * 1.9)
      .attr('fill', 'url(#nodeGlow)')
      .attr('pointer-events', 'none');

    nodeSel = node.merge(nodeSel);

    // labels (only show for nodes with links, or all if few)
    const few = nodes.length <= 14;
    labelSel = labelSel
      .data(nodes)
      .enter()
      .append('text')
      .attr('class', 'node-label')
      .text((d) => d.title)
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => radiusFor(d.degree) + 14)
      .attr('fill', 'rgba(220,230,255,0.7)')
      .attr('font-size', 11)
      .attr('pointer-events', 'none')
      .style('opacity', (d) => (few || d.degree > 0 ? 1 : 0.35));

    // interactions
    node
      .call(
        d3
          .drag()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      )
      .on('mouseenter', (event, d) => {
        highlight(d);
        onNodeEnter && onNodeEnter(d, event);
      })
      .on('mouseleave', (event, d) => {
        clearHighlight();
        onNodeLeave && onNodeLeave(d, event);
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        onNodeClick && onNodeClick(d);
      });

    simulation.on('tick', () => {
      linkSel
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y);

      nodeSel.attr('transform', (d) => `translate(${d.x},${d.y})`);
      labelSel.attr('x', (d) => d.x).attr('y', (d) => d.y);
    });
  }

  function getNeighbors(d) {
    const ids = new Set([d.id]);
    links.forEach((l) => {
      const s = l.source.id || l.source;
      const t = l.target.id || l.target;
      if (s === d.id) ids.add(t);
      if (t === d.id) ids.add(s);
    });
    return ids;
  }

  function highlight(d) {
    highlighted = d;
    const ids = getNeighbors(d);
    nodeSel.select('.node-hit').attr('opacity', (n) =>
      ids.has(n.id) ? 1 : 0.18
    );
    nodeSel.select('circle:first-child').attr('opacity', (n) =>
      ids.has(n.id) ? 1 : 0.18
    );
    linkSel
      .attr('stroke', (l) =>
        (l.source.id || l.source) === d.id || (l.target.id || l.target) === d.id
          ? 'rgba(180,205,255,0.8)'
          : 'rgba(160,175,220,0.08)'
      )
      .attr('stroke-width', (l) =>
        (l.source.id || l.source) === d.id || (l.target.id || l.target) === d.id
          ? 2
          : 1
      );
    labelSel.attr('opacity', (n) => (ids.has(n.id) ? 1 : 0.15));
  }

  function clearHighlight() {
    if (!highlighted) return;
    highlighted = null;
    nodeSel.select('.node-hit').attr('opacity', 1);
    nodeSel.select('circle:first-child').attr('opacity', 1);
    linkSel
      .attr('stroke', 'rgba(160,175,220,0.25)')
      .attr('stroke-width', 1.2);
    labelSel.attr('opacity', (n) => (n.degree > 0 ? 1 : 0.35));
  }

  async function render() {
    const data = await load();
    init();
    build(data);
    return data;
  }

  async function refresh() {
    // re-fetch and update positions (keeps existing layout feel)
    const data = await load();
    // simplest: clear & rebuild
    d3.select(container).select('svg').remove();
    init();
    build(data);
  }

  function resize() {
    if (!svg) return;
    width = container.clientWidth;
    height = container.clientHeight;
    svg.attr('width', width).attr('height', height);
    if (simulation) {
      simulation
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('x', d3.forceX(width / 2).strength(0.04))
        .force('y', d3.forceY(height / 2).strength(0.04))
        .alpha(0.3)
        .restart();
    }
  }

  return { render, refresh, resize, highlight, clearHighlight };
}
