import { AlertTriangle } from 'lucide-react'
import type { IpAllocationResult } from '../domain/types'

export function ValidationBanner({ ipPlan }: { ipPlan: IpAllocationResult | null }) {
  if (!ipPlan || ipPlan.errors.length === 0) return null
  const errorCount = ipPlan.errors.filter((e) => e.severity === 'error').length
  const warningCount = ipPlan.errors.filter((e) => e.severity === 'warning').length

  return (
    <details className="border-b border-amber-900 bg-amber-950/40 px-3 py-1.5 text-xs text-amber-200">
      <summary className="flex cursor-pointer items-center gap-1.5">
        <AlertTriangle size={13} className="text-amber-400" />
        {errorCount > 0 && <span>{errorCount} allocation error{errorCount !== 1 ? 's' : ''}</span>}
        {errorCount > 0 && warningCount > 0 && ' · '}
        {warningCount > 0 && <span>{warningCount} warning{warningCount !== 1 ? 's' : ''}</span>}
      </summary>
      <ul className="mt-1 list-disc pl-4">
        {ipPlan.errors.map((e, i) => (
          <li key={i} className={e.severity === 'error' ? 'text-rose-300' : 'text-amber-300'}>
            {e.message}
          </li>
        ))}
      </ul>
    </details>
  )
}
