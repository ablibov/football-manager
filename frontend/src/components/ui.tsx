import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type InputHTMLAttributes } from 'react'
import { clsx } from '../lib/text'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({ variant = 'secondary', size = 'md', className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      type="button"
      {...rest}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 select-none',
        size === 'sm' && 'h-8 px-3 text-sm',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-6 text-base',
        variant === 'primary' && 'bg-accent text-accent-ink hover:bg-accent-2 shadow-[0_8px_30px_-10px_var(--accent)]',
        variant === 'secondary' && 'bg-surface-2 text-fg border border-line hover:border-accent/60',
        variant === 'ghost' && 'text-muted hover:text-fg hover:bg-surface-2',
        variant === 'danger' && 'bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={clsx('rounded-2xl border border-line bg-surface p-4 sm:p-5', className)}>
      {children}
    </div>
  )
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-lg font-semibold tracking-tight sm:text-xl">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function PageHeader({ title, subtitle, icon, action }: { title: string; subtitle?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        {icon && <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent/12 text-accent">{icon}</div>}
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </header>
  )
}

export function Badge({ tone = 'neutral', children, className, title }: { tone?: 'neutral' | 'accent' | 'warning' | 'danger' | 'info'; children: ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap',
        tone === 'neutral' && 'bg-surface-2 text-muted border border-line',
        tone === 'accent' && 'bg-accent/15 text-accent',
        tone === 'warning' && 'bg-warning/15 text-warning',
        tone === 'danger' && 'bg-danger/15 text-danger',
        tone === 'info' && 'bg-info/15 text-info',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Select({ label, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: ReactNode }) {
  return (
    <label className={clsx('flex min-w-0 flex-col gap-1 text-xs font-medium text-muted', className)}>
      {label}
      <select {...rest} className="h-10 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-accent">
        {children}
      </select>
    </label>
  )
}

export function Input({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  return (
    <label className={clsx('flex min-w-0 flex-col gap-1 text-xs font-medium text-muted', className)}>
      {label}
      <input {...rest} className="h-10 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-accent" />
    </label>
  )
}

export function Segmented<T extends string | number>({ value, options, onChange, className, size = 'md' }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; className?: string; size?: 'sm' | 'md' }) {
  return (
    <div className={clsx('inline-flex max-w-full overflow-x-auto rounded-xl border border-line bg-surface-2 p-1 scrollbar-thin', className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'relative whitespace-nowrap rounded-lg font-medium transition-colors',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            o.value === value ? 'bg-accent text-accent-ink' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-line')}
      >
        <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-5.5' : 'left-0.5')} />
      </button>
      <span>{label}</span>
    </label>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onMouseDown={(e) => e.stopPropagation()}
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            className={clsx('max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-elev p-5 shadow-2xl sm:rounded-3xl scrollbar-thin', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="font-display text-lg font-semibold">{title}</h3>
              <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      {icon && <div className="text-faint">{icon}</div>}
      <div className="font-display font-semibold">{title}</div>
      {text && <p className="max-w-md text-sm text-muted">{text}</p>}
      {action}
    </div>
  )
}

export function RatingPill({ value, className }: { value: number; className?: string }) {
  const tone = value >= 75 ? 'bg-accent text-accent-ink' : value >= 68 ? 'bg-accent/25 text-accent' : value >= 60 ? 'bg-warning/20 text-warning' : 'bg-danger/15 text-danger'
  return <span className={clsx('inline-grid h-7 min-w-9 place-items-center rounded-lg px-1.5 text-sm font-bold tabular', tone, className)}>{value}</span>
}

export function Bar({ value, max = 100, className }: { value: number; max?: number; className?: string }) {
  return (
    <div className={clsx('h-1.5 w-full overflow-hidden rounded-full bg-line', className)}>
      <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} transition={{ duration: 0.6 }} />
    </div>
  )
}
