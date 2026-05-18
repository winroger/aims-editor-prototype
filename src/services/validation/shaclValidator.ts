import rdfDataModel from '@rdfjs/data-model'
import { Validator } from 'shacl-engine'
import { targetResolvers, validations } from 'shacl-engine/sparql.js'
import type { ApplicationProfile } from '@/domain/NodeShape'
import type { MappingState } from '@/domain/Mapping'
import type { DataSource } from '@/domain/DataSource'
import { generateRdf } from '@/services/rdf/rdfGenerator'
import {
  makeValidationResult,
  type ValidateMappingOptions,
  type ValidationResult,
} from '@/services/validation/validationTypes'
import { mergeMetadataTurtle, parseProfilesToStore, toDatasetCore } from '@/services/validation/validationShapes'
import {
  createStructuralWarnings,
  createValidationLookups,
  mapValidationViolation,
} from '@/services/validation/validationViolationMapper'

export async function validateMapping(
  ap: ApplicationProfile,
  mapping: MappingState,
  sources: DataSource[],
  options: ValidateMappingOptions = {},
): Promise<ValidationResult> {
  const shapeProfiles = options.shapeProfiles && options.shapeProfiles.length > 0
    ? options.shapeProfiles
    : ap.list()

  if (shapeProfiles.length === 0) {
    return makeValidationResult(true, [])
  }

  const generated = generateRdf(ap, mapping, sources)
  mergeMetadataTurtle(generated.store, options.metadataTurtle)

  const preparedShapes = parseProfilesToStore(shapeProfiles)
  const validator = new Validator(toDatasetCore(preparedShapes.store), {
    factory: rdfDataModel,
    targetResolvers,
    validations,
  })

  const report = await validator.validate({ dataset: toDatasetCore(generated.store) })
  const lookups = createValidationLookups(shapeProfiles)
  const violations = [
    ...preparedShapes.warnings,
    ...createStructuralWarnings(ap, mapping),
    ...(report.results ?? []).map((result: any) => mapValidationViolation(result, lookups)),
  ]

  return makeValidationResult(Boolean(report.conforms), violations)
}
