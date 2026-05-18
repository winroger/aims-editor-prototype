import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

vi.stubGlobal('fetch', fetchMock)

vi.mock('localforage', () => {
  const stores = new Map<string, Map<string, unknown>>()
  return {
    default: {
      createInstance: ({ storeName }: { storeName: string }) => {
        const store = stores.get(storeName) ?? new Map<string, unknown>()
        stores.set(storeName, store)
        return {
          async getItem<T>(key: string): Promise<T | null> { return (store.get(key) as T | undefined) ?? null },
          async setItem<T>(key: string, value: T): Promise<T> { store.set(key, value); return value },
          async clear(): Promise<void> { store.clear() },
        }
      },
    },
  }
})

import {
  clearLobidCache,
  fetchLobidBatch,
  fetchLobidPropertyProposals,
  normalizeLobidExtendRows,
} from '@/services/infrastructure/integrations/lobidService'

describe('lobidService', () => {
  beforeEach(async () => {
    fetchMock.mockReset()
    await clearLobidCache()
  })

  it('loads property proposals for Work', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        type: 'Work',
        properties: [
          { id: 'preferredName', name: 'Preferred name' },
          { id: 'firstAuthor', name: 'First author' },
        ],
      }),
    })

    const properties = await fetchLobidPropertyProposals('Work')

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/properties?type=Work')
    expect(properties).toEqual([
      { id: 'preferredName', name: 'Preferred name' },
      { id: 'firstAuthor', name: 'First author' },
    ])
  })

  it('normalizes extend rows into flat string values', () => {
    expect(normalizeLobidExtendRows({
      '1081942517': {
        preferredName: [{ str: 'Faust' }],
        firstAuthor: [{ id: '118540238', name: 'Goethe, Johann Wolfgang von' }],
      },
    }, ['1081942517'], ['preferredName', 'firstAuthor'])).toEqual({
      '1081942517': {
        preferredName: 'Faust',
        firstAuthor: 'Goethe, Johann Wolfgang von',
      },
    })
  })

  it('uses the batch extend endpoint and reuses cached responses', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        rows: {
          '1081942517': {
            preferredName: [{ str: 'Faust' }],
            firstAuthor: [{ name: 'Goethe, Johann Wolfgang von' }],
          },
        },
      }),
    })

    const first = await fetchLobidBatch(['1081942517'], ['preferredName', 'firstAuthor'])
    const second = await fetchLobidBatch(['1081942517'], ['preferredName', 'firstAuthor'])

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('extend=')
    expect(first.cachedCount).toBe(0)
    expect(second.cachedCount).toBe(1)
    expect(second.results['1081942517']).toEqual({
      preferredName: 'Faust',
      firstAuthor: 'Goethe, Johann Wolfgang von',
    })
  })
})