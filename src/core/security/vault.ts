import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export interface VaultOptions {
  vaultPath?: string
  masterKey?: string
}

export interface StoredSecret {
  id: string
  value: string
}

const DEFAULT_VAULT_NAME = '.forgezip.vault'

function deriveKey(masterKey: string) {
  return crypto.createHash('sha256').update(masterKey).digest()
}

function defaultMasterKey() {
  return process.env.FORGEZIP_MASTER_KEY ?? 'forgezip-local-dev-key'
}

function serializePayload(payload: StoredSecret[], key: Buffer) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const plaintext = JSON.stringify(payload)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

function deserializePayload(encoded: string, key: Buffer): StoredSecret[] {
  const buffer = Buffer.from(encoded, 'base64')
  const iv = buffer.subarray(0, 12)
  const tag = buffer.subarray(12, 28)
  const encrypted = buffer.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  return JSON.parse(decrypted)
}

export class SecretVault {
  private vaultPath: string
  private key: Buffer

  constructor(options: VaultOptions = {}) {
    this.vaultPath = options.vaultPath ?? path.join(process.cwd(), DEFAULT_VAULT_NAME)
    this.key = deriveKey(options.masterKey ?? defaultMasterKey())
  }

  loadAll(): StoredSecret[] {
    if (!fs.existsSync(this.vaultPath)) return []
    const encoded = fs.readFileSync(this.vaultPath, 'utf8')
    try {
      return deserializePayload(encoded, this.key)
    } catch (error) {
      throw new Error(`Failed to read vault: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  storeSecret(secret: StoredSecret, remember: boolean) {
    if (!remember) {
      return
    }

    const secrets = this.loadAll()
    const filtered = secrets.filter((entry) => entry.id !== secret.id)
    filtered.push(secret)
    const encoded = serializePayload(filtered, this.key)
    fs.writeFileSync(this.vaultPath, encoded, 'utf8')
  }

  getSecret(id: string) {
    return this.loadAll().find((entry) => entry.id === id)
  }
}
