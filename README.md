# 🚌 Transit Alert Mirror

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-39%20Passing-brightgreen.svg)](#-unit-tests)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Live Dashboard](https://img.shields.io/badge/Live-Cloudflare%20Worker-orange.svg)](https://transit-alert-mirror.a-8c6.workers.dev)

> Automated plain-English transit alert, detour, and service advisory enrichment engine and multi-platform publisher (Markdown, GitHub Pages, RSS, JSON, and Cloudflare Workers).

---

## 📌 The Problem: Unstructured Transit Alerts

Transit dispatchers write alerts under time pressure using cryptic internal jargon, all-caps shouting, and agency shorthand:
```text
NB RTE 21 DETOUR OFF LAKE ST AT CHICAGO AVE DUE TO POLICE ACTIVITY. BOARD AT LAKE & 10TH. STOPS CLOSED: #1234, #1235.
```

For riders trying to get to work or school, these raw feeds cause unnecessary confusion:
1. **Shouting & Acronyms**: Dispatcher acronyms (`NB`, `SB`, `TWP X-ING`, `PNR`, `DTR`, `RESUME REG RTE`) and uppercase typography make alerts hostile on mobile screens.
2. **Missing Actionable Guidance**: Riders need to know immediately: *"Where do I board?"* rather than wading through turn-by-turn bus navigation maneuvers.
3. **No Normalized Entities**: Critical information like route numbers, affected stop IDs, and cross streets are buried in unstructured text.

---

## 💡 The Solution: `transit-alert-mirror`

`transit-alert-mirror` is an intelligent transit alert enrichment engine that ingests raw transit feeds (GTFS-RT / agency APIs), extracts entities with domain heuristics, normalizes text into natural English, and publishes clean multi-format feeds:

```
                  ┌────────────────────────────────────────────────────────┐
                  │             Raw Transit Feed (GTFS-RT / APIs)          │
                  │   (e.g., Metro Transit, svc.metrotransit.org/alerts)   │
                  └──────────────────────────┬─────────────────────────────┘
                                             │
                                             ▼
                                  ┌────────────────────┐
                                  │      fetcher       │
                                  └──────────┬─────────┘
                                             │
                                             ▼
                                  ┌────────────────────┐
                                  │      enricher      │
                                  │  • textCleaner     │
                                  │  • heuristics & NLP│
                                  └──────────┬─────────┘
                                             │
                                             ▼
                         ┌───────────────────┴───────────────────┐
                         │               generator               │
                         └───────┬───────────┬───────────┬───────┘
                                 │           │           │
                     ┌───────────▼┐     ┌────▼─────┐    ┌▼─────────────┐
                     │ ALERTS.md  │     │data/     │    │ docs/        │
                     │ (Markdown) │     │alerts.json    │ index.html   │
                     │            │     │          │    │ & feed.xml   │
                     └────────────┘     └──────────┘    └──────────────┘
                                             │
                                             ▼
                                ┌─────────────────────────┐
                                │   Cloudflare Workers    │
                                │   & GitHub Actions      │
                                └─────────────────────────┘
```

---

## 🔍 Before & After Enrichment

### Before (Raw Dispatcher Alert)
```text
NB RTE 21 DETOUR OFF LAKE ST AT CHICAGO AVE DUE TO POLICE ACTIVITY. BOARD AT LAKE & 10TH. STOPS CLOSED: #1234, #1235.
```

### After (Enriched Entity Output)
- **Title**: `Route 21: Detour via Lake St & Chicago Ave`
- **Severity**: `Moderate` (Detour / Reroute)
- **Direction**: `Northbound`
- **Affected Routes**: `Route 21`
- **Intersections**: `Lake St & Chicago Ave`
- **Closed Stop IDs**: `#1234`, `#1235`
- **💡 Rider Action**: `Board at Lake & 10th`
- **Summary**: `Northbound Route 21 detour off Lake St at Chicago Ave due to police activity.`

---

## ✨ Features

- **Ingestion & Extensibility**:
  - Out-of-the-box support for Metro Transit (`https://svc.metrotransit.org/alerts/all`).
  - Pluggable `AlertFetcher` interface to easily add any agency or GTFS-RT feed.
- **NLP & Heuristic Enrichment**:
  - **Unshouting Engine**: Intelligent sentence-casing that preserves transit brands (`METRO Blue Line`), route suffixes (`11A`), and street designations (`44th St W`).
  - **Acronym Expansion**: Decodes `NB/SB/EB/WB`, `RTE`, `STN`, `TC`, `X-ING`, `P&R`, `DTR`.
  - **Entity Extraction**: Routes, directions, cross streets, corridors, and specific closed stop IDs.
  - **Actionable Rider Alternatives**: Automatically isolates boarding locations (`Board at [stop]`).
  - **Tri-Level Severity Classification**:
    - 🚨 **Critical**: Full service closures, route suspensions, and trip cancellations.
    - ⚠️ **Moderate**: Detours, reroutes, and individual stop closures.
    - ℹ️ **Minor**: Advisories, elevator/escalator notices, and minor delays.
- **Multi-Format Publishing**:
  - 📄 **`ALERTS.md`**: Human-readable GitHub Markdown mirror with severity badges, routes index, and collapsible dispatcher notes.
  - 📦 **`data/alerts.json`**: Normalized structured JSON data.
  - 🌐 **`docs/index.html`**: Fast, mobile-responsive interactive dashboard for GitHub Pages (with live route search and severity filtering).
  - 📡 **`docs/feed.xml`**: Valid RSS 2.0 XML feed for notification bots and feed readers.
- **Cloudflare Workers Deployment**:
  - Built-in `wrangler.json` and worker entry point (`src/worker/index.ts`) serving live dashboard, JSON API, and RSS with automated edge caching.
- **Automated GitHub Actions**:
  - Hourly scheduled synchronization workflow (`.github/workflows/update-alerts.yml`).

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 20
- npm >= 10

### Installation
```bash
git clone https://github.com/aminamos/transit-alert-mirror.git
cd transit-alert-mirror
npm install
npm run build
```

---

## 💻 CLI Usage

The CLI binary `alert-mirror` provides simple terminal commands:

### 1. Synchronize & Generate Feeds (`sync`)
Downloads the latest alerts, enriches them, and writes `ALERTS.md`, `data/alerts.json`, `docs/index.html`, and `docs/feed.xml`:
```bash
npm run sync
# or using the CLI directly:
npx alert-mirror sync
```

Options:
- `-o, --output <dir>`: Output directory (default: current directory).
- `-a, --agency <name>`: Target a specific agency.
- `--dry-run`: Parse and enrich without writing files to disk.

### 2. Terminal Advisory Viewer (`list`)
Filter and browse active transit alerts right in your shell:
```bash
# View alerts for Route 11
npx alert-mirror list 11

# View only Critical alerts
npx alert-mirror list --severity Critical

# View all routes with a limit
npx alert-mirror list --limit 10
```

### 3. Stream JSON to stdout (`json`)
Export normalized alerts directly into `jq` or downstream pipelines:
```bash
npx alert-mirror json 21 | jq '.[0].riderAlternative'
```

### 4. Interactive NLP Tester (`parse`)
Test how the enrichment engine parses any arbitrary text:
```bash
npx alert-mirror parse "NB RTE 21 DETOUR OFF LAKE ST AT CHICAGO AVE DUE TO POLICE ACTIVITY. BOARD AT LAKE & 10TH. STOPS CLOSED: #1234, #1235."
```

---

## ☁️ Cloudflare Workers Deployment

A ready-to-deploy Cloudflare Worker is provided in `src/worker/index.ts` and `wrangler.json`:

### Live URL
- **Production Dashboard**: [https://transit-alert-mirror.a-8c6.workers.dev](https://transit-alert-mirror.a-8c6.workers.dev)
- **JSON API**: `https://transit-alert-mirror.a-8c6.workers.dev/api/alerts?route=11`
- **RSS Feed**: `https://transit-alert-mirror.a-8c6.workers.dev/feed.xml`
- **Health Check**: `https://transit-alert-mirror.a-8c6.workers.dev/health`

### Deploying Updates
```bash
npx wrangler deploy
```

---

## 🧪 Unit Tests

Run the Vitest test suite covering parser heuristics, text unshouting, generator outputs, and CLI interactions:

```bash
npm test
```

Test coverage includes:
- `test/textCleaner.test.ts`: Shouting detection, acronym expansion, casing rules.
- `test/heuristics.test.ts`: Route parsing, direction detection, closed stop identification, boarding advice extraction, severity calculations.
- `test/fetcher.test.ts`: Agency registry, GTFS-RT translated string normalization.
- `test/generator.test.ts`: Markdown, JSON, HTML dashboard, and RSS generation.
- `test/enricher.test.ts`: End-to-end enrichment pipeline and severity sorting.
- `test/cli.test.ts`: Terminal command verification.

---

## 🤖 GitHub Actions Automation

The repository includes [`.github/workflows/update-alerts.yml`](.github/workflows/update-alerts.yml):
- **Schedule**: Runs hourly at minute 0 (`cron: '0 * * * *'`).
- **Dispatch**: Manual run available via the Actions tab.
- **Workflow**:
  1. Checks out repository.
  2. Builds TypeScript engine.
  3. Runs `alert-mirror sync`.
  4. Detects file changes in `ALERTS.md`, `data/alerts.json`, and `docs/`.
  5. Automatically commits and pushes updates with `[skip ci]`.

---

## 📁 Project Structure

```
transit-alert-mirror/
├── .github/
│   └── workflows/
│       └── update-alerts.yml     # Hourly automated sync workflow
├── data/
│   └── alerts.json               # Normalized JSON alert dataset
├── docs/
│   ├── index.html                # Interactive GitHub Pages dashboard
│   └── feed.xml                  # RSS 2.0 feed
├── src/
│   ├── cli/
│   │   └── index.ts              # Command-line interface
│   ├── enricher/
│   │   ├── heuristics.ts         # Entity extraction & severity logic
│   │   ├── textCleaner.ts        # Acronym expander & unshouting
│   │   └── index.ts              # Enrichment coordinator
│   ├── fetcher/
│   │   ├── base.ts               # Extensible AlertFetcher interface
│   │   ├── metroTransit.ts       # Metro Transit GTFS-RT fetcher
│   │   └── index.ts              # Fetcher registry
│   ├── generator/
│   │   ├── html.ts               # Dashboard HTML generator
│   │   ├── json.ts               # JSON serializer
│   │   ├── markdown.ts           # Markdown (ALERTS.md) generator
│   │   ├── rss.ts                # RSS 2.0 XML generator
│   │   └── index.ts              # Multi-format output coordinator
│   ├── worker/
│   │   └── index.ts              # Cloudflare Worker edge API & dashboard
│   ├── types/
│   │   └── index.ts              # TypeScript type definitions
│   └── index.ts                  # Public library exports
├── test/
│   ├── cli.test.ts
│   ├── enricher.test.ts
│   ├── fetcher.test.ts
│   ├── heuristics.test.ts
│   ├── generator.test.ts
│   └── textCleaner.test.ts
├── ALERTS.md                     # Generated human-readable markdown mirror
├── package.json
├── tsconfig.json
├── wrangler.json                 # Cloudflare Workers configuration
├── LICENSE                       # MIT License
└── README.md
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) - Copyright (c) 2026 Amin.
