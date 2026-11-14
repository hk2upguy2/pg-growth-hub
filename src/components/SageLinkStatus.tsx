import { useEffect, useState } from 'react'
import { hasSupabase, supabase } from '../lib/supabase'

interface Sync { last_run: string | null; ok: boolean | null; message: string | null; orders_sent: number; invoices_matched: number }
const ago = (iso: string) => { const m = Math.round((Date.now() - +new Date(iso)) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago` }

/** One line showing whether the Sage link on the office server is alive. */
export function SageLinkStatus() {
  const [s, setS] = useState<Sync | null | 'none'>(null)
  useEffect(() => {
    if (!hasSupabase || !supabase) { setS('none'); return }
    let live = true
    const load = () => supabase!.from('sage_sync').select('*').eq('id', 1).maybeSingle().then(({ data }) => { if (live) setS((data as Sync | null) ?? 'none') }, () => { if (live) setS('none') })
    void load(); const t = setInterval(load, 60000)
    return () => { live = false; clearInterval(t) }
  }, [])
  if (s === null) return null
  if (s === 'none' || !s.last_run) return <span className="text-xs text-slate-500">Sage link: {hasSupabase ? 'not running yet' : 'not connected (demo)'}</span>
  const stale = Date.now() - +new Date(s.last_run) > 20 * 60000
  const tone = !s.ok ? 'text-red-700' : stale ? 'text-amber-700' : 'text-green-700'
  return <span className={`text-xs font-medium ${tone}`} title={s.message ?? ''}>Sage link: {!s.ok ? 'problem, ' : stale ? 'no sync since ' : 'synced '}{ago(s.last_run)}{s.message ? ` · ${s.message.slice(0, 80)}` : ''}</span>
}
