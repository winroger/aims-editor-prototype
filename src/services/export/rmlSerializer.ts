import { blankNode, graph, literal, namedNode, serialize, type NamedNode, type Store } from 'rdflib'
import type { ApplicationProfile } from '@/domain/NodeShape'
import { classifyShape } from '@/domain/NodeShape'
import type { DataSource } from '@/domain/DataSource'
import { mappingTransformId, type MappingEdge, type MappingState } from '@/domain/Mapping'
import { INSTANCE_BASE_IRI, instanceTemplateForShape, sourcePathForExport } from '@/services/mapping/mappingSemantics'
import {
  hybridTargetClassForOwner,
  isStagingSource,
  registerStagingPrefixes,
  resolveExplicitHybridOwnerForSource,
  stagingClassForSource,
  stagingColumnsForSourceWithRelations,
  stagingSubjectTemplateForSource,
} from '@/services/mapping/stagingSemantics'
import { findTransformSemanticsHandler } from '@/features/mapping/mappingExtensionRegistry'

const RDF_TYPE = namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type')
const RR_TRIPLES_MAP = namedNode('http://www.w3.org/ns/r2rml#TriplesMap')
const RML_LOGICAL_SOURCE = namedNode('http://semweb.mmlab.be/ns/rml#logicalSource')
const RML_SOURCE = namedNode('http://semweb.mmlab.be/ns/rml#source')
const RML_REFERENCE_FORMULATION = namedNode('http://semweb.mmlab.be/ns/rml#referenceFormulation')
const RML_REFERENCE = namedNode('http://semweb.mmlab.be/ns/rml#reference')
const QL_CSV = namedNode('http://semweb.mmlab.be/ns/ql#CSV')
const RR_SUBJECT_MAP = namedNode('http://www.w3.org/ns/r2rml#subjectMap')
const RR_TEMPLATE = namedNode('http://www.w3.org/ns/r2rml#template')
const RR_CLASS = namedNode('http://www.w3.org/ns/r2rml#class')
const RR_PREDICATE_OBJECT_MAP = namedNode('http://www.w3.org/ns/r2rml#predicateObjectMap')
const RR_PREDICATE = namedNode('http://www.w3.org/ns/r2rml#predicate')
const RR_OBJECT_MAP = namedNode('http://www.w3.org/ns/r2rml#objectMap')
const RR_DATATYPE = namedNode('http://www.w3.org/ns/r2rml#datatype')
const RR_TERM_TYPE = namedNode('http://www.w3.org/ns/r2rml#termType')
const RR_IRI = namedNode('http://www.w3.org/ns/r2rml#IRI')
const RR_LITERAL = namedNode('http://www.w3.org/ns/r2rml#Literal')

export async function serializeMappingAsRml(
  ap: ApplicationProfile,
  mapping: MappingState,
  sources: DataSource[],
): Promise<string> {
  const store = buildRmlStore(ap, mapping, sources)
  return new Promise((resolve, reject) => {
    serialize(null, store, undefined, 'text/turtle', (err, str) => {
      if (err) reject(err)
      else resolve(str ?? '')
    })
  })
}

export function buildRmlStore(
  ap: ApplicationProfile,
  mapping: MappingState,
  sources: DataSource[],
): Store {
  const store = graph()
  setPrefixes(store, sources)

  const allShapes = ap.allNodeShapes()
  const sourceMap = new Map(sources.map(source => [source.id, source]))
  const hybridOwnersBySourceId = new Map(
    sources
      .map(source => [source.id, resolveExplicitHybridOwnerForSource(source, mapping, allShapes)] as const)
      .filter((entry): entry is readonly [string, NonNullable<ReturnType<typeof resolveExplicitHybridOwnerForSource>>] => Boolean(entry[1])),
  )

  for (const shape of ap.allNodeShapes()) {
    const kind = classifyShape(shape)
    if (kind === 'form') continue

    const edges = mapping.forShape(shape.nodeId.value)
    if (edges.length === 0) continue

    const edgesBySource = new Map<string, MappingEdge[]>()
    for (const edge of edges) {
      const group = edgesBySource.get(edge.sourceId)
      if (group) group.push(edge)
      else edgesBySource.set(edge.sourceId, [edge])
    }

    for (const [sourceId, sourceEdges] of edgesBySource) {
      const source = sourceMap.get(sourceId)
      if (!source) continue

      const triplesMap = namedNode(`${INSTANCE_BASE_IRI}mapping/triples-map/${slug(shape.nodeId.value)}-${slug(sourceId)}`)
      store.add(triplesMap, RDF_TYPE, RR_TRIPLES_MAP)

      const logicalSource = blankNode()
      store.add(triplesMap, RML_LOGICAL_SOURCE, logicalSource)
      store.add(logicalSource, RML_SOURCE, literal(sourcePathForExport(source)))
      store.add(logicalSource, RML_REFERENCE_FORMULATION, QL_CSV)

      const subjectMap = blankNode()
      store.add(triplesMap, RR_SUBJECT_MAP, subjectMap)
      store.add(subjectMap, RR_TEMPLATE, literal(instanceTemplateForShape(shape, source)))
      if (shape.targetClass) {
        store.add(subjectMap, RR_CLASS, shape.targetClass)
      }

      for (const edge of sourceEdges) {
        const propertyShape = shape.properties.find(property => property.path?.value === edge.propertyPath)
        if (!propertyShape?.path) continue

        const predicateObjectMap = blankNode()
        const objectMap = blankNode()
        store.add(triplesMap, RR_PREDICATE_OBJECT_MAP, predicateObjectMap)
        store.add(predicateObjectMap, RR_PREDICATE, propertyShape.path)
        store.add(predicateObjectMap, RR_OBJECT_MAP, objectMap)

        const transformHandler = findTransformSemanticsHandler(mappingTransformId(edge))
        if (transformHandler?.buildRmlTemplate) {
          const template = transformHandler.buildRmlTemplate(edge)
          if (!template) continue
          store.add(objectMap, RR_TEMPLATE, literal(template))
          store.add(objectMap, RR_TERM_TYPE, RR_LITERAL)
          if (propertyShape.datatype) store.add(objectMap, RR_DATATYPE, propertyShape.datatype)
          continue
        }

        if (propertyShape.node) {
          const refTargetClass = ap.findNodeShape(propertyShape.node.value)?.targetClass ?? propertyShape.node
          store.add(objectMap, RR_TEMPLATE, literal(referenceTemplate(refTargetClass, edge.sourceHeader)))
          store.add(objectMap, RR_TERM_TYPE, RR_IRI)
          continue
        }

        store.add(objectMap, RML_REFERENCE, literal(edge.sourceHeader))

        if (propertyShape.nodeKind?.value === 'http://www.w3.org/ns/shacl#IRI') {
          store.add(objectMap, RR_TERM_TYPE, RR_IRI)
        } else if (propertyShape.datatype) {
          store.add(objectMap, RR_DATATYPE, propertyShape.datatype)
        }
      }
    }
  }

  for (const source of sources) {
    if (!isStagingSource(source)) continue

    const stagingColumns = stagingColumnsForSourceWithRelations(source, mapping, sources)
    const hybridOwner = hybridOwnersBySourceId.get(source.id)
    const subjectTemplate = hybridOwner?.subjectTemplate ?? stagingSubjectTemplateForSource(source)
    if (stagingColumns.length === 0 || !subjectTemplate) continue

    const triplesMap = namedNode(`${INSTANCE_BASE_IRI}mapping/triples-map/staging-${slug(source.id)}`)
    store.add(triplesMap, RDF_TYPE, RR_TRIPLES_MAP)

    const logicalSource = blankNode()
    store.add(triplesMap, RML_LOGICAL_SOURCE, logicalSource)
    store.add(logicalSource, RML_SOURCE, literal(sourcePathForExport(source)))
    store.add(logicalSource, RML_REFERENCE_FORMULATION, QL_CSV)

    const subjectMap = blankNode()
    store.add(triplesMap, RR_SUBJECT_MAP, subjectMap)
    store.add(subjectMap, RR_TEMPLATE, literal(subjectTemplate))
    if (!hybridOwner) store.add(subjectMap, RR_CLASS, stagingClassForSource(source))

    for (const column of stagingColumns) {
      const predicateObjectMap = blankNode()
      const objectMap = blankNode()
      store.add(triplesMap, RR_PREDICATE_OBJECT_MAP, predicateObjectMap)
      store.add(predicateObjectMap, RR_PREDICATE, column.property)
      store.add(predicateObjectMap, RR_OBJECT_MAP, objectMap)

      if (column.linkedTargetSourceId) {
        const linkedTargetOwner = hybridOwnersBySourceId.get(column.linkedTargetSourceId)
        const linkedTargetClass = linkedTargetOwner ? hybridTargetClassForOwner(linkedTargetOwner) : undefined
        const linkedTemplate = linkedTargetOwner
          ? `${INSTANCE_BASE_IRI}${localNameOf(linkedTargetClass?.value ?? linkedTargetOwner.representativeShape.nodeId.value) || 'Resource'}/{${column.header}}`
          : `https://w3id.org/ardmp/staging/instance/{${column.header}}`
        store.add(objectMap, RR_TEMPLATE, literal(linkedTemplate))
        store.add(objectMap, RR_TERM_TYPE, RR_IRI)
      } else {
        store.add(objectMap, RML_REFERENCE, literal(column.header))
        store.add(objectMap, RR_TERM_TYPE, RR_LITERAL)
      }
    }
  }

  return store
}

function setPrefixes(store: Store, sources: DataSource[]): void {
  const mutableStore = store as Store & { setPrefixForURI?: (prefix: string, iri: string) => void }
  mutableStore.setPrefixForURI?.('rr', 'http://www.w3.org/ns/r2rml#')
  mutableStore.setPrefixForURI?.('rml', 'http://semweb.mmlab.be/ns/rml#')
  mutableStore.setPrefixForURI?.('ql', 'http://semweb.mmlab.be/ns/ql#')
  mutableStore.setPrefixForURI?.('rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#')
  registerStagingPrefixes(store, sources)
}

function referenceTemplate(targetClass: NamedNode, reference: string): string {
  const localName = localNameOf(targetClass.value) || 'Resource'
  return `http://example.org/${localName}/{${reference}}`
}

function localNameOf(iri: string): string {
  const idx = Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/'))
  return idx >= 0 ? iri.slice(idx + 1) : ''
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}


