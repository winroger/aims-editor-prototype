<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Listbox from 'primevue/listbox'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import {
  getLobidInputEdge,
  LOBID_NODE_STATE_KEY,
  updateLobidNode,
} from '@/features/mapping/extensions/modules/nodes/lobid/workflow'
import type { LobidNodeConfig } from '@/features/mapping/mappingNodeTypes'
import { fetchLobidPropertyProposals, type LobidPropertyProposal } from '@/services/infrastructure/integrations/lobidService'
import { useDataStore } from '@/stores/dataStore'
import { useMappingStore } from '@/stores/mappingStore'

const emit = defineEmits<{ added: [] }>()

const props = defineProps<{
  nodeId?: string
}>()

const mapping = useMappingStore()
const data = useDataStore()
const toast = useToast()
const currentNode = computed(() => props.nodeId ? mapping.findExtensionNode<LobidNodeConfig>(LOBID_NODE_STATE_KEY, props.nodeId) : undefined)
const selectedProperties = ref<string[]>([...(currentNode.value?.selectedProperties ?? ['preferredName', 'firstAuthor'])])
const propertyOptions = ref<LobidPropertyProposal[]>([])
const isLoadingProperties = ref(false)
const isSubmitting = ref(false)
const error = ref<string | null>(null)

const inputConnection = computed(() => {
  if (!currentNode.value) return null
  const edge = getLobidInputEdge(mapping, currentNode.value.id)
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

async function loadProperties(): Promise<void> {
  isLoadingProperties.value = true
  error.value = null
  try {
    propertyOptions.value = await fetchLobidPropertyProposals('Work')
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    isLoadingProperties.value = false
  }
}

async function addNode(): Promise<void> {
  error.value = null
  if (selectedProperties.value.length === 0) {
    error.value = 'Select at least one Lobid property.'
    return
  }

  isSubmitting.value = true
  try {
    if (currentNode.value) {
      updateLobidNode(mapping, data, currentNode.value.id, {
        selectedProperties: [...selectedProperties.value],
      })
      toast.add({ severity: 'success', summary: 'Lobid updated', detail: 'The Lobid node configuration was saved.', life: 3000 })
    } else {
      mapping.createExtensionNode(LOBID_NODE_STATE_KEY, 'lobid', id => ({
        id,
        selectedProperties: [...selectedProperties.value],
        status: 'idle',
        stats: { totalCount: 0, processedCount: 0, cachedCount: 0 },
        results: {},
      }))
      toast.add({ severity: 'success', summary: 'Lobid added', detail: 'The Lobid enrichment node is now on the canvas.', life: 3000 })
    }
    emit('added')
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    isSubmitting.value = false
  }
}

onMounted(() => { void loadProperties() })
</script>

<template>
  <div class="lobid-panel">
    <Message severity="info" :closable="false">
      Die Erweiterung nutzt die lobid-gnd Data-extension-API fuer den Typ <strong>Work</strong> und verarbeitet die gesamte verbundene ID-Liste in einem Extend-Request.
    </Message>

    <label class="field">
      <span>Output properties</span>
      <Listbox
        v-model="selectedProperties"
        :options="propertyOptions"
        option-label="name"
        option-value="id"
        multiple
        filter
        list-style="max-height:260px"
        :loading="isLoadingProperties"
      />
    </label>

    <Message severity="info" :closable="false">
      <template v-if="inputConnection">
        Input connection: {{ inputConnection.label }} ({{ inputConnection.itemCount }} IDs)
      </template>
      <template v-else>
        Connect a source column to the Lobid node input in the canvas before running it.
      </template>
    </Message>

    <section class="io-grid">
      <div class="io-block">
        <h3>Input</h3>
        <Tag value="Lobid / GND Work ID" severity="info" />
      </div>
      <div class="io-block">
        <h3>Output</h3>
        <div class="output-list">
          <Tag v-for="propertyId in selectedProperties" :key="propertyId" :value="propertyId" severity="success" />
        </div>
      </div>
    </section>

    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

    <div class="actions">
      <Button
        :label="currentNode ? 'Save Lobid node' : 'Add Lobid node'"
        :icon="currentNode ? 'pi pi-check' : 'pi pi-plus'"
        :loading="isSubmitting"
        @click="addNode"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.lobid-panel {
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

.actions {
  display: flex;
  justify-content: flex-start;
  gap: var(--space-2);
  flex-wrap: wrap;
}
</style>