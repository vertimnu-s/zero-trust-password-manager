import { webcrypto } from 'node:crypto'

// Polyfill Web Crypto API for happy-dom environment
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: true,
    configurable: true,
  })
}

if (typeof window !== 'undefined' && !window.crypto?.subtle) {
  Object.defineProperty(window, 'crypto', {
    value: webcrypto,
    writable: true,
    configurable: true,
  })
}
