import type { ShaclProfile } from '@/domain/NodeShape'

export type ViolationSeverity = 'error' | 'warning' | 'info'

export interface ValidationViolation {
  severity: ViolationSeverity
  shapeIri: string
  shapeLabel: string
  propertyPath: string
  propertyLabel: string
  message: string
  focusNode: string
  constraintComponent: string
  sourceShape: string
  value?: string
}

export interface ValidationResult {
  conforms: boolean
  violations: ValidationViolation[]
  readonly isValid: boolean
  readonly errorCount: number
  readonly warningCount: number
  readonly infoCount: number
}

export interface ValidateMappingOptions {
  shapeProfiles?: ShaclProfile[]
  metadataTurtle?: string
}

export function makeValidationResult(conforms: boolean, violations: ValidationViolation[]): ValidationResult {
  return {
    conforms,
    violations,
    get isValid() { return conforms },
    get errorCount() { return violations.filter(v => v.severity === 'error').length },
    get warningCount() { return violations.filter(v => v.severity === 'warning').length },
    get infoCount() { return violations.filter(v => v.severity === 'info').length },
  }
}