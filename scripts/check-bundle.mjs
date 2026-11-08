// Performance budget: fails the build pipeline if the app's download size grows too much.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const dir = process.argv[2] ?? 'dist-e2e'
const BUDGET_KB = { js: 400, css: 40 }   // gzipped. Today's size is well under this; the limit catches accidental heavy imports.
const total = { js: 0, css: 0 }
for (const f of readdirSync(join(dir, 'assets'))) {
  const ext = f.endsWith('.js') ? 'js' : f.endsWith('.css') ? 'css' : null
  if (!ext) continue
  total[ext] += gzipSync(readFileSync(join(dir, 'assets', f))).length / 1024
  void statSync
}
let bad = false
for (const k of Object.keys(total)) {
  const ok = total[k] <= BUDGET_KB[k]
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${k.toUpperCase()} ${total[k].toFixed(1)} KB gzipped (budget ${BUDGET_KB[k]} KB)`)
  if (!ok) bad = true
}
process.exit(bad ? 1 : 0)
