import { describe, expect, it } from 'vitest'
import { ApplicationProfile, parseShaclProfile } from '@/domain/NodeShape'
import { MappingState } from '@/domain/Mapping'
import { buildBrowseModel } from '@/services/browse/browseService'
import { generateRdf } from '@/services/rdf/rdfGenerator'
import { buildRuntimeStagingShapes, hybridShapeIriForSource, stagingShapeIriForSource } from '@/services/mapping/stagingShapes'
import { airtableSource } from '@/test/dataSources'

const HYBRID_LOCATION_SHAPE = `
@prefix sh:  <http://www.w3.org/ns/shacl#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix geo: <http://www.opengis.net/ont/geosparql#> .
@prefix ex:  <http://example.org/> .

ex:LocationShape a sh:NodeShape ;
  dct:title "Location" ;
  sh:targetClass dct:Location ;
  sh:property [ sh:name "Geometry" ; sh:path geo:asWKT ; sh:datatype geo:wktLiteral ] .
`

describe('stagingShapes', () => {
  it('builds runtime staging node shapes for active unmapped columns', () => {
    const source = airtableSource('people', 'People', ['Name', 'Email'], [['Alice', 'alice@example.org']], ['recAAA'])
    const mapping = new MappingState()

    const runtimeShapes = buildRuntimeStagingShapes([source], mapping)

    expect(runtimeShapes.profile?.iri).toBe('https://w3id.org/ardmp/staging/profile/runtime')
    expect(runtimeShapes.nodeShapes).toHaveLength(1)
    expect(runtimeShapes.nodeShapes[0].targetClass?.value).toBe('https://w3id.org/ardmp/staging/class/people')
    expect(runtimeShapes.nodeShapes[0].properties.map(property => property.path?.value)).toEqual([
      'https://w3id.org/ardmp/staging/property/people__name',
      'https://w3id.org/ardmp/staging/property/people__email',
    ])
  })

  it('omits disabled and explicitly mapped staging columns from runtime shapes', () => {
    const source = airtableSource('people', 'People', ['Name', 'Email'], [['Alice', 'alice@example.org']], ['recAAA'])
    const mapping = new MappingState()
    mapping.setStagingColumnActive(source.id, 'Email', false)
    mapping.addOrReplace({
      sourceId: source.id,
      sourceHeader: 'Name',
      shapeIri: 'http://example.org/PersonShape',
      propertyPath: 'http://example.org/name',
    })

    const runtimeShapes = buildRuntimeStagingShapes([source], mapping)

    expect(runtimeShapes.nodeShapes).toHaveLength(0)
    expect(runtimeShapes.turtle).toBe('')
  })

  it('restores browse labels for staging classes and properties', () => {
    const source = airtableSource('people', 'People', ['Name', 'Email'], [['Alice', 'alice@example.org']], ['recAAA'])
    const mapping = new MappingState()
    const runtimeShapes = buildRuntimeStagingShapes([source], mapping)
    const generated = generateRdf(new ApplicationProfile(), mapping, [source])

    const model = buildBrowseModel(generated.store, runtimeShapes.nodeShapes)

    expect(model.groups).toHaveLength(1)
    expect(model.groups[0].classLabel).toBe('People')
    expect(model.groups[0].subjects[0].properties.map(property => property.label)).toEqual(['Email', 'Name'])
  })

  it('marks record-id linked staging columns as node references to the target staging shape', () => {
    const people = airtableSource('people', 'People', ['Name'], [['Alice']], ['recqqg9hRlNLclOoE'])
    const projects = airtableSource('projects', 'Projects', ['Title', 'Owner'], [['My Project', 'recqqg9hRlNLclOoE']], ['recPRJ00000000000'])

    const runtimeShapes = buildRuntimeStagingShapes([people, projects], new MappingState())
    const projectShape = runtimeShapes.nodeShapes.find(shape => shape.targetClass?.value === 'https://w3id.org/ardmp/staging/class/projects')
    const ownerProperty = projectShape?.properties.find(property => property.name === 'Owner')

    expect(ownerProperty?.node?.value).toBe(stagingShapeIriForSource(people))
    expect(ownerProperty?.nodeKind?.value).toBe('http://www.w3.org/ns/shacl#IRI')
  })

  it('builds a hybrid runtime shape when remaining staging columns share one explicit target owner', () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(HYBRID_LOCATION_SHAPE, 'hybrid-location.ttl', 'uploaded'))

    const source = airtableSource(
      'locations',
      'locations.csv',
      ['Label', 'WKT'],
      [['Vancouver', 'POINT(-123.1207 49.2827)']],
      ['recLOCATION000001'],
    )
    const mapping = new MappingState()
    mapping.addOrReplace({
      sourceId: source.id,
      sourceHeader: 'WKT',
      shapeIri: 'http://example.org/LocationShape',
      propertyPath: 'http://www.opengis.net/ont/geosparql#asWKT',
    })

    const runtimeShapes = buildRuntimeStagingShapes([source], mapping, ap.allNodeShapes())
    const hybridShape = runtimeShapes.nodeShapes.find(shape => shape.nodeId.value === hybridShapeIriForSource(source))

    expect(hybridShape?.targetClass?.value).toBe('http://purl.org/dc/terms/Location')
    expect(hybridShape?.properties.map(property => property.path?.value)).toEqual([
      'http://www.opengis.net/ont/geosparql#asWKT',
      'https://w3id.org/ardmp/staging/property/locations-csv__label',
    ])
  })
})