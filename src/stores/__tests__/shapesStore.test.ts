import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { parseShaclProfile } from '@/domain/NodeShape'
import { useShapesStore } from '@/stores/shapesStore'

const DIRECT_METADATA_PROFILE = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix dcat: <http://www.w3.org/ns/dcat#> .
@prefix ex: <http://example.org/> .

ex:DatasetShape a sh:NodeShape ;
  sh:targetClass dcat:Dataset ;
  sh:property [
    sh:path ex:title ;
    sh:name "Title"
  ] .
`

const IMPORTED_METADATA_PROFILE = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix dcat: <http://www.w3.org/ns/dcat#> .
@prefix ex: <http://example.org/> .

ex:ImportedDatasetShape a sh:NodeShape ;
  sh:targetClass dcat:Dataset ;
  sh:property [
    sh:path ex:identifier ;
    sh:name "Identifier"
  ] .
`

describe('shapesStore canvasShapes', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('keeps a directly loaded dataset profile root visible on the canvas', async () => {
    const shapes = useShapesStore()

    await shapes.addProfileFromTurtle(
      DIRECT_METADATA_PROFILE,
      'DCAT Minimal Dataset.ttl',
      'http://example.org/profiles/dcat-minimal-dataset',
    )

    expect(shapes.canvasShapes.map(shape => shape.nodeId.value)).toContain('http://example.org/DatasetShape')
  })

  it('does not surface imported-only dataset form shapes on the canvas', () => {
    const shapes = useShapesStore()

    shapes.ap.upsert(parseShaclProfile(
      DIRECT_METADATA_PROFILE,
      'DCAT Minimal Dataset.ttl',
      'fetched',
      'http://example.org/profiles/dcat-minimal-dataset',
    ))
    shapes.ap.upsert(parseShaclProfile(
      IMPORTED_METADATA_PROFILE,
      'http://example.org/profiles/imported-dataset',
      'fetched',
      'http://example.org/profiles/imported-dataset',
    ))

    expect(shapes.canvasShapes.map(shape => shape.nodeId.value)).toContain('http://example.org/DatasetShape')
    expect(shapes.canvasShapes.map(shape => shape.nodeId.value)).not.toContain('http://example.org/ImportedDatasetShape')
  })
})