<script setup lang="ts">
import type { DataSource } from '@/domain/DataSource'

const props = defineProps<{ source: DataSource }>()

function displayCell(value: unknown): string {
  if (Array.isArray(value)) return value.map(entry => String(entry)).join(', ')
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
</script>

<template>
  <section class="table-preview">
    <header class="preview-header">
      <div>
        <h3>{{ props.source.name }}</h3>
        <p>{{ props.source.rows.length }} rows · {{ props.source.headers.length }} columns</p>
      </div>
    </header>

    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th v-for="header in props.source.headers" :key="header">{{ header }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in props.source.rows" :key="rowIndex">
            <td v-for="(cell, cellIndex) in row" :key="`${rowIndex}-${cellIndex}`">{{ displayCell(cell) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped lang="scss">
.table-preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.preview-header {
  h3 {
    margin: 0 0 4px;
    font-size: 1rem;
  }

  p {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.85rem;
  }
}

.table-scroll {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow-x: auto;
  overflow-y: auto;
  max-height: 70vh;
  background: var(--color-surface);
}

table {
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  table-layout: auto;
}

th,
td {
  text-align: left;
  vertical-align: top;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

th {
  position: sticky;
  top: 0;
  background: var(--color-surface-2);
  font-weight: 600;
  z-index: 1;
}

tbody tr:last-child td {
  border-bottom: 0;
}
</style>