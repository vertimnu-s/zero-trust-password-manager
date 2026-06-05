export async function generateKeyFromPassword(password: string, salt: Uint8Array) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new Uint8Array(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptPassword(
  plaintext: string,
  masterPassword: string,
  context: string
) {
  const enc = new TextEncoder();

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const key = await generateKeyFromPassword(masterPassword, salt);

  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: enc.encode(context) },
    key,
    enc.encode(plaintext)
  );

  return {
    cipherText: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
    salt: btoa(String.fromCharCode(...salt)),
  };
}

export async function decryptPassword(
  cipherText: string,
  iv: string,
  salt: string,
  masterPassword: string,
  context: string
) {

  const dec = (b64: string) =>
    Uint8Array.from(atob(b64), c => c.charCodeAt(0));

  const key = await generateKeyFromPassword(masterPassword, dec(salt));

  try {
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: dec(iv),
        additionalData: new TextEncoder().encode(context),
      },
      key,
      dec(cipherText)
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error(
      "Decryption failed (wrong master password / context mismatch / corrupted ciphertext)."
    );
  }
}

export function validateMasterPassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 12) {
    errors.push("Password must be at least 12 characters long");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (!/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (!/[!@#$%^&*()_+\-[\]{}|;:,.<>?]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  if (/(.)\1{2,}/.test(password)) {
    errors.push("Password should not contain repeated characters");
  }

  if (/123|abc|qwe|password|admin/i.test(password)) {
    errors.push("Password contains common patterns that should be avoided");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export async function secureCopyToClipboard(text: string, autoClearMs: number = 30000): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);

    setTimeout(async () => {
      try {
        const currentClipboard = await navigator.clipboard.readText();
        if (currentClipboard === text) {
          await navigator.clipboard.writeText("");
        }
      } catch {
      }
    }, autoClearMs);

  } catch {
    throw new Error("Failed to copy to clipboard securely");
  }
}

export function secureWipeString(str: string): void {
  if (str) {
    const arr = new Uint8Array(str.length);
    window.crypto.getRandomValues(arr);
  }
}

function secureRandomIndex(max: number): number {
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  return array[0] % max;
}

export function generateSecurePassword(options: {
  length: number;
  includeLower: boolean;
  includeUpper: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
  avoidAmbiguous?: boolean;
}): string {
  const charSets = {
    lower: options.includeLower ? "abcdefghijkmnopqrstuvwxyz" : "",
    upper: options.includeUpper ? "ABCDEFGHJKLMNPQRSTUVWXYZ" : "",
    numbers: options.includeNumbers ? "23456789" : "",
    symbols: options.includeSymbols ? "!@#$%^&*()_+-=[]{}|;:,.<>?" : "",
  };

  if (options.avoidAmbiguous) {
    charSets.lower = charSets.lower.replace(/[l]/g, "");
    charSets.upper = charSets.upper.replace(/[I]/g, "");
    charSets.numbers = charSets.numbers.replace(/[0]/g, "");
  }

  const allChars = Object.values(charSets).join("");
  if (!allChars) {
    throw new Error("At least one character type must be selected");
  }

  const requiredChars: string[] = [];
  Object.entries(charSets).forEach(([, chars]) => {
    if (chars) {
      requiredChars.push(chars[secureRandomIndex(chars.length)]);
    }
  });

  const remainingLength = options.length - requiredChars.length;
  const resultChars = [...requiredChars];

  for (let i = 0; i < remainingLength; i++) {
    resultChars.push(allChars[secureRandomIndex(allChars.length)]);
  }

  for (let i = resultChars.length - 1; i > 0; i--) {
    const j = secureRandomIndex(i + 1);
    [resultChars[i], resultChars[j]] = [resultChars[j], resultChars[i]];
  }

  return resultChars.join("");
}

export function sanitizeInput(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  let sanitized = input.split('').filter(char => {
    const code = char.charCodeAt(0);
    return code >= 32 && (code < 127 || code > 159);
  }).join('');

  sanitized = sanitized.trim();

  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

export function validateSite(site: string): boolean {
  const siteRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-_.]*(?:\.[a-zA-Z]{2,})?$|^localhost$|^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  return siteRegex.test(site) && site.length <= 253;
}

export function validateUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9._@+-]+$/;
  return usernameRegex.test(username) && username.length >= 1 && username.length <= 254;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: 'password_decrypt' | 'password_create' | 'password_update' | 'password_delete' | 'clipboard_copy' | 'vault_lock' | 'vault_unlock';
  site?: string;
  username?: string;
  success: boolean;
  details?: string;
}

export class AuditLogger {
  private logs: AuditEntry[] = [];
  private readonly maxLogs = 1000;

  log(entry: Omit<AuditEntry, 'timestamp' | 'id'>): void {
    const auditEntry: AuditEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      id: crypto.randomUUID(),
    };

    this.logs.push(auditEntry);

    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

  }

  getLogs(): AuditEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }
}

export const auditLogger = new AuditLogger();
