import type { useProjectStore } from '@/stores/projectStore'
import type { ProjectSnapshot } from '@/services/project/projectSnapshot'

type ProjectStore = ReturnType<typeof useProjectStore>

interface ToastLike {
  add(message: {
    severity: string
    summary: string
    detail?: string
    life?: number
  }): void
}

interface RestoreProjectSnapshotOptions {
  projectStore: ProjectStore
  snapshot: ProjectSnapshot
  toast: ToastLike
  resetUiState?: () => void
  successSummary?: string
  successDetail?: string
}

export async function restoreProjectSnapshot(
  options: RestoreProjectSnapshotOptions,
): Promise<void> {
  try {
    options.resetUiState?.()
    options.projectStore.restoreSnapshot(options.snapshot)
    options.toast.add({
      severity: 'success',
      summary: options.successSummary ?? 'Project restored',
      detail: options.successDetail ?? 'The project replaced the current workspace.',
      life: 3500,
    })
  } catch (error) {
    options.toast.add({
      severity: 'error',
      summary: 'Project failed to load',
      detail: error instanceof Error ? error.message : String(error),
      life: 5000,
    })
  }
}