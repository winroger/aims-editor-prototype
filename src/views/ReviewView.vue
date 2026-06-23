<script setup lang="ts">
/**
 * BrowseView — list and Turtle view over generated RDF subjects.
 *
 * On mount: regenerates RDF automatically from the current mapping.
 *
 * Cross-references between subjects are rendered with the referenced
 * subject's resolved label (resolvedLabel from browseService) instead
 * of raw IRIs, so a card that points to "recF60FgOJh6JERc" actually
 * shows "Bosch Capdeferro Architecture".
 *
 * The list view pivots properties into table columns: each unique
 * predicate within the currently visible subject set becomes a column
 * whose header shows the human label on top and the property path underneath.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { isCanvasVisibleDataSource } from '@/domain/DataSource'
import type { NodeShape } from '@/domain/NodeShape'
import { useShapesStore } from '@/stores/shapesStore'
import { useDataStore } from '@/stores/dataStore'
import { useMappingStore } from '@/stores/mappingStore'
import { generateRdf, serializeGraph } from '@/services/rdf/rdfGenerator'
import { buildBrowseModel, type BrowseModel, type BrowseSubject } from '@/services/browse/browseService'
import { buildRuntimeStagingShapes, type RuntimeStagingShapes } from '@/services/mapping/stagingShapes'
import {
  classLabelsForSubject,
  columnsForSubjects,
  localName,
  subjectMatchesSearch,
  valuesForColumn,
} from '@/features/browse/browseViewHelpers'
import Message from 'primevue/message'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import SubjectDetailDialog from '@/features/browse/components/SubjectDetailDialog.vue'

const shapesStore = useShapesStore()
const dataStore = useDataStore()
const mappingStore = useMappingStore()
const toast = useToast()
const { ap, hasShapes, nodeShapes, profiles } = storeToRefs(shapesStore)
const { sources } = storeToRefs(dataStore)

/**
 * Combined raw Turtle of every loaded data-shape profile. Passed to the
 * `<shacl-form>` web component as `data-shapes` for the detail dialog.
 */
const combinedShapesTurtle = computed(() =>
  profiles.value.map(p => p.rawTurtle).join('\n\n'),
)

function createEmptyRuntimeStagingShapes(): RuntimeStagingShapes {
  return {
    profile: null,
    nodeShapes: [],
    turtle: '',
  }
}

const runtimeStagingShapes = ref<RuntimeStagingShapes>(createEmptyRuntimeStagingShapes())

const browseNodeShapes = computed<readonly NodeShape[]>(() => [
  ...nodeShapes.value,
  ...runtimeStagingShapes.value.nodeShapes,
])

const browseShapesTurtle = computed(() =>
  [combinedShapesTurtle.value, runtimeStagingShapes.value.turtle].filter(Boolean).join('\n\n'),
)

const canBrowse = computed(() =>
  sources.value.some(source => isCanvasVisibleDataSource(source))
  || (hasShapes.value && sources.value.length > 0 && mappingStore.state.hasMappings),
)

// ---------- RDF + validation, auto-built from current state ----------
const model = ref<BrowseModel | null>(null)
const ttlOutput = ref('')
const generationError = ref<string | null>(null)
const isGenerating = ref(false)

async function regenerate(): Promise<void> {
  if (!canBrowse.value) {
    runtimeStagingShapes.value = createEmptyRuntimeStagingShapes()
    model.value = null
    ttlOutput.value = ''
    generationError.value = null
    return
  }
  isGenerating.value = true
  generationError.value = null
  try {
    const nextRuntimeStagingShapes = buildRuntimeStagingShapes(
      sources.value,
      mappingStore.state,
      nodeShapes.value,
    )
    runtimeStagingShapes.value = nextRuntimeStagingShapes

    const result = generateRdf(ap.value, mappingStore.state, sources.value)
    model.value = buildBrowseModel(
      result.store,
      [...nodeShapes.value, ...nextRuntimeStagingShapes.nodeShapes],
      sources.value,
    )
    ttlOutput.value = await serializeGraph(result.store, 'text/turtle')
  } catch (err) {
    generationError.value = err instanceof Error ? err.message : String(err)
    runtimeStagingShapes.value = createEmptyRuntimeStagingShapes()
    model.value = null
    ttlOutput.value = ''
  } finally {
    isGenerating.value = false
  }
}

onMounted(regenerate)
// Re-run if the underlying data changes while the view is mounted.
watch(
  [
    () => sources.value.length,
    () => sources.value.map(s => s.id).join('|'),
    () => nodeShapes.value.length,
    () => mappingStore.state.edges.length,
    () => JSON.stringify(mappingStore.state.stagingColumns.inactiveColumnsBySource),
  ],
  regenerate,
)

// ---------- View state ----------
const layout = ref<'list' | 'ttl'>('list')
const layoutOptions = [
  { value: 'list',  icon: 'pi pi-list',     label: 'List' },
  { value: 'ttl',   icon: 'pi pi-code',     label: 'TTL' },
]
const search = ref('')
const selectedClass = ref('')

watch(model, () => {
  search.value = ''
  selectedClass.value = ''
})

const classOptions = computed(() =>
  (model.value?.groups ?? []).map(group => ({
    value: group.classIri,
    label: group.classLabel,
  })),
)

const classLabelsByIri = computed(() => {
  const labels = new Map<string, string>()
  for (const group of model.value?.groups ?? []) {
    labels.set(group.classIri, group.classLabel)
  }
  return labels
})

const allSubjects = computed<BrowseSubject[]>(() => {
  const deduped: BrowseSubject[] = []
  const seen = new Set<string>()
  for (const group of model.value?.groups ?? []) {
    for (const subject of group.subjects) {
      if (seen.has(subject.iri)) continue
      seen.add(subject.iri)
      deduped.push(subject)
    }
  }
  return deduped
})

const classFilteredSubjects = computed<BrowseSubject[]>(() => {
  if (!selectedClass.value) return allSubjects.value
  return allSubjects.value.filter(subject => subject.classes.includes(selectedClass.value))
})

const visibleSubjects = computed(() => {
  const term = search.value.trim().toLowerCase()
  return classFilteredSubjects.value.filter(subject => !term || subjectMatchesSearch(subject, term))
})

const hasActiveFilters = computed(() => Boolean(search.value || selectedClass.value))

const isCopying = ref(false)

function clearFilters(): void {
  search.value = ''
  selectedClass.value = ''
}

// ---------- Detail dialog ----------
const detailOpen = ref(false)
const detailSubjectIri = ref<string | null>(null)

function openDetail(subj: BrowseSubject): void {
  detailSubjectIri.value = subj.iri
  detailOpen.value = true
}

// ---------- List-view pivot ----------
const listColumns = computed(() =>
  selectedClass.value ? columnsForSubjects(visibleSubjects.value) : [],
)

function classLabelsFor(subject: BrowseSubject): string[] {
  return classLabelsForSubject(subject, classLabelsByIri.value)
}

async function copyTurtle(): Promise<void> {
  if (!ttlOutput.value) return
  isCopying.value = true
  try {
    await navigator.clipboard.writeText(ttlOutput.value)
    toast.add({ severity: 'success', summary: 'Copied', detail: 'Turtle copied to the clipboard.', life: 2500 })
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Copy failed', detail: err instanceof Error ? err.message : String(err), life: 4000 })
  } finally {
    isCopying.value = false
  }
}

</script>

<template>
  <div class="browse-view" :class="{ 'is-ttl-layout': layout === 'ttl' }">
    <header class="page-header">
      <div>
        <h1 class="page-title">Review</h1>
        <p class="page-subtitle">Inspect the generated RDF subjects as a flat list or raw Turtle.</p>
      </div>
    </header>

    <Message v-if="!canBrowse" severity="warn" :closable="false">
      Load source data to review generated RDF. Profiles and explicit mappings remain optional while staging mappings are active.
    </Message>

    <Message v-if="generationError" severity="error" :closable="false">
      {{ generationError }}
    </Message>

    <template v-if="canBrowse && model">
      <!-- Filter toolbar -->
      <div class="toolbar">
        <label class="search-filter form-stack">
          <span>Search</span>
          <span class="p-input-icon-left search-wrapper">
            <i class="pi pi-search" />
            <InputText
              v-model="search"
              placeholder="Search across subjects and properties..."
              class="search-input"
            />
          </span>
        </label>

        <label class="class-filter form-stack">
          <span>Class</span>
          <select v-model="selectedClass" class="form-select">
            <option value="">All classes</option>
            <option v-for="option in classOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>

        <label class="view-filter form-stack">
          <span>View</span>
          <SelectButton
            v-model="layout"
            :options="layoutOptions"
            option-label="label"
            option-value="value"
            aria-label="Review layout"
          >
            <template #option="slotProps">
              <i :class="slotProps.option.icon" />
              <span class="layout-label">{{ slotProps.option.label }}</span>
            </template>
          </SelectButton>
        </label>

        <Button
          v-if="hasActiveFilters"
          icon="pi pi-filter-slash"
          label="Reset filters"
          size="small"
          severity="secondary"
          outlined
          @click="clearFilters"
        />

      </div>

      <!-- Empty state -->
      <Message v-if="layout !== 'ttl' && visibleSubjects.length === 0" severity="info" :closable="false">
        No subjects match the current filters.
      </Message>

      <section v-if="layout === 'ttl'" class="ttl-view">
        <div class="ttl-actions">
          <Button
            icon="pi pi-copy"
            label="Copy"
            size="small"
            severity="secondary"
            outlined
            :loading="isCopying"
            @click="copyTurtle"
          />
        </div>
        <pre class="ttl-output">{{ ttlOutput }}</pre>
      </section>

      <!-- List layout (pivot) -->
      <div v-else class="list-table-wrapper">
        <table class="list-table data-table">
          <thead>
            <tr>
              <th class="col-label">
                <div class="col-name">Label</div>
                <div class="col-path mono-meta">@id</div>
              </th>
              <th class="col-label">
                <div class="col-name">Classes</div>
                <div class="col-path mono-meta">rdf:type</div>
              </th>
              <th
                v-for="col in listColumns"
                :key="col.predicate"
                :title="col.predicate"
              >
                <div class="col-name">{{ col.label }}</div>
                <div class="col-path mono-meta">{{ col.predicate }}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="subject in visibleSubjects"
              :key="subject.iri"
              class="clickable-row"
              @click="openDetail(subject)"
            >
              <td class="cell-label">
                <div class="cell-name">{{ subject.label }}</div>
                <div class="cell-iri mono-meta" :title="subject.iri">{{ localName(subject.iri) }}</div>
              </td>
              <td>
                <div class="class-chip-row">
                  <Tag
                    v-for="classLabel in classLabelsFor(subject)"
                    :key="`${subject.iri}-${classLabel}`"
                    :value="classLabel"
                    severity="info"
                  />
                </div>
              </td>
              <td
                v-for="col in listColumns"
                :key="col.predicate"
              >
                <div
                  v-for="(property, idx) in valuesForColumn(subject, col.predicate)"
                  :key="idx"
                  class="cell-value"
                >
                  <button
                    v-if="property.isResource && property.resolvedLabel"
                    class="ref-btn link-button"
                    :title="property.value"
                    @click.stop="openDetail({ iri: property.value, label: property.resolvedLabel, classes: [], properties: [] })"
                  >
                    {{ property.resolvedLabel }}
                  </button>
                  <a v-else-if="property.isResource" :href="property.value" target="_blank" rel="noopener" :title="property.value" @click.stop>
                    {{ localName(property.value) }}
                  </a>
                  <span v-else>{{ property.value }}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Subject detail dialog (shacl-form viewer) -->
    <SubjectDetailDialog
      v-model="detailOpen"
      :subject-iri="detailSubjectIri"
      :model="model"
      :shapes="browseNodeShapes"
      :shapes-turtle="browseShapesTurtle"
      :values-turtle="ttlOutput"
    />
  </div>
</template>

<style scoped lang="scss">
.browse-view {
  max-width: 1440px;
  width: 100%;
  height: 100%;
  min-height: 0;
  margin: 0 auto;
  padding: var(--space-6) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  overflow: auto;
}

.browse-view.is-ttl-layout {
  box-sizing: border-box;
  overflow: hidden;
}

.toolbar {
  display: flex;
  align-items: end;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.search-filter,
.class-filter,
.view-filter {
}

.search-filter {
  flex: 1 1 280px;
  min-width: 240px;
}

.search-wrapper {
  width: 100%;
  position: relative;
  display: flex;
  align-items: center;
  i { position: absolute; left: 0.75rem; color: var(--color-text-muted); pointer-events: none; }
  .search-input { padding-left: 2.25rem; width: 100%; }
}

.class-filter,
.view-filter {
  min-width: 220px;
}

.layout-label { margin-left: var(--space-1); }

.ttl-view {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.ttl-actions {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  z-index: 1;
}
.group-header {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-2);
  h2 { margin: 0; font-size: 1.15rem; }
  .group-iri { font-family: var(--font-mono); font-size: 0.75rem; color: var(--color-text-muted); margin-left: auto; }
}
.ttl-header { border-bottom: 1px solid var(--color-border); }

.class-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.list-table-wrapper {
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}
.list-table {
  th {
    background: var(--color-bg);
  }
}
.col-name { font-weight: 600; }
.col-path {
  font-weight: 400;
  margin-top: 2px;
  word-break: break-all;
}
.cell-label .cell-name { font-weight: 500; }
.cell-value {
  word-break: break-word;
  & + .cell-value { margin-top: 2px; }
  a { color: var(--color-primary); text-decoration: none; &:hover { text-decoration: underline; } }
}

.clickable-row {
  cursor: pointer;
  transition: background-color 0.15s;
  &:hover { background: var(--color-surface-1); }
}

.ttl-details {
  margin-top: var(--space-4);
  summary { cursor: pointer; color: var(--color-text-muted); font-size: 0.85rem; padding: var(--space-2) 0; }
}
.ttl-output {
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: calc(var(--space-3) + 2.75rem) var(--space-3) var(--space-3);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  flex: 1;
  min-height: 0;
  max-height: none;
  overflow: auto;
  white-space: pre;
  margin: 0;
}
</style>


