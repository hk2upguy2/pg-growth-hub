// PG Growth Hub: morning email digest.
// Reps get: follow-ups due, unread messages, customers who stopped ordering.
// Managers get: team summary, overdue balances, wins and accepted quotes from the last day.
// Sent through Resend (resend.com). Only people with something to act on get an email.
// Deploy and schedule with the steps in docs/NOTIFICATIONS.md.
import { createClient } from 'npm:@supabase/supabase-js@2'

const SB_URL = Deno.env.get('SUPABASE_URL')!
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND = Deno.env.get('RESEND_API_KEY')!
const FROM = Deno.env.get('DIGEST_FROM') ?? 'PG Growth Hub <onboarding@resend.dev>'
const APP_URL = Deno.env.get('APP_URL') ?? ''
const SECRET = Deno.env.get('DIGEST_SECRET') ?? ''
const BIG_WIN = Number(Deno.env.get('BIG_WIN_MONTHLY_VALUE') ?? '2000')

const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } })
const guamToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Guam' }).format(new Date()) // YYYY-MM-DD
const minusDays = (d: string, n: number) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() - n); return x.toISOString().slice(0, 10) }
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US')

async function send(to: string, subject: string, html: string) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`)
}
const section = (title: string, rows: string[]) => rows.length ? `<h3 style="margin:18px 0 6px;color:#1e3a6b">${title}</h3><ul style="padding-left:18px;margin:0">${rows.map(r => `<li style="margin:3px 0">${r}</li>`).join('')}</ul>` : ''
const wrap = (name: string, body: string) => `<div style="font-family:Arial,sans-serif;max-width:560px;color:#1f2937"><h2 style="color:#1e3a6b;margin-bottom:4px">Good morning ${esc(name)}</h2>${body}${APP_URL ? `<p style="margin-top:22px"><a href="${APP_URL}" style="background:#1e3a6b;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open PG Growth Hub</a></p>` : ''}<p style="color:#94a3b8;font-size:12px;margin-top:20px">Pacific Grocers daily summary.</p></div>`

Deno.serve(async req => {
  if (SECRET && req.headers.get('x-digest-secret') !== SECRET) return new Response('Forbidden', { status: 403 })
  const today = guamToday(), lapsedBefore = minusDays(today, 30), since = minusDays(today, 1)
  const { data: people } = await sb.from('profiles').select('id, full_name, email, role, active').eq('active', true)
  const reps = (people ?? []).filter(p => p.role !== 'admin')
  let sent = 0; const problems: string[] = []

  const name = async (ids: string[]) => {
    if (!ids.length) return new Map<string, string>()
    const { data } = await sb.from('accounts').select('id, name').in('id', ids)
    return new Map((data ?? []).map(a => [a.id as string, a.name as string]))
  }

  for (const p of people ?? []) {
    if (!p.email) continue
    try {
      const parts: string[] = []
      if (p.role !== 'admin') {
        const { data: due } = await sb.from('sales_activities').select('account_id, next_action, summary, follow_up_date')
          .eq('rep_id', p.id).eq('follow_up_done', false).not('follow_up_date', 'is', null).lte('follow_up_date', today).order('follow_up_date').limit(15)
        const { data: msgs } = await sb.from('messages').select('id, subject, urgent, sender_id, recipient_id').or(`recipient_id.eq.${p.id},recipient_id.is.null`).neq('sender_id', p.id)
          .gte('created_at', minusDays(today, 14))
        const { data: reads } = await sb.from('message_reads').select('message_id').eq('user_id', p.id)
        const readSet = new Set((reads ?? []).map(r => r.message_id))
        const unread = (msgs ?? []).filter(m => !readSet.has(m.id))
        const { data: lapsed } = await sb.from('accounts').select('id, name, monthly_sales, last_order_date')
          .eq('assigned_rep_id', p.id).gt('monthly_sales', 0).lt('last_order_date', lapsedBefore).order('monthly_sales', { ascending: false }).limit(8)
        const names = await name((due ?? []).map(d => d.account_id))
        parts.push(section(`Follow-ups due (${(due ?? []).length})`, (due ?? []).map(d => `<strong>${esc(names.get(d.account_id) ?? 'Account')}</strong>: ${esc(d.next_action || d.summary)} <span style="color:${d.follow_up_date < today ? '#b91c1c' : '#64748b'}">(${d.follow_up_date < today ? 'overdue, ' : ''}${d.follow_up_date})</span>`)))
        parts.push(section(`Unread messages (${unread.length})`, unread.slice(0, 6).map(m => `${m.urgent ? '<strong style="color:#b91c1c">URGENT</strong> ' : ''}${esc(m.subject || 'New message')}`)))
        parts.push(section('Customers who stopped ordering (30+ days)', (lapsed ?? []).map(a => `<strong>${esc(a.name)}</strong>, usually ${money(a.monthly_sales)} a month, last order ${a.last_order_date}`)))
      } else {
        const { data: wins } = await sb.from('opportunities').select('account_id, monthly_value, product_name').eq('stage', 'Won').gte('updated_at', since).gte('monthly_value', BIG_WIN)
        const { data: quotes } = await sb.from('quotes').select('quote_no, account_id, total').eq('status', 'Accepted').gte('created_at', since)
        const { data: overdue } = await sb.from('accounts').select('name, overdue_balance').gt('overdue_balance', 0).order('overdue_balance', { ascending: false }).limit(8)
        const { data: acts } = await sb.from('sales_activities').select('rep_id, occurred_at').gte('occurred_at', minusDays(today, 3) + 'T00:00:00Z')
        const active = new Set((acts ?? []).map(a => a.rep_id))
        const quiet = reps.filter(r => !active.has(r.id)).map(r => r.full_name)
        const names = await name([...(wins ?? []).map(w => w.account_id), ...(quotes ?? []).map(q => q.account_id)])
        parts.push(section('Wins in the last day', (wins ?? []).map(w => `<strong>${esc(names.get(w.account_id) ?? 'Account')}</strong>: ${esc(w.product_name)}, ${money(w.monthly_value)} a month`)))
        parts.push(section('Quotes accepted', (quotes ?? []).map(q => `${esc(q.quote_no)} ${esc(names.get(q.account_id) ?? '')}: ${money(q.total)}`)))
        parts.push(section('Reps with no activity logged in 3 days', quiet.map(n => esc(n))))
        parts.push(section('Largest overdue balances', (overdue ?? []).map(a => `${esc(a.name)}: ${money(a.overdue_balance)}`)))
      }
      const body = parts.join('')
      if (!body) continue
      await send(p.email, p.role === 'admin' ? 'PG Growth Hub: team summary' : 'PG Growth Hub: your day', wrap(p.full_name?.split(' ')[0] ?? '', body))
      sent++
    } catch (e) { problems.push(`${p.email}: ${e instanceof Error ? e.message : e}`) }
  }
  return new Response(JSON.stringify({ sent, problems }), { headers: { 'Content-Type': 'application/json' }, status: problems.length ? 207 : 200 })
})
