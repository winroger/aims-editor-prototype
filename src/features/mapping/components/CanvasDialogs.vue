<script setup lang="ts">
import Dialog from 'primevue/dialog'
import ShapePreviewPanel from '@/features/mapping/components/previews/ShapePreviewPanel.vue'
import type { SetupDialogDefinition } from '@/features/mapping/mappingExtensionRegistry'
import type { NodeShape } from '@/domain/NodeShape'

interface PreviewSubject {
  iri: string
  label: string
}

defineProps<{
  activeSetupDialogDefinition: SetupDialogDefinition | null
  activeSetupDialogVisible: boolean
  activeSetupDialogKey: string | number
  activeSetupDialogProps: Record<string, unknown>
  shapePreviewOpen: boolean
  previewShape: NodeShape | null
  combinedCanvasShapesTurtle: string
  previewShapeValuesTurtle: string
  previewShapeSubjects: PreviewSubject[]
}>()

const emit = defineEmits<{
  (event: 'close-setup-dialog'): void
  (event: 'update:activeSetupDialogVisible', value: boolean): void
  (event: 'update:shapePreviewOpen', value: boolean): void
}>()
</script>

<template>
  <Dialog
    v-if="activeSetupDialogDefinition"
    :visible="activeSetupDialogVisible"
    modal
    :header="activeSetupDialogDefinition.header"
    :style="{ width: activeSetupDialogDefinition.width, maxWidth: '95vw' }"
    @update:visible="emit('update:activeSetupDialogVisible', $event)"
    @hide="emit('close-setup-dialog')"
  >
    <component
      :is="activeSetupDialogDefinition.component"
      :key="activeSetupDialogKey"
      v-bind="activeSetupDialogProps"
      @added="emit('close-setup-dialog')"
    />
  </Dialog>

  <Dialog
    :visible="shapePreviewOpen"
    modal
    header="Shape preview"
    :style="{ width: 'min(1080px, 96vw)' }"
    @update:visible="emit('update:shapePreviewOpen', $event)"
  >
    <ShapePreviewPanel
      v-if="previewShape"
      :shape="previewShape"
      :shapes-turtle="combinedCanvasShapesTurtle"
      :values-turtle="previewShapeValuesTurtle"
      :subjects="previewShapeSubjects"
    />
  </Dialog>
</template>
