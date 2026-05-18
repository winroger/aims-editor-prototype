import { graph, parse, type NamedNode, type BlankNode, type Literal, type Store } from 'rdflib'
import {
  DCT_CREATOR, DCT_DESCRIPTION, DCT_TITLE,
  OWL_IMPORTS, RDFS_LABEL, SH_NODE_SHAPE, SH_PROPERTY,
  SH_TARGET_CLASS, SH_NAME, SH_PATH, SH_DESCRIPTION,
  SH_DATATYPE, SH_NODE, SH_NODE_KIND, SH_MIN_COUNT,
  SH_MAX_COUNT, SH_PATTERN, SH_ORDER, SH_CLASS,
} from './rdfConstants'

const DEFAULT_BASE_URI = 'http://example.org/'

/**
 * Parsed PropertyShape from a SHACL graph.
 * Only the fields required for the mapping UI are surfaced here.
 */
export interface PropertyShape {
  nodeId: NamedNode | BlankNode
  /** sh:name (Literal) — UI label */
  name?: string
  /** sh:description (Literal) */
  description?: string
  /** sh:path (NamedNode) — RDF predicate */
  path?: NamedNode
  /** sh:datatype */
  datatype?: NamedNode
  /** sh:node — IRI of a referenced NodeShape (for object refs) */
  node?: NamedNode
  /** sh:nodeKind */
  nodeKind?: NamedNode
  /** sh:class */
  cls?: NamedNode
  minCount?: number
  maxCount?: number
  pattern?: string
  order?: number
  /** True when this property comes from a node-level inherited shape. */
  inherited?: boolean
  /** IRI of the inherited shape this property came from. */
  inheritedFromShapeIri?: string
  /** Label of the inherited shape this property came from. */
  inheritedFromShapeLabel?: string
}

/** Parsed sh:NodeShape with its property shapes. */
export interface NodeShape {
  /** Either a NamedNode (canonical IRI) or a BlankNode reference. */
  nodeId: NamedNode | BlankNode
  /** dcterms:title or rdfs:label */
  label?: string
  /** rdfs:label of the shape or target class when present in the profile. */
  rdfsLabel?: string
  /** dcterms:description */
  description?: string
  /** dcterms:creator */
  creator?: string
  /** sh:targetClass */
  targetClass?: NamedNode
  /** Associated property shapes */
  properties: PropertyShape[]
  /** Node-level inherited shapes declared via sh:node on the NodeShape itself. */
  inheritedShapeIris?: string[]
  /** Source profile IRI (the file/import this shape came from) */
  sourceProfileIri?: string
}

/**
 * Shape classification for UI routing:
 *
 * - `data`      Has at least one directly mappable property (for example
 *               sh:datatype, sh:nodeKind, sh:in, or any other non-sh:node field).
 *               These map directly from CSV columns or form-like inputs.
 * - `reference` Only has sh:node FK properties (no direct literal values).
 *               Placed on canvas but never needs a separate CSV source.
 * - `form`      Metadata shapes (sh:targetClass dcat:Dataset / DCAT / Collection Dataset).
 *               All their fields come from a form at export time, not from CSV.
 */
export type ShapeKind = 'data' | 'reference' | 'form'

/** Metadata namespace prefixes that indicate form-only shapes. */
const FORM_TARGET_CLASSES = new Set([
  'http://www.w3.org/ns/dcat#Dataset',
  'http://www.w3.org/ns/dcat#Catalog',
  'http://rdfs.org/ns/void#Dataset',
  'http://www.w3.org/2000/01/rdf-schema#Class',
])

export function classifyShape(shape: NodeShape): ShapeKind {
  // Shapes targeting DCAT/VoID Dataset → metadata form
  if (shape.targetClass && FORM_TARGET_CLASSES.has(shape.targetClass.value)) return 'form'

  // Any directly mappable property keeps the shape in the regular data lane.
  const hasDirectValueProp = shape.properties.some(p => p.path && !p.node)
  if (hasDirectValueProp) return 'data'

  // Has only sh:node FK properties
  const hasFkProp = shape.properties.some(p => p.node)
  if (hasFkProp) return 'reference'

  return 'data' // fallback
}

/** A parsed SHACL profile (one TTL file or one fetched import). */
export interface ShaclProfile {
  /** IRI identifying this profile (e.g. aps:UUID). */
  iri: string
  /** Source URI (file path, fetched URL, or 'embedded:NAME'). */
  source: string
  /** How this profile was loaded. */
  origin: 'uploaded' | 'fetched' | 'embedded'
  /** Raw TTL content. */
  rawTurtle: string
  /** owl:imports IRIs found in this profile. */
  imports: string[]
  /** All NodeShapes declared in this profile. */
  nodeShapes: NodeShape[]
}

/** ApplicationProfile: aggregated state of all loaded SHACL profiles. */
export class ApplicationProfile {
  /** Profiles keyed by IRI for de-duplication. */
  readonly profiles = new Map<string, ShaclProfile>()

  /** Adds or replaces a profile by IRI. */
  upsert(profile: ShaclProfile): void {
    this.profiles.set(profile.iri, profile)
  }

  /** All profiles in insertion order. */
  list(): ShaclProfile[] {
    return Array.from(this.profiles.values())
  }

  rawNodeShapes(): NodeShape[] {
    const seen = new Set<string>()
    const result: NodeShape[] = []
    for (const profile of this.profiles.values()) {
      for (const ns of profile.nodeShapes) {
        const key = ns.nodeId.value
        if (!seen.has(key)) {
          seen.add(key)
          result.push(ns)
        }
      }
    }
    return result
  }

  /** All NodeShapes across all profiles, de-duplicated by IRI. */
  allNodeShapes(): NodeShape[] {
    return this.rawNodeShapes().map(ns => this.resolveNodeShape(ns.nodeId.value))
  }

  /** Looks up a NodeShape by IRI (used to resolve sh:node references). */
  findNodeShape(iri: string): NodeShape | undefined {
    const found = this.rawNodeShapes().find(ns => ns.nodeId.value === iri)
    return found ? this.resolveNodeShape(found.nodeId.value) : undefined
  }

  inheritedImportedNodeShapeIds(): Set<string> {
    const hidden = new Set<string>()
    const rawShapes = this.rawNodeShapes()
    const rawByIri = new Map(rawShapes.map(shape => [shape.nodeId.value, shape]))

    for (const shape of rawShapes) {
      for (const inheritedIri of shape.inheritedShapeIris ?? []) {
        const inheritedShape = rawByIri.get(inheritedIri)
        if (!inheritedShape) continue
        if (inheritedShape.sourceProfileIri && inheritedShape.sourceProfileIri !== shape.sourceProfileIri) {
          hidden.add(inheritedIri)
        }
      }
    }

    return hidden
  }

  resolveNodeShape(iri: string, visited = new Set<string>()): NodeShape {
    const rawShape = this.rawNodeShapes().find(ns => ns.nodeId.value === iri)
    if (!rawShape) throw new Error(`Unknown NodeShape: ${iri}`)
    if (visited.has(iri)) return rawShape

    const nextVisited = new Set(visited)
    nextVisited.add(iri)

    const ownProperties = rawShape.properties.map(property => ({ ...property }))
    const ownKeys = new Set(ownProperties.map(propertyKeyFor))
    const inheritedProperties: PropertyShape[] = []

    for (const inheritedIri of rawShape.inheritedShapeIris ?? []) {
      const inheritedShape = this.resolveNodeShape(inheritedIri, nextVisited)
      for (const property of inheritedShape.properties) {
        const key = propertyKeyFor(property)
        if (ownKeys.has(key)) continue
        inheritedProperties.push({
          ...property,
          inherited: true,
          inheritedFromShapeIri: property.inheritedFromShapeIri ?? inheritedShape.nodeId.value,
          inheritedFromShapeLabel: property.inheritedFromShapeLabel ?? inheritedShape.label,
        })
      }
    }

    return {
      ...rawShape,
      properties: [...inheritedProperties, ...ownProperties],
    }
  }

  /** True when at least one shape has been loaded. */
  get hasShapes(): boolean {
    return this.allNodeShapes().length > 0
  }
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

/**
 * Parses a Turtle string into a `ShaclProfile`.
 *
 * @param rawTurtle  Turtle/TTL content
 * @param source     Origin label (file name, URL, or 'embedded:…')
 * @param origin     How the profile was loaded
 * @param iriHint    Optional fallback IRI when no top-level subject is found
 */
export function parseShaclProfile(
  rawTurtle: string,
  source: string,
  origin: ShaclProfile['origin'],
  iriHint?: string,
): ShaclProfile {
  const store: Store = graph()
  parse(rawTurtle, store, DEFAULT_BASE_URI, 'text/turtle')

  // Collect all subjects that have rdf:type sh:NodeShape OR have any sh:property
  const nodeShapeSubjects = new Set<string>()
  store.match(null, null, SH_NODE_SHAPE, null).forEach(t => {
    if (t.subject.termType === 'NamedNode') nodeShapeSubjects.add(t.subject.value)
  })
  // Also treat anything with a sh:property as a node shape (some profiles omit explicit type)
  store.match(null, SH_PROPERTY, null, null).forEach(t => {
    if (t.subject.termType === 'NamedNode') nodeShapeSubjects.add(t.subject.value)
  })

  const nodeShapes: NodeShape[] = []
  for (const iri of nodeShapeSubjects) {
    const subj = store.sym(iri)
    nodeShapes.push(extractNodeShape(subj as NamedNode, store))
  }

  // Determine the profile IRI: an explicit `iriHint` wins (e.g. when the
  // profile is loaded as a known owl:imports target), otherwise fall back
  // to the first NodeShape's IRI, otherwise the raw source label.
  // This matters because a single TTL can declare many NodeShapes whose
  // IRIs differ from the "profile" IRI used to import it; if we pick a
  // child shape's IRI as profileIri, downstream metadata-flagging breaks.
  const profileIri = iriHint ?? nodeShapes[0]?.nodeId.value ?? source

  // Mark provenance on each shape
  for (const ns of nodeShapes) ns.sourceProfileIri = profileIri

  // Collect owl:imports from every subject in the profile (typically only top-level shapes have them)
  const imports = new Set<string>()
  store.match(null, OWL_IMPORTS, null, null).forEach(t => {
    if (t.object.termType === 'NamedNode') imports.add(t.object.value)
  })

  return {
    iri: profileIri,
    source,
    origin,
    rawTurtle,
    imports: Array.from(imports),
    nodeShapes,
  }
}

function extractNodeShape(nodeId: NamedNode, store: Store): NodeShape {
  const shape: NodeShape = { nodeId, properties: [], inheritedShapeIris: [] }

  store.match(nodeId, null, null, null).forEach(t => {
    const p = t.predicate.value
    const obj = t.object as Literal | NamedNode | BlankNode
    if (p === DCT_TITLE.value) {
      if (obj.termType === 'Literal' && !shape.label) shape.label = obj.value
    } else if (p === RDFS_LABEL.value) {
      if (obj.termType === 'Literal') {
        if (!shape.rdfsLabel) shape.rdfsLabel = obj.value
        if (!shape.label) shape.label = obj.value
      }
    } else if (p === DCT_DESCRIPTION.value) {
      if (obj.termType === 'Literal') shape.description = obj.value
    } else if (p === DCT_CREATOR.value) {
      if (obj.termType === 'Literal') shape.creator = obj.value
    } else if (p === SH_TARGET_CLASS.value) {
      if (obj.termType === 'NamedNode') shape.targetClass = obj
    } else if (p === SH_NODE.value) {
      if (obj.termType === 'NamedNode') shape.inheritedShapeIris?.push(obj.value)
    } else if (p === SH_PROPERTY.value) {
      shape.properties.push(extractPropertyShape(obj as NamedNode | BlankNode, store))
    }
  })

  // Sort properties by sh:order when available
  shape.properties.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
  return shape
}

function extractPropertyShape(nodeId: NamedNode | BlankNode, store: Store): PropertyShape {
  const ps: PropertyShape = { nodeId }

  store.match(nodeId, null, null, null).forEach(t => {
    const p = t.predicate.value
    const obj = t.object as Literal | NamedNode | BlankNode
    if (p === SH_NAME.value && obj.termType === 'Literal') ps.name = obj.value
    else if (p === SH_DESCRIPTION.value && obj.termType === 'Literal') ps.description = obj.value
    else if (p === SH_PATH.value && obj.termType === 'NamedNode') ps.path = obj
    else if (p === SH_DATATYPE.value && obj.termType === 'NamedNode') ps.datatype = obj
    else if (p === SH_NODE.value && obj.termType === 'NamedNode') ps.node = obj
    else if (p === SH_NODE_KIND.value && obj.termType === 'NamedNode') ps.nodeKind = obj
    else if (p === SH_CLASS.value && obj.termType === 'NamedNode') ps.cls = obj
    else if (p === SH_MIN_COUNT.value && obj.termType === 'Literal') ps.minCount = Number(obj.value)
    else if (p === SH_MAX_COUNT.value && obj.termType === 'Literal') ps.maxCount = Number(obj.value)
    else if (p === SH_PATTERN.value && obj.termType === 'Literal') ps.pattern = obj.value
    else if (p === SH_ORDER.value && obj.termType === 'Literal') ps.order = Number(obj.value)
  })

  return ps
}

function propertyKeyFor(property: PropertyShape): string {
  return property.path?.value ?? property.nodeId.value
}
