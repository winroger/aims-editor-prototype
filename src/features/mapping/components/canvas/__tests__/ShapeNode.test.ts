import { describe, expect, it, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ApplicationProfile, parseShaclProfile } from '@/domain/NodeShape'
import {
  buildCanvasInheritedShapeNodeId,
  buildCanvasShapeNodeId,
  buildCanvasShapeNodes,
  type ShapeCanvasNodeData,
} from '@/features/mapping/canvasGraphBuilders'
import ShapeNode from '@/features/mapping/components/canvas/ShapeNode.vue'
import {
  ARDMP_BUILDING_TTL,
  ARDMP_GEOLOCATION_TTL,
  ARDMP_ORGANIZATION_TTL,
  ARDMP_RESOURCE_TTL,
  ARDMP_STAKEHOLDER_TTL,
  ARDMP_TIMBER_BUILDING_TTL,
} from '@/features/mapping/components/canvas/__tests__/shapeNodeFixtures'
import { useShapesStore } from '@/stores/shapesStore'

const PROFILE_IDS = {
  timberBuilding: 'https://w3id.org/nfdi4ing/profiles/2e6d9d8f-46e4-4d8a-9a6e-c76f4e2752c4',
  building: 'https://w3id.org/nfdi4ing/profiles/1f6323a9-b59b-4fb0-9f0f-63fd8ef9594a',
  location: 'https://w3id.org/nfdi4ing/profiles/1cf39480-24ef-41db-a5b3-070601a05cc3',
  resource: 'https://w3id.org/nfdi4ing/profiles/cf30a8b0-e6e9-4349-9376-1552e1930d3d',
  stakeholder: 'https://w3id.org/nfdi4ing/profiles/0bbadc41-420e-4ea3-8090-83625c76ee1d',
  organization: 'https://w3id.org/nfdi4ing/profiles/9d3337fe-0375-485f-9b37-2782f53df7f8',
} as const

const RECURSIVE_BASE_TTL = `
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

const RECURSIVE_MIDDLE_TTL = `
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

const RECURSIVE_ROOT_TTL = `
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

const LOGICAL_CANVAS_TTL = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex: <http://example.org/> .

ex:LogicalShape a sh:NodeShape ;
  dct:title "Logical shape" ;
  sh:targetClass ex:Logical ;
  sh:property [
    sh:name "Date of production" ;
    sh:path ex:dateOfProduction ;
    sh:or (
      [ sh:datatype xsd:gYear ; sh:name "Single year" ]
      [ sh:datatype xsd:string ; sh:name "Year range" ]
    ) ;
    sh:maxCount 1 ;
  ] ;
  sh:property [
    sh:name "Stakeholder" ;
    sh:path ex:stakeholder ;
    sh:qualifiedValueShape [
      sh:node ex:StakeholderShape ;
      sh:class ex:Stakeholder ;
      sh:name "Stakeholder shape" ;
    ] ;
    sh:qualifiedMinCount 1 ;
  ] .
`

describe('ShapeNode', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('separates inherited and own properties for the ARDMP timber building profile', () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(ARDMP_TIMBER_BUILDING_TTL, 'ardmp_timber-building-shape.ttl', 'uploaded', PROFILE_IDS.timberBuilding))
    ap.upsert(parseShaclProfile(ARDMP_BUILDING_TTL, 'ardmp_building-shape.ttl', 'uploaded', PROFILE_IDS.building))
    ap.upsert(parseShaclProfile(ARDMP_GEOLOCATION_TTL, 'ardmp_geolocation-shape.ttl', 'uploaded', PROFILE_IDS.location))
    ap.upsert(parseShaclProfile(ARDMP_RESOURCE_TTL, 'ardmp_resource-shape.ttl', 'uploaded', PROFILE_IDS.resource))
    ap.upsert(parseShaclProfile(ARDMP_STAKEHOLDER_TTL, 'ardmp_stakeholder-shape.ttl', 'uploaded', PROFILE_IDS.stakeholder))
    ap.upsert(parseShaclProfile(ARDMP_ORGANIZATION_TTL, 'ardmp_organization.ttl', 'uploaded', PROFILE_IDS.organization))

    const shapesStore = useShapesStore()
    shapesStore.ap = ap

    const rootShape = ap.findNodeShape(PROFILE_IDS.timberBuilding)
    expect(rootShape).toBeDefined()

    const nodes = buildCanvasShapeNodes(
      [rootShape!],
      ap.allNodeShapes(),
      new Set([buildCanvasShapeNodeId(PROFILE_IDS.timberBuilding)]),
      () => undefined,
      () => undefined,
    )

    const nodeData = nodes[0]?.data as ShapeCanvasNodeData | undefined
    expect(nodeData).toBeDefined()

    const wrapper = mount(ShapeNode, {
      props: {
        data: nodeData!,
      },
      global: {
        stubs: {
          Handle: {
            props: ['id'],
            template: '<div class="handle-stub" :data-id="id"></div>',
          },
        },
      },
    })

    const sectionLabels = wrapper.findAll('.section-label').map(node => node.text())
    expect(sectionLabels).toEqual(['Own Properties'])

    const ownPropertiesLabelIndex = wrapper.text().indexOf('Own Properties')
    const inheritedPropertyIndex = wrapper.text().indexOf('Thumbnail Image')
    const ownPropertyIndex = wrapper.text().indexOf('Area')
    expect(inheritedPropertyIndex).toBeGreaterThan(-1)
    expect(ownPropertyIndex).toBeGreaterThan(-1)
    expect(inheritedPropertyIndex).toBeLessThan(ownPropertiesLabelIndex)
    expect(ownPropertyIndex).toBeGreaterThan(ownPropertiesLabelIndex)

    const propertyRows = wrapper.findAll('.properties').map(list =>
      list.findAll('.row').map(row => row.find('.prop-name').text()),
    )

    expect(propertyRows[0]).toEqual([
      'Name',
      'Stakeholder',
      'Date of production',
      'Location',
      'Source',
      'Thumbnail Image',
    ])
    expect(propertyRows[1]).toEqual([
      'Area',
      'Timber volume',
      'Material Type',
    ])
  })

  it('allows inherited origin nodes to separate and expand their own inherited properties', () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(RECURSIVE_BASE_TTL, 'base.ttl', 'uploaded'))
    ap.upsert(parseShaclProfile(RECURSIVE_MIDDLE_TTL, 'middle.ttl', 'uploaded'))
    ap.upsert(parseShaclProfile(RECURSIVE_ROOT_TTL, 'root.ttl', 'uploaded'))

    const shapesStore = useShapesStore()
    shapesStore.ap = ap

    const rootShape = ap.findNodeShape('http://example.org/RootShape')
    expect(rootShape).toBeDefined()

    const expandedNodeIds = new Set([
      buildCanvasShapeNodeId('http://example.org/RootShape'),
      buildCanvasInheritedShapeNodeId('http://example.org/RootShape', ['http://example.org/MiddleShape']),
    ])

    const nodes = buildCanvasShapeNodes(
      [rootShape!],
      ap.allNodeShapes(),
      expandedNodeIds,
      () => undefined,
      () => undefined,
    )

    const middleNode = nodes.find(node => node.id === buildCanvasInheritedShapeNodeId('http://example.org/RootShape', ['http://example.org/MiddleShape']))
    const nodeData = middleNode?.data as ShapeCanvasNodeData | undefined
    expect(nodeData?.canToggleInherited).toBe(true)

    const wrapper = mount(ShapeNode, {
      props: {
        data: nodeData!,
      },
      global: {
        stubs: {
          Handle: {
            props: ['id'],
            template: '<div class="handle-stub" :data-id="id"></div>',
          },
        },
      },
    })

    const propertyRows = wrapper.findAll('.properties').map(list =>
      list.findAll('.row').map(row => row.find('.prop-name').text()),
    )

    expect(propertyRows[0]).toEqual([
      'Base field',
    ])
    expect(propertyRows[1]).toEqual([
      'Middle field',
    ])
  })

  it('renders sh:or and qualifiedValueShape constraints in the canvas', () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(LOGICAL_CANVAS_TTL, 'logical.ttl', 'uploaded'))

    const shapesStore = useShapesStore()
    shapesStore.ap = ap

    const shape = ap.findNodeShape('http://example.org/LogicalShape')
    const nodes = buildCanvasShapeNodes(
      [shape!],
      ap.allNodeShapes(),
      new Set(),
      () => undefined,
      () => undefined,
    )

    const wrapper = mount(ShapeNode, {
      props: {
        data: nodes[0]!.data as ShapeCanvasNodeData,
      },
      global: {
        stubs: {
          Handle: {
            props: ['id'],
            template: '<div class="handle-stub" :data-id="id"></div>',
          },
        },
      },
    })

    const badges = wrapper.findAll('.type-badge').map(node => node.text())
    expect(badges).toContain('Single year | Year range')
    expect(wrapper.find('.fk-icon').exists()).toBe(true)
    expect(wrapper.text()).toContain('Stakeholder')
  })
})
