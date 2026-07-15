import type { NodeShape, PropertyShape } from '@/domain/NodeShape'

const ROOT_SHAPE_NODE_PREFIX = 'shape:'

export interface InheritedPropertyGroup {
  shapeIri: string
  label: string
  properties: PropertyShape[]
  children: InheritedPropertyGroup[]
}

export interface ShapeCanvasNodeData {
  shape: NodeShape
  ownerShapeIri: string
  representedShapeIri: string
  inheritedOriginShapes?: NodeShape[]
  inheritedPropertyCount?: number
  inheritedGroups?: InheritedPropertyGroup[]
  ownProperties?: PropertyShape[]
  interactive?: boolean
  onPreview?: () => void
}

export interface ShapeCanvasNodeDescriptor {
  nodeId: string
  ownerShapeIri: string
  representedShapeIri: string
  shape: NodeShape
}

export function buildCanvasShapeNodeId(shapeIri: string): string {
  return `${ROOT_SHAPE_NODE_PREFIX}${shapeIri}`
}

export function parseCanvasShapeNodeTarget(nodeId: string): { ownerShapeIri: string; representedShapeIri: string } | null {
  if (nodeId.startsWith(ROOT_SHAPE_NODE_PREFIX)) {
    const shapeIri = nodeId.slice(ROOT_SHAPE_NODE_PREFIX.length)
    return {
      ownerShapeIri: shapeIri,
      representedShapeIri: shapeIri,
    }
  }

  return null
}

export function collectVisibleShapeNodeDescriptors(
  rootShapes: NodeShape[],
  _allShapes: NodeShape[],
  _expandedShapeNodeIds: Set<string>,
): ShapeCanvasNodeDescriptor[] {
  return rootShapes.map(rootShape => ({
    nodeId: buildCanvasShapeNodeId(rootShape.nodeId.value),
    ownerShapeIri: rootShape.nodeId.value,
    representedShapeIri: rootShape.nodeId.value,
    shape: rootShape,
  }))
}

export function inheritedOriginShapesForRoot(shape: NodeShape, allShapes: NodeShape[]): NodeShape[] {
  const allShapesByIri = new Map(allShapes.map(candidate => [candidate.nodeId.value, candidate]))
  return (shape.inheritedShapeIris ?? [])
    .map(inheritedShapeIri => allShapesByIri.get(inheritedShapeIri))
    .filter((candidate): candidate is NodeShape => Boolean(candidate))
}

export function inheritedPropertyPrefixCount(shape: NodeShape, allShapes: NodeShape[]): number {
  const inheritedOriginShapes = inheritedOriginShapesForRoot(shape, allShapes)
  let longestPrefix = 0

  for (const inheritedShape of inheritedOriginShapes) {
    const prefixLength = sharedPropertyPrefixLength(shape.properties, inheritedShape.properties)
    if (prefixLength > longestPrefix) longestPrefix = prefixLength
  }

  if (longestPrefix > 0) return longestPrefix
  return shape.properties.filter(property => property.inherited).length
}

export function buildInheritedPropertyGroups(shape: NodeShape, allShapes: NodeShape[]): InheritedPropertyGroup[] {
  const allShapesByIri = new Map(allShapes.map(candidate => [candidate.nodeId.value, candidate]))
  return (shape.inheritedShapeIris ?? [])
    .map(inheritedShapeIri => allShapesByIri.get(inheritedShapeIri))
    .filter((candidate): candidate is NodeShape => Boolean(candidate))
    .map(inheritedShape => ({
      shapeIri: inheritedShape.nodeId.value,
      label: inheritedShape.label ?? localName(inheritedShape.nodeId.value),
      properties: directOwnProperties(inheritedShape, allShapes),
      children: buildInheritedPropertyGroups(inheritedShape, allShapes),
    }))
}

export function buildOwnProperties(shape: NodeShape, allShapes: NodeShape[]): PropertyShape[] {
  const inheritedKeys = new Set<string>()
  for (const group of buildInheritedPropertyGroups(shape, allShapes)) {
    collectGroupPropertyKeys(group, inheritedKeys)
  }

  return shape.properties.filter(property => !inheritedKeys.has(propertyKey(property)))
}

function directOwnProperties(shape: NodeShape, allShapes: NodeShape[]): PropertyShape[] {
  const inheritedCount = inheritedPropertyPrefixCount(shape, allShapes)
  return shape.properties.slice(inheritedCount)
}

function collectGroupPropertyKeys(group: InheritedPropertyGroup, keys: Set<string>): void {
  for (const property of group.properties) {
    keys.add(propertyKey(property))
  }
  for (const child of group.children) {
    collectGroupPropertyKeys(child, keys)
  }
}

function sharedPropertyPrefixLength(parentProperties: PropertyShape[], inheritedShapeProperties: PropertyShape[]): number {
  const length = Math.min(parentProperties.length, inheritedShapeProperties.length)
  let index = 0

  while (index < length) {
    if (!propertiesMatch(parentProperties[index], inheritedShapeProperties[index])) break
    index += 1
  }

  return index
}

function propertiesMatch(left: PropertyShape, right: PropertyShape): boolean {
  const leftKey = propertyKey(left)
  const rightKey = propertyKey(right)
  if (leftKey === rightKey) return true

  const leftLabel = left.name ?? leftKey
  const rightLabel = right.name ?? rightKey
  return leftLabel === rightLabel
}

function localName(iri: string): string {
  return iri.split(/[/#]/).filter(Boolean).pop() ?? iri
}

function propertyKey(property: PropertyShape): string {
  return property.path?.value ?? property.nodeId.value
}