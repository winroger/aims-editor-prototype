---
name: ardmp-safe-refactor
description: "Use when refactoring the ARDMP repo: moving logic between components, stores, domain modules, and services; renaming structures; simplifying graph behavior; or changing schema resolution, RDF generation, validation, or export pipelines. Focuses on hidden coupling and safe validation."
---

# ARDMP Safe Refactor

Use this workflow when the goal is structural improvement rather than a single visible feature.

## Goal

- Reduce coupling while keeping the current dataset workflow working.
- Move the codebase toward clearer module seams: app shell/orchestration, core domain, feature modules, and infrastructure adapters.
- Treat browser persistence as a later infrastructure phase, not as part of the first restructuring wave.

## Refactor Checklist

1. Identify the primary owner of the behavior.
2. List the nearest dependent layer that would break if the contract changes.
3. Decide whether the current owner should remain the owner after the refactor.
4. Preserve public data flow unless the task explicitly requires a contract change.
5. Update the smallest affected test surface before widening scope.

## Review First

Before moving files or deleting components, write down:

- the current owner
- the target owner
- the seam that allows migration
- the contract that must stay stable during the move

If you cannot name those four items, the refactor is not ready.

## Sensitive Areas

- [src/stores/shapesStore.ts](src/stores/shapesStore.ts) and [src/stores/metadataStore.ts](src/stores/metadataStore.ts): preserve their separate responsibilities.
- [src/services/profileResolver.ts](src/services/profileResolver.ts): treat import resolution and caching as infrastructure.
- [src/views/AppView.vue](src/views/AppView.vue) with [src/services/graphLayout.ts](src/services/graphLayout.ts): avoid breaking canvas rebuild and layout sequencing.
- [src/stores/mappingStore.ts](src/stores/mappingStore.ts) with [src/domain/Mapping.ts](src/domain/Mapping.ts): mapping contract changes usually ripple into generation and export.
- [src/services/rdfGenerator.ts](src/services/rdfGenerator.ts), [src/services/shaclValidator.ts](src/services/shaclValidator.ts), and [src/services/exportService.ts](src/services/exportService.ts): keep the end-to-end dataset pipeline aligned.
- [src/views/ExportView.vue](src/views/ExportView.vue) with [src/stores/metadataStore.ts](src/stores/metadataStore.ts): keep the active metadata workflow intact while reviewing older shacl-form-based paths.

## Typical Refactor Targets

- Break orchestration overload out of [src/views/AppView.vue](src/views/AppView.vue) before adding more setup, preview, validation, or node-runtime logic there.
- Split [src/services](src/services) by domain responsibility instead of continuing to accumulate unrelated helpers under one flat folder.
- Review [src/components/mapping/ShaclFormNode.vue](src/components/mapping/ShaclFormNode.vue) and similar legacy paths as removal or merge candidates if [src/views/ExportView.vue](src/views/ExportView.vue) already owns the active workflow.
- Separate mapping runtime concerns from long-lived mapping state when working in [src/stores/mappingStore.ts](src/stores/mappingStore.ts).
- Introduce persistence-ready ports only at clean boundaries; do not thread IndexedDB logic through views or domain classes.

## Deletion Rules

- Remove code only after confirming the replacement path exists and is exercised by the current workflow.
- If a component or helper compiles but no longer owns behavior, mark it as a removal candidate instead of preserving it by default.
- Prefer deleting dead paths in the same refactor slice that proves they are obsolete.

## Validation Sequence

- First run `npm run type-check`.
- Then run `npm run test`.
- Run `npm run build` when refactoring app integration, exports, routes, or deployment-sensitive code.
- For Pages-sensitive work, re-check base path assumptions in [vite.config.ts](vite.config.ts) and workflow behavior in [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

For documentation-only refactor preparation, inspect the diff and verify that new guidance matches the actual current owners and hotspots in the repo.

## Stop Conditions

- Stop and reassess if a refactor starts merging data schema and dataset metadata responsibilities.
- Stop and reassess if a refactor requires duplicating business logic in both a component and a service.
- Stop and reassess if tests cannot express the changed contract clearly.
- Stop and reassess if a move is only cosmetic and does not improve the ownership model.
- Stop and reassess if persistence concerns begin leaking into unrelated layers before the core/module split is clear.