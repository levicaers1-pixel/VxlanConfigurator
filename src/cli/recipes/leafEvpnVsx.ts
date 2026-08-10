import type { SectionBuilder } from '../context'
import { hostname } from '../sections/hostname'
import { management } from '../sections/management'
import { interfacesPhysical } from '../sections/interfaces'
import { vsx } from '../sections/vsx'
import { vlansAndSvis } from '../sections/vlansAndSvis'
import { vrfs } from '../sections/vrfs'
import { underlayOspf } from '../sections/underlayOspf'
import { underlayBgp } from '../sections/underlayBgp'
import { overlayEvpnBgp } from '../sections/overlayEvpnBgp'
import { overlayEvpn } from '../sections/overlayEvpn'
import { evpnVlans } from '../sections/evpnVlans'

export const leafEvpnVsx: SectionBuilder[] = [
  hostname,
  management,
  interfacesPhysical,
  vsx,
  vlansAndSvis,
  vrfs,
  evpnVlans,
  underlayOspf,
  underlayBgp,
  overlayEvpnBgp,
  overlayEvpn,
]
