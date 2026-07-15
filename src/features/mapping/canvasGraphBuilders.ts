import type { Edge, Node } from '@vue-flow/core'
import type { DataSource } from '@/domain/DataSource'
import type { MappingEdge } from '@/domain/Mapping'
import { propertyNodeTargets, propertyRelationshipKinds, type NodeShape, type PropertyShape } from '@/domain/NodeShape'
import { applyDefaultExtensionEdgeStyle, propertyRelationshipLabel, type CanvasEdgeKind } from '@/features/mapping/canvasEdgeLabels'
import { CANVAS_EDGE_STYLES } from '@/features/mapping/canvasTheme'
import {
  buildCanvasShapeNodeId,
  buildInheritedPropertyGroups,
  buildOwnProperties,
  collectVisibleShapeNodeDescriptors,
  inheritedOriginShapesForRoot,
  inheritedPropertyPrefixCount,
  parseCanvasShapeNodeTarget,
  type ShapeCanvasNodeData,
} from '@/features/mapping/inheritanceCanvas'
import { resolveMappingEdgeCanvasSource } from '@/features/mapping/mappingExtensionRegistry'
import { detectLinkedColumns } from '@/services/mapping/linkDetector'

export function buildCanvasSourceNodes(
  sources: DataSource[],
  openTablePreview: (source: DataSource) => void,
): Node[] {
  return sources.map(source => ({
    id: `src:${source.id}`,
    type: 'tableNode',
    position: { x: 0, y: 0 },
    data: { source, onPreview: () => openTablePreview(source) },
  }))
}

export function buildCanvasShapeNodes(
  rootShapes: NodeShape[],
  allShapes: NodeShape[],
  expandedShapeNodeIds: Set<string>,
  openShapePreview: (shape: NodeShape) => void | Promise<void>,
): Node[] {
  const descriptors = collectVisibleShapeNodeDescriptors(rootShapes, allShapes, expandedShapeNodeIds)

  return descriptors.map(descriptor => ({
    id: descriptor.nodeId,
    type: 'shapeNode',
    position: { x: 0, y: 0 },
    data: {
      shape: descriptor.shape,
      ownerShapeIri: descriptor.ownerShapeIri,
      representedShapeIri: descriptor.representedShapeIri,
      inheritedOriginShapes: inheritedOriginShapesForRoot(descriptor.shape, allShapes),
      inheritedPropertyCount: inheritedPropertyPrefixCount(descriptor.shape, allShapes),
      inheritedGroups: buildInheritedPropertyGroups(descriptor.shape, allShapes),
      ownProperties: buildOwnProperties(descriptor.shape, allShapes),
      interactive: true,
      onPreview: () => openShapePreview(descriptor.shape),
    } satisfies ShapeCanvasNodeData,
  }))
}

export function buildCanvasMappingEdges(
  mappingEdges: MappingEdge[],
  allShapes: NodeShape[],
  visibleNodeIds: Set<string>,
): Edge[] {
  const allShapesByIri = new Map(allShapes.map(shape => [shape.nodeId.value, shape]))

  return mappingEdges.flatMap(edge => {
    const targetShape = allShapesByIri.get(edge.shapeIri)
    if (!targetShape) return []

    const targetProperty = targetShape.properties.find(property => property.path?.value === edge.propertyPath)
    const sourceDescriptor = resolveMappingEdgeCanvasSource(edge) ?? { source: `src:${edge.sourceId}` }
    const target = buildCanvasShapeNodeId(edge.shapeIri)
    if (!visibleNodeIds.has(sourceDescriptor.source) || !visibleNodeIds.has(target)) return []

    return [{
      id: `e:${edge.shapeIri}::${edge.propertyPath}`,
      source: sourceDescriptor.source,
      sourceHandle: sourceDescriptor.sourceHandle ?? `h:${edge.sourceHeader}`,
      target,
      targetHandle: `p:${edge.propertyPath}`,
      label: targetProperty ? propertyRelationshipLabel(targetProperty) : '',
      animated: true,
      type: 'default',
      style: CANVAS_EDGE_STYLES.primary,
      data: {
        isFkProp: targetProperty ? propertyNodeTargets(targetProperty).length > 0 : false,
        relationLabel: targetProperty ? propertyRelationshipLabel(targetProperty) : '',
        edgeKind: 'mapping' satisfies CanvasEdgeKind,
      },
    }]
  })
}

export function buildCanvasStructuralEdges(
  visibleSources: DataSource[],
  rootShapes: NodeShape[],
  allShapes: NodeShape[] = rootShapes,
  visibleNodeIds?: Set<string>,
): Edge[] {
  return [
    ...buildTableRelationEdges(visibleSources),
    ...buildShapeReferenceEdges(rootShapes, allShapes, visibleNodeIds),
  ]
}

function buildTableRelationEdges(visibleSources: DataSource[]): Edge[] {
  const edges: Edge[] = []

  for (const source of visibleSources) {
    const linkedColumns = detectLinkedColumns(source, visibleSources)
    for (const linkedColumn of linkedColumns) {
      if (!linkedColumn.bestTargetSourceId) continue
      edges.push({
        id: `tbl:${source.id}::${linkedColumn.header}->${linkedColumn.bestTargetSourceId}`,
        source: `src:${source.id}`,
        sourceHandle: `h:${linkedColumn.header}`,
        target: `src:${linkedColumn.bestTargetSourceId}`,
        targetHandle: 'table-parent',
        label: '',
        type: 'default',
        animated: false,
        style: CANVAS_EDGE_STYLES.structural,
        data: {
          relationLabel: '',
          edgeKind: 'structural' satisfies CanvasEdgeKind,
        },
      })
    }
  }

  return edges
}

function buildShapeReferenceEdges(
  rootShapes: NodeShape[],
  allShapes: NodeShape[],
  visibleNodeIds?: Set<string>,
): Edge[] {
  const edges: Edge[] = []

  for (const shape of rootShapes) {
    for (const property of shape.properties) {
      if (!property.path) continue
      const targetNodes = propertyNodeTargets(property)
      if (targetNodes.length === 0) continue
      const source = buildCanvasShapeNodeId(shape.nodeId.value)
      for (const targetNode of targetNodes) {
        const target = findVisibleShapeNodeId(targetNode.value, visibleNodeIds)
        if (!source || !target) continue
        edges.push({
          id: `ref:${shape.nodeId.value}::${property.path.value}->${targetNode.value}`,
          source,
          sourceHandle: `ref:${property.path.value}`,
          target,
          targetHandle: 'shape-header',
          label: propertyRelationshipLabel(property),
          type: 'default',
          animated: false,
          style: CANVAS_EDGE_STYLES.structural,
          data: {
            relationLabel: propertyRelationshipLabel(property),
            edgeKind: 'structural' satisfies CanvasEdgeKind,
          },
        })
      }
    }
  }

  return edges
}

export function preserveCanvasNodePositions(
  existingNodes: Node[],
  nextNodes: Node[],
  positionForNewNode: (node: Node, index: number) => Node['position'],
): Node[] {
  const existingPositions = new Map<string, Node['position']>()
  for (const node of existingNodes) {
    existingPositions.set(node.id, node.position)
  }

  return nextNodes.map((node, index) => ({
    ...node,
    position: existingPositions.get(node.id) ?? positionForNewNode(node, index),
  }))
}

export function shouldAutoLayoutCanvas(existingNodes: Node[], nextNodes: Node[]): boolean {
  if (existingNodes.length === 0) return nextNodes.length > 0

  const existingIds = new Set(existingNodes.map(node => node.id))
  return nextNodes.some(node => !existingIds.has(node.id))
}

function findVisibleShapeNodeId(shapeIri: string, visibleNodeIds?: Set<string>): string | null {
  if (!visibleNodeIds || visibleNodeIds.size === 0) return buildCanvasShapeNodeId(shapeIri)

  const preferredNodeId = buildCanvasShapeNodeId(shapeIri)
  if (visibleNodeIds.has(preferredNodeId)) return preferredNodeId

  for (const nodeId of visibleNodeIds) {
    const target = parseCanvasShapeNodeTarget(nodeId)
    if (target?.representedShapeIri === shapeIri) return nodeId
  }

  return null
}
function localName(iri: string): string {
  return iri.split(/[/#]/).filter(Boolean).pop() ?? iri
}

export {
  applyDefaultExtensionEdgeStyle,
  buildCanvasShapeNodeId,
  parseCanvasShapeNodeTarget,
}
export type { ShapeCanvasNodeData }
