<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import '@ulb-darmstadt/shacl-form'
import type { NodeShape } from '@/domain/NodeShape'
import { useShaclFormViewer, type ShaclFormElement } from '@/features/shacl/useShaclFormViewer'

interface PreviewSubject {
  iri: string
  label: string
}

const props = defineProps<{
  shape: NodeShape
  shapesTurtle: string
  valuesTurtle: string
  subjects: PreviewSubject[]
  isLoading?: boolean
}>()

const formRef = ref<ShaclFormElement | null>(null)
const title = computed(() => props.shape.label ?? props.shape.nodeId.value)
const selectedSubjectIri = ref('')

const hasSubjects = computed(() => props.subjects.length > 0)
const currentSubject = computed(() => props.subjects.find(subject => subject.iri === selectedSubjectIri.value) ?? null)

watch(
  () => props.subjects,
  subjects => {
    if (subjects.length === 0) {
      selectedSubjectIri.value = ''
      return
    }

    if (!subjects.some(subject => subject.iri === selectedSubjectIri.value)) {
      selectedSubjectIri.value = subjects[0].iri
    }
  },
  { immediate: true },
)

useShaclFormViewer({
  formRef,
  watchSources: [
    () => props.shapesTurtle,
    () => props.valuesTurtle,
    () => props.shape.nodeId.value,
    selectedSubjectIri,
  ],
  getShapesTurtle: () => props.shapesTurtle,
  getValuesTurtle: () => props.valuesTurtle,
  getValuesSubject: () => selectedSubjectIri.value || undefined,
  getShapeSubject: () => props.shape.nodeId.termType === 'NamedNode'
    ? props.shape.nodeId.value
    : undefined,
})
</script>

<template>
  <section class="shape-preview">
    <header class="preview-header">
      <h3>{{ title }}</h3>
      <p>{{ props.shape.targetClass?.value ?? props.shape.nodeId.value }}</p>
    </header>

    <div v-if="isLoading" class="empty-state">
      <i class="pi pi-spin pi-spinner" />
      <span>Generating records for this shape...</span>
    </div>

    <div v-else-if="hasSubjects" class="record-toolbar">
      <label class="record-picker">
        <span>Record</span>
        <select v-model="selectedSubjectIri">
          <option v-for="subject in subjects" :key="subject.iri" :value="subject.iri">
            {{ subject.label }}
          </option>
        </select>
      </label>
      <div class="record-meta">
        <strong>{{ currentSubject?.label }}</strong>
        <span>{{ subjects.length }} record(s)</span>
      </div>
    </div>

    <div v-else class="empty-state">
      <i class="pi pi-info-circle" />
      <span>No generated records currently match this shape.</span>
    </div>

    <div v-if="hasSubjects" class="form-shell">
      <shacl-form
        ref="formRef"
        data-view
        data-collapse="open"
        data-ignore-owl-imports
        data-language="en"
      />
    </div>
  </section>
</template>

<style scoped lang="scss">
.shape-preview {
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
    font-size: 0.8rem;
    font-family: var(--font-mono);
    word-break: break-all;
  }
}

.form-shell {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  padding: var(--space-3);
  max-height: 70vh;
  overflow: auto;
}

.record-toolbar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
}

.record-picker {
  display: flex;
  flex-direction: column;
  gap: 6px;

  span {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
  }

  select {
    min-width: 280px;
    padding: 8px 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface-1);
    font: inherit;
    color: var(--color-text);
  }
}

.record-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;

  strong,
  span {
    overflow-wrap: anywhere;
  }

  span {
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }
}

.empty-state {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
  color: var(--color-text-muted);
}
</style>