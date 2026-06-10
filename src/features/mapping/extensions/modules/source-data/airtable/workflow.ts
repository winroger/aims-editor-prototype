import { createRemoteTabularSource, type DataSource, type DataSourceColumn } from '@/domain/DataSource'
import type { useDataStore } from '@/stores/dataStore'
import {
  AirtableService,
  airtableFieldToDataSourceColumn,
} from '@/features/mapping/extensions/modules/source-data/airtable/client'

type DataStore = ReturnType<typeof useDataStore>

export const AIRTABLE_PROVIDER_ID = 'airtable'

export function airtableSourceId(baseId: string, tableId: string): string {
  return `${AIRTABLE_PROVIDER_ID}:${baseId}:${tableId}`
}

export function createAirtableDataSource(options: {
  baseId: string
  tableId: string
  tableName: string
  headers: string[]
  rows: unknown[][]
  recordIds: string[]
  columns?: DataSourceColumn[]
  primaryFieldName?: string
}): DataSource {
  return createRemoteTabularSource({
    id: airtableSourceId(options.baseId, options.tableId),
    name: options.tableName,
    provider: AIRTABLE_PROVIDER_ID,
    externalRef: {
      baseId: options.baseId,
      tableId: options.tableId,
      ...(options.primaryFieldName ? { primaryFieldName: options.primaryFieldName } : {}),
    },
    headers: options.headers,
    rows: options.rows,
    columns: options.columns,
    recordIds: options.recordIds,
  })
}

export function isAirtableSource(source: DataSource): boolean {
  return source.origin.kind === 'remote-table' && source.origin.provider === AIRTABLE_PROVIDER_ID
}

export function airtableBaseId(source: DataSource): string | undefined {
  return isAirtableSource(source) && source.origin.kind === 'remote-table'
    ? source.origin.externalRef.baseId
    : undefined
}

export function airtableTableId(source: DataSource): string | undefined {
  return isAirtableSource(source) && source.origin.kind === 'remote-table'
    ? source.origin.externalRef.tableId
    : undefined
}

export function airtablePrimaryFieldName(source: DataSource): string | undefined {
  return isAirtableSource(source) && source.origin.kind === 'remote-table'
    ? source.origin.externalRef.primaryFieldName
    : undefined
}

export function listAirtableBases(sources: DataSource[]): string[] {
  return Array.from(new Set(
    sources
      .map(airtableBaseId)
      .filter((baseId): baseId is string => Boolean(baseId)),
  ))
}

export function getAirtableTablesForBase(sources: DataSource[], baseId: string): DataSource[] {
  return sources.filter(source => airtableBaseId(source) === baseId)
}

export async function refreshAirtableBase(dataStore: DataStore, pat: string, baseId: string): Promise<number> {
  const tables = getAirtableTablesForBase(dataStore.sources, baseId)
  if (tables.length === 0) return 0

  const svc = new AirtableService(pat, baseId)
  const metadataTables = await svc.listTables().catch(() => [])
  const metadataTableById = new Map(metadataTables.map(table => [table.id, table] as const))
  const fieldOrderByTableId = new Map(
    metadataTables.map(table => [table.id, table.fields?.map(field => field.name) ?? []] as const),
  )

  for (const table of tables) {
    const tableId = airtableTableId(table)
    if (!tableId) continue
    const records = await svc.fetchTableRecords(tableId)
    const fieldOrder = fieldOrderByTableId.get(tableId) ?? table.headers
    const metadataTable = metadataTableById.get(tableId)
    const primaryFieldName = metadataTable?.fields?.find(field => field.id === metadataTable.primaryFieldId)?.name
    const columns = metadataTable?.fields?.map(airtableFieldToDataSourceColumn)
    const { headers, rows, recordIds } = AirtableService.recordsToTable(records, fieldOrder)
    dataStore.upsertSource(createAirtableDataSource({
      baseId,
      tableId,
      tableName: table.name,
      headers,
      rows,
      recordIds,
      columns,
      primaryFieldName,
    }))
  }

  return tables.length
}


