import { defineAsyncComponent, markRaw } from 'vue'
import { createMappingExtensionModule } from '@/features/mapping/extensions/core/createMappingExtensionModule'
import type { ExtensionCanvasBuildContext, MappingExtensionSnapshotContext } from '@/features/mapping/extensions/core/types'
import type { LobidNodeConfig, LobidUiEdge } from '@/features/mapping/mappingNodeTypes'
import {
  getLobidNode,
  getLobidUiEdges,
  LOBID_NODE_STATE_KEY,
  LOBID_UI_EDGE_STATE_KEY,
  materializeLobidOutputSource,
  runLobidNode,
} from '@/features/mapping/extensions/modules/nodes/lobid/workflow'
import { cloneUiEdges } from '@/services/project/projectSnapshot'

const LobidEnrichmentPanel = defineAsyncComponent(() => import('@/features/mapping/components/setup/LobidEnrichmentPanel.vue'))
const EnrichNode = defineAsyncComponent(() => import('@/features/mapping/components/canvas/EnrichNode.vue'))

function getLobidNodes(context: ExtensionCanvasBuildContext | MappingExtensionSnapshotContext): LobidNodeConfig[] {
  return context.mappingStore.getExtensionState(LOBID_NODE_STATE_KEY, [] as LobidNodeConfig[])
}

function getCanvasLobidUiEdges(context: ExtensionCanvasBuildContext | MappingExtensionSnapshotContext): LobidUiEdge[] {
  return getLobidUiEdges(context.mappingStore)
}

export const lobidModule = createMappingExtensionModule({
  id: 'node.lobid',
  setupDialogs: [
    {
      id: 'lobid-enrichment',
      header: 'Lobid Enrichment',
      width: '820px',
      component: LobidEnrichmentPanel,
      buildProps: payload => ({
        nodeId: payload?.nodeId,
      }),
    },
  ],
  mappingNodeActions: [
    {
      id: 'lobid',
      label: 'Lobid',
      icon: 'pi pi-book',
      category: 'enrichment',
      dialogId: 'lobid-enrichment',
    },
  ],
  canvasNodeTypes: {
    enrichNode: markRaw(EnrichNode),
  },
  canvasNodePresentationHandlers: [
    {
      id: 'node.lobid.canvas-presentation',
      canPresent: nodeId => nodeId.startsWith('lobid:'),
      presentation: {
        inputColor: '#14b8a6',
        outputColor: '#0f766e',
      },
    },
  ],
  mappingEdgeSourceHandlers: [
    {
      id: 'node.lobid.mapping-edge-source',
      canResolve: edge => Boolean(edge.lobidNodeId),
      resolve: edge => ({ source: edge.lobidNodeId! }),
    },
  ],
  canvasModules: [
    {
      id: 'lobid',
      buildNodes: context => getLobidNodes(context).map(node => ({
        id: node.id,
        type: 'enrichNode',
        position: { x: 0, y: 0 },
        data: {
          title: 'Lobid',
          subtitle: 'Work extension',
          icon: 'pi pi-book',
          inputHandleId: 'lobid-input',
          inputLabel: 'Connect a Lobid or GND work ID in the canvas',
          status: node.status,
          processedCount: node.stats.processedCount,
          totalCount: node.stats.totalCount,
          cachedCount: node.stats.cachedCount,
          outputs: node.selectedProperties.map(property => ({
            id: `h:${property}`,
            label: property,
          })),
          actionLabel: node.stats.totalCount > 0 ? 'Refresh' : 'Run',
          footerNote: 'Outputs available for manual wiring',
          lastError: node.stats.lastError,
          theme: {
            headerBackground: '#ccfbf1',
            headerColor: '#115e59',
            headerSubtleColor: '#0f766e',
            previewBorderColor: 'rgba(17, 94, 89, 0.18)',
            inputHandleColor: '#14b8a6',
            outputHandleColor: '#0f766e',
          },
          onOpenConfig: () => context.openSetupDialog('lobid-enrichment', { nodeId: node.id }),
          onPreview: () => context.openNodePreview(node.id),
          onRun: () => context.runNode(node.id),
        },
      })),
      buildEdges: context => getCanvasLobidUiEdges(context)
        .filter(edge => !edge.target.startsWith('shape:'))
        .map(edge => ({
          id: edge.id,
          source: edge.source,
          sourceHandle: edge.sourceHandle,
          target: edge.target,
          targetHandle: edge.targetHandle,
          animated: false,
          style: { strokeWidth: 2, strokeDasharray: '8 4' },
        })),
    },
  ],
  defaultNodePositions: {
    enrichNode: { x: 620, y: 40 },
  },
  previewHandlers: [
    {
      id: 'node.lobid.preview',
      canPreview: nodeId => nodeId.startsWith('lobid:'),
      preview: (nodeId, context) => {
        const node = getLobidNode(context.mappingStore, nodeId)
        const outputSourceId = materializeLobidOutputSource(context.mappingStore, context.dataStore, nodeId, context.sources)
        if (!node || !outputSourceId) {
          context.toast.add({
            severity: 'info',
            summary: 'No Lobid output yet',
            detail: 'Run the Lobid node first to inspect the fetched output.',
            life: 3500,
          })
          return
        }

        const source = context.dataStore.findById(outputSourceId)
        if (!source) {
          context.toast.add({
            severity: 'warn',
            summary: 'Lobid output unavailable',
            detail: 'Run the Lobid node again to rebuild the output preview.',
            life: 4000,
          })
          return
        }

        context.openTablePreview(source)
      },
    },
  ],
  outputSourceHandlers: [
    {
      id: 'node.lobid.output-source',
      canResolve: nodeId => nodeId.startsWith('lobid:'),
      resolve: (nodeId, context) =>
        materializeLobidOutputSource(context.mappingStore, context.dataStore, nodeId, context.sources),
    },
  ],
  runtimeHandlers: [
    {
      id: 'node.lobid.runtime',
      canRun: nodeId => nodeId.startsWith('lobid:'),
      errorSummary: 'Lobid failed',
      run: async (nodeId, context) => {
        await runLobidNode(context.mappingStore, context.dataStore, nodeId, context.sources)
        const node = getLobidNode(context.mappingStore, nodeId)
        return {
          successSummary: 'Lobid processed',
          successDetail: node
            ? `${node.stats.processedCount}/${node.stats.totalCount} IDs processed, ${node.stats.cachedCount} from cache.`
            : 'Lobid enrichment completed.',
        }
      },
    },
  ],
  connectionHandlers: [
    {
      id: 'node.lobid.connections',
      canHandleConnection: connection => (
        (connection.source?.startsWith('src:') && connection.target?.startsWith('lobid:'))
        || (connection.source?.startsWith('lobid:') && connection.target?.startsWith('shape:'))
      ),
      connect: (connection, context) => {
        const sourceHandle = connection.sourceHandle ?? ''
        const targetHandle = connection.targetHandle ?? ''

        if (connection.source?.startsWith('src:') && connection.target?.startsWith('lobid:')) {
          if (!sourceHandle.startsWith('h:') || targetHandle !== 'lobid-input') return false
          context.mappingStore.upsertExtensionUiEdge(LOBID_UI_EDGE_STATE_KEY, {
            id: `lobid-ui:${connection.target}:input`,
            source: connection.source,
            sourceHandle,
            target: connection.target,
            targetHandle,
          })
          return true
        }

        if (connection.source?.startsWith('lobid:') && connection.target?.startsWith('shape:')) {
          if (!sourceHandle.startsWith('h:') || !targetHandle.startsWith('p:')) return false
          context.mappingStore.upsertExtensionUiEdge(LOBID_UI_EDGE_STATE_KEY, {
            id: `lobid-ui:${connection.source}:${sourceHandle}->${connection.target}:${targetHandle}`,
            source: connection.source,
            sourceHandle,
            target: connection.target,
            targetHandle,
          })
          return true
        }

        return false
      },
      deleteUiEdge: (edgeId, context) => {
        if (!edgeId.startsWith('lobid-ui:')) return false
        context.mappingStore.removeExtensionUiEdge(LOBID_UI_EDGE_STATE_KEY, edgeId)
        return true
      },
      deleteMappingEdge: (edge, shapeIri, propertyPath, context) => {
        if (!edge.lobidNodeId) return false
        const uiEdge = getCanvasLobidUiEdges(context).find(candidate =>
          candidate.source === edge.lobidNodeId
          && candidate.sourceHandle === `h:${edge.sourceHeader}`
          && candidate.target === `shape:${shapeIri}`
          && candidate.targetHandle === `p:${propertyPath}`,
        )
        if (!uiEdge) return false
        context.mappingStore.removeExtensionUiEdge(LOBID_UI_EDGE_STATE_KEY, uiEdge.id)
        return true
      },
    },
  ],
  snapshotHandlers: [
    {
      id: 'node.lobid',
      createState: context => ({
        nodes: getLobidNodes(context).map(node => ({
          ...node,
          selectedProperties: [...node.selectedProperties],
          stats: { ...node.stats },
          results: Object.fromEntries(Object.entries(node.results).map(([key, value]) => [key, { ...value }])),
        })),
        uiEdges: cloneUiEdges(getCanvasLobidUiEdges(context)),
      }),
      restoreState: (state, context) => {
        const nextState = (state && typeof state === 'object') ? state as { nodes?: LobidNodeConfig[]; uiEdges?: LobidUiEdge[] } : {}
        context.mappingStore.setExtensionState(LOBID_NODE_STATE_KEY, (nextState.nodes ?? []).map(node => ({
          ...node,
          selectedProperties: [...node.selectedProperties],
          stats: { ...node.stats },
          results: Object.fromEntries(Object.entries(node.results).map(([key, value]) => [key, { ...value }])),
        })))
        context.mappingStore.setExtensionState(LOBID_UI_EDGE_STATE_KEY, cloneUiEdges(nextState.uiEdges ?? []))
      },
      resetState: context => {
        context.mappingStore.resetExtensionState(LOBID_NODE_STATE_KEY)
        context.mappingStore.resetExtensionState(LOBID_UI_EDGE_STATE_KEY)
      },
    },
  ],
})