import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { TabularDataSource } from '@/domain/DataSource'
import { useDataStore } from '@/stores/dataStore'
import { useMetadataStore } from '@/stores/metadataStore'
import { useProjectStore } from '@/stores/projectStore'
import { useShapesStore } from '@/stores/shapesStore'
import {
  buildProjectSnapshotFilename,
  createProjectSnapshotBlob,
  readProjectSnapshotFile,
} from '@/services/project/projectFile'
import {
  parseProjectSnapshotJson,
  serializeProjectSnapshot,
} from '@/services/project/projectSnapshot'

const SHAPE_PROFILE = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

ex:PersonShape a sh:NodeShape ;
  sh:targetClass ex:Person .
`

describe('projectFile', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('serializes and parses a project snapshot as JSON', async () => {
    const project = useProjectStore()
    const data = useDataStore()
    const shapes = useShapesStore()
    const metadata = useMetadataStore()

    project.project.title = 'Dataset A'
    await shapes.addProfileFromTurtle(SHAPE_PROFILE, 'shape.ttl', 'http://example.org/profile')
    metadata.setMetadataTurtle('http://example.org/profile', '@prefix ex: <http://example.org/> .')
    data.upsertSource(new TabularDataSource({
      id: 'source-1',
      name: 'Source One',
      headers: ['Name'],
      rows: [['Alpha']],
      role: 'source',
      hidden: false,
      origin: { kind: 'uploaded-file', filename: 'source.csv', mediaType: 'text/csv' },
    }))

    const snapshot = project.createSnapshot()
    const roundTrip = parseProjectSnapshotJson(serializeProjectSnapshot(snapshot))

    expect(roundTrip).toEqual(snapshot)

    const file = new File([serializeProjectSnapshot(snapshot)], 'dataset-a.ardmp.json', {
      type: 'application/json',
    })
    const parsedFileSnapshot = await readProjectSnapshotFile(file)

    expect(parsedFileSnapshot).toEqual(snapshot)
  })

  it('rejects malformed and incomplete project files', () => {
    expect(() => parseProjectSnapshotJson('{')).toThrow('Project file is not valid JSON.')
    expect(() => parseProjectSnapshotJson(JSON.stringify({ version: 2 })))
      .toThrow('Project file uses an unsupported version.')
    expect(() => parseProjectSnapshotJson(JSON.stringify({
      version: 1,
      project: { title: 'Demo', createdAt: '2026-06-23T10:00:00.000Z' },
      sources: [],
      shapeProfiles: [],
      metadataProfiles: [],
      metadataRootIris: [],
      metadataTurtle: {},
      mapping: {},
    }))).toThrow('Project file is missing mapping edges.')
  })

  it('builds a stable filename and JSON blob for downloads', async () => {
    const project = useProjectStore()

    project.project.title = 'Dataset: Main / Demo'
    const snapshot = project.createSnapshot()
    const blob = createProjectSnapshotBlob(snapshot)

    expect(buildProjectSnapshotFilename(project.project.title)).toBe('dataset-main-demo.ardmp.json')
    expect(blob.type).toBe('application/json')
    expect(await blob.text()).toContain('"version": 1')
  })
})