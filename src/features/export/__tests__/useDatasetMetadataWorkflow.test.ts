import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia, storeToRefs } from 'pinia'
import { useDatasetMetadataWorkflow } from '@/features/export/useDatasetMetadataWorkflow'
import { useMetadataStore } from '@/stores/metadataStore'
import { useProjectStore } from '@/stores/projectStore'

const DATASET_TURTLE = `
@prefix dcat: <http://www.w3.org/ns/dcat#> .
@prefix dct: <http://purl.org/dc/terms/> .

<http://example.org/dataset>
  a dcat:Dataset ;
  dct:title "Named Dataset" .
`

describe('useDatasetMetadataWorkflow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('syncs the project title from saved dataset metadata', () => {
    const metadataStore = useMetadataStore()
    const projectStore = useProjectStore()
    const { rootProfiles, combinedTurtle } = storeToRefs(metadataStore)

    projectStore.project.title = 'Untitled dataset'

    const workflow = useDatasetMetadataWorkflow({
      metadataStore,
      projectStore,
      rootProfiles,
      combinedTurtle,
    })

    workflow.draftMetadataTurtle.value = DATASET_TURTLE
    workflow.saveMetadata()

    expect(metadataStore.metadataTurtle['https://w3id.org/nfdi4ing/profiles/4a5d4526-34d4-4b00-8f8f-4b13dd48e6d6'])
      .toContain('Named Dataset')
    expect(projectStore.project.title).toBe('Named Dataset')
  })
})