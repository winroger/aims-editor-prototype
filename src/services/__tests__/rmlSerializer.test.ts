import { describe, expect, it } from 'vitest'
import { ApplicationProfile, parseShaclProfile } from '@/domain/NodeShape'
import { AirtableDataSource, CsvDataSource, GeoNamesResultDataSource } from '@/domain/DataSource'
import { MappingState } from '@/domain/Mapping'
import { serializeMappingAsRml } from '@/services/export/rmlSerializer'

const FK_SHAPES = `
@prefix sh:  <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix ex:  <http://example.org/> .

ex:PersonShape a sh:NodeShape ;
  dct:title "Person" ;
  sh:targetClass ex:Person ;
  sh:property [ sh:name "Name" ; sh:path ex:name ; sh:datatype xsd:string ] .

ex:ProjectShape a sh:NodeShape ;
  dct:title "Project" ;
  sh:targetClass ex:Project ;
  sh:property [ sh:name "Title" ; sh:path ex:title ; sh:datatype xsd:string ] ;
  sh:property [ sh:name "Owner" ; sh:path ex:owner ; sh:node ex:PersonShape ] .
`

const IRI_SHAPE = `
@prefix sh:  <http://www.w3.org/ns/shacl#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix ex:  <http://example.org/> .
@prefix schema: <http://schema.org/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:ResourceShape a sh:NodeShape ;
  dct:title "Resource" ;
  sh:targetClass rdfs:Resource ;
  sh:property [ sh:name "URL" ; sh:path schema:url ; sh:nodeKind sh:IRI ] .
`

const GEO_SHAPE = `
@prefix sh:  <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix geo: <http://www.opengis.net/ont/geosparql#> .
@prefix ex:  <http://example.org/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:PlaceShape a sh:NodeShape ;
  dct:title "Place" ;
  sh:targetClass ex:Place ;
  sh:property [ sh:name "Geometry" ; sh:path geo:asWKT ; sh:datatype geo:wktLiteral ] ;
  sh:property [ sh:name "GeoNames ID" ; sh:path ex:geonamesId ; sh:datatype xsd:string ] ;
  sh:property [ sh:name "Place label" ; sh:path rdfs:label ; sh:datatype xsd:string ] .
`

describe('rmlSerializer', () => {
  it('serializes one TriplesMap per mapped shape with CSV logical sources and subject templates', async () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(FK_SHAPES, 'fk.ttl', 'uploaded'))

    const people = new AirtableDataSource('people', 'People', ['Name'], [['Alice']], ['recAAA'])
    const projects = new AirtableDataSource('projects', 'Projects', ['Title', 'Owner'], [['My Project', 'recAAA']], ['recPRJ'])

    const mapping = new MappingState()
    mapping.addOrReplace({ sourceId: 'people', sourceHeader: 'Name', shapeIri: 'http://example.org/PersonShape', propertyPath: 'http://example.org/name' })
    mapping.addOrReplace({ sourceId: 'projects', sourceHeader: 'Title', shapeIri: 'http://example.org/ProjectShape', propertyPath: 'http://example.org/title' })
    mapping.addOrReplace({ sourceId: 'projects', sourceHeader: 'Owner', shapeIri: 'http://example.org/ProjectShape', propertyPath: 'http://example.org/owner' })

    const ttl = await serializeMappingAsRml(ap, mapping, [people, projects])

    expect(ttl).toContain('rr:TriplesMap')
    expect(ttl).toContain('rml:source "sources/Projects.csv"')
    expect(ttl).toContain('rr:template "http://example.org/Project/{_recordId}"')
    expect(ttl).toContain('rr:template "http://example.org/Person/{Owner}"')
    expect(ttl).toContain('rml:reference "Title"')
  })

  it('marks sh:IRI targets as rr:IRI object maps', async () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(IRI_SHAPE, 'iri.ttl', 'uploaded'))

    const csv = new CsvDataSource('resources', 'resources.csv', ['id', 'URL'], [['r1', 'https://example.org/file']])
    const mapping = new MappingState()
    mapping.addOrReplace({
      sourceId: 'resources',
      sourceHeader: 'URL',
      shapeIri: 'http://example.org/ResourceShape',
      propertyPath: 'http://schema.org/url',
    })

    const ttl = await serializeMappingAsRml(ap, mapping, [csv])

    expect(ttl).toContain('rml:reference "URL"')
    expect(ttl).toContain('rr:termType rr:IRI')
    expect(ttl).toContain('rr:template "http://example.org/Resource/{id}"')
  })

  it('serializes multiple aligned sources for one shape as multiple TriplesMaps', async () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(GEO_SHAPE, 'geo.ttl', 'uploaded'))

    const table = new CsvDataSource('locations', 'locations.csv', ['id', 'geonamesId'], [['loc-1', '5746545']])
    const geonames = new GeoNamesResultDataSource('geonames-output:node-1', 'GeoNames node-1', ['name', 'id', 'lat', 'lng'], [['Portland', '5746545', '45.52345', '-122.67621']], ['loc-1'])

    const mapping = new MappingState()
    mapping.addOrReplace({ sourceId: 'locations', sourceHeader: 'geonamesId', shapeIri: 'http://example.org/PlaceShape', propertyPath: 'http://example.org/geonamesId' })
    mapping.addOrReplace({ sourceId: 'geonames-output:node-1', sourceHeader: 'name', shapeIri: 'http://example.org/PlaceShape', propertyPath: 'http://www.w3.org/2000/01/rdf-schema#label', geoNamesNodeId: 'geonames:node-1' })

    const ttl = await serializeMappingAsRml(ap, mapping, [table, geonames])

    expect((ttl.match(/rr:TriplesMap/g) ?? []).length).toBe(2)
    expect(ttl).toContain('rml:source "sources/locations_csv.csv"')
    expect(ttl).toContain('rml:source "sources/GeoNames_node-1.csv"')
    expect(ttl).toContain('rr:template "http://example.org/Place/{id}"')
    expect(ttl).toContain('rr:template "http://example.org/Place/{_recordId}"')
  })

  it('serializes lat/lng to WKT transforms as literal templates', async () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(GEO_SHAPE, 'geo.ttl', 'uploaded'))

    const csv = new CsvDataSource('places', 'places.csv', ['id', 'lat', 'lng'], [['p1', '49.8728', '8.6512']])
    const mapping = new MappingState()
    mapping.addOrReplace({
      sourceId: 'places',
      sourceHeader: 'lat',
      secondarySourceHeader: 'lng',
      shapeIri: 'http://example.org/PlaceShape',
      propertyPath: 'http://www.opengis.net/ont/geosparql#asWKT',
      transform: 'lat-lng-to-wkt',
      transformNodeId: 'transform:test',
    })

    const ttl = await serializeMappingAsRml(ap, mapping, [csv])

    expect(ttl).toContain('rr:template "POINT({lng} {lat})"')
    expect(ttl).toContain('rr:termType rr:Literal')
  })
})