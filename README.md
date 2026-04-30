# Architectural RDM-Pipeline

Visual RDF dataset editor: load **SHACL** profiles, connect them to **CSV** files
or **Airtable** tables via a drag-and-drop mapping canvas, and export validated
RDF graphs.

## Features

- **Setup mode** — upload SHACL profiles (`.ttl`); `owl:imports` are resolved
  automatically against `https://w3id.org/...` and cached in IndexedDB. Bundles
  the [NFDI4Ing RO-kit](https://w3id.org/nfdi4ing/profiles/) Collection-Dataset
  and Class-Partition profiles out of the box.
- **Mapping mode** — Vue-Flow canvas with auto-layout (Dagre). Drag from a CSV
  column handle to a SHACL property handle to create a mapping edge.
- **Data mode** — generate Turtle from the current mapping using `rdflib`.
- **Export mode** — bundle the resolved profiles, source tables, mapping
  definition, generated TTL and a README into a downloadable ZIP.
- **Airtable integration** — multi-base support via Personal Access Token,
  metadata API for table discovery, automatic pagination, AES-GCM encrypted
  credential storage in IndexedDB.

## Stack

- Vue 3.5 + TypeScript 5.6 (strict, `<script setup>`)
- Vite 5 (hash-routed SPA, suitable for static hosting)
- Pinia · Vue Router 4
- PrimeVue 4 (Aura theme) + PrimeIcons
- Vue Flow 1.41 + `@dagrejs/dagre` for canvas auto-layout
- `rdflib` 2 for SHACL parsing & RDF serialisation
- `papaparse` for CSV ingestion
- `localforage` for IndexedDB persistence
- `jszip` for export bundles
- Vitest + happy-dom for tests

## Repository layout

```
src/
├── assets/profiles/   bundled SHACL profiles (raw .ttl, imported via Vite ?raw)
├── components/        AppShell, setup-mode panels, mapping-mode nodes
├── domain/            DataSource, NodeShape (SHACL parser), Mapping, rdfConstants
├── router/            hash-routed mode definitions
├── services/          ProfileResolver, AirtableService, RDF generator, layout, …
├── stores/            Pinia stores (project / data / shapes / mapping)
├── styles/            global SCSS + design tokens
├── views/             one component per mode (Setup, Mapping, Data, Export)
├── App.vue            root layout
└── main.ts            Pinia + router + PrimeVue bootstrap
Testfiles/             developer reference data (not bundled)
public/                static assets (favicon)
```

## Getting started

```bash
npm install
npm run dev          # http://localhost:5173/
npm run type-check
npm run build
npm run preview
npm run test         # run unit tests once
```

Recommended runtime: Node.js 20.x. That matches the GitHub Pages workflow.

## GitHub Pages deployment

The `main` branch is deployed to GitHub Pages through
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

The production base path is derived automatically from the GitHub repository
name during the workflow run via `GITHUB_REPOSITORY`. For this repository that
means the generated site is built for `/ardmp/`.

The workflow also attempts to create or initialize the GitHub Pages site
automatically via `actions/configure-pages` if the repository does not have a
Pages site yet.

If the repository name changes later, the Pages build keeps working without a
code change as long as the workflow still runs in the target repository.

### Repository settings

In GitHub, open **Settings -> Pages** and set **Source** to **GitHub Actions**.

### Local Pages validation

Regular local builds use `/` as the base path:

```bash
npm run build
npm run preview
```

To validate the GitHub Pages asset paths locally, build with an explicit Pages
base path override.

POSIX shells:

```bash
VITE_BASE_PATH=/ardmp/ npm run build
```

PowerShell:

```powershell
$env:VITE_BASE_PATH = '/ardmp/'
npm run build
Remove-Item Env:VITE_BASE_PATH
```

After that build, the generated `dist/index.html` should reference assets below
`/ardmp/`.

### Workflow summary

The deploy workflow currently does this:

- installs dependencies with `npm ci`
- runs `npm run type-check`
- runs `npm run build`
- uploads `dist/` as the Pages artifact
- publishes with `actions/deploy-pages`

## License

MIT — see [`LICENSE`](LICENSE).
