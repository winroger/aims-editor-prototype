import { describe, expect, it } from 'vitest'
import {
  applyGeoNamesNodePatch,
  applyLobidNodePatch,
  buildGeoNamesShapeMappings,
  buildLobidShapeMappings,
  getDependentTransformationNodeIds,
  getTransformationNodeInputs,
  removeUiEdgeById,
  resolveTransformationMappingInput,
  syncGeoNamesNodeMappings,
  syncLobidNodeMappings,
  syncTransformationNodeMappings,
  upsertUiEdge,
} from '@/services/mapping/mappingEdgeSync'

describe('mappingEdgeSync', () => {
  it('applies a GeoNames node patch and drops disconnected output edges', () => {
    expect(applyGeoNamesNodePatch({
      id: 'geonames:1',
      username: 'demo',
      selectedOutputs: ['name', 'id', 'lat', 'lng'],
      status: 'idle',
      stats: { totalCount: 0, processedCount: 0, cachedCount: 0 },
      results: {},
    }, {
      selectedOutputs: ['name', 'lat'],
    }, [
      {
        id: 'geo-ui:name',
        source: 'geonames:1',
        sourceHandle: 'h:name',
        target: 'shape:http://example.org/LocationShape',
        targetHandle: 'p:http://www.w3.org/2000/01/rdf-schema#label',
      },
      {
        id: 'geo-ui:id',
        source: 'geonames:1',
        sourceHandle: 'h:id',
        target: 'shape:http://example.org/LocationShape',
        targetHandle: 'p:http://example.org/geonamesId',
      },
    ])).toEqual({
      nextNode: {
        id: 'geonames:1',
        username: 'demo',
        selectedOutputs: ['name', 'lat'],
        status: 'idle',
        stats: { totalCount: 0, processedCount: 0, cachedCount: 0 },
        results: {},
      },
      nextEdges: [
        {
          id: 'geo-ui:name',
          source: 'geonames:1',
          sourceHandle: 'h:name',
          target: 'shape:http://example.org/LocationShape',
          targetHandle: 'p:http://www.w3.org/2000/01/rdf-schema#label',
        },
      ],
    })
  })

  it('applies a Lobid node patch and drops disconnected property edges', () => {
    expect(applyLobidNodePatch({
      id: 'lobid:1',
      selectedProperties: ['preferredName', 'firstAuthor'],
      status: 'idle',
      stats: { totalCount: 0, processedCount: 0, cachedCount: 0 },
      results: {},
    }, {
      selectedProperties: ['preferredName'],
    }, [
      {
        id: 'lobid-ui:name',
        source: 'lobid:1',
        sourceHandle: 'h:preferredName',
        target: 'shape:http://example.org/PersonShape',
        targetHandle: 'p:http://xmlns.com/foaf/0.1/name',
      },
      {
        id: 'lobid-ui:author',
        source: 'lobid:1',
        sourceHandle: 'h:firstAuthor',
        target: 'shape:http://example.org/PersonShape',
        targetHandle: 'p:http://purl.org/dc/terms/creator',
      },
    ])).toEqual({
      nextNode: {
        id: 'lobid:1',
        selectedProperties: ['preferredName'],
        status: 'idle',
        stats: { totalCount: 0, processedCount: 0, cachedCount: 0 },
        results: {},
      },
      nextEdges: [
        {
          id: 'lobid-ui:name',
          source: 'lobid:1',
          sourceHandle: 'h:preferredName',
          target: 'shape:http://example.org/PersonShape',
          targetHandle: 'p:http://xmlns.com/foaf/0.1/name',
        },
      ],
    })
  })

  it('replaces an existing UI edge with the same target handle', () => {
    expect(upsertUiEdge([
      {
        id: 'geo-ui:a',
        source: 'src:one',
        sourceHandle: 'h:id',
        target: 'geonames:1',
        targetHandle: 'geo-input',
      },
    ], {
      id: 'geo-ui:b',
      source: 'src:two',
      sourceHandle: 'h:otherId',
      target: 'geonames:1',
      targetHandle: 'geo-input',
    })).toEqual([
      {
        id: 'geo-ui:b',
        source: 'src:two',
        sourceHandle: 'h:otherId',
        target: 'geonames:1',
        targetHandle: 'geo-input',
      },
    ])
  })

  it('removes a UI edge by id and returns the removed edge', () => {
    expect(removeUiEdgeById([
      {
        id: 'edge:1',
        source: 'src:one',
        sourceHandle: 'h:id',
        target: 'transform:1',
        targetHandle: 'lat-input',
      },
      {
        id: 'edge:2',
        source: 'src:one',
        sourceHandle: 'h:lng',
        target: 'transform:1',
        targetHandle: 'lng-input',
      },
    ], 'edge:1')).toEqual({
      nextEdges: [
        {
          id: 'edge:2',
          source: 'src:one',
          sourceHandle: 'h:lng',
          target: 'transform:1',
          targetHandle: 'lng-input',
        },
      ],
      removed: {
        id: 'edge:1',
        source: 'src:one',
        sourceHandle: 'h:id',
        target: 'transform:1',
        targetHandle: 'lat-input',
      },
    })
  })

  it('builds GeoNames-backed shape mappings from ui edges', () => {
    expect(buildGeoNamesShapeMappings('geonames:1', 'geonames-output:1', [
      {
        id: 'geo-ui:shape-name',
        source: 'geonames:1',
        sourceHandle: 'h:name',
        target: 'shape:http://example.org/LocationShape',
        targetHandle: 'p:http://www.w3.org/2000/01/rdf-schema#label',
      },
    ])).toEqual([
      {
        sourceId: 'geonames-output:1',
        sourceHeader: 'name',
        shapeIri: 'http://example.org/LocationShape',
        propertyPath: 'http://www.w3.org/2000/01/rdf-schema#label',
        geoNamesNodeId: 'geonames:1',
      },
    ])
  })

  it('rewrites GeoNames-backed mapping edges for one node', () => {
    expect(syncGeoNamesNodeMappings([
      {
        sourceId: 'old-geonames-output',
        sourceHeader: 'id',
        shapeIri: 'http://example.org/LocationShape',
        propertyPath: 'http://example.org/geonamesId',
        geoNamesNodeId: 'geonames:1',
      },
      {
        sourceId: 'keep-me',
        sourceHeader: 'name',
        shapeIri: 'http://example.org/OtherShape',
        propertyPath: 'http://www.w3.org/2000/01/rdf-schema#label',
      },
    ], 'geonames:1', 'geonames-output:1', [
      {
        id: 'geo-ui:shape-name',
        source: 'geonames:1',
        sourceHandle: 'h:name',
        target: 'shape:http://example.org/LocationShape',
        targetHandle: 'p:http://www.w3.org/2000/01/rdf-schema#label',
      },
    ])).toEqual([
      {
        sourceId: 'keep-me',
        sourceHeader: 'name',
        shapeIri: 'http://example.org/OtherShape',
        propertyPath: 'http://www.w3.org/2000/01/rdf-schema#label',
      },
      {
        sourceId: 'geonames-output:1',
        sourceHeader: 'name',
        shapeIri: 'http://example.org/LocationShape',
        propertyPath: 'http://www.w3.org/2000/01/rdf-schema#label',
        geoNamesNodeId: 'geonames:1',
      },
    ])
  })

  it('builds Lobid-backed shape mappings from ui edges', () => {
    expect(buildLobidShapeMappings('lobid:1', 'lobid-output:1', [
      {
        id: 'lobid-ui:shape-name',
        source: 'lobid:1',
        sourceHandle: 'h:preferredName',
        target: 'shape:http://example.org/PersonShape',
        targetHandle: 'p:http://xmlns.com/foaf/0.1/name',
      },
    ])).toEqual([
      {
        sourceId: 'lobid-output:1',
        sourceHeader: 'preferredName',
        shapeIri: 'http://example.org/PersonShape',
        propertyPath: 'http://xmlns.com/foaf/0.1/name',
        lobidNodeId: 'lobid:1',
      },
    ])
  })

  it('rewrites Lobid-backed mapping edges for one node', () => {
    expect(syncLobidNodeMappings([
      {
        sourceId: 'old-lobid-output',
        sourceHeader: 'preferredName',
        shapeIri: 'http://example.org/PersonShape',
        propertyPath: 'http://xmlns.com/foaf/0.1/name',
        lobidNodeId: 'lobid:1',
      },
      {
        sourceId: 'keep-me',
        sourceHeader: 'title',
        shapeIri: 'http://example.org/WorkShape',
        propertyPath: 'http://purl.org/dc/terms/title',
      },
    ], 'lobid:1', 'lobid-output:1', [
      {
        id: 'lobid-ui:shape-name',
        source: 'lobid:1',
        sourceHandle: 'h:firstAuthor',
        target: 'shape:http://example.org/PersonShape',
        targetHandle: 'p:http://purl.org/dc/terms/creator',
      },
    ])).toEqual([
      {
        sourceId: 'keep-me',
        sourceHeader: 'title',
        shapeIri: 'http://example.org/WorkShape',
        propertyPath: 'http://purl.org/dc/terms/title',
      },
      {
        sourceId: 'lobid-output:1',
        sourceHeader: 'firstAuthor',
        shapeIri: 'http://example.org/PersonShape',
        propertyPath: 'http://purl.org/dc/terms/creator',
        lobidNodeId: 'lobid:1',
      },
    ])
  })

  it('rewrites only transformation edges for the requested node', () => {
    expect(syncTransformationNodeMappings([
      {
        sourceId: 'old-source',
        sourceHeader: 'oldLat',
        secondarySourceHeader: 'oldLng',
        shapeIri: 'http://example.org/PlaceShape',
        propertyPath: 'http://www.opengis.net/ont/geosparql#asWKT',
        transform: 'lat-lng-to-wkt',
        transformNodeId: 'transform:1',
      },
      {
        sourceId: 'keep-me',
        sourceHeader: 'name',
        shapeIri: 'http://example.org/PlaceShape',
        propertyPath: 'http://www.w3.org/2000/01/rdf-schema#label',
      },
    ], 'transform:1', {
      sourceId: 'places',
      latHeader: 'lat',
      lngHeader: 'lng',
    }, 'lat-lng-to-wkt')).toEqual([
      {
        sourceId: 'places',
        sourceHeader: 'lat',
        secondarySourceHeader: 'lng',
        shapeIri: 'http://example.org/PlaceShape',
        propertyPath: 'http://www.opengis.net/ont/geosparql#asWKT',
        transform: 'lat-lng-to-wkt',
        transformNodeId: 'transform:1',
      },
      {
        sourceId: 'keep-me',
        sourceHeader: 'name',
        shapeIri: 'http://example.org/PlaceShape',
        propertyPath: 'http://www.w3.org/2000/01/rdf-schema#label',
      },
    ])
  })

  it('finds lat/lng inputs for a transformation node', () => {
    expect(getTransformationNodeInputs('transform:1', [
      {
        id: 'transform-ui:lat',
        source: 'src:places',
        sourceHandle: 'h:lat',
        target: 'transform:1',
        targetHandle: 'lat-input',
      },
      {
        id: 'transform-ui:lng',
        source: 'src:places',
        sourceHandle: 'h:lng',
        target: 'transform:1',
        targetHandle: 'lng-input',
      },
      {
        id: 'transform-ui:other',
        source: 'src:elsewhere',
        sourceHandle: 'h:value',
        target: 'transform:2',
        targetHandle: 'lat-input',
      },
    ])).toMatchObject({
      lat: {
        id: 'transform-ui:lat',
        source: 'src:places',
        sourceHandle: 'h:lat',
      },
      lng: {
        id: 'transform-ui:lng',
        source: 'src:places',
        sourceHandle: 'h:lng',
      },
    })
  })

  it('collects dependent transformation node ids for a source node', () => {
    expect(getDependentTransformationNodeIds('geonames:1', [
      {
        id: 'transform-ui:lat',
        source: 'geonames:1',
        sourceHandle: 'h:lat',
        target: 'transform:1',
        targetHandle: 'lat-input',
      },
      {
        id: 'transform-ui:lng',
        source: 'geonames:1',
        sourceHandle: 'h:lng',
        target: 'transform:1',
        targetHandle: 'lng-input',
      },
      {
        id: 'shape-ui:name',
        source: 'geonames:1',
        sourceHandle: 'h:name',
        target: 'shape:http://example.org/PlaceShape',
        targetHandle: 'p:http://www.w3.org/2000/01/rdf-schema#label',
      },
      {
        id: 'transform-ui:other',
        source: 'geonames:1',
        sourceHandle: 'h:lat',
        target: 'transform:2',
        targetHandle: 'lat-input',
      },
    ])).toEqual(['transform:1', 'transform:2'])
  })

  it('derives transformation mapping input from table-backed lat/lng connections', () => {
    expect(resolveTransformationMappingInput(
      'transform:1',
      [
        {
          id: 'transform-ui:lat',
          source: 'src:places',
          sourceHandle: 'h:lat',
          target: 'transform:1',
          targetHandle: 'lat-input',
        },
        {
          id: 'transform-ui:lng',
          source: 'src:places',
          sourceHandle: 'h:lng',
          target: 'transform:1',
          targetHandle: 'lng-input',
        },
      ],
      () => undefined,
    )).toEqual({
      sourceId: 'places',
      latHeader: 'lat',
      lngHeader: 'lng',
    })
  })

  it('derives transformation mapping input from GeoNames-backed lat/lng connections', () => {
    expect(resolveTransformationMappingInput(
      'transform:1',
      [
        {
          id: 'transform-ui:lat',
          source: 'geonames:1',
          sourceHandle: 'h:lat',
          target: 'transform:1',
          targetHandle: 'lat-input',
        },
        {
          id: 'transform-ui:lng',
          source: 'geonames:1',
          sourceHandle: 'h:lng',
          target: 'transform:1',
          targetHandle: 'lng-input',
        },
      ],
      nodeId => nodeId === 'geonames:1' ? 'geonames-output:1' : undefined,
    )).toEqual({
      sourceId: 'geonames-output:1',
      latHeader: 'lat',
      lngHeader: 'lng',
    })
  })

  it('rejects transformation mapping input when lat/lng do not share the same source', () => {
    expect(resolveTransformationMappingInput(
      'transform:1',
      [
        {
          id: 'transform-ui:lat',
          source: 'src:places',
          sourceHandle: 'h:lat',
          target: 'transform:1',
          targetHandle: 'lat-input',
        },
        {
          id: 'transform-ui:lng',
          source: 'src:other',
          sourceHandle: 'h:lng',
          target: 'transform:1',
          targetHandle: 'lng-input',
        },
      ],
      () => undefined,
    )).toBeUndefined()
  })
})