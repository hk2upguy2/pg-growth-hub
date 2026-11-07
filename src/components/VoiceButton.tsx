import { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { useToast } from './ui'

/* The browser's built-in speech recognition. Not in the TypeScript DOM types, so a minimal shape is declared here. */
interface Rec {
  lang: string; continuous: boolean; interimResults: boolean
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void; stop: () => void
}
type RecCtor = new () => Rec
const getCtor = (): RecCtor | null => {
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/**
 * Tap, talk, tap again: the words are typed into the field for you. It uses the phone's own speech recognition
 * (Chrome / Safari), which needs a connection. Hidden on browsers that do not support it. Edit the text afterwards.
 */
export function VoiceButton({ onText }: { onText: (text: string) => void }) {
  const toast = useToast()
  const [on, setOn] = useState(false)
  const rec = useRef<Rec | null>(null)
  const Ctor = typeof window !== 'undefined' ? getCtor() : null
  useEffect(() => () => { try { rec.current?.stop() } catch { /* already stopped */ } }, [])
  if (!Ctor) return null

  const toggle = () => {
    if (on) { rec.current?.stop(); return }
    const r = new Ctor()
    r.lang = 'en-US'; r.continuous = true; r.interimResults = false
    r.onresult = e => {
      let said = ''
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) said += e.results[i][0].transcript
      said = said.trim()
      if (said) onText(said.charAt(0).toUpperCase() + said.slice(1) + (/[.!?]$/.test(said) ? '' : '.'))
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
