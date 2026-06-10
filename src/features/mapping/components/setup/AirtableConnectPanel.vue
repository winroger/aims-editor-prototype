<script setup lang="ts">
import { onMounted, ref } from 'vue'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
import Listbox from 'primevue/listbox'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import {
  AirtableService,
  type AirtableBase,
  type AirtableTable,
  airtableFieldToDataSourceColumn,
} from '@/features/mapping/extensions/modules/source-data/airtable/client'
import { createAirtableDataSource } from '@/features/mapping/extensions/modules/source-data/airtable/workflow'
import { loadAirtableCredentials, saveAirtableCredentials, clearAirtableCredentials } from '@/services/infrastructure/storage/credentialStore'
import { useDataStore } from '@/stores/dataStore'

const toast = useToast()
const data = useDataStore()

const props = withDefaults(defineProps<{
  initialBaseId?: string
  autoConnectOnMount?: boolean
}>(), {
  initialBaseId: undefined,
  autoConnectOnMount: true,
})

const emit = defineEmits<{ added: [] }>()

const pat = ref('')
const baseId = ref('')
const bases = ref<AirtableBase[]>([])
const tables = ref<AirtableTable[]>([])
const selectedTables = ref<AirtableTable[]>([])
const isLoadingBases = ref(false)
const isLoadingTables = ref(false)
const isImporting = ref(false)
const error = ref<string | null>(null)

onMounted(async () => {
  const creds = await loadAirtableCredentials()
  if (creds) {
    pat.value = creds.pat
    baseId.value = props.initialBaseId ?? creds.baseId
  } else if (props.initialBaseId) {
    baseId.value = props.initialBaseId
  }

  if (props.autoConnectOnMount && pat.value) {
    await loadBases(false)
  }
})

async function loadBases(showToast = true): Promise<void> {
  error.value = null
  if (!pat.value) {
    error.value = 'Enter a Personal Access Token.'
    return
  }
  isLoadingBases.value = true
  try {
    const svc = new AirtableService(pat.value)
    bases.value = await svc.listBases()

    if (!bases.value.some(base => base.id === baseId.value)) {
      baseId.value = props.initialBaseId && bases.value.some(base => base.id === props.initialBaseId)
        ? props.initialBaseId
        : ''
    }
    if (!baseId.value && bases.value.length === 1) {
      baseId.value = bases.value[0].id
    }

    if (baseId.value) {
      await loadTables(false)
    } else {
      tables.value = []
      selectedTables.value = []
    }

    if (showToast) {
      toast.add({ severity: 'success', summary: 'Bases loaded', detail: `${bases.value.length} base(s) available.`, life: 3000 })
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    isLoadingBases.value = false
  }
}

async function loadTables(showToast = true): Promise<void> {
  error.value = null
  if (!pat.value || !baseId.value) {
    tables.value = []
    selectedTables.value = []
    return
  }

  isLoadingTables.value = true
  try {
    const svc = new AirtableService(pat.value, baseId.value)
    tables.value = await svc.listTables()
    selectedTables.value = []
    await saveAirtableCredentials({ pat: pat.value, baseId: baseId.value })
    if (showToast) {
      toast.add({ severity: 'success', summary: 'Tables loaded', detail: `${tables.value.length} table(s) found.`, life: 3000 })
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    isLoadingTables.value = false
  }
}

function loadBasesFromButton(): void {
  void loadBases()
}

function handleBaseSelection(): void {
  void loadTables(false)
}

function selectAllTables(): void {
  selectedTables.value = [...tables.value]
}

function clearTableSelection(): void {
  selectedTables.value = []
}

async function importSelected(): Promise<void> {
  if (selectedTables.value.length === 0) return
  isImporting.value = true
  try {
    const svc = new AirtableService(pat.value, baseId.value)
    for (const table of selectedTables.value) {
      const records = await svc.fetchTableRecords(table.id)
      const fieldOrder = table.fields?.map(field => field.name) ?? []
      const primaryFieldName = table.fields?.find(field => field.id === table.primaryFieldId)?.name
      const { headers, rows, recordIds } = AirtableService.recordsToTable(records, fieldOrder)
      data.upsertSource(createAirtableDataSource({
        baseId: baseId.value,
        tableId: table.id,
        tableName: table.name,
        headers,
        rows,
        recordIds,
        columns: table.fields?.map(airtableFieldToDataSourceColumn),
        primaryFieldName,
      }))
    }
    toast.add({
      severity: 'success',
      summary: 'Import successful',
      detail: `${selectedTables.value.length} table(s) imported.`,
      life: 3000,
    })
    selectedTables.value = []
    emit('added')
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Import failed',
      detail: err instanceof Error ? err.message : String(err),
      life: 5000,
    })
  } finally {
    isImporting.value = false
  }
}

async function forgetCredentials(): Promise<void> {
  await clearAirtableCredentials()
  pat.value = ''
  baseId.value = ''
  bases.value = []
  tables.value = []
  selectedTables.value = []
  toast.add({ severity: 'info', summary: 'Credentials cleared', life: 2000 })
}
</script>

<template>
  <div class="airtable-panel">
    <div class="form">
      <label>
        <span>Personal Access Token</span>
        <Password v-model="pat" :feedback="false" toggle-mask placeholder="patXXXXXXXXX" fluid />
      </label>
      <label>
        <span>Base</span>
        <select v-model="baseId" :disabled="bases.length === 0 || isLoadingTables" @change="handleBaseSelection">
          <option value="">Select a base</option>
          <option v-for="base in bases" :key="base.id" :value="base.id">
            {{ base.name }}
          </option>
        </select>
      </label>
      <div class="form-actions">
        <Button label="Load bases" icon="pi pi-link" :loading="isLoadingBases" @click="loadBasesFromButton" />
        <Button label="Forget credentials" icon="pi pi-trash" severity="secondary" text @click="forgetCredentials" />
      </div>
    </div>

    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

    <div v-if="tables.length > 0" class="tables">
      <div class="tables-header">
        <h4>Select tables</h4>
        <div class="table-actions">
          <Button label="Select all" size="small" severity="secondary" outlined @click="selectAllTables" />
          <Button label="Clear" size="small" severity="secondary" text @click="clearTableSelection" />
        </div>
      </div>
      <Listbox
        v-model="selectedTables"
        :options="tables"
        option-label="name"
        multiple
        list-style="max-height:240px"
      />
      <Button
        label="Import selected tables"
        icon="pi pi-download"
        :disabled="selectedTables.length === 0"
        :loading="isImporting"
        @click="importSelected"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.airtable-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 480px;
}
label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: 0.9rem;
}
.form-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

select {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  padding: 0.7rem 0.8rem;
  font: inherit;
}

.tables {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.tables-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.table-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

h4 { margin: 0; font-size: 0.95rem; }
</style>


