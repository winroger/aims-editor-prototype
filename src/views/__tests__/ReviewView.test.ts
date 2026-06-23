import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { TabularDataSource } from '@/domain/DataSource'
import ReviewView from '@/views/ReviewView.vue'
import { useDataStore } from '@/stores/dataStore'

const toastAddMock = vi.fn()
const buildRuntimeStagingShapesMock = vi.fn()

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: toastAddMock }),
}))

vi.mock('@/features/browse/components/SubjectDetailDialog.vue', () => ({
  default: {
    template: '<div />',
  },
}))

vi.mock('@/services/mapping/stagingShapes', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/mapping/stagingShapes')>()
  return {
    ...actual,
    buildRuntimeStagingShapes: (...args: unknown[]) => buildRuntimeStagingShapesMock(...args),
  }
})

describe('ReviewView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    toastAddMock.mockReset()
    buildRuntimeStagingShapesMock.mockReset()
    buildRuntimeStagingShapesMock.mockReturnValue({
      profile: null,
      nodeShapes: [],
      turtle: '',
    })
  })

  function mountView() {
    return mount(ReviewView, {
      global: {
        stubs: {
          Message: { template: '<div class="message"><slot /></div>' },
          Button: { template: '<button><slot /></button>' },
          InputText: { template: '<input />' },
          SelectButton: { template: '<div><slot name="option" /></div>' },
          Tag: { template: '<span><slot /></span>' },
        },
      },
    })
  }

  it('surfaces staging-shape generation errors instead of crashing during mount', async () => {
    const dataStore = useDataStore()
    dataStore.upsertSource(new TabularDataSource({
      id: 'source-1',
      name: 'Source One',
      headers: ['Name'],
      rows: [['Alpha']],
      role: 'source',
      origin: { kind: 'uploaded-file', filename: 'source.csv', mediaType: 'text/csv' },
    }))
    buildRuntimeStagingShapesMock.mockImplementation(() => {
      throw new Error('Synthetic staging-shape failure')
    })

    const wrapper = mountView()
    await Promise.resolve()
    await Promise.resolve()

    expect(wrapper.text()).toContain('Synthetic staging-shape failure')
  })
})