import { supabase } from './supabase'

/** Two-step login (authenticator app / TOTP) using Supabase Auth. Opt-in per user; recommended for managers. */
const sb = () => { if (!supabase) throw new Error('Supabase is not configured'); return supabase }

export async function mfaFactor() {
  const { data, error } = await sb().auth.mfa.listFactors()
  if (error) throw error
  return data.totp.find(f => f.status === 'verified') ?? null
}
export async function mfaEnroll() {
  // clear any half-finished enrolment first, so the user can always start again
  const { data: list } = await sb().auth.mfa.listFactors()
  for (const f of list?.all ?? []) if (f.status === 'unverified') await sb().auth.mfa.unenroll({ factorId: f.id })
  const { data, error } = await sb().auth.mfa.enroll({ factorType: 'totp', friendlyName: `PG Growth Hub ${new Date().toISOString().slice(0, 10)}` })
  if (error) throw error
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret }
}
export async function mfaConfirm(factorId: string, code: string) {
  const { data: ch, error: e1 } = await sb().auth.mfa.challenge({ factorId })
  if (e1) throw e1
  const { error } = await sb().auth.mfa.verify({ factorId, challengeId: ch.id, code: code.trim() })
  if (error) throw error
}
export async function mfaRemove(factorId: string) {
  const { error } = await sb().auth.mfa.unenroll({ factorId })
  if (error) throw error
}
/** True when the signed-in session still needs its second step. */
export async function mfaNeeded(): Promise<string | null> {
  const { data, error } = await sb().auth.mfa.getAuthenticatorAssuranceLevel()
  if (error || !data) return null
  if (data.nextLevel === 'aal2' && data.currentLevel !== 'aal2') {
    const f = await mfaFactor()
    return f?.id ?? null
  }
  return null
}
