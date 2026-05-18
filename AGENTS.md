# ARDMP Agent Guide

This repository is a Vue 3 + TypeScript single-page app for building RDF datasets from SHACL profiles, tabular sources, and dataset metadata.

## Architecture Anchors

- UI shell and route entry points live in [src/App.vue](src/App.vue), [src/main.ts](src/main.ts), [src/router/index.ts](src/router/index.ts), [src/views/AppView.vue](src/views/AppView.vue), [src/views/BrowseView.vue](src/views/BrowseView.vue), and [src/views/ExportView.vue](src/views/ExportView.vue).
- Canvas interaction is still orchestrated from [src/views/AppView.vue](src/views/AppView.vue), but that file should be treated as a refactor hotspot rather than a long-term owner for every workflow.
- Active node rendering currently lives in [src/components/mapping/TableNode.vue](src/components/mapping/TableNode.vue), [src/components/mapping/ShapeNode.vue](src/components/mapping/ShapeNode.vue), [src/components/mapping/GeoNamesNode.vue](src/components/mapping/GeoNamesNode.vue), [src/components/mapping/LobidNode.vue](src/components/mapping/LobidNode.vue), and [src/components/mapping/TransformationNode.vue](src/components/mapping/TransformationNode.vue).
- Persistent state is split across Pinia stores in [src/stores/dataStore.ts](src/stores/dataStore.ts), [src/stores/shapesStore.ts](src/stores/shapesStore.ts), [src/stores/metadataStore.ts](src/stores/metadataStore.ts), [src/stores/mappingStore.ts](src/stores/mappingStore.ts), and [src/stores/projectStore.ts](src/stores/projectStore.ts).
- Core domain models live in [src/domain/NodeShape.ts](src/domain/NodeShape.ts), [src/domain/Mapping.ts](src/domain/Mapping.ts), and [src/domain/DataSource.ts](src/domain/DataSource.ts). Keep them framework-light and stable enough to survive folder reordering.
- Business logic is concentrated in [src/services](src/services). Treat that folder as several emerging modules rather than one generic service bucket: profile/import resolution, mapping/runtime, enrichment, RDF/validation, browse/read-side, export/package generation, and metadata helpers.

## Refactor Direction

- The next large refactor should move the codebase toward explicit module boundaries: app shell/orchestration, core domain, feature modules, and infrastructure adapters.
- Prefer extracting behavior out of [src/views/AppView.vue](src/views/AppView.vue) and broad stores before adding more capabilities to them.
- Future importers and exporters should fit behind clear module seams rather than extending view conditionals or adding more mixed-purpose helpers under [src/services](src/services).
- Persisting project state in the browser is a later phase. Prepare boundaries for IndexedDB-backed persistence, but do not leak persistence concerns into current domain models or view orchestration.

## Working Model

- Treat [src/views/AppView.vue](src/views/AppView.vue) as the current orchestration surface for loading schemas, adding data sources, building the mapping canvas, and triggering node actions. When refactoring, step from there into the store or service that should become the real owner.
- Treat [src/views/BrowseView.vue](src/views/BrowseView.vue) as the read-side for generated RDF and validation output.
- Treat [src/views/ExportView.vue](src/views/ExportView.vue) as the active metadata and export flow. It is now a stronger architecture anchor than legacy shacl-form canvas paths.
- Keep domain and service logic framework-light when possible. If a behavior can live in a pure function, prefer the domain or service layer over embedding it in a component or store.
- Keep stores focused on state, coordination, and persistence boundaries. Avoid moving SHACL parsing, RDF generation, or export rules into components.
- Prefer small migrations that expose a better module seam over broad rewrites that only move files around.

## Critical Boundaries

- [src/stores/shapesStore.ts](src/stores/shapesStore.ts) and [src/stores/metadataStore.ts](src/stores/metadataStore.ts) are intentionally separate. Data schema and dataset metadata schema must not be merged casually.
- Changes to shape parsing or classification in [src/domain/NodeShape.ts](src/domain/NodeShape.ts) usually require a follow-up check in [src/services/rdfGenerator.ts](src/services/rdfGenerator.ts), [src/services/shaclValidator.ts](src/services/shaclValidator.ts), and [src/views/AppView.vue](src/views/AppView.vue).
- Changes to mapping semantics in [src/domain/Mapping.ts](src/domain/Mapping.ts) or [src/stores/mappingStore.ts](src/stores/mappingStore.ts) usually ripple into the canvas, RDF generation, auto-match suggestions, import/export, and tests.
- Changes to import resolution in [src/services/profileResolver.ts](src/services/profileResolver.ts) affect schema loading and should be treated as infrastructure changes.
- Changes to export behavior in [src/services/exportService.ts](src/services/exportService.ts) should be checked against RO-Crate metadata generation in [src/services/roCrate.ts](src/services/roCrate.ts) and GitHub Pages build constraints from [vite.config.ts](vite.config.ts).
- Changes to metadata form handling should be checked against [src/views/ExportView.vue](src/views/ExportView.vue), [src/stores/metadataStore.ts](src/stores/metadataStore.ts), and any remaining shacl-form-specific helpers before keeping or deleting older paths.
- Refactors that introduce new importer or exporter types should preserve stable contracts in [src/domain/DataSource.ts](src/domain/DataSource.ts), [src/domain/Mapping.ts](src/domain/Mapping.ts), and the export pipeline instead of encoding type-specific branches in views.

## Preferred Change Routing

- UI interaction or canvas behavior: start in [src/views/AppView.vue](src/views/AppView.vue), then step to the store or service that actually owns the behavior.
- Mapping rule or RDF semantics: start in the relevant domain or service file, then verify the view and store call sites.
- Data import or source handling: start in [src/stores/dataStore.ts](src/stores/dataStore.ts) and the matching import or profile service.
- Validation or browse output: start in [src/services/shaclValidator.ts](src/services/shaclValidator.ts) or [src/services/browseService.ts](src/services/browseService.ts), then verify [src/views/BrowseView.vue](src/views/BrowseView.vue).
- Metadata or export behavior: start in [src/views/ExportView.vue](src/views/ExportView.vue), [src/stores/metadataStore.ts](src/stores/metadataStore.ts), or [src/services/exportService.ts](src/services/exportService.ts), then confirm upstream data assembly in stores and generators.
- Repo-wide modular refactor: inventory current owners first, define the target seam, then migrate one slice at a time. Do not begin by moving whole folders without a dependency map.

## Definition Of Done

- Run `npm run type-check` for every non-trivial change.
- Run `npm run test` for domain, service, and behavior changes.
- Run `npm run build` when changing app integration, export logic, routing, or deployment-sensitive code.
- For modular refactors, update the nearest architecture-facing documentation or review note if the intended ownership of a module changes.
- For GitHub Pages or asset-path-sensitive work, validate the base path behavior described in [vite.config.ts](vite.config.ts) and repository workflow [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

## High-Value Test Anchors

- [src/domain/__tests__/NodeShape.test.ts](src/domain/__tests__/NodeShape.test.ts)
- [src/domain/__tests__/Mapping.test.ts](src/domain/__tests__/Mapping.test.ts)
- [src/services/__tests__/rdfGenerator.test.ts](src/services/__tests__/rdfGenerator.test.ts)
- [src/services/__tests__/shaclValidator.test.ts](src/services/__tests__/shaclValidator.test.ts)
- [src/services/__tests__/roCrate.test.ts](src/services/__tests__/roCrate.test.ts)
- [src/services/__tests__/autoMatcher.test.ts](src/services/__tests__/autoMatcher.test.ts)
- [src/services/__tests__/linkDetector.test.ts](src/services/__tests__/linkDetector.test.ts)

## High-Value Review Hotspots

- [src/views/AppView.vue](src/views/AppView.vue) for orchestration overload and mixed responsibilities.
- [src/stores/mappingStore.ts](src/stores/mappingStore.ts) for mapping state, node runtime, and UI-specific coordination that may need separation.
- [src/views/ExportView.vue](src/views/ExportView.vue) together with [src/stores/metadataStore.ts](src/stores/metadataStore.ts) for the active metadata workflow.
- [src/services/exportService.ts](src/services/exportService.ts), [src/services/roCrate.ts](src/services/roCrate.ts), and [src/services/rmlSerializer.ts](src/services/rmlSerializer.ts) for export orchestration boundaries.
- [src/components/mapping/ShaclFormNode.vue](src/components/mapping/ShaclFormNode.vue) as a removal or merge candidate rather than a default extension point.

## Avoid

- Do not collapse data-schema and dataset-metadata responsibilities into one store or one generic parser path unless the task explicitly requires an architectural redesign.
- Do not patch UI symptoms in a component when the actual behavior is decided in a store or service.
- Do not change mapping, SHACL, or export semantics without updating the nearest affected tests.
- Do not treat [src/services](src/services) as a dumping ground for unrelated helpers during the refactor. Place new logic according to the target module boundary you want to preserve.
- Do not keep legacy UI surfaces alive only because they still compile. If a path has been superseded, review whether it should be removed, merged, or clearly marked as transitional.
- Do not hardcode the production base path. This repository already derives it for Pages builds.