import JSZip from 'jszip'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApplicationProfile, parseShaclProfile } from '@/domain/NodeShape'
import { AirtableDataSource } from '@/domain/DataSource'
import { MappingState } from '@/domain/Mapping'
import { exportRoCrate } from '@/services/export/exportService'

const SHAPE = `
@prefix sh:  <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix ex:  <http://example.org/> .

ex:PersonShape a sh:NodeShape ;
  dct:title "Person" ;
  dct:description "Person profile description"@en ;
  sh:targetClass ex:Person ;
  sh:property [ sh:name "Name" ; sh:path ex:name ; sh:datatype xsd:string ] .
`

describe('exportService', () => {
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL
  let capturedBlob: Blob | null = null

  beforeEach(() => {
    capturedBlob = null
    URL.createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob
      return 'blob:test-export'
    })
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    vi.restoreAllMocks()
  })

  it('writes RML, internal mapping JSON, and Airtable record IDs into the RO-Crate bundle', async () => {
    const ap = new ApplicationProfile()
    const profile = parseShaclProfile(SHAPE, 'shape.ttl', 'uploaded')
    ap.upsert(profile)

    const source = new AirtableDataSource('people', 'People', ['Name'], [['Alice']], ['recAAA'])
    const mapping = new MappingState()
    mapping.addOrReplace({
      sourceId: 'people',
      sourceHeader: 'Name',
      shapeIri: 'http://example.org/PersonShape',
      propertyPath: 'http://example.org/name',
    })

    const result = await exportRoCrate({
      projectTitle: 'People export',
      ap,
      profiles: [profile],
      sources: [source],
      mapping,
    })

    expect(result.filename).toMatch(/\.zip$/)
    expect(capturedBlob).toBeTruthy()

    const zip = await JSZip.loadAsync(await capturedBlob!.arrayBuffer())
    const rml = await zip.file('mapping/mapping.rml.ttl')?.async('string')
    const mappingJson = await zip.file('mapping/mapping.json')?.async('string')
    const sourceCsv = await zip.file('sources/People.csv')?.async('string')
    const roCrateJson = await zip.file('ro-crate-metadata.json')?.async('string')

    expect(rml).toContain('rml:source "sources/People.csv"')
    expect(rml).toContain('rr:template "http://example.org/Person/{_recordId}"')
    expect(mappingJson).toContain('"edges"')
    expect(sourceCsv).toContain('_recordId,Name')
    expect(sourceCsv).toContain('recAAA,Alice')

    const roCrate = JSON.parse(roCrateJson ?? '{}')
    const ids = (roCrate['@graph'] as Array<{ '@id': string }>).map(entity => entity['@id'])
    expect(ids).toContain('mapping/mapping.rml.ttl')
    expect(ids).toContain('mapping/mapping.json')
  })

  it('derives RO-Crate root metadata from the dataset metadata turtle', async () => {
    const ap = new ApplicationProfile()
    const profile = parseShaclProfile(SHAPE, 'shape.ttl', 'uploaded')
    ap.upsert(profile)

    const source = new AirtableDataSource('people', 'People', ['Name'], [['Alice']], ['recAAA'])
    const mapping = new MappingState()
    mapping.addOrReplace({
      sourceId: 'people',
      sourceHeader: 'Name',
      shapeIri: 'http://example.org/PersonShape',
      propertyPath: 'http://example.org/name',
    })

    const metadataTurtle = `
@prefix dcat: <http://www.w3.org/ns/dcat#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

<http://example.org/dataset> a dcat:Dataset ;
  dct:title "Derived crate title" ;
  dct:description "Derived crate description" ;
  dct:issued "2026-05-12" ;
  dct:license <http://creativecommons.org/licenses/by/4.0/> ;
  prov:qualifiedAttribution _:att1 .

_:att1 prov:agent <http://example.org/people/alice> .
<http://example.org/people/alice> a foaf:Person ;
  foaf:name "Alice Example" .
`

    await exportRoCrate({
      projectTitle: 'Fallback title',
      ap,
      profiles: [profile],
      sources: [source],
      mapping,
      metadataTurtle,
    })

    const zip = await JSZip.loadAsync(await capturedBlob!.arrayBuffer())
    const roCrateJson = await zip.file('ro-crate-metadata.json')?.async('string')
    const roCrate = JSON.parse(roCrateJson ?? '{}')
    const root = roCrate['@graph'].find((entity: { '@id': string }) => entity['@id'] === './')

    expect(root.name).toBe('Derived crate title')
    expect(root.description).toBe('Derived crate description')
    expect(root.datePublished).toBe('2026-05-12')
    expect(root.license).toEqual({ '@id': 'http://creativecommons.org/licenses/by/4.0/' })
  })

  it('adds SHACL profile descriptions to file metadata and uses them as description fallback', async () => {
    const ap = new ApplicationProfile()
    const profile = parseShaclProfile(SHAPE, 'shape.ttl', 'uploaded')
    ap.upsert(profile)

    const source = new AirtableDataSource('people', 'People', ['Name'], [['Alice']], ['recAAA'])
    const mapping = new MappingState()
    mapping.addOrReplace({
      sourceId: 'people',
      sourceHeader: 'Name',
      shapeIri: 'http://example.org/PersonShape',
      propertyPath: 'http://example.org/name',
    })

    await exportRoCrate({
      projectTitle: 'Fallback title',
      ap,
      profiles: [profile],
      sources: [source],
      mapping,
    })

    const zip = await JSZip.loadAsync(await capturedBlob!.arrayBuffer())
    const roCrateJson = await zip.file('ro-crate-metadata.json')?.async('string')
    const roCrate = JSON.parse(roCrateJson ?? '{}')
    const root = roCrate['@graph'].find((entity: { '@id': string }) => entity['@id'] === './')
    const shapeFile = roCrate['@graph'].find((entity: { '@id': string }) => entity['@id'] === 'shapes/PersonShape.ttl')

    expect(root.description).toContain('Person profile description')
    expect(shapeFile.name).toBe('Person')
    expect(shapeFile.description).toBe('Person profile description')
  })
})