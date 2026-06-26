/** Tiny ID generator — no dependency needed. Crypto-random, URL-safe. */
export function nanoid(len = 12): string {
  const arr = new Uint8Array(len)
  crypto.getRandomValues(arr)
  return btoa(String.fromCharCode(...arr))
    .replace(/[+/=]/g, '')
    .slice(0, len)
}
