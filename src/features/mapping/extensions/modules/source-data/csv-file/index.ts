import { defineAsyncComponent } from 'vue'
import { createMappingExtensionModule } from '@/features/mapping/extensions/core/createMappingExtensionModule'

const CsvUploadPanel = defineAsyncComponent(() => import('@/features/mapping/components/setup/CsvUploadPanel.vue'))

export const csvFileModule = createMappingExtensionModule({
  id: 'source-data.csv-file',
  setupDialogs: [
    {
      id: 'csv-upload',
      header: 'Import CSV',
      width: '720px',
      component: CsvUploadPanel,
    },
  ],
  dataSourceImports: [
    {
      id: 'csv-files',
      label: 'CSV file',
      icon: 'pi pi-file',
      dialogId: 'csv-upload',
    },
  ],
})