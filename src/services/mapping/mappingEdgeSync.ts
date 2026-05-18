import type { MappingEdge } from '@/domain/Mapping'
import type {
  GeoNamesNodeConfig,
  GeoNamesUiEdge,
  LobidNodeConfig,
  LobidUiEdge,
  TransformationUiEdge,
} from '@/features/mapping/mappingNodeTypes'

interface UiEdgeLike {
  id: string
  target: string
  targetHandle: string
}

export interface TransformationNodeInputs {
  lat?: TransformationUiEdge
  lng?: TransformationUiEdge
}

export function upsertUiEdge<EdgeType extends UiEdgeLike>(
  edges: EdgeType[],
  edge: EdgeType,
): EdgeType[] {
  const nextEdges = edges.filter(candidate =>
    !(candidate.target === edge.target && candidate.targetHandle === edge.targetHandle),
  )
  nextEdges.push(edge)
  return nextEdges
}

export function removeUiEdgeById<EdgeType extends UiEdgeLike>(
  edges: EdgeType[],
  edgeId: string,
): { nextEdges: EdgeType[]; removed?: EdgeType } {
  const removed = edges.find(edge => edge.id === edgeId)
  return {
    nextEdges: edges.filter(edge => edge.id !== edgeId),
    removed,
  }
}

export function applyGeoNamesNodePatch(
  node: GeoNamesNodeConfig,
  patch: Partial<Omit<GeoNamesNodeConfig, 'id'>>,
  edges: GeoNamesUiEdge[],
): { nextNode: GeoNamesNodeConfig; nextEdges: GeoNamesUiEdge[] } {
  const nextNode: GeoNamesNodeConfig = {
    ...node,
    ...patch,
    stats: patch.stats ? { ...node.stats, ...patch.stats } : node.stats,
  }

  if (!patch.selectedOutputs) {
    return { nextNode, nextEdges: edges }
  }

  return {
    nextNode,
    nextEdges: edges.filter(edge =>
      edge.source !== node.id
      || !edge.sourceHandle.startsWith('h:')
      || patch.selectedOutputs?.includes(edge.sourceHandle.slice(2) as GeoNamesNodeConfig['selectedOutputs'][number]),
    ),
  }
}

export function applyLobidNodePatch(
  node: LobidNodeConfig,
  patch: Partial<Omit<LobidNodeConfig, 'id'>>,
  edges: LobidUiEdge[],
): { nextNode: LobidNodeConfig; nextEdges: LobidUiEdge[] } {
  const nextNode: LobidNodeConfig = {
    ...node,
    ...patch,
    stats: patch.stats ? { ...node.stats, ...patch.stats } : node.stats,
  }

  if (!patch.selectedProperties) {
    return { nextNode, nextEdges: edges }
  }

  return {
    nextNode,
    nextEdges: edges.filter(edge =>
      edge.source !== node.id
      || !edge.sourceHandle.startsWith('h:')
      || patch.selectedProperties?.includes(edge.sourceHandle.slice(2)),
    ),
  }
}

export function buildGeoNamesShapeMappings(
  nodeId: string,
  outputSourceId: string | undefined,
  edges: GeoNamesUiEdge[],
): MappingEdge[] {
  if (!outputSourceId) return []

  return edges
    .filter(edge =>
      edge.source === nodeId
      && edge.sourceHandle.startsWith('h:')
      && edge.target.startsWith('shape:')
      && edge.targetHandle.startsWith('p:'),
    )
    .map(edge => ({
      sourceId: outputSourceId,
      sourceHeader: edge.sourceHandle.slice(2),
      shapeIri: edge.target.slice(6),
      propertyPath: edge.targetHandle.slice(2),
      geoNamesNodeId: nodeId,
    }))
}

export function syncGeoNamesNodeMappings(
  existingEdges: MappingEdge[],
  nodeId: string,
  outputSourceId: string | undefined,
  uiEdges: GeoNamesUiEdge[],
): MappingEdge[] {
  return [
    ...existingEdges.filter(edge => edge.geoNamesNodeId !== nodeId),
    ...buildGeoNamesShapeMappings(nodeId, outputSourceId, uiEdges),
  ]
}

export function buildLobidShapeMappings(
  nodeId: string,
  outputSourceId: string | undefined,
  edges: LobidUiEdge[],
): MappingEdge[] {
  if (!outputSourceId) return []

  return edges
    .filter(edge =>
      edge.source === nodeId
      && edge.sourceHandle.startsWith('h:')
      && edge.target.startsWith('shape:')
      && edge.targetHandle.startsWith('p:'),
    )
    .map(edge => ({
      sourceId: outputSourceId,
      sourceHeader: edge.sourceHandle.slice(2),
      shapeIri: edge.target.slice(6),
      propertyPath: edge.targetHandle.slice(2),
      lobidNodeId: nodeId,
    }))
}

export function syncLobidNodeMappings(
  existingEdges: MappingEdge[],
  nodeId: string,
  outputSourceId: string | undefined,
  uiEdges: LobidUiEdge[],
): MappingEdge[] {
  return [
    ...existingEdges.filter(edge => edge.lobidNodeId !== nodeId),
    ...buildLobidShapeMappings(nodeId, outputSourceId, uiEdges),
  ]
}

export interface TransformationMappingInput {
  sourceId: string
  latHeader: string
  lngHeader: string
}

export function getTransformationNodeInputs(
  nodeId: string,
  edges: TransformationUiEdge[],
): TransformationNodeInputs {
  const nodeEdges = edges.filter(edge => edge.target === nodeId)
  return {
    lat: nodeEdges.find(edge => edge.targetHandle === 'lat-input'),
    lng: nodeEdges.find(edge => edge.targetHandle === 'lng-input'),
  }
}

export function getDependentTransformationNodeIds(
  sourceNodeId: string,
  edges: TransformationUiEdge[],
): string[] {
  return [...new Set(
    edges
      .filter(edge => edge.source === sourceNodeId && edge.target.startsWith('transform:'))
      .map(edge => edge.target),
  )]
}

export function resolveTransformationMappingInput(
  nodeId: string,
  edges: TransformationUiEdge[],
  resolveNodeOutputSource: (nodeId: string) => string | undefined,
): TransformationMappingInput | undefined {
  const { lat, lng } = getTransformationNodeInputs(nodeId, edges)
  const hasMatchingInputs = Boolean(
    lat && lng
    && lat.source === lng.source
    && lat.sourceHandle.startsWith('h:')
    && lng.sourceHandle.startsWith('h:'),
  )

  if (!hasMatchingInputs) return undefined

  if (lat!.source.startsWith('src:')) {
    return {
      sourceId: lat!.source.slice(4),
      latHeader: lat!.sourceHandle.slice(2),
      lngHeader: lng!.sourceHandle.slice(2),
    }
  }

  const sourceId = resolveNodeOutputSource(lat!.source)
  if (!sourceId) return undefined

  return {
    sourceId,
    latHeader: lat!.sourceHandle.slice(2),
    lngHeader: lng!.sourceHandle.slice(2),
  }
}

export function syncTransformationNodeMappings(
  existingEdges: MappingEdge[],
  nodeId: string,
  input: TransformationMappingInput | undefined,
  transformId: string,
): MappingEdge[] {
  if (!input) {
    return existingEdges.filter(edge => edge.transformNodeId !== nodeId)
  }

  return existingEdges.map(edge => edge.transformNodeId !== nodeId
    ? edge
    : {
        ...edge,
        sourceId: input.sourceId,
        sourceHeader: input.latHeader,
        secondarySourceHeader: input.lngHeader,
        transform: transformId,
      })
}
