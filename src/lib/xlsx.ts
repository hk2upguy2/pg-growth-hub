import { unzipSync, strFromU8 } from 'fflate'

/**
 * Minimal .xlsx reader: the first sheet as rows of text. Sage 100 reports export to Excel, and this saves saving them as CSV first.
 * Dates (cells with a date format) come back as yyyy-mm-dd; numbers as plain digits; shared and inline strings as text.
 */
const BUILTIN_DATE_FMT = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58])
const colIndex = (ref: string) => { let n = 0; for (const ch of ref.replace(/[^A-Z]/gi, '').toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1 }
const kids = (el: Element, tag: string) => Array.from(el.getElementsByTagName(tag))
const serialToISO = (serial: number) => new Date(Math.round((serial - 25569) * 86400000)).toISOString().slice(0, 10)

export function readXlsx(buf: ArrayBuffer | Uint8Array): string[][] {
  let files: Record<string, Uint8Array>
  try { files = unzipSync(buf instanceof Uint8Array ? buf : new Uint8Array(buf)) } catch { throw new Error('This does not look like an Excel (.xlsx) file') }
  const doc = (name: string) => (files[name] ? new DOMParser().parseFromString(strFromU8(files[name]), 'application/xml') : null)

  const shared: string[] = []
  doc('xl/sharedStrings.xml')?.querySelectorAll('si').forEach(si => shared.push(kids(si, 't').map(t => t.textContent ?? '').join('')))

  // which cell styles are dates
  const dateStyle: boolean[] = []
  const styles = doc('xl/styles.xml')
  if (styles) {
    const custom = new Map<number, string>()
    styles.querySelectorAll('numFmts > numFmt').forEach(n => custom.set(Number(n.getAttribute('numFmtId')), n.getAttribute('formatCode') ?? ''))
    styles.querySelectorAll('cellXfs > xf').forEach(xf => {
      const id = Number(xf.getAttribute('numFmtId') ?? 0)
      const code = (custom.get(id) ?? '').replace(/"[^"]*"|\[[^\]]*\]|\\./g, '')
      dateStyle.push(BUILTIN_DATE_FMT.has(id) || (custom.has(id) && /[ymd]/i.test(code) && !/0\.0|#/.test(code)))
    })
  }

  const sheetName = Object.keys(files).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.replace(/\D/g, '')) - parseInt(b.replace(/\D/g, '')))[0]
  const sheet = sheetName ? doc(sheetName) : null
  if (!sheet) throw new Error('No sheet found in this Excel file')

  const out: string[][] = []
  sheet.querySelectorAll('sheetData > row').forEach(r => {
    const row: string[] = []
    kids(r, 'c').forEach(c => {
      const at = colIndex(c.getAttribute('r') ?? '')
      const type = c.getAttribute('t'); const v = c.getElementsByTagName('v')[0]?.textContent ?? ''
      let text = ''
      if (type === 's') text = shared[Number(v)] ?? ''
      else if (type === 'inlineStr') text = kids(c, 't').map(t => t.textContent ?? '').join('')
      else if (type === 'b') text = v === '1' ? 'TRUE' : 'FALSE'
      else if (v !== '' && !type?.match(/^(str|e)$/) && dateStyle[Number(c.getAttribute('s') ?? 0)] && Number.isFinite(Number(v))) text = serialToISO(Number(v))
      else text = v
      row[at >= 0 ? at : row.length] = text
    })
    out.push(Array.from(row, x => x ?? ''))
  })
  while (out.length && out[out.length - 1].every(x => !x)) out.pop()
  return out
}
