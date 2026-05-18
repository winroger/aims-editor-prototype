/**
 * Mapping
 *
 * Maps NodeShape properties (identified by NodeShape IRI + property path IRI)
 * to a column of a data source.
 *
 * Internally stored as a flat array of edges so that the mapping canvas can
 * render and serialise them efficiently.
 */

export interface MappingEdge {
  /** ID of the source DataSource */
  sourceId: string
  /** Header name within the source */
  sourceHeader: string
  /** IRI of the target NodeShape */
  shapeIri: string
  /** IRI of the target property path (sh:path value) */
  propertyPath: string
  /** Optional: cell-value transformation (split, prefix…) */
  transform?: MappingTransformId
  /** Optional second source header for two-input transforms such as lat/lng → WKT. */
  secondarySourceHeader?: string
  /** Optional canvas node id for transform-backed mappings. */
  transformNodeId?: string
  /** Optional canvas node id for direct GeoNames-backed mappings. */
  geoNamesNodeId?: string
  /** Optional canvas node id for direct Lobid-backed mappings. */
  lobidNodeId?: string
}

export type MappingTransformId = string

export class MappingState {
  edges: MappingEdge[] = []

  /** Adds or replaces the mapping for a given (shape, property) pair. */
  addOrReplace(edge: MappingEdge): void {
    const idx = this.edges.findIndex(
      e => e.shapeIri === edge.shapeIri && e.propertyPath === edge.propertyPath,
    )
    if (idx >= 0) this.edges[idx] = edge
    else this.edges.push(edge)
  }

  remove(shapeIri: string, propertyPath: string): void {
    this.edges = this.edges.filter(
      e => !(e.shapeIri === shapeIri && e.propertyPath === propertyPath),
    )
  }

  /** Lookup: which edge maps a given property of a given shape? */
  forProperty(shapeIri: string, propertyPath: string): MappingEdge | undefined {
    return this.edges.find(
      e => e.shapeIri === shapeIri && e.propertyPath === propertyPath,
    )
  }

  /** All edges for a given shape (i.e. all mapped properties). */
  forShape(shapeIri: string): MappingEdge[] {
    return this.edges.filter(e => e.shapeIri === shapeIri)
  }

  /** Returns the source ID a shape draws data from (first mapped property). */
  sourceForShape(shapeIri: string): string | undefined {
    return this.forShape(shapeIri)[0]?.sourceId
  }

  /** True when at least one edge exists. */
  get hasMappings(): boolean {
    return this.edges.length > 0
  }

  clear(): void {
    this.edges = []
  }
}
