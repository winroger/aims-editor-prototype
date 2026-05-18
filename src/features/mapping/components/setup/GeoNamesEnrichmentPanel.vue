<script setup lang="ts">
import { computed, ref } from 'vue'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Listbox from 'primevue/listbox'
import { useToast } from 'primevue/usetoast'
import {
  GEONAMES_NODE_STATE_KEY,
  getGeoNamesInputEdge,
  updateGeoNamesNode,
} from '@/features/mapping/extensions/modules/nodes/geonames/workflow'
import { GEO_NAMES_OUTPUT_OPTIONS, type GeoNamesOutputField } from '@/services/infrastructure/integrations/geonamesService'
import type { GeoNamesNodeConfig } from '@/features/mapping/mappingNodeTypes'
import { useDataStore } from '@/stores/dataStore'
import { useMappingStore } from '@/stores/mappingStore'

const emit = defineEmits<{ added: [] }>()

const props = defineProps<{
  nodeId?: string
}>()

const mapping = useMappingStore()
const data = useDataStore()
const toast = useToast()
const currentNode = computed(() => props.nodeId ? mapping.findExtensionNode<GeoNamesNodeConfig>(GEONAMES_NODE_STATE_KEY, props.nodeId) : undefined)
const username = ref(currentNode.value?.username ?? '')
const selectedOutputs = ref<GeoNamesOutputField[]>([...(currentNode.value?.selectedOutputs ?? ['name', 'id', 'lat', 'lng'])])
const isSubmitting = ref(false)
const error = ref<string | null>(null)

const outputOptions = [...GEO_NAMES_OUTPUT_OPTIONS]
const outputLabelById = new Map(outputOptions.map(option => [option.id, option.name] as const))

const inputConnection = computed(() => {
  if (!currentNode.value) return null
  const edge = getGeoNamesInputEdge(mapping, currentNode.value.id)
  if (!edge) return null
  const sourceId = edge.source.startsWith('src:') ? edge.source.slice(4) : ''
  const sourceHeader = edge.sourceHandle.startsWith('h:') ? edge.sourceHandle.slice(2) : ''
  const source = data.findById(sourceId)
  if (!source) return { label: `${sourceId} / ${sourceHeader}`, itemCount: 0 }
  const headerIndex = source.headers.indexOf(sourceHeader)
  const itemCount = headerIndex >= 0
    ? source.rows.map(row => String(row[headerIndex] ?? '').trim()).filter(Boolean).length
    : 0
  return {
    label: `${source.name} / ${sourceHeader}`,
    itemCount,
  }
})

async function addNode(): Promise<void> {
  error.value = null
  if (!username.value.trim()) {
    error.value = 'Enter a GeoNames username.'
    return
  }
  if (selectedOutputs.value.length === 0) {
    error.value = 'Select at least one output field.'
    return
  }

  isSubmitting.value = true
  try {
    if (currentNode.value) {
      updateGeoNamesNode(mapping, data, currentNode.value.id, {
        username: username.value.trim(),
        selectedOutputs: [...selectedOutputs.value],
      })
      toast.add({ severity: 'success', summary: 'GeoNames updated', detail: 'The GeoNames node configuration was saved.', life: 3000 })
    } else {
      const createdNode = mapping.createExtensionNode(GEONAMES_NODE_STATE_KEY, 'geonames', id => ({
        id,
        username: username.value.trim(),
        selectedOutputs: ['name', 'id', 'lat', 'lng'],
        status: 'idle',
        stats: { totalCount: 0, processedCount: 0, cachedCount: 0 },
        results: {},
      }))
      if (createdNode) {
        updateGeoNamesNode(mapping, data, createdNode.id, {
          selectedOutputs: [...selectedOutputs.value],
        })
      }
      toast.add({ severity: 'success', summary: 'GeoNames added', detail: 'The GeoNames enrichment node is now on the canvas.', life: 3000 })
    }
    emit('added')
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="geonames-panel">
    <label class="field">
      <span>GeoNames username</span>
      <InputText v-model="username" placeholder="username" fluid />
    </label>

    <label class="field">
      <span>Output properties</span>
      <Listbox
        v-model="selectedOutputs"
        :options="outputOptions"
        option-label="name"
        option-value="id"
        multiple
        list-style="max-height:260px"
      >
        <template #option="slotProps">
          <div class="picker-option">
            <strong>{{ slotProps.option.name }}</strong>
            <span>{{ slotProps.option.description }}</span>
          </div>
        </template>
      </Listbox>
    </label>

    <Message severity="info" :closable="false">
      <template v-if="inputConnection">
        Input connection: {{ inputConnection.label }} ({{ inputConnection.itemCount }} IDs)
      </template>
      <template v-else>
        Connect a source column to the GeoNames node input in the canvas before running it.
      </template>
    </Message>

    <section class="io-grid">
      <div class="io-block">
        <h3>Input</h3>
        <Tag value="GeoNames ID" severity="info" />
      </div>
      <div class="io-block">
        <h3>Output</h3>
        <div class="output-list">
          <Tag v-for="field in selectedOutputs" :key="field" :value="outputLabelById.get(field) ?? field" severity="success" />
        </div>
      </div>
    </section>

    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

    <div class="actions">
      <Button
        :label="currentNode ? 'Save GeoNames node' : 'Add GeoNames node'"
        :icon="currentNode ? 'pi pi-check' : 'pi pi-plus'"
        :loading="isSubmitting"
        @click="addNode"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.geonames-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-width: 560px;
  font-size: 0.9rem;
}

.io-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-3);
}

.io-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-1);

  h3 { margin: 0; font-size: 0.95rem; }
}

.output-list {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.picker-option {
  display: flex;
  flex-direction: column;
  gap: 2px;

  strong {
    font-size: 0.92rem;
  }

  span {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }
}

.actions {
  display: flex;
  justify-content: flex-start;
  gap: var(--space-2);
  flex-wrap: wrap;
}
</style>