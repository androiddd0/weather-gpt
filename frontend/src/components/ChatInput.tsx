import { useState, useRef, useEffect } from 'react'
import { useVoice } from '../hooks/useVoice'

interface Props {
  onSend: (text: string) => void
  language: string
  isLoading: boolean
}

export function ChatInput({ onSend, language, isLoading }: Props) {
  const [text, setText] = useState('')
  const [showError, setShowError] = useState(true)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { isListening, transcript, start, stop, supported, error } = useVoice(language, (result) => {
    onSend(result)
    setText('')
  })

  useEffect(() => {
    if (!isListening) inputRef.current?.focus()
  }, [isListening])

  useEffect(() => {
    if (error) setShowError(true)
  }, [error])

  const handleSubmit = () => {
    if (!text.trim() || isLoading) return
    onSend(text.trim())
    setText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="max-w-3xl mx-auto">
        {error && showError && (
          <div className="mb-2 glass rounded-xl px-3 py-2.5 flex items-start gap-2 border border-amber-500/30">
            <span className="flex-shrink-0 mt-0.5 text-sm">&#9888;&#65039;</span>
            <span className="flex-1 leading-relaxed text-xs text-white/80 font-medium">{error}</span>
            <button onClick={() => setShowError(false)} className="flex-shrink-0 text-white/40 hover:text-white/70 ml-1 text-sm">&#10005;</button>
          </div>
        )}
        <div className="glass-strong rounded-2xl px-3 py-2 shadow-xl flex items-end gap-2">
          {supported && (
            <button
              onClick={isListening ? stop : start}
              className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                isListening
                  ? 'bg-red-500 text-white mic-active shadow-lg shadow-red-500/30'
                  : 'bg-white/15 text-white/70 hover:bg-white/25'
              }`}
              title={isListening ? 'Stop listening' : 'Speak a question'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            </button>
          )}
          <textarea
            ref={inputRef}
            value={isListening ? transcript || '' : text}
            onChange={(e) => { if (!isListening) setText(e.target.value) }}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? 'Listening...' : 'Ask about the weather...'}
            rows={1}
            disabled={isListening}
            className="flex-1 resize-none bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none disabled:opacity-60 py-2 font-medium"
            style={{ minHeight: '40px', maxHeight: '120px' }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement
              t.style.height = 'auto'
              t.style.height = Math.min(t.scrollHeight, 120) + 'px'
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || isLoading}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/25 hover:bg-white/35 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
          >
            {isLoading ? (
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
