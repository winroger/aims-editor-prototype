import localforage from 'localforage'

const cache = localforage.createInstance({
  name: 'architectural-rdm-pipeline-v1',
  storeName: 'lobid-cache',
})

const RECONCILE_API = 'https://reconcile.gnd.network'

export interface LobidPropertyProposal {
  id: string
  name: string
}

export interface LobidExtendedRecord {
  [propertyId: string]: string
}

export interface LobidBatchResult {
  results: Record<string, LobidExtendedRecord>
  totalCount: number
  processedCount: number
  cachedCount: number
}

interface LobidExtendValue {
  str?: string
  id?: string
  name?: string
}

interface LobidPropertiesResponse {
  properties?: Array<{ id?: string; name?: string }>
}

interface LobidExtendResponse {
  rows?: Record<string, Record<string, LobidExtendValue[]>>
}

interface CachedLobidBatch {
  result: LobidBatchResult
  fetchedAt: string
}

function batchCacheKey(ids: string[], properties: string[]): string {
  const normalizedIds = [...new Set(ids.map(id => id.trim()).filter(Boolean))].sort()
  const normalizedProperties = [...new Set(properties.map(id => id.trim()).filter(Boolean))].sort()
  return JSON.stringify({ ids: normalizedIds, properties: normalizedProperties })
}

function normalizePropertyValue(value: LobidExtendValue | null | undefined): string {
  if (!value) return ''
  if (typeof value.str === 'string' && value.str.trim()) return value.str.trim()
  if (typeof value.name === 'string' && value.name.trim()) return value.name.trim()
  if (typeof value.id === 'string' && value.id.trim()) return value.id.trim()
  return ''
}

export function normalizeLobidExtendRows(
  rows: LobidExtendResponse['rows'],
  ids: string[],
  properties: string[],
): Record<string, LobidExtendedRecord> {
  const result: Record<string, LobidExtendedRecord> = {}
  const uniqueIds = [...new Set(ids.map(id => id.trim()).filter(Boolean))]
  const uniqueProperties = [...new Set(properties.map(property => property.trim()).filter(Boolean))]

  for (const id of uniqueIds) {
    const source = rows?.[id] ?? {}
    result[id] = Object.fromEntries(uniqueProperties.map(propertyId => {
      const values = Array.isArray(source[propertyId]) ? source[propertyId] : []
      const cell = values
        .map(value => normalizePropertyValue(value))
        .filter(Boolean)
        .join(' | ')
      return [propertyId, cell]
    }))
  }

  return result
}

export async function fetchLobidPropertyProposals(type = 'Work'): Promise<LobidPropertyProposal[]> {
  const url = new URL(`${RECONCILE_API}/properties`)
  url.searchParams.set('type', type)

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Lobid properties request failed: ${response.status}`)
  }

  const data = await response.json() as LobidPropertiesResponse
  return (data.properties ?? [])
    .filter((property): property is Required<LobidPropertyProposal> =>
      typeof property.id === 'string'
      && property.id.trim().length > 0
      && typeof property.name === 'string'
      && property.name.trim().length > 0,
    )
    .map(property => ({ id: property.id.trim(), name: property.name.trim() }))
}

export async function fetchLobidBatch(
  ids: string[],
  properties: string[],
  options?: { forceRefresh?: boolean },
): Promise<LobidBatchResult> {
  const normalizedIds = [...new Set(ids.map(id => id.trim()).filter(Boolean))]
  const normalizedProperties = [...new Set(properties.map(property => property.trim()).filter(Boolean))]

  if (normalizedIds.length === 0) throw new Error('No Lobid IDs provided.')
  if (normalizedProperties.length === 0) throw new Error('No Lobid properties selected.')

  const cacheKey = batchCacheKey(normalizedIds, normalizedProperties)
  if (!options?.forceRefresh) {
    const cached = await cache.getItem<CachedLobidBatch>(cacheKey)
    if (cached?.result) {
      return {
        ...cached.result,
        cachedCount: cached.result.totalCount,
      }
    }
  }

  const url = new URL(RECONCILE_API)
  url.searchParams.set('extend', JSON.stringify({
    ids: normalizedIds,
    properties: normalizedProperties.map(id => ({ id })),
  }))

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Lobid extend request failed: ${response.status}`)
  }

  const data = await response.json() as LobidExtendResponse
  const result: LobidBatchResult = {
    results: normalizeLobidExtendRows(data.rows, normalizedIds, normalizedProperties),
    totalCount: normalizedIds.length,
    processedCount: normalizedIds.length,
    cachedCount: 0,
  }

  await cache.setItem<CachedLobidBatch>(cacheKey, {
    result,
    fetchedAt: new Date().toISOString(),
  })

  return result
}

export async function clearLobidCache(): Promise<void> {
  await cache.clear()
}
