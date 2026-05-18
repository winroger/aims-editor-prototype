import localforage from 'localforage'
import { ApplicationProfile, parseShaclProfile, type ShaclProfile } from '@/domain/NodeShape'
import { findEmbeddedTurtle } from '@/services/infrastructure/imports/embeddedProfiles'

const CACHE_NAME = 'architectural-rdm-pipeline-v1'
const LEGACY_CACHE_NAME = 'csv-rdf-mapper-v2'

const cache = localforage.createInstance({
  name: CACHE_NAME,
  storeName: 'profile-cache',
})

const legacyCache = localforage.createInstance({
  name: LEGACY_CACHE_NAME,
  storeName: 'profile-cache',
})

interface CachedProfile {
  ttl: string
  fetchedAt: string
}

const MAX_DEPTH = 8

export interface ResolveResult {
  added: string[]
  errors: { iri: string; error: string }[]
}

export async function resolveImportsRecursive(ap: ApplicationProfile): Promise<ResolveResult> {
  const added: string[] = []
  const errors: { iri: string; error: string }[] = []

  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    const missing = collectMissingImports(ap)
    if (missing.length === 0) break

    const fetched = await Promise.allSettled(missing.map(iri => fetchProfile(iri)))
    let progressed = false
    fetched.forEach((res, idx) => {
      const iri = missing[idx]
      if (res.status === 'fulfilled') {
        ap.upsert(res.value)
        added.push(iri)
        progressed = true
      } else {
        const reason = res.reason instanceof Error ? res.reason.message : String(res.reason)
        errors.push({ iri, error: reason })
      }
    })
    if (!progressed) break
  }

  return { added, errors }
}

function collectMissingImports(ap: ApplicationProfile): string[] {
  const loaded = new Set(ap.list().map(p => p.iri))
  const wanted = new Set<string>()
  for (const profile of ap.list()) {
    for (const imp of profile.imports) {
      if (!loaded.has(imp) && isResolvable(imp)) wanted.add(imp)
    }
  }
  return Array.from(wanted)
}

function isResolvable(iri: string): boolean {
  if (findEmbeddedTurtle(iri)) return true
  return iri.startsWith('https://w3id.org/') || iri.startsWith('https://') || iri.startsWith('http://')
}

async function fetchProfile(iri: string): Promise<ShaclProfile> {
  const embedded = findEmbeddedTurtle(iri)
  if (embedded) {
    return parseShaclProfile(embedded, iri, 'embedded', iri)
  }

  const cached = await cache.getItem<CachedProfile>(iri)
  if (cached) {
    return parseShaclProfile(cached.ttl, iri, 'fetched', iri)
  }

  const legacyCached = await legacyCache.getItem<CachedProfile>(iri)
  if (legacyCached) {
    await cache.setItem<CachedProfile>(iri, legacyCached)
    return parseShaclProfile(legacyCached.ttl, iri, 'fetched', iri)
  }

  const response = await fetch(iri, {
    headers: { Accept: 'text/turtle, application/x-turtle, */*' },
    redirect: 'follow',
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`)
  }
  const ttl = await response.text()

  await cache.setItem<CachedProfile>(iri, { ttl, fetchedAt: new Date().toISOString() })
  return parseShaclProfile(ttl, iri, 'fetched', iri)
}

export async function clearProfileCache(): Promise<void> {
  await Promise.all([cache.clear(), legacyCache.clear()])
}
