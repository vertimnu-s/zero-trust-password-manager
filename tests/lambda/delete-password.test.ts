import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock AWS SDK ────────────────────────────────────────────────────────────

const mockDynamoSend = vi.fn()
const mockS3Send = vi.fn()

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class { send = mockDynamoSend },
  DeleteItemCommand: class { constructor(p: Record<string, unknown>) { Object.assign(this, p) } },
}))
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send = mockS3Send },
  PutObjectCommand: class { constructor(p: Record<string, unknown>) { Object.assign(this, p) } },
}))

const { handler } = await import(
  '../../terraform/lambda-functions/delete-password/index.js'
)

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeEvent(overrides = {}) {
  return {
    requestContext: {
      authorizer: { jwt: { claims: { sub: 'user-123' } } },
    },
    queryStringParameters: { site: 'example.com', username: 'alice' },
    ...overrides,
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('delete-password Lambda', () => {
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
  })

  it('returns 400 when site query parameter is missing', async () => {
    const event = makeEvent({
      queryStringParameters: { username: 'alice' },
    })
    const res = await handler(event)
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when username query parameter is missing', async () => {
    const event = makeEvent({
      queryStringParameters: { site: 'example.com' },
    })
    const res = await handler(event)
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when queryStringParameters is null', async () => {
    const event = makeEvent({ queryStringParameters: null })
    const res = await handler(event)
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when site exceeds max length', async () => {
    const event = makeEvent({
      queryStringParameters: { site: 'a'.repeat(257), username: 'alice' },
    })
    const res = await handler(event)
    expect(res.statusCode).toBe(400)
  })

  it('deletes item with composite key userId + site#username', async () => {
    const event = makeEvent()
    await handler(event)
    const deleteCmd = mockDynamoSend.mock.calls[0][0]
    expect(deleteCmd.Key.userId.S).toBe('user-123')
    expect(deleteCmd.Key.itemKey.S).toBe('example.com#alice')
  })

  it('returns 200 on successful deletion', async () => {
    const event = makeEvent()
    const res = await handler(event)
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).message).toBe('Deleted successfully')
  })

  it('writes audit log after deletion', async () => {
    const event = makeEvent()
    await handler(event)
    expect(mockS3Send).toHaveBeenCalledTimes(1)
  })

  it('returns 500 on DynamoDB error', async () => {
    mockDynamoSend.mockRejectedValue(new Error('DynamoDB failure'))
    const event = makeEvent()
    const res = await handler(event)
    expect(res.statusCode).toBe(500)
  })
})
