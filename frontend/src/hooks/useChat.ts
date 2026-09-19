import { useState, useCallback, useRef } from 'react'
import type { ChatMessage, ChatResponse } from '../types'
import { sendChat } from '../api'

interface UseChatReturn {
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  send: (text: string) => Promise<void>
  clear: () => void
}

let msgId = 0
function nextId() {
  return `msg-${Date.now()}-${++msgId}`
}

export function useChat(language: string, clientId: string): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const historyRef = useRef<{ role: string; content: string }[]>([])

  const send = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMsg: ChatMessage = {
      id: nextId(),
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)
    setError(null)

    historyRef.current.push({ role: 'user', content: text.trim() })
    if (historyRef.current.length > 16) {
      historyRef.current = historyRef.current.slice(-16)
    }

    try {
      const res: ChatResponse = await sendChat(text.trim(), language, clientId, historyRef.current)
      const assistantMsg: ChatMessage = {
        id: nextId(),
        role: 'assistant',
        content: res.answer,
        timestamp: Date.now(),
        tools: res.tools,
        offline: res.offline,
      }
      setMessages(prev => [...prev, assistantMsg])
      historyRef.current.push({ role: 'assistant', content: res.answer })
    } catch (err: any) {
      setError(err.message || 'Failed to get response')
    } finally {
      setIsLoading(false)
    }
  }, [language, clientId, isLoading])

  const clear = useCallback(() => {
    setMessages([])
    historyRef.current = []
    setError(null)
  }, [])

  return { messages, isLoading, error, send, clear }
}
