import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { getGeoNamesNode, runGeoNamesNode } from '@/features/mapping/extensions/modules/nodes/geonames/workflow'
import { useMappingStore } from '@/stores/mappingStore'
import { useDataStore } from '@/stores/dataStore'
import type { CsvDataSource } from '@/domain/DataSource'

vi.mock('@/services/infrastructure/integrations/geonamesService', () => ({
  fetchGeoNameFeature: vi.fn(async (id: string) => ({
    feature: {
      id,
      name: 'Test',
      toponymName: 'Test',
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
    },
    fromCache: false,
  })),
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

describe('mappingStore GeoNames flow state', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111')
  })

  it('adds a GeoNames node with a stable generated id', () => {
    const store = useMappingStore()

    const node = store.addGeoNamesNode('demo-user')

    expect(node).toEqual({
      id: 'geonames:11111111-1111-4111-8111-111111111111',
      username: 'demo-user',
      selectedOutputs: ['name', 'id', 'lat', 'lng'],
      status: 'idle',
      stats: { totalCount: 0, processedCount: 0, cachedCount: 0 },
      results: {},
    })
    expect(store.geoNamesNodes).toEqual([node])
  })

  it('replaces an existing UI edge for the same target handle', () => {
    const store = useMappingStore()

    store.upsertGeoNamesUiEdge({
      id: 'geo-ui:a',
      source: 'src:table-a',
      sourceHandle: 'h:id',
      target: 'geonames:node-a',
      targetHandle: 'geo-input',
    })

    store.upsertGeoNamesUiEdge({
      id: 'geo-ui:b',
      source: 'src:table-b',
      sourceHandle: 'h:otherId',
      target: 'geonames:node-a',
      targetHandle: 'geo-input',
    })

    expect(store.geoNamesUiEdges).toEqual([
      {
        id: 'geo-ui:b',
        source: 'src:table-b',
        sourceHandle: 'h:otherId',
        target: 'geonames:node-a',
        targetHandle: 'geo-input',
      },
    ])
  })

  it('runs a GeoNames node against the connected source column', async () => {
    const store = useMappingStore()
    const dataStore = useDataStore()
    const node = store.addGeoNamesNode('demo-user')
    store.upsertGeoNamesUiEdge({
      id: 'geo-ui:input',
      source: 'src:cities',
      sourceHandle: 'h:geoId',
      target: node.id,
      targetHandle: 'geo-input',
    })

    const sources = [{
      id: 'cities',
      name: 'Cities',
      kind: 'csv',
      headers: ['geoId'],
      rows: [['6173331'], ['5128581']],
    }] satisfies CsvDataSource[]

    await runGeoNamesNode(store, dataStore, node.id, sources)

    expect(getGeoNamesNode(store, node.id)?.status).toBe('success')
    expect(getGeoNamesNode(store, node.id)?.outputSourceId).toBe(`geonames-output:${node.id}`)
    expect(getGeoNamesNode(store, node.id)?.stats.processedCount).toBe(2)
    expect(getGeoNamesNode(store, node.id)?.results['6173331']?.name).toBe('Geo 6173331')
    expect(dataStore.findById(`geonames-output:${node.id}`)?.hidden).toBe(true)
    expect(dataStore.findById(`geonames-output:${node.id}`)?.headers).toEqual(['name', 'id', 'lat', 'lng'])
  })

  it('syncs direct GeoNames output mappings to shapes after the GeoNames node runs', async () => {
    const store = useMappingStore()
    const node = store.addGeoNamesNode('demo-user')

    store.upsertGeoNamesUiEdge({
      id: 'geo-ui:input',
      source: 'src:cities',
      sourceHandle: 'h:geoId',
      target: node.id,
      targetHandle: 'geo-input',
    })
    store.upsertGeoNamesUiEdge({
      id: 'geo-ui:shape-id',
      source: node.id,
      sourceHandle: 'h:id',
      target: 'shape:http://example.org/LocationShape',
      targetHandle: 'p:http://example.org/geonamesId',
    })
    store.upsertGeoNamesUiEdge({
      id: 'geo-ui:shape-name',
      source: node.id,
      sourceHandle: 'h:name',
      target: 'shape:http://example.org/LocationShape',
      targetHandle: 'p:http://www.w3.org/2000/01/rdf-schema#label',
    })

    const sources = [{
      id: 'cities',
      name: 'Cities',
      kind: 'csv',
      headers: ['geoId'],
      rows: [['6173331'], ['5128581']],
    }] satisfies CsvDataSource[]

    await runGeoNamesNode(store, useDataStore(), node.id, sources)

    expect(store.state.forProperty('http://example.org/LocationShape', 'http://example.org/geonamesId')).toMatchObject({
      sourceId: `geonames-output:${node.id}`,
      sourceHeader: 'id',
      geoNamesNodeId: node.id,
    })
    expect(store.state.forProperty('http://example.org/LocationShape', 'http://www.w3.org/2000/01/rdf-schema#label')).toMatchObject({
      sourceId: `geonames-output:${node.id}`,
      sourceHeader: 'name',
      geoNamesNodeId: node.id,
    })
  })

  it('syncs WKT transform mappings from connected lat/lng inputs', () => {
    const store = useMappingStore()
    const transformNode = store.addTransformationNode()

    store.upsertTransformationUiEdge({
      id: `transform-ui:${transformNode.id}:lat-input`,
      source: 'src:places',
      sourceHandle: 'h:lat',
      target: transformNode.id,
      targetHandle: 'lat-input',
    })
    store.upsertTransformationUiEdge({
      id: `transform-ui:${transformNode.id}:lng-input`,
      source: 'src:places',
      sourceHandle: 'h:lng',
      target: transformNode.id,
      targetHandle: 'lng-input',
    })

    store.set({
      sourceId: 'places',
      sourceHeader: 'lat',
      secondarySourceHeader: 'lng',
      shapeIri: 'http://example.org/PlaceShape',
      propertyPath: 'http://www.opengis.net/ont/geosparql#asWKT',
      transform: 'lat-lng-to-wkt',
      transformNodeId: transformNode.id,
    })
    store.upsertTransformationUiEdge({
      id: `transform-ui:${transformNode.id}:lat-input`,
      source: 'src:places',
      sourceHandle: 'h:lat',
      target: transformNode.id,
      targetHandle: 'lat-input',
    })

    expect(store.state.edges[0]).toMatchObject({
      sourceId: 'places',
      sourceHeader: 'lat',
      secondarySourceHeader: 'lng',
      transform: 'lat-lng-to-wkt',
      transformNodeId: transformNode.id,
    })
  })

  it('syncs WKT transform mappings from GeoNames lat/lng outputs after the GeoNames node runs', async () => {
    const store = useMappingStore()
    const node = store.addGeoNamesNode('demo-user')
    const transformNode = store.addTransformationNode()

    store.upsertGeoNamesUiEdge({
      id: 'geo-ui:input',
      source: 'src:cities',
      sourceHandle: 'h:geoId',
      target: node.id,
      targetHandle: 'geo-input',
    })
    store.upsertTransformationUiEdge({
      id: `transform-ui:${transformNode.id}:lat-input`,
      source: node.id,
      sourceHandle: 'h:lat',
      target: transformNode.id,
      targetHandle: 'lat-input',
    })
    store.upsertTransformationUiEdge({
      id: `transform-ui:${transformNode.id}:lng-input`,
      source: node.id,
      sourceHandle: 'h:lng',
      target: transformNode.id,
      targetHandle: 'lng-input',
    })
    store.set({
      sourceId: '',
      sourceHeader: 'lat',
      secondarySourceHeader: 'lng',
      shapeIri: 'http://example.org/PlaceShape',
      propertyPath: 'http://www.opengis.net/ont/geosparql#asWKT',
      transform: 'lat-lng-to-wkt',
      transformNodeId: transformNode.id,
    })

    const sources = [{
      id: 'cities',
      name: 'Cities',
      kind: 'csv',
      headers: ['geoId'],
      rows: [['6173331'], ['5128581']],
    }] satisfies CsvDataSource[]

    await runGeoNamesNode(store, useDataStore(), node.id, sources)

    expect(store.state.edges[0]).toMatchObject({
      sourceId: `geonames-output:${node.id}`,
      sourceHeader: 'lat',
      secondarySourceHeader: 'lng',
      transform: 'lat-lng-to-wkt',
      transformNodeId: transformNode.id,
    })
  })
})