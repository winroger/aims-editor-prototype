import type { NamedNode as RdfNamedNode } from '@rdfjs/types'
import { classifyShape, type ApplicationProfile, type NodeShape, type PropertyShape, type ShaclProfile } from '@/domain/NodeShape'
import type { MappingState } from '@/domain/Mapping'
import type { ValidationViolation, ViolationSeverity } from '@/services/validation/validationTypes'

interface ValidationLookups {
  byShapeIri: Map<string, NodeShape>
  byPropertyShapeIri: Map<string, { owner: NodeShape; property: PropertyShape }>
}

function localName(value: string): string {
  return value.split(/[/#]/).filter(Boolean).pop() ?? value
}

function shapeLabel(shape: NodeShape): string {
  return shape.label ?? localName(shape.nodeId.value)
}

function propLabel(property: PropertyShape, pathValue: string): string {
  return property.name ?? (property.path ? localName(property.path.value) : localName(pathValue))
}

function collectNodeShapes(shapeProfiles: ShaclProfile[]): NodeShape[] {
  const seen = new Set<string>()
  const result: NodeShape[] = []
  for (const profile of shapeProfiles) {
    for (const shape of profile.nodeShapes) {
      if (seen.has(shape.nodeId.value)) continue
      seen.add(shape.nodeId.value)
      result.push(shape)
    }
  }
  return result
}

export function createValidationLookups(shapeProfiles: ShaclProfile[]): ValidationLookups {
  const byShapeIri = new Map<string, NodeShape>()
  const byPropertyShapeIri = new Map<string, { owner: NodeShape; property: PropertyShape }>()

  for (const shape of collectNodeShapes(shapeProfiles)) {
    byShapeIri.set(shape.nodeId.value, shape)
    for (const property of shape.properties) {
      byPropertyShapeIri.set(property.nodeId.value, { owner: shape, property })
    }
  }

  return { byShapeIri, byPropertyShapeIri }
}

function termValue(value: any): string {
  if (!value) return ''
  if (typeof value.value === 'string') return value.value
  if (value.term && typeof value.term.value === 'string') return value.term.value
  if (Array.isArray(value.terms) && typeof value.terms[0]?.value === 'string') return value.terms[0].value
  return ''
}

function pathValue(path: any): string {
  if (!path) return ''
  if (typeof path.value === 'string') return path.value
  if (path.term && typeof path.term.value === 'string') return path.term.value
  if (Array.isArray(path) && path.length > 0) {
    return path
      .flatMap(step => Array.isArray(step?.predicates) ? step.predicates.map((predicate: any) => predicate.value) : [])
      .filter(Boolean)
      .join(' / ')
  }
  return ''
}

function messageText(message: unknown): string {
  if (Array.isArray(message)) {
    return message.map(entry => termValue(entry)).filter(Boolean).join(' ')
  }
  if (message && typeof message === 'object') {
    return termValue(message)
  }
  return typeof message === 'string' ? message : ''
}

function mapSeverity(term: RdfNamedNode | undefined): ViolationSeverity {
  const value = term?.value ?? ''
  if (value.endsWith('Violation')) return 'error'
  if (value.endsWith('Warning')) return 'warning'
  return 'info'
}

export function mapValidationViolation(result: any, lookups: ValidationLookups): ValidationViolation {
  const sourceShapeValue = termValue(result.shape?.ptr?.term)
  const focusNodeValue = termValue(result.focusNode)
  const valueText = termValue(result.value)
  const pathText = pathValue(result.path)
  const byProperty = lookups.byPropertyShapeIri.get(sourceShapeValue)
  const owner = byProperty?.owner ?? lookups.byShapeIri.get(sourceShapeValue)
  const property = byProperty?.property ?? owner?.properties.find(candidate => candidate.path?.value === pathText)

  return {
    severity: mapSeverity(result.severity as RdfNamedNode | undefined),
    shapeIri: owner?.nodeId.value ?? sourceShapeValue ?? 'global',
    shapeLabel: owner ? shapeLabel(owner) : (sourceShapeValue ? localName(sourceShapeValue) : 'Allgemein'),
    propertyPath: property?.path?.value ?? pathText,
    propertyLabel: property ? propLabel(property, pathText) : (pathText ? localName(pathText) : 'Allgemein'),
    message: messageText(result.message) || 'SHACL-Verletzung',
    focusNode: focusNodeValue,
    constraintComponent: localName(termValue(result.constraintComponent)),
    sourceShape: sourceShapeValue,
    value: valueText || undefined,
  }
}

export function createStructuralWarnings(ap: ApplicationProfile, mapping: MappingState): ValidationViolation[] {
  const violations: ValidationViolation[] = []

  for (const shape of ap.allNodeShapes()) {
    if (classifyShape(shape) === 'form') continue

    const mappedEdges = mapping.forShape(shape.nodeId.value)
    for (const property of shape.properties) {
      if (!property.path || property.node) continue
      if ((property.minCount ?? 0) <= 0) continue
      if (mappedEdges.some(edge => edge.propertyPath === property.path?.value)) continue

      violations.push({
        severity: 'warning',
        shapeIri: shape.nodeId.value,
        shapeLabel: shapeLabel(shape),
        propertyPath: property.path.value,
        propertyLabel: propLabel(property, property.path.value),
        message: `Pflichtfeld mit sh:minCount ${property.minCount} ist noch nicht gemappt.`,
        focusNode: '',
        constraintComponent: 'MappingCoverage',
        sourceShape: property.nodeId.value,
      })
    }
  }

  return violations
}