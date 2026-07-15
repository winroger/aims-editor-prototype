import { describe, expect, it } from 'vitest'
import { createColumnMappingEdge } from '@/domain/Mapping'
import {
  buildCanvasMappingEdges,
  buildCanvasShapeNodeId,
  buildCanvasShapeNodes,
  buildCanvasStructuralEdges,
} from '@/features/mapping/canvasGraphBuilders'
import { getEmbeddedExampleProjectSnapshot } from '@/services/project/loadEmbeddedExampleProject'
import { ApplicationProfile, parseShaclProfile } from '@/domain/NodeShape'
import { restoreDataSourcesFromSnapshot } from '@/services/project/projectSnapshot'

const INHERITED_BASE_TTL = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex: <http://example.org/> .

ex:BaseShape a sh:NodeShape ;
  dct:title "Base shape" ;
  sh:targetClass ex:Base ;
  sh:property [
    sh:name "Base field" ;
    sh:path ex:baseField ;
    sh:datatype xsd:string ;
    sh:order 1 ;
  ] .
`

const INHERITED_MIDDLE_TTL = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex: <http://example.org/> .

ex:MiddleShape a sh:NodeShape ;
  dct:title "Middle shape" ;
  sh:targetClass ex:Middle ;
  sh:node ex:BaseShape ;
  sh:property [
    sh:name "Middle field" ;
    sh:path ex:middleField ;
    sh:datatype xsd:string ;
    sh:order 2 ;
  ] .
`

const INHERITED_ROOT_TTL = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex: <http://example.org/> .

ex:RootShape a sh:NodeShape ;
  dct:title "Root shape" ;
  sh:targetClass ex:Root ;
  sh:node ex:MiddleShape ;
  sh:property [
    sh:name "Own field" ;
    sh:path ex:ownField ;
    sh:datatype xsd:string ;
    sh:order 3 ;
  ] .
`

const INHERITED_REFERENCE_TARGET_TTL = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix ex: <http://example.org/> .

ex:TargetShape a sh:NodeShape ;
  dct:title "Target shape" ;
  sh:targetClass ex:Target ;
  sh:property [
    sh:name "Target label" ;
    sh:path ex:targetLabel ;
  ] .
`

const INHERITED_REFERENCE_MIDDLE_TTL = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix ex: <http://example.org/> .

ex:MiddleRefShape a sh:NodeShape ;
  dct:title "Middle ref shape" ;
  sh:targetClass ex:MiddleRef ;
  sh:node ex:BaseShape ;
  sh:property [
    sh:name "Middle relation" ;
    sh:path ex:middleRelation ;
    sh:node ex:TargetShape ;
    sh:class ex:Target ;
  ] .
`

const INHERITED_REFERENCE_ROOT_TTL = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix ex: <http://example.org/> .

ex:RootRefShape a sh:NodeShape ;
  dct:title "Root ref shape" ;
  sh:targetClass ex:RootRef ;
  sh:node ex:MiddleRefShape ;
  sh:property [
    sh:name "Own relation" ;
    sh:path ex:ownRelation ;
  ] .
`

describe('canvasGraphBuilders', () => {
  it('creates a structural edge between linked CSV example tables', () => {
    const snapshot = getEmbeddedExampleProjectSnapshot()
    const ap = new ApplicationProfile()
    for (const profile of snapshot.shapeProfiles) {
      ap.upsert(parseShaclProfile(profile.rawTurtle, profile.source, 'embedded', profile.iri))
    }

    const edges = buildCanvasStructuralEdges(restoreDataSourcesFromSnapshot(snapshot.sources), ap.allNodeShapes())

    expect(edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: 'src:buildings.csv',
        target: 'src:locations.csv',
        sourceHandle: 'h:Location',
      }),
    ]))
  })

  it('keeps only the root shape node on the canvas and pushes inheritance into node data', () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(INHERITED_BASE_TTL, 'base.ttl', 'fetched', 'http://example.org/base-profile'))
    ap.upsert(parseShaclProfile(INHERITED_MIDDLE_TTL, 'middle.ttl', 'fetched', 'http://example.org/middle-profile'))
    ap.upsert(parseShaclProfile(INHERITED_ROOT_TTL, 'root.ttl', 'uploaded', 'http://example.org/root-profile'))

    const allShapes = ap.allNodeShapes()
    const rootShape = ap.findNodeShape('http://example.org/RootShape')
    expect(rootShape).toBeDefined()

    const rootNodeId = buildCanvasShapeNodeId('http://example.org/RootShape')
    const nodes = buildCanvasShapeNodes(
      [rootShape!],
      allShapes,
      new Set(),
      () => undefined,
    )
    expect(nodes.map(node => node.id)).toEqual([rootNodeId])
    expect((nodes[0]?.data as { inheritedGroups?: Array<{ label: string; children: Array<{ label: string }> }> }).inheritedGroups).toEqual([
      expect.objectContaining({
        label: 'Middle shape',
        children: [expect.objectContaining({ label: 'Base shape' })],
      }),
    ])
  })

  it('keeps mapping edges on the parent node when inherited origins are visible', () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(INHERITED_BASE_TTL, 'base.ttl', 'fetched', 'http://example.org/base-profile'))
    ap.upsert(parseShaclProfile(INHERITED_MIDDLE_TTL, 'middle.ttl', 'fetched', 'http://example.org/middle-profile'))
    ap.upsert(parseShaclProfile(INHERITED_ROOT_TTL, 'root.ttl', 'uploaded', 'http://example.org/root-profile'))

    const allShapes = ap.allNodeShapes()
    const rootShape = ap.findNodeShape('http://example.org/RootShape')
    expect(rootShape).toBeDefined()

    const rootNodeId = buildCanvasShapeNodeId('http://example.org/RootShape')

    const shapeNodes = buildCanvasShapeNodes(
      [rootShape!],
      allShapes,
      new Set(),
      () => undefined,
    )
    const visibleNodeIds = new Set(['src:people', ...shapeNodes.map(node => node.id)])

    const edges = buildCanvasMappingEdges(
      [createColumnMappingEdge({
        sourceId: 'people',
        sourceHeader: 'Base column',
        shapeIri: 'http://example.org/RootShape',
        propertyPath: 'http://example.org/baseField',
      })],
      allShapes,
      visibleNodeIds,
    )

    expect(edges).toEqual([
      expect.objectContaining({
        id: 'e:http://example.org/RootShape::http://example.org/baseField',
        label: '',
        target: rootNodeId,
        targetHandle: 'p:http://example.org/baseField',
      }),
    ])
  })

  it('does not create separate structural inheritance edges on the canvas', () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(INHERITED_BASE_TTL, 'base.ttl', 'fetched', 'http://example.org/base-profile'))
    ap.upsert(parseShaclProfile(INHERITED_MIDDLE_TTL, 'middle.ttl', 'fetched', 'http://example.org/middle-profile'))
    ap.upsert(parseShaclProfile(INHERITED_ROOT_TTL, 'root.ttl', 'uploaded', 'http://example.org/root-profile'))

    const allShapes = ap.allNodeShapes()
    const rootShape = ap.findNodeShape('http://example.org/RootShape')
    expect(rootShape).toBeDefined()

    const rootNodeId = buildCanvasShapeNodeId('http://example.org/RootShape')
    const visibleNodeIds = new Set([rootNodeId])

    const edges = buildCanvasStructuralEdges(
      [],
      [rootShape!],
      allShapes,
      visibleNodeIds,
    )

    expect(edges).toEqual([])
  })

  it('keeps inherited reference edges anchored on the root shape node', () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(INHERITED_BASE_TTL, 'base.ttl', 'uploaded'))
    ap.upsert(parseShaclProfile(INHERITED_REFERENCE_TARGET_TTL, 'target.ttl', 'uploaded'))
    ap.upsert(parseShaclProfile(INHERITED_REFERENCE_MIDDLE_TTL, 'middle-ref.ttl', 'uploaded'))
    ap.upsert(parseShaclProfile(INHERITED_REFERENCE_ROOT_TTL, 'root-ref.ttl', 'uploaded'))

    const allShapes = ap.allNodeShapes()
    const rootShape = ap.findNodeShape('http://example.org/RootRefShape')
    expect(rootShape).toBeDefined()

    const rootNodeId = buildCanvasShapeNodeId('http://example.org/RootRefShape')
    const targetNodeId = buildCanvasShapeNodeId('http://example.org/TargetShape')
    const visibleNodeIds = new Set([rootNodeId, targetNodeId])

    const edges = buildCanvasStructuralEdges(
      [],
      [rootShape!],
      allShapes,
      visibleNodeIds,
    )

    expect(edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'ref:http://example.org/RootRefShape::http://example.org/middleRelation->http://example.org/TargetShape',
        source: rootNodeId,
        target: targetNodeId,
        label: 'sh:node',
      }),
    ]))
  })
})
