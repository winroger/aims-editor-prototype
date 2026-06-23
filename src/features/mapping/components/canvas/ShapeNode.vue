<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import type { NodeShape, PropertyShape } from '@/domain/NodeShape'
import { CANVAS_NODE_COLORS } from '@/features/mapping/canvasTheme'
import { useShapesStore } from '@/stores/shapesStore'

const props = defineProps<{ data: { shape: NodeShape; onPreview?: () => void } }>()
const shapes = useShapesStore()

const label = () => props.data.shape.label ?? localName(props.data.shape.nodeId.value)
const inheritedProperties = () => props.data.shape.properties.filter(property => property.inherited)
const ownProperties = () => props.data.shape.properties.filter(property => !property.inherited)

function localName(iri: string): string {
  return iri.split(/[/#]/).filter(Boolean).pop() ?? iri
}

function propertyLabel(p: PropertyShape): string {
  return p.name ?? (p.path ? localName(p.path.value) : p.nodeId.value)
}

function isObjectRef(p: PropertyShape): boolean {
  return Boolean(p.node)
}

function refShapeLabel(p: PropertyShape): string {
  if (!p.node) return ''
  const linked = shapes.ap.findNodeShape(p.node.value)
  return linked?.label ?? localName(p.node.value)
}

function cardinality(p: PropertyShape): string {
  const min = p.minCount ?? 0
  const max = p.maxCount ?? '*'
  return `${min}..${max}`
}

function inheritedFromLabel(p: PropertyShape): string {
  return p.inheritedFromShapeLabel ?? (p.inheritedFromShapeIri ? localName(p.inheritedFromShapeIri) : 'Inherited shape')
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
        id="shape-header"
        type="target"
        :position="Position.Left"
        class="handle handle-shape-target"
      />
      <i class="pi pi-bookmark" />
      <span class="label">{{ label() }}</span>
      <button
        class="preview-btn"
        type="button"
        title="Preview shape"
        aria-label="Preview shape"
        @click.stop="data.onPreview?.()"
      >
        <i class="pi pi-eye" />
      </button>
    </header>

    <div v-if="inheritedProperties().length > 0" class="section-label">Inherited properties</div>
    <ul class="properties">
      <li
        v-for="p in inheritedProperties()"
        :key="`inherited:${p.path?.value ?? p.nodeId.value}`"
        class="row inherited-row"
        :class="{ 'is-ref': isObjectRef(p) }"
      >
        <Handle
          v-if="p.path"
          :id="`p:${p.path.value}`"
          type="target"
          :position="Position.Left"
          class="handle"
          :class="isObjectRef(p) ? 'handle-ref-target' : 'handle-target'"
        />

        <template v-if="isObjectRef(p)">
          <i class="pi pi-link fk-icon" :title="refShapeLabel(p)" />
          <span class="prop-name">{{ propertyLabel(p) }}</span>
          <span class="prop-meta">{{ cardinality(p) }}</span>
          <Handle
            v-if="p.path"
            :id="`ref:${p.path.value}`"
            type="source"
            :position="Position.Right"
            class="handle handle-ref-source"
          />
        </template>

        <template v-else>
          <span class="prop-name">{{ propertyLabel(p) }}</span>
          <span v-if="p.datatype" class="type-badge">{{ localName(p.datatype.value) }}</span>
          <span class="prop-meta">{{ cardinality(p) }}</span>
        </template>

        <i class="pi pi-sitemap inheritance-icon" :title="`Inherited from ${inheritedFromLabel(p)}`" />
      </li>
    </ul>

    <div v-if="inheritedProperties().length > 0 && ownProperties().length > 0" class="section-label section-separator">Own properties</div>
    <ul class="properties">
      <li
        v-for="p in ownProperties()"
        :key="p.path?.value ?? p.nodeId.value"
        class="row"
        :class="{ 'is-ref': isObjectRef(p) }"
      >
        <Handle
          v-if="p.path"
          :id="`p:${p.path.value}`"
          type="target"
          :position="Position.Left"
          class="handle"
          :class="isObjectRef(p) ? 'handle-ref-target' : 'handle-target'"
        />

        <!-- FK reference property -->
        <template v-if="isObjectRef(p)">
          <i class="pi pi-link fk-icon" :title="refShapeLabel(p)" />
          <span class="prop-name">{{ propertyLabel(p) }}</span>
          <span class="prop-meta">{{ cardinality(p) }}</span>
          <Handle
            v-if="p.path"
            :id="`ref:${p.path.value}`"
            type="source"
            :position="Position.Right"
            class="handle handle-ref-source"
          />
        </template>

        <!-- Regular literal property -->
        <template v-else>
          <span class="prop-name">{{ propertyLabel(p) }}</span>
          <span v-if="p.datatype" class="type-badge">{{ localName(p.datatype.value) }}</span>
          <span class="prop-meta">{{ cardinality(p) }}</span>
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
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  background: var(--color-surface-2);
  border-bottom: 1px solid var(--color-border);
}

.section-separator {
  border-top: 1px solid var(--color-border);
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
  background: var(--shape-inherited-bg);
}

.fk-icon {
  font-size: 0.75rem;
  color: var(--shape-handle-color);
  flex-shrink: 0;
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
.handle-target      { background: var(--shape-handle-color) !important; }
.handle-ref-target  { background: var(--shape-handle-color) !important; }
.handle-ref-source  { background: var(--shape-handle-color) !important; }
.handle-shape-target { background: #d1d5db !important; }
</style>


