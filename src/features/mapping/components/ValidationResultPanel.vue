<script setup lang="ts">
import { computed } from 'vue'
import Tag from 'primevue/tag'
import type { ValidationResult, ValidationViolation } from '@/services/validation/validationTypes'

const props = defineProps<{ result: ValidationResult }>()

const byShape = computed(() => {
  const map = new Map<string, { label: string; violations: ValidationViolation[] }>()
  for (const v of props.result.violations) {
    if (!map.has(v.shapeIri)) map.set(v.shapeIri, { label: v.shapeLabel, violations: [] })
    map.get(v.shapeIri)!.violations.push(v)
  }

  return Array.from(map.entries()).map(([iri, data]) => {
    const errorCount = data.violations.filter(v => v.severity === 'error').length
    const warningCount = data.violations.filter(v => v.severity === 'warning').length
    return { iri, ...data, errorCount, warningCount }
  })
})

function severityLabel(s: string): 'danger' | 'warn' | 'info' {
  if (s === 'error') return 'danger'
  if (s === 'warning') return 'warn'
  return 'info'
}

function severityText(s: string): string {
  if (s === 'error') return 'Error'
  if (s === 'warning') return 'Warning'
  return 'Info'
}
</script>

<template>
  <section class="validation-panel">
    <header class="panel-header">
      <h2>Validation results</h2>
      <div class="counts">
        <Tag
          v-if="result.errorCount > 0"
          :value="`${result.errorCount} errors`"
          severity="danger"
        />
        <Tag
          v-if="result.warningCount > 0"
          :value="`${result.warningCount} warnings`"
          severity="warn"
        />
        <Tag
          v-if="result.isValid && result.violations.length === 0"
          value="All constraints satisfied"
          severity="success"
        />
        <Tag
          v-else-if="result.isValid && result.warningCount > 0"
          value="Valid with warnings"
          severity="warn"
        />
      </div>
    </header>

    <div v-if="result.violations.length === 0" class="empty">
      <i class="pi pi-check-circle" style="color: var(--p-green-500); font-size: 1.2rem" />
      No constraint violations found.
    </div>

    <details
      v-for="group in byShape"
      :key="group.iri"
      class="shape-group"
      :open="group.errorCount > 0"
    >
      <summary class="shape-summary">
        <div class="shape-title-row">
          <i :class="group.errorCount > 0 ? 'pi pi-times-circle' : group.warningCount > 0 ? 'pi pi-exclamation-triangle' : 'pi pi-info-circle'" />
          <span class="shape-name">{{ group.label }}</span>
        </div>
        <div class="shape-counts">
          <Tag v-if="group.errorCount > 0" :value="`${group.errorCount} errors`" severity="danger" />
          <Tag v-if="group.warningCount > 0" :value="`${group.warningCount} warnings`" severity="warn" />
          <Tag :value="`${group.violations.length} entries`" severity="info" />
        </div>
      </summary>

      <ul class="violation-list">
        <li
          v-for="(v, idx) in group.violations"
          :key="idx"
          class="violation"
          :class="`sev-${v.severity}`"
        >
          <div class="violation-topline">
            <Tag
              :severity="severityLabel(v.severity)"
              :value="severityText(v.severity)"
              style="font-size: 0.7rem; flex-shrink: 0"
            />
            <span class="prop-label">{{ v.propertyLabel }}</span>
          </div>
          <p class="msg">{{ v.message }}</p>
          <dl class="meta">
            <div v-if="v.propertyPath">
              <dt>Path</dt>
              <dd>{{ v.propertyPath }}</dd>
            </div>
            <div v-if="v.focusNode">
              <dt>Focus</dt>
              <dd>{{ v.focusNode }}</dd>
            </div>
            <div v-if="v.constraintComponent">
              <dt>Constraint</dt>
              <dd>{{ v.constraintComponent }}</dd>
            </div>
            <div v-if="v.value">
              <dt>Value</dt>
              <dd>{{ v.value }}</dd>
            </div>
          </dl>
        </li>
      </ul>
    </details>
  </section>
</template>

<style scoped lang="scss">
.validation-panel {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
  overflow: hidden;
}
.panel-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-1);
  h2 { margin: 0; font-size: 1rem; }
}
.counts { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.empty {
  padding: var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--p-green-600, #16a34a);
  font-size: 0.9rem;
}
.shape-group {
  border-bottom: 1px solid var(--color-border);
  &:last-child { border-bottom: none; }
}
.shape-summary {
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  background: rgba(99, 102, 241, 0.04);
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;

  &::-webkit-details-marker { display: none; }
}
.shape-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}
.shape-name {
  font-size: 0.85rem;
  color: var(--color-accent);
  font-weight: 600;
}
.shape-counts {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.violation-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.violation {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--color-border);
  font-size: 0.83rem;
  flex-direction: column;
  &:last-child { border-bottom: none; }
  &.sev-error { background: rgba(239, 68, 68, 0.04); }
  &.sev-warning { background: rgba(245, 158, 11, 0.04); }
}
.violation-topline {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
}
.prop-label {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--color-text);
  overflow-wrap: anywhere;
}
.msg {
  color: var(--color-text-muted);
  flex: 1;
  margin: 0;
}
.meta {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 10px;
  margin: 0;
  width: 100%;
  font-size: 0.76rem;

  div { display: contents; }
  dt {
    color: var(--color-text-muted);
    font-weight: 600;
  }
  dd {
    margin: 0;
    font-family: var(--font-mono);
    overflow-wrap: anywhere;
  }
}
</style>
