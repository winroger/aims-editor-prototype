import type { MappingTransformId } from '@/domain/Mapping'
import type { GeoNameFeature, GeoNamesOutputField } from '@/services/infrastructure/integrations/geonamesService'
import type { LobidExtendedRecord } from '@/services/infrastructure/integrations/lobidService'

export interface GeoNamesNodeRunStats {
  totalCount: number
  processedCount: number
  cachedCount: number
  lastRunAt?: string
  lastError?: string
}

export interface GeoNamesNodeConfig {
  id: string
  username: string
  selectedOutputs: GeoNamesOutputField[]
  inputSourceId?: string
  inputHeader?: string
  outputSourceId?: string
  status: 'idle' | 'running' | 'success' | 'error'
  stats: GeoNamesNodeRunStats
  results: Record<string, GeoNameFeature>
}

export interface GeoNamesUiEdge {
  id: string
  source: string
  sourceHandle: string
  target: string
  targetHandle: string
}

export interface LobidNodeRunStats {
  totalCount: number
  processedCount: number
  cachedCount: number
  lastRunAt?: string
  lastError?: string
}

export interface LobidNodeConfig {
  id: string
  selectedProperties: string[]
  inputSourceId?: string
  inputHeader?: string
  outputSourceId?: string
  status: 'idle' | 'running' | 'success' | 'error'
  stats: LobidNodeRunStats
  results: Record<string, LobidExtendedRecord>
}

export interface LobidUiEdge {
  id: string
  source: string
  sourceHandle: string
  target: string
  targetHandle: string
}

export interface TransformationNodeConfig {
  id: string
  kind: MappingTransformId
}

export interface TransformationUiEdge {
  id: string
  source: string
  sourceHandle: string
  target: string
  targetHandle: string
}