import { describe, expect, it, vi } from 'vitest'
import type { CsvDataSource } from '@/domain/DataSource'
import { runGeoNamesRuntime, runLobidRuntime } from '@/services/mapping/enrichmentNodeRuntime'

vi.mock('@/services/infrastructure/integrations/geonamesService', () => ({
  fetchGeoNameFeatures: vi.fn(async (ids: string[]) => ({
    results: Object.fromEntries(ids.map(id => [id, {
      id,
      name: `Geo ${id}`,
      toponymName: `Geo ${id}`,
      lat: '1',
      lng: '2',
      countryCode: 'CA',
      countryName: 'Canada',
      continentCode: 'NA',
      adminName1: '',
      adminName2: '',
      adminName3: '',
      adminCode1: '',
      adminCode2: '',
      adminCode3: '',
      featureClass: 'P',
      featureCode: 'PPL',
      fcodeName: 'populated place',
      population: '1000',
      elevation: '',
      dem: '',
      timezoneId: '',
      wikipediaURL: '',
    }])) ,
    totalCount: ids.length,
    processedCount: ids.length,
    cachedCount: 0,
  })),
}))

vi.mock('@/services/infrastructure/integrations/lobidService', () => ({
  fetchLobidBatch: vi.fn(async (ids: string[], properties: string[]) => ({
    results: Object.fromEntries(ids.map(id => [id, Object.fromEntries(properties.map(property => [property, `${property}:${id}`]))])),
    totalCount: ids.length,
    processedCount: ids.length,
    cachedCount: 0,
  })),
}))

describe('enrichmentNodeRuntime', () => {
  const sources = [{
    id: 'cities',
    name: 'Cities',
    kind: 'csv',
    headers: ['geoId'],
    rows: [['6173331'], ['5128581']],
  }] satisfies CsvDataSource[]

  it('runs GeoNames enrichment and materializes output rows', async () => {
    const addResultSource = vi.fn(() => 'geonames-output:node-1')

    const result = await runGeoNamesRuntime({
      nodeId: 'geonames:node-1',
      username: 'demo-user',
      selectedOutputs: ['name', 'id'],
      inputSourceId: 'cities',
      inputHeader: 'geoId',
      sources,
      addResultSource,
    })

    expect(result).toMatchObject({
      inputSourceId: 'cities',
      inputHeader: 'geoId',
      outputSourceId: 'geonames-output:node-1',
      processedCount: 2,
    })
    expect(addResultSource).toHaveBeenCalledWith(
      'geonames:node-1',
      ['name', 'id'],
      [['Geo 6173331', '6173331'], ['Geo 5128581', '5128581']],
      ['6173331', '5128581'],
    )
  })

  it('runs Lobid enrichment and materializes output rows', async () => {
    const addResultSource = vi.fn(() => 'lobid-output:node-1')

    const result = await runLobidRuntime({
      nodeId: 'lobid:node-1',
      selectedProperties: ['preferredName'],
      inputSourceId: 'cities',
      inputHeader: 'geoId',
      sources,
      addResultSource,
    })

    expect(result).toMatchObject({
      inputSourceId: 'cities',
      inputHeader: 'geoId',
      outputSourceId: 'lobid-output:node-1',
      processedCount: 2,
    })
    expect(addResultSource).toHaveBeenCalledWith(
      'lobid:node-1',
      ['preferredName'],
      [['preferredName:6173331'], ['preferredName:5128581']],
      ['6173331', '5128581'],
    )
  })
})