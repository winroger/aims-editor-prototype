import showcaseProject from '@/assets/examples/showcase-project.json'
import type { useProjectStore } from '@/stores/projectStore'
import {
  assertProjectSnapshotLike,
  type ProjectSnapshot,
} from '@/services/project/projectSnapshot'
import { restoreProjectSnapshot } from '@/services/project/projectLifecycle'

type ProjectStore = ReturnType<typeof useProjectStore>

interface ToastLike {
  add(message: {
    severity: string
    summary: string
    detail?: string
    life?: number
  }): void
}

interface LoadEmbeddedExampleProjectOptions {
  projectStore: ProjectStore
  toast: ToastLike
  resetUiState?: () => void
}

export function getEmbeddedExampleProjectSnapshot(): ProjectSnapshot {
  const snapshot = structuredClone(showcaseProject) as unknown
  assertProjectSnapshotLike(snapshot)
  return snapshot
}

export async function loadEmbeddedExampleProject(
  options: LoadEmbeddedExampleProjectOptions,
): Promise<void> {
  try {
    const snapshot = getEmbeddedExampleProjectSnapshot()
    await restoreProjectSnapshot({
      projectStore: options.projectStore,
      snapshot,
      toast: options.toast,
      resetUiState: options.resetUiState,
      successSummary: 'Example loaded',
      successDetail: 'The built-in showcase project replaced the current workspace.',
    })
  } catch (error) {
    options.toast.add({
      severity: 'error',
      summary: 'Example failed to load',
      detail: error instanceof Error ? error.message : String(error),
      life: 5000,
    })
  }
}
