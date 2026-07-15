import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ApplicationProfile, parseShaclProfile, type NodeShape, type ShaclProfile } from '@/domain/NodeShape'
import { classifyShape } from '@/domain/NodeShape'
import { resolveImportsRecursive } from '@/services/infrastructure/imports/profileResolver'

/**
 * shapesStore
 *
 * Holds *data-schema* SHACL profiles only. Dataset-metadata profiles
 * (which power the export-side metadata forms) live in a separate
 * `metadataStore` with its own ApplicationProfile — there is no shared
 * state between the two anymore.
 *
 * If the user happens to load the same SHACL file in both contexts that's
 * fine: each store has its own copy and they don't interfere with each
 * other. This makes per-context filtering unnecessary.
 */
export const useShapesStore = defineStore('shapes', () => {
  const ap = ref<ApplicationProfile>(new ApplicationProfile())
  const isResolvingImports = ref(false)
  const lastResolveErrors = ref<{ iri: string; error: string }[]>([])

  /** Loaded profiles in insertion order. */
  const profiles = computed<ShaclProfile[]>(() => ap.value.list())

  /** All NodeShapes across all profiles, de-duplicated. */
  const nodeShapes = computed<NodeShape[]>(() => ap.value.allNodeShapes())

  /** Shapes suitable for the Mapping canvas. */
  const canvasShapes = computed<NodeShape[]>(() =>
    nodeShapes.value.filter(ns => {
      if (ap.value.inheritedImportedNodeShapeIds().has(ns.nodeId.value)) return false
      const isDirectlyLoadedRoot = profiles.value.some(profile => profile.iri === ns.sourceProfileIri && profile.source !== profile.iri)
      const k = classifyShape(ns)
      return isDirectlyLoadedRoot || k === 'data' || k === 'reference'
    }),
  )

  const hasShapes = computed(() => ap.value.hasShapes)

  function removeProfile(iri: string): void {
    ap.value.profiles.delete(iri)
  }

  /**
   * Adds one or more uploaded TTL files and recursively resolves their
   * `owl:imports`. Resolution is local-first (bundled assets), then
   * IndexedDB cache, then network — failures are non-blocking.
   */
  async function addTtlFiles(files: File[]): Promise<void> {
    for (const file of files) {
      const text = await file.text()
      const profile = parseShaclProfile(text, file.name, 'uploaded')
      ap.value.upsert(profile)
    }
    await resolveAllImports()
  }

  async function addProfileFromTurtle(
    turtle: string,
    source: string,
    iri?: string,
  ): Promise<void> {
    const profile = parseShaclProfile(turtle, source, 'fetched', iri)
    ap.value.upsert(profile)
    await resolveAllImports()
  }

  async function resolveAllImports(): Promise<void> {
    isResolvingImports.value = true
    lastResolveErrors.value = []
    try {
      const result = await resolveImportsRecursive(ap.value)
      lastResolveErrors.value = result.errors
    } finally {
      isResolvingImports.value = false
    }
  }

  /** Manual fallback for when an import couldn't be auto-fetched. */
  async function uploadFallbackForImport(iri: string, file: File): Promise<void> {
    const text = await file.text()
    const profile = parseShaclProfile(text, file.name, 'uploaded', iri)
    ap.value.upsert({ ...profile, iri })
    await resolveAllImports()
  }

  function reset(): void {
    ap.value = new ApplicationProfile()
    lastResolveErrors.value = []
  }

  return {
    ap,
    profiles,
    nodeShapes,
    canvasShapes,
    hasShapes,
    isResolvingImports,
    lastResolveErrors,
    removeProfile,
    addTtlFiles,
    addProfileFromTurtle,
    resolveAllImports,
    uploadFallbackForImport,
    reset,
  }
})


