import { mkdirSync, renameSync, writeFileSync, appendFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { JSDOM } from 'jsdom'
import { runCycle, type Out, type SageSource } from './core'
import { discover, folderSource, odbcSource } from './sources'
import { supabaseDb } from './supabase'

// the Excel reader uses the browser's XML parser; give it one
;(globalThis as unknown as { DOMParser: unknown }).DOMParser = new JSDOM('').window.DOMParser

if (existsSync('.env')) for (const l of readFileSync('.env', 'utf-8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
const env = (k: string, d = '') => process.env[k] ?? d
const args = process.argv.slice(2), has = (f: string) => args.includes(f)
const logFile = env('BRIDGE_LOG', 'bridge.log')
const log = (m: string) => { const line = `${new Date().toISOString()} ${m}`; console.log(line); try { appendFileSync(logFile, line + '\n') } catch { /* ignore */ } }

async function main() {
  const dsn = env('SAGE_DSN'), user = env('SAGE_USER'), pass = env('SAGE_PASSWORD')
  if (has('--discover')) { if (!dsn) throw new Error('Set SAGE_DSN in .env first'); return discover(dsn, user, pass) }
  const url = env('SUPABASE_URL'), key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env')
  const outDir = env('SAGE_ORDERS_OUT'); if (!outDir) throw new Error('Set SAGE_ORDERS_OUT to the folder your Visual Integrator job reads')
  mkdirSync(outDir, { recursive: true })
  const q = JSON.parse(readFileSync(new URL('./queries.json', import.meta.url), 'utf-8'))
  const source: SageSource = dsn ? odbcSource(dsn, user, pass, q) : env('SAGE_LISTINGS_IN') ? folderSource(env('SAGE_LISTINGS_IN')) : { invoices: async () => null, openOrders: async () => null, balances: async () => null }
  const out: Out = { async writeOrders(name, csv) { const tmp = join(outDir, name + '.tmp'); writeFileSync(tmp, csv, 'utf-8'); renameSync(tmp, join(outDir, name)) } }   // rename = Sage never sees a half-written file
  const salesCodes = env('SALES_CODES') ? JSON.parse(env('SALES_CODES')) : undefined
  const db = supabaseDb(url, key)
  const dryRun = has('--dry-run')
  const every = Number((args.find(a => a.startsWith('--every=')) ?? '--every=5').split('=')[1]) * 60000
  log(`Sage link started (${dsn ? 'ODBC ' + dsn : env('SAGE_LISTINGS_IN') ? 'listing folder' : 'orders out only'})${dryRun ? ' [dry run]' : ''}`)
  do {
    try { const s = await runCycle({ db, source, out, log, dryRun, salesCodes, warehouse: env('SAGE_WAREHOUSE', '000') }); log(`cycle done: ${s.ok ? 'ok' : 'WITH ERRORS'}; sent ${s.ordersSent}, invoices ${s.invoicesMatched}, balances ${s.balancesUpdated}`) }
    catch (e) { log('cycle failed: ' + (e instanceof Error ? e.message : e)) }
    if (has('--once')) break
    await new Promise(r => setTimeout(r, every))
  } while (true)
}
main().catch(e => { log('FATAL ' + (e instanceof Error ? e.message : e)); process.exit(1) })
