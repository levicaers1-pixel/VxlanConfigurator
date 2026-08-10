import type { SectionBuilder } from '../context'
import { ownAndPeerIp, peerSwitch, vrfsOnSwitch } from '../context'

function sortedVrfIndex(ctx: Parameters<SectionBuilder>[0], vrfId: string): number {
  const sorted = [...ctx.project.vrfs].sort((a, b) => a.name.localeCompare(b.name))
  return sorted.findIndex((v) => v.id === vrfId) + 1
}

/**
 * Single-session eBGP: underlay reachability and (in EVPN mode) the l2vpn evpn
 * address-family are both carried over the same directly-attached neighbor
 * sessions. Only used when underlayProtocol === 'ebgp'; the OSPF-underlay
 * case peers EVPN separately over loopbacks (see overlayEvpnBgp.ts).
 */
export const underlayBgp: SectionBuilder = (ctx, out) => {
  if (ctx.project.settings.underlayProtocol !== 'ebgp') return
  const asn = ctx.ipPlan.asns[ctx.self.id]
  const loopback = ctx.ipPlan.loopbacks[ctx.self.id]
  if (asn === undefined) {
    out.comment('ERROR: no ASN allocated for this switch')
    out.blank()
    return
  }
  const underlayLinks = ctx.peerLinks.filter((l) => l.kind === 'underlay-p2p')
  const isEvpn = ctx.project.settings.fabricMode === 'evpn'
  // Nothing to peer with and no EVPN overlay reason to keep the process — skip the stub entirely.
  if (underlayLinks.length === 0 && !isEvpn) return

  out.block(`router bgp ${asn}`, (b) => {
    if (loopback) b.line(`bgp router-id ${loopback}`)
    b.line('maximum-paths 8')
    b.blank()

    for (const link of underlayLinks) {
      const peer = peerSwitch(ctx, link)
      const ip = ownAndPeerIp(ctx, link)
      const peerAsn = peer ? ctx.ipPlan.asns[peer.id] : undefined
      if (!ip || peerAsn === undefined) continue
      b.line(`neighbor ${ip.peerIp} remote-as ${peerAsn}`)
      b.line(`neighbor ${ip.peerIp} description ${peer?.name ?? 'unknown'}`)
    }

    b.blank()
    b.block('address-family ipv4 unicast', (ab) => {
      for (const link of underlayLinks) {
        const ip = ownAndPeerIp(ctx, link)
        if (ip) ab.line(`neighbor ${ip.peerIp} activate`)
      }
    })

    if (isEvpn) {
      b.blank()
      b.block('address-family l2vpn evpn', (ab) => {
        for (const link of underlayLinks) {
          const ip = ownAndPeerIp(ctx, link)
          if (!ip) continue
          ab.line(`neighbor ${ip.peerIp} activate`)
          ab.line(`neighbor ${ip.peerIp} next-hop-unchanged`)
        }
      })

      for (const vrf of vrfsOnSwitch(ctx)) {
        b.blank()
        b.block(`vrf ${vrf.name}`, (vb) => {
          vb.block('address-family l2vpn evpn', (ab) => {
            ab.line('route-target both auto')
            ab.line(`route-distinguisher ${loopback}:${sortedVrfIndex(ctx, vrf.id)}`)
          })
        })
      }
    }
  })
  out.blank()
}
