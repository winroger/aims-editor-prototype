<script setup lang="ts">
import type { DataSource } from '@/domain/DataSource'

const props = defineProps<{
  inputSource: DataSource | null
  outputSource: DataSource | null
}>()

function displayCell(value: unknown): string {
  if (Array.isArray(value)) return value.map(entry => String(entry)).join(', ')
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
</script>

<template>
  <section class="transform-preview">
    <div class="preview-block">
      <header>
        <h3>Input</h3>
        <p v-if="inputSource">{{ inputSource.rows.length }} rows · {{ inputSource.headers.length }} columns</p>
      </header>
      <div v-if="inputSource" class="table-scroll">
        <table>
          <thead>
            <tr>
              <th v-for="header in inputSource.headers" :key="header">{{ header }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIndex) in inputSource.rows" :key="`input-${rowIndex}`">
              <td v-for="(cell, cellIndex) in row" :key="`input-${rowIndex}-${cellIndex}`">{{ displayCell(cell) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="empty">Connect lat and lng first to inspect the transform input.</p>
    </div>

    <div class="preview-block">
      <header>
        <h3>Output</h3>
        <p v-if="outputSource">{{ outputSource.rows.length }} rows · {{ outputSource.headers.length }} columns</p>
      </header>
      <div v-if="outputSource" class="table-scroll">
        <table>
          <thead>
            <tr>
              <th v-for="header in outputSource.headers" :key="header">{{ header }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIndex) in outputSource.rows" :key="`output-${rowIndex}`">
              <td v-for="(cell, cellIndex) in row" :key="`output-${rowIndex}-${cellIndex}`">{{ displayCell(cell) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="empty">No WKT output available yet.</p>
    </div>
  </section>
</template>

<style scoped lang="scss">
.transform-preview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-4);
}

.preview-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

header {
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
  overflow: auto;
  max-height: 65vh;
  background: var(--color-surface);
}

table {
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
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
}

.empty {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}
</style>