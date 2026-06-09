import { describe, expect, it } from 'vitest'
import { graph, parse } from 'rdflib'
import { ApplicationProfile, parseShaclProfile } from '@/domain/NodeShape'
import { buildExploreChartPreviewOption } from '@/services/explore/echartsOptions'
import { buildExploreDataframeModel, buildExploreDataset } from '@/services/explore/exploreService'

const PROFILE = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex: <http://example.org/> .

ex:BuildingShape a sh:NodeShape ;
  sh:targetClass ex:Building ;
  sh:property [ sh:path ex:name ; sh:name "Building Name" ] ;
  sh:property [ sh:path ex:height ; sh:name "Height" ; sh:datatype xsd:integer ] ;
  sh:property [ sh:path ex:area ; sh:name "Area" ; sh:datatype xsd:integer ] ;
  sh:property [ sh:path ex:locatedIn ; sh:name "Located In" ; sh:node ex:PlaceShape ] .

ex:PlaceShape a sh:NodeShape ;
  sh:targetClass ex:Place ;
  sh:property [ sh:path ex:placeName ; sh:name "Place Name" ] ;
  sh:property [ sh:path ex:country ; sh:name "Country" ; sh:node ex:CountryShape ] .

ex:CountryShape a sh:NodeShape ;
  sh:targetClass ex:Country ;
  sh:property [ sh:path ex:countryName ; sh:name "Country Name" ] ;
  sh:property [ sh:path ex:region ; sh:name "Region" ] .
`

const DATA = `
@prefix ex: <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:building-a a ex:Building ;
  ex:name "Building A" ;
  ex:height "12"^^xsd:integer ;
  ex:area "120"^^xsd:integer ;
  ex:locatedIn ex:place-berlin .

ex:building-b a ex:Building ;
  ex:name "Building B" ;
  ex:height "20"^^xsd:integer ;
  ex:area "220"^^xsd:integer ;
  ex:locatedIn ex:place-madrid .

ex:place-berlin a ex:Place ;
  ex:placeName "Berlin" ;
  ex:country ex:country-de .

ex:place-madrid a ex:Place ;
  ex:placeName "Madrid" ;
  ex:country ex:country-es .

ex:country-de a ex:Country ;
  ex:countryName "Germany" ;
  ex:region "Europe" .

ex:country-es a ex:Country ;
  ex:countryName "Spain" ;
  ex:region "Europe" .
`

function createLinkedExploreState() {
  const ap = new ApplicationProfile()
  ap.upsert(parseShaclProfile(PROFILE, 'profile.ttl', 'embedded', 'http://example.org/profile'))

  const store = graph()
  parse(DATA, store, 'http://example.org/', 'text/turtle')

  return {
    ap,
    store,
  }
}

describe('exploreService', () => {
  it('builds linked SHACL field definitions from the RDF graph', () => {
    const { ap, store } = createLinkedExploreState()

    const dataset = buildExploreDataset(store, ap.allNodeShapes())
    const buildingClass = dataset.classes.find(entry => entry.classIri === 'http://example.org/Building')

    expect(dataset.classes.length).toBeGreaterThan(0)
    expect(buildingClass).toBeTruthy()
    expect(buildingClass?.subjectCount).toBe(2)
    expect(buildingClass?.fields.some(field => field.label === 'Located In / Place Name')).toBe(true)
    expect(buildingClass?.fields.some(field => field.label === 'Located In / Country / Country Name')).toBe(true)
  })

  it('materializes a linked dataframe and scatter chart configuration', () => {
    const { ap, store } = createLinkedExploreState()
    const dataset = buildExploreDataset(store, ap.allNodeShapes())
    const targetClass = dataset.classes.find(entry => entry.classIri === 'http://example.org/Building')

    expect(targetClass).toBeTruthy()

    const dataframeModel = buildExploreDataframeModel(store, ap.allNodeShapes(), {
      id: 'df-1',
      title: 'Buildings and geography',
      rootClassIri: targetClass!.classIri,
      columns: [
        {
          id: targetClass!.fields.find(field => field.label === 'Building Name')!.id,
          label: 'Building Name',
          path: targetClass!.fields.find(field => field.label === 'Building Name')!.path,
        },
        {
          id: targetClass!.fields.find(field => field.label === 'Height')!.id,
          label: 'Height',
          path: targetClass!.fields.find(field => field.label === 'Height')!.path,
        },
        {
          id: targetClass!.fields.find(field => field.label === 'Area')!.id,
          label: 'Area',
          path: targetClass!.fields.find(field => field.label === 'Area')!.path,
        },
        {
          id: targetClass!.fields.find(field => field.label === 'Located In / Place Name')!.id,
          label: 'Located In / Place Name',
          path: targetClass!.fields.find(field => field.label === 'Located In / Place Name')!.path,
        },
        {
          id: targetClass!.fields.find(field => field.label === 'Located In / Country / Country Name')!.id,
          label: 'Located In / Country / Country Name',
          path: targetClass!.fields.find(field => field.label === 'Located In / Country / Country Name')!.path,
        },
      ],
    })

    expect(dataframeModel).toBeTruthy()
    expect(dataframeModel?.rows).toHaveLength(2)
    expect(dataframeModel?.rows[0]?.values[targetClass!.fields.find(field => field.label === 'Located In / Place Name')!.id]).toBeTruthy()

    const option = buildExploreChartPreviewOption({
      id: 'preview',
      title: 'Preview',
      chartType: 'scatter',
      dataframeId: 'df-1',
      fieldMapping: {
        x: targetClass!.fields.find(field => field.label === 'Height')!.id,
        y: targetClass!.fields.find(field => field.label === 'Area')!.id,
        color: targetClass!.fields.find(field => field.label === 'Located In / Country / Country Name')!.id,
        size: targetClass!.fields.find(field => field.label === 'Area')!.id,
        label: targetClass!.fields.find(field => field.label === 'Building Name')!.id,
        medianLineBasis: 'y',
      },
    }, dataframeModel!)

    expect(option).toBeTruthy()
    expect(option?.series).toBeTruthy()
    expect(JSON.stringify(option?.series)).toContain('scatter')
  })
})