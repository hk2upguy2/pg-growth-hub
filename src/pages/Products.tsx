import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../lib/store'
import { BRANDS, BrandName, PRODUCTS, STAGES } from '../types'
import { OpportunityForm } from '../components/forms'
import { Badge, EmptyState, KPI, PageHeader } from '../components/ui'
import { money, moneyShort } from '../lib/utils'
import { isOpen, pipelineTotals, weighted } from '../lib/analytics'

const FOCUS: Record<BrandName, string> = {
  Agrosuper: 'Bars, restaurants, hotels, Korean / chicken / BBQ restaurants, caterers, supermarkets',
  Hostess: 'Supermarkets, convenience stores, retail, hotels, foodservice outlets',
  Kikkoman: 'Japanese and Asian restaurants, hotels, supermarkets, foodservice',
}

export default function Products() {
  const { opportunities, accounts, accountName, repName } = useStore()
  const [brand, setBrand] = useState<BrandName>('Agrosuper')
  const [adding, setAdding] = useState(false)
  const list = useMemo(() => opportunities.filter(o => o.brand === brand), [opportunities, brand])
  const pt = pipelineTotals(list)

  const byProduct = PRODUCTS[brand].map(p => {
    const l = list.filter(o => o.product === p)
    return { product: p, count: l.length, gross: l.filter(isOpen).reduce((s, o) => s + o.monthlyValue, 0), weighted: l.reduce((s, o) => s + weighted(o), 0), won: l.filter(o => o.stage === 'Won').length }
  })

  // Questions management asked: ranked target lists per brand
  const target = useMemo(() => {
    const matches = (a: (typeof accounts)[number]) => {
      if (brand === 'Agrosuper') return ['Bar', 'Restaurant', 'Korean Restaurant', 'Chicken Restaurant', 'BBQ Restaurant', 'Catering'].includes(a.segment) || a.type === 'Hotel' || a.segment === 'Supermarket'
      if (brand === 'Hostess') return a.type === 'Retail' || a.type === 'Hotel' || a.type === 'Foodservice'
      return ['Japanese Restaurant', 'Asian Restaurant', 'Korean Restaurant', 'Supermarket'].includes(a.segment) || a.type === 'Hotel' || a.type === 'Foodservice'
    }
    return accounts.filter(a => a.status !== 'Inactive' && matches(a)).map(a => {
      const mine = list.filter(o => o.accountId === a.id)
      return { account: a, gross: mine.filter(isOpen).reduce((s, o) => s + o.monthlyValue, 0), count: mine.length }
    }).sort((x, y) => y.gross - x.gross || y.account.monthlyPotential - x.account.monthlyPotential)
  }, [accounts, list, brand])

  const uncovered = target.filter(t => t.count === 0)

  return (
    <>
      <PageHeader title="Product Tracking" subtitle="Agrosuper · Hostess · Kikkoman opportunity tracking"
        actions={<button className="btn-primary" onClick={() => setAdding(true)}>New {brand} opportunity</button>} />
      <div className="flex gap-2 mb-4 flex-wrap">
        {BRANDS.map(b => <button key={b} onClick={() => setBrand(b)} className={b === brand ? 'btn-primary' : 'btn-secondary'}>{b}</button>)}
      </div>
      <p className="text-sm text-slate-500 mb-4">Target accounts: {FOCUS[brand]}</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KPI label="Opportunities" value={list.length} />
        <KPI label="Open pipeline / mo" value={money(pt.gross)} />
        <KPI label="Weighted / mo" value={money(pt.weighted)} />
        <KPI label="Won" value={pt.wonCount} tone="green" hint={brand === 'Hostess' ? 'placements / listings' : undefined} />
      </div>

      <div className="card p-4 mb-4">
        <h3 className="font-semibold text-navy-900 mb-3">{brand === 'Hostess' ? 'Placement & display opportunities' : 'Opportunities by product'}</h3>
        <div className="h-60"><ResponsiveContainer>
          <BarChart data={byProduct}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="product" tick={{ fontSize: 11 }} interval={0} /><YAxis tickFormatter={moneyShort} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => money(Number(v))} /><Legend />
            <Bar dataKey="gross" name="Open value" fill="#b3c9e3" radius={[4, 4, 0, 0]} /><Bar dataKey="weighted" name="Weighted" fill="#0f2a4a" radius={[4, 4, 0, 0]} />
          </BarChart></ResponsiveContainer></div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-semibold text-navy-900 px-4 pt-4">Best-fit accounts for {brand}</h3>
          <p className="text-xs text-slate-500 px-4">Ranked by open {brand} pipeline, then account potential. “No opportunity” = not yet being worked.</p>
          <div className="overflow-x-auto mt-2"><table className="w-full"><thead><tr><th className="th">Account</th><th className="th">Segment</th><th className="th">Account potential</th><th className="th">{brand} pipeline</th></tr></thead>
            <tbody>{target.slice(0, 12).map(t => <tr key={t.account.id}><td className="td"><Link className="font-medium text-navy-700 hover:underline" to={`/account/${t.account.id}`}>{t.account.name}</Link></td><td className="td">{t.account.segment}</td><td className="td">{money(t.account.monthlyPotential)}</td><td className="td">{t.count ? money(t.gross) : <Badge tone="C">No opportunity</Badge>}</td></tr>)}</tbody></table>
            {target.length === 0 && <EmptyState title="No fitting accounts" />}</div>
          {uncovered.length > 0 && <div className="px-4 pb-3 text-xs text-slate-500">{uncovered.length} fitting account(s) have no {brand} opportunity yet.</div>}
        </div>
        <div className="card">
          <h3 className="font-semibold text-navy-900 px-4 pt-4">{brand} pipeline by stage</h3>
          <div className="overflow-x-auto mt-2"><table className="w-full"><thead><tr><th className="th">Stage</th><th className="th">Count</th><th className="th">Value / mo</th><th className="th">Accounts</th></tr></thead>
            <tbody>{STAGES.map(s => { const l = list.filter(o => o.stage === s); return <tr key={s}><td className="td"><Badge>{s}</Badge></td><td className="td">{l.length}</td><td className="td">{money(l.reduce((a, o) => a + o.monthlyValue, 0))}</td><td className="td text-xs">{l.map(o => `${accountName(o.accountId)} (${repName(o.repId).split(' ').slice(0, 3).join(' ')})`).join('; ') || '—'}</td></tr> })}</tbody></table></div>
        </div>
      </div>
      {adding && <OpportunityForm open onClose={() => setAdding(false)} defaultBrand={brand} />}
    </>
  )
}
