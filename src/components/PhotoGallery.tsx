import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ImageOff, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { Badge, Modal, useAction } from './ui'
import { fmtDateTime } from '../lib/utils'
import type { Photo } from '../types'

/** Grid of visit photos with a full-size viewer. */
export function PhotoGallery({ photos, showAccount }: { photos: Photo[]; showAccount?: boolean }) {
  const { user, isAdmin, accountName, repName, deletePhoto } = useStore()
  const run = useAction()
  const [open, setOpen] = useState<Photo | null>(null)
  if (photos.length === 0) return null
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {photos.map(p => (
          <button key={p.id} type="button" onClick={() => setOpen(p)} className="text-left rounded-lg border border-slate-200 overflow-hidden bg-white hover:shadow">
            {p.url ? <img src={p.url} alt={p.caption || p.tag} loading="lazy" className="w-full h-32 object-cover" />
              : <div className="w-full h-32 bg-slate-100 flex items-center justify-center text-slate-400"><ImageOff size={22} /></div>}
            <div className="p-2 text-xs space-y-0.5">
              <div className="flex flex-wrap gap-1"><Badge>{p.tag}</Badge>{p.brand && <Badge tone="Planned">{p.brand}</Badge>}</div>
              {showAccount && <div className="font-medium text-navy-900 truncate">{accountName(p.accountId)}</div>}
              <div className="text-slate-500">{fmtDateTime(p.takenAt)}</div>
            </div>
          </button>
        ))}
      </div>
      {open && (
        <Modal open title={showAccount ? accountName(open.accountId) : open.tag} onClose={() => setOpen(null)} wide>
          {open.url ? <img src={open.url} alt={open.caption || open.tag} className="w-full max-h-[70vh] object-contain rounded-lg bg-slate-100" />
            : <div className="p-8 text-center text-sm text-slate-500">This photo is not available offline.</div>}
          <div className="mt-3 text-sm text-slate-700 space-y-1">
            <div className="flex flex-wrap gap-1"><Badge>{open.tag}</Badge>{open.brand && <Badge tone="Planned">{open.brand}</Badge>}</div>
            {open.caption && <p>{open.caption}</p>}
            <p className="text-xs text-slate-500">{repName(open.repId)} · {fmtDateTime(open.takenAt)}</p>
            <div className="flex gap-3 items-center pt-1">
              <Link className="text-xs text-navy-600 hover:underline" to={`/account/${open.accountId}`} onClick={() => setOpen(null)}>Open account</Link>
              {(isAdmin || open.repId === user?.id) && <button className="text-xs text-red-600 hover:underline inline-flex items-center gap-1" onClick={() => { if (window.confirm('Delete this photo?')) { run(() => deletePhoto(open.id), 'Photo deleted'); setOpen(null) } }}><Trash2 size={12} /> Delete</button>}
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
