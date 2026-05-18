# Software Review

Stand: 2026-05-18  
Fokus: `src/` Ordner, Modularitaet, Nachvollziehbarkeit, Erweiterbarkeit, Technical Debt, ungenutzter oder ersetzbarer Code.

## Kurzfazit

Der aktuelle Stand ist deutlich besser als ein klassischer gewachsener Vue-Prototyp: Es gibt erkennbare Modulgrenzen (`domain`, `stores`, `features`, `services`, `infrastructure`), eine brauchbare Testbasis und der Build laeuft. Trotzdem ist die Architektur noch nicht stabil. Der Code befindet sich sichtbar mitten in einer Refaktorierung. Einige neue Grenzen sind gut gemeint, aber noch nicht hart genug: Der Mapping-Store kennt weiterhin konkrete Erweiterungen, zentrale Domain-Typen tragen UI- und Extension-Spezifika, und grosse Views/Composables enthalten noch zu viel Orchestrierung.

Ungeschoent: Die Anwendung funktioniert nach den vorhandenen Tests, aber die Erweiterbarkeit ist fragil. Neue Mapping-Knoten oder Exportvarianten koennen aktuell noch zu schnell Querverbindungen durch Store, Domain, Canvas, RDF, RML und Snapshot-Logik erzwingen. Das ist der groesste technische Schuldenblock.

## Gepruefte Befehle

- `npm run type-check`: erfolgreich.
- `npm run test`: erfolgreich, 18 Testdateien, 86 Tests.
- `npm run build`: erfolgreich.
- `npm run lint`: fehlgeschlagen, weil `eslint` nicht installiert bzw. nicht aufloesbar ist.

Das heisst: Compiler, Tests und Build geben gruenes Licht. Die Lint-Pipeline ist aber faktisch kaputt und sollte nicht im `package.json` stehen, wenn sie nicht lauffaehig ist.

## Positive Befunde

- Die Trennung zwischen Daten-SHACL (`shapesStore`) und Dataset-Metadaten (`metadataStore`) ist richtig und wichtig. Das verhindert einen der typischen Architekturfehler in solchen Tools.
- Die neue Struktur unter `src/features/mapping`, `src/services/export`, `src/services/validation`, `src/services/infrastructure` ist ein echter Schritt weg vom Service-Dumping-Ground.
- Komplexe, fachliche Logik ist teilweise bereits aus Views herausgezogen, z. B. Mapping-Validation, Canvas-Graph, Export-Metadatenworkflow und Importadapter.
- Domain- und Service-Tests decken wichtige Semantik ab: SHACL Parsing, Mapping, RDF-Erzeugung, Export, RO-Crate, RML, Link Detection und Stores.
- Teure Validierungslogik wird in `useMappingValidation.ts` dynamisch geladen. Das ist bei `shacl-engine` wichtig.
- Der Build ist trotz schwerer RDF/SHACL-Abhaengigkeiten lauffaehig und die GitHub-Pages-Base-Path-Logik in `vite.config.ts` ist sinnvoll.

## Kritische Befunde

### 1. `mappingStore.ts` ist noch ein God Store

Datei: `src/stores/mappingStore.ts`

Der Store verwaltet nicht nur Mapping-State, sondern auch:

- Extension-State als `Record<string, unknown>`.
- GeoNames-Nodes und GeoNames-UI-Edges.
- Lobid-Nodes und Lobid-UI-Edges.
- Transformation-Nodes und Transformation-UI-Edges.
- Synchronisierung zwischen Extension-Edges und fachlichen Mapping-Edges.
- Snapshot-Erzeugung und Wiederherstellung.
- Import aus JSON.

Das ist zu viel. Die neue Extension-Registry existiert, aber der Store ist weiterhin der zentrale Wissensknoten. Neue Erweiterungen werden wahrscheinlich wieder Store-Aenderungen erzwingen. Damit ist das Extension-Modell nicht wirklich geschlossen.

Empfehlung:

- `mappingStore` auf Kernzustand reduzieren: `MappingState`, UI-unabhaengige Mapping-Operationen, Snapshot-Delegation.
- Extension-State in dedizierte Extension-Module oder eigene Stores auslagern.
- Statt String-Keys wie `node.geonames.nodes` typisierte State-Slices pro Extension verwenden.
- Store-API fuer Extensions kleiner machen. Aktuell ist `MappingExtensionStoreApi` zu maechtig und erlaubt fast alles.

### 2. `MappingEdge` ist ueberladen und leakt Extension-Semantik in die Domain

Datei: `src/domain/Mapping.ts`

`MappingEdge` enthaelt optionale Felder wie `transform`, `secondarySourceHeader`, `transformNodeId`, `geoNamesNodeId`, `lobidNodeId`. Das ist ein Zeichen, dass der Domain-Typ verschiedene Konzepte in ein flaches Objekt presst.

Problem:

- Die Domain weiss von konkreten Erweiterungen.
- Ein Edge kann ungueltige Kombinationen tragen, z. B. `lobidNodeId` plus Transform-Felder.
- TypeScript kann fachliche Invarianten kaum schuetzen.
- RDF/RML/Canvas/Snapshot muessen dieselben optionalen Felder interpretieren.

Empfehlung:

- `MappingEdge` als discriminated union modellieren, z. B. `source.kind = 'table-column' | 'transform-output' | 'enrichment-output'`.
- Extension-spezifische Details nicht als Top-Level-Felder im Kerntyp ablegen.
- Invarianten testbar machen: Welche Edge-Quelle darf welche Header/Felder haben?

### 3. `DataSource` versteckt unterschiedliche Quellen als `csv`

Datei: `src/domain/DataSource.ts`

`GeoNamesResultDataSource` und `LobidResultDataSource` setzen `kind = 'csv'` und `hidden = true`. Das ist pragmatisch, aber fachlich unsauber. Eine Enrichment-Ausgabe ist keine CSV-Quelle, sondern eine materialisierte Zwischentabelle.

Problem:

- UI, Export und RDF-Logik koennen nicht sauber zwischen echter Nutzerquelle und interner Zwischenausgabe unterscheiden.
- `hidden` wird zum Semantik-Schalter.
- Exportlogik muss spaeter raten, ob eine Quelle in ein RO-Crate gehoert.

Empfehlung:

- `DataSource.kind` erweitern oder in `origin` und `visibility` trennen.
- Interne/materialisierte Quellen als eigenen Typ modellieren.
- Exportentscheidung explizit machen: `exportPolicy: 'include' | 'internal-only' | 'derived'`.

### 4. Views sind kleiner geworden, aber noch nicht klein

Relevante Dateien:

- `src/views/BrowseView.vue`: ca. 700 Zeilen.
- `src/views/AppView.vue`: ca. 390 Zeilen.
- `src/views/ExportView.vue`: ca. 330 Zeilen.
- `src/components/browse/SubjectDetailDialog.vue`: ca. 360 Zeilen.

`AppView.vue` ist durch Composables bereits besser strukturiert. `BrowseView.vue` ist dagegen noch klar zu gross: RDF-Regeneration, Filterlogik, Pivot-Tabellen, Detaildialogsteuerung, Copy-Verhalten und Rendering leben zusammen.

Empfehlung:

- `BrowseView.vue` in `useBrowseGeneration`, `useBrowseFilters`, `useBrowseTableColumns` und kleinere Komponenten zerlegen.
- `SubjectDetailDialog.vue` in Navigation, Referenzliste und SHACL-Form-Wrapper trennen.
- Views sollten Routen-Orchestrierung machen, nicht fachliche Datenformung.

### 5. `useCanvasGraph.ts` ist ein zweiter Orchestrierungs-Hotspot

Datei: `src/features/mapping/useCanvasGraph.ts`

Diese Datei baut Nodes, Edges, Farben, Layout, Airtable-Refresh, Runtime-Ausfuehrung, Structural Edges und Mapping-Edges. Das ist inzwischen ein Feature-Service, kein einfacher Vue-Composeable mehr.

Problem:

- Canvas-Darstellung und Runtime-Aktionen sind gekoppelt.
- Edge-Farbregeln sind hart verdrahtet.
- `detectLinkedColumns` laeuft beim Graph-Rebuild und kann bei groesseren Tabellen teuer werden.
- Watcher vergleichen komplexe Aenderungen ueber `join('|')`. Das ist fragil und kann bei Zeichenkollisionen oder nicht beobachteten Inhalten danebenliegen.

Empfehlung:

- Pure Builder extrahieren: `buildTableNodes`, `buildShapeNodes`, `buildMappingEdges`, `buildStructuralEdges`.
- Runtime-Aktionen aus dem Graph-Builder herausziehen.
- Fuer teure Ableitungen Memoisierung oder gezielte Invalidierung einsetzen.

### 6. Export-Service hat Browser-Side-Effects

Datei: `src/services/export/exportService.ts`

`exportRoCrate` erzeugt nicht nur das Paket, sondern loest direkt den Browser-Download aus. Das macht den Service schwerer wiederverwendbar, z. B. fuer Tests, Preview, Upload, CLI, serverseitige Verarbeitung oder spaetere Persistenz.

Empfehlung:

- Service in zwei Schichten trennen:
  - `buildRoCratePackage(input): Promise<{ blob, filename, stats }>`
  - UI-Adapter `downloadBlob(blob, filename)`
- Zeitstempel und UUID optional injizierbar machen. Das verbessert deterministische Tests.

### 7. Tooling-Schulden: Lint-Script ist defekt

Datei: `package.json`

`npm run lint` referenziert `eslint`, aber ESLint ist nicht installiert. Das ist kein kosmetisches Problem. Ohne Linting bleiben Muster wie `any`, doppelte Shims, unbenutzte Importe, `console.*` und riskante Typ-Casts zu lange unsichtbar.

Empfehlung:

- Entweder ESLint-Konfiguration sauber installieren oder Script entfernen.
- Fuer Vue 3 + TypeScript mindestens `eslint`, `typescript-eslint`, `eslint-plugin-vue` konfigurieren.
- CI sollte `type-check`, `test`, `build` und `lint` ausfuehren.

### 8. Typ-Loescher durch `any` und doppelte Shims

Dateien:

- `src/shims.d.ts`
- `src/external-modules.d.ts`
- `src/services/validation/*`
- `src/services/export/datasetMetadata.ts`
- `src/services/rdf/rdfGenerator.ts`

Es gibt mehrere `any`-Stellen um RDFJS, SHACL und Vue-Komponenten. Ein Teil davon ist wegen schwacher Third-Party-Typen verstaendlich. Aber aktuell sind die Grenzen nicht sauber gekapselt.

Auffaellig:

- `shacl-engine` wird in `shims.d.ts` und `external-modules.d.ts` deklariert.
- `<shacl-form>` ist global als `any` typisiert.
- Validation-Mapping arbeitet mit `any` statt mit einem lokalen Adapter-Typ.

Empfehlung:

- Doppelte Deklarationen zusammenfuehren.
- Eigene kleine Adapter-Typen fuer SHACL-Engine-Reports und RDF-Terms definieren.
- `any` an Adaptergrenzen erlauben, aber nicht in Fachlogik durchreichen.

### 9. Dokumentation ist teilweise stale

Die Agent-/Architekturhinweise referenzieren noch alte Pfade wie `src/components/mapping/TableNode.vue`, `ShapeNode.vue`, `GeoNamesNode.vue`, `LobidNode.vue`, `TransformationNode.vue`, die im aktuellen Stand geloescht bzw. nach `src/features/mapping/components/canvas/*` verschoben wurden.

Problem:

- Neue Entwickler oder Agents bekommen falsche Einstiegspunkte.
- Review-Hotspots stimmen dadurch nur teilweise.
- Refaktorierung wirkt unfertig, obwohl der Code bereits verschoben wurde.

Empfehlung:

- `AGENTS.md`, `copilot-instructions.md` und `REFACTOR_REVIEW.md` nach der aktuellen Struktur aktualisieren.
- Alte Pfade nur noch als Migrationshistorie nennen, nicht als aktive Architekturanker.

### 10. Persistenz ist vorbereitet, aber nicht produktiv verdrahtet

Dateien:

- `src/stores/projectStore.ts`
- `src/services/infrastructure/storage/projectSnapshotRepository.ts`

Das Repository-Interface existiert und wird getestet, aber im produktiven App-Shell wird kein Repository gesetzt. Damit ist Persistenz aktuell Architekturvorbereitung, kein Feature.

Empfehlung:

- Entweder bewusst als "noch nicht aktiv" dokumentieren.
- Oder einen LocalForage-Adapter implementieren und im App-Start verdrahten.
- Keinen halben Persistenzpfad im UI suggerieren, solange Speichern/Laden nicht erreichbar ist.

## Code, der wahrscheinlich reduziert oder ersetzt werden kann

### Kandidaten fuer Entfernung oder Pruefung

- `leaflet-editable` und `leaflet.fullscreen`: Im `src` gibt es keine direkten Imports. Sie koennen indirekt vom SHACL-Form-Leaflet-Plugin gebraucht werden, sollten aber explizit geprueft werden. Wenn nicht noetig: entfernen.
- `ProjectSnapshotRepository`: Als Interface okay, aber ohne produktiven Adapter derzeit nur vorbereitender Code.
- Legacy-Namen wie `csv-rdf-mapper-v2` in `credentialStore.ts` und `profileResolver.ts`: Fuer Migration nachvollziehbar, aber langfristig technischer Ballast. Dokumentieren und spaeter entfernen.
- Manuelle CSV-Serialisierung in `exportService.ts`: PapaParse wird bereits fuer CSV-Parsing genutzt. Fuer CSV-Export kann PapaParse `unparse` genutzt werden, statt eigene Escape-Logik zu pflegen.

### Nicht einfach entfernen

- `rdflib`, `@rdfjs/*`, `shacl-engine`, `ro-crate`, `@ulb-darmstadt/shacl-form`: Das sind schwere Abhaengigkeiten, aber sie tragen echte Fachlogik. Entfernen waere nicht realistisch.
- `@dagrejs/dagre`: Sinnvoll fuer Graphlayout.
- `localforage`: Sinnvoll fuer Cache/Credentials, spaeter auch fuer Projektpersistenz.

## Bundle- und Performance-Befunde

Der Build erzeugt mehrere schwere Chunks:

- `shaclValidator`: ca. 1,025 kB minified.
- `vendor-primevue`: ca. 480 kB.
- `vendor-rdflib`: ca. 390 kB.
- `vendor-shacl-form`: ca. 325 kB.
- `vendor-vueflow`: ca. 259 kB.
- `vendor-leaflet`: ca. 204 kB.

Das ist fuer eine RDF/SHACL-App nicht ueberraschend, aber es ist relevant. Die Anwendung sollte schwere Funktionen nur laden, wenn sie gebraucht werden. Validation ist bereits dynamisch importiert. Aehnlich sollte man pruefen:

- Wird SHACL-Form erst auf Browse/Export/Preview geladen?
- Wird Leaflet nur fuer den Detaildialog geladen?
- Kann RO-Crate/JSZip nur beim Export geladen werden?
- Kann `generateRdf` fuer Browse/Preview/Validation entkoppelt oder gecacht werden?

Ausserdem meldet Vite grosse Chunks. Das ist kein Build-Fehler, aber ein klares Signal fuer Performance-Arbeit.

## Testabdeckung

Die vorhandene Testbasis ist fuer Domain und Services gut. Luecken:

- Kaum/keine Komponententests fuer grosse Views.
- Keine E2E-Tests fuer Kernflows: CSV laden, SHACL-Profil laden, Mapping ziehen, Browse ansehen, Export erzeugen.
- Keine gezielten Performance-Tests fuer grosse Tabellen oder viele Shapes.
- Wenig Tests fuer kaputte/unerwartete Third-Party-RDF/SHACL-Ausgaben.

Empfehlung:

- Ein minimaler Playwright-Flow waere sehr wertvoll.
- Fuer `BrowseView` und Canvas-Graph Builder sollten pure Funktionen getestet werden, nachdem sie extrahiert sind.
- Export-Tests sollten Blob/Dateiinhalte ohne Browser-Download-Side-Effect pruefen.

## Priorisierte Sanierung

### Prioritaet 1

1. Linting reparieren und in CI aufnehmen.
2. `MappingEdge` neu modellieren oder mindestens eine typed Source-Struktur einfuehren.
3. `mappingStore.ts` von konkreten GeoNames/Lobid/Transformation-Konzepten entkoppeln.
4. Stale Dokumentation auf aktuelle Pfade korrigieren.

### Prioritaet 2

1. `BrowseView.vue` in kleinere Composables und Komponenten zerlegen.
2. `useCanvasGraph.ts` in pure Builder plus UI-Adapter aufteilen.
3. Export-Service von Download-Side-Effects trennen.
4. `DataSource`-Modell um interne/abgeleitete Quellen erweitern.

### Prioritaet 3

1. Bundle-Ladepfade fuer SHACL-Form, Leaflet, RO-Crate und JSZip weiter lazifizieren.
2. Doppelte `d.ts`-Deklarationen bereinigen.
3. Projektpersistenz entweder fertig verdrahten oder klar als spaetere Phase markieren.
4. E2E-Test fuer den wichtigsten Nutzerflow ergaenzen.

## Gesamtbewertung

Der Code ist nicht chaotisch, aber er ist noch nicht sauber modular. Die aktuelle Struktur zeigt die richtige Richtung, doch einige zentrale Typen und Stores tragen weiterhin zu viele Verantwortlichkeiten. Die groesste Gefahr ist, dass die neue Extension-Architektur nur oberflaechlich modular bleibt, waehrend die echte Kopplung in `mappingStore`, `MappingEdge`, RDF/RML-Export und Canvas-Graph weiterwaechst.

Mein ehrliches Urteil: Gute Basis, aber noch kein belastbares Erweiterungsfundament. Wenn jetzt weiter Features auf die aktuellen Kernstrukturen gesetzt werden, wird die naechste Erweiterung teuer. Der naechste Schritt sollte nicht noch ein Importer oder Enrichment sein, sondern eine harte Stabilisierung der Mapping-Domain und Store-Grenzen.
