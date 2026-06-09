import { defineAsyncComponent, markRaw } from 'vue'
import { mappingSecondarySourceHeader, mappingTransformId, mappingTransformNodeId } from '@/domain/Mapping'
import { CANVAS_EDGE_STYLES } from '@/features/mapping/canvasTheme'
import { createMappingExtensionModule } from '@/features/mapping/extensions/core/createMappingExtensionModule'
import { createNodeSnapshotHandler } from '@/features/mapping/extensions/core/stateHelpers'
import type { TransformationNodeConfig, TransformationUiEdge } from '@/features/mapping/extensions/modules/nodes/lat-lng-to-wkt/types'
import {
  connectLatLngToWktNode,
  deleteLatLngToWktUiEdge,
} from '@/features/mapping/extensions/modules/nodes/lat-lng-to-wkt/connections'
import { previewLatLngToWktNode } from '@/features/mapping/extensions/modules/nodes/lat-lng-to-wkt/preview'
import {
  createTransformationNode,
  getTransformationNodes,
  getTransformationUiEdges,
  LAT_LNG_TO_WKT_TRANSFORM_ID,
  TRANSFORMATION_NODE_STATE_KEY,
  TRANSFORMATION_UI_EDGE_STATE_KEY,
} from '@/features/mapping/extensions/modules/nodes/lat-lng-to-wkt/state'
import { buildWktPoint } from '@/services/mapping/mappingSemantics'

const TransformNode = defineAsyncComponent(() => import('@/features/mapping/components/canvas/TransformNode.vue'))

export const latLngToWktModule = createMappingExtensionModule({
  id: 'node.lat-lng-to-wkt',
  mappingNodeActions: [
    {
      id: LAT_LNG_TO_WKT_TRANSFORM_ID,
      label: 'Lat / Lng to WKT',
      icon: 'pi pi-compass',
      category: 'transformation',
      createNode: createTransformationNode,
    },
  ],
  canvasNodeTypes: {
    transformNode: markRaw(TransformNode),
  },
  mappingEdgeSourceHandlers: [
    {
      id: 'node.lat-lng-to-wkt.mapping-edge-source',
      canResolve: edge => mappingTransformId(edge) === LAT_LNG_TO_WKT_TRANSFORM_ID && Boolean(mappingTransformNodeId(edge)),
      resolve: edge => ({
        source: mappingTransformNodeId(edge)!,
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
              onPreview: () => context.openNodePreview(node.id),
              onDelete: () => context.deleteNode(node.id),
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
        style: CANVAS_EDGE_STYLES.primaryDashed,
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
      preview: previewLatLngToWktNode,
    },
  ],
  transformSemanticsHandlers: [
    {
      id: 'node.lat-lng-to-wkt.transform-semantics',
      canHandle: transformId => transformId === LAT_LNG_TO_WKT_TRANSFORM_ID,
      buildValue: ({ edge, source, row }) => {
        const latIdx = source.headers.indexOf(edge.sourceHeader)
        const secondarySourceHeader = mappingSecondarySourceHeader(edge)
        const lngIdx = secondarySourceHeader ? source.headers.indexOf(secondarySourceHeader) : -1
        if (latIdx < 0 || lngIdx < 0) return undefined
        return buildWktPoint(row[latIdx], row[lngIdx]) ?? undefined
      },
      buildRmlTemplate: edge => {
        const secondarySourceHeader = mappingSecondarySourceHeader(edge)
        return secondarySourceHeader
          ? `POINT({${secondarySourceHeader}} {${edge.sourceHeader}})`
          : undefined
      },
    },
  ],
  connectionHandlers: [
    {
      id: 'node.lat-lng-to-wkt.connections',
      canHandleConnection: connection => (
        ((connection.source?.startsWith('src:') || connection.source?.startsWith('geonames:')) && connection.target?.startsWith('transform:'))
        || (connection.source?.startsWith('transform:') && connection.target?.startsWith('shape:'))
      ),
      connect: connectLatLngToWktNode,
      deleteUiEdge: deleteLatLngToWktUiEdge,
    },
  ],
  snapshotHandlers: [
    createNodeSnapshotHandler<TransformationNodeConfig, TransformationUiEdge>({
      id: 'node.transformation',
      nodeStateKey: TRANSFORMATION_NODE_STATE_KEY,
      uiEdgeStateKey: TRANSFORMATION_UI_EDGE_STATE_KEY,
      cloneNode: node => ({ ...node }),
    }),
  ],
})
