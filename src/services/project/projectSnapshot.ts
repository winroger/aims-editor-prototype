import {
  AirtableDataSource,
  CsvDataSource,
  GeoNamesResultDataSource,
  LobidResultDataSource,
  type AirtableSyncInfo,
  type DataSource,
} from '@/domain/DataSource'
import { parseShaclProfile, type ShaclProfile } from '@/domain/NodeShape'
import type { MappingEdge } from '@/domain/Mapping'

export interface DataSourceSnapshot {
  id: string
  name: string
  kind: DataSource['kind']
  headers: string[]
  rows: unknown[][]
  recordIds?: string[]
  hidden?: boolean
  sync?: AirtableSyncInfo
}

export interface ShaclProfileSnapshot {
  iri: string
  source: string
  origin: ShaclProfile['origin']
  rawTurtle: string
}

export interface UiEdgeSnapshot {
  id: string
  source: string
  sourceHandle: string
  target: string
  targetHandle: string
}

export interface MappingStoreSnapshot {
  edges: MappingEdge[]
  extensionState: Record<string, unknown>
}

export interface ProjectSnapshot {
  version: 1
  project: {
    title: string
    createdAt: string
  }
  sources: DataSourceSnapshot[]
  shapeProfiles: ShaclProfileSnapshot[]
  metadataProfiles: ShaclProfileSnapshot[]
  metadataRootIris: string[]
  metadataTurtle: Record<string, string>
  mapping: MappingStoreSnapshot
}

function cloneRows(rows: unknown[][]): unknown[][] {
  return rows.map(row => [...row])
}

export function createDataSourceSnapshots(sources: DataSource[]): DataSourceSnapshot[] {
  return sources.map(source => ({
    id: source.id,
    name: source.name,
    kind: source.kind,
    headers: [...source.headers],
    rows: cloneRows(source.rows),
    recordIds: source.recordIds ? [...source.recordIds] : undefined,
    hidden: source.hidden,
    sync: source instanceof AirtableDataSource && source.sync ? { ...source.sync } : undefined,
  }))
}

export function restoreDataSourcesFromSnapshot(snapshots: DataSourceSnapshot[]): DataSource[] {
  return snapshots.map(snapshot => {
    if (snapshot.sync) {
      return new AirtableDataSource(
        snapshot.id,
        snapshot.name,
        [...snapshot.headers],
        cloneRows(snapshot.rows),
        [...(snapshot.recordIds ?? [])],
        { ...snapshot.sync },
      )
    }

    if (snapshot.hidden && snapshot.id.startsWith('geonames-output:')) {
      return new GeoNamesResultDataSource(
        snapshot.id,
        snapshot.name,
        [...snapshot.headers],
        cloneRows(snapshot.rows),
        snapshot.recordIds ? [...snapshot.recordIds] : undefined,
      )
    }

    if (snapshot.hidden && snapshot.id.startsWith('lobid-output:')) {
      return new LobidResultDataSource(
        snapshot.id,
        snapshot.name,
        [...snapshot.headers],
        cloneRows(snapshot.rows),
        snapshot.recordIds ? [...snapshot.recordIds] : undefined,
      )
    }

    return new CsvDataSource(
      snapshot.id,
      snapshot.name,
      [...snapshot.headers],
      cloneRows(snapshot.rows),
    )
  })
}

export function createShaclProfileSnapshots(profiles: ShaclProfile[]): ShaclProfileSnapshot[] {
  return profiles.map(profile => ({
    iri: profile.iri,
    source: profile.source,
    origin: profile.origin,
    rawTurtle: profile.rawTurtle,
  }))
}

export function restoreProfilesFromSnapshot(snapshots: ShaclProfileSnapshot[]): ShaclProfile[] {
  return snapshots.map(snapshot =>
    parseShaclProfile(snapshot.rawTurtle, snapshot.source, snapshot.origin, snapshot.iri),
  )
}

export function cloneMappingEdges(edges: MappingEdge[]): MappingEdge[] {
  return edges.map(edge => ({ ...edge }))
}

export function cloneUiEdges(edges: UiEdgeSnapshot[]): UiEdgeSnapshot[] {
  return edges.map(edge => ({ ...edge }))
}