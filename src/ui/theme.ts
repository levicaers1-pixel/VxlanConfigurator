import type { LinkKind, PortSpeedGbps, SwitchRole } from '../domain/types'

export const ROLE_COLOR: Record<SwitchRole, { bg: string; border: string; text: string; solid: string }> = {
  spine: { bg: 'bg-sky-950/80', border: 'border-sky-500/70', text: 'text-sky-100', solid: '#38bdf8' },
  leaf: { bg: 'bg-emerald-950/80', border: 'border-emerald-500/70', text: 'text-emerald-100', solid: '#34d399' },
  border: { bg: 'bg-amber-950/80', border: 'border-amber-500/70', text: 'text-amber-100', solid: '#fbbf24' },
  access: { bg: 'bg-violet-950/80', border: 'border-violet-500/70', text: 'text-violet-100', solid: '#a78bfa' },
  standalone: { bg: 'bg-slate-800/80', border: 'border-slate-500/70', text: 'text-slate-100', solid: '#94a3b8' },
}

export const LINK_KIND_COLOR: Record<LinkKind, string> = {
  'underlay-p2p': '#38bdf8',
  'vsx-isl': '#f472b6',
  'vsx-keepalive': '#fbbf24',
  mgmt: '#94a3b8',
  unassigned: '#64748b',
}

export const LINK_KIND_LABEL: Record<LinkKind, string> = {
  'underlay-p2p': 'Underlay',
  'vsx-isl': 'VSX ISL',
  'vsx-keepalive': 'VSX keepalive',
  mgmt: 'Management',
  unassigned: 'Unassigned',
}

export const SPEED_COLOR: Record<PortSpeedGbps, string> = {
  1: '#64748b',
  10: '#818cf8',
  25: '#38bdf8',
  40: '#a78bfa',
  100: '#fb923c',
  400: '#f87171',
}
