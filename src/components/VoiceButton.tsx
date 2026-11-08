import { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { useToast } from './ui'

/* The browser's built-in speech recognition. Not in the TypeScript DOM types, so a minimal shape is declared here. */
type Result = ArrayLike<{ transcript: string }> & { isFinal: boolean }
interface Rec {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number
  onresult: ((e: { resultIndex: number; results: ArrayLike<Result> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void; stop: () => void
}
type RecCtor = new () => Rec
const getCtor = (): RecCtor | null => {
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const flat = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim()
/**
 * Phones (Android Chrome especially) report every growing partial phrase as its own result:
 * "10", "10 cas", "10 cases", "10 cases of", … Keep only the longest version of each phrase so the text is not repeated.
 */
export function mergeResults(parts: string[]): string {
  const out: string[] = []
  for (const p of parts) {
    const t = p.trim(); if (!t) continue
    const last = out[out.length - 1]
    if (last !== undefined) {
      const a = flat(last), b = flat(t)
      if (b === a || a.startsWith(b)) continue       // same or a shorter, earlier version
      if (b.startsWith(a)) { out[out.length - 1] = t; continue }   // a longer version of the previous one
    }
    out.push(t)
  }
  const s = out.join(' ').replace(/\s+/g, ' ').trim()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

/**
 * Tap, talk, tap again: your words appear in the field as you speak. Uses the phone's own speech recognition
 * (Chrome / Safari), which needs a connection. Hidden on browsers without it. Edit the text afterwards.
 * `value` / `onChange` are the field it types into. `choose` can pick between the phone's alternative guesses.
 */
export function VoiceButton({ value, onChange, choose }: { value: string; onChange: (next: string) => void; choose?: (alternatives: string[]) => string }) {
  const toast = useToast()
  const [on, setOn] = useState(false)
  const rec = useRef<Rec | null>(null)
  const base = useRef('')
  const latest = useRef({ value, onChange, choose })
  latest.current = { value, onChange, choose }
  const Ctor = typeof window !== 'undefined' ? getCtor() : null
  useEffect(() => () => { try { rec.current?.stop() } catch { /* already stopped */ } }, [])
  if (!Ctor) return null

  const toggle = () => {
    if (on) { rec.current?.stop(); return }
    const r = new Ctor()
    base.current = latest.current.value.trim()           // what was already in the field before this recording
    r.lang = 'en-US'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 3
    r.onresult = e => {
      const parts: string[] = []
      for (let i = 0; i < e.results.length; i++) {
        const alts = Array.from({ length: e.results[i].length }, (_, k) => e.results[i][k].transcript.trim()).filter(Boolean)
        if (!alts.length) continue
        const pick = e.results[i].isFinal && alts.length > 1 && latest.current.choose ? latest.current.choose(alts) : alts[0]
        parts.push(pick)
      }
      const said = mergeResults(parts)
      latest.current.onChange(base.current ? `${base.current} ${said}` : said)   // replace, never append: the phone resends the whole sentence
    }
    r.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('Allow the microphone for this site in your browser settings to use voice.', 'err')
      else if (e.error === 'network') toast('Voice needs an internet connection. Type your note instead.', 'err')
      else if (e.error !== 'no-speech' && e.error !== 'aborted') toast('Could not hear you. Try again or type.', 'err')
    }
    r.onend = () => setOn(false)
    try { r.start(); rec.current = r; setOn(true) } catch { setOn(false) }
  }
  return (
    <button type="button" onClick={toggle} aria-label={on ? 'Stop voice note' : 'Speak your note'} aria-pressed={on}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition ${on ? 'bg-red-600 border-red-600 text-white animate-pulse' : 'bg-white border-slate-300 text-navy-800 hover:bg-slate-50'}`}>
      {on ? <><Square size={13} /> Listening… tap to stop</> : <><Mic size={14} /> Speak</>}
    </button>
  )
}
