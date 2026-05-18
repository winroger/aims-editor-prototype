import rdfDataModel from '@rdfjs/data-model'
import rdfDataset from '@rdfjs/dataset'
import type { DatasetCore, Quad, Term } from '@rdfjs/types'
import { graph, namedNode, parse, type Statement, type Store } from 'rdflib'
import type { ShaclProfile } from '@/domain/NodeShape'
import type { ValidationViolation } from '@/services/validation/validationTypes'

const DEFAULT_BASE_URI = 'http://example.org/'
const RDF_FIRST = namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#first')
const RDF_NIL = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'
const LIST_REQUIRED_PREDICATES = new Map<string, string>([
  ['http://www.w3.org/ns/shacl#in', 'sh:in'],
  ['http://www.w3.org/ns/shacl#languageIn', 'sh:languageIn'],
  ['http://www.w3.org/ns/shacl#and', 'sh:and'],
  ['http://www.w3.org/ns/shacl#or', 'sh:or'],
  ['http://www.w3.org/ns/shacl#xone', 'sh:xone'],
  ['http://www.w3.org/ns/shacl#ignoredProperties', 'sh:ignoredProperties'],
])

export interface ShapesPreparation {
  store: Store
  warnings: ValidationViolation[]
}

function localName(value: string): string {
  return value.split(/[/#]/).filter(Boolean).pop() ?? value
}

function convertTerm(term: any): Term {
  switch (term?.termType) {
    case 'NamedNode':
      return rdfDataModel.namedNode(term.value)
    case 'BlankNode':
      return rdfDataModel.blankNode(term.value)
    case 'Literal':
      if (term.language) return rdfDataModel.literal(term.value, term.language)
      return rdfDataModel.literal(term.value, rdfDataModel.namedNode(term.datatype?.value ?? 'http://www.w3.org/2001/XMLSchema#string'))
    case 'DefaultGraph':
      return rdfDataModel.defaultGraph()
    default:
      return rdfDataModel.defaultGraph()
  }
}

function isListObject(store: Store, object: any): boolean {
  if (object.termType === 'NamedNode' && object.value === RDF_NIL) return true
  if (object.termType !== 'BlankNode' && object.termType !== 'NamedNode') return false
  return store.any(object as any, RDF_FIRST, null, null) !== null
}

function buildMalformedListWarning(statement: Statement): ValidationViolation {
  const shapeIri = statement.subject.value
  const predicateLabel = LIST_REQUIRED_PREDICATES.get(statement.predicate.value) ?? localName(statement.predicate.value)
  return {
    severity: 'warning',
    shapeIri,
    shapeLabel: localName(shapeIri),
    propertyPath: statement.predicate.value,
    propertyLabel: predicateLabel,
    message: `${predicateLabel} was skipped during validation because the value is not an RDF list.`,
    focusNode: '',
    constraintComponent: 'MalformedShapeConstraint',
    sourceShape: statement.subject.value,
    value: statement.object.value,
  }
}

function sanitizeListConstraints(store: Store): ValidationViolation[] {
  const warnings: ValidationViolation[] = []

  for (const statement of store.match(null, null, null, null) as Statement[]) {
    if (!LIST_REQUIRED_PREDICATES.has(statement.predicate.value)) continue
    if (isListObject(store, statement.object)) continue

    warnings.push(buildMalformedListWarning(statement))
    store.removeStatement(statement)
  }

  return warnings
}

export function toDatasetCore(store: Store): DatasetCore<Quad> {
  const dataset = rdfDataset.dataset() as DatasetCore<Quad>
  for (const statement of store.match(null, null, null, null) as any[]) {
    const graphTerm = statement.graph ?? statement.why ?? rdfDataModel.defaultGraph()
    dataset.add(rdfDataModel.quad(
      convertTerm(statement.subject) as Quad['subject'],
      convertTerm(statement.predicate) as Quad['predicate'],
      convertTerm(statement.object) as Quad['object'],
      convertTerm(graphTerm) as Quad['graph'],
    ))
  }
  return dataset
}

export function parseProfilesToStore(shapeProfiles: ShaclProfile[]): ShapesPreparation {
  const store = graph()
  for (const profile of shapeProfiles) {
    parse(profile.rawTurtle, store, DEFAULT_BASE_URI, 'text/turtle')
  }
  return {
    store,
    warnings: sanitizeListConstraints(store),
  }
}

export function mergeMetadataTurtle(dataStore: Store, metadataTurtle?: string): void {
  if (!metadataTurtle || metadataTurtle.trim().length === 0) return
  parse(metadataTurtle, dataStore, DEFAULT_BASE_URI, 'text/turtle')
}