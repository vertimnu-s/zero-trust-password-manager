import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkPasswordBreach } from '../hibp'

describe('checkPasswordBreach', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns breach count when password hash suffix is found', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        '1D2DA4053E34E76F6576ED1DA63134B5E2A:2\n' +
        '1E4C9B93F3F0682250B6CF8331B7EE68FD8:9659365\n' +
        '1F2B668E8AABEF1C59E9EC6F82E3F3CD786:1\n',
    })

    const count = await checkPasswordBreach('password')
    expect(count).toBe(9659365)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    const mockFetch = vi.mocked(globalThis.fetch)
    const callUrl = mockFetch.mock.calls[0][0]
    expect(callUrl).toBe('https://api.pwnedpasswords.com/range/5BAA6')
  })

  it('returns 0 when password hash suffix is not found', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1:3\n' +
        'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB:7\n',
    })

    const count = await checkPasswordBreach('some-unique-password-xyz123')
    expect(count).toBe(0)
  })

  it('returns 0 when API request fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    })

    const count = await checkPasswordBreach('test')
    expect(count).toBe(0)
  })

  it('sends Add-Padding header (k-anonymity protection)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    })

    await checkPasswordBreach('test')
    const mockFetch = vi.mocked(globalThis.fetch)
    const callHeaders = mockFetch.mock.calls[0][1]?.headers
    expect(callHeaders).toHaveProperty('Add-Padding', 'true')
  })

  it('only sends first 5 characters of SHA-1 hash (k-anonymity)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    })

    await checkPasswordBreach('anything')
    const mockFetch = vi.mocked(globalThis.fetch)
    const callUrl = mockFetch.mock.calls[0][0] as string
    expect(callUrl).toMatch(/\/range\/[0-9A-F]{5}$/)
  })
})
