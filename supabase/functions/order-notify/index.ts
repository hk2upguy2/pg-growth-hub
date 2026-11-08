// PG Growth Hub: emails customer service whenever a rep submits a new order.
// Triggered by a Supabase Database Webhook on INSERT into public.orders (setup: docs/CUSTOMER_SERVICE.md).
// Sent through Resend (resend.com), like the daily digest.
import { createClient } from 'npm:@supabase/supabase-js@2'

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const RESEND = Deno.env.get('RESEND_API_KEY')!
const FROM = Deno.env.get('DIGEST_FROM') ?? 'PG Growth Hub <onboarding@resend.dev>'
const TO = (Deno.env.get('CS_EMAIL') ?? '').split(',').map(s => s.trim()).filter(Boolean)   // customer service address(es)
const SECRET = Deno.env.get('DIGEST_SECRET') ?? ''
const APP_URL = Deno.env.get('APP_URL') ?? ''
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const money = (n: number) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

Deno.serve(async req => {
  if (SECRET && req.headers.get('x-digest-secret') !== SECRET) return new Response('Forbidden', { status: 403 })
  if (!TO.length) return new Response('CS_EMAIL is not set', { status: 500 })
  const body = await req.json().catch(() => null)
  const o = body?.record
  if (!o || body.type !== 'INSERT' || body.table !== 'orders') return new Response('ignored', { status: 200 })
  const [{ data: acct }, { data: rep }] = await Promise.all([
    sb.from('accounts').select('name, address, village, account_type, balance, overdue_balance').eq('id', o.account_id).maybeSingle(),
    sb.from('profiles').select('full_name').eq('id', o.rep_id).maybeSingle(),
  ])
  const lines = (o.lines ?? []) as { brand: string; product: string; unit: string; qty: number; price: number; discountPct: number; sku?: string }[]
  const rows = lines.map(l => `<tr><td style="padding:4px 8px;border-bottom:1px solid #e5e7eb">${esc(l.qty)}</td><td style="padding:4px 8px;border-bottom:1px solid #e5e7eb">${esc(l.product)} <span style="color:#64748b">(${esc(l.brand)}, per ${esc(l.unit)})</span></td><td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${money(l.price)}${l.discountPct ? ` −${l.discountPct}%` : ''}</td></tr>`).join('')
  const html = `<div style="font-family:Arial,sans-serif;max-width:620px;color:#1f2937">
    <h2 style="color:#1e3a6b;margin-bottom:2px">New order ${esc(o.order_no)}</h2>
    <p style="margin:2px 0"><strong>${esc(acct?.name ?? 'Customer')}</strong>${acct?.village ? ` · ${esc(acct.village)}` : ''}</p>
    <p style="margin:2px 0;color:#475569">Taken by ${esc(rep?.full_name ?? 'rep')} · deliver ${esc(o.delivery_date ?? 'ASAP')} · total <strong>${money(o.total)}</strong></p>
    ${Number(acct?.overdue_balance) > 0 ? `<p style="color:#b91c1c;margin:6px 0"><strong>Overdue balance ${money(acct!.overdue_balance)}</strong>. Check before confirming.</p>` : ''}
    <table style="border-collapse:collapse;width:100%;margin-top:10px"><tr><th style="text-align:left;padding:4px 8px;background:#f1f5f9">Qty</th><th style="text-align:left;padding:4px 8px;background:#f1f5f9">Product</th><th style="text-align:right;padding:4px 8px;background:#f1f5f9">Price</th></tr>${rows}</table>
    ${o.notes ? `<p style="margin-top:10px"><em>Notes: ${esc(o.notes)}</em></p>` : ''}
    ${APP_URL ? `<p style="margin-top:18px"><a href="${APP_URL}/orders" style="background:#1e3a6b;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open in PG Growth Hub</a></p>` : ''}</div>`
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: TO, subject: `New order ${o.order_no}: ${acct?.name ?? ''} (${money(o.total)})`, html }),
  })
  return new Response(r.ok ? 'sent' : `Resend ${r.status}: ${await r.text()}`, { status: r.ok ? 200 : 502 })
})
