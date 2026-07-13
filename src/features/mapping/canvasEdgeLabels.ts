import type { Edge } from '@vue-flow/core'
import { localName, propertyRelationshipKinds, type PropertyShape } from '@/domain/NodeShape'
import { CANVAS_EDGE_STYLES } from '@/features/mapping/canvasTheme'

export type CanvasEdgeKind = 'mapping' | 'structural' | 'inherited' | 'extension'

export function applyDefaultExtensionEdgeStyle(edge: Omit<Edge, 'type'> & { type?: string }): Edge {
  const relationLabel = isHiddenEdge(edge.style) ? '' : resolveExtensionRelationLabel(edge)
  return {
    ...edge,
    type: edge.type ?? 'default',
    label: relationLabel,
    style: {
      ...CANVAS_EDGE_STYLES.primary,
      ...(edge.style ?? {}),
    },
    data: {
      ...(edge.data ?? {}),
      relationLabel,
      edgeKind: 'extension' satisfies CanvasEdgeKind,
    },
  }
}

export function propertyRelationshipLabel(property: PropertyShape): string {
  return propertyRelationshipKinds(property).join(' | ')
}

export function inferCanvasEdgeRelationLabel(edge: Pick<Edge, 'sourceHandle' | 'targetHandle' | 'label'>): string {
  if (edge.label) return String(edge.label)
  if (edge.targetHandle?.startsWith('p:')) return localName(edge.targetHandle.slice(2))
  if (edge.sourceHandle?.startsWith('h:')) return edge.sourceHandle.slice(2)
  if (edge.targetHandle) return humanizeHandle(edge.targetHandle)
  if (edge.sourceHandle) return humanizeHandle(edge.sourceHandle)
  return ''
}

export function resolveExtensionRelationLabel(edge: Pick<Edge, 'source' | 'target' | 'sourceHandle' | 'targetHandle' | 'label'>): string {
  if (edge.label) return String(edge.label)

  const touchesShape = edge.source.startsWith('shape:') || edge.target.startsWith('shape:')
  if (!touchesShape) return ''

  return inferCanvasEdgeRelationLabel(edge)
}

function humanizeHandle(handle: string): string {
  return handle
    .replace(/^h:/, '')
    .replace(/^p:/, '')
    .replace(/-input$/i, '')
    .replace(/-out$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim()
}

function isHiddenEdge(style: Edge['style']): boolean {
  return Boolean(
    style
    && typeof style === 'object'
    && !Array.isArray(style)
    && 'opacity' in style
    && style.opacity === 0,
  )
}