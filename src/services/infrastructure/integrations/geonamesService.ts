import localforage from 'localforage'
import Geonames from 'geonames.js'

const cache = localforage.createInstance({
  name: 'architectural-rdm-pipeline-v1',
  storeName: 'geonames-cache',
})

const inflightRequests = new Map<string, Promise<GeoNameFeature>>()

export const GEO_NAMES_OUTPUT_OPTIONS = [
  { id: 'id', name: 'ID', description: 'GeoNames identifier returned by the service' },
  { id: 'name', name: 'Name', description: 'Resolved place name' },
  { id: 'toponymName', name: 'Toponym name', description: 'Primary toponym label from GeoNames' },
  { id: 'lat', name: 'Latitude', description: 'Latitude coordinate' },
  { id: 'lng', name: 'Longitude', description: 'Longitude coordinate' },
  { id: 'countryCode', name: 'Country code', description: 'ISO country code' },
  { id: 'countryName', name: 'Country name', description: 'Country label' },
  { id: 'continentCode', name: 'Continent code', description: 'Continent code' },
  { id: 'adminName1', name: 'Admin level 1', description: 'First administrative subdivision name' },
  { id: 'adminName2', name: 'Admin level 2', description: 'Second administrative subdivision name' },
  { id: 'adminName3', name: 'Admin level 3', description: 'Third administrative subdivision name' },
  { id: 'adminCode1', name: 'Admin code 1', description: 'First administrative subdivision code' },
  { id: 'adminCode2', name: 'Admin code 2', description: 'Second administrative subdivision code' },
  { id: 'adminCode3', name: 'Admin code 3', description: 'Third administrative subdivision code' },
  { id: 'featureClass', name: 'Feature class', description: 'GeoNames feature class' },
  { id: 'featureCode', name: 'Feature code', description: 'GeoNames feature code' },
  { id: 'fcodeName', name: 'Feature label', description: 'Human-readable feature type label' },
  { id: 'population', name: 'Population', description: 'Population value' },
  { id: 'elevation', name: 'Elevation', description: 'Elevation in meters if available' },
  { id: 'dem', name: 'DEM', description: 'Digital elevation model value if available' },
  { id: 'timezoneId', name: 'Timezone', description: 'Timezone identifier if available' },
  { id: 'wikipediaURL', name: 'Wikipedia URL', description: 'Wikipedia URL if available' },
] as const

export type GeoNamesOutputField = (typeof GEO_NAMES_OUTPUT_OPTIONS)[number]['id']

export interface GeoNameFeature {
  id: string
  name: string
  toponymName: string
  lat: string
  lng: string
  countryCode: string
  countryName: string
  continentCode: string
  adminName1: string
  adminName2: string
  adminName3: string
  adminCode1: string
  adminCode2: string
  adminCode3: string
  featureClass: string
  featureCode: string
  fcodeName: string
  population: string
  elevation: string
  dem: string
  timezoneId: string
  wikipediaURL: string
}

interface CachedGeoNameFeature {
  feature: GeoNameFeature
  fetchedAt: string
}

interface GeoNamesJsonResponse {
  [key: string]: unknown
  geonameId?: string | number
  name?: string
  toponymName?: string
  lat?: string | number
  lng?: string | number
  countryCode?: string
  countryName?: string
  continentCode?: string
  adminName1?: string
  adminName2?: string
  adminName3?: string
  adminCode1?: string | number
  adminCode2?: string | number
  adminCode3?: string | number
  fcl?: string
  featureClass?: string
  featureCode?: string
  fcode?: string
  fcodeName?: string
  population?: string | number
  elevation?: string | number
  dem?: string | number
  wikipediaURL?: string
  timezone?: {
    timeZoneId?: string
  }
  timezoneId?: string
  status?: {
    message?: string
    value?: string | number
  }
}

export interface GeoNamesBatchResult {
  results: Record<string, GeoNameFeature>
  totalCount: number
  processedCount: number
  cachedCount: number
}

export function normalizeGeoNameFeature(response: GeoNamesJsonResponse): GeoNameFeature {
  const statusMessage = response.status?.message?.trim()
  if (statusMessage) throw new Error(statusMessage)

  const id = String(response.geonameId ?? '').trim()
  if (!id) throw new Error('GeoNames response did not include a geonameId.')

  return {
    id,
    name: String(response.name ?? '').trim(),
    toponymName: String(response.toponymName ?? '').trim(),
    lat: String(response.lat ?? '').trim(),
    lng: String(response.lng ?? '').trim(),
    countryCode: String(response.countryCode ?? '').trim(),
    countryName: String(response.countryName ?? '').trim(),
    continentCode: String(response.continentCode ?? '').trim(),
    adminName1: String(response.adminName1 ?? '').trim(),
    adminName2: String(response.adminName2 ?? '').trim(),
    adminName3: String(response.adminName3 ?? '').trim(),
    adminCode1: String(response.adminCode1 ?? '').trim(),
    adminCode2: String(response.adminCode2 ?? '').trim(),
    adminCode3: String(response.adminCode3 ?? '').trim(),
    featureClass: String(response.featureClass ?? response.fcl ?? '').trim(),
    featureCode: String(response.featureCode ?? response.fcode ?? '').trim(),
    fcodeName: String(response.fcodeName ?? '').trim(),
    population: String(response.population ?? '').trim(),
    elevation: String(response.elevation ?? '').trim(),
    dem: String(response.dem ?? '').trim(),
    timezoneId: String(response.timezone?.timeZoneId ?? response.timezoneId ?? '').trim(),
    wikipediaURL: String(response.wikipediaURL ?? '').trim(),
  }
}

function cacheKey(username: string, geonameId: string, lang: string): string {
  return `${username}:${lang}:${geonameId}`
}

async function fetchGeoNameFeatureInternal(geonameId: string, username: string, lang: string): Promise<GeoNameFeature> {
  const geonames = Geonames({
    username,
    lan: lang,
    encoding: 'JSON',
    style: 'FULL',
  })

  const response = await geonames.get({ geonameId }) as GeoNamesJsonResponse
  return normalizeGeoNameFeature(response)
}

export async function fetchGeoNameFeature(
  geonameId: string,
  username: string,
  options?: { lang?: string; forceRefresh?: boolean },
): Promise<{ feature: GeoNameFeature; fromCache: boolean }> {
  const lang = options?.lang ?? 'en'
  const key = cacheKey(username, geonameId, lang)

  if (!options?.forceRefresh) {
    const cached = await cache.getItem<CachedGeoNameFeature>(key)
    if (cached?.feature) return { feature: cached.feature, fromCache: true }
  }

  const current = inflightRequests.get(key)
  if (current) return { feature: await current, fromCache: false }

  const request = fetchGeoNameFeatureInternal(geonameId, username, lang)
  inflightRequests.set(key, request)
  try {
    const feature = await request
    await cache.setItem<CachedGeoNameFeature>(key, { feature, fetchedAt: new Date().toISOString() })
    return { feature, fromCache: false }
  } finally {
    inflightRequests.delete(key)
  }
}

export async function fetchGeoNameFeatures(
  geonameIds: string[],
  username: string,
  options?: {
    lang?: string
    forceRefresh?: boolean
    onProgress?: (progress: { processedCount: number; totalCount: number; cachedCount: number; currentId: string }) => void
  },
): Promise<GeoNamesBatchResult> {
  const ids = Array.from(new Set(geonameIds.map(id => id.trim()).filter(Boolean)))
  const results: Record<string, GeoNameFeature> = {}
  let processedCount = 0
  let cachedCount = 0

  for (const geonameId of ids) {
    const { feature, fromCache } = await fetchGeoNameFeature(geonameId, username, {
      lang: options?.lang,
      forceRefresh: options?.forceRefresh,
    })
    results[geonameId] = feature
    processedCount += 1
    if (fromCache) cachedCount += 1
    options?.onProgress?.({ processedCount, totalCount: ids.length, cachedCount, currentId: geonameId })
  }

  return {
    results,
    totalCount: ids.length,
    processedCount,
    cachedCount,
  }
}

export async function clearGeoNamesCache(): Promise<void> {
  await cache.clear()
}
