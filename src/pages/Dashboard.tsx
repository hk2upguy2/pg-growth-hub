import { Link } from 'react-router-dom'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { AlertTriangle, Building2, CalendarCheck, DollarSign, Hotel, ShoppingCart, Target, TrendingUp, UserPlus, UserCheck, UtensilsCrossed, Footprints, Users } from 'lucide-react'
import { useStore } from '../lib/store'
import { dashboard, followUpsDue, pipelineByStage, staleAccounts } from '../lib/analytics'
import { Badge, DemoBadge, EmptyState, KPI, PageHeader } from '../components/ui'
import { daysSince, fmtDate, fmtDateTime, money, moneyShort, monthLabel } from '../lib/utils'
import { channelAllows, type SalesRecord } from '../types'

const PIE = ['#0f2a4a', '#2c5d96', '#7fa3cc', '#b3c9e3']

export default function Dashboard() {
  const { accounts, activities, opportunities, profiles, isAdmin, user, repName, accountName, sales } = useStore()
  const d = dashboard(accounts, activities, opportunities, profiles)
  const stages = pipelineByStage(opportunities).filter(s => s.stage !== 'Lost')
  const overdue = followUpsDue(activities).sort((a, b) => (a.followUpDate! < b.followUpDate! ? -1 : 1))
  const stale = staleAccounts(accounts, 30).slice(0, 5)
  const recent = [...activities].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 8)
  const noData = accounts.length === 0

  return (
    <>
      <PageHeader
        title={isAdmin ? 'Management Dashboard' : 'My Dashboard'}
        subtitle={isAdmin ? 'All accounts, representatives and pipeline' : `Your assigned accounts and pipeline · ${user?.name}`}
      />
      <SalesFreshness sales={sales} isAdmin={isAdmin} />
      {noData && <div className="card p-6 mb-5"><EmptyState title="No accounts yet" hint="Add accounts from the Account Directory to populate the dashboard. Every figure here is calculated from your records." /></div>}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 mb-5">
        <KPI label="Total Accounts" value={d.totalAccounts} icon={<Building2 size={18} />} />
        <KPI label="Active Customers" value={d.activeCustomers} hint="Status = Active" icon={<UserCheck size={18} />} tone="green" />
        <KPI label="New Prospects" value={d.prospects} hint="Status = Prospect" icon={<UserPlus size={18} />} />
        {channelAllows(user?.channel, 'Retail') && <KPI label="Retail Accounts" value={d.retail} icon={<ShoppingCart size={18} />} />}
        {channelAllows(user?.channel, 'Foodservice') && <KPI label="Foodservice Accounts" value={d.foodservice} icon={<UtensilsCrossed size={18} />} />}
        {channelAllows(user?.channel, 'Hotel') && <KPI label="Hotel Accounts" value={d.hotel} icon={<Hotel size={18} />} />}
        <KPI label="Monthly Sales Potential" value={moneyShort(d.monthlyPotential)} hint={`Actual sales ${moneyShort(d.actualMonthlySales)}/mo`} icon={<DollarSign size={18} />} />
        <KPI label="Opportunity Pipeline" value={moneyShort(d.pipeline.gross)} hint={`Weighted ${moneyShort(d.pipeline.weighted)} · ${d.pipeline.openCount} open`} icon={<Target size={18} />} />
        <KPI label="Visited This Month" value={d.visitedThisMonth} hint={`of ${d.totalAccounts} accounts`} icon={<Footprints size={18} />} />
        <KPI label="Follow-ups Due" value={d.followUpsDue} hint="Due today or overdue" icon={<CalendarCheck size={18} />} tone={d.followUpsDue ? 'amber' : 'green'} />
        <KPI label="New Accounts This Month" value={d.newAccountsThisMonth} icon={<TrendingUp size={18} />} />
        <KPI label="Opportunities Won" value={d.pipeline.wonCount} hint={`${moneyShort(d.pipeline.won)}/mo recorded`} icon={<Users size={18} />} tone="green" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-5">
        <div className="card p-4 xl:col-span-2">
          <h3 className="font-semibold text-navy-900 mb-3">Monthly activity (last 6 months)</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={d.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip /><Legend />
                <Line type="monotone" dataKey="Activities" stroke="#0f2a4a" strokeWidth={2.5} dot />
                <Line type="monotone" dataKey="Visits" stroke="#7fa3cc" strokeWidth={2.5} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold text-navy-900 mb-3">Account distribution</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={d.distribution.filter(x => x.value > 0)} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2} label={({ name, value }) => `${name} ${value}`}>
                  {d.distribution.filter(x => x.value > 0).map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card p-4 mb-5">
        <h3 className="font-semibold text-navy-900 mb-1">Opportunity pipeline by stage</h3>
        <p className="text-xs text-slate-500 mb-3">Estimated monthly value vs probability-weighted value (illustrative estimates for demo records)</p>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={stages}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="stage" tick={{ fontSize: 11 }} interval={0} /><YAxis tickFormatter={moneyShort} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => money(Number(v))} /><Legend />
              <Bar dataKey="value" name="Gross value" fill="#b3c9e3" radius={[4, 4, 0, 0]} />
              <Bar dataKey="weighted" name="Weighted value" fill="#0f2a4a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-5">
        <div className="card">
          <div className="px-4 pt-4 flex justify-between items-center"><h3 className="font-semibold text-navy-900">Top 10 priority accounts</h3><Link className="text-xs text-navy-600 hover:underline" to="/accounts">View all</Link></div>
          <div className="overflow-x-auto mt-2">
            <table className="w-full"><thead><tr><th className="th">Account</th><th className="th">Priority</th><th className="th">Potential/mo</th><th className="th">Last visit</th></tr></thead>
              <tbody>
                {d.top10.map(a => (
                  <tr key={a.id}>
                    <td className="td"><Link className="font-medium text-navy-700 hover:underline" to={`/account/${a.id}`}>{a.name}</Link>{a.isDemo && <span className="ml-2"><DemoBadge /></span>}</td>
                    <td className="td"><Badge>{a.priority}</Badge></td>
                    <td className="td">{money(a.monthlyPotential)}</td>
                    <td className="td">{daysSince(a.lastVisit) === null ? 'Never' : `${daysSince(a.lastVisit)}d ago`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {d.top10.length === 0 && <EmptyState title="No accounts" />}
          </div>
        </div>

        <div className="card">
          <div className="px-4 pt-4 flex justify-between items-center"><h3 className="font-semibold text-navy-900 flex items-center gap-2"><AlertTriangle size={16} className="text-amber-600" /> Overdue / due follow-ups</h3><Link className="text-xs text-navy-600 hover:underline" to="/activities">Activities</Link></div>
          <ul className="divide-y divide-slate-100 mt-2">
            {overdue.slice(0, 8).map(a => (
              <li key={a.id} className="px-4 py-2.5 text-sm flex justify-between gap-3">
                <div className="min-w-0"><Link className="font-medium text-navy-700 hover:underline" to={`/account/${a.accountId}`}>{accountName(a.accountId)}</Link><div className="text-xs text-slate-500 truncate">{a.nextAction || a.summary}</div></div>
                <div className="text-right shrink-0"><div className={a.followUpDate! < new Date().toISOString().slice(0, 10) ? 'text-red-600 font-semibold text-xs' : 'text-amber-700 text-xs font-semibold'}>{fmtDate(a.followUpDate)}</div><div className="text-xs text-slate-500">{repName(a.repId)}</div></div>
              </li>
            ))}
            {overdue.length === 0 && <EmptyState title="No follow-ups due" />}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-5">
        <div className="card">
          <h3 className="font-semibold text-navy-900 px-4 pt-4">Recent sales activities</h3>
          <ul className="divide-y divide-slate-100 mt-2">
            {recent.map(a => (
              <li key={a.id} className="px-4 py-2.5 text-sm">
                <div className="flex justify-between gap-2"><span className="font-medium">{a.type} · <Link className="text-navy-700 hover:underline" to={`/account/${a.accountId}`}>{accountName(a.accountId)}</Link></span><span className="text-xs text-slate-500 shrink-0">{fmtDateTime(a.at)}</span></div>
                <div className="text-xs text-slate-500">{repName(a.repId)} — {a.summary}</div>
              </li>
            ))}
            {recent.length === 0 && <EmptyState title="No activities logged" />}
          </ul>
        </div>

        <div className="card">
          <h3 className="font-semibold text-navy-900 px-4 pt-4">Sales representative leaderboard</h3>
          <p className="text-xs text-slate-500 px-4">Ranked by weighted pipeline, then activity this month</p>
          <div className="overflow-x-auto mt-2">
            <table className="w-full"><thead><tr><th className="th">#</th><th className="th">Rep</th><th className="th">Accts</th><th className="th">Activities (mo)</th><th className="th">Opps</th><th className="th">Weighted pipeline</th></tr></thead>
              <tbody>
                {d.leaderboard.map((r, i) => (
                  <tr key={r.id}><td className="td font-semibold">{i + 1}</td><td className="td">{r.name}</td><td className="td">{r.accounts}</td><td className="td">{r.activities}</td><td className="td">{r.opportunities}</td><td className="td font-medium">{money(r.weighted)}</td></tr>
                ))}
              </tbody>
            </table>
            {d.leaderboard.length === 0 && <EmptyState title="No representatives" />}
          </div>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-semibold text-navy-900 mb-1">Not visited in 30+ days</h3>
        <p className="text-xs text-slate-500 mb-3">Highest priority and potential first</p>
        <div className="flex flex-wrap gap-2">
          {stale.map(a => <Link key={a.id} to={`/account/${a.id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-navy-50"><Badge>{a.priority}</Badge> <span className="ml-1">{a.name}</span> <span className="text-xs text-slate-500">· {daysSince(a.lastVisit) === null ? 'never' : `${daysSince(a.lastVisit)}d`}</span></Link>)}
          {stale.length === 0 && <span className="text-sm text-slate-500">All accounts visited within 30 days.</span>}
        </div>
      </div>
    </>
  )
}

function SalesFreshness({ sales, isAdmin }: { sales: SalesRecord[]; isAdmin: boolean }) {
  if (!sales.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 mb-4 text-sm text-slate-600">
        No Sage sales data loaded yet. {isAdmin && <Link className="text-navy-700 underline" to="/accounts/sales-update">Load a sales file</Link>}
      </div>
    )
  }
  const through = [...sales].map(s => s.month).sort().pop()!
  const updated = [...sales].map(s => s.importedAt).sort().pop()!
  const age = daysSince(updated) ?? 0
  const stale = age > 35
  return (
    <div className={`rounded-lg border px-4 py-2.5 mb-4 text-sm ${stale ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-600'}`}>
      Sage sales data through <strong>{monthLabel(through)}</strong>, last updated {fmtDate(updated)}{stale ? ` (${age} days ago)` : ''}.
      {stale && isAdmin && <> <Link className="underline" to="/accounts/sales-update">Load the latest file</Link></>}
    </div>
  )
}
