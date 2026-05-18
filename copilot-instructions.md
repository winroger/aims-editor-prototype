# Copilot Instructions For ARDMP

Use these repository-specific instructions when implementing features or refactorings in this codebase.

## Repo Priorities

- Preserve the separation between view orchestration, Pinia state, and pure domain/service logic.
- Prefer small, local edits over broad rewrites, but make those edits in a direction that strengthens future module seams.
- For canvas behavior, find the owning logic before editing node components. In this repo, [src/views/AppView.vue](src/views/AppView.vue) usually coordinates the graph while stores and services own the data rules.
- For SHACL, mapping, RDF, browse, or export work, assume there is cross-file impact until disproven.
- Treat [src/views/AppView.vue](src/views/AppView.vue), [src/stores/mappingStore.ts](src/stores/mappingStore.ts), and [src/services](src/services) as likely refactor hotspots where convenience changes can easily worsen coupling.
- Keep the medium-term target architecture in mind: app shell/orchestration, core domain, feature modules, and infrastructure adapters.

## Change Rules

- Put reusable business rules in [src/domain](src/domain) or [src/services](src/services) instead of embedding them directly in Vue components.
- Keep stores in [src/stores](src/stores) responsible for state and coordination, not for duplicating service logic.
- If you change shape parsing, shape classification, mapping semantics, or export structure, inspect the adjacent pipeline stages before stopping.
- If a task touches dataset metadata, check [src/stores/metadataStore.ts](src/stores/metadataStore.ts) separately from [src/stores/shapesStore.ts](src/stores/shapesStore.ts).
- If a task adds importer-, enricher-, or exporter-specific behavior, prefer introducing or strengthening a feature boundary over extending view conditionals.
- If a path looks superseded by a newer workflow, do not assume it must survive. Check whether it is still used, still owns behavior, or should be removed.

## Refactor Rules

- For repo-wide refactors, start by naming the current owner, the desired future owner, and the seam that allows a safe migration.
- Reordering [src](src) is not a goal by itself. Only move files when the move makes responsibilities easier to understand or reduces coupling.
- Preserve stable contracts in [src/domain/Mapping.ts](src/domain/Mapping.ts), [src/domain/NodeShape.ts](src/domain/NodeShape.ts), and [src/domain/DataSource.ts](src/domain/DataSource.ts) unless the task explicitly includes changing those contracts.
- Keep metadata flows anchored around [src/views/ExportView.vue](src/views/ExportView.vue) and [src/stores/metadataStore.ts](src/stores/metadataStore.ts) unless a change intentionally redesigns that area.
- Future browser persistence should be prepared through ports or repository-style adapters, not by mixing IndexedDB concerns into views, stores, or domain classes.
- When removing legacy code, verify the replacement path first and capture the removal rationale in the nearest review or architecture-facing document.

## Testing Rules

- When changing domain or service behavior, add or update Vitest coverage near the touched behavior.
- Use existing tests in [src/domain/__tests__](src/domain/__tests__) and [src/services/__tests__](src/services/__tests__) as templates.
- Minimum validation for substantive work is `npm run type-check`.
- Also run `npm run test` when behavior changes, and `npm run build` when app wiring or export/deploy behavior changes.
- For modular refactors without executable behavior changes, validate the affected slice with the narrowest meaningful command and inspect the diff for unintended coupling changes.

## Deployment Rules

- Keep GitHub Pages compatibility intact.
- Do not hardcode `/ardmp/` in source code unless the task is specifically about local validation. The base path is derived in [vite.config.ts](vite.config.ts).
- When changing routing, assets, or build integration, verify assumptions against [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

## Review Targets

- Treat [src/components/mapping/ShaclFormNode.vue](src/components/mapping/ShaclFormNode.vue) as a review target, not as a default architectural anchor.
- Prefer documenting the intended module boundary for large refactors in a compact repo-local markdown before moving many files.
- Bias toward quick comprehension for future contributors: a new module should have an obvious owner, a narrow purpose, and a small number of upstream dependencies.