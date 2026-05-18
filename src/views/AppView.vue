<script setup lang="ts">
/**
 * AppView — unified main view that merges Setup + Mapping + Export.
 *
 * Components are added via the Menubar (top): source data, target schema,
 * enrichment, transformation, and reset. The canvas itself
 * stays minimal — no legend, no help asides, no info banners.
 */
import { computed, defineAsyncComponent } from 'vue'
import { storeToRefs } from 'pinia'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import type { DataSource } from '@/domain/DataSource'
import { useDataStore } from '@/stores/dataStore'
import { useMetadataStore } from '@/stores/metadataStore'
import { useShapesStore } from '@/stores/shapesStore'
import { useMappingStore } from '@/stores/mappingStore'
import { useMappingValidation } from '@/features/mapping/useMappingValidation'
import { useCanvasGraph } from '@/features/mapping/useCanvasGraph'
import { useCanvasConnections } from '@/features/mapping/useCanvasConnections'
import { useCanvasSetupMenu } from '@/features/mapping/useCanvasSetupMenu'
import { useCanvasPreviews } from '@/features/mapping/useCanvasPreviews'
import Menubar from 'primevue/menubar'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

const TablePreviewPanel = defineAsyncComponent(() => import('@/features/mapping/components/previews/TablePreviewPanel.vue'))
const TransformationPreviewPanel = defineAsyncComponent(() => import('@/features/mapping/components/previews/TransformationPreviewPanel.vue'))
const ShapePreviewPanel = defineAsyncComponent(() => import('@/features/mapping/components/previews/ShapePreviewPanel.vue'))
const ValidationResultPanel = defineAsyncComponent(() => import('@/features/mapping/components/ValidationResultPanel.vue'))

const data = useDataStore()
const metadata = useMetadataStore()
const shapes = useShapesStore()
const mapping = useMappingStore()
const toast = useToast()
const confirm = useConfirm()
const { sources } = storeToRefs(data)
const { nodeShapes, profiles, isResolvingImports } = storeToRefs(shapes)
const { canvasShapes } = storeToRefs(shapes)

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
  dataStore: data,
  shapesStore: shapes,
  mappingStore: mapping,
  toast,
  confirm,
})

const {
  tablePreviewOpen,
  pairedSourcePreviewOpen,
  shapePreviewOpen,
  previewSource,
  previewPrimarySource,
  previewSecondarySource,
  previewShape,
  previewShapeValuesTurtle,
  previewShapeSubjects,
  isShapePreviewLoading,
  combinedCanvasShapesTurtle,
  openTablePreview,
  openPairedSourcePreview,
  openNodePreview,
  openShapePreview,
} = useCanvasPreviews({
  dataStore: data,
  shapesStore: shapes,
  mappingStore: mapping,
  sources,
  nodeShapes,
  profiles,
  toast,
})

// ---------- SHACL validation ----------
const {
  validationSidebarOpen,
  validationResult,
  validationError,
  isValidating,
  canValidate,
  validationStatusSeverity,
  validationStatusIcon,
  validationStatusLabel,
} = useMappingValidation({
  applicationProfile: shapes.ap,
  profiles,
  mappingState: mapping.state,
  sources,
  getCombinedMetadataTurtle: () => metadata.getCombinedMetadataTurtle(),
})

const { nodes, edges, nodeTypes, edgeTypes } = useCanvasGraph({
  dataStore: data,
  mappingStore: mapping,
  sources,
  canvasShapes,
  toast,
  openSetupDialog,
  openTablePreview,
  openNodePreview,
  openShapePreview,
})

useCanvasConnections({
  dataStore: data,
  mappingStore: mapping,
  sources,
  toast,
  confirm,
})

const isReady = computed(() => sources.value.length > 0 && canvasShapes.value.length > 0)

const hasNothing = computed(() =>
  profiles.value.length === 0
  && sources.value.length === 0,
)
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
        <h2>Add components</h2>
        <p>Use the top menu to add <strong>Source Data</strong>, <strong>Target Schema</strong>, <strong>Enrichment</strong>, and <strong>Transformation</strong>.</p>
      </div>
      <VueFlow
        v-else
        v-model:nodes="nodes"
        v-model:edges="edges"
        :node-types="nodeTypes"
        :edge-types="edgeTypes"
        :default-edge-options="{ animated: false, type: 'gradientEdge' }"
        fit-view-on-init
      >
        <Background pattern-color="var(--color-border)" :gap="20" />
        <Controls position="top-left" />
        <MiniMap pannable zoomable />
      </VueFlow>

      <aside class="validation-sidebar" :class="{ open: validationSidebarOpen }">
        <header class="validation-sidebar-header">
          <div class="validation-sidebar-status" :class="`sev-${validationStatusSeverity}`">
            <i :class="validationStatusIcon" />
            <div>
              <strong>SHACL validation</strong>
              <span>{{ validationStatusLabel }}</span>
            </div>
          </div>
          <Button
            icon="pi pi-angle-right"
            size="small"
            severity="secondary"
            text
            rounded
            @click="validationSidebarOpen = false"
          />
        </header>

        <div class="validation-sidebar-body">
          <Message v-if="!canValidate" severity="info" :closable="false">
            Load shapes, data, or form values to start SHACL validation.
          </Message>
          <Message v-else-if="validationError" severity="error" :closable="false">
            {{ validationError }}
          </Message>
          <div v-else-if="isValidating" class="validation-loading">
            <i class="pi pi-spin pi-spinner" />
            <span>Validation in progress...</span>
          </div>
          <ValidationResultPanel v-else-if="validationResult" :result="validationResult" />
        </div>
      </aside>

      <Button
        v-if="!validationSidebarOpen"
        class="validation-sidebar-tab"
        :icon="validationStatusIcon"
        :severity="validationStatusSeverity"
        rounded
        @click="validationSidebarOpen = true"
      />
    </div>

    <!-- Dialogs -->
    <Dialog
      v-if="activeSetupDialogDefinition"
      v-model:visible="activeSetupDialogVisible"
      modal
      :header="activeSetupDialogDefinition.header"
      :style="{ width: activeSetupDialogDefinition.width, maxWidth: '95vw' }"
      @hide="closeSetupDialog"
    >
      <component
        :is="activeSetupDialogDefinition.component"
        :key="activeSetupDialogKey"
        v-bind="activeSetupDialogProps"
        @added="closeSetupDialog"
      />
    </Dialog>
    <Dialog v-model:visible="tablePreviewOpen" modal header="Table preview" :style="{ width: 'min(1200px, 96vw)' }">
      <TablePreviewPanel v-if="previewSource" :source="previewSource" />
    </Dialog>
    <Dialog v-model:visible="pairedSourcePreviewOpen" modal header="Node preview" :style="{ width: 'min(1320px, 96vw)' }">
      <TransformationPreviewPanel :input-source="previewPrimarySource" :output-source="previewSecondarySource" />
    </Dialog>
    <Dialog v-model:visible="shapePreviewOpen" modal header="Shape preview" :style="{ width: 'min(1080px, 96vw)' }">
      <ShapePreviewPanel
        v-if="previewShape"
        :shape="previewShape"
        :shapes-turtle="combinedCanvasShapesTurtle"
        :values-turtle="previewShapeValuesTurtle"
        :subjects="previewShapeSubjects"
        :is-loading="isShapePreviewLoading"
      />
    </Dialog>
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

.validation-sidebar {
  position: absolute;
  top: 16px;
  right: 16px;
  bottom: 16px;
  width: min(420px, calc(100vw - 48px));
  display: flex;
  flex-direction: column;
  background: color-mix(in srgb, var(--color-surface-1) 94%, white 6%);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  transform: translateX(calc(100% + 24px));
  transition: transform 0.2s ease;
  z-index: 20;
}

.validation-sidebar.open {
  transform: translateX(0);
}

.validation-sidebar-header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  justify-content: space-between;
  padding: var(--space-3);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-2);
}

.validation-sidebar-status {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);

  i {
    font-size: 1.1rem;
    margin-top: 2px;
  }

  strong {
    display: block;
    font-size: 0.95rem;
  }

  span {
    display: block;
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  &.sev-success i { color: #16a34a; }
  &.sev-warn i { color: #d97706; }
  &.sev-danger i { color: #dc2626; }
}

.validation-sidebar-body {
  flex: 1;
  overflow: auto;
  padding: var(--space-3);
}

.validation-loading {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-muted);
  padding: var(--space-3);
}

.validation-sidebar-tab {
  position: absolute;
  right: 16px;
  top: 16px;
  z-index: 18;
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
  h2 { margin: 0; font-size: 1.25rem; color: var(--color-text); }
  p { margin: 0; max-width: 480px; line-height: 1.55; }
}

@media (max-width: 900px) {
  .validation-sidebar {
    top: auto;
    left: 12px;
    right: 12px;
    bottom: 12px;
    width: auto;
    max-height: 55vh;
  }
}
</style>
