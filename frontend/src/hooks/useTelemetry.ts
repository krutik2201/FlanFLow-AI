import { useEffect, useRef, useState } from 'react'
import type { TelemetrySnapshot } from '../api/client'

const BASE_WS = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000'

export function useTelemetry() {
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    let ws: WebSocket
    let reconnectTimeout: ReturnType<typeof setTimeout>

    const connect = () => {
      try {
        ws = new WebSocket(`${BASE_WS}/ws/telemetry`)
        wsRef.current = ws

        ws.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data) as TelemetrySnapshot
            setSnapshot(data)
          } catch { /* ignore parse errors */ }
        }

        ws.onclose = () => {
          // Reconnect after 5 seconds
          reconnectTimeout = setTimeout(connect, 5000)
        }
      } catch { /* ignore connection errors */ }
    }

    connect()
    return () => {
      clearTimeout(reconnectTimeout)
      wsRef.current?.close()
    }
  }, [])

  return snapshot
}
