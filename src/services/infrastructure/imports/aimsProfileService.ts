const AIMS_API = 'https://pg4aims.ulb.tu-darmstadt.de/AIMS/application-profiles'

export interface AimsProfile {
  name: string
  base_url: string
  description?: string
  creator?: string
  state?: string | number
  created?: string
  mimeType?: string
}

function matchesTargetProfiles(name: string | undefined): boolean {
  const value = name?.toLowerCase() ?? ''
  return value.includes('ro-kit') || value.includes('ro-crate')
}

export async function loadAimsProfiles(): Promise<AimsProfile[]> {
  const url = new URL(AIMS_API)
  url.searchParams.set('query', 'ro-kit')
  url.searchParams.set('state', 'public')
  url.searchParams.set('includeDefinition', 'false')

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`AIMS profile search failed: ${response.status}`)
  }

  const data = await response.json()
  const profiles: AimsProfile[] = Array.isArray(data)
    ? data
    : Array.isArray(data.value)
      ? data.value
      : []

  return profiles
    .filter(profile => matchesTargetProfiles(profile.name))
    .sort((left, right) => left.name.localeCompare(right.name))
}

export async function fetchAimsProfileTurtle(profile: AimsProfile): Promise<string> {
  const response = await fetch(profile.base_url, {
    headers: {
      Accept: 'text/turtle, application/x-turtle, text/plain, */*',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`AIMS profile load failed: ${response.status}`)
  }

  return await response.text()
}