import { describe, expect, it } from 'vitest'
import { CsvDataSource, AirtableDataSource } from '@/domain/DataSource'
import { detectLinkedColumns, detectJoinTables, looksLikeRecordIds } from '@/services/mapping/linkDetector'

describe('linkDetector', () => {
  it('looksLikeRecordIds matches Airtable IDs', () => {
    expect(looksLikeRecordIds('recABCDEFGHIJ12345')).toBe(true)
    expect(looksLikeRecordIds(['recAAAAAAAAAAA111', 'recBBBBBBBBBBB222'])).toBe(true)
    expect(looksLikeRecordIds('recABCDEFGHIJ12345,recXYZ123456789012')).toBe(true)
    expect(looksLikeRecordIds('plain text')).toBe(false)
    expect(looksLikeRecordIds('')).toBe(false)
    expect(looksLikeRecordIds(null)).toBe(false)
  })

  it('detects linked-record columns and resolves target source by recID overlap', () => {
    const stakeholders = new AirtableDataSource('stakeholders', 'Stakeholders',
      ['Name', 'Website'],
      [['Acton Ostry', 'https://example.com']],
      ['recqqg9hRlNLclOoE'],
    )
    const buildings = new AirtableDataSource('buildings', 'Buildings',
      ['Project Name', 'Buildings_Stakeholder_Roles'],
      [['Brock Commons', ['recqqg9hRlNLclOoE']]],
      ['recBLD001AAAAAAA'],
    )

    const detected = detectLinkedColumns(buildings, [stakeholders, buildings])
    expect(detected).toHaveLength(1)
    expect(detected[0].header).toBe('Buildings_Stakeholder_Roles')
    expect(detected[0].bestTargetSourceId).toBe('stakeholders')
    expect(detected[0].recordIdConfidence).toBe(1)
  })

  it('does not flag plain text columns', () => {
    const buildings = new AirtableDataSource('buildings', 'Buildings',
      ['Project Name', 'Country'],
      [['Brock Commons', 'Canada']],
      ['recBLD001AAAAAAA'],
    )
    const detected = detectLinkedColumns(buildings, [buildings])
    expect(detected).toHaveLength(0)
  })

  it('detects a classic join table (m:n with attribute)', () => {
    const buildings = new AirtableDataSource('buildings', 'Buildings',
      ['Project Name'], [['Brock']],
      ['recBLD001AAAAAAAA'],
    )
    const stakeholders = new AirtableDataSource('stakeholders', 'Stakeholders',
      ['Name'], [['Acton Ostry']],
      ['recSTK001BBBBBBBB'],
    )
    const join = new AirtableDataSource('roles', 'Buildings_Stakeholder_Roles',
      ['Building', 'Stakeholder', 'Role'],
      [['recBLD001AAAAAAAA', 'recSTK001BBBBBBBB', 'Architect']],
      ['recROL001CCCCCCCC'],
    )

    const joinTables = detectJoinTables([buildings, stakeholders, join])
    expect(joinTables).toHaveLength(1)
    expect(joinTables[0].sourceId).toBe('roles')
    expect(joinTables[0].fkColumns).toHaveLength(2)
    expect(joinTables[0].attributeColumns).toContain('Role')
  })

  it('handles plain CSV without record IDs gracefully', () => {
    const csv = new CsvDataSource('plain', 'plain.csv', ['name', 'age'], [['Alice', '30']])
    const detected = detectLinkedColumns(csv, [csv])
    expect(detected).toHaveLength(0)
    expect(detectJoinTables([csv])).toHaveLength(0)
  })
})
