<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { DataSource } from '@/domain/DataSource'
import { useDataStore } from '@/stores/dataStore'
import { detectLinkedColumns, type LinkedColumnInfo } from '@/services/mapping/linkDetector'

const props = defineProps<{ data: { source: DataSource; onPreview?: () => void } }>()
const dataStore = useDataStore()

/** Detected linked-record columns, indexed by header name. */
const linkInfo = computed<Map<string, LinkedColumnInfo>>(() => {
  const map = new Map<string, LinkedColumnInfo>()
  const detected = detectLinkedColumns(props.data.source, dataStore.sources)
  for (const info of detected) map.set(info.header, info)
  return map
})
</script>

<template>
  <div class="table-node">
    <header>
      <Handle
        id="table-parent"
        type="target"
        :position="Position.Left"
        class="handle handle-parent"
      />
      <i class="pi pi-table" />
      <span class="name">{{ data.source.name }}</span>
      <button
        class="preview-btn"
        type="button"
        title="Preview table"
        aria-label="Preview table"
        @click.stop="data.onPreview?.()"
      >
        <i class="pi pi-eye" />
      </button>
    </header>
    <ul class="headers">
      <li
        v-for="header in data.source.headers"
        :key="header"
        class="row"
        :class="{ 'is-link': linkInfo.has(header) }"
      >
        <i v-if="linkInfo.has(header)" class="pi pi-link link-icon" />
        <span class="header-name">{{ header }}</span>
        <Handle
          :id="`h:${header}`"
          type="source"
          :position="Position.Right"
          class="handle"
          :class="linkInfo.has(header) ? 'handle-link' : 'handle-source'"
        />
      </li>
    </ul>
    <footer class="meta">
      {{ data.source.rows.length }} rows
    </footer>
  </div>
</template>

<style scoped lang="scss">
.table-node {
  background: var(--color-surface-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  min-width: 260px;
  max-width: 340px;
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
  background: #ecfdf5;
  border-bottom: 1px solid var(--color-border);
  font-weight: 600;
  color: #166534;
}
.name { flex: 1; word-break: break-all; }
.preview-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(22, 101, 52, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: inherit;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: white;
    border-color: rgba(22, 101, 52, 0.35);
  }
}
.badge {
  font-size: 0.7rem;
  background: var(--color-accent-soft);
  color: var(--color-accent);
  padding: 2px 6px;
  border-radius: 999px;
  text-transform: uppercase;
}

.headers { list-style: none; padding: 0; margin: 0; }
.row {
  position: relative;
  padding: 6px 12px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: 6px;
  &:last-child { border-bottom: none; }

  &.is-link {
    background: #ecfdf5;
    &:hover { background: #d1fae5; }
  }
  &:not(.is-link):hover { background: var(--color-surface-2); }
}

.link-icon {
  font-size: 0.75rem;
  color: #16a34a;
  flex-shrink: 0;
}

.header-name {
  flex: 1;
  font-family: var(--font-mono);
  word-break: break-all;
}

.link-target-badge {
  font-size: 0.7rem;
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
  padding: 1px 5px;
  border-radius: 4px;
  white-space: nowrap;
  flex-shrink: 0;
}

.handle {
  width: 10px !important;
  height: 10px !important;
  border: 2px solid var(--color-surface-1) !important;
}
.handle-parent { background: #d1d5db !important; }
.handle-source { background: #16a34a !important; }
.handle-link   { background: #16a34a !important; }

.meta {
  padding: 6px 12px;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  border-top: 1px solid var(--color-border);
  background: var(--color-surface-2);
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.link-count { color: #92400e; }
</style>
