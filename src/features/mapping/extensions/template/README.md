# Mapping Extension Template

Use [module.template.ts](module.template.ts) as the starting point for a new mapping-side module.

Workflow:

1. Copy the template into a new folder under [src/features/mapping/extensions/modules](../modules).
2. Keep one folder per module, for example `source-data/your-source`, `shape-sources/your-profile-source`, or `nodes/your-node`.
3. Replace the placeholder ids, labels, node prefix checks, and imported components with the real module manifest.
4. Wire the module-specific workflow helpers behind the included seams: state keys, node creation, preview, runtime, output materialization, transform semantics, connection handling, and snapshot hooks.
5. Remove hook sections that the concrete module does not need, but keep the remaining seams owned by the module folder instead of pushing behavior back into core files.
6. Export the new module from [src/features/mapping/extensions/modules/index.ts](../modules/index.ts).

The template already includes the expected hook categories for node modules:

- state keys plus typed node and UI-edge access helpers
- createNode wiring for menu actions
- canvas node and edge builders
- preview and runtime handlers
- materialized output-source handlers
- transform-semantics handlers for RDF and RML paths
- connection handlers for UI edges and mapping edges
- snapshot create, restore, and reset hooks

The core contract for all mapping-side modules lives in [src/features/mapping/extensions/core/types.ts](../core/types.ts).