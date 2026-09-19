import { useState, useRef, useCallback } from 'react'

interface UseVoiceReturn {
  isListening: boolean
  transcript: string
  start: () => void
  stop: () => void
  supported: boolean
  error: string | null
}

function getSpeechRecognition(): any {
  if (typeof window === 'undefined') return null
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null
}

function isSecureContext(): boolean {
  return window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}

export function useVoice(onResult?: (text: string) => void): UseVoiceReturn {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<any>(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult
  const retryCountRef = useRef(0)

  const supported = getSpeechRecognition() !== null

  const start = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      setError('Voice not supported in this browser. Try Chrome or Edge.')
      return
    }

    setError(null)
    setTranscript('')

    try {
      // Stop any existing session first
      if (recognitionRef.current) {
        try { recognitionRef.current.abort() } catch {}
      }

      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'en-IN'
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
        setIsListening(false)
        retryCountRef.current = 0
      }

      recognition.onerror = (event: any) => {
        const err = event.error
        console.warn('Speech recognition error:', err)
        setIsListening(false)

        if (err === 'not-allowed') {
          setError('Microphone blocked. Click the lock icon in the address bar and allow microphone access, then try again.')
          retryCountRef.current = 0
        } else if (err === 'no-speech') {
          setError('Didn\'t hear anything. Tap the mic and try speaking again.')
          retryCountRef.current = 0
        } else if (err === 'network') {
          // "network" = Google speech servers unreachable. Usually HTTP or firewall.
          if (!isSecureContext()) {
            setError('Voice requires HTTPS. Serve the app with HTTPS or use a tunnel like ngrok. Example: ngrok http 5173')
          } else {
            setError('Can\'t reach Google speech servers. Check your internet connection or try again in a moment.')
          }
          retryCountRef.current = 0
        } else if (err === 'aborted') {
          // User or code aborted — no error to show
          setError(null)
        } else if (err === 'service-not-allowed') {
          setError('Speech service blocked. Try Chrome or Edge browser.')
          retryCountRef.current = 0
        } else {
          setError(`Voice error: ${err}. Try refreshing the page.`)
          retryCountRef.current = 0
        }
      }

      recognitionRef.current = recognition
      recognition.start()
      setIsListening(true)
    } catch (err) {
      setError('Failed to start voice. Try refreshing the page.')
      setIsListening(false)
    }
  }, [])

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop()
    } catch {}
    setIsListening(false)
  }, [])

  return { isListening, transcript, start, stop, supported, error }
}
