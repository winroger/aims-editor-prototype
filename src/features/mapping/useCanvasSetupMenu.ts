import { computed, ref } from 'vue'
import {
  getSetupDialogDefinition,
  shapeSourceImportDefinitions,
  type SetupDialogId,
  type SetupDialogPayload,
} from '@/features/mapping/mappingExtensionRegistry'
import type { useShapesStore } from '@/stores/shapesStore'

type ShapesStore = ReturnType<typeof useShapesStore>

interface ToastLike {
  add(message: {
    severity: string
    summary: string
    detail?: string
    life?: number
  }): void
}

interface ConfirmLike {
  require(options: {
    header: string
    message: string
    icon?: string
    acceptLabel?: string
    rejectLabel?: string
    acceptClass?: string
    accept: () => void
  }): void
}

interface UseCanvasSetupMenuOptions {
  shapesStore: ShapesStore
  toast: ToastLike
  confirm: ConfirmLike
  resetUiState?: () => void
}

export function useCanvasSetupMenu(options: UseCanvasSetupMenuOptions) {
  const schemaInputRef = ref<HTMLInputElement | null>(null)
  const activeSetupDialogId = ref<SetupDialogId | null>(null)
  const activeSetupDialogPayload = ref<SetupDialogPayload | undefined>(undefined)
  const activeSetupDialogKey = ref(0)

  function triggerSchemaUpload(): void {
    schemaInputRef.value?.click()
  }

  function openSetupDialog(dialogId: SetupDialogId, payload?: SetupDialogPayload): void {
    activeSetupDialogId.value = dialogId
    activeSetupDialogPayload.value = payload
    activeSetupDialogKey.value += 1
  }

  function closeSetupDialog(): void {
    activeSetupDialogId.value = null
    activeSetupDialogPayload.value = undefined
  }

  async function onSchemaFiles(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement
    if (!input.files || input.files.length === 0) return

    const files = Array.from(input.files)
    try {
      await options.shapesStore.addTtlFiles(files)
      options.toast.add({
        severity: 'success',
        summary: 'Schema loaded',
        detail: `${files.length} TTL file(s) added.`,
        life: 3000,
      })
      if (options.shapesStore.lastResolveErrors.length > 0) {
        options.toast.add({
          severity: 'warn',
          summary: 'Some imports were not resolved',
          detail: `${options.shapesStore.lastResolveErrors.length} owl:import(s) could not be loaded.`,
          life: 4000,
        })
      }
    } catch (err) {
      options.toast.add({
        severity: 'error',
        summary: 'Parse error',
        detail: err instanceof Error ? err.message : String(err),
        life: 5000,
      })
    } finally {
      input.value = ''
    }
  }

  function confirmResetAll(): void {
    options.confirm.require({
      header: 'Reset everything',
      message: 'Alle geladenen SHACL-Profile und Projektdaten werden entfernt.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Reset',
      rejectLabel: 'Cancel',
      acceptClass: 'p-button-danger',
      accept: () => {
        options.resetUiState?.()
        options.shapesStore.reset()
      },
    })
  }

  const activeSetupDialogDefinition = computed(() => getSetupDialogDefinition(activeSetupDialogId.value))
  const activeSetupDialogVisible = computed({
    get: () => activeSetupDialogId.value !== null,
    set: visible => {
      if (!visible) closeSetupDialog()
    },
  })
  const activeSetupDialogProps = computed(() =>
    activeSetupDialogDefinition.value?.buildProps?.(activeSetupDialogPayload.value) ?? {},
  )

  const menuItems = computed(() => [
    {
      label: 'Profiles',
      icon: 'pi pi-bookmark',
      items: shapeSourceImportDefinitions.map(definition => ({
        label: definition.label,
        icon: definition.icon,
        command: () => {
          if (definition.action === 'upload-files') {
            triggerSchemaUpload()
            return
          }
          if (definition.dialogId) openSetupDialog(definition.dialogId)
        },
      })),
    },
    {
      label: 'Options',
      icon: 'pi pi-cog',
      items: [
        {
          label: 'Reset all',
          icon: 'pi pi-refresh',
          command: confirmResetAll,
        },
      ],
    },
  ])

  return {
    schemaInputRef,
    activeSetupDialogDefinition,
    activeSetupDialogVisible,
    activeSetupDialogKey,
    activeSetupDialogProps,
    menuItems,
    onSchemaFiles,
    closeSetupDialog,
    openSetupDialog,
  }
}

