import type { DataSource } from '@/domain/DataSource'
import type { LobidNodeConfig, LobidUiEdge } from '@/features/mapping/mappingNodeTypes'
import type { MappingExtensionStoreApi } from '@/features/mapping/extensions/core/types'
import { runLobidRuntime } from '@/services/mapping/enrichmentNodeRuntime'
import type { useMappingStore } from '@/stores/mappingStore'
import type { useDataStore } from '@/stores/dataStore'
import { applyLobidNodePatch, syncLobidNodeMappings } from '@/services/mapping/mappingEdgeSync'
import { materializeEnrichmentOutputSource } from '@/services/mapping/enrichmentRuntime'

type MappingStore = ReturnType<typeof useMappingStore>
type DataStore = ReturnType<typeof useDataStore>
type LobidReadStore = Pick<MappingExtensionStoreApi, 'findExtensionNode' | 'getExtensionState'>
type LobidMutationStore = LobidReadStore & Pick<MappingStore, 'updateExtensionNode' | 'setExtensionState' | 'state'>
type LobidRuntimeStore = LobidMutationStore

export const LOBID_NODE_STATE_KEY = 'node.lobid.nodes'
export const LOBID_UI_EDGE_STATE_KEY = 'node.lobid.uiEdges'

export function getLobidNode(mappingStore: LobidReadStore, nodeId: string): LobidNodeConfig | undefined {
  return mappingStore.findExtensionNode<LobidNodeConfig>(LOBID_NODE_STATE_KEY, nodeId)
}

export function getLobidUiEdges(mappingStore: LobidReadStore): LobidUiEdge[] {
  return mappingStore.getExtensionState(LOBID_UI_EDGE_STATE_KEY, [] as LobidUiEdge[])
}

export function getLobidInputEdge(mappingStore: LobidReadStore, nodeId: string): LobidUiEdge | undefined {
  return getLobidUiEdges(mappingStore).find(edge => edge.target === nodeId && edge.targetHandle === 'lobid-input')
}

export function materializeLobidOutputSource(
  mappingStore: LobidReadStore,
  dataStore: DataStore,
  nodeId: string,
  sources: DataSource[],
): string | undefined {
  const node = getLobidNode(mappingStore, nodeId)
  if (!node?.inputSourceId || !node.inputHeader) return node?.outputSourceId
  const source = sources.find(candidate => candidate.id === node.inputSourceId)
  if (!source) return node.outputSourceId
  const outputSourceId = materializeEnrichmentOutputSource({
    source,
    inputHeader: node.inputHeader,
    results: node.results,
    fields: node.selectedProperties,
    readField: (record, property) => record?.[property] ?? '',
    addResultSource: (headers, rows, recordIds) =>
      dataStore.addLobidResultSource(nodeId, headers, rows, recordIds),
  })
  if (!outputSourceId) return node.outputSourceId

  if (node.outputSourceId !== outputSourceId) {
    updateLobidNode(mappingStore as LobidMutationStore, dataStore, nodeId, { outputSourceId })
  }

  return outputSourceId
}

export function syncLobidShapeMappings(
  mappingStore: LobidMutationStore,
  dataStore: DataStore,
  nodeId: string,
  sources: DataSource[] = dataStore.sources,
): void {
  const outputSourceId = materializeLobidOutputSource(mappingStore, dataStore, nodeId, sources)
  const uiEdges = getLobidUiEdges(mappingStore)
  mappingStore.state.edges = syncLobidNodeMappings(mappingStore.state.edges, nodeId, outputSourceId, uiEdges)
}

export function updateLobidNode(
  mappingStore: LobidMutationStore,
  dataStore: DataStore,
  nodeId: string,
  patch: Partial<Omit<LobidNodeConfig, 'id'>>,
): void {
  mappingStore.updateExtensionNode<LobidNodeConfig>(LOBID_NODE_STATE_KEY, nodeId, node => {
    const { nextNode, nextEdges } = applyLobidNodePatch(node, patch, getLobidUiEdges(mappingStore))

    if (patch.selectedProperties) {
      mappingStore.setExtensionState(LOBID_UI_EDGE_STATE_KEY, nextEdges)
      syncLobidShapeMappings(mappingStore, dataStore, nodeId)
    }

    return nextNode
  })
}

export async function runLobidNode(
  mappingStore: LobidRuntimeStore,
  dataStore: DataStore,
  nodeId: string,
  sources: DataSource[],
  forceRefresh = false,
): Promise<void> {
  const node = getLobidNode(mappingStore, nodeId)
  if (!node) throw new Error('Lobid node not found.')
  const inputEdge = getLobidInputEdge(mappingStore, nodeId)
  if (!inputEdge) throw new Error('Connect a source column to the Lobid input first.')

  const sourceId = inputEdge.source.startsWith('src:') ? inputEdge.source.slice(4) : ''
  const sourceHeader = inputEdge.sourceHandle.startsWith('h:') ? inputEdge.sourceHandle.slice(2) : ''
  if (node.selectedProperties.length === 0) throw new Error('Select at least one Lobid property.')

  updateLobidNode(mappingStore, dataStore, nodeId, {
    status: 'running',
    stats: { totalCount: 0, processedCount: 0, cachedCount: 0, lastError: undefined },
  })

  try {
    const batch = await runLobidRuntime({
      nodeId,
      selectedProperties: node.selectedProperties,
      inputSourceId: sourceId,
      inputHeader: sourceHeader,
      sources,
      forceRefresh,
      addResultSource: (resultNodeId, headers, rows, recordIds) =>
        dataStore.addLobidResultSource(resultNodeId, headers, rows, recordIds),
    })

    updateLobidNode(mappingStore, dataStore, nodeId, {
      inputSourceId: batch.inputSourceId,
      inputHeader: batch.inputHeader,
      outputSourceId: batch.outputSourceId,
      status: 'success',
      results: batch.results,
      stats: {
        totalCount: batch.totalCount,
        processedCount: batch.processedCount,
        cachedCount: batch.cachedCount,
        lastRunAt: new Date().toISOString(),
        lastError: undefined,
      },
    })
    syncLobidShapeMappings(mappingStore, dataStore, nodeId, sources)
  } catch (error) {
    updateLobidNode(mappingStore, dataStore, nodeId, {
      status: 'error',
      stats: {
        ...node.stats,
        lastError: error instanceof Error ? error.message : String(error),
      },
    })
    throw error
  }
}