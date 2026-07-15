<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { propertyConstraintSummary, propertyNodeTargets, type PropertyShape } from '@/domain/NodeShape'
import { CANVAS_NODE_COLORS } from '@/features/mapping/canvasTheme'
import type { ShapeCanvasNodeData } from '@/features/mapping/inheritanceCanvas'
import { useShapesStore } from '@/stores/shapesStore'

const props = defineProps<{ data: ShapeCanvasNodeData }>()
const shapes = useShapesStore()

const label = () => props.data.shape.label ?? localName(props.data.shape.nodeId.value)
const inheritedProperties = () => props.data.shape.properties.slice(0, inheritedPropertyPrefixCount())
const ownProperties = () => props.data.ownProperties ?? props.data.shape.properties.slice(inheritedPropertyPrefixCount())
const inheritedSections = () => flattenInheritedGroups(props.data.inheritedGroups ?? [])

function localName(iri: string): string {
  return iri.split(/[/#]/).filter(Boolean).pop() ?? iri
}

function propertyLabel(p: PropertyShape): string {
  return p.name ?? (p.path ? localName(p.path.value) : p.nodeId.value)
}

function propertyKey(p: PropertyShape): string {
  return p.path?.value ?? p.nodeId.value
}

function isObjectRef(p: PropertyShape): boolean {
  return propertyNodeTargets(p).length > 0
}

function refShapeLabel(p: PropertyShape): string {
  const nodeTargets = propertyNodeTargets(p)
  return nodeTargets
    .map(node => {
      const linked = shapes.ap.findNodeShape(node.value)
      return linked?.label ?? localName(node.value)
    })
    .join(' | ')
}

function cardinality(p: PropertyShape): string {
  const min = p.minCount ?? 0
  const max = p.maxCount ?? '*'
  return `${min}..${max}`
}

function inheritedFromLabel(p: PropertyShape): string {
  return p.inheritedFromShapeLabel ?? (p.inheritedFromShapeIri ? localName(p.inheritedFromShapeIri) : 'Inherited shape')
}

function constraintBadgeLabel(p: PropertyShape): string | null {
  return propertyConstraintSummary(p) ?? null
}

function isInteractive(): boolean {
  return props.data.interactive !== false
}

function inheritedPropertyPrefixCount(): number {
  if (props.data.inheritedPropertyCount !== undefined) return props.data.inheritedPropertyCount

  let longestPrefix = 0

  const inheritedOriginShapes = props.data.inheritedOriginShapes
    ?? (props.data.shape.inheritedShapeIris ?? [])
      .map(inheritedShapeIri => shapes.ap.findNodeShape(inheritedShapeIri))
      .filter((shape): shape is NonNullable<typeof shape> => Boolean(shape))

  for (const inheritedShape of inheritedOriginShapes) {
    if (!inheritedShape) continue

    const prefixLength = sharedPropertyPrefixLength(props.data.shape.properties, inheritedShape.properties)
    if (prefixLength > longestPrefix) longestPrefix = prefixLength
  }

  if (longestPrefix > 0) return longestPrefix
  return props.data.shape.properties.filter(property => property.inherited).length
}

function sharedPropertyPrefixLength(parentProperties: PropertyShape[], inheritedShapeProperties: PropertyShape[]): number {
  const length = Math.min(parentProperties.length, inheritedShapeProperties.length)
  let index = 0

  while (index < length) {
    if (!propertiesMatch(parentProperties[index], inheritedShapeProperties[index])) {
      break
    }
    index += 1
  }

  return index
}

function propertiesMatch(left: PropertyShape, right: PropertyShape): boolean {
  if (propertyKey(left) === propertyKey(right)) return true
  if (propertyLabel(left) === propertyLabel(right)) return true
  return false
}

function flattenInheritedGroups(groups: NonNullable<ShapeCanvasNodeData['inheritedGroups']>, depth = 0): Array<{ title: string; properties: PropertyShape[]; depth: number }> {
  const sections: Array<{ title: string; properties: PropertyShape[]; depth: number }> = []

  for (const group of groups) {
    sections.push(...flattenInheritedGroups(group.children, depth + 1))
    sections.push({
      title: group.label,
      properties: group.properties,
      depth,
    })
  }

  return sections
}
</script>

<template>
  <div
    class="shape-node"
    :style="{
      '--shape-header-bg': CANVAS_NODE_COLORS.shape.headerBackground,
      '--shape-header-color': CANVAS_NODE_COLORS.shape.headerColor,
      '--shape-preview-border': CANVAS_NODE_COLORS.shape.previewBorderColor,
      '--shape-ref-bg': CANVAS_NODE_COLORS.shape.accentBackground,
      '--shape-ref-hover-bg': CANVAS_NODE_COLORS.shape.accentHoverBackground,
      '--shape-badge-bg': CANVAS_NODE_COLORS.shape.badgeBackground,
      '--shape-badge-border': CANVAS_NODE_COLORS.shape.badgeBorderColor,
      '--shape-badge-color': CANVAS_NODE_COLORS.shape.badgeColor,
      '--shape-handle-color': CANVAS_NODE_COLORS.shape.handleColor,
      '--shape-inherited-bg': CANVAS_NODE_COLORS.shape.inheritedBackground,
    }"
  >
    <header>
      <Handle
        v-if="isInteractive()"
        id="shape-header"
        type="target"
        :position="Position.Left"
        class="handle handle-shape-target"
      />
      <i class="pi pi-bookmark" />
      <span class="label">{{ label() }}</span>
      <button
        v-if="data.onPreview"
        class="preview-btn"
        type="button"
        title="Preview shape"
        aria-label="Preview shape"
        @click.stop="data.onPreview?.()"
      >
        <i class="pi pi-eye" />
      </button>
    </header>

    <template v-for="section in inheritedSections()" :key="`${section.depth}:${section.title}`">
      <div class="section-label inherited-section-label" :style="{ paddingLeft: `${12 + (section.depth * 18)}px` }">
        <i class="pi pi-sitemap section-icon" />
        <span>{{ section.title }} (Inherited)</span>
      </div>

      <ul class="properties">
        <li
          v-for="p in section.properties"
          :key="`inh:${section.title}:${p.path?.value ?? p.nodeId.value}`"
          class="row inherited-row"
          :class="{ 'is-ref': isObjectRef(p) }"
        >
          <Handle
            v-if="p.path && isInteractive()"
            :id="`p:${p.path.value}`"
            type="target"
            :position="Position.Left"
            class="handle"
            :class="isObjectRef(p) ? 'handle-ref-target' : 'handle-target'"
          />

          <template v-if="isObjectRef(p)">
            <span class="prop-name">{{ propertyLabel(p) }}</span>
            <i class="pi pi-link fk-icon" :title="refShapeLabel(p)" />
            <Handle
              v-if="p.path && isInteractive()"
              :id="`ref:${p.path.value}`"
              type="source"
              :position="Position.Right"
              class="handle handle-ref-source"
            />
          </template>

          <template v-else>
            <span class="prop-name">{{ propertyLabel(p) }}</span>
          </template>

          <i v-if="p.inherited" class="pi pi-sitemap inheritance-icon" :title="`Inherited from ${inheritedFromLabel(p)}`" />
        </li>
      </ul>
    </template>

    <div v-if="inheritedProperties().length > 0 && ownProperties().length > 0" class="section-label">
      Own Properties
    </div>

    <ul v-if="ownProperties().length > 0" class="properties">
      <li
        v-for="p in ownProperties()"
        :key="`own:${p.path?.value ?? p.nodeId.value}`"
        class="row"
        :class="{ 'is-ref': isObjectRef(p) }"
      >
        <Handle
          v-if="p.path && isInteractive()"
          :id="`p:${p.path.value}`"
          type="target"
          :position="Position.Left"
          class="handle"
          :class="isObjectRef(p) ? 'handle-ref-target' : 'handle-target'"
        />

        <template v-if="isObjectRef(p)">
          <span class="prop-name">{{ propertyLabel(p) }}</span>
          <i class="pi pi-link fk-icon" :title="refShapeLabel(p)" />
          <Handle
            v-if="p.path && isInteractive()"
            :id="`ref:${p.path.value}`"
            type="source"
            :position="Position.Right"
            class="handle handle-ref-source"
          />
        </template>

        <template v-else>
          <span class="prop-name">{{ propertyLabel(p) }}</span>
          <span v-if="constraintBadgeLabel(p)" class="type-badge">{{ constraintBadgeLabel(p) }}</span>
        </template>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.shape-node {
  background: var(--color-surface-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  min-width: 300px;
  max-width: 380px;
  font-size: 0.85rem;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

header {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--shape-header-bg);
  border-bottom: 1px solid var(--color-border);
  font-weight: 600;
  color: var(--shape-header-color);
}
.label { flex: 1; word-break: break-all; }
.preview-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--shape-preview-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: inherit;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: white;
    border-color: color-mix(in srgb, var(--shape-header-color) 35%, white);
  }
}

.properties { list-style: none; padding: 0; margin: 0; }

.section-label {
  padding: 6px 12px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-2);
  color: var(--color-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 8px;
}
.inherited-section-label {
  background: #f9fafb;
  border-top: 1px solid var(--color-border);
}

.section-icon {
  font-size: 0.72rem;
  color: #9ca3af;
  flex-shrink: 0;
}

.row {
  position: relative;
  padding: 5px 12px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: default;
  &:last-child { border-bottom: none; }
  &.is-ref {
    background: var(--shape-ref-bg);
    &:hover { background: var(--shape-ref-hover-bg); }
  }
  &:not(.is-ref):hover { background: var(--color-surface-2); }
}

.inherited-row {
  background: #f9fafb;

  .prop-name {
    color: var(--color-text-muted);
  }
}

.fk-icon {
  font-size: 0.75rem;
  color: var(--shape-handle-color);
  flex-shrink: 0;
  margin-left: auto;
}

.prop-name {
  flex: 1;
  font-family: var(--font-mono);
  word-break: break-all;
  font-size: 0.82rem;
}

.type-badge {
  font-size: 0.7rem;
  background: var(--color-surface-2);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  padding: 1px 5px;
  border-radius: 4px;
  white-space: nowrap;
  font-family: var(--font-mono);
  flex-shrink: 0;
}

.prop-meta {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  flex-shrink: 0;
}

.inheritance-icon {
  font-size: 0.75rem;
  color: var(--shape-badge-color);
  flex-shrink: 0;
}

.handle {
  width: 10px !important;
  height: 10px !important;
  border: 2px solid var(--color-surface-1) !important;
}
.structural-anchor {
  width: 8px !important;
  height: 8px !important;
  opacity: 0 !important;
  pointer-events: none !important;
  border: 0 !important;
  background: transparent !important;
}
.handle-target      { background: var(--shape-handle-color) !important; }
.handle-ref-target  { background: var(--shape-handle-color) !important; }
.handle-ref-source  { background: var(--shape-handle-color) !important; }
.handle-shape-target { background: #d1d5db !important; }
</style>


