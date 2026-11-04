import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** True when Supabase credentials are configured. Otherwise the app runs in localStorage demo mode. */
export const hasSupabase = Boolean(url && anon)
export const supabase: SupabaseClient | null = hasSupabase ? createClient(url!, anon!) : null
