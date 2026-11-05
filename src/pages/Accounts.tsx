import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, Plus, Search, Upload } from 'lucide-react'
import { useStore } from '../lib/store'
import { ACCOUNT_TYPES, ALL_VILLAGES, Account, AccountType, PRIORITIES, STATUSES, territoryOf } from '../types'
import { AccountForm } from '../components/forms'
import { Badge, DemoBadge, EmptyState, ExportMenu, PageHeader, useAction, useToast } from '../components/ui'
import { daysSince, exportCSV, exportXLS, fmtDate, money } from '../lib/utils'
import { PRIORITY_ORDER } from '../lib/seed'

type SortKey = 'name' | 'priority' | 'monthlyPotential' | 'lastVisit' | 'status'

export function accountRows(list: Account[], repName: (id: string) => string) {
  return list.map(a => ({
    'Account ID': a.accountNo, 'Business Name': a.name, 'Account Type': a.type, Segment: a.segment, Village: a.village,
    Territory: territoryOf(a.village), Address: a.address, 'Contact Person': a.contactName, 'Contact Position': a.contactPosition,
    Phone: a.phone, Email: a.email, 'Assigned Rep': repName(a.repId), Priority: a.priority, Status: a.status,
    'Est. Monthly Potential': a.monthlyPotential, 'Actual Monthly Sales': a.monthlySales,
    'Products Purchased': a.currentProducts, 'Potential Products': a.potentialProducts, 'Competitor / Supplier': a.competitor,
    'Last Visit': a.lastVisit ?? '', 'Next Follow-up': a.nextFollowUp ?? '', Notes: a.notes, 'Date Created': a.createdAt.slice(0, 10),
  }))
}

export default function Accounts({ fixedType }: { fixedType?: AccountType }) {
  const { accounts, profiles, repName, isAdmin, assignAccounts } = useStore()
  const run = useAction()
  const toast = useToast()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [assignTo, setAssignTo] = useState('')
  const [q, setQ] = useState('')
  const [type, setType] = useState<string>('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [village, setVillage] = useState('')
  const [rep, setRep] = useState('')
  const [stale, setStale] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'priority', dir: 1 })
  const [adding, setAdding] = useState(false)

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const list = accounts.filter(a =>
      (!fixedType || a.type === fixedType) &&
      (!type || a.type === type) && (!status || a.status === status) && (!priority || a.priority === priority) &&
      (!village || a.village === village) && (!rep || a.repId === rep) &&
      (!stale || daysSince(a.lastVisit) === null || (daysSince(a.lastVisit) ?? 0) >= 30) &&
      (!ql || [a.name, a.contactName, a.segment, a.village, a.accountNo, a.potentialProducts].join(' ').toLowerCase().includes(ql)),
    )
    const cmp = (a: Account, b: Account) => {
      switch (sort.key) {
        case 'name': return a.name.localeCompare(b.name)
        case 'priority': return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.monthlyPotential - a.monthlyPotential
        case 'monthlyPotential': return a.monthlyPotential - b.monthlyPotential
        case 'lastVisit': return (a.lastVisit ?? '') < (b.lastVisit ?? '') ? -1 : 1
        case 'status': return a.status.localeCompare(b.status)
      }
    }
    return [...list].sort((a, b) => cmp(a, b) * sort.dir)
  }, [accounts, q, type, status, priority, village, rep, stale, sort, fixedType])

  const title = fixedType ? `${fixedType} Accounts` : 'Account Directory'
  const th = (label: string, key: SortKey) => (
    <th className="th cursor-pointer select-none" onClick={() => setSort(s => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))}>
      <span className="inline-flex items-center gap-1">{label}{sort.key === key && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</span>
    </th>
  )
  const exp = () => accountRows(rows, repName)

  return (
    <>
      <PageHeader
        title={title}
        subtitle={`${rows.length} of ${accounts.filter(a => !fixedType || a.type === fixedType).length} accounts`}
        actions={<>
          <ExportMenu onCSV={() => exportCSV(title.toLowerCase().replace(/\s+/g, '-'), exp())} onXLS={() => exportXLS(title.toLowerCase().replace(/\s+/g, '-'), exp())} />
          {isAdmin && <Link to="/accounts/import" className="btn-secondary"><Upload size={16} /> Import</Link>}
          {isAdmin && <Link to="/accounts/sales-update" className="btn-secondary"><Upload size={16} /> Sales update</Link>}
          <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={16} /> Add {isAdmin ? 'account' : 'prospect'}</button>
        </>}
      />
      <div className="card p-3 mb-4 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
        <div className="relative col-span-2">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input className="input pl-9" placeholder="Search name, contact, village, ID…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {!fixedType && <select className="input" value={type} onChange={e => setType(e.target.value)}><option value="">All types</option>{ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}</select>}
        <select className="input" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{STATUSES.map(t => <option key={t}>{t}</option>)}</select>
        <select className="input" value={priority} onChange={e => setPriority(e.target.value)}><option value="">All priorities</option>{PRIORITIES.map(t => <option key={t}>{t}</option>)}</select>
        <select className="input" value={village} onChange={e => setVillage(e.target.value)}><option value="">All villages</option>{ALL_VILLAGES.map(t => <option key={t}>{t}</option>)}</select>
        {isAdmin && <select className="input" value={rep} onChange={e => setRep(e.target.value)}><option value="">All reps</option>{profiles.filter(p => p.role === 'rep').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
        <label className="flex items-center gap-2 text-sm px-2"><input type="checkbox" checked={stale} onChange={e => setStale(e.target.checked)} /> Not visited 30d+</label>
      </div>

      {isAdmin && selected.size > 0 && (
        <div className="card p-3 mb-3 flex flex-wrap items-center gap-2 bg-navy-50 border-navy-200">
          <span className="text-sm font-semibold text-navy-900">{selected.size} selected</span>
          <select id="bulk-rep" className="input !w-auto" value={assignTo} onChange={e => setAssignTo(e.target.value)}>
            <option value="">Choose a rep…</option><option value="__none">Unassign</option>
            {profiles.filter(p => p.role === 'rep' && p.active).map(p => <option key={p.id} value={p.id}>{p.name}{p.channel && p.channel !== 'All' ? ` · ${p.channel}` : ''}</option>)}
          </select>
          <button className="btn-primary" disabled={!assignTo}
            onClick={() => {
              const r = run(() => assignAccounts([...selected], assignTo === '__none' ? '' : assignTo))
              if (r) toast(r.skipped ? `${r.assigned} assigned. ${r.skipped} skipped: that rep's sales channel does not cover those account types.` : `${r.assigned} accounts updated`, r.skipped ? 'err' : undefined)
              setSelected(new Set()); setAssignTo('')
            }}>Assign</button>
          <button className="btn-secondary" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead><tr>{isAdmin && <th className="th w-8"><input type="checkbox" aria-label="Select all shown" checked={rows.length > 0 && rows.every(r => selected.has(r.id))} onChange={e => setSelected(e.target.checked ? new Set(rows.map(r => r.id)) : new Set())} /></th>}{th('Account', 'name')}<th className="th">Type / Segment</th><th className="th">Village</th>{th('Priority', 'priority')}{th('Status', 'status')}{th('Potential/mo', 'monthlyPotential')}<th className="th">Rep</th>{th('Last visit', 'lastVisit')}<th className="th">Next follow-up</th></tr></thead>
          <tbody>
            {rows.map(a => (
              <tr key={a.id} className="hover:bg-slate-50">
                {isAdmin && <td className="td w-8"><input type="checkbox" aria-label={`Select ${a.name}`} checked={selected.has(a.id)} onChange={e => setSelected(s => { const n = new Set(s); if (e.target.checked) n.add(a.id); else n.delete(a.id); return n })} /></td>}
                <td className="td"><Link to={`/account/${a.id}`} className="font-medium text-navy-700 hover:underline">{a.name}</Link>{a.isDemo && <span className="ml-2"><DemoBadge /></span>}<div className="text-xs text-slate-400">{a.accountNo}</div></td>
                <td className="td">{a.type}<div className="text-xs text-slate-500">{a.segment}</div></td>
                <td className="td">{a.village}<div className="text-xs text-slate-500">{territoryOf(a.village)}</div></td>
                <td className="td"><Badge>{a.priority}</Badge></td>
                <td className="td"><Badge>{a.status}</Badge></td>
                <td className="td">{money(a.monthlyPotential)}{a.isDemo && <div className="text-[10px] text-amber-700">illustrative est.</div>}</td>
                <td className="td">{repName(a.repId)}</td>
                <td className="td">{fmtDate(a.lastVisit)}</td>
                <td className="td">{fmtDate(a.nextFollowUp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState title="No accounts match" hint="Adjust filters or add a new account." />}
      </div>
      {adding && <AccountForm open onClose={() => setAdding(false)} />}
    </>
  )
}
