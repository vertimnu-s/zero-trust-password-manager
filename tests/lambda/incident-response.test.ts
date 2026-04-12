// @vitest-environment node

/**
 * Incident Response Lambda — Decision Logic Tests
 *
 * The handler has its own node_modules with the real AWS SDK, so we cannot
 * mock SDK calls from the test process. Instead we verify the handler's
 * DECISION LOGIC by examining its return value. AWS calls fail gracefully
 * in local testing (no credentials), but the handler still returns which
 * actions were ATTEMPTED — proving the severity-based routing is correct.
 */

import { describe, it, expect, beforeAll } from 'vitest'

let handler: (event: unknown) => Promise<Record<string, unknown>>

beforeAll(async () => {
  process.env.WAF_IP_SET_ID = 'test-ip-set-id'
  process.env.WAF_IP_SET_NAME = 'test-ip-set'
  process.env.COGNITO_USER_POOL_ID = 'us-east-1_TestPool'
  process.env.SNS_TOPIC_ARN = 'arn:aws:sns:us-east-1:123456789:test-topic'
  const mod = await import('../../terraform/lambda-functions/incident-response/index.js')
  handler = mod.handler
})

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    detail: {
      type: 'UnauthorizedAccess:IAMUser/MaliciousIPCaller',
      severity: 8,
      title: 'API was invoked from a known malicious IP address',
      service: {
        action: {
          networkConnectionAction: {
            remoteIpDetails: { ipAddressV4: '198.51.100.42' },
          },
        },
      },
      resource: {
        accessKeyDetails: { principalId: 'cognito-sub-abc123' },
      },
      ...overrides,
    },
  }
}

function parseResult(res: Record<string, unknown>) {
  return res as { finding: string; severity: number; actions: string[]; timestamp: string }
}

describe('incident-response Lambda — decision logic', () => {
  it('attempts IP block for severity >= 4 (MEDIUM)', async () => {
    const event = makeEvent({ severity: 5, type: 'Recon:EC2/PortProbeUnprotectedPort' })
    const result = parseResult(await handler(event))
    const ipAction = result.actions.find((a: string) => a.startsWith('IP block'))
    expect(ipAction).toBeDefined()
    expect(ipAction).toContain('198.51.100.42')
  })

  it('does NOT attempt any action for severity < 4 (LOW)', async () => {
    const event = makeEvent({ severity: 2 })
    const result = parseResult(await handler(event))
    expect(result.actions).toHaveLength(0)
  })

  it('attempts user disable for severity >= 7 (HIGH) + credential finding type', async () => {
    const event = makeEvent({
      severity: 8,
      type: 'UnauthorizedAccess:IAMUser/MaliciousIPCaller',
    })
    const result = parseResult(await handler(event))
    const userAction = result.actions.find((a: string) => a.startsWith('User disable'))
    expect(userAction).toBeDefined()
    expect(userAction).toContain('cognito-sub-abc123')
  })

  it('does NOT attempt user disable for severity 5 (MEDIUM)', async () => {
    const event = makeEvent({ severity: 5 })
    const result = parseResult(await handler(event))
    const userAction = result.actions.find((a: string) => a.startsWith('User disable'))
    expect(userAction).toBeUndefined()
  })

  it('extracts remote IP from networkConnectionAction', async () => {
    const event = makeEvent({ severity: 5 })
    const result = parseResult(await handler(event))
    const ipAction = result.actions.find((a: string) => a.includes('198.51.100.42'))
    expect(ipAction).toBeDefined()
  })

  it('extracts remote IP from awsApiCallAction fallback', async () => {
    const event = {
      detail: {
        type: 'UnauthorizedAccess:IAMUser/MaliciousIPCaller',
        severity: 5,
        title: 'API call from suspicious IP',
        service: {
          action: {
            awsApiCallAction: {
              remoteIpDetails: { ipAddressV4: '203.0.113.99' },
            },
          },
        },
        resource: {},
      },
    }
    const result = parseResult(await handler(event))
    const ipAction = result.actions.find((a: string) => a.includes('203.0.113.99'))
    expect(ipAction).toBeDefined()
  })

  it('skips all actions when no remote IP and low severity', async () => {
    const event = {
      detail: {
        type: 'Policy:IAMUser/RootCredentialUsage',
        severity: 3,
        title: 'Root credential used',
        service: { action: {} },
        resource: {},
      },
    }
    const result = parseResult(await handler(event))
    expect(result.actions).toHaveLength(0)
  })

  it('returns correct finding type in response', async () => {
    const event = makeEvent({ type: 'Recon:EC2/Portscan', severity: 5 })
    const result = parseResult(await handler(event))
    expect(result.finding).toBe('Recon:EC2/Portscan')
  })

  it('returns severity in response', async () => {
    const event = makeEvent({ severity: 6 })
    const result = parseResult(await handler(event))
    expect(result.severity).toBe(6)
  })

  it('returns a timestamp in ISO format', async () => {
    const event = makeEvent({ severity: 2 })
    const result = parseResult(await handler(event))
    expect(result.timestamp).toBeDefined()
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp)
  })
})
