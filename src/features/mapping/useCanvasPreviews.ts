import { computed, ref, type Ref } from 'vue'
import type { DataSource } from '@/domain/DataSource'
import type { NodeShape } from '@/domain/NodeShape'
import type { useDataStore } from '@/stores/dataStore'
import type { useMappingStore } from '@/stores/mappingStore'
import type { useShapesStore } from '@/stores/shapesStore'
import { findPreviewHandler } from '@/features/mapping/mappingExtensionRegistry'
import { buildBrowseModel } from '@/services/browse/browseService'
import { generateRdf, serializeGraph } from '@/services/rdf/rdfGenerator'

type DataStore = ReturnType<typeof useDataStore>
type MappingStore = ReturnType<typeof useMappingStore>
type ShapesStore = ReturnType<typeof useShapesStore>

interface ToastLike {
  add(message: {
    severity: string
    summary: string
    detail?: string
    life?: number
  }): void
}

interface UseCanvasPreviewsOptions {
  dataStore: DataStore
  shapesStore: ShapesStore
  mappingStore: MappingStore
  sources: Ref<DataSource[]>
  nodeShapes: Ref<NodeShape[]>
  profiles: Ref<Array<{ rawTurtle: string }>>
  toast: ToastLike
}

export function useCanvasPreviews(options: UseCanvasPreviewsOptions) {
  const tablePreviewOpen = ref(false)
  const pairedSourcePreviewOpen = ref(false)
  const shapePreviewOpen = ref(false)
  const previewSource = ref<DataSource | null>(null)
  const previewPrimarySource = ref<DataSource | null>(null)
  const previewSecondarySource = ref<DataSource | null>(null)
  const previewShape = ref<NodeShape | null>(null)
  const previewShapeValuesTurtle = ref('')
  const previewShapeSubjects = ref<Array<{ iri: string; label: string }>>([])
  const isShapePreviewLoading = ref(false)
  const combinedCanvasShapesTurtle = computed(() => options.profiles.value.map(profile => profile.rawTurtle).join('\n\n'))

  function openTablePreview(source: DataSource): void {
    previewSource.value = source
    tablePreviewOpen.value = true
  }

  function openPairedSourcePreview(primarySource: DataSource | null, secondarySource: DataSource | null): void {
    previewPrimarySource.value = primarySource
    previewSecondarySource.value = secondarySource
    pairedSourcePreviewOpen.value = true
  }

  function openNodePreview(nodeId: string): void {
    const previewHandler = findPreviewHandler(nodeId)
    if (!previewHandler) return
    previewHandler.preview(nodeId, {
      dataStore: options.dataStore,
      mappingStore: options.mappingStore,
      sources: options.sources.value,
      toast: options.toast,
      openTablePreview,
      openPairedSourcePreview,
    })
  }

  async function openShapePreview(shape: NodeShape): Promise<void> {
    previewShape.value = shape
    previewShapeValuesTurtle.value = ''
    previewShapeSubjects.value = []
    shapePreviewOpen.value = true

    if (!shape.targetClass || options.sources.value.length === 0 || !options.mappingStore.state.hasMappings) return

    isShapePreviewLoading.value = true
    try {
      const generated = generateRdf(options.shapesStore.ap, options.mappingStore.state, options.sources.value)
      const model = buildBrowseModel(generated.store, options.nodeShapes.value, options.sources.value)
      const matchingGroup = model.groups.find(group => group.classIri === shape.targetClass?.value)

      previewShapeSubjects.value = (matchingGroup?.subjects ?? []).map(subject => ({
        iri: subject.iri,
        label: subject.label,
      }))
      previewShapeValuesTurtle.value = await serializeGraph(generated.store, 'text/turtle')
    } catch (err) {
      previewShapeValuesTurtle.value = ''
      previewShapeSubjects.value = []
      options.toast.add({
        severity: 'error',
        summary: 'Shape preview failed',
        detail: err instanceof Error ? err.message : String(err),
        life: 5000,
      })
    } finally {
      isShapePreviewLoading.value = false
    }
  }

  return {
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
  }
}

