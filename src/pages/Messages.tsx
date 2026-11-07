import { FormEvent, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCheck, CornerDownRight, Send, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { Badge, ConfirmButton, EmptyState, Field, PageHeader, useAction } from '../components/ui'
import { fmtDateTime } from '../lib/utils'
import { unreadMessages } from '../lib/analytics'
import type { Message } from '../types'
import { VoiceButton } from '../components/VoiceButton'

export default function Messages() {
  const { isAdmin } = useStore()
  return isAdmin ? <ManagerView /> : <RepInbox />
}

const byTime = (a: Message, b: Message) => a.createdAt.localeCompare(b.createdAt)

/** One conversation: the original message plus its replies, oldest first. */
function useThreads() {
  const { messages } = useStore()
  return useMemo(() => {
    const roots = messages.filter(m => !m.parentId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return roots.map(root => ({ root, replies: messages.filter(m => m.parentId === root.id).sort(byTime) }))
  }, [messages])
}

function ReplyBox({ placeholder = 'Write a reply…', onSend, extra }: { placeholder?: string; onSend: (text: string) => boolean; extra?: React.ReactNode }) {
  const [text, setText] = useState('')
  const submit = (e: FormEvent) => { e.preventDefault(); if (onSend(text)) setText('') }
  return (
    <form onSubmit={submit} className="mt-3 border-t border-slate-200 pt-3 space-y-2" onClick={e => e.stopPropagation()}>
      {extra}
      <textarea className="input min-h-[70px]" value={text} maxLength={4000} placeholder={placeholder} onChange={e => setText(e.target.value)} />
      <div className="flex justify-between items-center"><VoiceButton onText={t => setText(x => (x ? x + ' ' : '') + t)} /><button className="btn-primary" disabled={!text.trim()}><CornerDownRight size={15} /> Reply</button></div>
    </form>
  )
}

/* ---------------- management: compose + conversations ---------------- */
function ManagerView() {
  const { profiles, user, messages, messageReads, sendMessage, replyMessage, markMessagesRead, deleteMessage, repName } = useStore()
  const run = useAction()
  const threads = useThreads()
  const reps = useMemo(() => profiles.filter(p => p.role !== 'admin' && p.active), [profiles])
  const [mode, setMode] = useState<'all' | 'some'>('all')
  const [picked, setPicked] = useState<string[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [replyTo, setReplyTo] = useState<Record<string, string>>({})
  const unread = unreadMessages(user?.id, messages, messageReads)

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
  // which reps can be answered in this thread
  const participants = (t: { root: Message; replies: Message[] }) => {
    const ids = new Set<string>()
    if (t.root.recipientId && t.root.recipientId !== user?.id) ids.add(t.root.recipientId)
    t.replies.forEach(r => { if (r.senderId !== user?.id) ids.add(r.senderId) })
    return [...ids]
  }
  const sendReply = (t: { root: Message; replies: Message[] }, text: string) => {
    const to = replyTo[t.root.id] ?? participants(t)[0]
    if (!to) return false
    const lastFromRep = [...t.replies].reverse().find(r => r.senderId === to)
    const parent = lastFromRep ?? t.root
    return run(() => replyMessage(parent.id, text), 'Reply sent') !== undefined
  }

  return (
    <>
      <PageHeader title="Messages" subtitle="Send a message to one rep, several reps, or the whole sales team. Reps can reply."
        actions={unread.length > 0 ? <button className="btn-secondary" onClick={() => markMessagesRead(unread.map(m => m.id))}><CheckCheck size={16} /> Mark replies read</button> : undefined} />
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

      <h3 className="font-semibold text-navy-900 mb-2">Conversations</h3>
      {threads.length === 0 ? <div className="card p-8"><EmptyState title="No messages yet" /></div> : (
        <div className="space-y-3">
          {threads.map(t => {
            const { n, total } = readBy(t.root.id, t.root.recipientId)
            const people = participants(t)
            const unreadHere = t.replies.some(r => unread.some(u => u.id === r.id))
            return (
              <div key={t.root.id} className={`card p-4 ${unreadHere ? 'border-navy-400 bg-navy-50' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-navy-900">{t.root.subject || '(no subject)'}</span>
                      {t.root.urgent && <Badge tone="Lost">Urgent</Badge>}
                      {unreadHere && <Badge tone="Active">New reply</Badge>}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">To {t.root.recipientId ? repName(t.root.recipientId) : 'All sales reps'} · {fmtDateTime(t.root.createdAt)}</div>
                  </div>
                  <ConfirmButton className="text-slate-400 hover:text-red-600" message="Delete this message and its replies?" onConfirm={() => run(() => deleteMessage(t.root.id), 'Message deleted')}><Trash2 size={16} /></ConfirmButton>
                </div>
                <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{t.root.body}</p>
                <div className="text-xs mt-2 text-slate-500 flex items-center gap-1"><CheckCheck size={14} className={n === total && total > 0 ? 'text-emerald-600' : ''} /> Read by {n} of {total}</div>
                {t.replies.length > 0 && (
                  <div className="mt-3 space-y-2 border-l-2 border-navy-200 pl-3">
                    {t.replies.map(r => (
                      <div key={r.id} className="text-sm" onMouseEnter={() => { if (unread.some(u => u.id === r.id)) markMessagesRead([r.id]) }}>
                        <div className="text-xs text-slate-500"><span className="font-semibold text-navy-900">{r.senderId === user?.id ? 'You' : repName(r.senderId)}</span>{r.senderId === user?.id ? ` to ${repName(r.recipientId ?? '')}` : ''} · {fmtDateTime(r.createdAt)}</div>
                        <p className="text-slate-700 whitespace-pre-wrap">{r.body}</p>
                      </div>
                    ))}
                  </div>
                )}
                {people.length > 0 && (
                  <ReplyBox onSend={text => sendReply(t, text)}
                    extra={people.length > 1 ? (
                      <select className="input !w-auto" value={replyTo[t.root.id] ?? people[0]} onChange={e => setReplyTo(s => ({ ...s, [t.root.id]: e.target.value }))}>
                        {people.map(id => <option key={id} value={id}>Reply to {repName(id)}</option>)}
                      </select>
                    ) : <div className="text-xs text-slate-500">Reply to {repName(people[0])}</div>} />
                )}
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
  const { user, messages, messageReads, markMessagesRead, replyMessage, repName } = useStore()
  const run = useAction()
  const threads = useThreads()
  const [open, setOpen] = useState<string | null>(null)
  const unread = unreadMessages(user?.id, messages, messageReads)
  const isUnread = (id: string) => unread.some(m => m.id === id)

  useEffect(() => {
    if (!open) return
    const t = threads.find(x => x.root.id === open)
    if (t) markMessagesRead([t.root.id, ...t.replies.map(r => r.id)])
  }, [open, threads.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const sendReply = (t: { root: Message; replies: Message[] }, text: string) => {
    const lastFromManager = [...t.replies].reverse().find(r => r.senderId !== user?.id)
    return run(() => replyMessage((lastFromManager ?? t.root).id, text), 'Reply sent') !== undefined
  }

  return (
    <>
      <PageHeader title="Messages" subtitle="Messages from management. You can reply to any of them."
        actions={unread.length > 0 ? <button className="btn-secondary" onClick={() => run(() => markMessagesRead(unread.map(m => m.id)))}><CheckCheck size={16} /> Mark all read</button> : undefined} />
      {threads.length === 0 ? <div className="card p-8"><EmptyState title="No messages yet" hint="Messages from management will show up here." /></div> : (
        <div className="space-y-2">
          {threads.map(t => {
            const m = t.root
            const expanded = open === m.id
            const fresh = isUnread(m.id) || t.replies.some(r => isUnread(r.id))
            return (
              <div key={m.id} onClick={() => setOpen(expanded ? null : m.id)} role="button" tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') setOpen(expanded ? null : m.id) }}
                className={`card p-4 w-full text-left cursor-pointer ${fresh ? 'border-navy-400 bg-navy-50' : ''}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  {fresh && <span className="w-2 h-2 rounded-full bg-red-500" aria-label="Unread" />}
                  <span className={`text-navy-900 ${fresh ? 'font-semibold' : 'font-medium'}`}>{m.subject || '(no subject)'}</span>
                  {m.urgent && <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700"><AlertTriangle size={13} /> Urgent</span>}
                  {t.replies.length > 0 && <span className="text-xs text-slate-500">{t.replies.length} repl{t.replies.length === 1 ? 'y' : 'ies'}</span>}
                  <span className="ml-auto text-xs text-slate-500">{fmtDateTime(m.createdAt)}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">From {repName(m.senderId)}{m.recipientId ? '' : ' · to all sales reps'}</div>
                <p className={`text-sm text-slate-700 mt-2 whitespace-pre-wrap ${expanded ? '' : 'line-clamp-2'}`}>{m.body}</p>
                {expanded && (
                  <>
                    {t.replies.length > 0 && (
                      <div className="mt-3 space-y-2 border-l-2 border-navy-200 pl-3">
                        {t.replies.map(r => (
                          <div key={r.id} className="text-sm">
                            <div className="text-xs text-slate-500"><span className="font-semibold text-navy-900">{r.senderId === user?.id ? 'You' : repName(r.senderId)}</span> · {fmtDateTime(r.createdAt)}</div>
                            <p className="text-slate-700 whitespace-pre-wrap">{r.body}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <ReplyBox onSend={text => sendReply(t, text)} />
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
