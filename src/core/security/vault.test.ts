import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { SecretVault } from './vault'

describe('SecretVault', () => {
  let tempDir: string
  let vaultPath: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgezip-vault-'))
    vaultPath = path.join(tempDir, '.forgezip.vault')
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('skips persistence when remember flag is disabled', () => {
    const vault = new SecretVault({ vaultPath, masterKey: 'integration-key' })

    vault.storeSecret({ id: 'cloud', value: 'token-123' }, false)

    expect(fs.existsSync(vaultPath)).toBe(false)
    expect(vault.getSecret('cloud')).toBeUndefined()
  })

  it('encrypts and restores secrets when persistence is allowed', () => {
    const vault = new SecretVault({ vaultPath, masterKey: 'integration-key' })

    vault.storeSecret({ id: 'cloud', value: 'token-123' }, true)

    expect(fs.existsSync(vaultPath)).toBe(true)
    expect(vault.getSecret('cloud')?.value).toBe('token-123')

    const rehydrated = new SecretVault({ vaultPath, masterKey: 'integration-key' })
    expect(rehydrated.getSecret('cloud')?.value).toBe('token-123')
  })

  it('rejects reads with the wrong master key', () => {
    const vault = new SecretVault({ vaultPath, masterKey: 'integration-key' })
    vault.storeSecret({ id: 'cloud', value: 'token-123' }, true)

    const tamperedVault = new SecretVault({ vaultPath, masterKey: 'wrong-key' })
    expect(() => tamperedVault.loadAll()).toThrow(/Failed to read vault/)
  })
})
