import type { AlertDataset, EnrichedAlert } from '../types/index.js';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateHtml(dataset: AlertDataset): string {
  const { metadata, alerts } = dataset;

  const datasetJson = JSON.stringify(dataset).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Transit Alert Mirror | Plain-English Transit Advisories</title>
  <meta name="description" content="Plain-English transit alert, detour, and service advisory enrichment mirror." />
  <link rel="alternate" type="application/rss+xml" title="Transit Alert Mirror RSS" href="feed.xml" />
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --card-border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --critical: #ef4444;
      --critical-bg: rgba(239, 68, 68, 0.15);
      --moderate: #f59e0b;
      --moderate-bg: rgba(245, 158, 11, 0.15);
      --minor: #64748b;
      --minor-bg: rgba(100, 116, 139, 0.15);
      --action-bg: #1e3a5f;
      --action-border: #0284c7;
      --radius: 12px;
      --font: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }

    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f8fafc;
        --card-bg: #ffffff;
        --card-border: #e2e8f0;
        --text: #0f172a;
        --text-muted: #64748b;
        --accent: #0284c7;
        --critical: #dc2626;
        --critical-bg: #fee2e2;
        --moderate: #d97706;
        --moderate-bg: #fef3c7;
        --minor: #475569;
        --minor-bg: #f1f5f9;
        --action-bg: #e0f2fe;
        --action-border: #38bdf8;
      }
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      line-height: 1.5;
      padding: 1.5rem;
      min-height: 100vh;
    }

    .container {
      max-width: 1100px;
      margin: 0 auto;
    }

    header {
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--card-border);
    }

    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }

    h1 {
      font-size: 1.85rem;
      font-weight: 800;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .subtitle {
      color: var(--text-muted);
      margin-top: 0.25rem;
      font-size: 0.95rem;
    }

    .links-bar {
      display: flex;
      gap: 0.75rem;
      font-size: 0.85rem;
    }

    .links-bar a {
      color: var(--accent);
      text-decoration: none;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }

    .links-bar a:hover {
      text-decoration: underline;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 0.75rem;
      margin-top: 1.25rem;
    }

    .stat-box {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius);
      padding: 0.85rem;
      text-align: center;
    }

    .stat-val {
      font-size: 1.5rem;
      font-weight: 800;
      line-height: 1.2;
    }

    .stat-lbl {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-top: 0.2rem;
    }

    .stat-critical .stat-val { color: var(--critical); }
    .stat-moderate .stat-val { color: var(--moderate); }
    .stat-minor .stat-val { color: var(--accent); }

    .controls-panel {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
      align-items: center;
      justify-content: space-between;
    }

    .search-input {
      flex: 1;
      min-width: 250px;
      padding: 0.65rem 1rem;
      border-radius: 8px;
      border: 1px solid var(--card-border);
      background: var(--card-bg);
      color: var(--text);
      font-size: 0.95rem;
    }

    .filter-buttons {
      display: flex;
      gap: 0.4rem;
    }

    .btn-filter {
      padding: 0.5rem 0.85rem;
      border-radius: 8px;
      border: 1px solid var(--card-border);
      background: var(--card-bg);
      color: var(--text);
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
      transition: all 0.2s;
    }

    .btn-filter.active {
      background: var(--accent);
      color: #0f172a;
      border-color: var(--accent);
    }

    .alerts-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .alert-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius);
      padding: 1.25rem;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .alert-card:hover {
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    }

    .alert-card.sev-Critical { border-left: 6px solid var(--critical); }
    .alert-card.sev-Moderate { border-left: 6px solid var(--moderate); }
    .alert-card.sev-Minor { border-left: 6px solid var(--minor); }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }

    .card-title {
      font-size: 1.15rem;
      font-weight: 700;
      line-height: 1.35;
    }

    .badge-sev {
      display: inline-block;
      padding: 0.25rem 0.6rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .badge-Critical { background: var(--critical-bg); color: var(--critical); }
    .badge-Moderate { background: var(--moderate-bg); color: var(--moderate); }
    .badge-Minor { background: var(--minor-bg); color: var(--minor); }

    .meta-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-bottom: 0.75rem;
    }

    .route-pill {
      background: rgba(56, 189, 248, 0.15);
      color: var(--accent);
      padding: 0.15rem 0.5rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .meta-pill {
      background: rgba(148, 163, 184, 0.15);
      color: var(--text-muted);
      padding: 0.15rem 0.5rem;
      border-radius: 6px;
      font-size: 0.75rem;
    }

    .card-summary {
      font-size: 0.95rem;
      margin-bottom: 0.85rem;
      color: var(--text);
    }

    .rider-action-box {
      background: var(--action-bg);
      border: 1px solid var(--action-border);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      margin-bottom: 0.85rem;
      display: flex;
      gap: 0.6rem;
      align-items: flex-start;
    }

    .action-icon {
      font-size: 1.1rem;
      line-height: 1;
    }

    .action-text {
      font-size: 0.9rem;
      font-weight: 600;
    }

    .detour-box {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-bottom: 0.75rem;
      background: rgba(0,0,0,0.1);
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
    }

    .stops-info {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-bottom: 0.75rem;
    }

    details {
      margin-top: 0.75rem;
      font-size: 0.8rem;
      color: var(--text-muted);
      border-top: 1px dashed var(--card-border);
      padding-top: 0.5rem;
    }

    details summary {
      cursor: pointer;
      user-select: none;
      font-weight: 600;
      color: var(--accent);
    }

    pre {
      background: rgba(0,0,0,0.25);
      padding: 0.5rem;
      border-radius: 6px;
      margin-top: 0.4rem;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: monospace;
    }

    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--text-muted);
      background: var(--card-bg);
      border-radius: var(--radius);
      border: 1px dashed var(--card-border);
    }

    footer {
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--card-border);
      text-align: center;
      color: var(--text-muted);
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-top">
        <div>
          <h1>🚌 Transit Alert Mirror</h1>
          <div class="subtitle">Real-time plain-English transit advisories, detours, and rider actions</div>
        </div>
        <div class="links-bar">
          <a href="feed.xml" target="_blank">📡 RSS Feed</a>
          <a href="../data/alerts.json" target="_blank">📦 Raw JSON</a>
          <a href="https://github.com/aminamos/transit-alert-mirror" target="_blank">💻 GitHub</a>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-val" id="totalCount">${metadata.totalAlerts}</div>
          <div class="stat-lbl">Active Alerts</div>
        </div>
        <div class="stat-box stat-critical">
          <div class="stat-val" id="criticalCount">${metadata.criticalCount}</div>
          <div class="stat-lbl">Critical Closures</div>
        </div>
        <div class="stat-box stat-moderate">
          <div class="stat-val" id="moderateCount">${metadata.moderateCount}</div>
          <div class="stat-lbl">Moderate Detours</div>
        </div>
        <div class="stat-box stat-minor">
          <div class="stat-val" id="minorCount">${metadata.minorCount}</div>
          <div class="stat-lbl">Minor Advisories</div>
        </div>
        <div class="stat-box">
          <div class="stat-val" id="routesCount">${metadata.affectedRoutesCount}</div>
          <div class="stat-lbl">Routes Affected</div>
        </div>
      </div>
    </header>

    <div class="controls-panel">
      <input type="text" id="searchInput" class="search-input" placeholder="Search by route, street, stop #, or keyword..." />
      <div class="filter-buttons">
        <button class="btn-filter active" data-filter="All">All (<span id="btnCountAll">${metadata.totalAlerts}</span>)</button>
        <button class="btn-filter" data-filter="Critical">🚨 Critical (<span id="btnCountCrit">${metadata.criticalCount}</span>)</button>
        <button class="btn-filter" data-filter="Moderate">⚠️ Moderate (<span id="btnCountMod">${metadata.moderateCount}</span>)</button>
        <button class="btn-filter" data-filter="Minor">ℹ️ Minor (<span id="btnCountMin">${metadata.minorCount}</span>)</button>
      </div>
    </div>

    <main id="alertsContainer" class="alerts-list">
      <!-- Dynamic alert cards rendered here -->
    </main>

    <footer>
      Updated ${metadata.generatedAt} • Covering ${metadata.agencies.join(', ')} • Open Source MIT
    </footer>
  </div>

  <script>
    const dataset = ${datasetJson};
    let currentFilter = 'All';
    let searchQuery = '';

    const container = document.getElementById('alertsContainer');
    const searchInput = document.getElementById('searchInput');
    const filterButtons = document.querySelectorAll('.btn-filter');

    function renderAlerts() {
      const query = searchQuery.toLowerCase().trim();
      const filtered = dataset.alerts.filter(alert => {
        const matchesSeverity = currentFilter === 'All' || alert.severity === currentFilter;
        if (!matchesSeverity) return false;

        if (!query) return true;
        const haystack = [
          alert.title,
          alert.summary,
          alert.riderAlternative || '',
          alert.affectedRoutes.join(' '),
          alert.direction,
          alert.intersections.join(' '),
          alert.closedStopIds.join(' '),
          (alert.closedStopDetails || []).map(d => d.name || '').join(' ')
        ].join(' ').toLowerCase();

        return haystack.includes(query);
      });

      if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><h3>No matching transit advisories found</h3><p>Try refining your search keyword or clearing the filter.</p></div>';
        return;
      }

      container.innerHTML = filtered.map(alert => {
        const sevClass = 'sev-' + alert.severity;
        const badgeClass = 'badge-' + alert.severity;
        const routePills = alert.affectedRoutes.map(r => '<span class="route-pill">' + escapeHtml(r) + '</span>').join('');
        const dirPill = '<span class="meta-pill">' + escapeHtml(alert.direction) + '</span>';
        const timePill = alert.activePeriod?.textDescription
          ? '<span class="meta-pill">' + escapeHtml(alert.activePeriod.textDescription) + '</span>'
          : '';

        let actionBlock = '';
        if (alert.riderAlternative) {
          actionBlock = \`
            <div class="rider-action-box">
              <span class="action-icon">💡</span>
              <div class="action-text">\${escapeHtml(alert.riderAlternative)}</div>
            </div>
          \`;
        }

        let detourBlock = '';
        if (alert.detourDetails) {
          detourBlock = \`
            <div class="detour-box">
              <strong>Detour Route:</strong> \${escapeHtml(alert.detourDetails)}
            </div>
          \`;
        }

        let stopsBlock = '';
        if (alert.closedStopIds && alert.closedStopIds.length > 0) {
          const names = alert.closedStopDetails && alert.closedStopDetails.length > 0
            ? alert.closedStopDetails.map(s => s.name ? \`\${s.name} (#\${s.id})\` : \`#\${s.id}\`).slice(0, 6).join(', ')
            : alert.closedStopIds.map(id => '#' + id).slice(0, 6).join(', ');
          const extra = alert.closedStopIds.length > 6 ? \` (+\${alert.closedStopIds.length - 6} more)\` : '';
          stopsBlock = \`
            <div class="stops-info">
              <strong>Closed Stops:</strong> \${escapeHtml(names)}\${extra}
            </div>
          \`;
        }

        let detailsBlock = '';
        if (alert.rawHeader || alert.rawDescription) {
          detailsBlock = \`
            <details>
              <summary>Raw Dispatcher Message</summary>
              \${alert.rawHeader ? '<p style="margin-top:0.4rem;"><strong>Header:</strong> ' + escapeHtml(alert.rawHeader) + '</p>' : ''}
              \${alert.rawDescription ? '<pre>' + escapeHtml(alert.rawDescription) + '</pre>' : ''}
            </details>
          \`;
        }

        return \`
          <article class="alert-card \${sevClass}">
            <div class="card-header">
              <div class="card-title">\${escapeHtml(alert.title)}</div>
              <span class="badge-sev \${badgeClass}">\${escapeHtml(alert.severity)}</span>
            </div>
            <div class="meta-tags">
              \${routePills}
              \${dirPill}
              \${timePill}
            </div>
            <div class="card-summary">\${escapeHtml(alert.summary)}</div>
            \${actionBlock}
            \${detourBlock}
            \${stopsBlock}
            \${detailsBlock}
          </article>
        \`;
      }).join('');
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderAlerts();
    });

    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.getAttribute('data-filter');
        renderAlerts();
      });
    });

    renderAlerts();
  </script>
</body>
</html>`;
}
