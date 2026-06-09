import { graph, serialize, type NamedNode, type Store } from 'rdflib'
import { RDF_TYPE } from '@/domain/rdfConstants'
import type { ApplicationProfile } from '@/domain/NodeShape'
import { classifyShape } from '@/domain/NodeShape'
import { mappingTransformId, type MappingState } from '@/domain/Mapping'
import type { DataSource } from '@/domain/DataSource'
import { buildObject, buildObjects, subjectFor } from '@/services/mapping/mappingSemantics'
import {
  resolveExplicitHybridOwnerForSource,
  isStagingSource,
  normalizeStagingTurtlePrefixes,
  registerStagingPrefixes,
  stagingColumnsForSourceWithRelations,
  stagingClassForSource,
  stagingRelationshipObjectsForValue,
  stagingSubjectForRow,
  subjectForHybridOwnerRow,
} from '@/services/mapping/stagingSemantics'
import { findTransformSemanticsHandler } from '@/features/mapping/mappingExtensionRegistry'

export interface GeneratedGraph {
  store: Store
  subjectCount: number
  tripleCount: number
}

export function generateRdf(
  ap: ApplicationProfile,
  mapping: MappingState,
  sources: DataSource[],
): GeneratedGraph {
  const store = graph()
  ;(store as unknown as { setPrefixForURI: (p: string, u: string) => void })
    .setPrefixForURI?.('ex', 'http://example.org/')
  registerStagingPrefixes(store, sources)
  const sourceMap = new Map(sources.map(s => [s.id, s]))
  const allShapes = ap.allNodeShapes()
  const hybridOwnersBySourceId = new Map(
    sources
      .map(source => [source.id, resolveExplicitHybridOwnerForSource(source, mapping, allShapes)] as const)
      .filter((entry): entry is readonly [string, NonNullable<ReturnType<typeof resolveExplicitHybridOwnerForSource>>] => Boolean(entry[1])),
  )
  const subjects = new Set<string>()

  for (const shape of ap.allNodeShapes()) {
    const kind = classifyShape(shape)
    if (kind === 'form') continue

    const edges = mapping.forShape(shape.nodeId.value)
    if (edges.length === 0) continue

    const edgesBySource = new Map<string, typeof edges>()
    for (const edge of edges) {
      const group = edgesBySource.get(edge.sourceId)
      if (group) group.push(edge)
      else edgesBySource.set(edge.sourceId, [edge])
    }

    for (const [sourceId, sourceEdges] of edgesBySource) {
      const source = sourceMap.get(sourceId)
      if (!source) continue

      for (let rowIdx = 0; rowIdx < source.rows.length; rowIdx++) {
        const row = source.rows[rowIdx]
        const subject = subjectFor(shape, source, row, rowIdx)
        subjects.add(subject.value)

        const typeNode = shape.targetClass ?? (shape.nodeId.termType === 'NamedNode' ? shape.nodeId as NamedNode : null)
        if (typeNode) store.add(subject, RDF_TYPE, typeNode)

        for (const edge of sourceEdges) {
          const ps = shape.properties.find(p => p.path?.value === edge.propertyPath)
          if (!ps?.path) continue
          const headerIdx = source.headers.indexOf(edge.sourceHeader)
          if (headerIdx < 0) continue
          const cellValue = row[headerIdx]
          if (cellValue === null || cellValue === undefined || cellValue === '') continue

          const refTargetClass = ps.node
            ? (ap.findNodeShape(ps.node.value)?.targetClass ?? ps.node)
            : undefined

          const transformHandler = findTransformSemanticsHandler(mappingTransformId(edge))
          if (transformHandler?.buildValue) {
            const transformedValue = transformHandler.buildValue({ edge, source, row })
            if (!transformedValue) continue
            store.add(subject, ps.path, buildObject(transformedValue, ps.nodeKind, refTargetClass, ps.datatype))
            continue
          }

          const objects = buildObjects(cellValue, mappingTransformId(edge), ps.nodeKind, refTargetClass, ps.datatype)
          for (const obj of objects) store.add(subject, ps.path, obj)
        }
      }
    }
  }

  for (const source of sources) {
    if (!isStagingSource(source)) continue

    const stagingColumns = stagingColumnsForSourceWithRelations(source, mapping, sources)
    if (stagingColumns.length === 0) continue

    const hybridOwner = hybridOwnersBySourceId.get(source.id)
    const stagingClass = hybridOwner ? undefined : stagingClassForSource(source)
    for (let rowIdx = 0; rowIdx < source.rows.length; rowIdx++) {
      const row = source.rows[rowIdx]
      const subject = hybridOwner
        ? subjectForHybridOwnerRow(hybridOwner, source, row, rowIdx)
        : stagingSubjectForRow(source, rowIdx)
      if (!subject) continue

      subjects.add(subject.value)
      if (stagingClass) store.add(subject, RDF_TYPE, stagingClass)

      for (const column of stagingColumns) {
        const headerIdx = source.headers.indexOf(column.header)
        if (headerIdx < 0) continue
        const cellValue = row[headerIdx]
        if (cellValue === null || cellValue === undefined || cellValue === '') continue

        const relationshipObjects = stagingRelationshipObjectsForValue(column, cellValue, sources, hybridOwnersBySourceId)
        if (relationshipObjects.length > 0) {
          for (const object of relationshipObjects) store.add(subject, column.property, object)
          continue
        }

        store.add(subject, column.property, buildObject(String(cellValue), undefined, undefined, undefined))
      }
    }
  }

  return {
    store,
    subjectCount: subjects.size,
    tripleCount: (store as any).statements?.length ?? 0,
  }
}

export function serializeGraph(
  store: Store,
  format: 'text/turtle' | 'application/ld+json' | 'application/n-triples' = 'text/turtle',
): Promise<string> {
  return new Promise((resolve, reject) => {
    serialize(null, store, undefined, format, (err, str) => {
      if (err) reject(err)
      else resolve(format === 'text/turtle' ? normalizeStagingTurtlePrefixes(str ?? '') : (str ?? ''))
    })
  })
}


