/**
 * browseService
 *
 * Builds an in-memory view-model over a generated rdflib `Store` for the
 * Browse view. Groups subjects by their `rdf:type`, attaches a
 * human-readable label (`schema:name` → `rdfs:label` → `dcterms:title` →
 * local IRI fragment), and exposes their literal/object properties for
 * card and list rendering.
 *
 * Pure function — no Vue/Pinia coupling. Easy to unit-test.
 */
import { type Store, type NamedNode, type BlankNode, type Literal } from 'rdflib'
import { RDF_TYPE, RDFS_LABEL, DCT_TITLE } from '@/domain/rdfConstants'
import type { DataSource } from '@/domain/DataSource'
import type { NodeShape } from '@/domain/NodeShape'
import {
  airtablePrimaryFieldName,
  isAirtableSource,
} from '@/features/mapping/extensions/modules/source-data/airtable/workflow'
import { stagingSubjectForRow } from '@/services/mapping/stagingSemantics'

const SCHEMA_NAME_IRI = 'http://schema.org/name'
const FOAF_NAME_IRI = 'http://xmlns.com/foaf/0.1/name'
const SKOS_PREF_LABEL_IRI = 'http://www.w3.org/2004/02/skos/core#prefLabel'
const GND_PREFERRED_NAME_IRI = 'https://d-nb.info/standards/elementset/gnd#preferredName'

/** Property paths that act as "title" for a subject, in priority order. */
const LABEL_PRIORITY = [
  SCHEMA_NAME_IRI,
  RDFS_LABEL.value,
  DCT_TITLE.value,
  SKOS_PREF_LABEL_IRI,
  FOAF_NAME_IRI,
  GND_PREFERRED_NAME_IRI,
]

/** A single property value, ready for display. */
export interface BrowsePropertyValue {
  /** Display label of the property (sh:name → local IRI). */
  label: string
  /** Full property IRI (predicate). */
  predicate: string
  /** Stringified value (literal lex form, or IRI for resources). */
  value: string
  /** True if the value is a NamedNode/BNode (clickable reference). */
  isResource: boolean
  /**
   * For resource references: the resolved label of the referenced subject,
   * if it exists in the same graph. Otherwise undefined and the UI should
   * fall back to the local IRI fragment.
   */
  resolvedLabel?: string
  /** Datatype IRI if known. */
  datatype?: string
}

/** A single subject card. */
export interface BrowseSubject {
  iri: string
  /** Display label resolved from LABEL_PRIORITY or a fallback. */
  label: string
  /** All rdf:type IRIs of this subject. */
  classes: string[]
  /** Properties grouped together — excludes rdf:type and the label predicate. */
  properties: BrowsePropertyValue[]
}

/** A grouping bucket per class IRI. */
export interface BrowseClassGroup {
  classIri: string
  /** Display label for the class header (sh:name on shape, or local fragment). */
  classLabel: string
  /** Number of subjects in this group. */
  count: number
  subjects: BrowseSubject[]
}

export interface BrowseModel {
  /** Total subjects across all classes. */
  totalSubjects: number
  /** Groups in alphabetical class-label order. */
  groups: BrowseClassGroup[]
}

function sourceLabelFallbacks(sources: readonly DataSource[]): Map<string, string> {
  const labels = new Map<string, string>()

  for (const source of sources) {
    if (!isAirtableSource(source)) continue

    const primaryFieldName = airtablePrimaryFieldName(source)
    if (!primaryFieldName) continue

    const headerIndex = source.headers.indexOf(primaryFieldName)
    if (headerIndex < 0) continue

    for (let rowIdx = 0; rowIdx < source.rows.length; rowIdx += 1) {
      const rawValue = source.rows[rowIdx]?.[headerIndex]
      const label = typeof rawValue === 'string' ? rawValue.trim() : String(rawValue ?? '').trim()
      const subject = stagingSubjectForRow(source, rowIdx)
      if (!label) continue
      if (!subject) continue
      labels.set(subject.value, label)
    }
  }

  return labels
}

function localName(iri: string): string {
  const idx = Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/'))
  return idx >= 0 ? iri.slice(idx + 1) : iri
}

/** Resolves a class IRI to a human label using the loaded shapes. */
function classLabelFor(classIri: string, shapes: readonly NodeShape[]): string {
  const shape = shapes.find(s => s.targetClass?.value === classIri)
  if (shape?.rdfsLabel) return shape.rdfsLabel
  if (shape?.label) return shape.label
  return localName(classIri) || classIri
}

/** Resolves a property IRI to its sh:name based on any shape that defines it. */
function propertyLabelFor(predicate: string, shapes: readonly NodeShape[]): string {
  for (const shape of shapes) {
    const ps = shape.properties.find(p => p.path?.value === predicate)
    if (ps?.name) return ps.name
  }
  return localName(predicate) || predicate
}

/**
 * Builds the browse view-model from the generated RDF store. Subjects are
 * collected by walking all `rdf:type` triples; if a subject has no type
 * triple it is grouped under an "Untyped" pseudo-class.
 */
export function buildBrowseModel(store: Store, shapes: readonly NodeShape[], sources: readonly DataSource[] = []): BrowseModel {
  const stmts = (store as unknown as { statements: Array<{
    subject: NamedNode | BlankNode
    predicate: NamedNode
    object: NamedNode | BlankNode | Literal
  }> }).statements ?? []

  const subjectClasses = new Map<string, Set<string>>()
  const subjectProps = new Map<string, Map<string, Array<NamedNode | BlankNode | Literal>>>()
  const allSubjects = new Set<string>()

  for (const st of stmts) {
    if (!st.subject || !st.predicate) continue
    const subjIri = st.subject.value
    if (!subjIri) continue
    allSubjects.add(subjIri)

    if (st.predicate.value === RDF_TYPE.value) {
      if (!subjectClasses.has(subjIri)) subjectClasses.set(subjIri, new Set())
      subjectClasses.get(subjIri)!.add(st.object.value)
      continue
    }

    if (!subjectProps.has(subjIri)) subjectProps.set(subjIri, new Map())
    const props = subjectProps.get(subjIri)!
    if (!props.has(st.predicate.value)) props.set(st.predicate.value, [])
    props.get(st.predicate.value)!.push(st.object)
  }

  function resolveLabel(iri: string, props: Map<string, Array<NamedNode | BlankNode | Literal>> | undefined): { label: string; usedPredicate: string | null } {
    if (props) {
      for (const candidate of LABEL_PRIORITY) {
        const vals = props.get(candidate)
        if (vals && vals.length > 0) {
          const first = vals[0]
          if (first.termType === 'Literal' || first.termType === 'NamedNode' || first.termType === 'BlankNode') {
            return { label: first.value, usedPredicate: candidate }
          }
        }
      }
    }
    return { label: localName(iri) || iri, usedPredicate: null }
  }

  const subjectLabels = new Map<string, string>()
  const subjectUsedLabelPredicate = new Map<string, string | null>()
  const fallbackLabels = sourceLabelFallbacks(sources)
  for (const subjIri of allSubjects) {
    const { label, usedPredicate } = resolveLabel(subjIri, subjectProps.get(subjIri))
    subjectLabels.set(subjIri, usedPredicate ? label : (fallbackLabels.get(subjIri) ?? label))
    subjectUsedLabelPredicate.set(subjIri, usedPredicate)
  }

  const buckets = new Map<string, BrowseSubject[]>()
  const UNTYPED = '__untyped__'

  for (const subjIri of allSubjects) {
    const props = subjectProps.get(subjIri)
    const classes = subjectClasses.get(subjIri)
    const classList = classes ? Array.from(classes).sort() : []
    const label = subjectLabels.get(subjIri) ?? subjIri
    const usedPredicate = subjectUsedLabelPredicate.get(subjIri) ?? null

    const propValues: BrowsePropertyValue[] = []
    if (props) {
      const sortedPredicates = Array.from(props.keys()).sort((a, b) =>
        propertyLabelFor(a, shapes).localeCompare(propertyLabelFor(b, shapes)),
      )
      for (const predicate of sortedPredicates) {
        if (predicate === usedPredicate) continue
        for (const obj of props.get(predicate)!) {
          const isResource = obj.termType === 'NamedNode' || obj.termType === 'BlankNode'
          propValues.push({
            label: propertyLabelFor(predicate, shapes),
            predicate,
            value: obj.value,
            isResource,
            resolvedLabel: isResource ? subjectLabels.get(obj.value) : undefined,
            datatype: obj.termType === 'Literal' ? (obj as Literal).datatype?.value : undefined,
          })
        }
      }
    }

    const subject: BrowseSubject = {
      iri: subjIri,
      label,
      classes: classList,
      properties: propValues,
    }

    const targetBuckets = classList.length > 0 ? classList : [UNTYPED]
    for (const cls of targetBuckets) {
      if (!buckets.has(cls)) buckets.set(cls, [])
      buckets.get(cls)!.push(subject)
    }
  }

  const groups: BrowseClassGroup[] = Array.from(buckets.entries())
    .map(([classIri, subjects]) => ({
      classIri,
      classLabel: classIri === UNTYPED ? '(untyped)' : classLabelFor(classIri, shapes),
      count: subjects.length,
      subjects: subjects.sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => a.classLabel.localeCompare(b.classLabel))

  return {
    totalSubjects: allSubjects.size,
    groups,
  }
}


