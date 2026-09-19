import { useEffect, useRef } from 'react'
import type { ChatMessage } from '../types'
import { MessageBubble } from './MessageBubble'

interface Props {
  messages: ChatMessage[]
  isLoading: boolean
}

export function ChatPanel({ messages, isLoading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-sm fade-in">
          <div className="w-24 h-24 mx-auto mb-6 rounded-[1.5rem] wx-clear flex items-center justify-center shadow-2xl shadow-sky-500/30">
            <span className="text-5xl drop-shadow-lg">🌤️</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white dark:text-white mb-2 tracking-tight drop-shadow-sm">
            WeatherGPT
          </h2>
          <p className="text-sm text-white/60 dark:text-white/50 mb-8 leading-relaxed font-medium">
            Ask about weather, forecasts, air quality, or alerts for any Indian city.
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { text: 'Weather in Delhi', icon: '🌡️' },
              { text: 'Mumbai 5-day forecast', icon: '📅' },
              { text: 'Is it raining in London?', icon: '🌧️' },
              { text: 'AQI in Tokyo', icon: '💨' },
              { text: 'Sunrise in New York', icon: '🌅' },
              { text: 'Storm alert in Dubai', icon: '⛈️' },
            ].map((q) => (
              <button
                key={q.text}
                onClick={() => window.dispatchEvent(new CustomEvent('weathergpt-suggestion', { detail: q.text }))}
                className="glass-strong rounded-2xl px-4 py-3.5 text-left hover:bg-white/40 dark:hover:bg-white/15 transition-all duration-200 shadow-lg"
              >
                <span className="text-lg block mb-1">{q.icon}</span>
                <span className="text-xs font-semibold text-white dark:text-white/90">{q.text}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4">
      <div className="max-w-3xl mx-auto py-2">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} content={msg.content} role={msg.role} tools={msg.tools} offline={msg.offline} />
        ))}
        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="glass rounded-2xl rounded-bl-md px-4 py-3 fade-in">
              <div className="flex items-center gap-2.5">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-white/60 font-medium">Fetching weather...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
