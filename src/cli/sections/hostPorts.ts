import type { ConfigBuilder } from '../ConfigBuilder'
import type { SectionBuilder } from '../context'
import type { HostConnection } from '../../domain/types'

function emitVlanConfig(conn: HostConnection, b: ConfigBuilder) {
  if (conn.mode === 'access') {
    if (conn.accessVlanId !== undefined) b.line(`vlan access ${conn.accessVlanId}`)
    return
  }
  if (conn.trunkNativeVlanId !== undefined) b.line(`vlan trunk native ${conn.trunkNativeVlanId}`)
  const allowed = conn.trunkAllowedVlans
  if (!allowed || allowed === 'all') {
    b.line('vlan trunk allowed all')
  } else if (allowed.length > 0) {
    b.line(`vlan trunk allowed ${allowed.join(',')}`)
  }
}

/**
 * Server/host-facing access ports on fabric switches (leaves, standalone).
 * A HostConnection with 2 ports (one on each VSX peer) becomes an MC-LAG —
 * AOS-CX needs no special "multi-chassis" keyword for this: both VSX peers
 * just configure the same numeric LAG ID with matching member ports, and
 * VSX synchronizes it automatically.
 */
export const hostPorts: SectionBuilder = (ctx, out) => {
  const conns = ctx.project.hostConnections.filter((c) => c.ports.some((p) => p.switchInstanceId === ctx.self.id))
  for (const conn of conns) {
    const ownPorts = conn.ports.filter((p) => p.switchInstanceId === ctx.self.id)
    const dualHomed = conn.ports.length === 2

    if (!dualHomed) {
      for (const portRef of ownPorts) {
        out.block(`interface ${portRef.portName}`, (b) => {
          b.line('no shutdown')
          b.line(`description host-${conn.name}`)
          b.line('no routing')
          emitVlanConfig(conn, b)
        })
        out.blank()
      }
      continue
    }

    const lagId = ctx.ipPlan.hostLagIds[conn.id]
    if (lagId === undefined) {
      out.comment(`ERROR: no LAG ID allocated for host connection "${conn.name}"`)
      out.blank()
      continue
    }
    for (const portRef of ownPorts) {
      out.block(`interface ${portRef.portName}`, (b) => {
        b.line('no shutdown')
        b.line(`lag ${lagId}`)
      })
      out.blank()
    }
    out.block(`interface lag ${lagId}`, (b) => {
      b.line('no shutdown')
      b.line(`description host-${conn.name}`)
      b.line('no routing')
      emitVlanConfig(conn, b)
      b.line('lacp mode active')
    })
    out.blank()
  }
}
