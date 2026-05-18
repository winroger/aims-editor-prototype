import { defineAsyncComponent } from 'vue'
import { createMappingExtensionModule } from '@/features/mapping/extensions/core/createMappingExtensionModule'

const AimsProfilePanel = defineAsyncComponent(() => import('@/features/mapping/components/setup/AimsProfilePanel.vue'))

export const aimsProfileModule = createMappingExtensionModule({
  id: 'shape-source.aims-profile',
  setupDialogs: [
    {
      id: 'aims-profile',
      header: 'Load Target Schema from Metadata Profile Service',
      width: 'min(1200px, 96vw)',
      component: AimsProfilePanel,
    },
  ],
  shapeSourceImports: [
    {
      id: 'aims-profile-service',
      label: 'Metadata Profile Service',
      icon: 'pi pi-server',
      action: 'open-dialog',
      dialogId: 'aims-profile',
    },
  ],
})