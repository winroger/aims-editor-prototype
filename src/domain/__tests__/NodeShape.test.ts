import { describe, expect, it } from 'vitest'
import { ApplicationProfile, classifyShape, parseShaclProfile } from '@/domain/NodeShape'

const SAMPLE_TTL = `
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix dct:  <http://purl.org/dc/terms/> .
@prefix ex:   <http://example.org/> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .

ex:PersonShape a sh:NodeShape ;
    dct:title "Person" ;
    sh:targetClass ex:Person ;
    owl:imports <http://example.org/imports/contact> ;
    sh:property [
        sh:name "Name" ;
        sh:path ex:name ;
        sh:datatype xsd:string ;
        sh:order 1 ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:name "Email" ;
        sh:path ex:email ;
        sh:datatype xsd:string ;
        sh:order 2 ;
    ] .
`

const STAKEHOLDER_TTL = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix schema: <http://schema.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix ex: <http://example.org/> .

ex:StakeholderShape a sh:NodeShape ;
  dct:title "Stakeholder" ;
  sh:targetClass prov:Attribution ;
  sh:property [
    sh:name "Organization" ;
    sh:path prov:agent ;
    sh:node ex:OrganisationShape ;
    sh:class foaf:Organisation ;
  ] ;
  sh:property [
    sh:name "Role" ;
    sh:path schema:roleName ;
    sh:nodeKind sh:BlankNodeOrIRI ;
  ] .
`

const INHERITED_BASE_TTL = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex: <http://example.org/> .

ex:ImportedProfileShape a sh:NodeShape ;
  dct:title "Imported profile" ;
  sh:targetClass ex:ImportedResource ;
  sh:property [
    sh:name "Imported field" ;
    sh:path ex:importedField ;
    sh:datatype xsd:string ;
    sh:order 1 ;
  ] .
`

const INHERITING_TTL = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex: <http://example.org/> .

ex:ConcreteShape a sh:NodeShape ;
  dct:title "Concrete shape" ;
  sh:targetClass ex:Concrete ;
  sh:node ex:ImportedProfileShape ;
  sh:property [
    sh:name "Own field" ;
    sh:path ex:ownField ;
    sh:datatype xsd:string ;
    sh:order 2 ;
  ] .
`

describe('parseShaclProfile', () => {
  it('parses a NodeShape with its property shapes', () => {
    const profile = parseShaclProfile(SAMPLE_TTL, 'sample.ttl', 'uploaded')
    expect(profile.nodeShapes).toHaveLength(1)
    const shape = profile.nodeShapes[0]
    expect(shape.label).toBe('Person')
    expect(shape.targetClass?.value).toBe('http://example.org/Person')
    expect(shape.properties).toHaveLength(2)
    expect(shape.properties[0].name).toBe('Name')
    expect(shape.properties[0].path?.value).toBe('http://example.org/name')
    expect(shape.properties[0].minCount).toBe(1)
    expect(shape.properties[0].maxCount).toBe(1)
  })

  it('sorts properties by sh:order', () => {
    const profile = parseShaclProfile(SAMPLE_TTL, 'sample.ttl', 'uploaded')
    const orders = profile.nodeShapes[0].properties.map(p => p.order)
    expect(orders).toEqual([1, 2])
  })

  it('collects owl:imports IRIs', () => {
    const profile = parseShaclProfile(SAMPLE_TTL, 'sample.ttl', 'uploaded')
    expect(profile.imports).toContain('http://example.org/imports/contact')
  })

  it('uses the first NodeShape IRI as the profile IRI', () => {
    const profile = parseShaclProfile(SAMPLE_TTL, 'sample.ttl', 'uploaded')
    expect(profile.iri).toBe('http://example.org/PersonShape')
  })

  it('classifies mixed stakeholder-style shapes as data, not reference', () => {
    const profile = parseShaclProfile(STAKEHOLDER_TTL, 'stakeholder.ttl', 'uploaded')
    expect(classifyShape(profile.nodeShapes[0])).toBe('data')
  })
})

describe('ApplicationProfile', () => {
  it('deduplicates NodeShapes by IRI across profiles', () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(SAMPLE_TTL, 'a.ttl', 'uploaded'))
    ap.upsert(parseShaclProfile(SAMPLE_TTL, 'b.ttl', 'uploaded'))
    expect(ap.allNodeShapes()).toHaveLength(1)
  })

  it('finds NodeShape by IRI', () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(SAMPLE_TTL, 'a.ttl', 'uploaded'))
    expect(ap.findNodeShape('http://example.org/PersonShape')).toBeDefined()
    expect(ap.findNodeShape('http://example.org/Unknown')).toBeUndefined()
  })

  it('reports hasShapes correctly', () => {
    const ap = new ApplicationProfile()
    expect(ap.hasShapes).toBe(false)
    ap.upsert(parseShaclProfile(SAMPLE_TTL, 'a.ttl', 'uploaded'))
    expect(ap.hasShapes).toBe(true)
  })

  it('merges node-level inherited properties ahead of own properties', () => {
    const ap = new ApplicationProfile()
    const imported = parseShaclProfile(INHERITED_BASE_TTL, 'imported.ttl', 'fetched', 'http://example.org/imported-profile')
    const inheriting = parseShaclProfile(INHERITING_TTL, 'concrete.ttl', 'uploaded')
    ap.upsert(imported)
    ap.upsert(inheriting)

    const shape = ap.findNodeShape('http://example.org/ConcreteShape')
    expect(shape?.properties.map(property => property.name)).toEqual(['Imported field', 'Own field'])
    expect(shape?.properties[0]?.inherited).toBe(true)
    expect(shape?.properties[0]?.inheritedFromShapeIri).toBe('http://example.org/ImportedProfileShape')
    expect(shape?.properties[1]?.inherited).not.toBe(true)
  })

  it('marks imported inherited node shapes so they can be hidden from the canvas', () => {
    const ap = new ApplicationProfile()
    const imported = parseShaclProfile(INHERITED_BASE_TTL, 'imported.ttl', 'fetched', 'http://example.org/imported-profile')
    const inheriting = parseShaclProfile(INHERITING_TTL, 'concrete.ttl', 'uploaded')
    ap.upsert(imported)
    ap.upsert(inheriting)

    expect(ap.inheritedImportedNodeShapeIds()).toEqual(new Set(['http://example.org/ImportedProfileShape']))
  })
})
