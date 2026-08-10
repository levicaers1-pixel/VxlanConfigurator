import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-sky-600 hover:bg-sky-500 text-white shadow-sm shadow-sky-950/50 border border-sky-500/50',
  secondary: 'border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:border-slate-600',
  ghost: 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100',
  danger: 'border border-rose-900 bg-rose-950/40 text-rose-200 hover:bg-rose-950 hover:border-rose-700',
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-[11px] gap-1',
  md: 'px-3 py-1.5 text-xs gap-1.5',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
}

export function Button({ variant = 'secondary', size = 'md', icon, className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

export function IconButton({
  icon,
  className = '',
  variant = 'secondary',
  ...rest
}: Omit<ButtonProps, 'children' | 'icon'> & { icon: ReactNode }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md border p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        variant === 'secondary'
          ? 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-slate-100'
          : VARIANT_CLASS[variant]
      } ${className}`}
      {...rest}
    >
      {icon}
    </button>
  )
}

export const inputClass =
  'rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none transition-colors focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40'

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-slate-400">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-slate-600">{hint}</span>}
    </label>
  )
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{children}</h3>
}

export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <div className="text-slate-600">{icon}</div>
      <p className="text-xs font-medium text-slate-400">{title}</p>
      {hint && <p className="max-w-[220px] text-[11px] text-slate-600">{hint}</p>}
    </div>
  )
}
