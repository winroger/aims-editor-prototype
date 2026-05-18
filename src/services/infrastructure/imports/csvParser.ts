import Papa from 'papaparse'

export interface ParsedCsv {
  headers: string[]
  rows: unknown[][]
}

export function parseCsvFile(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<unknown[]>(file, {
      header: false,
      dynamicTyping: true,
      skipEmptyLines: true,
      delimiter: '',
      complete: (result) => {
        const data = result.data as unknown[][]
        if (data.length === 0) {
          resolve({ headers: [], rows: [] })
          return
        }
        const headers = (data[0] as unknown[]).map(h => String(h ?? '').trim())
        const rows = data.slice(1)
        resolve({ headers, rows })
      },
      error: (err: Error) => reject(err),
    })
  })
}
