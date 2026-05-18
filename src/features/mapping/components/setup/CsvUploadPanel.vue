<script setup lang="ts">
import { ref } from 'vue'
import { useDataStore } from '@/stores/dataStore'
import FileUpload from 'primevue/fileupload'
import { useToast } from 'primevue/usetoast'

const data = useDataStore()
const toast = useToast()
const isLoading = ref(false)

const emit = defineEmits<{ added: [] }>()

async function onSelect(event: { files: File[] }): Promise<void> {
  isLoading.value = true
  try {
    await data.addCsvFiles(event.files)
    toast.add({
      severity: 'success',
      summary: 'CSV files loaded',
      detail: `${event.files.length} file(s) added.`,
      life: 3000,
    })
    emit('added')
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'CSV parsing failed',
      detail: err instanceof Error ? err.message : String(err),
      life: 5000,
    })
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="csv-upload">
    <FileUpload
      mode="basic"
      :auto="true"
      accept=".csv,text/csv"
      :multiple="true"
      :max-file-size="50_000_000"
      choose-label="Upload CSV files"
      :disabled="isLoading"
      custom-upload
      @select="onSelect"
    />
    <p class="hint">You can upload multiple files at once. The delimiter is detected automatically.</p>
  </div>
</template>

<style scoped lang="scss">
.csv-upload {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}
</style>
