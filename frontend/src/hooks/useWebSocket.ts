import { useEffect, useRef, useState, useCallback } from 'react'
import type { WeatherAlert } from '../types'

interface UseWebSocketReturn {
  connected: boolean
  lastAlert: WeatherAlert | null
}

export function useWebSocket(clientId: string): UseWebSocketReturn {
  const [connected, setConnected] = useState(false)
  const [lastAlert, setLastAlert] = useState<WeatherAlert | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const url = `${protocol}//${host}/ws?client_id=${encodeURIComponent(clientId)}`
    const ws = new WebSocket(url)

    ws.onopen = () => {
      setConnected(true)
      ws.send(JSON.stringify({ type: 'ping' }))
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'alert' && data.alert) {
          setLastAlert(data.alert)
        }
      } catch {}
    }

    ws.onclose = () => {
      setConnected(false)
      reconnectTimer.current = setTimeout(connect, 5000)
    }

    ws.onerror = () => {
      ws.close()
    }

    wsRef.current = ws
  }, [clientId])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { connected, lastAlert }
}
