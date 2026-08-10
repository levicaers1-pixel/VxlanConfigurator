export function ipToInt(ip: string): number {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    throw new Error(`Invalid IPv4 address: ${ip}`)
  }
  return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0)
}

export function intToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
}

export interface ParsedCidr {
  network: number
  prefixLen: number
}

export function parseCidr(cidr: string): ParsedCidr {
  const [ip, lenStr] = cidr.split('/')
  const prefixLen = Number(lenStr)
  if (!ip || Number.isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32) {
    throw new Error(`Invalid CIDR: ${cidr}`)
  }
  const mask = prefixLen === 0 ? 0 : (0xffffffff << (32 - prefixLen)) >>> 0
  const network = (ipToInt(ip) & mask) >>> 0
  return { network, prefixLen }
}

export function cidrToString(network: number, prefixLen: number): string {
  return `${intToIp(network)}/${prefixLen}`
}

export function blockSize(prefixLen: number): number {
  return prefixLen === 32 ? 1 : 2 ** (32 - prefixLen)
}

/**
 * Carves a supernet into sequential blocks of `prefixLen`, yielding each
 * block's network address as an integer. Deterministic order: always
 * lowest-to-highest within the supernet.
 */
export function* carve(supernet: string, prefixLen: number): Generator<number> {
  const { network, prefixLen: supernetLen } = parseCidr(supernet)
  if (prefixLen < supernetLen) {
    throw new Error(`Carve prefix /${prefixLen} cannot be larger than supernet /${supernetLen}`)
  }
  const size = blockSize(prefixLen)
  const supernetSize = blockSize(supernetLen)
  const count = supernetSize / size
  for (let i = 0; i < count; i++) {
    yield (network + i * size) >>> 0
  }
}

/** For a /31 or /30 block, returns the two usable point-to-point addresses. */
export function pointToPointUsable(network: number, prefixLen: 31 | 30): [number, number] {
  if (prefixLen === 31) {
    return [network, (network + 1) >>> 0]
  }
  // /30: skip network (.0) and broadcast (.3), usable are .1 and .2
  return [(network + 1) >>> 0, (network + 2) >>> 0]
}

export function loopbackAddress(network: number): string {
  return intToIp(network)
}
