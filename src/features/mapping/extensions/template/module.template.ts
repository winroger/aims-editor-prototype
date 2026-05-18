import { defineAsyncComponent, markRaw } from 'vue'
import { createMappingExtensionModule } from '@/features/mapping/extensions/core/createMappingExtensionModule'
import type {
  ExtensionCanvasBuildContext,
  MappingExtensionSnapshotContext,
  MappingExtensionStoreApi,
} from '@/features/mapping/extensions/core/types'

const ExampleSetupPanel = defineAsyncComponent(() => import('@/features/mapping/components/setup/CsvUploadPanel.vue'))
const ExampleCanvasNode = defineAsyncComponent(() => import('@/features/mapping/components/canvas/TransformNode.vue'))

type ExampleNodeConfig = {
  id: string
  status: 'idle' | 'running' | 'success' | 'error'
  outputSourceId?: string
}

type ExampleUiEdge = {
  id: string
  source: string
  sourceHandle: string
  target: string
  targetHandle: string
}

export const EXAMPLE_NODE_STATE_KEY = 'node.example.nodes'
export const EXAMPLE_UI_EDGE_STATE_KEY = 'node.example.uiEdges'

function getExampleNodes(mappingStore: MappingExtensionStoreApi): ExampleNodeConfig[] {
  return mappingStore.getExtensionState(EXAMPLE_NODE_STATE_KEY, [] as ExampleNodeConfig[])
}

function getExampleUiEdges(context: ExtensionCanvasBuildContext | MappingExtensionSnapshotContext): ExampleUiEdge[] {
  return context.mappingStore.getExtensionState(EXAMPLE_UI_EDGE_STATE_KEY, [] as ExampleUiEdge[])
}

function createExampleNode(mappingStore: MappingExtensionStoreApi): ExampleNodeConfig {
  return mappingStore.createExtensionNode<ExampleNodeConfig>(EXAMPLE_NODE_STATE_KEY, 'example', id => ({
    id,
    status: 'idle',
  }))
}

export const exampleMappingExtensionModule = createMappingExtensionModule({
  id: 'replace-with-category.module-name',
  setupDialogs: [
    {
      id: 'replace-with-dialog-id',
      header: 'Replace with dialog title',
      width: '720px',
      component: ExampleSetupPanel,
      buildProps: payload => ({
        nodeId: payload?.nodeId,
      }),
    },
  ],
  dataSourceImports: [],
  shapeSourceImports: [],
  mappingNodeActions: [
    {
      id: 'replace-with-node-action-id',
      label: 'Replace with menu label',
      icon: 'pi pi-cog',
      category: 'enrichment',
      createNode: createExampleNode,
    },
  ],
  canvasNodeTypes: {
    replaceWithCanvasNodeType: markRaw(ExampleCanvasNode),
  },
  canvasModules: [
    {
      id: 'replace-with-canvas-builder-id',
      buildNodes: context => getExampleNodes(context.mappingStore).map(node => ({
        id: node.id,
        type: 'replaceWithCanvasNodeType',
        position: { x: 620, y: 40 },
        data: node,
      })),
      buildEdges: context => getExampleUiEdges(context).map(edge => ({
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.sourceHandle,
        target: edge.target,
        targetHandle: edge.targetHandle,
      })),
    },
  ],
  defaultNodePositions: {
    replaceWithCanvasNodeType: { x: 620, y: 40 },
  },
  previewHandlers: [
    {
      id: 'replace-with-node.preview',
      canPreview: nodeId => nodeId.startsWith('example:'),
      preview: (_nodeId, _context) => {},
    },
  ],
  runtimeHandlers: [
    {
      id: 'replace-with-node.runtime',
      canRun: nodeId => nodeId.startsWith('example:'),
      errorSummary: 'Replace with runtime error summary',
      run: async () => ({
        successSummary: 'Replace with runtime success summary',
      }),
    },
  ],
  outputSourceHandlers: [
    {
      id: 'replace-with-node.output-source',
      canResolve: nodeId => nodeId.startsWith('example:'),
      resolve: (nodeId, context) => getExampleNodes(context.mappingStore).find(node => node.id === nodeId)?.outputSourceId,
    },
  ],
  transformSemanticsHandlers: [
    {
      id: 'replace-with-transform.semantics',
      canHandle: transformId => transformId === 'replace-with-transform-id',
      buildValue: () => undefined,
      buildRmlTemplate: () => undefined,
    },
  ],
  connectionHandlers: [
    {
      id: 'replace-with-node.connections',
      canHandleConnection: () => false,
      connect: () => false,
      deleteUiEdge: () => false,
      deleteMappingEdge: () => false,
    },
  ],
  snapshotHandlers: [
    {
      id: 'replace-with-node.snapshot',
      createState: context => ({
        nodes: getExampleNodes(context.mappingStore).map(node => ({ ...node })),
        uiEdges: getExampleUiEdges(context).map(edge => ({ ...edge })),
      }),
      restoreState: (snapshot, context) => {
        const state = snapshot as { nodes?: ExampleNodeConfig[]; uiEdges?: ExampleUiEdge[] }
        context.mappingStore.setExtensionState(EXAMPLE_NODE_STATE_KEY, state.nodes?.map(node => ({ ...node })) ?? [])
        context.mappingStore.setExtensionState(EXAMPLE_UI_EDGE_STATE_KEY, state.uiEdges?.map(edge => ({ ...edge })) ?? [])
      },
      resetState: context => {
        context.mappingStore.resetExtensionState(EXAMPLE_NODE_STATE_KEY)
        context.mappingStore.resetExtensionState(EXAMPLE_UI_EDGE_STATE_KEY)
      },
    },
  ],
})