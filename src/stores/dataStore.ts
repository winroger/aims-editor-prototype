import { defineStore } from 'pinia'
import { ref } from 'vue'
import { CsvDataSource, AirtableDataSource, GeoNamesResultDataSource, LobidResultDataSource, type DataSource } from '@/domain/DataSource'
import { AirtableService } from '@/services/infrastructure/imports/airtableService'
import { parseCsvFile } from '@/services/infrastructure/imports/csvParser'
import {
  createDataSourceSnapshots,
  restoreDataSourcesFromSnapshot,
  type DataSourceSnapshot,
} from '@/services/project/projectSnapshot'

export const useDataStore = defineStore('data', () => {
  const sources = ref<DataSource[]>([])

  function airtableSourceId(baseId: string, tableId: string): string {
    return `airtable:${baseId}:${tableId}`
  }

  function replaceOrAppendSource(source: DataSource): void {
    const existingIdx = sources.value.findIndex(item => item.id === source.id)
    if (existingIdx >= 0) sources.value.splice(existingIdx, 1, source)
    else sources.value.push(source)
  }

  async function addCsvFiles(files: File[]): Promise<void> {
    for (const file of files) {
      try {
        const { headers, rows } = await parseCsvFile(file)
        sources.value.push(new CsvDataSource(file.name, file.name, headers, rows))
      } catch (e) {
        console.error('Failed to parse', file.name, e)
        throw e
      }
    }
  }

  function addAirtableTable(
    baseId: string,
    tableId: string,
    tableName: string,
    headers: string[],
    rows: unknown[][],
    recordIds: string[],
  ): void {
    replaceOrAppendSource(new AirtableDataSource(
      airtableSourceId(baseId, tableId),
      tableName,
      headers,
      rows,
      recordIds,
      { baseId, tableId },
    ))
  }

  function addGeoNamesResultSource(
    nodeId: string,
    headers: string[],
    rows: unknown[][],
    recordIds?: string[],
  ): string {
    const sourceId = `geonames-output:${nodeId}`
    replaceOrAppendSource(new GeoNamesResultDataSource(
      sourceId,
      `GeoNames ${nodeId}`,
      headers,
      rows,
      recordIds,
    ))
    return sourceId
  }

  function addLobidResultSource(
    nodeId: string,
    headers: string[],
    rows: unknown[][],
    recordIds?: string[],
  ): string {
    const sourceId = `lobid-output:${nodeId}`
    replaceOrAppendSource(new LobidResultDataSource(
      sourceId,
      `Lobid ${nodeId}`,
      headers,
      rows,
      recordIds,
    ))
    return sourceId
  }

  function listAirtableBases(): string[] {
    return Array.from(new Set(
      sources.value
        .filter((source): source is AirtableDataSource => source instanceof AirtableDataSource)
        .map(source => source.sync?.baseId)
        .filter((baseId): baseId is string => Boolean(baseId)),
    ))
  }

  function getAirtableTablesForBase(baseId: string): AirtableDataSource[] {
    return sources.value.filter((source): source is AirtableDataSource =>
      source instanceof AirtableDataSource && source.sync?.baseId === baseId,
    )
  }

  async function refreshAirtableBase(pat: string, baseId: string): Promise<number> {
    const tables = getAirtableTablesForBase(baseId)
    if (tables.length === 0) return 0

    const svc = new AirtableService(pat, baseId)
    const metadataTables = await svc.listTables().catch(() => [])
    const fieldOrderByTableId = new Map(
      metadataTables.map(table => [table.id, table.fields?.map(field => field.name) ?? []] as const),
    )

    for (const table of tables) {
      const tableId = table.sync?.tableId
      if (!tableId) continue
      const records = await svc.fetchTableRecords(tableId)
      const fieldOrder = fieldOrderByTableId.get(tableId) ?? table.headers
      const { headers, rows, recordIds } = AirtableService.recordsToTable(records, fieldOrder)
      addAirtableTable(baseId, tableId, table.name, headers, rows, recordIds)
    }

    return tables.length
  }

  function remove(id: string): void {
    sources.value = sources.value.filter(s => s.id !== id)
  }

  function findById(id: string): DataSource | undefined {
    return sources.value.find(s => s.id === id)
  }

  function createSnapshot(): DataSourceSnapshot[] {
    return createDataSourceSnapshots(sources.value)
  }

  function restoreSnapshot(snapshot: DataSourceSnapshot[]): void {
    sources.value = restoreDataSourcesFromSnapshot(snapshot)
  }

  function reset(): void {
    sources.value = []
  }

  return {
    sources,
    addCsvFiles,
    addAirtableTable,
    addGeoNamesResultSource,
    addLobidResultSource,
    listAirtableBases,
    getAirtableTablesForBase,
    refreshAirtableBase,
    remove,
    findById,
    createSnapshot,
    restoreSnapshot,
    reset,
  }
})
