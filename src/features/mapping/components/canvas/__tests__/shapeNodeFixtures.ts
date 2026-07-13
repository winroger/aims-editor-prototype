export const ARDMP_TIMBER_BUILDING_TTL = `
@prefix dbo: <http://dbpedia.org/ontology/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix gndo: <https://d-nb.info/standards/elementset/gnd#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix aps: <https://w3id.org/nfdi4ing/profiles/> .

aps:2e6d9d8f-46e4-4d8a-9a6e-c76f4e2752c4
  dcterms:created "2026-06-09"^^xsd:date ;
  dcterms:creator "Roger Winkler" ;
  dcterms:description "ARDMP building shape extended with timber-specific area and timber volume fields."@en ;
  dcterms:license <http://creativecommons.org/licenses/by/4.0/> ;
  dcterms:subject <https://github.com/tibonto/dfgfo/410-01> ;
  dcterms:title "ARDMP timber building"@en ;
  a sh:NodeShape ;
  rdfs:label "ARDMP timber building"@en ;
  owl:imports aps:1f6323a9-b59b-4fb0-9f0f-63fd8ef9594a ;
  sh:closed false ;
  sh:node aps:1f6323a9-b59b-4fb0-9f0f-63fd8ef9594a ;
  sh:property [
    sh:order 7 ;
    sh:name "Area" ;
    sh:path dbo:floorArea ;
    sh:datatype xsd:decimal ;
    sh:maxCount 1 ;
  ], [
    sh:order 8 ;
    sh:name "Timber volume" ;
    sh:path dbo:timberVolume ;
    sh:datatype xsd:decimal ;
    sh:maxCount 1 ;
  ], [
    sh:order 9 ;
    sh:name "Material Type" ;
    sh:path dbo:Material ;
    sh:datatype xsd:string ;
    sh:maxCount 1 ;
  ] ;
  sh:targetClass gndo:BuildingOrMemorial .
`

export const ARDMP_BUILDING_TTL = `
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix gndo: <https://d-nb.info/standards/elementset/gnd#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix powder: <http://www.w3.org/2007/05/powder-s#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix aps: <https://w3id.org/nfdi4ing/profiles/> .
@prefix schema: <http://schema.org/> .

aps:1f6323a9-b59b-4fb0-9f0f-63fd8ef9594a
  dcterms:created "2026-04-17"^^xsd:date ;
  dcterms:creator "Roger Winkler" ;
  dcterms:description "ARDMP building or memorial shape, abridged from EntityFacts for places."@en ;
  dcterms:license <http://creativecommons.org/licenses/by/4.0/> ;
  dcterms:subject <https://github.com/tibonto/dfgfo/410-01> ;
  dcterms:title "ARDMP building"@en ;
  a sh:NodeShape ;
  rdfs:label "ARDMP building"@en ;
  owl:imports aps:1cf39480-24ef-41db-a5b3-070601a05cc3, aps:cf30a8b0-e6e9-4349-9376-1552e1930d3d, aps:0bbadc41-420e-4ea3-8090-83625c76ee1d ;
  sh:closed false ;
  sh:property [
    sh:order 1 ;
    sh:name "Name" ;
    sh:path gndo:preferredName ;
    sh:nodeKind sh:Literal ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
  ], [
    sh:order 2 ;
    sh:name "Stakeholder" ;
    sh:path prov:qualifiedAttribution ;
    sh:nodeKind sh:IRI ;
    sh:node aps:0bbadc41-420e-4ea3-8090-83625c76ee1d ;
  ], [
    sh:order 3 ;
    sh:name "Date of production" ;
    sh:path gndo:dateOfProduction ;
    sh:maxCount 1 ;
    sh:datatype xsd:gYear ;
    rdfs:label "Single year" ;
  ], [
    sh:order 4 ;
    sh:name "Location" ;
    sh:path dcterms:spatial ;
    sh:nodeKind sh:BlankNodeOrIRI ;
    sh:node aps:1cf39480-24ef-41db-a5b3-070601a05cc3 ;
    sh:class dcterms:Location ;
    sh:maxCount 1 ;
  ], [
    sh:order 5 ;
    sh:name "Source" ;
    sh:path powder:describedby ;
    sh:nodeKind sh:BlankNodeOrIRI ;
    sh:node aps:cf30a8b0-e6e9-4349-9376-1552e1930d3d ;
  ], [
    sh:order 6 ;
    sh:name "Thumbnail Image" ;
    sh:path schema:image ;
    sh:nodeKind sh:Literal ;
    sh:datatype xsd:anyURI ;
    sh:maxCount 1 ;
  ] ;
  sh:targetClass gndo:BuildingOrMemorial .
`

export const ARDMP_GEOLOCATION_TTL = `
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix aps: <https://w3id.org/nfdi4ing/profiles/> .

aps:1cf39480-24ef-41db-a5b3-070601a05cc3
  dcterms:title "ARDMP location"@en ;
  a sh:NodeShape ;
  rdfs:label "ARDMP location"@en ;
  sh:closed false ;
  sh:node aps:beeb6ea5-92df-417a-8447-9a4b0b187ed7 ;
  sh:property [
    sh:order 3 ;
    sh:name "GeoNames URI" ;
    sh:path dcterms:identifier ;
    sh:nodeKind sh:IRI ;
    sh:maxCount 1 ;
  ], [
    sh:order 4 ;
    sh:name "GeoNames ID" ;
    sh:path aps:geonamesId ;
    sh:datatype xsd:string ;
    sh:maxCount 1 ;
  ], [
    sh:order 5 ;
    sh:name "Place label" ;
    sh:path rdfs:label ;
    sh:nodeKind sh:Literal ;
    sh:maxCount 1 ;
  ] ;
  sh:targetClass dcterms:Location .
`

export const ARDMP_RESOURCE_TTL = `
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix schema: <http://schema.org/> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix aps: <https://w3id.org/nfdi4ing/profiles/> .

aps:cf30a8b0-e6e9-4349-9376-1552e1930d3d
  dcterms:title "ARDMP source"@en ;
  a sh:NodeShape ;
  rdfs:label "ARDMP source"@en ;
  sh:closed false ;
  sh:property [
    sh:order 1 ;
    sh:name "Name" ;
    sh:path schema:name ;
    sh:nodeKind sh:Literal ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
  ], [
    sh:order 2 ;
    sh:name "URL" ;
    sh:path schema:url ;
    sh:datatype xsd:anyURI ;
    sh:maxCount 1 ;
  ], [
    sh:order 3 ;
    sh:name "Type" ;
    sh:path schema:additionalType ;
    sh:nodeKind sh:Literal ;
    sh:maxCount 1 ;
  ], [
    sh:order 4 ;
    sh:name "Date visited" ;
    sh:path schema:lastReviewed ;
    sh:datatype xsd:date ;
    sh:maxCount 1 ;
  ] ;
  sh:targetClass rdfs:Resource .
`

export const ARDMP_STAKEHOLDER_TTL = `
@prefix dcat: <http://www.w3.org/ns/dcat#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix aps: <https://w3id.org/nfdi4ing/profiles/> .

aps:0bbadc41-420e-4ea3-8090-83625c76ee1d
  dcterms:title "ARDMP stakeholder"@en ;
  a sh:NodeShape ;
  rdfs:label "ARDMP stakeholder"@en ;
  sh:closed false ;
  sh:property [
    sh:order 1 ;
    sh:name "Label" ;
    sh:path rdfs:label ;
  ], [
    sh:order 2 ;
    sh:name "Role" ;
    sh:path dcat:hadRole ;
    sh:nodeKind sh:Literal ;
    sh:minCount 1 ;
  ], [
    sh:order 3 ;
    sh:name "Organization" ;
    sh:path prov:agent ;
    sh:nodeKind sh:IRI ;
    sh:node aps:9d3337fe-0375-485f-9b37-2782f53df7f8 ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
  ] ;
  sh:targetClass prov:Attribution .
`

export const ARDMP_ORGANIZATION_TTL = `
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix schema: <http://schema.org/> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix aps: <https://w3id.org/nfdi4ing/profiles/> .

aps:9d3337fe-0375-485f-9b37-2782f53df7f8
  dcterms:title "ARDMP organization"@en ;
  a sh:NodeShape ;
  rdfs:label "ARDMP organization"@en ;
  sh:closed false ;
  sh:property [
    sh:order 1 ;
    sh:name "Name" ;
    sh:path schema:name ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
  ], [
    sh:order 2 ;
    sh:name "URL" ;
    sh:path schema:url ;
    sh:datatype xsd:anyURI ;
    sh:maxCount 1 ;
  ] ;
  sh:targetClass schema:Organization .
`