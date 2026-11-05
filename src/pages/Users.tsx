import { FormEvent, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { useStore } from '../lib/store'
import { Channel, Profile, Role, Territory } from '../types'
import { Badge, Field, Modal, PageHeader, useAction } from '../components/ui'
import { fmtDate } from '../lib/utils'

export default function Users() {
  const { profiles, accounts, saveProfile } = useStore()
  const run = useAction()
  const [editing, setEditing] = useState<Profile | undefined>()
  const [adding, setAdding] = useState(false)
  return (
    <>
      <PageHeader title="User Management" subtitle="Manage representatives, administrators and permissions"
        actions={<button className="btn-primary" onClick={() => setAdding(true)}><Plus size={16} /> Add user</button>} />
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[700px]"><thead><tr><th className="th">Name</th><th className="th">Email</th><th className="th">Role</th><th className="th">Territory</th><th className="th">Sales channel</th><th className="th">Accounts</th><th className="th">Status</th><th className="th">Created</th><th className="th" /></tr></thead>
          <tbody>{profiles.map(p => (
            <tr key={p.id} className="hover:bg-slate-50">
              <td className="td font-medium">{p.name}</td><td className="td">{p.email}</td>
              <td className="td"><Badge tone={p.role === 'admin' ? 'A+' : 'A'}>{p.role === 'admin' ? 'Management' : 'Sales Rep'}</Badge></td>
              <td className="td">{p.territory ?? 'All'}</td><td className="td">{p.role === 'admin' ? '—' : p.channel === 'Retail' ? 'Retail' : p.channel === 'Hospitality' ? 'Hotel & Foodservice' : 'All accounts'}</td><td className="td">{accounts.filter(a => a.repId === p.id).length}</td>
              <td className="td"><Badge tone={p.active ? 'Active' : 'Inactive'}>{p.active ? 'Active' : 'Deactivated'}</Badge></td>
              <td className="td">{fmtDate(p.createdAt)}</td>
              <td className="td"><button className="p-1.5 rounded hover:bg-slate-100" onClick={() => setEditing(p)}><Pencil size={16} /></button></td>
            </tr>))}</tbody></table>
      </div>
      <div className="card p-4 mt-4 text-sm text-slate-600">
        <h3 className="font-semibold text-navy-900 mb-2">Role permissions</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Sales Representative:</strong> sees and edits only assigned accounts; logs activities; updates opportunities; plans own routes; cannot reassign accounts, manage users or delete accounts.</li>
          <li><strong>Management / Administrator:</strong> sees all accounts and reps; assigns accounts; manages users; deletes records; exports reports.</li>
        </ul>
      </div>
      {(adding || editing) && <UserForm profile={editing} onClose={() => { setAdding(false); setEditing(undefined) }} onSave={p => run(() => saveProfile(p), editing ? 'User updated' : 'User added')} />}
    </>
  )
}

function UserForm({ profile, onClose, onSave }: { profile?: Profile; onClose: () => void; onSave: (p: Partial<Profile> & { name: string; email: string }) => Profile | undefined }) {
  const [f, setF] = useState({ name: profile?.name ?? '', email: profile?.email ?? '', role: (profile?.role ?? 'rep') as Role, territory: (profile?.territory ?? 'All') as Territory | 'All', channel: (profile?.channel ?? 'All') as Channel, active: profile?.active ?? true })
  const submit = (e: FormEvent) => { e.preventDefault(); if (onSave({ ...f, id: profile?.id })) onClose() }
  return (
    <Modal open onClose={onClose} title={profile ? 'Edit user' : 'Add user'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name *"><input required className="input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Email *"><input required type="email" className="input" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Role"><select className="input" value={f.role} onChange={e => setF({ ...f, role: e.target.value as Role })}><option value="rep">Sales Representative</option><option value="admin">Management / Administrator</option></select></Field>
          <Field label="Territory"><select className="input" value={f.territory} onChange={e => setF({ ...f, territory: e.target.value as Territory | 'All' })}><option>All</option><option>North</option><option>Central</option><option>South</option></select></Field>
        </div>
        {f.role === 'rep' && (
          <Field label="Sales channel (which accounts this rep can see)">
            <select className="input" value={f.channel} onChange={e => setF({ ...f, channel: e.target.value as Channel })}>
              <option value="All">All accounts</option>
              <option value="Retail">Retail only</option>
              <option value="Hospitality">Hotel &amp; Foodservice only</option>
            </select>
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} /> Active (can sign in)</label>
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary">Save</button></div>
      </form>
    </Modal>
  )
}
