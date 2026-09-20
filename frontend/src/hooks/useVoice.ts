import { useState, useRef, useCallback, useEffect } from 'react'
import { transcribeAudio } from '../api'

interface UseVoiceReturn {
  isListening: boolean
  transcript: string
  start: () => void
  stop: () => void
  supported: boolean
  error: string | null
}

const MAX_SERVER_SECS = 12

// App language code -> Web Speech API BCP-47 tag for the primary (browser) path
const SPEECH_LANG: Record<string, string> = {
  en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN', bn: 'bn-IN',
  ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', ml: 'ml-IN',
  gu: 'gu-IN', pa: 'pa-IN',
}

function getSpeechRecognition(): any {
  if (typeof window === 'undefined') return null
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null
}

function isSecureContext(): boolean {
  return window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}

function canRecord(): boolean {
  return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

export function useVoice(language: string, onResult?: (text: string) => void): UseVoiceReturn {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<any>(null)
  const recorderRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const modeRef = useRef<'sr' | 'server' | 'idle'>('idle')
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult
  const languageRef = useRef(language)
  languageRef.current = language
  const retryCountRef = useRef(0)

  const supported = getSpeechRecognition() !== null || canRecord()

  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current)
      try { recognitionRef.current?.abort() } catch {}
      if (recorderRef.current) {
        try { recorderRef.current.stop() } catch {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  const cleanupServer = () => {
    clearTimeout(timerRef.current)
    if (recorderRef.current) {
      try { recorderRef.current.stop() } catch {}
      recorderRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  const stopServerRecording = useCallback(() => {
    clearTimeout(timerRef.current)
    const rec = recorderRef.current
    recorderRef.current = null
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (!rec) {
      setIsListening(false)
      modeRef.current = 'idle'
      return
    }
    try { rec.stop() } catch {}
    rec.onstop = async () => {
      try {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        chunksRef.current = []
        if (!blob.size) {
          setError('Didn\'t capture any audio. Check your microphone and try again.')
          return
        }
        const text = await transcribeAudio(blob, languageRef.current)
        setTranscript(text)
        if (text && onResultRef.current) onResultRef.current(text.trim())
      } catch (err: any) {
        setTranscript('')
        setError(err?.message || 'Voice assistant couldn\'t transcribe the audio. Please try again.')
      } finally {
        setIsListening(false)
        modeRef.current = 'idle'
      }
    }
  }, [])

  const startServerMode = useCallback(() => {
    setTranscript('')
    setError(null)
    modeRef.current = 'server'
    setIsListening(true)
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      if (modeRef.current !== 'server') {
        stream.getTracks().forEach(t => t.stop())
        return
      }
      streamRef.current = stream
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e: any) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data) }
      rec.start()
      recorderRef.current = rec
      timerRef.current = setTimeout(stopServerRecording, MAX_SERVER_SECS * 1000)
    }).catch(() => {
      setIsListening(false)
      modeRef.current = 'idle'
      setError('Microphone blocked. Click the lock icon in the address bar and allow microphone access, then try again.')
    })
  }, [stopServerRecording])

  const start = useCallback(() => {
    if (!supported) {
      setError('Voice is not supported in this browser. Try Chrome or Edge.')
      return
    }
    setError(null)
    setTranscript('')
    if (modeRef.current === 'sr') {
      try { recognitionRef.current?.abort() } catch {}
    }
    cleanupServer()

    const SpeechRecognition = getSpeechRecognition()
    if (!canRecord()) {
      setError('Microphone recording is not supported in this browser. Try Chrome or Edge.')
      setIsListening(false)
      modeRef.current = 'idle'
      return
    }
    if (!SpeechRecognition) {
      startServerMode()
      return
    }

    modeRef.current = 'sr'
    setIsListening(true)

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = SPEECH_LANG[languageRef.current] || `${languageRef.current}-IN`
      recognition.maxAlternatives = 1

      recognition.onresult = (event: any) => {
        let finalTranscript = ''
        let interimTranscript = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += t
          } else {
            interimTranscript += t
          }
        }
        const display = finalTranscript || interimTranscript
        setTranscript(display)
        if (finalTranscript && onResultRef.current) {
          onResultRef.current(finalTranscript.trim())
        }
      }

      recognition.onend = () => {
        if (modeRef.current === 'sr') {
          setIsListening(false)
          modeRef.current = 'idle'
          retryCountRef.current = 0
        }
      }

      recognition.onerror = async (event: any) => {
        const err = event.error
        console.warn('Speech recognition error:', err)
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          setIsListening(false)
          modeRef.current = 'idle'
          setError('Microphone blocked. Click the lock icon in the address bar and allow microphone access, then try again. Or try Chrome instead of Edge.')
          retryCountRef.current = 0
        } else if (err === 'no-speech') {
          setIsListening(false)
          modeRef.current = 'idle'
          setError('Didn\'t hear anything. Tap the mic and try speaking again.')
          retryCountRef.current = 0
        } else if (err === 'aborted') {
          setError(null)
        } else {
          // network / audio-capture / language-not-supported -> fall back to server transcription
          setIsListening(false)
          modeRef.current = 'idle'
          retryCountRef.current = 0
          if (canRecord()) {
            startServerMode()
          } else if (err === 'network') {
            setError(isSecureContext()
              ? 'The browser\'s speech service couldn\'t be reached. If you use an ad-blocker or VPN, disable it for this site, or open the app in Google Chrome.'
              : 'Voice requires a secure origin. Serve the app over HTTPS (e.g. run the dev server with https enabled) or use a tunnel like ngrok.')
          } else {
            setError(`Voice error: ${err}. Try refreshing the page.`)
          }
        }
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (err) {
      setIsListening(false)
      modeRef.current = 'idle'
      retryCountRef.current = 0
      if (canRecord()) {
        startServerMode()
      } else {
        setError('Failed to start voice. Try refreshing the page.')
      }
    }
  }, [supported, startServerMode])

  const stop = useCallback(() => {
    if (modeRef.current === 'server') {
      stopServerRecording()
    } else {
      try {
        recognitionRef.current?.stop()
      } catch {}
      setIsListening(false)
      modeRef.current = 'idle'
    }
  }, [stopServerRecording])

  return { isListening, transcript, start, stop, supported, error }
}