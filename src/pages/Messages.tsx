import { FormEvent, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCheck, Send, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { Badge, ConfirmButton, EmptyState, Field, PageHeader, useAction } from '../components/ui'
import { fmtDateTime } from '../lib/utils'

export default function Messages() {
  const { isAdmin } = useStore()
  return isAdmin ? <ManagerView /> : <RepInbox />
}

/* ---------------- management: compose + sent ---------------- */
function ManagerView() {
  const { profiles, messages, messageReads, sendMessage, deleteMessage, repName } = useStore()
  const run = useAction()
  const reps = useMemo(() => profiles.filter(p => p.role !== 'admin' && p.active), [profiles])
  const [mode, setMode] = useState<'all' | 'some'>('all')
  const [picked, setPicked] = useState<string[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [urgent, setUrgent] = useState(false)

  const toggle = (id: string) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]))
  const onSend = (e: FormEvent) => {
    e.preventDefault()
    const n = run(() => sendMessage(mode === 'all' ? 'all' : picked, subject, body, urgent))
    if (n !== undefined) { setSubject(''); setBody(''); setUrgent(false); setPicked([]) }
  }
  const readBy = (id: string, recipientId: string | null) => {
    const total = recipientId ? 1 : reps.length
    const n = messageReads.filter(r => r.messageId === id && reps.some(x => x.id === r.userId)).length
    return { n, total }
  }

  return (
    <>
      <PageHeader title="Messages" subtitle="Send a message to one rep, several reps, or the whole sales team" />
      <form onSubmit={onSend} className="card p-4 space-y-4 mb-6">
        <div>
          <div className="text-sm font-medium text-slate-700 mb-2">To</div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" className={mode === 'all' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMode('all')}>All sales reps ({reps.length})</button>
            <button type="button" className={mode === 'some' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMode('some')}>Choose reps</button>
          </div>
          {mode === 'some' && (
            <div className="mt-3">
              {reps.length === 0 && <div className="text-sm text-slate-500">No active sales reps yet. Add them under User Management.</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {reps.map(r => (
                  <label key={r.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" checked={picked.includes(r.id)} onChange={() => toggle(r.id)} />
                    <span className="font-medium text-navy-900">{r.name}</span>
                    <span className="text-xs text-slate-500">{r.territory && r.territory !== 'All' ? r.territory : ''}</span>
                  </label>
                ))}
              </div>
              {reps.length > 0 && (
                <div className="mt-2 flex gap-3 text-xs">
                  <button type="button" className="text-navy-600 hover:underline" onClick={() => setPicked(reps.map(r => r.id))}>Select all</button>
                  <button type="button" className="text-navy-600 hover:underline" onClick={() => setPicked([])}>Clear</button>
                  <span className="text-slate-500">{picked.length} selected. Each rep gets their own copy.</span>
                </div>
              )}
            </div>
          )}
        </div>
        <Field label="Subject"><input className="input" value={subject} maxLength={120} onChange={e => setSubject(e.target.value)} placeholder="e.g. Hostess display push this week" /></Field>
        <Field label="Message"><textarea className="input min-h-[130px]" value={body} maxLength={4000} onChange={e => setBody(e.target.value)} placeholder="Write your message…" required /></Field>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} /> Mark as urgent</label>
          <button className="btn-primary" disabled={!body.trim() || (mode === 'some' && picked.length === 0)}><Send size={16} /> Send message</button>
        </div>
      </form>

      <h3 className="font-semibold text-navy-900 mb-2">Sent messages</h3>
      {messages.length === 0 ? <div className="card p-8"><EmptyState title="No messages sent yet" /></div> : (
        <div className="space-y-3">
          {messages.map(m => {
            const { n, total } = readBy(m.id, m.recipientId)
            return (
              <div key={m.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-navy-900">{m.subject || '(no subject)'}</span>
                      {m.urgent && <Badge tone="Lost">Urgent</Badge>}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">To {m.recipientId ? repName(m.recipientId) : 'All sales reps'} · {fmtDateTime(m.createdAt)}</div>
                  </div>
                  <ConfirmButton className="text-slate-400 hover:text-red-600" message="Delete this message for the rep too?" onConfirm={() => run(() => deleteMessage(m.id), 'Message deleted')}><Trash2 size={16} /></ConfirmButton>
                </div>
                <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{m.body}</p>
                <div className="text-xs mt-2 text-slate-500 flex items-center gap-1"><CheckCheck size={14} className={n === total && total > 0 ? 'text-emerald-600' : ''} /> Read by {n} of {total}</div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

/* ---------------- sales rep: inbox ---------------- */
function RepInbox() {
  const { user, messages, messageReads, markMessagesRead, repName } = useStore()
  const run = useAction()
  const [open, setOpen] = useState<string | null>(null)
  const isRead = (id: string) => messageReads.some(r => r.messageId === id && r.userId === user?.id)
  const unread = messages.filter(m => !isRead(m.id))
  const sorted = useMemo(() => [...messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [messages])

  useEffect(() => { if (open) markMessagesRead([open]) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <PageHeader title="Messages" subtitle="Messages from management"
        actions={unread.length > 0 ? <button className="btn-secondary" onClick={() => run(() => markMessagesRead(unread.map(m => m.id)))}><CheckCheck size={16} /> Mark all read</button> : undefined} />
      {sorted.length === 0 ? <div className="card p-8"><EmptyState title="No messages yet" hint="Messages from management will show up here." /></div> : (
        <div className="space-y-2">
          {sorted.map(m => {
            const read = isRead(m.id); const expanded = open === m.id
            return (
              <button key={m.id} onClick={() => setOpen(expanded ? null : m.id)}
                className={`card p-4 w-full text-left ${read ? '' : 'border-navy-400 bg-navy-50'}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  {!read && <span className="w-2 h-2 rounded-full bg-red-500" aria-label="Unread" />}
                  <span className={`text-navy-900 ${read ? 'font-medium' : 'font-semibold'}`}>{m.subject || '(no subject)'}</span>
                  {m.urgent && <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700"><AlertTriangle size={13} /> Urgent</span>}
                  <span className="ml-auto text-xs text-slate-500">{fmtDateTime(m.createdAt)}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">From {repName(m.senderId)}{m.recipientId ? '' : ' · to all sales reps'}</div>
                <p className={`text-sm text-slate-700 mt-2 whitespace-pre-wrap ${expanded ? '' : 'line-clamp-2'}`}>{m.body}</p>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
