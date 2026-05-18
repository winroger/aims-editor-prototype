import { computed, markRaw, ref, watch, type Ref } from 'vue'
import type { Edge, Node } from '@vue-flow/core'
import type { DataSource } from '@/domain/DataSource'
import type { NodeShape } from '@/domain/NodeShape'
import {
  buildExtensionCanvasEdges,
  buildExtensionCanvasNodes,
  canvasNodeTypes,
  defaultPositionForNodeType,
  findCanvasNodePresentation,
  findRuntimeHandler,
  isAirtableSource,
  resolveMappingEdgeCanvasSource,
  type OpenSetupDialog,
} from '@/features/mapping/mappingExtensionRegistry'
import type { useDataStore } from '@/stores/dataStore'
import type { useMappingStore } from '@/stores/mappingStore'
import GradientEdge from '@/features/mapping/components/canvas/GradientEdge.vue'
import { layoutMappingGraph } from '@/services/mapping/graphLayout'
import { detectLinkedColumns } from '@/services/mapping/linkDetector'
import { loadAirtableCredentials } from '@/services/infrastructure/storage/credentialStore'

type DataStore = ReturnType<typeof useDataStore>
type MappingStore = ReturnType<typeof useMappingStore>

interface ToastLike {
  add(message: {
    severity: string
    summary: string
    detail?: string
    life?: number
  }): void
}

interface UseCanvasGraphOptions {
  dataStore: DataStore
  mappingStore: MappingStore
  sources: Ref<DataSource[]>
  canvasShapes: Ref<NodeShape[]>
  toast: ToastLike
  openSetupDialog: OpenSetupDialog
  openTablePreview: (source: DataSource) => void
  openNodePreview: (nodeId: string) => void
  openShapePreview: (shape: NodeShape) => void | Promise<void>
}

const EDGE_COLOR_DEFAULT = '#6366f1'
const EDGE_COLOR_LINK = '#16a34a'
const EDGE_COLOR_REFERENCE = '#8b5cf6'
const EDGE_COLOR_NEUTRAL = '#d1d5db'

export function useCanvasGraph(options: UseCanvasGraphOptions) {
  const nodes = ref<Node[]>([])
  const edges = ref<Edge[]>([])
  const refreshingAirtableBases = ref<string[]>([])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeTypes: any = canvasNodeTypes

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const edgeTypes: any = {
    gradientEdge: markRaw(GradientEdge),
  }

  const visibleSources = computed(() => options.sources.value.filter(isVisibleSource))

  function findShapeProperty(targetId: string, targetHandle: string): NodeShape['properties'][number] | undefined {
    if (!targetId.startsWith('shape:') || !targetHandle.startsWith('p:')) return undefined
    const shapeIri = targetId.slice(6)
    const propertyPath = targetHandle.slice(2)
    return options.canvasShapes.value
      .find(shape => shape.nodeId.value === shapeIri)
      ?.properties.find(property => property.path?.value === propertyPath)
  }

  function colorForSourceHandle(source: string, sourceHandle: string): string {
    if (source.startsWith('air:')) return EDGE_COLOR_NEUTRAL
    if (source.startsWith('src:')) {
      const sourceId = source.slice(4)
      const sourceHeader = sourceHandle.startsWith('h:') ? sourceHandle.slice(2) : ''
      const sourceObj = visibleSources.value.find(candidate => candidate.id === sourceId)
      if (sourceObj && detectLinkedColumns(sourceObj, [...visibleSources.value]).some(column => column.header === sourceHeader)) {
        return EDGE_COLOR_LINK
      }
      return EDGE_COLOR_LINK
    }
    const presentation = findCanvasNodePresentation(source)
    if (presentation?.outputColor) return presentation.outputColor
    if (source.startsWith('shape:')) return sourceHandle.startsWith('ref:') ? EDGE_COLOR_REFERENCE : EDGE_COLOR_NEUTRAL
    return EDGE_COLOR_DEFAULT
  }

  function colorForTargetHandle(target: string, targetHandle: string): string {
    if (target.startsWith('src:')) return EDGE_COLOR_NEUTRAL
    const presentation = findCanvasNodePresentation(target)
    if (presentation?.inputColor) return presentation.inputColor
    if (target.startsWith('shape:')) {
      if (targetHandle === 'shape-header') return EDGE_COLOR_NEUTRAL
      return findShapeProperty(target, targetHandle)?.node ? EDGE_COLOR_REFERENCE : EDGE_COLOR_DEFAULT
    }
    return EDGE_COLOR_DEFAULT
  }

  function buildGradientEdge(edge: Omit<Edge, 'type'> & { type?: string }): Edge {
    const sourceColor = colorForSourceHandle(edge.source, edge.sourceHandle ?? '')
    const targetColor = colorForTargetHandle(edge.target, edge.targetHandle ?? '')

    return {
      ...edge,
      type: 'gradientEdge',
      data: {
        ...(edge.data ?? {}),
        sourceColor,
        targetColor,
      },
    }
  }

  function isRefreshingAirtableBase(baseId: string): boolean {
    return refreshingAirtableBases.value.includes(baseId)
  }

  function setAirtableEdgeVisibility(baseId: string, isVisible: boolean): void {
    const edgePrefix = `air:${baseId}->`
    const updatedEdges = edges.value.slice() as Edge[]
    for (let index = 0; index < updatedEdges.length; index++) {
      const edge = updatedEdges[index]
      if (!edge?.id.startsWith(edgePrefix)) continue

      updatedEdges[index] = {
        ...edge,
        style: {
          ...(edge.style ?? {}),
          opacity: isVisible ? 1 : 0,
        },
      }
    }
    edges.value = updatedEdges
  }

  function positionForNewNode(node: Node, index: number): Node['position'] {
    return defaultPositionForNodeType(node.type, index)
  }

  function preserveNodePositions(nextNodes: Node[]): Node[] {
    const existingPositions = new Map<string, Node['position']>()
    for (const node of nodes.value) {
      existingPositions.set(node.id, node.position)
    }
    return nextNodes.map((node, index) => ({
      ...node,
      position: existingPositions.get(node.id) ?? positionForNewNode(node, index),
    }))
  }

  function shouldAutoLayout(nextNodes: Node[]): boolean {
    if (nodes.value.length === 0) return nextNodes.length > 0

    const existingIds = new Set<string>()
    for (const node of nodes.value) {
      existingIds.add(node.id)
    }

    return nextNodes.some(node => !existingIds.has(node.id))
  }

  async function refreshAirtableBase(baseId: string): Promise<void> {
    if (isRefreshingAirtableBase(baseId)) return

    const creds = await loadAirtableCredentials()
    if (!creds?.pat) {
      options.toast.add({
        severity: 'warn',
        summary: 'No Airtable token stored',
        detail: 'Reconnect Airtable before refreshing data.',
        life: 4000,
      })
      return
    }

    refreshingAirtableBases.value = [...refreshingAirtableBases.value, baseId]
    try {
      const refreshed = await options.dataStore.refreshAirtableBase(creds.pat, baseId)
      options.toast.add({
        severity: 'success',
        summary: 'Airtable updated',
        detail: `${refreshed} table(s) reloaded. Existing mappings were preserved.`,
        life: 4000,
      })
    } catch (err) {
      options.toast.add({
        severity: 'error',
        summary: 'Airtable refresh failed',
        detail: err instanceof Error ? err.message : String(err),
        life: 5000,
      })
    } finally {
      refreshingAirtableBases.value = refreshingAirtableBases.value.filter(id => id !== baseId)
    }
  }

  async function runNode(nodeId: string): Promise<void> {
    const runtimeHandler = findRuntimeHandler(nodeId)
    if (!runtimeHandler) return

    try {
      const result = await runtimeHandler.run(nodeId, {
        dataStore: options.dataStore,
        mappingStore: options.mappingStore,
        sources: options.sources.value,
      })
      options.toast.add({
        severity: 'success',
        summary: result.successSummary,
        detail: result.successDetail,
        life: 3500,
      })
    } catch (err) {
      options.toast.add({
        severity: 'error',
        summary: runtimeHandler.errorSummary,
        detail: err instanceof Error ? err.message : String(err),
        life: 5000,
      })
    }
  }

  function rebuildGraph(): void {
    const extensionNodes = buildExtensionCanvasNodes({
      dataStore: options.dataStore,
      mappingStore: options.mappingStore,
      visibleSources: visibleSources.value,
      openSetupDialog: options.openSetupDialog,
      openNodePreview: options.openNodePreview,
      isRefreshingAirtableBase,
      refreshAirtableBase,
      setAirtableEdgeVisibility,
      runNode,
    })
    const extensionEdges = buildExtensionCanvasEdges({
      dataStore: options.dataStore,
      mappingStore: options.mappingStore,
      visibleSources: visibleSources.value,
      openSetupDialog: options.openSetupDialog,
      openNodePreview: options.openNodePreview,
      isRefreshingAirtableBase,
      refreshAirtableBase,
      setAirtableEdgeVisibility,
      runNode,
    }).map(edge => buildGradientEdge(edge))

    const tableNodes: Node[] = visibleSources.value.map(src => ({
      id: `src:${src.id}`,
      type: 'tableNode',
      position: { x: 0, y: 0 },
      data: { source: src, onPreview: () => options.openTablePreview(src) },
    }))

    const shapeNodes: Node[] = options.canvasShapes.value.map(shape => ({
      id: `shape:${shape.nodeId.value}`,
      type: 'shapeNode',
      position: { x: 0, y: 0 },
      data: { shape, onPreview: () => options.openShapePreview(shape) },
    }))

    const mappingEdges: Edge[] = options.mappingStore.state.edges.map(edge => {
      const targetShape = options.canvasShapes.value.find(shape => shape.nodeId.value === edge.shapeIri)
      const targetProp = targetShape?.properties.find(property => property.path?.value === edge.propertyPath)
      const sourceDescriptor = resolveMappingEdgeCanvasSource(edge) ?? { source: `src:${edge.sourceId}` }
      return buildGradientEdge({
        id: `e:${edge.shapeIri}::${edge.propertyPath}`,
        source: sourceDescriptor.source,
        sourceHandle: sourceDescriptor.sourceHandle ?? `h:${edge.sourceHeader}`,
        target: `shape:${edge.shapeIri}`,
        targetHandle: `p:${edge.propertyPath}`,
        animated: true,
        style: { strokeWidth: 2 },
        data: {
          isFkProp: Boolean(targetProp?.node),
        },
      })
    })

    const canvasIriSet = new Set(options.canvasShapes.value.map(shape => shape.nodeId.value))
    const structuralEdges: Edge[] = []

    for (const source of visibleSources.value) {
      if (!isAirtableSource(source) || !source.sync?.baseId) continue
      structuralEdges.push({
        id: `air:${source.sync.baseId}->${source.id}`,
        source: `air:${source.sync.baseId}`,
        sourceHandle: 'airtable-out',
        target: `src:${source.id}`,
        targetHandle: 'table-parent',
        type: 'bezier',
        animated: false,
        style: { stroke: '#d1d5db', strokeWidth: 2, opacity: 0 },
      })
    }

    for (const source of visibleSources.value) {
      const linkedColumns = detectLinkedColumns(source, visibleSources.value)
      for (const linkedColumn of linkedColumns) {
        if (!linkedColumn.bestTargetSourceId) continue
        structuralEdges.push({
          id: `tbl:${source.id}::${linkedColumn.header}->${linkedColumn.bestTargetSourceId}`,
          source: `src:${source.id}`,
          sourceHandle: `h:${linkedColumn.header}`,
          target: `src:${linkedColumn.bestTargetSourceId}`,
          targetHandle: 'table-parent',
          type: 'bezier',
          animated: false,
          style: { stroke: '#d1d5db', strokeWidth: 2, strokeDasharray: '6 3' },
        })
      }
    }

    for (const shape of options.canvasShapes.value) {
      for (const property of shape.properties) {
        if (!property.node || !property.path) continue
        if (!canvasIriSet.has(property.node.value)) continue
        structuralEdges.push({
          id: `ref:${shape.nodeId.value}::${property.path.value}->${property.node.value}`,
          source: `shape:${shape.nodeId.value}`,
          sourceHandle: `ref:${property.path.value}`,
          target: `shape:${property.node.value}`,
          targetHandle: 'shape-header',
          type: 'bezier',
          animated: false,
          style: { stroke: '#d1d5db', strokeWidth: 2, strokeDasharray: '6 3' },
        })
      }
    }

    const allEdges = [...mappingEdges, ...structuralEdges, ...extensionEdges]
    const nextNodes = [...extensionNodes, ...tableNodes, ...shapeNodes]
    nodes.value = shouldAutoLayout(nextNodes)
      ? layoutMappingGraph(nextNodes, allEdges)
      : preserveNodePositions(nextNodes)
    edges.value = allEdges
  }

  watch(
    [
      () => options.sources.value.length,
      () => options.sources.value.map(source => source.id).join('|'),
      () => refreshingAirtableBases.value.join('|'),
      () => options.mappingStore.extensionStateRevision,
      options.canvasShapes,
      () => options.mappingStore.state.edges.length,
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

function isVisibleSource(source: DataSource): boolean {
  return !source.hidden
}