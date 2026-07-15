import type { Component } from 'vue'
import type { Node } from '@vue-flow/core'

export type SetupDialogId = string

export interface SetupDialogPayload {
  initialBaseId?: string
  nodeId?: string
}

export interface SetupDialogDefinition {
  id: SetupDialogId
  header: string
  width: string
  component: Component
  buildProps?: (payload?: SetupDialogPayload) => Record<string, unknown>
}

export interface ShapeSourceImportDefinition {
  id: string
  label: string
  icon: string
  action: 'upload-files' | 'open-dialog'
  dialogId?: SetupDialogId
}

export interface MappingExtensionModule {
  id: string
  setupDialogs?: SetupDialogDefinition[]
  shapeSourceImports?: ShapeSourceImportDefinition[]
  canvasNodeTypes?: Record<string, Component>
  defaultNodePositions?: Partial<Record<string, Node['position']>>
}
