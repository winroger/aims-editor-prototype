import { downloadBlob } from '@/services/export/exportService'
import {
  parseProjectSnapshotJson,
  serializeProjectSnapshot,
  type ProjectSnapshot,
} from '@/services/project/projectSnapshot'

function sanitizeProjectFileNameSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function buildProjectSnapshotFilename(projectTitle: string): string {
  const safeTitle = sanitizeProjectFileNameSegment(projectTitle)
  return `${safeTitle || 'untitled-dataset'}.ardmp.json`
}

export function createProjectSnapshotBlob(snapshot: ProjectSnapshot): Blob {
  return new Blob([serializeProjectSnapshot(snapshot)], { type: 'application/json' })
}

export function downloadProjectSnapshot(snapshot: ProjectSnapshot): string {
  const filename = buildProjectSnapshotFilename(snapshot.project.title)
  downloadBlob(createProjectSnapshotBlob(snapshot), filename)
  return filename
}

export async function readProjectSnapshotFile(file: File): Promise<ProjectSnapshot> {
  const text = await file.text()
  return parseProjectSnapshotJson(text)
}