<script setup lang="ts">
/**
 * SHACL editor main view.
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { useShapesStore } from '@/stores/shapesStore'
import { useCanvasGraph } from '@/features/mapping/useCanvasGraph'
import { useCanvasSetupMenu } from '@/features/mapping/useCanvasSetupMenu'
import { useCanvasPreviews } from '@/features/mapping/useCanvasPreviews'
import CanvasDialogs from '@/features/mapping/components/CanvasDialogs.vue'
import Menubar from 'primevue/menubar'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

const shapes = useShapesStore()
const toast = useToast()
const confirm = useConfirm()
const { nodeShapes, profiles, isResolvingImports } = storeToRefs(shapes)
const { canvasShapes } = storeToRefs(shapes)

const {
  shapePreviewOpen,
  previewShape,
  previewShapeValuesTurtle,
  previewShapeSubjects,
  combinedCanvasShapesTurtle,
  openShapePreview,
} = useCanvasPreviews({
  shapesStore: shapes,
  profiles,
  toast,
})

function resetCanvasUiState(): void {
  closeSetupDialog()
  shapePreviewOpen.value = false
}

const {
  schemaInputRef,
  activeSetupDialogDefinition,
  activeSetupDialogVisible,
  activeSetupDialogKey,
  activeSetupDialogProps,
  menuItems,
  onSchemaFiles,
  closeSetupDialog,
  openSetupDialog,
} = useCanvasSetupMenu({
  shapesStore: shapes,
  toast,
  confirm,
  resetUiState: resetCanvasUiState,
})

const { nodes, edges, nodeTypes, edgeTypes } = useCanvasGraph({
  allShapes: nodeShapes,
  canvasShapes,
  openShapePreview,
})

const hasNothing = computed(() => profiles.value.length === 0)
</script>

<template>
  <div class="app-view">
    <!-- Top toolbar / menu -->
    <div class="toolbar">
      <Menubar :model="menuItems" />
      <span v-if="isResolvingImports" class="toolbar-status">
        <i class="pi pi-spin pi-spinner" /> Resolving imports...
      </span>
    </div>

    <!-- Hidden file inputs -->
    <input ref="schemaInputRef" type="file" accept=".ttl,.shacl,text/turtle" multiple style="display:none" @change="onSchemaFiles" />

    <!-- Canvas -->
    <div class="canvas-wrapper">
      <div v-if="hasNothing" class="empty-state">
        <i class="pi pi-plus-circle" />
        <h2 class="section-title">SHACL-Profile laden</h2>
        <p class="helper-text">Nutze das obere Menü, um Turtle-Dateien zu laden oder Profile direkt aus dem Metadata Profile Service in den Editor zu übernehmen.</p>
      </div>
      <VueFlow
        v-else
        class="mapping-canvas"
        v-model:nodes="nodes"
        v-model:edges="edges"
        :node-types="nodeTypes"
        :edge-types="edgeTypes"
        :default-edge-options="{ animated: false, type: 'default' }"
        fit-view-on-init
      >
        <Background pattern-color="var(--color-border)" :gap="20" />
        <Controls position="top-left" />
        <MiniMap pannable zoomable />
      </VueFlow>

    </div>

    <CanvasDialogs
      :active-setup-dialog-definition="activeSetupDialogDefinition"
      :active-setup-dialog-visible="activeSetupDialogVisible"
      :active-setup-dialog-key="activeSetupDialogKey"
      :active-setup-dialog-props="activeSetupDialogProps"
      :shape-preview-open="shapePreviewOpen"
      :preview-shape="previewShape"
      :combined-canvas-shapes-turtle="combinedCanvasShapesTurtle"
      :preview-shape-values-turtle="previewShapeValuesTurtle"
      :preview-shape-subjects="previewShapeSubjects"
      @close-setup-dialog="closeSetupDialog"
      @update:active-setup-dialog-visible="activeSetupDialogVisible = $event"
      @update:shape-preview-open="shapePreviewOpen = $event"
    />
  </div>
</template>

<style scoped lang="scss">
.app-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  background: var(--color-surface-1);
  border-bottom: 1px solid var(--color-border);
  :deep(.p-menubar) { background: transparent; border: 0; padding: 0; }
}
.toolbar-status {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-left: auto;
}

.canvas-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.mapping-canvas {
  width: 100%;
  height: 100%;
}

.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  color: var(--color-text-muted);
  text-align: center;
  padding: var(--space-5);
  .pi-plus-circle { font-size: 3rem; color: var(--color-accent); }
  .section-title { color: var(--color-text); }
  .helper-text { max-width: 480px; }
}

</style>


