import { ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react'
import { X, CheckCircle2, AlertTriangle } from 'lucide-react'
import { cx } from '../lib/utils'

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-navy-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function KPI({ label, value, hint, icon, tone = 'navy' }: {
  label: string; value: string | number; hint?: string; icon?: ReactNode; tone?: 'navy' | 'green' | 'amber' | 'red'
}) {
  const toneCls = { navy: 'bg-navy-50 text-navy-700', green: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700' }[tone]
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
          <div className="mt-1.5 text-2xl font-bold text-navy-900 truncate">{value}</div>
          {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
        </div>
        {icon && <div className={cx('shrink-0 rounded-lg p-2', toneCls)}>{icon}</div>}
      </div>
    </div>
  )
}

const BADGE: Record<string, string> = {
  'A+': 'bg-navy-800 text-white', A: 'bg-navy-100 text-navy-800', B: 'bg-slate-100 text-slate-700', C: 'bg-slate-50 text-slate-500 border border-slate-200',
  Prospect: 'bg-sky-100 text-sky-800', Active: 'bg-emerald-100 text-emerald-800', Inactive: 'bg-slate-200 text-slate-600', 'On Hold': 'bg-amber-100 text-amber-800',
  Won: 'bg-emerald-100 text-emerald-800', Lost: 'bg-red-100 text-red-700',
  Planned: 'bg-sky-100 text-sky-800', Completed: 'bg-emerald-100 text-emerald-800', Cancelled: 'bg-slate-200 text-slate-600', Visited: 'bg-emerald-100 text-emerald-800', Skipped: 'bg-slate-200 text-slate-600',
  Demo: 'bg-amber-100 text-amber-800 border border-amber-200',
}
export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  const key = tone ?? String(children)
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap', BADGE[key] ?? 'bg-slate-100 text-slate-700')}>{children}</span>
}
export const DemoBadge = () => <Badge tone="Demo">Demo</Badge>

export function Modal({ title, open, onClose, children, wide }: { title: string; open: boolean; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-navy-900/50 p-0 sm:p-4" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={cx('bg-white w-full rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] flex flex-col', wide ? 'sm:max-w-3xl' : 'sm:max-w-xl')}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-navy-900">{title}</h2>
          <button className="p-1 rounded hover:bg-slate-100" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="label">{label}</span>
      {children}
    </label>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="text-center py-10 px-4">
      <div className="text-sm font-semibold text-slate-600">{title}</div>
      {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
    </div>
  )
}

export function ConfirmButton({ onConfirm, label = 'Delete', message = 'Delete this record? This cannot be undone.', className = 'btn-danger', children }: {
  onConfirm: () => void; label?: string; message?: string; className?: string; children?: ReactNode
}) {
  return (
    <button type="button" className={className} onClick={() => { if (window.confirm(message)) onConfirm() }}>
      {children ?? label}
    </button>
  )
}

/* ---------- toast ---------- */
type Toast = { id: number; msg: string; kind: 'ok' | 'err' }
const ToastCtx = createContext<(msg: string, kind?: 'ok' | 'err') => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([])
  const push = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random()
    setList(l => [...l, { id, msg, kind }])
    setTimeout(() => setList(l => l.filter(t => t.id !== id)), 3500)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] space-y-2 pointer-events-none">
        {list.map(t => (
          <div key={t.id} className={cx('pointer-events-auto flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm shadow-lg text-white', t.kind === 'ok' ? 'bg-navy-800' : 'bg-red-600')}>
            {t.kind === 'ok' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/** Run a store mutation and surface permission errors as a toast. */
export function useAction() {
  const toast = useToast()
  return useCallback(<T,>(fn: () => T, ok?: string): T | undefined => {
    try {
      const r = fn()
      if (ok) toast(ok)
      return r
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Action failed', 'err')
      return undefined
    }
  }, [toast])
}

export function ExportMenu({ onCSV, onXLS }: { onCSV: () => void; onXLS: () => void }) {
  return (
    <>
      <button className="btn-secondary" onClick={onCSV}>Export CSV</button>
      <button className="btn-secondary" onClick={onXLS}>Export Excel</button>
    </>
  )
}
