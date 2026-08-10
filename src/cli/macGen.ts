/** Deterministic locally-administered MAC derived from a seed string, for VSX system-mac / active-gateway MAC. */
export function deterministicMac(prefixOctet: string, seed: string | number): string {
  const str = String(seed)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  }
  const b1 = (hash >>> 24) & 0xff
  const b2 = (hash >>> 16) & 0xff
  const b3 = (hash >>> 8) & 0xff
  const b4 = hash & 0xff
  const hex = (n: number) => n.toString(16).padStart(2, '0')
  return `02:00:${prefixOctet}:${hex(b1)}:${hex(b2 ^ b3)}:${hex(b4)}`
}
