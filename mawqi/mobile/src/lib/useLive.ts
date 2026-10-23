import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { api } from './api'

const POLL_MS = 8000

/**
 * Loads `path` and keeps it in sync with the company server. Shared hosting has no
 * WebSockets, so the app polls the cheap /api/version counter and reloads only when it changes.
 */
export function useLive<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const version = useRef<number | null>(null)

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
    let alive = true
    let active = AppState.currentState === 'active'
    const check = async () => {
      try {
        const { version: v } = await api<{ version: number }>('/api/version')
        if (!alive) return
        setConnected(true)
        if (version.current !== v) {
          version.current = v
          await load()
        }
      } catch {
        if (alive) setConnected(false)
      }
    }
    check()
    // Polling pauses while the app is in the background and catches up when it returns.
    const timer = setInterval(() => { if (active) check() }, POLL_MS)
    const sub = AppState.addEventListener('change', (s) => {
      active = s === 'active'
      if (active) check()
    })
    return () => {
      alive = false
      clearInterval(timer)
      sub.remove()
    }
  }, [load])

  return { data, error, connected, refreshing, refresh }
}
