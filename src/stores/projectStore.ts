import { defineStore } from 'pinia'
import { computed, reactive, shallowRef } from 'vue'
import { useDataStore } from './dataStore'
import { useMetadataStore } from './metadataStore'
import { useShapesStore } from './shapesStore'
import { useMappingStore } from './mappingStore'
import type { ProjectSnapshotRepository } from '@/services/infrastructure/storage/projectSnapshotRepository'
import type { ProjectSnapshot } from '@/services/project/projectSnapshot'

export const useProjectStore = defineStore('project', () => {
  const data = useDataStore()
  const metadata = useMetadataStore()
  const shapes = useShapesStore()
  const mapping = useMappingStore()
  const snapshotRepository = shallowRef<ProjectSnapshotRepository | null>(null)

  const project = reactive({
    title: 'Untitled dataset',
    createdAt: new Date().toISOString(),
    get hasShapes() { return shapes.hasShapes },
    get hasData() { return data.sources.length > 0 },
    get hasMapping() { return mapping.state.hasMappings },
  })

  const summary = computed(() => ({
    profiles: shapes.profiles.length,
    nodeShapes: shapes.nodeShapes.length,
    sources: data.sources.length,
    mappings: mapping.state.edges.length,
  }))

  function createSnapshot(): ProjectSnapshot {
    const metadataSnapshot = metadata.createSnapshot()

    return {
      version: 1,
      project: {
        title: project.title,
        createdAt: project.createdAt,
      },
      sources: data.createSnapshot(),
      shapeProfiles: shapes.createSnapshot(),
      metadataProfiles: metadataSnapshot.profiles,
      metadataRootIris: metadataSnapshot.rootIris,
      metadataTurtle: metadataSnapshot.metadataTurtle,
      mapping: mapping.createSnapshot(),
    }
  }

  function restoreSnapshot(snapshot: ProjectSnapshot): void {
    data.restoreSnapshot(snapshot.sources)
    shapes.restoreSnapshot(snapshot.shapeProfiles)
    metadata.restoreSnapshot({
      profiles: snapshot.metadataProfiles,
      rootIris: snapshot.metadataRootIris,
      metadataTurtle: snapshot.metadataTurtle,
    })
    mapping.restoreSnapshot(snapshot.mapping)
    project.title = snapshot.project.title
    project.createdAt = snapshot.project.createdAt
  }

  function setSnapshotRepository(repository: ProjectSnapshotRepository | null): void {
    snapshotRepository.value = repository
  }

  async function saveSnapshot(): Promise<ProjectSnapshot> {
    const snapshot = createSnapshot()
    if (!snapshotRepository.value) return snapshot
    await snapshotRepository.value.saveSnapshot(snapshot)
    return snapshot
  }

  async function loadSnapshot(): Promise<ProjectSnapshot | null> {
    if (!snapshotRepository.value) return null
    const snapshot = await snapshotRepository.value.loadSnapshot()
    if (snapshot) restoreSnapshot(snapshot)
    return snapshot
  }

  async function clearSnapshot(): Promise<void> {
    await snapshotRepository.value?.clearSnapshot?.()
  }

  function reset() {
    data.reset()
    metadata.reset()
    shapes.reset()
    mapping.reset()
    project.title = 'Untitled dataset'
    project.createdAt = new Date().toISOString()
  }

  return {
    project,
    summary,
    createSnapshot,
    restoreSnapshot,
    setSnapshotRepository,
    saveSnapshot,
    loadSnapshot,
    clearSnapshot,
    reset,
  }
})
