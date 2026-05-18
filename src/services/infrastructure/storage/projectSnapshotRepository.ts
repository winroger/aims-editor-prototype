import type { ProjectSnapshot } from '@/services/project/projectSnapshot'

export interface ProjectSnapshotRepository {
  loadSnapshot(): Promise<ProjectSnapshot | null>
  saveSnapshot(snapshot: ProjectSnapshot): Promise<void>
  clearSnapshot?(): Promise<void>
}