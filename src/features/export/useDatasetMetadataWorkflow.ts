import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { graph, namedNode, parse as parseRdf } from 'rdflib'
import { classifyShape, type ShaclProfile } from '@/domain/NodeShape'
import { extractDatasetMetadata } from '@/services/export/datasetMetadata'
import { DATASET_SCHEMA_CATALOG } from '@/services/infrastructure/imports/embeddedProfiles'
import type { useMetadataStore } from '@/stores/metadataStore'

type MetadataStore = ReturnType<typeof useMetadataStore>

const ROKIT_DATASET_PROFILE_IRI = 'https://w3id.org/nfdi4ing/profiles/4a5d4526-34d4-4b00-8f8f-4b13dd48e6d6'
const DEFAULT_BASE_URI = 'http://example.org/'
const DCT_CONFORMS_TO = namedNode('http://purl.org/dc/terms/conformsTo')
const RDF_TYPE = namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type')
const DCAT_DATASET = namedNode('http://www.w3.org/ns/dcat#Dataset')

interface UseDatasetMetadataWorkflowOptions {
  metadataStore: MetadataStore
  rootProfiles: ComputedRef<ShaclProfile[]>
  combinedTurtle: Ref<string>
}

function inferValuesSubject(turtle: string, datasetShapeSubject: string | undefined): string | undefined {
  if (!turtle.trim()) return undefined

  try {
    const store = graph()
    parseRdf(turtle, store, DEFAULT_BASE_URI, 'text/turtle')

    if (datasetShapeSubject) {
      const conformsToMatch = store.any(undefined, DCT_CONFORMS_TO, namedNode(datasetShapeSubject), null)
      if (conformsToMatch) return conformsToMatch.value
    }

    const datasetMatch = store.any(undefined, RDF_TYPE, DCAT_DATASET, null)
    if (datasetMatch) return datasetMatch.value

    return store.statements[0]?.subject.value
  } catch {
    return undefined
  }
}

export function useDatasetMetadataWorkflow(options: UseDatasetMetadataWorkflowOptions) {
  const loadError = ref<string | null>(null)
  const isEditing = ref(false)
  const draftMetadataTurtle = ref('')
  const editorSession = ref(0)

  const datasetEntry = DATASET_SCHEMA_CATALOG.find(entry => entry.iri === ROKIT_DATASET_PROFILE_IRI)

  const datasetProfile = computed(() =>
    options.rootProfiles.value.find(profile => profile.iri === ROKIT_DATASET_PROFILE_IRI) ?? null,
  )

  const datasetRootShape = computed(() =>
    datasetProfile.value?.nodeShapes.find(shape => classifyShape(shape) === 'form')
    ?? datasetProfile.value?.nodeShapes[0]
    ?? null,
  )

  const datasetShapeSubject = computed(() =>
    datasetRootShape.value?.nodeId.termType === 'NamedNode'
      ? datasetRootShape.value.nodeId.value
      : undefined,
  )

  const datasetFormKey = computed(() => [
    datasetProfile.value?.iri ?? 'missing-profile',
    datasetShapeSubject.value ?? 'missing-shape',
    options.combinedTurtle.value.length,
  ].join('::'))

  const metadataTurtle = computed(() => options.metadataStore.metadataTurtle[ROKIT_DATASET_PROFILE_IRI] ?? '')
  const metadataValuesSubject = computed(() => inferValuesSubject(metadataTurtle.value, datasetShapeSubject.value))
  const draftValuesSubject = computed(() => inferValuesSubject(draftMetadataTurtle.value, datasetShapeSubject.value))
  const metadataSummary = computed(() => extractDatasetMetadata(metadataTurtle.value))

  const viewerFormKey = computed(() => [
    datasetFormKey.value,
    'view',
    metadataTurtle.value,
  ].join('::'))

  const editorFormKey = computed(() => [
    datasetFormKey.value,
    'edit',
    editorSession.value,
  ].join('::'))

  async function ensureRokitDatasetProfile(): Promise<void> {
    loadError.value = null
    if (!datasetEntry) {
      loadError.value = 'Das RO-kit-Datensatzprofil ist nicht im eingebetteten Katalog vorhanden.'
      return
    }

    options.rootProfiles.value
      .filter(profile => profile.iri !== ROKIT_DATASET_PROFILE_IRI)
      .forEach(profile => {
        options.metadataStore.setMetadataTurtle(profile.iri, '')
        options.metadataStore.removeRoot(profile.iri)
      })

    if (!options.rootProfiles.value.some(profile => profile.iri === ROKIT_DATASET_PROFILE_IRI)) {
      try {
        await options.metadataStore.addRootFromTurtle(datasetEntry.rawTurtle, `${datasetEntry.id}.ttl`, datasetEntry.iri)
      } catch (error) {
        loadError.value = error instanceof Error ? error.message : String(error)
      }
    }
  }

  function startEditing(): void {
    draftMetadataTurtle.value = metadataTurtle.value
    editorSession.value += 1
    isEditing.value = true
  }

  function cancelEditing(): void {
    draftMetadataTurtle.value = metadataTurtle.value
    isEditing.value = false
  }

  function updateDraftFromSerialized(serialize?: () => string): void {
    if (!serialize) return
    try {
      draftMetadataTurtle.value = serialize() ?? ''
    } catch {
      // The custom element may not be ready on its first change event.
    }
  }

  function saveMetadata(serialize?: () => string): void {
    if (serialize) {
      try {
        draftMetadataTurtle.value = serialize() ?? draftMetadataTurtle.value
      } catch {
        // Keep the last successful draft if serialization is briefly unavailable.
      }
    }

    options.metadataStore.setMetadataTurtle(ROKIT_DATASET_PROFILE_IRI, draftMetadataTurtle.value)
    isEditing.value = false
  }

  return {
    loadError,
    isEditing,
    draftMetadataTurtle,
    editorSession,
    datasetProfile,
    datasetShapeSubject,
    viewerFormKey,
    editorFormKey,
    metadataTurtle,
    metadataValuesSubject,
    draftValuesSubject,
    metadataSummary,
    ensureRokitDatasetProfile,
    startEditing,
    cancelEditing,
    updateDraftFromSerialized,
    saveMetadata,
  }
}