import { ref, watch, type Ref } from 'vue'
import type { Edge, Node } from '@vue-flow/core'
import type { NodeShape } from '@/domain/NodeShape'
import {
  buildCanvasShapeNodes,
  buildCanvasStructuralEdges,
  preserveCanvasNodePositions,
  shouldAutoLayoutCanvas,
} from '@/features/mapping/canvasGraphBuilders'
import {
  canvasEdgeTypes,
  canvasNodeTypes,
  defaultPositionForNodeType,
} from '@/features/mapping/mappingExtensionRegistry'
import { layoutMappingGraph } from '@/services/mapping/graphLayout'

interface UseCanvasGraphOptions {
  allShapes: Ref<NodeShape[]>
  canvasShapes: Ref<NodeShape[]>
  openShapePreview: (shape: NodeShape) => void | Promise<void>
}

export function useCanvasGraph(options: UseCanvasGraphOptions) {
  const nodes = ref<Node[]>([])
  const edges = ref<Edge[]>([])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeTypes: any = canvasNodeTypes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const edgeTypes: any = canvasEdgeTypes

  function positionForNewNode(node: Node, index: number): Node['position'] {
    return defaultPositionForNodeType(node.type, index)
  }

  function autoLayoutNodes(nextNodes: Node[], nextEdges: Edge[]): Node[] {
    const layout = layoutMappingGraph as unknown as (nodes: Node[], edges: Edge[]) => Node[]
    return layout(nextNodes, nextEdges)
  }

  function rebuildGraph(): void {
    const shapeNodes: Node[] = buildCanvasShapeNodes(
      options.canvasShapes.value,
      options.allShapes.value,
      new Set(),
      options.openShapePreview,
    )

    const nextNodes: Node[] = shapeNodes
    const visibleNodeIds = new Set(nextNodes.map(node => node.id))
    const structuralEdges: Edge[] = buildCanvasStructuralEdges(
      options.canvasShapes.value,
      options.allShapes.value,
      visibleNodeIds,
    )

    const allEdges: Edge[] = structuralEdges
      .filter(edge => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))

    const existingNodes = nodes.value as Node[]
    if (shouldAutoLayoutCanvas(existingNodes, nextNodes)) {
      nodes.value = autoLayoutNodes(nextNodes, allEdges)
    } else {
      nodes.value = preserveCanvasNodePositions(existingNodes, nextNodes, positionForNewNode)
    }
    edges.value = allEdges
  }

  watch(
    [
      options.canvasShapes,
      options.allShapes,
    ],
    rebuildGraph,
    { immediate: true },
  )

  return {
    nodes,
    edges,
    nodeTypes,
    edgeTypes,
  }
}


