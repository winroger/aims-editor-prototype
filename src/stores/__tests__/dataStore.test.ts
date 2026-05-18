import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDataStore } from '@/stores/dataStore'

describe('dataStore Airtable refresh', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('replaces an imported Airtable table in place using a stable source id', () => {
    const store = useDataStore()

    store.addAirtableTable('appBase', 'tblProjects', 'Projects', ['Name'], [['Alpha']], ['rec1'])
    store.addAirtableTable('appBase', 'tblProjects', 'Projects', ['Name', 'Status'], [['Alpha', 'Live']], ['rec1'])

    expect(store.sources).toHaveLength(1)
    expect(store.sources[0]?.id).toBe('airtable:appBase:tblProjects')
    expect(store.sources[0]?.headers).toEqual(['Name', 'Status'])
    expect(store.sources[0]?.rows).toEqual([['Alpha', 'Live']])
  })

  it('refreshes all imported Airtable tables for one base without changing source ids', async () => {
    const store = useDataStore()
    store.addAirtableTable('appBase', 'tblProjects', 'Projects', ['Name'], [['Old']], ['recOld'])
    store.addAirtableTable('appBase', 'tblPeople', 'People', ['Name'], [['Old Person']], ['recPerson'])

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/meta/bases/appBase/tables')) {
        return {
          ok: true,
          json: async () => ({
            tables: [
              { id: 'tblProjects', name: 'Projects', fields: [{ id: 'fldStatus', name: 'Status', type: 'singleLineText' }, { id: 'fldName', name: 'Name', type: 'singleLineText' }] },
              { id: 'tblPeople', name: 'People', fields: [{ id: 'fldName', name: 'Name', type: 'singleLineText' }] },
            ],
          }),
        } as Response
      }

      if (url.includes('/tblProjects')) {
        return {
          ok: true,
          json: async () => ({ records: [{ id: 'recProject1', fields: { Name: 'New Project', Status: 'Live' } }] }),
        } as Response
      }

      if (url.includes('/tblPeople')) {
        return {
          ok: true,
          json: async () => ({ records: [{ id: 'recPerson1', fields: { Name: 'New Person' } }] }),
        } as Response
      }

      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Not Found',
      } as Response
    })

    const refreshed = await store.refreshAirtableBase('pat-test', 'appBase')

    expect(refreshed).toBe(2)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(store.sources.map(source => source.id)).toEqual([
      'airtable:appBase:tblProjects',
      'airtable:appBase:tblPeople',
    ])
    expect(store.sources[0]?.headers).toEqual(['Status', 'Name'])
    expect(store.sources[0]?.rows).toEqual([['Live', 'New Project']])
    expect(store.sources[1]?.rows).toEqual([['New Person']])
  })
})