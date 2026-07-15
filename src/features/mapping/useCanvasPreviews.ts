import { computed, ref, type Ref } from 'vue'
import type { NodeShape } from '@/domain/NodeShape'
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

interface UseCanvasPreviewsOptions {
  shapesStore: ShapesStore
  profiles: Ref<Array<{ rawTurtle: string }>>
  toast: ToastLike
}

export function useCanvasPreviews(options: UseCanvasPreviewsOptions) {
  const shapePreviewOpen = ref(false)
  const previewShape = ref<NodeShape | null>(null)
  const previewShapeValuesTurtle = ref('')
  const previewShapeSubjects = ref<Array<{ iri: string; label: string }>>([])
  const combinedCanvasShapesTurtle = computed(() => options.profiles.value.map(profile => profile.rawTurtle).join('\n\n'))

  async function openShapePreview(shape: NodeShape): Promise<void> {
    previewShape.value = shape
    previewShapeValuesTurtle.value = ''
    previewShapeSubjects.value = []
    shapePreviewOpen.value = true
  }

  return {
    shapePreviewOpen,
    previewShape,
    previewShapeValuesTurtle,
    previewShapeSubjects,
    combinedCanvasShapesTurtle,
    openShapePreview,
  }
}

