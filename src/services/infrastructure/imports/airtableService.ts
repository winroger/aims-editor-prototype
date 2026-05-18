/**
 * AirtableService
 *
 * Browser-safe Airtable client built on the native `fetch` API.
 * Uses the Airtable REST API (v0) and the Metadata API to list tables.
 *
 * NOTE: Credentials should be stored via the `credentialStore` (Web Crypto
 * encrypted IndexedDB), not in plain localStorage.
 */

const API_BASE = 'https://api.airtable.com'

export interface AirtableTable {
  id: string
  name: string
  primaryFieldId?: string
  fields?: { id: string; name: string; type: string }[]
}

export interface AirtableRecord {
  id: string
  fields: Record<string, unknown>
}

export class AirtableService {
  constructor(private readonly pat: string, private readonly baseId: string) {}

  private async request<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${this.pat}`,
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new Error(`Airtable API error ${res.status}: ${text}`)
    }
    return res.json() as Promise<T>
  }

  async listTables(): Promise<AirtableTable[]> {
    const data = await this.request<{ tables: AirtableTable[] }>(
      `/v0/meta/bases/${this.baseId}/tables`,
    )
    return data.tables
  }

  async fetchTableRecords(tableIdOrName: string): Promise<AirtableRecord[]> {
    const all: AirtableRecord[] = []
    let offset: string | undefined
    do {
      const query = offset ? `?offset=${encodeURIComponent(offset)}` : ''
      const page = await this.request<{ records: AirtableRecord[]; offset?: string }>(
        `/v0/${this.baseId}/${encodeURIComponent(tableIdOrName)}${query}`,
      )
      all.push(...page.records)
      offset = page.offset
      if (offset) await new Promise(r => setTimeout(r, 250))
    } while (offset)
    return all
  }

  static recordsToTable(records: AirtableRecord[], fieldOrder: string[] = []): {
    headers: string[]
    rows: unknown[][]
    recordIds: string[]
  } {
    const headerSet = new Set<string>(fieldOrder)
    for (const r of records) {
      for (const k of Object.keys(r.fields)) headerSet.add(k)
    }
    const headers = Array.from(headerSet)
    const rows = records.map(r => headers.map(h => r.fields[h] ?? null))
    const recordIds = records.map(r => r.id)
    return { headers, rows, recordIds }
  }
}
