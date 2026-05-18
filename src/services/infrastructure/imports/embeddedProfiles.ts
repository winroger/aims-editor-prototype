/**
 * Embedded profile registry
 *
 * Maps canonical IRIs (mostly `https://w3id.org/nfdi4ing/profiles/...`)
 * to bundled TTL contents. Used by ProfileResolver as a local-first
 * fallback so the most common owl:imports resolve instantly without
 * any network call.
 *
 * The dataset-metadata profiles (Datensatz, Collection Dataset,
 * Class Partition) are also surfaced as catalog entries for the
 * "Dataset Schema" menu.
 */

const rawTtlMap = import.meta.glob('/src/assets/profiles/*.ttl', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

interface EmbeddedEntry {
  iri: string
  fileName: string
  rawTurtle: string
}

const REGISTRY: EmbeddedEntry[] = (() => {
  const out: EmbeddedEntry[] = []
  for (const path in rawTtlMap) {
    const fileName = path.split('/').pop() ?? ''
    const content = rawTtlMap[path]
    const uuidMatch = fileName.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
    const iri = uuidMatch
      ? `https://w3id.org/nfdi4ing/profiles/${uuidMatch[1]}`
      : `embedded:${fileName.replace(/\.ttl$/, '')}`
    out.push({ iri, fileName, rawTurtle: content })
  }
  return out
})()

export function findEmbeddedTurtle(iri: string): string | undefined {
  return REGISTRY.find(e => e.iri === iri)?.rawTurtle
}

export interface DatasetCatalogEntry {
  id: string
  iri: string
  title: string
  description: string
  rawTurtle: string
}

/**
 * Curated, hand-classified subset surfaced in the "Dataset Schema"
 * menu. Other embedded entries are kept around purely as
 * import-resolution targets.
 */
export const DATASET_SCHEMA_CATALOG: DatasetCatalogEntry[] = [
  {
    id: 'rokit-collection-dataset',
    iri: 'https://w3id.org/nfdi4ing/profiles/9db0f49d-72f5-4a7f-8436-7f6d57f3d312',
    title: 'RO-kit Collection Dataset',
    description: 'Datensatz, der eine Sammlung von Entitätsklassen enthält (mit class partitions).',
    rawTurtle: findEmbeddedTurtle('https://w3id.org/nfdi4ing/profiles/9db0f49d-72f5-4a7f-8436-7f6d57f3d312') ?? '',
  },
  {
    id: 'rokit-dataset',
    iri: 'https://w3id.org/nfdi4ing/profiles/4a5d4526-34d4-4b00-8f8f-4b13dd48e6d6',
    title: 'RO-kit Datensatz',
    description: 'Allgemeines Datensatz-Profil mit Titel, Beschreibung, Lizenz, Schöpfer.',
    rawTurtle: findEmbeddedTurtle('https://w3id.org/nfdi4ing/profiles/4a5d4526-34d4-4b00-8f8f-4b13dd48e6d6') ?? '',
  },
  {
    id: 'rokit-class-partition',
    iri: 'https://w3id.org/nfdi4ing/profiles/9f821dd1-07b8-441b-93bd-ef120b3b6c5e',
    title: 'RO-kit Class Partition',
    description: 'Beschreibt eine Partition (Entitätsklasse + Anzahl) innerhalb eines Collection Datasets.',
    rawTurtle: findEmbeddedTurtle('https://w3id.org/nfdi4ing/profiles/9f821dd1-07b8-441b-93bd-ef120b3b6c5e') ?? '',
  },
].filter(e => e.rawTurtle.length > 0)
