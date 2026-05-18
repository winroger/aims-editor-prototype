# ARDMP Modularization Progress

Last updated: 2026-05-13

Aktueller Fokus: Abschluss der Modularisierung der Node-Extensions.

## To do

- [ ] Modulbesitzte Setup-Komponenten aus [src/features/mapping/components/setup](src/features/mapping/components/setup) in die jeweiligen Modulordner überführen oder dort dünne Modul-Wrapper einziehen; im Shared-Bereich sollten nach der Canvas-Generifizierung nur noch wirklich generische Basisbausteine wie [src/features/mapping/components/canvas/TableNode.vue](src/features/mapping/components/canvas/TableNode.vue), [src/features/mapping/components/canvas/ShapeNode.vue](src/features/mapping/components/canvas/ShapeNode.vue), [src/features/mapping/components/canvas/GradientEdge.vue](src/features/mapping/components/canvas/GradientEdge.vue), [src/features/mapping/components/canvas/HubNode.vue](src/features/mapping/components/canvas/HubNode.vue), [src/features/mapping/components/canvas/EnrichNode.vue](src/features/mapping/components/canvas/EnrichNode.vue) und [src/features/mapping/components/canvas/TransformNode.vue](src/features/mapping/components/canvas/TransformNode.vue) verbleiben.
- [ ] Danach entscheiden, ob Preview-Dialoge in [src/views/AppView.vue](src/views/AppView.vue) weiter als Shell-Verantwortung bleiben oder ob auch dafür ein eigener Registry-Seam sinnvoll ist; Setup-Dialog-Hosting in AppView bleibt vorerst akzeptiert, weil die konkrete Dialogauswahl bereits über die Registry läuft.

## Done

- [x] Mapping-Extension-Core und Registry in [src/features/mapping/extensions/core](src/features/mapping/extensions/core) und [src/features/mapping/mappingExtensionRegistry.ts](src/features/mapping/mappingExtensionRegistry.ts) eingeführt.
- [x] Mapping-seitige Module paketiert in [src/features/mapping/extensions/modules](src/features/mapping/extensions/modules) mit getrennten Ordnern für source-data, shape-sources und nodes.
- [x] Setup-Dialoge, Import-Einträge und Node-Aktionen an die Registry angebunden.
- [x] Canvas-Node-Typen sowie modulbesitzte Canvas-Node- und Canvas-Edge-Builder über die Registry aggregiert.
- [x] Generische Extension-State-Verträge in [src/stores/mappingStore.ts](src/stores/mappingStore.ts) eingeführt, statt für jeden Node-Typ neue öffentliche Store-APIs zu erweitern.
- [x] Generic Preview-Dispatch für Node-Extensions umgesetzt in [src/features/mapping/useCanvasPreviews.ts](src/features/mapping/useCanvasPreviews.ts).
- [x] Generic Runtime-Dispatch für Node-Extensions umgesetzt in [src/features/mapping/useCanvasGraph.ts](src/features/mapping/useCanvasGraph.ts).
- [x] Generic Connection-Handling für Node-Extensions umgesetzt in [src/features/mapping/useCanvasConnections.ts](src/features/mapping/useCanvasConnections.ts).
- [x] Modulbesitzte Snapshot-Hooks für Extension-State umgesetzt.
- [x] GeoNames- und Lobid-Mutationslogik aus der öffentlichen Mapping-Store-Oberfläche herausgezogen und in Workflow-Helfer verlagert.
- [x] GeoNames- und Lobid-Runtime-Logik in modulbesitzte Workflow-Helfer verlagert.
- [x] GeoNames- und Lobid-Output-Materialisierung in modulbesitzte Workflow-Helfer verlagert.
- [x] GeoNames- und Lobid-Shape-Sync in modulbesitzte Workflow-Helfer verlagert.
- [x] Verbliebene doppelte interne GeoNames-/Lobid-Workflow-Implementierungen aus [src/stores/mappingStore.ts](src/stores/mappingStore.ts) entfernt; mappingStore delegiert diese Pfade jetzt an die Modul-Workflows.
- [x] Direkte Modul-zu-Modul-Abhängigkeit von [src/features/mapping/extensions/modules/nodes/lat-lng-to-wkt/index.ts](src/features/mapping/extensions/modules/nodes/lat-lng-to-wkt/index.ts) auf GeoNames entfernt; materialisierte Upstream-Outputs laufen jetzt über einen generischen Resolver-Contract in der Registry.
- [x] Transform-Ausführung und Transform-Semantik hinter modulorientierte Contracts gezogen; RDF-, RML- und Transformation-Sync-Pfade nutzen jetzt Registry-basierte Modul-Semantik statt lat-lng-to-wkt-Sonderfällen im Core.
- [x] Contract-orientierte Tests für Node-Extensions ergänzt; die Registry prüft jetzt Output-Resolver- und Transform-Semantik-Verträge gezielt über [src/features/mapping/__tests__/mappingExtensionRegistry.test.ts](src/features/mapping/__tests__/mappingExtensionRegistry.test.ts).
- [x] Das Template unter [src/features/mapping/extensions/template](src/features/mapping/extensions/template) erweitert; neue Node-Module starten jetzt mit State-Keys, Canvas-, Preview-, Runtime-, Output-, Transform-, Connection- und Snapshot-Seams im Gerüst.
- [x] Abschluss-Review für Node-Extensions begonnen und präzisiert: Registry und Setup-Dialog-Auswahl sind bereits neutral, verbleibende Restkopplungen liegen vor allem im Canvas-Shell-Code und in noch zentral abgelegten modulbesitzten Komponenten.
- [x] Restkopplung in [src/features/mapping/useCanvasGraph.ts](src/features/mapping/useCanvasGraph.ts) für konkrete GeoNames-/Lobid-/Transform-Familien abgebaut; Farben und Mapping-Edge-Owner laufen jetzt über Registry-basierte Canvas-Präsentations- und Ownership-Resolver.
- [x] Canvas-Komponenten auf drei generische Typen reduziert: [src/features/mapping/components/canvas/HubNode.vue](src/features/mapping/components/canvas/HubNode.vue), [src/features/mapping/components/canvas/EnrichNode.vue](src/features/mapping/components/canvas/EnrichNode.vue) und [src/features/mapping/components/canvas/TransformNode.vue](src/features/mapping/components/canvas/TransformNode.vue); konkrete Titel, Farben, Handles und Labels liegen jetzt in den Modul-Manifests.
- [x] Öffentliche konkrete Mapping-Store-Methoden für GeoNames/Lobid deutlich reduziert; übrig sind dort nur noch interne Resthelfer und zentrale Transform-Koordination.
- [x] Trennung zwischen importDataSources, importShapeSources und exportseitigen Metadata-Shapes konzeptionell und im Codepfad geschärft.
- [x] Validierung nach den bisherigen Slices erfolgreich ausgeführt mit npm run type-check, npm run test und npm run build.