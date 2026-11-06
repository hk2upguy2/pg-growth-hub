import { FormEvent, useState } from 'react'
import {
  ACCOUNT_TYPES, channelAllows, ALL_VILLAGES, ACTIVITY_TYPES, Account, AccountStatus, AccountType, Activity, ActivityType,
  BRANDS, BrandName, LOST_REASONS, Opportunity, PRIORITIES, PRODUCTS, Priority, SEGMENTS, STAGES, STAGE_DEFAULT_PROB, STAGE_DEFINITIONS, STATUSES, Stage,
} from '../types'
import { useStore } from '../lib/store'
import { Field, Modal, useAction } from './ui'
import { nowISO, toDateStr, toLocalInput } from '../lib/utils'

/* ---------------- Account ---------------- */
export function AccountForm({ open, onClose, account, onSaved }: {
  open: boolean; onClose: () => void; account?: Account; onSaved?: (a: Account) => void
}) {
  const { saveAccount, profiles, isAdmin, user } = useStore()
  const run = useAction()
  const reps = profiles.filter(p => p.active && p.role === 'rep')
  const blank = () => ({
    name: account?.name ?? '', type: (account?.type ?? 'Retail') as AccountType, segment: account?.segment ?? 'Supermarket',
    village: account?.village ?? 'Tamuning', address: account?.address ?? '', contactName: account?.contactName ?? '',
    contactPosition: account?.contactPosition ?? '', phone: account?.phone ?? '', email: account?.email ?? '',
    repId: account?.repId ?? user?.id ?? '', priority: (account?.priority ?? 'B') as Priority,
    status: (account?.status ?? 'Prospect') as AccountStatus, monthlyPotential: String(account?.monthlyPotential ?? 0),
    monthlySales: String(account?.monthlySales ?? 0), currentProducts: account?.currentProducts ?? '',
    potentialProducts: account?.potentialProducts ?? '', competitor: account?.competitor ?? '',
    nextFollowUp: account?.nextFollowUp ?? '', notes: account?.notes ?? '', sageNo: account?.sageNo ?? '', balanceDue: String(account?.balanceDue ?? 0), overdueBalance: String(account?.overdueBalance ?? 0),
  })
  const [f, setF] = useState(blank)
  const set = <K extends keyof ReturnType<typeof blank>>(k: K, v: ReturnType<typeof blank>[K]) => setF(s => ({ ...s, [k]: v }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!f.name.trim()) return
    const saved = run(() => saveAccount({
      ...f, id: account?.id, name: f.name,
      monthlyPotential: Number(f.monthlyPotential) || 0, monthlySales: Number(f.monthlySales) || 0,
      nextFollowUp: f.nextFollowUp || null,
      repId: isAdmin ? f.repId : undefined,
      sageNo: isAdmin ? f.sageNo : undefined,
      balanceDue: isAdmin ? Number(f.balanceDue) || 0 : undefined, overdueBalance: isAdmin ? Number(f.overdueBalance) || 0 : undefined,
    }), account ? 'Account updated' : 'Account created')
    if (saved) { onSaved?.(saved); onClose() }
  }

  return (
    <Modal open={open} onClose={onClose} title={account ? `Edit ${account.name}` : 'Add Account / Prospect'} wide>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Business name *" className="sm:col-span-2"><input required className="input" value={f.name} onChange={e => set('name', e.target.value)} /></Field>
        <Field label="Account type">
          <select className="input" value={f.type} onChange={e => set('type', e.target.value as AccountType)}>{ACCOUNT_TYPES.filter(t => isAdmin || channelAllows(user?.channel, t)).map(t => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field label="Business segment">
          <select className="input" value={f.segment} onChange={e => set('segment', e.target.value)}>{SEGMENTS.map(t => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field label="Village / location">
          <select className="input" value={f.village} onChange={e => set('village', e.target.value)}>{ALL_VILLAGES.map(t => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field label="Sage customer number"><input className="input" disabled={!isAdmin} value={f.sageNo} onChange={e => set('sageNo', e.target.value)} placeholder={isAdmin ? 'e.g. 01-ABC123' : 'Set by management'} /></Field>
        <Field label="Assigned sales rep">
          <select className="input" disabled={!isAdmin} value={f.repId} onChange={e => set('repId', e.target.value)}>
            {(isAdmin ? reps : profiles.filter(p => p.id === user?.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Physical address" className="sm:col-span-2"><input className="input" value={f.address} onChange={e => set('address', e.target.value)} /></Field>
        <Field label="Contact person"><input className="input" value={f.contactName} onChange={e => set('contactName', e.target.value)} /></Field>
        <Field label="Contact position"><input className="input" value={f.contactPosition} onChange={e => set('contactPosition', e.target.value)} /></Field>
        <Field label="Phone"><input className="input" inputMode="tel" value={f.phone} onChange={e => set('phone', e.target.value)} /></Field>
        <Field label="Email"><input type="email" className="input" value={f.email} onChange={e => set('email', e.target.value)} /></Field>
        <Field label="Priority">
          <select className="input" value={f.priority} onChange={e => set('priority', e.target.value as Priority)}>{PRIORITIES.map(t => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field label="Status">
          <select className="input" value={f.status} onChange={e => set('status', e.target.value as AccountStatus)}>{STATUSES.map(t => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field label="Estimated monthly potential ($)"><input type="number" min="0" className="input" value={f.monthlyPotential} onChange={e => set('monthlyPotential', e.target.value)} /></Field>
        <Field label="Actual monthly sales ($)"><input type="number" min="0" className="input" value={f.monthlySales} onChange={e => set('monthlySales', e.target.value)} /></Field>
        {isAdmin && <Field label="Balance owed ($)"><input type="number" min="0" className="input" value={f.balanceDue} onChange={e => set('balanceDue', e.target.value)} /></Field>}
        {isAdmin && <Field label="Overdue balance ($)"><input type="number" min="0" className="input" value={f.overdueBalance} onChange={e => set('overdueBalance', e.target.value)} /></Field>}
        <Field label="Products currently purchased" className="sm:col-span-2"><input className="input" value={f.currentProducts} onChange={e => set('currentProducts', e.target.value)} /></Field>
        <Field label="Potential products" className="sm:col-span-2"><input className="input" value={f.potentialProducts} onChange={e => set('potentialProducts', e.target.value)} /></Field>
        <Field label="Competitor / current supplier"><input className="input" value={f.competitor} onChange={e => set('competitor', e.target.value)} /></Field>
        <Field label="Next follow-up"><input type="date" className="input" value={f.nextFollowUp ?? ''} onChange={e => set('nextFollowUp', e.target.value)} /></Field>
        <Field label="Notes" className="sm:col-span-2"><textarea rows={3} className="input" value={f.notes} onChange={e => set('notes', e.target.value)} /></Field>
        <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">{account ? 'Save changes' : 'Create account'}</button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------------- Activity ---------------- */
export function ActivityForm({ open, onClose, activity, defaultAccountId, defaultType }: {
  open: boolean; onClose: () => void; activity?: Activity; defaultAccountId?: string; defaultType?: ActivityType
}) {
  const { saveActivity, accounts, profiles, isAdmin, user } = useStore()
  const run = useAction()
  const reps = profiles.filter(p => p.active && p.role === 'rep')
  const [f, setF] = useState({
    at: toLocalInput(activity?.at ?? nowISO()),
    accountId: activity?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? '',
    repId: activity?.repId ?? user?.id ?? '',
    type: (activity?.type ?? defaultType ?? 'Customer Visit') as ActivityType,
    summary: activity?.summary ?? '', products: activity?.products ?? '', outcome: activity?.outcome ?? '',
    nextAction: activity?.nextAction ?? '', followUpDate: activity?.followUpDate ?? '',
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(s => ({ ...s, [k]: v }))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!f.accountId) return
    const ok = run(() => saveActivity({
      id: activity?.id, accountId: f.accountId, at: new Date(f.at).toISOString(),
      repId: isAdmin ? f.repId : undefined, type: f.type, summary: f.summary, products: f.products,
      outcome: f.outcome, nextAction: f.nextAction, followUpDate: f.followUpDate || null,
      followUpDone: activity?.followUpDone ?? false,
    }), activity ? 'Activity updated' : 'Activity logged')
    if (ok) onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={activity ? 'Edit activity' : 'Log sales activity'} wide>
      {accounts.length === 0 ? <p className="text-sm text-slate-500">You have no assigned accounts yet. Add a prospect first.</p> : (
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Date and time"><input required type="datetime-local" className="input" value={f.at} onChange={e => set('at', e.target.value)} /></Field>
          <Field label="Activity type">
            <select className="input" value={f.type} onChange={e => set('type', e.target.value as ActivityType)}>{ACTIVITY_TYPES.map(t => <option key={t}>{t}</option>)}</select>
          </Field>
          <Field label="Account *">
            <select required className="input" value={f.accountId} onChange={e => set('accountId', e.target.value)}>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Sales representative">
            <select className="input" disabled={!isAdmin} value={f.repId} onChange={e => set('repId', e.target.value)}>
              {(isAdmin ? reps : profiles.filter(p => p.id === user?.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Discussion summary *" className="sm:col-span-2"><textarea required rows={3} className="input" value={f.summary} onChange={e => set('summary', e.target.value)} /></Field>
          <Field label="Products discussed" className="sm:col-span-2"><input className="input" value={f.products} onChange={e => set('products', e.target.value)} placeholder="e.g. Party Wings, Hostess endcap" /></Field>
          <Field label="Outcome"><input className="input" value={f.outcome} onChange={e => set('outcome', e.target.value)} /></Field>
          <Field label="Next action"><input className="input" value={f.nextAction} onChange={e => set('nextAction', e.target.value)} /></Field>
          <Field label="Follow-up date"><input type="date" className="input" value={f.followUpDate} onChange={e => set('followUpDate', e.target.value)} /></Field>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">{activity ? 'Save changes' : 'Log activity'}</button>
          </div>
        </form>
      )}
    </Modal>
  )
}

/* ---------------- Opportunity ---------------- */
export function OpportunityForm({ open, onClose, opportunity, defaultAccountId, defaultBrand }: {
  open: boolean; onClose: () => void; opportunity?: Opportunity; defaultAccountId?: string; defaultBrand?: BrandName
}) {
  const { saveOpportunity, accounts, profiles, isAdmin, user } = useStore()
  const run = useAction()
  const reps = profiles.filter(p => p.active && p.role === 'rep')
  const initialBrand = opportunity?.brand ?? defaultBrand ?? 'Agrosuper'
  const [f, setF] = useState({
    accountId: opportunity?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? '',
    brand: initialBrand as BrandName,
    product: opportunity?.product ?? PRODUCTS[initialBrand][0],
    monthlyValue: String(opportunity?.monthlyValue ?? 0),
    stage: (opportunity?.stage ?? 'Identified') as Stage,
    probability: String(opportunity?.probability ?? STAGE_DEFAULT_PROB['Identified']),
    expectedClose: opportunity?.expectedClose ?? toDateStr(new Date(Date.now() + 30 * 86400000)),
    repId: opportunity?.repId ?? user?.id ?? '',
    nextAction: opportunity?.nextAction ?? '', notes: opportunity?.notes ?? '', lostReason: opportunity?.lostReason ?? '',
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(s => ({ ...s, [k]: v }))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const ok = run(() => saveOpportunity({
      id: opportunity?.id, accountId: f.accountId, brand: f.brand, product: f.product,
      monthlyValue: Number(f.monthlyValue) || 0, stage: f.stage,
      probability: Math.min(100, Math.max(0, Number(f.probability) || 0)),
      expectedClose: f.expectedClose, repId: isAdmin ? f.repId : undefined,
      nextAction: f.nextAction, notes: f.notes, lostReason: f.stage === 'Lost' ? f.lostReason : undefined,
    }), opportunity ? 'Opportunity updated' : 'Opportunity created')
    if (ok) onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={opportunity ? 'Edit opportunity' : 'New opportunity'} wide>
      {accounts.length === 0 ? <p className="text-sm text-slate-500">You have no assigned accounts yet. Add a prospect first.</p> : (
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Account *" className="sm:col-span-2">
            <select required className="input" value={f.accountId} onChange={e => set('accountId', e.target.value)}>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          </Field>
          <Field label="Brand">
            <select className="input" value={f.brand} onChange={e => { const b = e.target.value as BrandName; setF(s => ({ ...s, brand: b, product: PRODUCTS[b][0] })) }}>{BRANDS.map(b => <option key={b}>{b}</option>)}</select>
          </Field>
          <Field label="Product">
            <select className="input" value={f.product} onChange={e => set('product', e.target.value)}>
              {PRODUCTS[f.brand].map(p => <option key={p}>{p}</option>)}
              {!PRODUCTS[f.brand].includes(f.product) && <option>{f.product}</option>}
            </select>
          </Field>
          <Field label="Estimated monthly sales ($)"><input type="number" min="0" className="input" value={f.monthlyValue} onChange={e => set('monthlyValue', e.target.value)} /></Field>
          <Field label="Expected closing date *"><input required type="date" className="input" value={f.expectedClose} onChange={e => set('expectedClose', e.target.value)} /></Field>
          <Field label="Stage">
            <select className="input" value={f.stage} onChange={e => { const s = e.target.value as Stage; setF(x => ({ ...x, stage: s, probability: String(STAGE_DEFAULT_PROB[s]) })) }}>{STAGES.map(s => <option key={s}>{s}</option>)}</select>
          </Field>
          <Field label="Probability (%)"><input type="number" min="0" max="100" className="input" value={f.probability} onChange={e => set('probability', e.target.value)} /></Field>
          <Field label="Assigned representative">
            <select className="input" disabled={!isAdmin} value={f.repId} onChange={e => set('repId', e.target.value)}>
              {(isAdmin ? reps : profiles.filter(p => p.id === user?.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label={`Next action${f.stage === 'Won' || f.stage === 'Lost' ? '' : ' *'}`}><input required={f.stage !== 'Won' && f.stage !== 'Lost'} className="input" value={f.nextAction} onChange={e => set('nextAction', e.target.value)} placeholder="What happens next, and who does it" /></Field>
          <div className="sm:col-span-2 -mt-2 text-xs text-slate-500 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2"><strong>{f.stage}:</strong> {STAGE_DEFINITIONS[f.stage as Stage]}</div>
          {f.stage === 'Lost' && (
            <Field label="Reason lost *" className="sm:col-span-2">
              <select required className="input" value={f.lostReason} onChange={e => set('lostReason', e.target.value)}>
                <option value="">Choose a reason…</option>
                {[...LOST_REASONS, ...(f.lostReason && !(LOST_REASONS as readonly string[]).includes(f.lostReason) ? [f.lostReason] : [])].map(r => <option key={r}>{r}</option>)}
              </select>
            </Field>
          )}
          <Field label="Notes" className="sm:col-span-2"><textarea rows={3} className="input" value={f.notes} onChange={e => set('notes', e.target.value)} /></Field>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">{opportunity ? 'Save changes' : 'Create opportunity'}</button>
          </div>
        </form>
      )}
    </Modal>
  )
}
