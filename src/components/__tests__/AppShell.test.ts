import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AppShell from '@/components/AppShell.vue'
import { useProjectStore } from '@/stores/projectStore'
import { useDataStore } from '@/stores/dataStore'
import { useShapesStore } from '@/stores/shapesStore'

const pushMock = vi.fn()
const confirmRequireMock = vi.fn()
const toastAddMock = vi.fn()
const downloadProjectSnapshotMock = vi.fn()
const readProjectSnapshotFileMock = vi.fn()
const restoreProjectSnapshotMock = vi.fn()

vi.mock('vue-router', async importOriginal => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRoute: () => ({ path: '/prepare' }),
    useRouter: () => ({ push: pushMock }),
  }
})

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: toastAddMock }),
}))

vi.mock('primevue/useconfirm', () => ({
  useConfirm: () => ({ require: confirmRequireMock }),
}))

vi.mock('@/services/project/projectFile', () => ({
  downloadProjectSnapshot: (...args: unknown[]) => downloadProjectSnapshotMock(...args),
  readProjectSnapshotFile: (...args: unknown[]) => readProjectSnapshotFileMock(...args),
}))

vi.mock('@/services/project/projectLifecycle', () => ({
  restoreProjectSnapshot: (...args: unknown[]) => restoreProjectSnapshotMock(...args),
}))

describe('AppShell', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    pushMock.mockReset()
    confirmRequireMock.mockReset()
    toastAddMock.mockReset()
    downloadProjectSnapshotMock.mockReset()
    readProjectSnapshotFileMock.mockReset()
    restoreProjectSnapshotMock.mockReset()
    downloadProjectSnapshotMock.mockReturnValue('dataset-a.ardmp.json')
    readProjectSnapshotFileMock.mockResolvedValue({ version: 1, project: { title: 'Uploaded', createdAt: '2026-06-23T12:00:00.000Z' } })
    restoreProjectSnapshotMock.mockResolvedValue(undefined)
  })

  function mountShell() {
    return mount(AppShell, {
      slots: {
        default: '<div class="content">content</div>',
      },
      global: {
        stubs: {
          Button: {
            props: ['label', 'icon', 'severity', 'outlined', 'size'],
            emits: ['click'],
            template: '<button :data-label="label" @click="$emit(\'click\')">{{ label }}</button>',
          },
        },
      },
    })
  }

  it('downloads the current project snapshot from the global header action', async () => {
    const wrapper = mountShell()
    const project = useProjectStore()

    project.project.title = 'Dataset A'

    const downloadButton = wrapper.find('button[data-label="Download Project"]')
    await downloadButton.trigger('click')

    expect(downloadProjectSnapshotMock).toHaveBeenCalledTimes(1)
    expect(downloadProjectSnapshotMock).toHaveBeenCalledWith(project.createSnapshot())
    expect(toastAddMock).toHaveBeenCalledWith(expect.objectContaining({
      severity: 'success',
      summary: 'Project downloaded',
    }))
  })

  it('uploads immediately into an empty workspace', async () => {
    const wrapper = mountShell()
    const input = wrapper.find('input[type="file"]')
    const file = new File(['{"version":1}'], 'demo.ardmp.json', { type: 'application/json' })

    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [file],
    })

    await input.trigger('change')
    await Promise.resolve()

    expect(confirmRequireMock).not.toHaveBeenCalled()
    expect(readProjectSnapshotFileMock).toHaveBeenCalledWith(file)
    expect(restoreProjectSnapshotMock).toHaveBeenCalledTimes(1)
    expect(restoreProjectSnapshotMock.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      successSummary: 'Project uploaded',
    }))
  })

  it('asks for confirmation before replacing a non-empty workspace', async () => {
    const wrapper = mountShell()
    const dataStore = useDataStore()
    const shapesStore = useShapesStore()
    const input = wrapper.find('input[type="file"]')
    const file = new File(['{"version":1}'], 'demo.ardmp.json', { type: 'application/json' })

    dataStore.upsertSource({
      id: 'source-1',
      kind: 'tabular',
      name: 'Source One',
      headers: ['Name'],
      rows: [['Alpha']],
      role: 'source',
      hidden: false,
      origin: { kind: 'uploaded-file', filename: 'source.csv', mediaType: 'text/csv' },
    })
    expect(shapesStore.hasShapes).toBe(false)

    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [file],
    })

    await input.trigger('change')

    expect(confirmRequireMock).toHaveBeenCalledTimes(1)
    const confirmOptions = confirmRequireMock.mock.calls[0]?.[0]
    expect(confirmOptions).toEqual(expect.objectContaining({
      header: 'Upload project',
      acceptLabel: 'Upload project',
    }))

    confirmOptions.accept()
    await Promise.resolve()

    expect(readProjectSnapshotFileMock).toHaveBeenCalledWith(file)
    expect(restoreProjectSnapshotMock).toHaveBeenCalledTimes(1)
  })
})