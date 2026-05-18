import { defineAsyncComponent, markRaw } from 'vue'
import { createMappingExtensionModule } from '@/features/mapping/extensions/core/createMappingExtensionModule'
import type { DataSource } from '@/domain/DataSource'
import type { ExtensionCanvasBuildContext, MappingExtensionSnapshotContext } from '@/features/mapping/extensions/core/types'
import type { TransformationNodeConfig, TransformationUiEdge } from '@/features/mapping/mappingNodeTypes'
import { resolveMaterializedNodeOutputSource } from '@/features/mapping/mappingExtensionRegistry'
import { buildWktPoint } from '@/services/mapping/mappingSemantics'
import { cloneUiEdges } from '@/services/project/projectSnapshot'

export const LAT_LNG_TO_WKT_TRANSFORM_ID = 'lat-lng-to-wkt'
const TRANSFORMATION_NODE_STATE_KEY = 'node.transformation.nodes'
const TRANSFORMATION_UI_EDGE_STATE_KEY = 'node.transformation.uiEdges'

const TransformNode = defineAsyncComponent(() => import('@/features/mapping/components/canvas/TransformNode.vue'))

function getTransformationNodes(context: ExtensionCanvasBuildContext | MappingExtensionSnapshotContext): TransformationNodeConfig[] {
  return context.mappingStore.getExtensionState(TRANSFORMATION_NODE_STATE_KEY, [] as TransformationNodeConfig[])
}

function getTransformationUiEdges(context: ExtensionCanvasBuildContext | MappingExtensionSnapshotContext): TransformationUiEdge[] {
  return context.mappingStore.getExtensionState(TRANSFORMATION_UI_EDGE_STATE_KEY, [] as TransformationUiEdge[])
}

function resolveUpstreamOutputSource(nodeId: string, context: { dataStore: ExtensionCanvasBuildContext['dataStore']; mappingStore: ExtensionCanvasBuildContext['mappingStore']; sources: DataSource[] }): string | undefined {
  return resolveMaterializedNodeOutputSource(nodeId, {
    dataStore: context.dataStore,
    mappingStore: context.mappingStore,
    sources: context.sources,
  })
}

export const latLngToWktModule = createMappingExtensionModule({
  id: 'node.lat-lng-to-wkt',
  mappingNodeActions: [
    {
      id: LAT_LNG_TO_WKT_TRANSFORM_ID,
      label: 'Lat / Lng to WKT',
      icon: 'pi pi-compass',
      category: 'transformation',
      createNode: mappingStore => {
        mappingStore.createExtensionNode(TRANSFORMATION_NODE_STATE_KEY, 'transform', id => ({
          id,
          kind: LAT_LNG_TO_WKT_TRANSFORM_ID,
        }))
      },
    },
  ],
  canvasNodeTypes: {
    transformNode: markRaw(TransformNode),
  },
  canvasNodePresentationHandlers: [
    {
      id: 'node.lat-lng-to-wkt.canvas-presentation',
      canPresent: nodeId => nodeId.startsWith('transform:'),
      presentation: {
        inputColor: '#ea580c',
        outputColor: '#c2410c',
      },
    },
  ],
  mappingEdgeSourceHandlers: [
    {
      id: 'node.lat-lng-to-wkt.mapping-edge-source',
      canResolve: edge => edge.transform === LAT_LNG_TO_WKT_TRANSFORM_ID && Boolean(edge.transformNodeId),
      resolve: edge => ({
        source: edge.transformNodeId!,
        sourceHandle: 'h:wkt',
      }),
    },
  ],
  canvasModules: [
    {
      id: LAT_LNG_TO_WKT_TRANSFORM_ID,
      buildNodes: context => getTransformationNodes(context)
        .filter(node => node.kind === LAT_LNG_TO_WKT_TRANSFORM_ID)
        .map(node => {
          const inputs = context.mappingStore.transformationInputsForNode(node.id)
          return {
            id: node.id,
            type: 'transformNode',
            position: { x: 0, y: 0 },
            data: {
              title: 'Lat / Lng to WKT',
              subtitle: 'POINT(lng lat)',
              icon: 'pi pi-compass',
              inputs: [
                {
                  id: 'lat-input',
                  label: 'lat',
                  state: inputs.lat ? 'connected' : 'pending',
                  stateLabel: inputs.lat ? 'connected' : 'pending',
                },
                {
                  id: 'lng-input',
                  label: 'lng',
                  state: inputs.lng ? 'connected' : 'pending',
                  stateLabel: inputs.lng ? 'connected' : 'pending',
                },
              ],
              outputs: [
                {
                  id: 'h:wkt',
                  label: 'WKT',
                },
              ],
              previewLabel: 'Preview',
              theme: {
                headerBackground: '#fff7ed',
                headerColor: '#9a3412',
                headerSubtleColor: '#c2410c',
                previewBorderColor: 'rgba(154, 52, 18, 0.18)',
                inputHandleColor: '#ea580c',
                outputHandleColor: '#c2410c',
              },
              onPreview: () => context.openNodePreview(node.id),
            },
          }
        }),
      buildEdges: context => getTransformationUiEdges(context).map(edge => ({
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
    transformNode: { x: 620, y: 40 },
  },
  previewHandlers: [
    {
      id: 'node.lat-lng-to-wkt.preview',
      canPreview: nodeId => nodeId.startsWith('transform:'),
      preview: (nodeId, context) => {
        const inputs = context.mappingStore.transformationInputsForNode(nodeId)
        let inputSource: DataSource | null = null
        let outputSource: DataSource | null = null

        if (inputs.lat?.source.startsWith('src:') && inputs.lng?.source.startsWith('src:') && inputs.lat.source === inputs.lng.source) {
          const baseSource = context.dataStore.findById(inputs.lat.source.slice(4))
          if (baseSource) {
            const latHeader = inputs.lat.sourceHandle.startsWith('h:') ? inputs.lat.sourceHandle.slice(2) : ''
            const lngHeader = inputs.lng.sourceHandle.startsWith('h:') ? inputs.lng.sourceHandle.slice(2) : ''
            const latIdx = baseSource.headers.indexOf(latHeader)
            const lngIdx = baseSource.headers.indexOf(lngHeader)
            if (latIdx >= 0 && lngIdx >= 0) {
              inputSource = {
                id: `${nodeId}:input-preview`,
                name: `${baseSource.name} · lat/lng`,
                kind: 'csv',
                headers: [latHeader, lngHeader],
                rows: baseSource.rows.map(row => [row[latIdx], row[lngIdx]]),
              }
            }
          }
        }

        if (inputs.lat?.source.startsWith('geonames:') && inputs.lng?.source.startsWith('geonames:') && inputs.lat.source === inputs.lng.source) {
          const geoSourceId = resolveUpstreamOutputSource(inputs.lat.source, context)
          if (geoSourceId) {
            const geoSource = context.dataStore.findById(geoSourceId)
            if (geoSource) {
              const latHeader = inputs.lat.sourceHandle.startsWith('h:') ? inputs.lat.sourceHandle.slice(2) : ''
              const lngHeader = inputs.lng.sourceHandle.startsWith('h:') ? inputs.lng.sourceHandle.slice(2) : ''
              const latIdx = geoSource.headers.indexOf(latHeader)
              const lngIdx = geoSource.headers.indexOf(lngHeader)
              if (latIdx >= 0 && lngIdx >= 0) {
                inputSource = {
                  id: `${nodeId}:input-preview`,
                  name: 'GeoNames output · lat/lng',
                  kind: 'csv',
                  headers: [latHeader, lngHeader],
                  rows: geoSource.rows.map(row => [row[latIdx], row[lngIdx]]),
                }
              }
            }
          }
        }

        const transformEdge = context.mappingStore.state.edges.find(edge => edge.transformNodeId === nodeId && edge.transform === LAT_LNG_TO_WKT_TRANSFORM_ID)
        if (transformEdge) {
          const baseSource = context.dataStore.findById(transformEdge.sourceId)
          if (baseSource) {
            const latIdx = baseSource.headers.indexOf(transformEdge.sourceHeader)
            const lngIdx = transformEdge.secondarySourceHeader ? baseSource.headers.indexOf(transformEdge.secondarySourceHeader) : -1
            if (latIdx >= 0 && lngIdx >= 0) {
              outputSource = {
                id: `${nodeId}:output-preview`,
                name: 'WKT output',
                kind: 'csv',
                headers: ['wkt'],
                rows: baseSource.rows.map(row => {
                  const lat = Number.parseFloat(String(row[latIdx] ?? '').trim())
                  const lng = Number.parseFloat(String(row[lngIdx] ?? '').trim())
                  return [Number.isFinite(lat) && Number.isFinite(lng) ? `POINT(${lng} ${lat})` : '']
                }),
              }
            }
          }
        }

        context.openPairedSourcePreview(inputSource, outputSource)
      },
    },
  ],
  transformSemanticsHandlers: [
    {
      id: 'node.lat-lng-to-wkt.transform-semantics',
      canHandle: transformId => transformId === LAT_LNG_TO_WKT_TRANSFORM_ID,
      buildValue: ({ edge, source, row }) => {
        const latIdx = source.headers.indexOf(edge.sourceHeader)
        const lngIdx = edge.secondarySourceHeader ? source.headers.indexOf(edge.secondarySourceHeader) : -1
        if (latIdx < 0 || lngIdx < 0) return undefined
        return buildWktPoint(row[latIdx], row[lngIdx]) ?? undefined
      },
      buildRmlTemplate: edge => edge.secondarySourceHeader
        ? `POINT({${edge.secondarySourceHeader}} {${edge.sourceHeader}})`
        : undefined,
    },
  ],
  connectionHandlers: [
    {
      id: 'node.lat-lng-to-wkt.connections',
      canHandleConnection: connection => (
        ((connection.source?.startsWith('src:') || connection.source?.startsWith('geonames:')) && connection.target?.startsWith('transform:'))
        || (connection.source?.startsWith('transform:') && connection.target?.startsWith('shape:'))
      ),
      connect: (connection, context) => {
        const sourceHandle = connection.sourceHandle ?? ''
        const targetHandle = connection.targetHandle ?? ''

        if ((connection.source?.startsWith('src:') || connection.source?.startsWith('geonames:')) && connection.target?.startsWith('transform:')) {
          if (!sourceHandle.startsWith('h:') || !['lat-input', 'lng-input'].includes(targetHandle)) return false
          context.mappingStore.upsertExtensionUiEdge(TRANSFORMATION_UI_EDGE_STATE_KEY, {
            id: `transform-ui:${connection.target}:${targetHandle}`,
            source: connection.source,
            sourceHandle,
            target: connection.target,
            targetHandle,
          })
          return true
        }

        if (connection.source?.startsWith('transform:') && connection.target?.startsWith('shape:')) {
          if (sourceHandle !== 'h:wkt' || !targetHandle.startsWith('p:')) return false
          const shapeIri = connection.target.slice(6)
          const propertyPath = targetHandle.slice(2)
          const inputs = context.mappingStore.transformationInputsForNode(connection.source)
          if (!inputs.lat || !inputs.lng) {
            context.toast.add({
              severity: 'warn',
              summary: 'WKT transform incomplete',
              detail: 'Connect both lat and lng before mapping the WKT output.',
              life: 4000,
            })
            return true
          }
          if (inputs.lat.source !== inputs.lng.source) {
            context.toast.add({
              severity: 'error',
              summary: 'WKT transform invalid',
              detail: 'Lat and lng must come from the same source table.',
              life: 5000,
            })
            return true
          }

          if (inputs.lat.source.startsWith('geonames:')) {
            const materializedSourceId = resolveUpstreamOutputSource(inputs.lat.source, context)
            if (!materializedSourceId) {
              context.toast.add({
                severity: 'warn',
                summary: 'Run GeoNames first',
                detail: 'Execute the GeoNames node once so its lat/lng outputs are available for the WKT transform.',
                life: 4500,
              })
              return true
            }
          }

          context.mappingStore.set({
            sourceId: inputs.lat.source.startsWith('src:')
              ? inputs.lat.source.slice(4)
              : (resolveUpstreamOutputSource(inputs.lat.source, context) ?? ''),
            sourceHeader: inputs.lat.sourceHandle.slice(2),
            secondarySourceHeader: inputs.lng.sourceHandle.slice(2),
            shapeIri,
            propertyPath,
            transform: LAT_LNG_TO_WKT_TRANSFORM_ID,
            transformNodeId: connection.source,
          })
          return true
        }

        return false
      },
      deleteUiEdge: (edgeId, context) => {
        if (!edgeId.startsWith('transform-ui:')) return false
        context.mappingStore.removeExtensionUiEdge(TRANSFORMATION_UI_EDGE_STATE_KEY, edgeId)
        return true
      },
    },
  ],
  snapshotHandlers: [
    {
      id: 'node.transformation',
      createState: context => ({
        nodes: getTransformationNodes(context).map(node => ({ ...node })),
        uiEdges: cloneUiEdges(getTransformationUiEdges(context)),
      }),
      restoreState: (state, context) => {
        const nextState = (state && typeof state === 'object') ? state as { nodes?: TransformationNodeConfig[]; uiEdges?: TransformationUiEdge[] } : {}
        context.mappingStore.setExtensionState(TRANSFORMATION_NODE_STATE_KEY, (nextState.nodes ?? []).map(node => ({ ...node })))
        context.mappingStore.setExtensionState(TRANSFORMATION_UI_EDGE_STATE_KEY, cloneUiEdges(nextState.uiEdges ?? []))
      },
      resetState: context => {
        context.mappingStore.resetExtensionState(TRANSFORMATION_NODE_STATE_KEY)
        context.mappingStore.resetExtensionState(TRANSFORMATION_UI_EDGE_STATE_KEY)
      },
    },
  ],
})