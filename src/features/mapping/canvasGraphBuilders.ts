import type { Edge, Node } from '@vue-flow/core'
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

export function buildCanvasStructuralEdges(
  rootShapes: NodeShape[],
  allShapes: NodeShape[] = rootShapes,
  visibleNodeIds?: Set<string>,
): Edge[] {
  return buildShapeReferenceEdges(rootShapes, allShapes, visibleNodeIds)
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

export {
  applyDefaultExtensionEdgeStyle,
  buildCanvasShapeNodeId,
  parseCanvasShapeNodeTarget,
}
export type { ShapeCanvasNodeData }
