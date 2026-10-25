import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'

const POLL_MS = 8000

/**
 * Loads `path` and keeps it in sync with the company server. Shared hosting has no
 * WebSockets, so the page polls the cheap /api/version counter and reloads only when it changes.
 */
export function useLive<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const version = useRef<number | null>(null)
  const current = useRef(path)
  current.current = path

  const load = useCallback(async () => {
    try {
      const d = await api<T>(path)
      if (current.current !== path) return // a newer filter was chosen meanwhile
      setData(d)
      setError(null)
      setUpdatedAt(new Date())
    } catch (e) {
      setError((e as Error).message)
    }
  }, [path])

  useEffect(() => {
    let alive = true
    // A new path (another project, date or month) must load right away, not wait for a server change.
    version.current = null
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
    const timer = window.setInterval(() => { if (!document.hidden) check() }, POLL_MS)
    const onVisible = () => { if (!document.hidden) check() }
    const onChanged = () => { load() }
    window.addEventListener('mawqi:changed', onChanged)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      alive = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
      window.removeEventListener('mawqi:changed', onChanged)
    }
  }, [load])

  return { data, error, connected, updatedAt, reload: load }
}
