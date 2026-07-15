import { defineAsyncComponent, markRaw } from 'vue'
import type { Node } from '@vue-flow/core'
import type {
  SetupDialogDefinition,
  SetupDialogId,
  ShapeSourceImportDefinition,
} from '@/features/mapping/extensions/core/types'
import { mappingExtensionModules } from '@/features/mapping/extensions/modules'

/**
 * App-internal registry for current mapping UI/runtime modules.
 *
 * This is not a public plugin API.
 * Do not build external extension contracts on top of this until
 * PipelineState and core export boundaries are stable.
 */
const ShapeNode = defineAsyncComponent(() => import('@/features/mapping/components/canvas/ShapeNode.vue'))
const RelationEdge = defineAsyncComponent(() => import('@/features/mapping/components/canvas/RelationEdge.vue'))

export type {
  SetupDialogDefinition,
  SetupDialogId,
  ShapeSourceImportDefinition,
} from '@/features/mapping/extensions/core/types'
export type { SetupDialogPayload } from '@/features/mapping/extensions/core/types'

export const setupDialogDefinitions: SetupDialogDefinition[] = mappingExtensionModules.flatMap(module => module.setupDialogs ?? [])

export const shapeSourceImportDefinitions: ShapeSourceImportDefinition[] = mappingExtensionModules.flatMap(module => module.shapeSourceImports ?? [])

const extensionCanvasNodeTypes = Object.assign({}, ...mappingExtensionModules.map(module => module.canvasNodeTypes ?? {}))

export const canvasNodeTypes = {
  ...extensionCanvasNodeTypes,
  shapeNode: markRaw(ShapeNode),
}

export const canvasEdgeTypes = {
  default: markRaw(RelationEdge),
}
const defaultNodePositions: Partial<Record<string, Node['position']>> = {
  ...Object.assign({}, ...mappingExtensionModules.map(module => module.defaultNodePositions ?? {})),
  shapeNode: { x: 760, y: 40 },
}

export function getSetupDialogDefinition(dialogId: SetupDialogId | null): SetupDialogDefinition | null {
  if (!dialogId) return null
  return setupDialogDefinitions.find(definition => definition.id === dialogId) ?? null
}

export function defaultPositionForNodeType(nodeType: string | undefined, index: number): Node['position'] {
  const base = nodeType ? defaultNodePositions[nodeType] : undefined
  if (!base) return { x: 760, y: 40 + index * 220 }
  const step = nodeType === 'hubNode' ? 180 : 220
  return { x: base.x, y: base.y + index * step }
}



