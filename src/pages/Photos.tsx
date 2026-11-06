import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { EmptyState, PageHeader } from '../components/ui'
import { PhotoGallery } from '../components/PhotoGallery'
import { BRANDS, PHOTO_TAGS } from '../types'

/** Every shelf and display photo the user is allowed to see: the shelf survey. */
export default function Photos() {
  const { photos, profiles, accountName, isAdmin } = useStore()
  const [tag, setTag] = useState(''); const [brand, setBrand] = useState(''); const [rep, setRep] = useState(''); const [q, setQ] = useState('')
  const list = useMemo(() => photos.filter(p =>
    (!tag || p.tag === tag) && (!brand || p.brand === brand) && (!rep || p.repId === rep) &&
    (!q.trim() || accountName(p.accountId).toLowerCase().includes(q.trim().toLowerCase()) || p.caption.toLowerCase().includes(q.trim().toLowerCase())),
  ).sort((a, b) => b.takenAt.localeCompare(a.takenAt)), [photos, tag, brand, rep, q, accountName])
  return (
    <>
      <PageHeader title="Shelf & Display Photos" subtitle="Photos reps take on visits. Use the filters for a shelf survey or display check." />
      <div className="card p-3 mb-4 flex flex-wrap gap-2">
        <input className="input !w-56" placeholder="Search account or caption…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="input !w-auto" value={tag} onChange={e => setTag(e.target.value)}><option value="">All types</option>{PHOTO_TAGS.map(t => <option key={t}>{t}</option>)}</select>
        <select className="input !w-auto" value={brand} onChange={e => setBrand(e.target.value)}><option value="">All brands</option>{BRANDS.map(b => <option key={b}>{b}</option>)}</select>
        {isAdmin && <select className="input !w-auto" value={rep} onChange={e => setRep(e.target.value)}><option value="">All reps</option>{profiles.filter(p => p.role === 'rep').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
        <span className="text-xs text-slate-500 self-center ml-auto">{list.length} photo{list.length === 1 ? '' : 's'}</span>
      </div>
      {list.length === 0 ? <div className="card p-8"><EmptyState title="No photos yet" hint="Use the Log visit button, then Take or choose photo." /></div> : <PhotoGallery photos={list} showAccount />}
    </>
  )
}
