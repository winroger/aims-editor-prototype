import { computed, ref, watch, type Ref } from 'vue'
import type { ApplicationProfile, ShaclProfile } from '@/domain/NodeShape'
import type { MappingState } from '@/domain/Mapping'
import type { DataSource } from '@/domain/DataSource'
import type { ValidationResult } from '@/services/validation/validationTypes'

interface UseMappingValidationOptions {
  applicationProfile: ApplicationProfile
  profiles: Ref<ShaclProfile[]>
  mappingState: MappingState
  sources: Ref<DataSource[]>
  getCombinedMetadataTurtle: () => string
}

export function useMappingValidation(options: UseMappingValidationOptions) {
  const validationSidebarOpen = ref(false)
  const validationResult = ref<ValidationResult | null>(null)
  const validationError = ref<string | null>(null)
  const isValidating = ref(false)
  let validationRunId = 0

  const canValidate = computed(() =>
    options.profiles.value.length > 0 && options.mappingState.edges.length > 0,
  )

  const validationStatusSeverity = computed<'success' | 'warn' | 'danger' | 'secondary'>(() => {
    if (validationError.value) return 'danger'
    if (!canValidate.value) return 'secondary'
    if (isValidating.value) return 'secondary'
    if (!validationResult.value) return 'secondary'
    if (validationResult.value.errorCount > 0) return 'danger'
    if (validationResult.value.warningCount > 0) return 'warn'
    return 'success'
  })

  const validationStatusIcon = computed(() => {
    if (isValidating.value) return 'pi pi-spin pi-spinner'
    if (validationError.value) return 'pi pi-times-circle'
    if (!canValidate.value) return 'pi pi-shield'
    if (!validationResult.value) return 'pi pi-question-circle'
    if (validationResult.value.errorCount > 0) return 'pi pi-times-circle'
    if (validationResult.value.warningCount > 0) return 'pi pi-exclamation-triangle'
    return 'pi pi-check-circle'
  })

  const validationStatusLabel = computed(() => {
    if (isValidating.value) return 'Validation in progress...'
    if (validationError.value) return 'Validation failed'
    if (!canValidate.value) return 'Not ready yet'
    if (!validationResult.value) return 'No results yet'
    if (validationResult.value.errorCount > 0) return `${validationResult.value.errorCount} errors`
    if (validationResult.value.warningCount > 0) return `${validationResult.value.warningCount} warnings`
    return validationResult.value.conforms ? 'SHACL conform' : 'Not conform'
  })

  async function loadValidateMapping() {
    const module = await import('@/services/validation/shaclValidator')
    return module.validateMapping
  }

  async function refreshValidation(): Promise<void> {
    const runId = ++validationRunId

    if (!canValidate.value) {
      validationResult.value = null
      validationError.value = null
      isValidating.value = false
      return
    }

    isValidating.value = true
    validationError.value = null

    try {
      const validateMapping = await loadValidateMapping()
      const result = await validateMapping(options.applicationProfile, options.mappingState, options.sources.value, {
        shapeProfiles: [...options.profiles.value],
        metadataTurtle: options.getCombinedMetadataTurtle(),
      })
      if (runId !== validationRunId) return
      validationResult.value = result
    } catch (err) {
      if (runId !== validationRunId) return
      validationResult.value = null
      validationError.value = err instanceof Error ? err.message : String(err)
    } finally {
      if (runId === validationRunId) isValidating.value = false
    }
  }

  watch(
    [
      () => options.profiles.value.map(profile => `${profile.iri}:${profile.rawTurtle.length}`).join('|'),
      () => options.sources.value.map(source => `${source.id}:${source.headers.join(',')}:${source.rows.length}`).join('|'),
      () => options.mappingState.edges.map(edge => `${edge.sourceId}:${edge.sourceHeader}:${edge.secondarySourceHeader ?? ''}:${edge.shapeIri}:${edge.propertyPath}:${edge.transform ?? ''}:${edge.transformNodeId ?? ''}`).join('|'),
    ],
    () => { void refreshValidation() },
    { immediate: true },
  )

  return {
    validationSidebarOpen,
    validationResult,
    validationError,
    isValidating,
    canValidate,
    validationStatusSeverity,
    validationStatusIcon,
    validationStatusLabel,
    refreshValidation,
  }
}