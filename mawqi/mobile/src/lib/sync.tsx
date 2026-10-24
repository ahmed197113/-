import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import { api, isOffline } from './api'
import { useToast } from '../components/Toast'

const POLL_MS = 8000
const QUEUE_KEY = 'mawqi.queue'

/** A write made while offline, replayed in order once the server is reachable. */
export interface Pending { id: string; method: 'POST' | 'PUT'; path: string; body: unknown; label: string; at: number }

interface SyncState {
  /** Server reachable on the last check. */
  online: boolean
  /** Changes whenever the server's data changed; screens reload when it moves. */
  version: number
  queue: Pending[]
  /** Re-check the server now (after a save or on pull-to-refresh). */
  poke: () => void
  /**
   * Sends a change. When the phone is offline it is kept in the local queue and sent later.
   * Returns 'sent' or 'queued'; server-side errors are thrown with the server's Arabic message.
   */
  send: (method: Pending['method'], path: string, body: unknown, label: string) => Promise<'sent' | 'queued'>
}
const SyncContext = createContext<SyncState>(null!)

export function SyncProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [online, setOnline] = useState(true)
  const [version, setVersion] = useState(0)
  const [queue, setQueue] = useState<Pending[]>([])
  const serverVersion = useRef<number | null>(null)
  const queueRef = useRef<Pending[]>([])
  const flushing = useRef(false)

  const saveQueue = useCallback((q: Pending[]) => {
    queueRef.current = q
    setQueue(q)
    AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q)).catch(() => undefined)
  }, [])

  const flush = useCallback(async () => {
    if (flushing.current || !queueRef.current.length) return
    flushing.current = true
    let sent = 0
    try {
      while (queueRef.current.length) {
        const [item, ...rest] = queueRef.current
        try {
          await api(item.path, { method: item.method, body: JSON.stringify(item.body) })
          sent++
        } catch (e) {
          if (isOffline(e)) break
          // The server refused it (e.g. a duplicate report); drop it and say why.
          toast(`تعذر إرسال «${item.label}»: ${(e as Error).message}`, 'error')
        }
        saveQueue(rest)
      }
    } finally {
      flushing.current = false
    }
    if (sent) {
      toast(`تم إرسال ${sent} من العمليات المحفوظة`)
      setVersion((v) => v + 1)
    }
  }, [saveQueue, toast])

  const check = useCallback(async () => {
    try {
      const { version: v } = await api<{ version: number }>('/api/version')
      setOnline(true)
      if (queueRef.current.length) await flush()
      if (serverVersion.current !== v) {
        serverVersion.current = v
        setVersion((x) => x + 1)
      }
    } catch (e) {
      if (isOffline(e)) setOnline(false)
    }
  }, [flush])

  useEffect(() => {
    AsyncStorage.getItem(QUEUE_KEY).then((raw) => { if (raw) saveQueue(JSON.parse(raw)) }).catch(() => undefined)
  }, [saveQueue])

  useEffect(() => {
    let active = AppState.currentState === 'active'
    check()
    // Shared hosting has no WebSockets: poll the cheap version counter, only while the app is in front.
    const timer = setInterval(() => { if (active) check() }, POLL_MS)
    const app = AppState.addEventListener('change', (s) => {
      active = s === 'active'
      if (active) check()
    })
    const net = NetInfo.addEventListener((s) => {
      if (s.isConnected === false) setOnline(false)
      else if (s.isConnected) check()
    })
    return () => {
      clearInterval(timer)
      app.remove()
      net()
    }
  }, [check])

  const send = useCallback<SyncState['send']>(async (method, path, body, label) => {
    try {
      await api(path, { method, body: JSON.stringify(body) })
      setOnline(true)
      check()
      return 'sent'
    } catch (e) {
      if (!isOffline(e)) throw e
      setOnline(false)
      saveQueue([...queueRef.current, { id: `${Date.now()}-${Math.random()}`, method, path, body, label, at: Date.now() }])
      return 'queued'
    }
  }, [check, saveQueue])

  return <SyncContext.Provider value={{ online, version, queue, poke: check, send }}>{children}</SyncContext.Provider>
}

export const useSync = () => useContext(SyncContext)

const cacheKey = (path: string) => `mawqi.cache:${path}`

/**
 * Loads `path`, shows the last saved copy straight away (also when offline),
 * and reloads whenever the server's data version changes.
 */
export function useData<T>(path: string | null) {
  const { version, poke } = useSync()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const current = useRef(path)
  current.current = path

  const load = useCallback(async () => {
    if (!path) return
    try {
      const d = await api<T>(path)
      if (current.current !== path) return
      setData(d)
      setError(null)
      AsyncStorage.setItem(cacheKey(path), JSON.stringify(d)).catch(() => undefined)
    } catch (e) {
      if (current.current === path) setError((e as Error).message)
    } finally {
      if (current.current === path) setLoading(false)
    }
  }, [path])

  // A new path: show its cached copy (if any) while the live one loads.
  useEffect(() => {
    if (!path) return
    setLoading(true)
    setData(null)
    setError(null)
    AsyncStorage.getItem(cacheKey(path)).then((raw) => {
      if (raw && current.current === path) setData((d) => d ?? JSON.parse(raw))
    }).catch(() => undefined)
  }, [path])

  useEffect(() => { load() }, [load, version])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    poke()
    await load()
    setRefreshing(false)
  }, [load, poke])

  return { data, error, loading, refreshing, refresh, reload: load }
}
