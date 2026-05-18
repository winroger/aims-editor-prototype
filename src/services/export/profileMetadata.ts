import { graph, namedNode, parse, type Literal, type Store } from 'rdflib'

export interface ProfileMetadataSummary {
  title?: string
  description?: string
}

const DEFAULT_BASE_URI = 'http://example.org/'
const DCT_TITLE = namedNode('http://purl.org/dc/terms/title')
const DCT_DESCRIPTION = namedNode('http://purl.org/dc/terms/description')

export function extractProfileMetadata(turtle: string, profileIri: string): ProfileMetadataSummary {
  if (!turtle.trim() || !profileIri.trim()) return {}

  const store = graph()
  parse(turtle, store, DEFAULT_BASE_URI, 'text/turtle')

  return {
    title: preferredLiteralValue(store, profileIri, DCT_TITLE),
    description: preferredLiteralValue(store, profileIri, DCT_DESCRIPTION),
  }
}

function preferredLiteralValue(store: Store, subjectIri: string, predicate: ReturnType<typeof namedNode>): string | undefined {
  const literals = store.each(namedNode(subjectIri), predicate, undefined, null)
    .filter((term): term is Literal => term.termType === 'Literal')

  if (literals.length === 0) return undefined

  const preferred = literals.find(literal => literal.language === 'de')
    ?? literals.find(literal => literal.language === 'en')
    ?? literals[0]

  return preferred.value
}