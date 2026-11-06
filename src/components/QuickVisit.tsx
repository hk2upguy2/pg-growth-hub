import { OverdueWarning } from './AccountSnapshot'
import { useEffect, useMemo, useState } from 'react'
import { CloudOff, Plus } from 'lucide-react'
import { useStore } from '../lib/store'
import { Modal, useToast } from './ui'
import { daysFromNowStr, nowISO } from '../lib/utils'
import { hasSupabase } from '../lib/supabase'
import { PRIORITY_ORDER } from '../lib/seed'
import { PhotoPicker, PendingPhotos, emptyPhotos } from './PhotoPicker'

const OUTCOMES = ['Order placed', 'Interested', 'Wants quotation', 'Needs follow-up', 'Not interested', 'Not available']
const QUEUE_KEY = 'pg-growth-hub:visit-queue:v1'
type Queued = { accountId: string; summary: string; outcome: string; followUpDate: string | null; at: string; photos?: PendingPhotos }

const readQueue = (): Queued[] => { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') } catch { return [] } }
const writeQueue = (q: Queued[]) => { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)) } catch { /* ignore */ } }

/** Floating "Log visit" button (reps and managers) and the offline queue that sends waiting visits when the connection returns. */
export function QuickVisit({ preselect }: { preselect?: string }) {
  const { accounts, saveActivity, addPhotos, user } = useStore()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(() => readQueue().length)
  const [online, setOnline] = useState(() => navigator.onLine)

  const flush = () => {
    const q = readQueue()
    if (!q.length || !user) return
    writeQueue([])
    let sent = 0; const failed: Queued[] = []
    for (const v of q) {
      try {
        const act = saveActivity({ accountId: v.accountId, at: v.at, type: 'Customer Visit', summary: v.summary, outcome: v.outcome, followUpDate: v.followUpDate, followUpDone: false })
        if (v.photos?.shots.length) addPhotos(v.photos.shots.map(dataUrl => ({ accountId: v.accountId, activityId: act.id, tag: v.photos!.tag, brand: v.photos!.brand || null, caption: v.photos!.caption, dataUrl })))
        sent++
      }
      catch { failed.push(v) }
    }
    writeQueue(failed); setPending(failed.length)
    if (sent) toast(`${sent} saved visit${sent > 1 ? 's' : ''} sent to the server`)
  }
  useEffect(() => {
    const up = () => { setOnline(true); flush() }
    const down = () => setOnline(false)
    window.addEventListener('online', up); window.addEventListener('offline', down)
    if (navigator.onLine) flush()
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null
  return (
    <>
      {(!online || pending > 0) && (
        <div className="fixed top-14 lg:top-2 left-1/2 -translate-x-1/2 z-40 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-medium px-3 py-1.5 flex items-center gap-1.5 shadow">
          <CloudOff size={14} /> {online ? `${pending} visit${pending > 1 ? 's' : ''} waiting to send` : `Offline${pending ? ` · ${pending} visit${pending > 1 ? 's' : ''} waiting` : ''}`}
        </div>
      )}
      <button onClick={() => setOpen(true)} aria-label="Log a visit"
        className="fixed z-40 right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] rounded-full bg-navy-700 hover:bg-navy-800 text-white shadow-lg px-5 py-3.5 flex items-center gap-2 font-semibold">
        <Plus size={20} /> Log visit
      </button>
      {open && <QuickVisitModal preselect={preselect} offline={!online && hasSupabase} onClose={() => setOpen(false)} onQueued={() => setPending(readQueue().length)} />}
    </>
  )
}

function QuickVisitModal({ preselect, offline, onClose, onQueued }: { preselect?: string; offline: boolean; onClose: () => void; onQueued: () => void }) {
  const { accounts, saveActivity, addPhotos } = useStore()
  const toast = useToast()
  const [photos, setPhotos] = useState<PendingPhotos>(emptyPhotos())
  const [q, setQ] = useState('')
  const [accountId, setAccountId] = useState(preselect ?? '')
  const [outcome, setOutcome] = useState('')
  const [note, setNote] = useState('')
  const [follow, setFollow] = useState<number | null>(null)

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return [...accounts]
      .filter(a => !t || a.name.toLowerCase().includes(t) || a.village.toLowerCase().includes(t))
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.name.localeCompare(b.name)).slice(0, 40)
  }, [accounts, q])
  const picked = accounts.find(a => a.id === accountId)

  const save = () => {
    if (!accountId || !outcome) return
    const payload: Queued = { accountId, summary: note.trim() || `Visit: ${outcome}`, outcome, followUpDate: follow === null ? null : daysFromNowStr(follow), at: nowISO(), photos: photos.shots.length ? photos : undefined }
    if (offline) {
      try { localStorage.setItem(QUEUE_KEY, JSON.stringify([...readQueue(), payload])) } catch { toast('Not enough space on this phone for these photos. Remove some and try again.', 'err'); return }
      ; onQueued(); toast('Saved on this phone. It will send when you are back online.'); onClose(); return
    }
    try {
      const act = saveActivity({ accountId, at: payload.at, type: 'Customer Visit', summary: payload.summary, outcome, nextAction: follow === null ? '' : 'Follow up', followUpDate: payload.followUpDate, followUpDone: false })
      if (photos.shots.length) addPhotos(photos.shots.map(dataUrl => ({ accountId, activityId: act.id, tag: photos.tag, brand: photos.brand || null, caption: photos.caption, dataUrl })))
      toast(photos.shots.length ? `Visit logged with ${photos.shots.length} photo${photos.shots.length > 1 ? 's' : ''}` : 'Visit logged'); onClose()
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not save', 'err') }
  }

  return (
    <Modal open onClose={onClose} title="Log a visit">
      <div className="space-y-4">
        {!preselect && (
          <div>
            <div className="label">Who did you visit?</div>
            {picked ? (
              <div className="flex items-center justify-between rounded-lg border border-navy-300 bg-navy-50 px-3 py-2"><span className="font-medium text-navy-900">{picked.name}</span><button className="text-xs text-navy-600 hover:underline" onClick={() => setAccountId('')}>Change</button></div>
            ) : (
              <>
                <input className="input" autoFocus placeholder="Search your accounts…" value={q} onChange={e => setQ(e.target.value)} />
                <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                  {list.length === 0 && <div className="p-3 text-sm text-slate-500">No matching accounts.</div>}
                  {list.map(a => <button key={a.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50" onClick={() => setAccountId(a.id)}><span className="font-medium">{a.name}</span> <span className="text-xs text-slate-500">· {a.village}</span></button>)}
                </div>
              </>
            )}
          </div>
        )}
        <OverdueWarning account={picked} />
        {preselect && picked && <div className="rounded-lg border border-navy-300 bg-navy-50 px-3 py-2 font-medium text-navy-900">{picked.name}</div>}
        <div>
          <div className="label">How did it go?</div>
          <div className="flex flex-wrap gap-2">{OUTCOMES.map(o => <button key={o} type="button" onClick={() => setOutcome(o)} className={outcome === o ? 'btn-primary' : 'btn-secondary'}>{o}</button>)}</div>
        </div>
        <div>
          <div className="label">Follow up</div>
          <div className="flex flex-wrap gap-2">
            {([[null, 'None'], [1, 'Tomorrow'], [7, 'In 1 week'], [14, 'In 2 weeks']] as [number | null, string][]).map(([d, l]) => <button key={l} type="button" onClick={() => setFollow(d)} className={follow === d ? 'btn-primary' : 'btn-secondary'}>{l}</button>)}
          </div>
        </div>
        <PhotoPicker value={photos} onChange={setPhotos} />
        <div><div className="label">Note (optional)</div><textarea rows={2} className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="Anything worth remembering" /></div>
        {offline && <div className="text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2">You are offline. This visit will be saved on your phone and sent automatically when you are back online.</div>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="button" className="btn-primary" disabled={!accountId || !outcome} onClick={save}>Save visit</button></div>
      </div>
    </Modal>
  )
}
