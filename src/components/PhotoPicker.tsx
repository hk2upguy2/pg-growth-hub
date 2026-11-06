import { ChangeEvent, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { BRANDS, BrandName, PHOTO_TAGS, PhotoTag } from '../types'
import { resizeImage } from '../lib/photos'

export interface PendingPhotos { tag: PhotoTag; brand: BrandName | ''; caption: string; shots: string[] }
export const emptyPhotos = (): PendingPhotos => ({ tag: 'Shelf survey', brand: '', caption: '', shots: [] })
export const MAX_SHOTS = 6

/** Camera / gallery picker. Pictures are shrunk on the phone before anything is sent or stored. */
export function PhotoPicker({ value, onChange }: { value: PendingPhotos; onChange: (v: PendingPhotos) => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const add = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])].slice(0, MAX_SHOTS - value.shots.length)
    e.target.value = ''
    if (!files.length) return
    setBusy(true); setErr('')
    try { const shots = await Promise.all(files.map(f => resizeImage(f))); onChange({ ...value, shots: [...value.shots, ...shots] }) }
    catch (x) { setErr(x instanceof Error ? x.message : 'Could not add the picture') }
    setBusy(false)
  }
  return (
    <div className="space-y-2">
      <div className="label flex items-center gap-1"><Camera size={14} /> Photos (shelf, display, competitor)</div>
      {value.shots.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.shots.map((s, i) => (
            <div key={i} className="relative">
              <img src={s} alt={`Photo ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border border-slate-200" />
              <button type="button" aria-label="Remove photo" className="absolute -top-1.5 -right-1.5 bg-white border border-slate-300 rounded-full p-0.5 text-slate-600" onClick={() => onChange({ ...value, shots: value.shots.filter((_, j) => j !== i) })}><X size={12} /></button>
            </div>
          ))}
        </div>
      )}
      {value.shots.length < MAX_SHOTS && (
        <label className="btn-secondary cursor-pointer inline-flex"><Camera size={16} /> {busy ? 'Adding…' : value.shots.length ? 'Add another' : 'Take or choose photo'}
          <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={add} data-testid="photo-input" /></label>
      )}
      {err && <div className="text-xs text-red-700">{err}</div>}
      {value.shots.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={value.tag} onChange={e => onChange({ ...value, tag: e.target.value as PhotoTag })}>{PHOTO_TAGS.map(t => <option key={t}>{t}</option>)}</select>
          <select className="input" value={value.brand} onChange={e => onChange({ ...value, brand: e.target.value as BrandName | '' })}><option value="">Brand (optional)</option>{BRANDS.map(b => <option key={b}>{b}</option>)}</select>
          <input className="input col-span-2" placeholder="Caption (optional) e.g. Choco Pie shelf, aisle 4" value={value.caption} onChange={e => onChange({ ...value, caption: e.target.value })} />
        </div>
      )}
    </div>
  )
}
