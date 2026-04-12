import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock AWS SDK ────────────────────────────────────────────────────────────

const mockDynamoSend = vi.fn()
const mockS3Send = vi.fn()

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class { send = mockDynamoSend },
  PutItemCommand: class { constructor(p: Record<string, unknown>) { Object.assign(this, p) } },
}))
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send = mockS3Send },
  PutObjectCommand: class { constructor(p: Record<string, unknown>) { Object.assign(this, p) } },
}))

// ── Import handler (after mocks are hoisted) ────────────────────────────────

const { handler } = await import(
  '../../terraform/lambda-functions/create-password/index.js'
)

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeEvent(overrides = {}) {
  return {
    requestContext: {
      authorizer: { jwt: { claims: { sub: 'user-123' } } },
    },
    body: JSON.stringify({
      site: 'example.com',
      username: 'alice',
      cipherText: btoa('encrypted-data'),
      iv: btoa('iv-data-1234'),
      salt: btoa('salt-data-123'),
      category: 'login',
    }),
    ...overrides,
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('create-password Lambda', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDynamoSend.mockResolvedValue({})
    mockS3Send.mockResolvedValue({})
  })

  it('returns 401 when no userId in JWT claims', async () => {
    const event = makeEvent({
      requestContext: { authorizer: { jwt: { claims: {} } } },
    })
    const res = await handler(event)
    expect(res.statusCode).toBe(401)
    expect(JSON.parse(res.body).message).toBe('Unauthorized')
  })

  it('returns 400 when body is missing', async () => {
    const event = makeEvent({ body: null })
    const res = await handler(event)
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).message).toBe('Request body is required')
  })

  it('returns 400 for invalid JSON body', async () => {
    const event = makeEvent({ body: '{not-json' })
    const res = await handler(event)
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).message).toBe('Invalid JSON')
  })

  it('returns 400 when site or username is missing', async () => {
    const event = makeEvent({
      body: JSON.stringify({
        site: '',
        username: 'alice',
        cipherText: btoa('x'),
        iv: btoa('y'),
        salt: btoa('z'),
      }),
    })
    const res = await handler(event)
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).message).toBe('site and username are required')
  })

  it('returns 400 when encrypted fields are not valid base64', async () => {
    const event = makeEvent({
      body: JSON.stringify({
        site: 'example.com',
        username: 'alice',
        cipherText: '!!!invalid!!!',
        iv: btoa('y'),
        salt: btoa('z'),
      }),
    })
    const res = await handler(event)
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).message).toBe('Invalid encrypted payload')
  })

  it('returns 200 on successful creation', async () => {
    const event = makeEvent()
    const res = await handler(event)
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).message).toBe('Saved successfully')
    expect(mockDynamoSend).toHaveBeenCalledTimes(1)
  })

  it('constructs composite key as site#username', async () => {
    const event = makeEvent()
    await handler(event)
    const putCmd = mockDynamoSend.mock.calls[0][0]
    expect(putCmd.Item.itemKey.S).toBe('example.com#alice')
  })

  it('uses ConditionExpression to prevent duplicates', async () => {
    const event = makeEvent()
    await handler(event)
    const putCmd = mockDynamoSend.mock.calls[0][0]
    expect(putCmd.ConditionExpression).toBe('attribute_not_exists(itemKey)')
  })

  it('returns 409 when item already exists', async () => {
    mockDynamoSend.mockRejectedValue({ name: 'ConditionalCheckFailedException' })
    const event = makeEvent()
    const res = await handler(event)
    expect(res.statusCode).toBe(409)
    expect(JSON.parse(res.body).message).toContain('already exists')
  })

  it('defaults category to "login" for unknown value', async () => {
    const event = makeEvent({
      body: JSON.stringify({
        site: 'example.com',
        username: 'alice',
        cipherText: btoa('x'),
        iv: btoa('y'),
        salt: btoa('z'),
        category: 'INVALID',
      }),
    })
    await handler(event)
    const putCmd = mockDynamoSend.mock.calls[0][0]
    expect(putCmd.Item.category.S).toBe('login')
  })

  it('accepts all valid categories', async () => {
    for (const cat of ['login', 'card', 'identity', 'secure note']) {
      mockDynamoSend.mockResolvedValue({})
      const event = makeEvent({
        body: JSON.stringify({
          site: 'example.com',
          username: 'alice',
          cipherText: btoa('x'),
          iv: btoa('y'),
          salt: btoa('z'),
          category: cat,
        }),
      })
      await handler(event)
      const putCmd = mockDynamoSend.mock.lastCall[0]
      expect(putCmd.Item.category.S).toBe(cat)
    }
  })

  it('includes security headers in response', async () => {
    const event = makeEvent()
    const res = await handler(event)
    expect(res.headers['Strict-Transport-Security']).toContain('max-age=')
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff')
    expect(res.headers['X-Frame-Options']).toBe('DENY')
    expect(res.headers['Cache-Control']).toBe('no-store')
  })

  it('writes audit log to S3 on success', async () => {
    const event = makeEvent()
    await handler(event)
    expect(mockS3Send).toHaveBeenCalledTimes(1)
  })

  it('rejects site exceeding maximum length', async () => {
    const event = makeEvent({
      body: JSON.stringify({
        site: 'a'.repeat(257),
        username: 'alice',
        cipherText: btoa('x'),
        iv: btoa('y'),
        salt: btoa('z'),
      }),
    })
    const res = await handler(event)
    expect(res.statusCode).toBe(400)
  })
})
