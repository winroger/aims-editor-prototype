import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { MappingState, type MappingEdge, type MappingTransformId } from '@/domain/Mapping'
import type { DataSource } from '@/domain/DataSource'
import type {
  GeoNamesNodeConfig,
  GeoNamesUiEdge,
  LobidNodeConfig,
  LobidUiEdge,
  TransformationNodeConfig,
  TransformationUiEdge,
} from '@/features/mapping/mappingNodeTypes'
import { type GeoNamesOutputField } from '@/services/infrastructure/integrations/geonamesService'
import {
  createExtensionSnapshotState,
  resolveMaterializedNodeOutputSource,
  resetExtensionSnapshotState,
  restoreExtensionSnapshotState,
} from '@/features/mapping/mappingExtensionRegistry'
import type { MappingExtensionStoreApi } from '@/features/mapping/extensions/core/types'
import {
  getDependentTransformationNodeIds,
  getTransformationNodeInputs,
  removeUiEdgeById,
  resolveTransformationMappingInput,
  syncTransformationNodeMappings,
  upsertUiEdge,
} from '@/services/mapping/mappingEdgeSync'
import { cloneMappingEdges, cloneUiEdges, type MappingStoreSnapshot } from '@/services/project/projectSnapshot'
import {
  syncGeoNamesShapeMappings as syncGeoNamesShapeMappingsFromWorkflow,
} from '@/features/mapping/extensions/modules/nodes/geonames/workflow'
import { syncLobidShapeMappings as syncLobidShapeMappingsFromWorkflow } from '@/features/mapping/extensions/modules/nodes/lobid/workflow'
import { useDataStore } from '@/stores/dataStore'

export const useMappingStore = defineStore('mapping', () => {
  const state = reactive(new MappingState()) as MappingState
  const dataStore = useDataStore()
  const extensionState = ref<Record<string, unknown>>({})
  const extensionStateRevision = ref(0)
  let extensionStoreApi: MappingExtensionStoreApi

  function getExtensionState<T>(key: string, fallback: T): T {
    const value = extensionState.value[key]
    return value === undefined ? fallback : value as T
  }

  function setExtensionState<T>(key: string, value: T): void {
    extensionState.value = {
      ...extensionState.value,
      [key]: value,
    }
    extensionStateRevision.value++
  }

  function resetExtensionState(key: string): void {
    const nextState = { ...extensionState.value }
    delete nextState[key]
    extensionState.value = nextState
    extensionStateRevision.value++
  }

  function createExtensionNode<T extends { id: string }>(stateKey: string, idPrefix: string, buildNode: (id: string) => T): T {
    const node = buildNode(`${idPrefix}:${crypto.randomUUID()}`)
    const currentNodes = getExtensionState(stateKey, [] as T[])
    setExtensionState(stateKey, [...currentNodes, node])
    return node
  }

  function findExtensionNode<T extends { id: string }>(stateKey: string, nodeId: string): T | undefined {
    const nodes = getExtensionState(stateKey, [] as T[])
    return nodes.find(node => node.id === nodeId)
  }

  function updateExtensionNode<T extends { id: string }>(stateKey: string, nodeId: string, updateNode: (node: T) => T): void {
    const nodes = getExtensionState(stateKey, [] as T[])
    setExtensionState(stateKey, nodes.map(node => (node.id === nodeId ? updateNode(node) : node)))
  }

  function upsertExtensionUiEdge<T extends { id: string; source: string; sourceHandle: string; target: string; targetHandle: string }>(
    stateKey: string,
    edge: T,
  ): void {
    const currentEdges = getExtensionState(stateKey, [] as T[])
    setExtensionState(stateKey, upsertUiEdge(currentEdges, edge))
  }

  function removeExtensionUiEdge<T extends { id: string; source: string; sourceHandle: string; target: string; targetHandle: string }>(
    stateKey: string,
    edgeId: string,
  ): { nextEdges: T[]; removed?: T } {
    const currentEdges = getExtensionState(stateKey, [] as T[])
    const { nextEdges, removed } = removeUiEdgeById(currentEdges, edgeId)
    setExtensionState(stateKey, nextEdges)
    return {
      nextEdges,
      removed: removed as T | undefined,
    }
  }

  const geoNamesNodes = computed<GeoNamesNodeConfig[]>({
    get: () => getExtensionState('node.geonames.nodes', [] as GeoNamesNodeConfig[]),
    set: value => setExtensionState('node.geonames.nodes', value),
  })
  const geoNamesUiEdges = computed<GeoNamesUiEdge[]>({
    get: () => getExtensionState('node.geonames.uiEdges', [] as GeoNamesUiEdge[]),
    set: value => setExtensionState('node.geonames.uiEdges', value),
  })
  const lobidNodes = computed<LobidNodeConfig[]>({
    get: () => getExtensionState('node.lobid.nodes', [] as LobidNodeConfig[]),
    set: value => setExtensionState('node.lobid.nodes', value),
  })
  const lobidUiEdges = computed<LobidUiEdge[]>({
    get: () => getExtensionState('node.lobid.uiEdges', [] as LobidUiEdge[]),
    set: value => setExtensionState('node.lobid.uiEdges', value),
  })
  const transformationNodes = computed<TransformationNodeConfig[]>({
    get: () => getExtensionState('node.transformation.nodes', [] as TransformationNodeConfig[]),
    set: value => setExtensionState('node.transformation.nodes', value),
  })
  const transformationUiEdges = computed<TransformationUiEdge[]>({
    get: () => getExtensionState('node.transformation.uiEdges', [] as TransformationUiEdge[]),
    set: value => setExtensionState('node.transformation.uiEdges', value),
  })

  function set(edge: MappingEdge): void {
    state.addOrReplace(edge)
  }

  function unset(shapeIri: string, propertyPath: string): void {
    state.remove(shapeIri, propertyPath)
  }

  function addGeoNamesNode(username: string): GeoNamesNodeConfig {
    return createExtensionNode<GeoNamesNodeConfig>('node.geonames.nodes', 'geonames', id => ({
      id,
      username,
      selectedOutputs: ['name', 'id', 'lat', 'lng'] as GeoNamesOutputField[],
      status: 'idle' as const,
      stats: { totalCount: 0, processedCount: 0, cachedCount: 0 },
      results: {},
    }))
  }

  function addLobidNode(selectedProperties: string[] = ['preferredName', 'firstAuthor']): LobidNodeConfig {
    return createExtensionNode<LobidNodeConfig>('node.lobid.nodes', 'lobid', id => ({
      id,
      selectedProperties: [...selectedProperties],
      status: 'idle' as const,
      stats: { totalCount: 0, processedCount: 0, cachedCount: 0 },
      results: {},
    }))
  }

  function addTransformationNode(kind: MappingTransformId = 'lat-lng-to-wkt'): TransformationNodeConfig {
    return createExtensionNode<TransformationNodeConfig>('node.transformation.nodes', 'transform', id => ({
      id,
      kind,
    }))
  }

  function geoNamesWorkflowStore() {
    return {
      state,
      findExtensionNode,
      updateExtensionNode,
      getExtensionState,
      setExtensionState,
      syncTransformationMappings,
    }
  }

  function lobidWorkflowStore() {
    return {
      state,
      findExtensionNode,
      updateExtensionNode,
      getExtensionState,
      setExtensionState,
    }
  }

  function transformationInputsForNode(nodeId: string): { lat?: TransformationUiEdge; lng?: TransformationUiEdge } {
    return getTransformationNodeInputs(nodeId, transformationUiEdges.value)
  }

  function syncTransformationMappings(nodeId: string, sources: DataSource[] = dataStore.sources): void {
    const node = findExtensionNode<TransformationNodeConfig>('node.transformation.nodes', nodeId)
    const input = resolveTransformationMappingInput(
      nodeId,
      transformationUiEdges.value,
      upstreamNodeId => resolveMaterializedNodeOutputSource(upstreamNodeId, {
        dataStore,
        mappingStore: extensionStoreApi,
        sources,
      }),
    )

    if (!node || !input) {
      state.edges = syncTransformationNodeMappings(state.edges, nodeId, undefined, node?.kind ?? '')
      return
    }

    state.edges = syncTransformationNodeMappings(state.edges, nodeId, input, node.kind)
  }

  function syncGeoNamesDependentTransformMappings(nodeId: string): void {
    for (const transformId of getDependentTransformationNodeIds(nodeId, transformationUiEdges.value)) {
      syncTransformationMappings(transformId)
    }
  }

  function upsertGeoNamesUiEdge(edge: GeoNamesUiEdge): void {
    upsertExtensionUiEdge<GeoNamesUiEdge>('node.geonames.uiEdges', edge)
    if (edge.source.startsWith('geonames:') && edge.target.startsWith('shape:')) {
      syncGeoNamesShapeMappingsFromWorkflow(geoNamesWorkflowStore(), dataStore, edge.source)
    }
  }

  function removeGeoNamesUiEdge(edgeId: string): void {
    const { removed } = removeExtensionUiEdge<GeoNamesUiEdge>('node.geonames.uiEdges', edgeId)
    if (removed?.source.startsWith('geonames:') && removed.target.startsWith('shape:')) {
      syncGeoNamesShapeMappingsFromWorkflow(geoNamesWorkflowStore(), dataStore, removed.source)
    }
  }

  function upsertLobidUiEdge(edge: LobidUiEdge): void {
    upsertExtensionUiEdge<LobidUiEdge>('node.lobid.uiEdges', edge)
    if (edge.source.startsWith('lobid:') && edge.target.startsWith('shape:')) {
      syncLobidShapeMappingsFromWorkflow(lobidWorkflowStore(), dataStore, edge.source)
    }
  }

  function removeLobidUiEdge(edgeId: string): void {
    const { removed } = removeExtensionUiEdge<LobidUiEdge>('node.lobid.uiEdges', edgeId)
    if (removed?.source.startsWith('lobid:') && removed.target.startsWith('shape:')) {
      syncLobidShapeMappingsFromWorkflow(lobidWorkflowStore(), dataStore, removed.source)
    }
  }

  function upsertTransformationUiEdge(edge: TransformationUiEdge): void {
    upsertExtensionUiEdge<TransformationUiEdge>('node.transformation.uiEdges', edge)
    if (edge.target.startsWith('transform:')) syncTransformationMappings(edge.target)
  }

  function removeTransformationUiEdge(edgeId: string): void {
    const { removed } = removeExtensionUiEdge<TransformationUiEdge>('node.transformation.uiEdges', edgeId)
    if (removed?.target.startsWith('transform:')) syncTransformationMappings(removed.target)
  }


  /**
   * Imports edges from a mapping.json blob (as exported by RO-Crate bundle).
   * Returns how many edges were applied and how many were skipped.
   */
  function importFromJson(json: string): { imported: number; skipped: number } {
    let imported = 0
    let skipped = 0
    try {
      const parsed = JSON.parse(json)
      const edges: unknown[] = Array.isArray(parsed) ? parsed : parsed?.edges ?? []
      for (const edge of edges) {
        if (
          typeof edge === 'object' && edge !== null
          && typeof (edge as Record<string, unknown>).sourceId === 'string'
          && typeof (edge as Record<string, unknown>).sourceHeader === 'string'
          && typeof (edge as Record<string, unknown>).shapeIri === 'string'
          && typeof (edge as Record<string, unknown>).propertyPath === 'string'
        ) {
          state.addOrReplace(edge as MappingEdge)
          imported++
        } else {
          skipped++
        }
      }
    } catch {
      skipped++
    }
    return { imported, skipped }
  }

  function createSnapshot(): MappingStoreSnapshot {
    return {
      edges: cloneMappingEdges(state.edges),
      extensionState: createExtensionSnapshotState({ mappingStore: extensionStoreApi }),
    }
  }

  function restoreSnapshot(snapshot: MappingStoreSnapshot): void {
    state.edges = cloneMappingEdges(snapshot.edges)
    restoreExtensionSnapshotState(snapshot.extensionState, { mappingStore: extensionStoreApi })
  }

  function reset(): void {
    state.clear()
    resetExtensionSnapshotState({ mappingStore: extensionStoreApi })
  }

  extensionStoreApi = {
    get state() { return state },
    createExtensionNode,
    findExtensionNode,
    updateExtensionNode,
    upsertExtensionUiEdge,
    removeExtensionUiEdge,
    getExtensionState,
    setExtensionState,
    resetExtensionState,
  }

  return {
    state,
    extensionStateRevision,
    geoNamesNodes,
    geoNamesUiEdges,
    lobidNodes,
    lobidUiEdges,
    transformationNodes,
    transformationUiEdges,
    createExtensionNode,
    findExtensionNode,
    updateExtensionNode,
    upsertExtensionUiEdge,
    removeExtensionUiEdge,
    getExtensionState,
    setExtensionState,
    resetExtensionState,
    set,
    unset,
    addGeoNamesNode,
    addLobidNode,
    addTransformationNode,
    transformationInputsForNode,
    syncTransformationMappings,
    upsertGeoNamesUiEdge,
    removeGeoNamesUiEdge,
    upsertLobidUiEdge,
    removeLobidUiEdge,
    upsertTransformationUiEdge,
    removeTransformationUiEdge,
    importFromJson,
    createSnapshot,
    restoreSnapshot,
    reset,
  }
})
