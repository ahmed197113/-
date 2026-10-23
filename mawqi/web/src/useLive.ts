import { useCallback, useEffect, useRef, useState } from 'react'
import { api, liveSocket } from './api'

/** Loads `path` and reloads it whenever the server pushes a change. */
export function useLive<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const load = useCallback(() => {
    api<T>(path)
      .then((d) => { setData(d); setError(null); setUpdatedAt(new Date()) })
      .catch((e: Error) => setError(e.message))
  }, [path])

  useEffect(() => {
    load()
    const s = liveSocket()
    // Bursts of changes (e.g. a whole crew checked in) collapse into one reload.
    const onChange = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(load, 300) }
    const onConnect = () => { setConnected(true); load() }
    const onDisconnect = () => setConnected(false)
    setConnected(s.connected)
    s.on('data:changed', onChange)
    s.on('connect', onConnect)
    s.on('disconnect', onDisconnect)
    return () => {
      s.off('data:changed', onChange)
      s.off('connect', onConnect)
      s.off('disconnect', onDisconnect)
      window.clearTimeout(timer.current)
    }
  }, [load])

  return { data, error, connected, updatedAt, reload: load }
}
