export async function checkPasswordBreach(password: string): Promise<number> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

  const prefix = hashHex.slice(0, 5);
  const suffix = hashHex.slice(5);

  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { 'Add-Padding': 'true' }
  });

  if (!response.ok) {
    return 0;
  }

  const text = await response.text();
  const lines = text.split('\n');

  for (const line of lines) {
    const [hash, count] = line.trim().split(':');
    if (hash === suffix) {
      return parseInt(count, 10);
    }
  }

  return 0;
}
