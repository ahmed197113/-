import { useCallback, useEffect, useRef, useState } from 'react'
import { api, liveSocket } from './api'

/** Loads `path` and reloads it whenever the company server pushes a change. */
export function useLive<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const load = useCallback(async () => {
    try {
      setData(await api<T>(path))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [path])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  useEffect(() => {
    load()
    const s = liveSocket()
    const onChange = () => { clearTimeout(timer.current); timer.current = setTimeout(load, 300) }
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
      clearTimeout(timer.current)
    }
  }, [load])

  return { data, error, connected, refreshing, refresh }
}
