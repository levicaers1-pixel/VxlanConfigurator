import type { SectionBuilder } from '../context'
import { hostname } from '../sections/hostname'
import { baseline } from '../sections/baseline'
import { management } from '../sections/management'
import { interfacesPhysical } from '../sections/interfaces'
import { underlayOspf } from '../sections/underlayOspf'
import { underlayBgp } from '../sections/underlayBgp'
import { spineEvpnRouteReflector } from '../sections/spineEvpnRr'

export const spineEvpn: SectionBuilder[] = [
  hostname,
  baseline,
  management,
  interfacesPhysical,
  underlayOspf,
  underlayBgp,
  spineEvpnRouteReflector,
]
