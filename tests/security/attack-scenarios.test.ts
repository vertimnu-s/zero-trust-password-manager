/**
 * Security Attack Scenario Tests
 *
 * These tests verify that the zero-trust security controls enforce:
 *   1. Authentication gatekeeping (no anonymous access)
 *   2. Input validation / injection resistance
 *   3. Cryptographic integrity (AAD binding, tamper detection)
 *   4. Client-side brute-force deterrents
 *   5. k-Anonymity in breach checking
 *
 * Run locally — no AWS costs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  encryptPassword,
  decryptPassword,
  sanitizeInput,
  validateSite,
  validateUsername,
  validateMasterPassword,
} from '../../src/services/crypto'

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 1 — Unauthenticated Access Attempt
// ═══════════════════════════════════════════════════════════════════════════

const { mockDynamoSend, mockS3Send } = vi.hoisted(() => ({
  mockDynamoSend: vi.fn(),
  mockS3Send: vi.fn(),
}))

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class { send = mockDynamoSend },
  PutItemCommand: class { constructor(p: Record<string, unknown>) { Object.assign(this, p) } },
  QueryCommand: class { constructor(p: Record<string, unknown>) { Object.assign(this, p) } },
  DeleteItemCommand: class { constructor(p: Record<string, unknown>) { Object.assign(this, p) } },
  UpdateItemCommand: class { constructor(p: Record<string, unknown>) { Object.assign(this, p) } },
}))
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send = mockS3Send },
  PutObjectCommand: class { constructor(p: Record<string, unknown>) { Object.assign(this, p) } },
}))

describe('ATTACK: Unauthenticated API access', () => {
  beforeEach(() => {
    mockDynamoSend.mockResolvedValue({ Items: [] })
    mockS3Send.mockResolvedValue({})
  })

  it('create-password rejects request without JWT', async () => {
    const { handler } = await import(
      '../../terraform/lambda-functions/create-password/index.js'
    )
    const res = await handler({
      requestContext: {},
      body: JSON.stringify({ site: 'evil.com', username: 'hacker', cipherText: 'x', iv: 'x', salt: 'x' }),
    })
    expect(res.statusCode).toBe(401)
  })

  it('read-passwords rejects request without JWT', async () => {
    const { handler } = await import(
      '../../terraform/lambda-functions/read-passwords/index.js'
    )
    const res = await handler({ requestContext: {} })
    expect(res.statusCode).toBe(401)
  })

  it('delete-password rejects request without JWT', async () => {
    const { handler } = await import(
      '../../terraform/lambda-functions/delete-password/index.js'
    )
    const res = await handler({
      requestContext: {},
      queryStringParameters: { site: 'x', username: 'y' },
    })
    expect(res.statusCode).toBe(401)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 2 — SQL / NoSQL Injection via Input Fields
// ═══════════════════════════════════════════════════════════════════════════

describe('ATTACK: Injection payloads in input fields', () => {
  const injectionPayloads = [
    "'; DROP TABLE passwords; --",
    '{"$gt": ""}',
    '<script>alert("xss")</script>',
    '../../../etc/passwd',
    'robert\'); DROP TABLE Students;--',
    '{{constructor.constructor("return this")()}}',
    '\x00\x01\x02\x03',
  ]

  it.each(injectionPayloads)(
    'sanitizeInput neutralises: %s',
    (payload) => {
      const sanitized = sanitizeInput(payload)
      // Must not contain null bytes or control characters
      expect(sanitized).not.toMatch(/[\x00-\x1f]/)
    },
  )

  it.each(injectionPayloads)(
    'validateSite rejects injection payload: %s',
    (payload) => {
      expect(validateSite(payload)).toBe(false)
    },
  )

  it.each(injectionPayloads)(
    'validateUsername rejects injection payload: %s',
    (payload) => {
      expect(validateUsername(payload)).toBe(false)
    },
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 3 — Ciphertext Tampering (AES-GCM Integrity Check)
// ═══════════════════════════════════════════════════════════════════════════

describe('ATTACK: Ciphertext tampering', () => {
  const master = 'V3ry$ecure!Master'
  const ctx = 'bank.com'

  it('detects single-bit flip in ciphertext', async () => {
    const { cipherText, iv, salt } = await encryptPassword('secret123', master, ctx)
    const raw = atob(cipherText)
    const tampered = btoa(String.fromCharCode(raw.charCodeAt(0) ^ 1) + raw.slice(1))
    await expect(decryptPassword(tampered, iv, salt, master, ctx)).rejects.toThrow()
  })

  it('detects tampered IV', async () => {
    const { cipherText, iv, salt } = await encryptPassword('secret123', master, ctx)
    const rawIv = atob(iv)
    const tampered = btoa(String.fromCharCode(rawIv.charCodeAt(0) ^ 1) + rawIv.slice(1))
    await expect(decryptPassword(cipherText, tampered, salt, master, ctx)).rejects.toThrow()
  })

  it('detects tampered salt (key mismatch)', async () => {
    const { cipherText, iv, salt } = await encryptPassword('secret123', master, ctx)
    const rawSalt = atob(salt)
    const tampered = btoa(String.fromCharCode(rawSalt.charCodeAt(0) ^ 1) + rawSalt.slice(1))
    await expect(decryptPassword(cipherText, iv, tampered, master, ctx)).rejects.toThrow()
  })

  it('detects context switching attack (AAD mismatch)', async () => {
    // Encrypt for bank.com, try to decrypt with evil.com
    const enc = await encryptPassword('password', master, 'bank.com')
    await expect(
      decryptPassword(enc.cipherText, enc.iv, enc.salt, master, 'evil.com'),
    ).rejects.toThrow()
  })

  it('detects cross-user replay attack (different master password)', async () => {
    const enc = await encryptPassword('shared-secret', 'User1Pass!@#abc', ctx)
    await expect(
      decryptPassword(enc.cipherText, enc.iv, enc.salt, 'User2Pass!@#xyz', ctx),
    ).rejects.toThrow()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 4 — Weak / Common Password Attacks
// ═══════════════════════════════════════════════════════════════════════════

describe('ATTACK: Weak and common passwords', () => {
  const weakPasswords = [
    'password',
    '123456',
    'qwerty',
    'admin',
    'letmein',
    'abc123',
    'Password1',
    'short',
    '',
  ]

  it.each(weakPasswords)(
    'validateMasterPassword rejects weak password: "%s"',
    (pw) => {
      const { isValid } = validateMasterPassword(pw)
      expect(isValid).toBe(false)
    },
  )

  it('rejects passwords with triple-character repetitions', () => {
    expect(validateMasterPassword('Aaaa1234!@#xyz').isValid).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 5 — k-Anonymity Verification (HIBP)
// ═══════════════════════════════════════════════════════════════════════════

describe('ATTACK: Breach-checking leaks password to third party', () => {
  it('only the first 5 hex chars of SHA-1 are sent (k-anonymity)', async () => {
    const capturedUrls: string[] = []
    globalThis.fetch = vi.fn(async (url: string) => {
      capturedUrls.push(url)
      return { ok: true, text: async () => '' }
    }) as unknown as typeof fetch

    const { checkPasswordBreach } = await import('../../src/services/hibp')
    await checkPasswordBreach('MySuperSecretPassword123!')

    expect(capturedUrls).toHaveLength(1)
    // URL ends with exactly 5 uppercase hex characters
    expect(capturedUrls[0]).toMatch(/\/range\/[0-9A-F]{5}$/)
    // Full hash is never sent
    expect(capturedUrls[0].length).toBeLessThan(60)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 6 — Boundary & Overflow Attacks
// ═══════════════════════════════════════════════════════════════════════════

describe('ATTACK: Boundary and overflow inputs', () => {
  it('sanitizeInput truncates excessively long input', () => {
    const longInput = 'A'.repeat(100_000)
    const result = sanitizeInput(longInput)
    expect(result.length).toBeLessThanOrEqual(1000)
  })

  it('validateSite rejects strings exceeding 253 chars', () => {
    expect(validateSite('a'.repeat(254))).toBe(false)
  })

  it('validateUsername rejects strings exceeding 254 chars', () => {
    expect(validateUsername('a'.repeat(255))).toBe(false)
  })

  it('sanitizeInput rejects non-string inputs', () => {
    expect(() => sanitizeInput(null as unknown as string)).toThrow()
    expect(() => sanitizeInput(undefined as unknown as string)).toThrow()
    expect(() => sanitizeInput(42 as unknown as string)).toThrow()
  })
})
