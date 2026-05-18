import localforage from 'localforage'

const store = localforage.createInstance({
  name: 'csv-rdf-mapper-v2',
  storeName: 'credentials',
})

const KEY_RECORD = 'airtable'
const KEY_SALT = 'salt'

interface EncryptedRecord {
  iv: number[]
  ciphertext: number[]
}

interface AirtableCredentials {
  pat: string
  baseId: string
}

async function getOrCreateSalt(): Promise<Uint8Array> {
  const existing = await store.getItem<number[]>(KEY_SALT)
  if (existing) return new Uint8Array(existing)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  await store.setItem(KEY_SALT, Array.from(salt))
  return salt
}

async function deriveKey(salt: Uint8Array): Promise<CryptoKey> {
  const passphrase = `${navigator.userAgent}::csv-rdf-mapper-v2`
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function saveAirtableCredentials(creds: AirtableCredentials): Promise<void> {
  const salt = await getOrCreateSalt()
  const key = await deriveKey(salt)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = new TextEncoder().encode(JSON.stringify(creds))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    data,
  )
  const record: EncryptedRecord = {
    iv: Array.from(iv),
    ciphertext: Array.from(new Uint8Array(ciphertext)),
  }
  await store.setItem(KEY_RECORD, record)
}

export async function loadAirtableCredentials(): Promise<AirtableCredentials | null> {
  const record = await store.getItem<EncryptedRecord>(KEY_RECORD)
  if (!record) return null
  try {
    const salt = await getOrCreateSalt()
    const key = await deriveKey(salt)
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(record.iv).buffer as ArrayBuffer },
      key,
      new Uint8Array(record.ciphertext).buffer as ArrayBuffer,
    )
    return JSON.parse(new TextDecoder().decode(plain)) as AirtableCredentials
  } catch (err) {
    console.warn('Failed to decrypt stored Airtable credentials', err)
    return null
  }
}

export async function clearAirtableCredentials(): Promise<void> {
  await store.removeItem(KEY_RECORD)
}
