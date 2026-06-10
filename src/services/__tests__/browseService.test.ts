import { describe, expect, it } from 'vitest'
import { ApplicationProfile, parseShaclProfile } from '@/domain/NodeShape'
import { MappingState } from '@/domain/Mapping'
import { getEmbeddedExampleProjectSnapshot } from '@/services/project/loadEmbeddedExampleProject'
import { generateRdf } from '@/services/rdf/rdfGenerator'
import { buildBrowseModel } from '@/services/browse/browseService'
import { createAirtableDataSource } from '@/features/mapping/extensions/modules/source-data/airtable/workflow'
import { createDataSourceSnapshots, restoreDataSourcesFromSnapshot } from '@/services/project/projectSnapshot'

describe('browseService', () => {
  it('uses gnd:preferredName as the building label in the minimal showcase example', () => {
    const snapshot = getEmbeddedExampleProjectSnapshot()
    const ap = new ApplicationProfile()
    for (const profile of snapshot.shapeProfiles) {
      ap.upsert(parseShaclProfile(profile.rawTurtle, profile.source, 'embedded', profile.iri))
    }

    const mapping = new MappingState()
    for (const edge of snapshot.mapping.edges) {
      mapping.addOrReplace(edge)
    }

    const generated = generateRdf(ap, mapping, restoreDataSourcesFromSnapshot(snapshot.sources))
    const model = buildBrowseModel(generated.store, ap.allNodeShapes())
    const buildingGroup = model.groups.find(group => group.classIri === 'https://d-nb.info/standards/elementset/gnd#BuildingOrMemorial')

    expect(buildingGroup?.subjects.map(subject => subject.label)).toEqual(
      expect.arrayContaining(['Harbor House', 'Timber Hall']),
    )
  })

  it('uses the Airtable primary field as the browse label fallback for staging subjects', () => {
    const source = createAirtableDataSource({
      baseId: 'app123',
      tableId: 'tbl123',
      tableName: 'People',
      headers: ['Name', 'Role'],
      rows: [['Alice Example', 'PI']],
      recordIds: ['recqqg9hRlNLclOoE'],
      primaryFieldName: 'Name',
    })

    const generated = generateRdf(new ApplicationProfile(), new MappingState(), [source])
    const model = buildBrowseModel(generated.store, [], [source])
    const peopleGroup = model.groups.find(group => group.classIri === 'https://w3id.org/ardmp/staging/class/people')

    expect(peopleGroup?.subjects[0]?.iri).toBe('https://w3id.org/ardmp/staging/instance/recqqg9hRlNLclOoE')
    expect(peopleGroup?.subjects[0]?.label).toBe('Alice Example')
  })

  it('preserves Airtable column datatypes through snapshot roundtrips', () => {
    const source = createAirtableDataSource({
      baseId: 'app123',
      tableId: 'tbl123',
      tableName: 'Metrics',
      headers: ['Count', 'Published', 'Approved'],
      rows: [[42, '2026-06-10', true]],
      columns: [
        { name: 'Count', datatype: 'number', nativeType: 'number' },
        { name: 'Published', datatype: 'date', nativeType: 'date' },
        { name: 'Approved', datatype: 'boolean', nativeType: 'checkbox' },
      ],
      recordIds: ['rec42'],
    })

    const [restored] = restoreDataSourcesFromSnapshot(createDataSourceSnapshots([source]))

    expect(restored?.columns).toEqual([
      { name: 'Count', datatype: 'number', nativeType: 'number' },
      { name: 'Published', datatype: 'date', nativeType: 'date' },
      { name: 'Approved', datatype: 'boolean', nativeType: 'checkbox' },
    ])
  })
})
