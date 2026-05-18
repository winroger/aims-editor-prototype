import { onMounted, watch, type Ref, type WatchSource } from 'vue'

export type ShaclFormElement = HTMLElement & {
  registerPlugin?: (plugin: unknown) => void
}

interface UseShaclFormViewerOptions {
  formRef: Ref<ShaclFormElement | null>
  watchSources: WatchSource<unknown>[]
  getShapesTurtle: () => string
  getValuesTurtle: () => string
  getValuesSubject: () => string | undefined
  getShapeSubject: () => string | undefined
  getExtraAttributes?: () => Record<string, string | undefined>
  shouldApply?: () => boolean
  prepareElement?: (element: ShaclFormElement) => void
  deferApply?: (apply: () => void) => void
}

export function useShaclFormViewer(options: UseShaclFormViewerOptions) {
  function applyAttrs(): void {
    const element = options.formRef.value
    if (!element) return

    options.prepareElement?.(element)

    const shapesTurtle = options.getShapesTurtle()
    const valuesTurtle = options.getValuesTurtle()
    const valuesSubject = options.getValuesSubject()
    const shapeSubject = options.getShapeSubject()
    const extraAttributes = options.getExtraAttributes?.() ?? {}

    if (shapesTurtle) element.setAttribute('data-shapes', shapesTurtle)
    else element.removeAttribute('data-shapes')

    if (valuesTurtle) element.setAttribute('data-values', valuesTurtle)
    else element.removeAttribute('data-values')

    if (valuesSubject) element.setAttribute('data-values-subject', valuesSubject)
    else element.removeAttribute('data-values-subject')

    if (shapeSubject) element.setAttribute('data-shape-subject', shapeSubject)
    else element.removeAttribute('data-shape-subject')

    for (const [attribute, value] of Object.entries(extraAttributes)) {
      if (value) element.setAttribute(attribute, value)
      else element.removeAttribute(attribute)
    }
  }

  function scheduleApply(): void {
    if (options.shouldApply && !options.shouldApply()) return
    if (options.deferApply) {
      options.deferApply(applyAttrs)
      return
    }
    queueMicrotask(applyAttrs)
  }

  onMounted(scheduleApply)
  watch(options.watchSources, scheduleApply)

  return {
    applyAttrs,
  }
}