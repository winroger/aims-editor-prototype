/**
 * exportService — bundles the current project state into an RO-Crate ZIP.
 * Extracted from the old ExportView so it can be triggered from a toolbar
 * button anywhere in the app.
 */
import JSZip from 'jszip'
import { generateRdf, serializeGraph } from '@/services/rdf/rdfGenerator'
import { exportedHeadersForSource, exportedRowsForSource } from '@/services/mapping/mappingSemantics'
import { buildRoCrateMetadata, type RoCrateFile } from '@/services/export/roCrate'
import { serializeMappingAsRml } from '@/services/export/rmlSerializer'
import { extractDatasetMetadata } from '@/services/export/datasetMetadata'
import { extractProfileMetadata } from '@/services/export/profileMetadata'
import type { ApplicationProfile, ShaclProfile } from '@/domain/NodeShape'
import type { DataSource } from '@/domain/DataSource'
import type { MappingState } from '@/domain/Mapping'

export interface ExportInput {
  projectTitle: string
  ap: ApplicationProfile
  profiles: ShaclProfile[]
  sources: DataSource[]
  mapping: MappingState
  /** Optional pre-rendered turtle from `<shacl-form>` web components. */
  metadataTurtle?: string
}

export interface ExportResult {
  filename: string
  subjectCount: number
  tripleCount: number
}

function cellToCsv(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  return /[\",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function sanitize(name: string): string {
  return name.replace(/[^a-z0-9-_]/gi, '_') || 'export'
}

function buildReadme(title: string, profiles: number, sources: number, mappings: number): string {
  return `# ${title}

This bundle is an [**RO-Crate 1.2**](https://w3id.org/ro/crate/1.2) packaged by
**Architectural RDM-Pipeline** on ${new Date().toISOString()}.

## Contents

- \`ro-crate-metadata.json\` — RO-Crate metadata descriptor (root)
- \`shapes/\` — ${profiles} SHACL profile(s) (\`text/turtle\`)
- \`sources/\` — ${sources} source table(s) (\`text/csv\`)
- \`data/dataset.ttl\` — generated RDF graph
- \`mapping/mapping.rml.ttl\` — RML mapping export
- \`mapping/mapping.json\` — internal mapping definition (${mappings} edge(s))
`
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function exportRoCrate(input: ExportInput): Promise<ExportResult> {
  const zip = new JSZip()
  const files: RoCrateFile[] = []

  // 1. Generated RDF
  const result = generateRdf(input.ap, input.mapping, input.sources)
  let ttl = await serializeGraph(result.store, 'text/turtle')

  // Append metadata-form turtle (from <shacl-form>) if present
  if (input.metadataTurtle && input.metadataTurtle.trim().length > 0) {
    ttl += '\n\n# ----- Dataset metadata (shacl-form) -----\n'
    ttl += input.metadataTurtle
  }

  zip.file('data/dataset.ttl', ttl)
  files.push({
    path: 'data/dataset.ttl',
    name: 'Generated RDF dataset',
    description: `Turtle serialisation produced from the mapping (${result.subjectCount} subjects, ${result.tripleCount} triples).`,
    encodingFormat: 'text/turtle',
  })

  // 2. SHACL profiles
  const profileSummaries = input.profiles.map(profile => ({
    profile,
    metadata: extractProfileMetadata(profile.rawTurtle, profile.iri),
  }))

  input.profiles.forEach((p, idx) => {
    const safeName = (p.iri.split(/[/#]/).filter(Boolean).pop() ?? `profile-${idx}`)
      .replace(/[^a-z0-9-_]/gi, '_')
    const path = `shapes/${safeName}.ttl`
    const profileMetadata = profileSummaries.find(summary => summary.profile.iri === p.iri)?.metadata
    zip.file(path, p.rawTurtle)
    files.push({
      path,
      name: profileMetadata?.title ?? `SHACL profile: ${p.iri}`,
      description: profileMetadata?.description,
      encodingFormat: 'text/turtle',
      conformsTo: 'https://www.w3.org/TR/shacl/',
    })
  })

  // 3. Source tables
  input.sources.forEach(src => {
    const path = `sources/${sanitize(src.name)}.csv`
    const csvRows = exportedRowsForSource(src)
    const csvHeaders = exportedHeadersForSource(src)
    const csv = [csvHeaders.join(','), ...csvRows.map(row => row.map(cellToCsv).join(','))].join('\n')
    zip.file(path, csv)
    files.push({
      path,
      name: src.name,
      description: `Source table (${src.kind}, ${src.rows.length} rows).${src.recordIds ? ' Includes exported Airtable record identifiers for subject templates.' : ''}`,
      encodingFormat: 'text/csv',
    })
  })

  // 4. RML mapping
  const rml = await serializeMappingAsRml(input.ap, input.mapping, input.sources)
  zip.file('mapping/mapping.rml.ttl', rml)
  files.push({
    path: 'mapping/mapping.rml.ttl',
    name: 'RML mapping',
    description: 'RML serialization of the current mapping, aligned with the exported source tables and SHACL-derived target shapes.',
    encodingFormat: 'text/turtle',
    conformsTo: 'https://rml.io/specs/rml/',
  })

  // 5. Internal mapping definition
  const mappingJson = JSON.stringify({
    project: { title: input.projectTitle, createdAt: new Date().toISOString() },
    edges: input.mapping.edges,
  }, null, 2)
  zip.file('mapping/mapping.json', mappingJson)
  files.push({
    path: 'mapping/mapping.json',
    name: 'Internal mapping definition',
    description: `${input.mapping.edges.length} mapping edge(s) connecting source columns to SHACL property paths for tool round-trip import.`,
    encodingFormat: 'application/json',
  })

  // 6. README
  zip.file('README.md', buildReadme(
    input.projectTitle,
    input.profiles.length,
    input.sources.length,
    input.mapping.edges.length,
  ))
  files.push({ path: 'README.md', name: 'Bundle README', encodingFormat: 'text/markdown' })

  // 7. RO-Crate metadata
  const derivedMetadata = extractDatasetMetadata(input.metadataTurtle ?? '')
  const profileDescriptions = profileSummaries
    .map(summary => summary.metadata.description)
    .filter((description): description is string => Boolean(description))
  const fallbackDescription = profileDescriptions.length > 0
    ? profileDescriptions.join(' | ')
    : `RDF dataset bundled by Architectural RDM-Pipeline from ${input.profiles.length} SHACL profile(s) and ${input.sources.length} source table(s).`
  const metadata = buildRoCrateMetadata({
    name: derivedMetadata.name ?? input.projectTitle,
    description: derivedMetadata.description ?? fallbackDescription,
    datePublished: derivedMetadata.datePublished ?? new Date().toISOString(),
    agents: derivedMetadata.agents,
    license: derivedMetadata.license,
    files,
  })
  zip.file('ro-crate-metadata.json', metadata)

  const blob = await zip.generateAsync({ type: 'blob' })
  // Use a UUID for the download filename — keeps the file name short and
  // free of special chars that would otherwise be stripped from the title.
  const uuid = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
  const filename = `${uuid}.zip`
  triggerDownload(blob, filename)

  return {
    filename,
    subjectCount: result.subjectCount,
    tripleCount: result.tripleCount,
  }
}
