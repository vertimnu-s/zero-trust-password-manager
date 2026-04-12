import { describe, it, expect } from 'vitest'
import { validatePassword } from '../passwordValidator'

describe('validatePassword', () => {
  it('accepts a fully valid password', () => {
    const result = validatePassword('Str0ng!Password')
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects a password shorter than 12 characters', () => {
    const result = validatePassword('Sh0rt!@#')
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('At least 12 characters')
  })

  it('rejects a password without uppercase letters', () => {
    const result = validatePassword('nouppercase12!!')
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('At least one uppercase letter (A-Z)')
  })

  it('rejects a password without lowercase letters', () => {
    const result = validatePassword('NOLOWERCASE12!!')
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('At least one lowercase letter (a-z)')
  })

  it('rejects a password without numbers', () => {
    const result = validatePassword('NoNumbersHere!!')
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('At least one number (0-9)')
  })

  it('rejects a password without special characters', () => {
    const result = validatePassword('NoSpecials12345')
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('At least one special character (e.g., !@#$%^&*)')
  })

  it('reports all missing requirements simultaneously', () => {
    const result = validatePassword('')
    expect(result.isValid).toBe(false)
    // Should have at least 5 errors (length + upper + lower + digit + special)
    expect(result.errors.length).toBeGreaterThanOrEqual(5)
  })

  it('accepts exactly 12 characters with all requirements met', () => {
    const result = validatePassword('Abcdefgh1!xy')
    expect(result.isValid).toBe(true)
  })

  it('rejects 11 characters even if all other requirements are met', () => {
    const result = validatePassword('Abcdefg1!xy')
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('At least 12 characters')
  })
})
