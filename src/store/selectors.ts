import { useMemo } from 'react'
import { computeIpPlan } from '../ip/allocate'
import type { IpAllocationResult, Project } from '../domain/types'
import { useProjectStore } from './useProjectStore'

/** Recomputes the full IP/VNI/ASN plan whenever the project's relevant shape changes. */
export function useIpPlan(): IpAllocationResult | null {
  const project = useProjectStore((s) => s.project)
  const depKey = project
    ? JSON.stringify({
        switches: project.switches,
        links: project.links,
        vlans: project.vlans,
        vrfs: project.vrfs,
        settings: project.settings,
      })
    : null

  return useMemo(() => {
    if (!project) return null
    return computeIpPlan(project)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey])
}

export function projectIsEmpty(project: Project | null): boolean {
  return !project || project.switches.length === 0
}
