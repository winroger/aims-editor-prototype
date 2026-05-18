import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getMock = vi.fn()

vi.mock('geonames.js', () => ({
  default: vi.fn(() => ({
    get: getMock,
  })),
}))

vi.mock('localforage', () => {
  const stores = new Map<string, Map<string, unknown>>()
  return {
    default: {
      createInstance: ({ storeName }: { storeName: string }) => {
        const store = stores.get(storeName) ?? new Map<string, unknown>()
        stores.set(storeName, store)
        return {
          async getItem<T>(key: string): Promise<T | null> { return (store.get(key) as T | undefined) ?? null },
          async setItem<T>(key: string, value: T): Promise<T> { store.set(key, value); return value },
          async clear(): Promise<void> { store.clear() },
        }
      },
    },
  }
})

import { clearGeoNamesCache, fetchGeoNameFeature, fetchGeoNameFeatures, normalizeGeoNameFeature } from '@/services/infrastructure/integrations/geonamesService'

const SAMPLE_JSON = {
  geonameId: 6173331,
  name: 'Vancouver',
  lat: 49.24966,
  lng: -123.11934,
}

describe('geonamesService', () => {
  beforeEach(async () => {
    await clearGeoNamesCache()
    getMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('normalizes the GeoNames JSON payload', () => {
    expect(normalizeGeoNameFeature(SAMPLE_JSON)).toEqual({
      id: '6173331',
      name: 'Vancouver',
      toponymName: '',
      lat: '49.24966',
      lng: '-123.11934',
      countryCode: '',
      countryName: '',
      continentCode: '',
      adminName1: '',
      adminName2: '',
      adminName3: '',
      adminCode1: '',
      adminCode2: '',
      adminCode3: '',
      featureClass: '',
      featureCode: '',
      fcodeName: '',
      population: '',
      elevation: '',
      dem: '',
      timezoneId: '',
      wikipediaURL: '',
    })
  })

  it('reuses cached values for repeated requests', async () => {
    getMock.mockResolvedValue(SAMPLE_JSON)

    const first = await fetchGeoNameFeature('6173331', 'demo')
    const second = await fetchGeoNameFeature('6173331', 'demo')

    expect(first.fromCache).toBe(false)
    expect(second.fromCache).toBe(true)
    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('reports cached items in batch mode', async () => {
    getMock.mockResolvedValue(SAMPLE_JSON)

    await fetchGeoNameFeature('6173331', 'demo')
    const batch = await fetchGeoNameFeatures(['6173331', '6173331'], 'demo')

    expect(batch.totalCount).toBe(1)
    expect(batch.cachedCount).toBe(1)
    expect(batch.processedCount).toBe(1)
    expect(batch.results['6173331']?.name).toBe('Vancouver')
    expect(getMock).toHaveBeenCalledTimes(1)
  })
})