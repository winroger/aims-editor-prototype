/**
 * Embedded profile registry used as a local-first owl:imports fallback.
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


