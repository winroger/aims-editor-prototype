import { describe, expect, it } from 'vitest'
import { extractDatasetMetadata } from '@/services/export/datasetMetadata'

const METADATA_TURTLE = `
@prefix dcat: <http://www.w3.org/ns/dcat#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix schema: <http://schema.org/> .

<http://example.org/dataset> a dcat:Dataset ;
  dct:title "Datensatz A"@de, "Dataset A"@en ;
  dct:description "Beschreibung"@de ;
  dct:issued "2026-05-12" ;
  dct:license <http://creativecommons.org/licenses/by/4.0/> ;
  prov:qualifiedAttribution _:att1, _:att2 .

_:att1 prov:agent <http://example.org/people/alice> ;
  <http://www.w3.org/ns/dcat#hadRole> <http://example.org/roles/author> .

_:att2 prov:agent <http://example.org/orgs/acme> ;
  <http://www.w3.org/ns/dcat#hadRole> <http://example.org/roles/publisher> .

<http://example.org/people/alice> a foaf:Person ;
  foaf:name "Alice Example" ;
  schema:url <https://example.org/alice> .

<http://example.org/orgs/acme> a schema:Organization ;
  foaf:name "Acme Org" ;
  schema:url <https://acme.example.org/> .

<http://example.org/roles/author> rdfs:label "Author" .
<http://example.org/roles/publisher> rdfs:label "Publisher" .
`

describe('datasetMetadata', () => {
  it('extracts dataset summary and agents from metadata turtle', () => {
    const summary = extractDatasetMetadata(METADATA_TURTLE)

    expect(summary.name).toBe('Datensatz A')
    expect(summary.description).toBe('Beschreibung')
    expect(summary.datePublished).toBe('2026-05-12')
    expect(summary.license).toBe('http://creativecommons.org/licenses/by/4.0/')
    expect(summary.agents).toEqual([
      {
        id: 'http://example.org/people/alice',
        name: 'Alice Example',
        type: 'Person',
        url: 'https://example.org/alice',
        role: 'Author',
      },
      {
        id: 'http://example.org/orgs/acme',
        name: 'Acme Org',
        type: 'Organization',
        url: 'https://acme.example.org/',
        role: 'Publisher',
      },
    ])
  })
})