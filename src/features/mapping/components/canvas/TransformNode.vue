<script setup lang="ts">
import Button from 'primevue/button'
import { Handle, Position } from '@vue-flow/core'

type TransformNodePort = {
  id: string
  label: string
  state?: 'pending' | 'connected'
  stateLabel?: string
}

const props = defineProps<{
  data: {
    title: string
    subtitle: string
    icon: string
    inputs: TransformNodePort[]
    outputs: TransformNodePort[]
    previewLabel?: string
    theme?: {
      headerBackground?: string
      headerColor?: string
      headerSubtleColor?: string
      previewBorderColor?: string
      inputHandleColor?: string
      outputHandleColor?: string
    }
    onPreview?: () => void
  }
}>()

function previewNode(): void {
  props.data.onPreview?.()
}
</script>

<template>
  <div
    class="transform-node"
    :style="{
      '--transform-header-bg': data.theme?.headerBackground ?? '#fff7ed',
      '--transform-header-color': data.theme?.headerColor ?? '#9a3412',
      '--transform-header-subtle': data.theme?.headerSubtleColor ?? '#c2410c',
      '--transform-preview-border': data.theme?.previewBorderColor ?? 'rgba(154, 52, 18, 0.18)',
      '--transform-input-handle': data.theme?.inputHandleColor ?? '#ea580c',
      '--transform-output-handle': data.theme?.outputHandleColor ?? '#c2410c',
    }"
  >
    <header>
      <i :class="data.icon" />
      <div>
        <strong>{{ data.title }}</strong>
        <span>{{ data.subtitle }}</span>
      </div>
      <button class="preview-btn" type="button" title="Preview transform" aria-label="Preview transform" @click.stop="previewNode">
        <i class="pi pi-eye" />
      </button>
    </header>

    <ul class="inputs">
      <li v-for="input in data.inputs" :key="input.id" class="row">
        <Handle :id="input.id" type="target" :position="Position.Left" class="handle handle-input" />
        <span>{{ input.label }}</span>
        <small v-if="input.stateLabel" :class="input.state ?? 'pending'">{{ input.stateLabel }}</small>
      </li>
    </ul>

    <div v-for="output in data.outputs" :key="output.id" class="output-row">
      <span>{{ output.label }}</span>
      <Handle :id="output.id" type="source" :position="Position.Right" class="handle handle-output" />
    </div>

    <div class="footer-actions">
      <Button :label="data.previewLabel ?? 'Preview'" icon="pi pi-eye" size="small" text @click.stop="previewNode" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.transform-node {
  min-width: 260px;
  background: var(--color-surface-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--transform-header-bg);
  border-bottom: 1px solid var(--color-border);
  color: var(--transform-header-color);

  div {
    display: flex;
    flex-direction: column;
  }

  span {
    font-size: 0.76rem;
    color: var(--transform-header-subtle);
  }
}

.preview-btn {
  margin-left: auto;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--transform-preview-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: inherit;
  cursor: pointer;

  &:hover {
    background: white;
    border-color: color-mix(in srgb, var(--transform-header-color) 35%, white);
  }
}

.inputs {
  list-style: none;
  padding: 0;
  margin: 0;
}

.row,
.output-row {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
}

.output-row {
  background: var(--color-surface-2);
  font-weight: 600;
}

.footer-actions {
  padding: 4px 8px 8px;
  display: flex;
  justify-content: flex-end;
}

small.pending { color: var(--color-text-muted); }
small.connected { color: #166534; }

.handle {
  width: 10px !important;
  height: 10px !important;
  border: 2px solid var(--color-surface-1) !important;
}

.handle-input { background: var(--transform-input-handle) !important; }
.handle-output { background: var(--transform-output-handle) !important; }
</style>