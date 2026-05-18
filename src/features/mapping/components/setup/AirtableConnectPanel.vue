<script setup lang="ts">
import { onMounted, ref } from 'vue'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
import Listbox from 'primevue/listbox'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import { AirtableService, type AirtableTable } from '@/services/infrastructure/imports/airtableService'
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
const tables = ref<AirtableTable[]>([])
const selectedTables = ref<AirtableTable[]>([])
const isConnecting = ref(false)
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

  if (props.autoConnectOnMount && pat.value && baseId.value) {
    await connect(false)
  }
})

async function connect(showToast = true): Promise<void> {
  error.value = null
  if (!pat.value || !baseId.value) {
    error.value = 'Enter both a PAT and a base ID.'
    return
  }
  isConnecting.value = true
  try {
    const svc = new AirtableService(pat.value, baseId.value)
    tables.value = await svc.listTables()
    await saveAirtableCredentials({ pat: pat.value, baseId: baseId.value })
    if (showToast) {
      toast.add({ severity: 'success', summary: 'Connected', detail: `${tables.value.length} table(s) found.`, life: 3000 })
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    isConnecting.value = false
  }
}

function connectFromButton(): void {
  void connect()
}

async function importSelected(): Promise<void> {
  if (selectedTables.value.length === 0) return
  isImporting.value = true
  try {
    const svc = new AirtableService(pat.value, baseId.value)
    for (const table of selectedTables.value) {
      const records = await svc.fetchTableRecords(table.id)
      const fieldOrder = table.fields?.map(field => field.name) ?? []
      const { headers, rows, recordIds } = AirtableService.recordsToTable(records, fieldOrder)
      data.addAirtableTable(baseId.value, table.id, table.name, headers, rows, recordIds)
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
  tables.value = []
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
        <span>Base ID</span>
        <InputText v-model="baseId" placeholder="appXXXXXXXXXXXXXX" fluid />
      </label>
      <div class="form-actions">
        <Button label="Connect" icon="pi pi-link" :loading="isConnecting" @click="connectFromButton" />
        <Button label="Forget credentials" icon="pi pi-trash" severity="secondary" text @click="forgetCredentials" />
      </div>
    </div>

    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

    <div v-if="tables.length > 0" class="tables">
      <h4>Select tables</h4>
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
.tables {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
h4 { margin: 0; font-size: 0.95rem; }
</style>
