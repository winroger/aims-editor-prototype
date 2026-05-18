import { graph, serialize, type NamedNode, type Store } from 'rdflib'
import { RDF_TYPE } from '@/domain/rdfConstants'
import type { ApplicationProfile, NodeShape } from '@/domain/NodeShape'
import { classifyShape } from '@/domain/NodeShape'
import type { MappingState } from '@/domain/Mapping'
import type { DataSource } from '@/domain/DataSource'
import { buildObject, buildObjects, mintInstanceIri, subjectFor } from '@/services/mapping/mappingSemantics'
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
  const sourceMap = new Map(sources.map(s => [s.id, s]))
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

          const transformHandler = findTransformSemanticsHandler(edge.transform)
          if (transformHandler?.buildValue) {
            const transformedValue = transformHandler.buildValue({ edge, source, row })
            if (!transformedValue) continue
            store.add(subject, ps.path, buildObject(transformedValue, ps.nodeKind, refTargetClass, ps.datatype))
            continue
          }

          const objects = buildObjects(cellValue, edge.transform, ps.nodeKind, refTargetClass, ps.datatype)
          for (const obj of objects) store.add(subject, ps.path, obj)
        }
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
      else resolve(str ?? '')
    })
  })
}
