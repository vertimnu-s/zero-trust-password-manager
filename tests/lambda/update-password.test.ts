import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock AWS SDK ────────────────────────────────────────────────────────────

const mockDynamoSend = vi.fn()
const mockS3Send = vi.fn()

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class { send = mockDynamoSend },
  UpdateItemCommand: class { _type = 'UpdateItem'; constructor(p: Record<string, unknown>) { Object.assign(this, p) } },
  DeleteItemCommand: class { _type = 'DeleteItem'; constructor(p: Record<string, unknown>) { Object.assign(this, p) } },
  PutItemCommand: class { _type = 'PutItem'; constructor(p: Record<string, unknown>) { Object.assign(this, p) } },
}))
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send = mockS3Send },
  PutObjectCommand: class { constructor(p: Record<string, unknown>) { Object.assign(this, p) } },
}))

const { handler } = await import(
  '../../terraform/lambda-functions/update-password/index.js'
)

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeEvent(bodyOverrides = {}) {
  return {
    requestContext: {
      authorizer: { jwt: { claims: { sub: 'user-123' } } },
    },
    body: JSON.stringify({
      site: 'example.com',
      username: 'alice',
      cipherText: btoa('new-cipher'),
      iv: btoa('new-iv-12345'),
      salt: btoa('new-salt-1234'),
      category: 'login',
      ...bodyOverrides,
    }),
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('update-password Lambda', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDynamoSend.mockResolvedValue({})
    mockS3Send.mockResolvedValue({})
  })

  it('returns 401 when no userId in JWT claims', async () => {
    const event = {
      requestContext: { authorizer: { jwt: { claims: {} } } },
      body: makeEvent().body,
    }
    const res = await handler(event)
    expect(res.statusCode).toBe(401)
  })

  it('returns 400 when body is missing', async () => {
    const event = {
      requestContext: { authorizer: { jwt: { claims: { sub: 'user-123' } } } },
      body: null,
    }
    const res = await handler(event)
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for invalid JSON', async () => {
    const event = {
      requestContext: { authorizer: { jwt: { claims: { sub: 'user-123' } } } },
      body: 'not-json',
    }
    const res = await handler(event)
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when encrypted fields are invalid', async () => {
    const event = makeEvent({ cipherText: '!!!bad!!!' })
    const res = await handler(event)
    expect(res.statusCode).toBe(400)
  })

  it('performs in-place update when key does not change', async () => {
    const event = makeEvent()
    const res = await handler(event)
    expect(res.statusCode).toBe(200)
    // Should use UpdateItemCommand (1 call), not delete+put
    expect(mockDynamoSend).toHaveBeenCalledTimes(1)
    const cmd = mockDynamoSend.mock.calls[0][0]
    expect(cmd._type).toBe('UpdateItem')
  })

  it('performs delete + put when key changes (site/username renamed)', async () => {
    const event = makeEvent({
      oldItemKey: 'old-site.com#bob',
      site: 'new-site.com',
      username: 'alice',
    })
    const res = await handler(event)
    expect(res.statusCode).toBe(200)
    // delete old + put new = 2 DynamoDB calls
    expect(mockDynamoSend).toHaveBeenCalledTimes(2)
    expect(mockDynamoSend.mock.calls[0][0]._type).toBe('DeleteItem')
    expect(mockDynamoSend.mock.calls[1][0]._type).toBe('PutItem')
  })

  it('uses user-supplied category if valid', async () => {
    const event = makeEvent({ category: 'card' })
    await handler(event)
    const cmd = mockDynamoSend.mock.calls[0][0]
    expect(cmd.ExpressionAttributeValues[':cat'].S).toBe('card')
  })

  it('defaults invalid category to "login"', async () => {
    const event = makeEvent({ category: 'MALICIOUS_CATEGORY' })
    await handler(event)
    const cmd = mockDynamoSend.mock.calls[0][0]
    expect(cmd.ExpressionAttributeValues[':cat'].S).toBe('login')
  })

  it('includes security headers', async () => {
    const event = makeEvent()
    const res = await handler(event)
    expect(res.headers['X-Frame-Options']).toBe('DENY')
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff')
  })
})
