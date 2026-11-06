import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useNotices } from '../lib/notifications'

const dot = { red: 'bg-red-500', amber: 'bg-amber-500', blue: 'bg-navy-500' }
export function NotificationBell({ dark }: { dark?: boolean }) {
  const notices = useNotices()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <button aria-label={`Notifications${notices.length ? `, ${notices.length}` : ''}`} onClick={() => setOpen(o => !o)} className={`relative p-2 rounded-lg ${dark ? 'text-white hover:bg-white/10' : 'text-navy-200 hover:bg-white/10'}`}>
        <Bell size={19} />
        {notices.length > 0 && <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">{notices.length}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-80 max-w-[90vw] rounded-xl bg-white shadow-xl border border-slate-200 text-slate-800 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200 font-semibold text-navy-900 text-sm">Needs your attention</div>
          {notices.length === 0 ? <div className="p-4 text-sm text-slate-500">Nothing needs attention right now.</div> : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-slate-100">
              {notices.map(n => (
                <li key={n.id}><Link to={n.to} onClick={() => setOpen(false)} className="flex gap-3 px-4 py-3 hover:bg-slate-50">
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dot[n.tone]}`} />
                  <span className="text-sm"><span className="font-medium text-navy-900">{n.title}</span><br /><span className="text-xs text-slate-500">{n.detail}</span></span>
                </Link></li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
