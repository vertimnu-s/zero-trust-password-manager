import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDynamoSend = vi.fn()
const mockS3Send = vi.fn()

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class { send = mockDynamoSend },
  QueryCommand: class { constructor(p: Record<string, unknown>) { Object.assign(this, p) } },
}))
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send = mockS3Send },
  PutObjectCommand: class { constructor(p: Record<string, unknown>) { Object.assign(this, p) } },
}))

const { handler } = await import(
  '../../terraform/lambda-functions/read-passwords/index.js'
)

function makeEvent(overrides = {}) {
  return {
    requestContext: {
      authorizer: { jwt: { claims: { sub: 'user-123' } } },
    },
    ...overrides,
  }
}

describe('read-passwords Lambda', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDynamoSend.mockResolvedValue({ Items: [] })
    mockS3Send.mockResolvedValue({})
  })

  it('returns 401 when no userId in JWT claims', async () => {
    const event = makeEvent({
      requestContext: { authorizer: { jwt: { claims: {} } } },
    })
    const res = await handler(event)
    expect(res.statusCode).toBe(401)
  })

  it('queries DynamoDB with partition key = userId (tenant isolation)', async () => {
    const event = makeEvent()
    await handler(event)
    const queryCmd = mockDynamoSend.mock.calls[0][0]
    expect(queryCmd.KeyConditionExpression).toBe('userId = :uid')
    expect(queryCmd.ExpressionAttributeValues[':uid'].S).toBe('user-123')
  })

  it('returns 200 with items on success', async () => {
    mockDynamoSend.mockResolvedValue({
      Items: [
        { userId: { S: 'user-123' }, itemKey: { S: 'site#user' } },
      ],
    })
    const event = makeEvent()
    const res = await handler(event)
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toHaveLength(1)
  })

  it('returns empty array when user has no items', async () => {
    mockDynamoSend.mockResolvedValue({ Items: [] })
    const event = makeEvent()
    const res = await handler(event)
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual([])
  })

  it('returns 500 on DynamoDB error', async () => {
    mockDynamoSend.mockRejectedValue(new Error('DynamoDB failure'))
    const event = makeEvent()
    const res = await handler(event)
    expect(res.statusCode).toBe(500)
  })

  it('cannot read another user\'s data (userId is from JWT, not request)', async () => {
    const event = makeEvent()
    await handler(event)
    const queryCmd = mockDynamoSend.mock.calls[0][0]
    expect(queryCmd.ExpressionAttributeValues[':uid'].S).toBe('user-123')
  })

  it('includes security headers', async () => {
    const event = makeEvent()
    const res = await handler(event)
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff')
    expect(res.headers['X-Frame-Options']).toBe('DENY')
    expect(res.headers['Cache-Control']).toBe('no-store')
  })
})
