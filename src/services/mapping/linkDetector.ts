/**
 * Link-detection utilities
 *
 * Heuristics to recognise:
 *  1. Linked-record columns in a source table (Airtable recID pattern,
 *     comma-joined recIDs, or arrays of recIDs).
 *  2. Likely target table for each linked-record column (cross-source
 *     recID lookup or column-name matching).
 *  3. "Join tables" (m:n with attribute) — sources where ≥2 columns are
 *     foreign keys into other sources, with at least one extra attribute.
 */
import type { DataSource } from '@/domain/DataSource'

/** Matches a single Airtable record ID, e.g. `recqqg9hRlNLclOoE`. */
const RECORD_ID_REGEX = /^rec[A-Za-z0-9]{14,}$/

/** Splits a cell value into individual record-id candidates. */
export function splitLinkedRecordCell(raw: unknown): string[] {
  if (raw === null || raw === undefined) return []
  if (Array.isArray(raw)) return raw.map(String).map(s => s.trim()).filter(Boolean)
  const s = String(raw).trim()
  if (!s) return []
  return s.split(',').map(p => p.trim()).filter(Boolean)
}

/** True if a cell value looks like one or more Airtable record IDs. */
export function looksLikeRecordIds(raw: unknown): boolean {
  const parts = splitLinkedRecordCell(raw)
  if (parts.length === 0) return false
  return parts.every(p => RECORD_ID_REGEX.test(p))
}

/** Estimates how confidently a column contains linked record IDs (0..1). */
function recordIdScore(values: unknown[]): number {
  let total = 0
  let hits = 0
  for (const v of values) {
    if (v === null || v === undefined || String(v).trim() === '') continue
    total++
    if (looksLikeRecordIds(v)) hits++
  }
  return total === 0 ? 0 : hits / total
}

export interface LinkedColumnInfo {
  /** Column header in the owning source. */
  header: string
  /** Confidence that this column contains record IDs (0..1). */
  recordIdConfidence: number
  /** Other source IDs whose recordIds set overlaps with this column's values. */
  targetSourceIds: string[]
  /** Best-matching target source (highest overlap). */
  bestTargetSourceId?: string
}

/**
 * Detects linked-record columns within the given source by
 *  a) checking how many cells match the recID pattern
 *  b) cross-referencing the values against other sources' recordIds.
 */
export function detectLinkedColumns(
  source: DataSource,
  allSources: DataSource[],
): LinkedColumnInfo[] {
  const result: LinkedColumnInfo[] = []
  const otherSources = allSources.filter(s => s.id !== source.id)

  // Build recordId sets per other source for fast overlap checks
  const recIdSets = new Map<string, Set<string>>()
  for (const s of otherSources) {
    if (s.recordIds && s.recordIds.length > 0) {
      recIdSets.set(s.id, new Set(s.recordIds))
    }
  }

  for (let colIdx = 0; colIdx < source.headers.length; colIdx++) {
    const header = source.headers[colIdx]
    const values = source.rows.map(r => r[colIdx])
    const conf = recordIdScore(values)
    if (conf < 0.5) continue

    // Cross-check overlaps against other sources' record IDs
    const overlapByTarget = new Map<string, number>()
    for (const v of values) {
      for (const id of splitLinkedRecordCell(v)) {
        for (const [srcId, idSet] of recIdSets) {
          if (idSet.has(id)) {
            overlapByTarget.set(srcId, (overlapByTarget.get(srcId) ?? 0) + 1)
          }
        }
      }
    }

    const targetSourceIds = Array.from(overlapByTarget.keys())
    let bestTargetSourceId: string | undefined
    let bestOverlap = 0
    for (const [srcId, count] of overlapByTarget) {
      if (count > bestOverlap) {
        bestOverlap = count
        bestTargetSourceId = srcId
      }
    }

    // If header literally matches another source name (no overlap data available)
    if (!bestTargetSourceId) {
      const nameMatch = otherSources.find(s =>
        s.name.toLowerCase() === header.toLowerCase()
        || s.id.toLowerCase() === header.toLowerCase(),
      )
      if (nameMatch) bestTargetSourceId = nameMatch.id
    }

    result.push({
      header,
      recordIdConfidence: conf,
      targetSourceIds,
      bestTargetSourceId,
    })
  }

  return result
}

/**
 * A source qualifies as a "join table" when it contains ≥ 2 linked-record
 * columns pointing to different sources, with at least one extra (non-FK)
 * attribute column. This is the classic m:n with attribute pattern that
 * needs to be modeled as a separate RDF entity (e.g. prov:Attribution).
 */
export interface JoinTableInfo {
  sourceId: string
  sourceName: string
  /** Linked-record columns and their inferred targets. */
  fkColumns: LinkedColumnInfo[]
  /** Non-FK column headers that carry attribute data (e.g. "Role"). */
  attributeColumns: string[]
}

export function detectJoinTables(sources: DataSource[]): JoinTableInfo[] {
  const result: JoinTableInfo[] = []
  for (const source of sources) {
    const fks = detectLinkedColumns(source, sources)
      .filter(fk => fk.bestTargetSourceId !== undefined)

    // Distinct targets — true join tables point to ≥ 2 different sources
    const distinctTargets = new Set(fks.map(f => f.bestTargetSourceId))
    if (distinctTargets.size < 2) continue

    const fkHeaders = new Set(fks.map(f => f.header))
    const attributeColumns = source.headers.filter(h => !fkHeaders.has(h))
    if (attributeColumns.length === 0) continue

    result.push({
      sourceId: source.id,
      sourceName: source.name,
      fkColumns: fks,
      attributeColumns,
    })
  }
  return result
}


