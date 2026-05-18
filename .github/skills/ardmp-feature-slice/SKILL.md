---
name: ardmp-feature-slice
description: "Use when adding a feature in the ARDMP repo: canvas behavior, mapping interactions, SHACL handling, RDF generation, browse output, metadata handling, or export fields. Guides end-to-end impact analysis across views, stores, services, and tests."
---

# ARDMP Feature Slice

Use this workflow for features that should work end-to-end, not just in one file.

## Goal

- Deliver the requested behavior without widening architectural drift.
- Keep each feature aligned with the target separation between app orchestration, core domain, feature modules, and infrastructure adapters.

## Step 1: Find The Owning Layer

- Canvas or interaction features usually start in [src/views/AppView.vue](src/views/AppView.vue).
- Browse or read-side features usually start in [src/views/BrowseView.vue](src/views/BrowseView.vue).
- Metadata and export flow features usually start in [src/views/ExportView.vue](src/views/ExportView.vue) or [src/stores/metadataStore.ts](src/stores/metadataStore.ts).
- Mapping semantics usually live in [src/domain/Mapping.ts](src/domain/Mapping.ts) or [src/stores/mappingStore.ts](src/stores/mappingStore.ts).
- SHACL parsing and shape behavior usually start in [src/domain/NodeShape.ts](src/domain/NodeShape.ts), [src/stores/shapesStore.ts](src/stores/shapesStore.ts), or [src/stores/metadataStore.ts](src/stores/metadataStore.ts).
- RDF or export features usually start in [src/services/rdfGenerator.ts](src/services/rdfGenerator.ts), [src/services/shaclValidator.ts](src/services/shaclValidator.ts), [src/services/browseService.ts](src/services/browseService.ts), or [src/services/exportService.ts](src/services/exportService.ts).

Before editing, name which layer should own the finished behavior. If the current owner is only temporary or overloaded, prefer the nearest stable seam over adding another special case.

## Step 2: Check Likely Ripple Effects

When a feature touches one area, inspect the likely adjacent areas before editing:

- Canvas interaction -> [src/views/AppView.vue](src/views/AppView.vue), node components in [src/components/mapping](src/components/mapping), [src/stores/mappingStore.ts](src/stores/mappingStore.ts)
- Mapping semantics -> [src/services/autoMatcher.ts](src/services/autoMatcher.ts), [src/services/rdfGenerator.ts](src/services/rdfGenerator.ts), mapping import/export paths
- Shape classification or SHACL parsing -> [src/stores/shapesStore.ts](src/stores/shapesStore.ts), [src/stores/metadataStore.ts](src/stores/metadataStore.ts), [src/services/rdfGenerator.ts](src/services/rdfGenerator.ts), [src/services/shaclValidator.ts](src/services/shaclValidator.ts)
- Browse output -> [src/services/browseService.ts](src/services/browseService.ts), [src/views/BrowseView.vue](src/views/BrowseView.vue)
- Export fields or package contents -> [src/services/exportService.ts](src/services/exportService.ts), [src/services/roCrate.ts](src/services/roCrate.ts)
- New importer or enricher options -> [src/domain/DataSource.ts](src/domain/DataSource.ts), [src/stores/dataStore.ts](src/stores/dataStore.ts), the matching integration service, and any node/runtime state in [src/stores/mappingStore.ts](src/stores/mappingStore.ts)
- Metadata flow changes -> [src/views/ExportView.vue](src/views/ExportView.vue), [src/stores/metadataStore.ts](src/stores/metadataStore.ts), [src/services/datasetMetadata.ts](src/services/datasetMetadata.ts), and any remaining legacy shacl-form paths

## Step 3: Make The Smallest Viable Change

- Change the owning behavior first.
- Only edit components or stores that must be updated to expose that behavior.
- Avoid duplicating logic between AppView, stores, and services.
- If a feature would require another broad conditional in [src/views/AppView.vue](src/views/AppView.vue), stop and check whether the behavior should instead move behind a module-level helper or store action.
- If the feature introduces a new extension point, write it so future importers or exporters can follow the same seam.

## Step 4: Add Focused Validation

- Domain or service changes: extend the nearest Vitest file in [src/domain/__tests__](src/domain/__tests__) or [src/services/__tests__](src/services/__tests__).
- UI or integration changes without existing UI tests: run `npm run type-check`, then `npm run test`, then `npm run build` if app wiring changed.
- For integration-heavy slices, validate the nearest owner first before widening to full app checks.

## Common Feature Checks

- If the feature changes node placement, selection, or deletion, confirm both the canvas node list and related mapping state still stay in sync.
- If the feature changes metadata behavior, verify that dataset metadata still stays separate from data schema loading.
- If the feature changes export behavior, verify both the ZIP contents and the generated RO-Crate metadata contract.
- If the feature touches a path that appears legacy, verify whether the task should remove or consolidate it instead of extending it.
- If the feature adds a new source or export format, check that the resulting API does not hardcode type-specific assumptions into unrelated modules.