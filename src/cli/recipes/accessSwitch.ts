import type { SectionBuilder } from '../context'
import { hostname } from '../sections/hostname'
import { baseline } from '../sections/baseline'
import { management } from '../sections/management'
import { accessPorts } from '../sections/accessPorts'

/** Access-layer switches: hostname, baseline, mgmt, and plain trunk uplinks — no fabric/VXLAN config. */
export const accessSwitch: SectionBuilder[] = [hostname, baseline, management, accessPorts]
