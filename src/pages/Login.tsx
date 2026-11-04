import { useStore } from '../lib/store'
import { Badge } from '../components/ui'
import { FlaskConical } from 'lucide-react'

export default function Login() {
  const { profiles, login } = useStore()
  const active = profiles.filter(p => p.active)
  return (
    <div className="min-h-full flex items-center justify-center bg-navy-800 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
        <div className="text-2xl font-bold text-navy-900">PG Growth Hub</div>
        <div className="text-sm text-slate-500 mb-5">Pacific Grocers · Guam Sales CRM</div>
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex gap-2 mb-5">
          <FlaskConical size={16} className="shrink-0 mt-0.5" />
          <span>Demo mode (no Supabase credentials configured). Choose a demo user to explore. Roles are enforced in the data layer: sales reps only see their assigned accounts.</span>
        </div>
        <div className="space-y-2">
          {active.map(p => (
            <button key={p.id} onClick={() => login(p.id)} className="w-full text-left rounded-lg border border-slate-200 hover:border-navy-400 hover:bg-navy-50 px-4 py-3 transition">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-navy-900 text-sm">{p.name}</span>
                <Badge tone={p.role === 'admin' ? 'A+' : 'A'}>{p.role === 'admin' ? 'Management' : 'Sales Rep'}</Badge>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{p.role === 'admin' ? 'All accounts, users and reports' : `Territory: ${p.territory}`}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
