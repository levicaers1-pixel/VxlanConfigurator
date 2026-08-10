import type { SectionBuilder } from '../context'
import { hostname } from '../sections/hostname'
import { management } from '../sections/management'
import { accessPorts } from '../sections/accessPorts'

/** Access-layer switches: hostname, mgmt, and plain trunk uplinks — no fabric/VXLAN config. */
export const accessSwitch: SectionBuilder[] = [hostname, management, accessPorts]
