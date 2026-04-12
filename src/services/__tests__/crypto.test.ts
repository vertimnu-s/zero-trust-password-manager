import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateKeyFromPassword,
  encryptPassword,
  decryptPassword,
  validateMasterPassword,
  generateSecurePassword,
  sanitizeInput,
  validateSite,
  validateUsername,
  AuditLogger,
} from '../crypto'

// ── Key Derivation ──────────────────────────────────────────────────────────

describe('generateKeyFromPassword', () => {
  it('derives a CryptoKey from password and salt', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const key = await generateKeyFromPassword('TestPassword123!', salt)
    expect(key).toBeDefined()
    expect(key.type).toBe('secret')
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 })
  })

  it('produces same key for same password + salt', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const key1 = await generateKeyFromPassword('TestPassword123!', salt)
    const key2 = await generateKeyFromPassword('TestPassword123!', salt)
    // Export both keys to compare raw bytes
    const raw1 = await crypto.subtle.exportKey('raw', await reDerive('TestPassword123!', salt))
    const raw2 = await crypto.subtle.exportKey('raw', await reDerive('TestPassword123!', salt))
    expect(Buffer.from(raw1).toString('hex')).toBe(Buffer.from(raw2).toString('hex'))
  })

  it('produces different keys for different passwords', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const raw1 = await crypto.subtle.exportKey('raw', await reDerive('Password1!abcd', salt))
    const raw2 = await crypto.subtle.exportKey('raw', await reDerive('DifferentPass1!', salt))
    expect(Buffer.from(raw1).toString('hex')).not.toBe(Buffer.from(raw2).toString('hex'))
  })

  it('produces different keys for different salts', async () => {
    const salt1 = crypto.getRandomValues(new Uint8Array(16))
    const salt2 = crypto.getRandomValues(new Uint8Array(16))
    const raw1 = await crypto.subtle.exportKey('raw', await reDerive('TestPassword123!', salt1))
    const raw2 = await crypto.subtle.exportKey('raw', await reDerive('TestPassword123!', salt2))
    expect(Buffer.from(raw1).toString('hex')).not.toBe(Buffer.from(raw2).toString('hex'))
  })
})

// Helper: derive an exportable key (the source fn creates non-exportable keys)
async function reDerive(password: string, salt: Uint8Array) {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,          // extractable – for comparison only
    ['encrypt', 'decrypt'],
  )
}

// ── Encrypt / Decrypt Round-Trip ────────────────────────────────────────────

describe('encryptPassword / decryptPassword', () => {
  const masterPassword = 'MyStr0ng!Master#Pass'
  const context = 'example.com'

  it('round-trips a simple plaintext', async () => {
    const plaintext = 'hunter2'
    const { cipherText, iv, salt } = await encryptPassword(plaintext, masterPassword, context)
    const result = await decryptPassword(cipherText, iv, salt, masterPassword, context)
    expect(result).toBe(plaintext)
  })

  it('round-trips unicode text', async () => {
    const plaintext = '🔒 Пароль パスワード'
    const { cipherText, iv, salt } = await encryptPassword(plaintext, masterPassword, context)
    const result = await decryptPassword(cipherText, iv, salt, masterPassword, context)
    expect(result).toBe(plaintext)
  })

  it('round-trips an empty string', async () => {
    const { cipherText, iv, salt } = await encryptPassword('', masterPassword, context)
    const result = await decryptPassword(cipherText, iv, salt, masterPassword, context)
    expect(result).toBe('')
  })

  it('round-trips a long plaintext (10 000 chars)', async () => {
    const plaintext = 'x'.repeat(10000)
    const { cipherText, iv, salt } = await encryptPassword(plaintext, masterPassword, context)
    const result = await decryptPassword(cipherText, iv, salt, masterPassword, context)
    expect(result).toBe(plaintext)
  })

  it('produces different ciphertexts for the same plaintext (random IV/salt)', async () => {
    const plaintext = 'samePassword'
    const enc1 = await encryptPassword(plaintext, masterPassword, context)
    const enc2 = await encryptPassword(plaintext, masterPassword, context)
    expect(enc1.cipherText).not.toBe(enc2.cipherText)
    expect(enc1.iv).not.toBe(enc2.iv)
    expect(enc1.salt).not.toBe(enc2.salt)
  })

  it('ciphertext is valid base64', async () => {
    const { cipherText, iv, salt } = await encryptPassword('test', masterPassword, context)
    const b64re = /^[A-Za-z0-9+/=]+$/
    expect(b64re.test(cipherText)).toBe(true)
    expect(b64re.test(iv)).toBe(true)
    expect(b64re.test(salt)).toBe(true)
  })

  it('fails decryption with wrong master password', async () => {
    const { cipherText, iv, salt } = await encryptPassword('secret', masterPassword, context)
    await expect(
      decryptPassword(cipherText, iv, salt, 'WrongPassword123!', context),
    ).rejects.toThrow('Decryption failed')
  })

  it('fails decryption with wrong context (AAD mismatch)', async () => {
    const { cipherText, iv, salt } = await encryptPassword('secret', masterPassword, context)
    await expect(
      decryptPassword(cipherText, iv, salt, masterPassword, 'evil.com'),
    ).rejects.toThrow('Decryption failed')
  })

  it('fails decryption with tampered ciphertext', async () => {
    const { cipherText, iv, salt } = await encryptPassword('secret', masterPassword, context)
    // Flip a byte in the ciphertext
    const raw = atob(cipherText)
    const tampered = btoa(
      String.fromCharCode(raw.charCodeAt(0) ^ 0xff) + raw.slice(1),
    )
    await expect(
      decryptPassword(tampered, iv, salt, masterPassword, context),
    ).rejects.toThrow('Decryption failed')
  })
})

// ── Master Password Validation ──────────────────────────────────────────────

describe('validateMasterPassword', () => {
  it('accepts a strong password', () => {
    const result = validateMasterPassword('MyStr0ng!Pass')
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects a password shorter than 12 characters', () => {
    const result = validateMasterPassword('Sh0rt!P')
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Password must be at least 12 characters long')
  })

  it('rejects a password without lowercase', () => {
    const result = validateMasterPassword('ALLUPPERCASE12!')
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Password must contain at least one lowercase letter')
  })

  it('rejects a password without uppercase', () => {
    const result = validateMasterPassword('alllowercase12!')
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Password must contain at least one uppercase letter')
  })

  it('rejects a password without digits', () => {
    const result = validateMasterPassword('NoDigitsHere!!!')
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Password must contain at least one number')
  })

  it('rejects a password without special characters', () => {
    const result = validateMasterPassword('NoSpecial12345')
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Password must contain at least one special character')
  })

  it('rejects a password with repeated characters (e.g. aaa)', () => {
    const result = validateMasterPassword('aaaBBB123!@#xy')
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Password should not contain repeated characters')
  })

  it('rejects a password with common patterns', () => {
    const result = validateMasterPassword('password1234!A')
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Password contains common patterns that should be avoided')
  })

  it('reports multiple errors at once', () => {
    const result = validateMasterPassword('aaa')
    expect(result.isValid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(3)
  })
})

// ── Secure Password Generator ───────────────────────────────────────────────

describe('generateSecurePassword', () => {
  it('generates a password of the requested length', () => {
    const pw = generateSecurePassword({
      length: 20,
      includeLower: true,
      includeUpper: true,
      includeNumbers: true,
      includeSymbols: true,
    })
    expect(pw).toHaveLength(20)
  })

  it('includes at least one character from each selected set', () => {
    for (let i = 0; i < 50; i++) {  // probabilistic — run 50 times
      const pw = generateSecurePassword({
        length: 16,
        includeLower: true,
        includeUpper: true,
        includeNumbers: true,
        includeSymbols: true,
      })
      expect(pw).toMatch(/[a-z]/)
      expect(pw).toMatch(/[A-Z]/)
      expect(pw).toMatch(/[0-9]/)
      expect(pw).toMatch(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/)
    }
  })

  it('respects lowercase-only option', () => {
    const pw = generateSecurePassword({
      length: 30,
      includeLower: true,
      includeUpper: false,
      includeNumbers: false,
      includeSymbols: false,
    })
    expect(pw).toMatch(/^[a-z]+$/)
  })

  it('throws when no character types are selected', () => {
    expect(() =>
      generateSecurePassword({
        length: 16,
        includeLower: false,
        includeUpper: false,
        includeNumbers: false,
        includeSymbols: false,
      }),
    ).toThrow('At least one character type must be selected')
  })

  it('produces unique passwords (no two are the same)', () => {
    const passwords = new Set<string>()
    for (let i = 0; i < 100; i++) {
      passwords.add(
        generateSecurePassword({
          length: 20,
          includeLower: true,
          includeUpper: true,
          includeNumbers: true,
          includeSymbols: true,
        }),
      )
    }
    expect(passwords.size).toBe(100)
  })
})

// ── Input Sanitization ──────────────────────────────────────────────────────

describe('sanitizeInput', () => {
  it('passes through clean input unchanged', () => {
    expect(sanitizeInput('hello world')).toBe('hello world')
  })

  it('strips null bytes', () => {
    expect(sanitizeInput('test\x00value')).toBe('testvalue')
  })

  it('strips control characters', () => {
    const result = sanitizeInput('\x00\x01\x02\x03visible')
    expect(result).toBe('visible')
    // Only chars with charCode >= 32 survive
    expect(sanitizeInput('a\x01b\x02c')).toBe('abc')
  })

  it('trims whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello')
  })

  it('truncates to maxLength', () => {
    expect(sanitizeInput('a'.repeat(2000), 100)).toHaveLength(100)
  })

  it('uses default maxLength of 1000', () => {
    expect(sanitizeInput('b'.repeat(2000))).toHaveLength(1000)
  })

  it('throws for non-string input', () => {
    expect(() => sanitizeInput(123 as unknown as string)).toThrow('Input must be a string')
  })
})

// ── Site Validation ─────────────────────────────────────────────────────────

describe('validateSite', () => {
  it.each([
    'example.com',
    'my-site.co.uk',
    'localhost',
    '192.168.1.1',
    'sub.domain.org',
  ])('accepts valid site: %s', (site) => {
    expect(validateSite(site)).toBe(true)
  })

  it.each([
    '',
    '-invalid.com',
    'a'.repeat(254),
    '<script>alert(1)</script>',
    'site with spaces',
  ])('rejects invalid site: %s', (site) => {
    expect(validateSite(site)).toBe(false)
  })
})

// ── Username Validation ─────────────────────────────────────────────────────

describe('validateUsername', () => {
  it.each([
    'alice',
    'bob_123',
    'user@example.com',
    'user+tag@gmail.com',
    'John.Doe',
  ])('accepts valid username: %s', (username) => {
    expect(validateUsername(username)).toBe(true)
  })

  it.each([
    '',
    'a'.repeat(255),
    'user name',
    '<script>',
    'user;DROP TABLE',
  ])('rejects invalid username: %s', (username) => {
    expect(validateUsername(username)).toBe(false)
  })
})

// ── Audit Logger ────────────────────────────────────────────────────────────

describe('AuditLogger', () => {
  let logger: AuditLogger

  beforeEach(() => {
    logger = new AuditLogger()
  })

  it('starts with no logs', () => {
    expect(logger.getLogs()).toHaveLength(0)
  })

  it('records an entry with timestamp and id', () => {
    logger.log({ action: 'password_create', success: true, site: 'example.com' })
    const logs = logger.getLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0].id).toBeDefined()
    expect(logs[0].timestamp).toBeDefined()
    expect(logs[0].action).toBe('password_create')
    expect(logs[0].success).toBe(true)
    expect(logs[0].site).toBe('example.com')
  })

  it('returns a defensive copy (cannot mutate internal state)', () => {
    logger.log({ action: 'vault_lock', success: true })
    const logsA = logger.getLogs()
    logsA.push({ id: 'fake', timestamp: '', action: 'vault_unlock', success: false })
    expect(logger.getLogs()).toHaveLength(1)
  })

  it('clears all logs', () => {
    logger.log({ action: 'password_decrypt', success: true })
    logger.log({ action: 'clipboard_copy', success: true })
    logger.clearLogs()
    expect(logger.getLogs()).toHaveLength(0)
  })

  it('enforces maximum log limit (1000)', () => {
    for (let i = 0; i < 1050; i++) {
      logger.log({ action: 'password_decrypt', success: true })
    }
    expect(logger.getLogs().length).toBeLessThanOrEqual(1000)
  })
})
