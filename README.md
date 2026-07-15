# SHACL Editor

SHACL Editor is a browser-based node editor for loading, resolving and
inspecting SHACL profiles. The application is focused on profile
representation: Turtle files and profiles from the Metadata Profile Service are
loaded into a graph-oriented canvas where NodeShapes and their relationships
can be explored visually.

The current app scope is intentionally narrow. It no longer manages tabular
source data, mapping pipelines, SHACL validation, review dashboards or publish
workflows.

## What You Can Do

- Load SHACL profiles from Turtle files.
- Load SHACL profiles from the Metadata Profile Service.
- Resolve `owl:imports` recursively with local cache support.
- Inspect NodeShapes and references in the node editor canvas.
- Open a SHACL-form-based preview for loaded shapes.
- Save and reload lightweight project snapshots containing the loaded profiles.

## Main Workflow

1. Open the editor view.
2. Load one or more Turtle files or choose a profile from the Metadata Profile Service.
3. Inspect the resulting shape graph in the canvas.
4. Open shape previews to inspect individual nodes in more detail.
5. Save the current profile set as a project snapshot when needed.

## Technology

- Vue 3 and TypeScript
- Vite
- Pinia
- Vue Router
- PrimeVue
- Vue Flow and Dagre
- rdflib
- `@ulb-darmstadt/shacl-form`
- localForage
- Vitest

## Development

Recommended runtime: Node.js 20 or newer.

```bash
npm install
npm run dev
npm run type-check
npm run lint
npm run test
npm run build
```

The local dev server is served by Vite, usually at:

```text
http://localhost:5173/
```

## Repository Layout

```text
src/
  assets/profiles/      bundled SHACL profiles
  components/           app-wide shell and shared UI
  domain/               SHACL domain parsing and model types
  features/mapping/     node editor canvas and profile loading dialogs
  features/shacl/       SHACL form viewer integration
  router/               route definitions
  services/infrastructure/
                        profile import and caching adapters
  services/project/     lightweight project snapshot handling
  stores/               active project and shape stores
  styles/               global SCSS and design tokens
  views/                route-level editor view
```

## Deployment

The app is a static hash-routed SPA and can be deployed to GitHub Pages. The
production base path is derived in `vite.config.ts` from the repository name
when the GitHub Actions workflow runs, so the source code does not hardcode a
Pages path.

The deployment workflow:

- installs dependencies with `npm ci`
- runs type checking
- builds the Vite app
- uploads `dist/`
- deploys through GitHub Pages

For GitHub Pages, set the repository Pages source to **GitHub Actions**.

## Project Status

The project is under active development as a dedicated SHACL profile editor.
Current work is centered on import resolution, canvas representation and shape
inspection rather than end-to-end dataset production.

## License

MIT. See [LICENSE](LICENSE).
