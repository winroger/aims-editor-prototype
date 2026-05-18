import { defineAsyncComponent, markRaw } from 'vue'
import { createMappingExtensionModule } from '@/features/mapping/extensions/core/createMappingExtensionModule'
import type { ExtensionCanvasBuildContext, MappingExtensionSnapshotContext } from '@/features/mapping/extensions/core/types'
import type { GeoNamesNodeConfig, GeoNamesUiEdge } from '@/features/mapping/mappingNodeTypes'
import {
  GEONAMES_NODE_STATE_KEY,
  GEONAMES_UI_EDGE_STATE_KEY,
  getGeoNamesNode,
  getGeoNamesUiEdges,
  materializeGeoNamesOutputSource,
  runGeoNamesNode,
} from '@/features/mapping/extensions/modules/nodes/geonames/workflow'
import { cloneUiEdges } from '@/services/project/projectSnapshot'

const GeoNamesEnrichmentPanel = defineAsyncComponent(() => import('@/features/mapping/components/setup/GeoNamesEnrichmentPanel.vue'))
const EnrichNode = defineAsyncComponent(() => import('@/features/mapping/components/canvas/EnrichNode.vue'))

const outputLabelById = new Map<string, string>([
  ['name', 'Name'],
  ['id', 'GeoNames ID'],
  ['lat', 'Latitude'],
  ['lng', 'Longitude'],
  ['countryName', 'Country'],
  ['countryCode', 'Country code'],
  ['featureClass', 'Feature class'],
  ['featureCode', 'Feature code'],
  ['population', 'Population'],
  ['wikipediaURL', 'Wikipedia URL'],
] as const)

function getGeoNamesNodes(context: ExtensionCanvasBuildContext | MappingExtensionSnapshotContext): GeoNamesNodeConfig[] {
  return context.mappingStore.getExtensionState(GEONAMES_NODE_STATE_KEY, [] as GeoNamesNodeConfig[])
}

function getCanvasGeoNamesUiEdges(context: ExtensionCanvasBuildContext | MappingExtensionSnapshotContext): GeoNamesUiEdge[] {
  return getGeoNamesUiEdges(context.mappingStore)
}

export const geoNamesModule = createMappingExtensionModule({
  id: 'node.geonames',
  setupDialogs: [
    {
      id: 'geonames-enrichment',
      header: 'GeoNames Enrichment',
      width: '720px',
      component: GeoNamesEnrichmentPanel,
      buildProps: payload => ({
        nodeId: payload?.nodeId,
      }),
    },
  ],
  mappingNodeActions: [
    {
      id: 'geonames',
      label: 'GeoNames',
      icon: 'pi pi-map-marker',
      category: 'enrichment',
      dialogId: 'geonames-enrichment',
    },
  ],
  canvasNodeTypes: {
    enrichNode: markRaw(EnrichNode),
  },
  canvasNodePresentationHandlers: [
    {
      id: 'node.geonames.canvas-presentation',
      canPresent: nodeId => nodeId.startsWith('geonames:'),
      presentation: {
        inputColor: '#0ea5e9',
        outputColor: '#0284c7',
      },
    },
  ],
  mappingEdgeSourceHandlers: [
    {
      id: 'node.geonames.mapping-edge-source',
      canResolve: edge => Boolean(edge.geoNamesNodeId),
      resolve: edge => ({ source: edge.geoNamesNodeId! }),
    },
  ],
  canvasModules: [
    {
      id: 'geonames',
      buildNodes: context => getGeoNamesNodes(context).map(node => ({
        id: node.id,
        type: 'enrichNode',
        position: { x: 0, y: 0 },
        data: {
          title: 'GeoNames',
          subtitle: node.username,
          icon: 'pi pi-map-marker',
          inputHandleId: 'geo-input',
          inputLabel: 'Connect a GeoNames ID in the canvas',
          status: node.status,
          processedCount: node.stats.processedCount,
          totalCount: node.stats.totalCount,
          cachedCount: node.stats.cachedCount,
          outputs: node.selectedOutputs.map(output => ({
            id: `h:${output}`,
            label: outputLabelById.get(output) ?? output,
          })),
          actionLabel: node.stats.totalCount > 0 ? 'Refresh' : 'Run',
          footerNote: 'Outputs available for manual wiring',
          lastError: node.stats.lastError,
          theme: {
            headerBackground: '#e0f2fe',
            headerColor: '#0f4c81',
            headerSubtleColor: '#0369a1',
            previewBorderColor: 'rgba(15, 76, 129, 0.18)',
            inputHandleColor: '#0ea5e9',
            outputHandleColor: '#0284c7',
          },
          onOpenConfig: () => context.openSetupDialog('geonames-enrichment', { nodeId: node.id }),
          onPreview: () => context.openNodePreview(node.id),
          onRun: () => context.runNode(node.id),
        },
      })),
      buildEdges: context => getCanvasGeoNamesUiEdges(context)
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
      id: 'node.geonames.preview',
      canPreview: nodeId => nodeId.startsWith('geonames:'),
      preview: (nodeId, context) => {
        const node = getGeoNamesNode(context.mappingStore, nodeId)
        const outputSourceId = materializeGeoNamesOutputSource(context.mappingStore, context.dataStore, nodeId, context.sources)
        if (!node || !outputSourceId) {
          context.toast.add({
            severity: 'info',
            summary: 'No GeoNames output yet',
            detail: 'Run the GeoNames node first to inspect the fetched output.',
            life: 3500,
          })
          return
        }

        const source = context.dataStore.findById(outputSourceId)
        if (!source) {
          context.toast.add({
            severity: 'warn',
            summary: 'GeoNames output unavailable',
            detail: 'Run the GeoNames node again to rebuild the output preview.',
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
      id: 'node.geonames.output-source',
      canResolve: nodeId => nodeId.startsWith('geonames:'),
      resolve: (nodeId, context) =>
        materializeGeoNamesOutputSource(context.mappingStore, context.dataStore, nodeId, context.sources),
    },
  ],
  runtimeHandlers: [
    {
      id: 'node.geonames.runtime',
      canRun: nodeId => nodeId.startsWith('geonames:'),
      errorSummary: 'GeoNames failed',
      run: async (nodeId, context) => {
        await runGeoNamesNode(context.mappingStore, context.dataStore, nodeId, context.sources)
        const node = getGeoNamesNode(context.mappingStore, nodeId)
        return {
          successSummary: 'GeoNames processed',
          successDetail: node
            ? `${node.stats.processedCount}/${node.stats.totalCount} IDs processed, ${node.stats.cachedCount} from cache.`
            : 'GeoNames enrichment completed.',
        }
      },
    },
  ],
  connectionHandlers: [
    {
      id: 'node.geonames.connections',
      canHandleConnection: connection => (
        (connection.source?.startsWith('src:') && connection.target?.startsWith('geonames:'))
        || (connection.source?.startsWith('geonames:') && connection.target?.startsWith('shape:'))
      ),
      connect: (connection, context) => {
        const sourceHandle = connection.sourceHandle ?? ''
        const targetHandle = connection.targetHandle ?? ''

        if (connection.source?.startsWith('src:') && connection.target?.startsWith('geonames:')) {
          if (!sourceHandle.startsWith('h:') || targetHandle !== 'geo-input') return false
          context.mappingStore.upsertExtensionUiEdge(GEONAMES_UI_EDGE_STATE_KEY, {
            id: `geo-ui:${connection.target}:input`,
            source: connection.source,
            sourceHandle,
            target: connection.target,
            targetHandle,
          })
          return true
        }

        if (connection.source?.startsWith('geonames:') && connection.target?.startsWith('shape:')) {
          if (!sourceHandle.startsWith('h:') || !targetHandle.startsWith('p:')) return false
          context.mappingStore.upsertExtensionUiEdge(GEONAMES_UI_EDGE_STATE_KEY, {
            id: `geo-ui:${connection.source}:${sourceHandle}->${connection.target}:${targetHandle}`,
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
        if (!edgeId.startsWith('geo-ui:')) return false
        context.mappingStore.removeExtensionUiEdge(GEONAMES_UI_EDGE_STATE_KEY, edgeId)
        return true
      },
      deleteMappingEdge: (edge, shapeIri, propertyPath, context) => {
        if (!edge.geoNamesNodeId) return false
        const uiEdge = getCanvasGeoNamesUiEdges(context).find(candidate =>
          candidate.source === edge.geoNamesNodeId
          && candidate.sourceHandle === `h:${edge.sourceHeader}`
          && candidate.target === `shape:${shapeIri}`
          && candidate.targetHandle === `p:${propertyPath}`,
        )
        if (!uiEdge) return false
        context.mappingStore.removeExtensionUiEdge(GEONAMES_UI_EDGE_STATE_KEY, uiEdge.id)
        return true
      },
    },
  ],
  snapshotHandlers: [
    {
      id: 'node.geonames',
      createState: context => ({
        nodes: getGeoNamesNodes(context).map(node => ({
          ...node,
          selectedOutputs: [...node.selectedOutputs],
          stats: { ...node.stats },
          results: Object.fromEntries(Object.entries(node.results).map(([key, value]) => [key, { ...value }])),
        })),
        uiEdges: cloneUiEdges(getCanvasGeoNamesUiEdges(context)),
      }),
      restoreState: (state, context) => {
        const nextState = (state && typeof state === 'object') ? state as { nodes?: GeoNamesNodeConfig[]; uiEdges?: GeoNamesUiEdge[] } : {}
        context.mappingStore.setExtensionState(GEONAMES_NODE_STATE_KEY, (nextState.nodes ?? []).map(node => ({
          ...node,
          selectedOutputs: [...node.selectedOutputs],
          stats: { ...node.stats },
          results: Object.fromEntries(Object.entries(node.results).map(([key, value]) => [key, { ...value }])),
        })))
        context.mappingStore.setExtensionState(GEONAMES_UI_EDGE_STATE_KEY, cloneUiEdges(nextState.uiEdges ?? []))
      },
      resetState: context => {
        context.mappingStore.resetExtensionState(GEONAMES_NODE_STATE_KEY)
        context.mappingStore.resetExtensionState(GEONAMES_UI_EDGE_STATE_KEY)
      },
    },
  ],
})