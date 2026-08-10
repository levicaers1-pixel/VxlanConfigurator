import type { SectionBuilder } from '../context'
import { hostname } from '../sections/hostname'
import { management } from '../sections/management'
import { interfacesPhysical } from '../sections/interfaces'
import { vsx } from '../sections/vsx'
import { vlansAndSvis } from '../sections/vlansAndSvis'
import { vrfs } from '../sections/vrfs'
import { underlayOspf } from '../sections/underlayOspf'
import { underlayBgp } from '../sections/underlayBgp'
import { overlayStaticVxlan } from '../sections/overlayStaticVxlan'

/**
 * Single recipe applied to every switch in static-VXLAN mode, regardless of
 * role — static mode's primary supported shape is a flat VSX pair or a
 * small point-to-point VTEP mesh, not a spine/leaf hierarchy.
 */
export const staticVxlan: SectionBuilder[] = [
  hostname,
  management,
  interfacesPhysical,
  vsx,
  vlansAndSvis,
  vrfs,
  underlayOspf,
  underlayBgp,
  overlayStaticVxlan,
]
