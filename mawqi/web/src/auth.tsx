import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, getToken, setToken, type Status, type User } from './api'

export interface SetupInput { companyName: string; name: string; username: string; password: string; demo: boolean }

interface AuthState {
  user: User | null
  status: Status | null
  ready: boolean
  login: (u: string, p: string) => Promise<void>
  setup: (input: SetupInput) => Promise<void>
  logout: () => void
}
const AuthContext = createContext<AuthState>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<Status | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Opened from inside the custody app: sign in with its one-time link, then drop it from the address.
    const sso = new URLSearchParams(window.location.search).get('sso')
    if (sso) window.history.replaceState(null, '', window.location.pathname + window.location.hash)
    const me = sso
      ? api<{ token: string; user: User }>('/api/auth/sso', { method: 'POST', body: JSON.stringify({ token: sso }) })
        .then((out) => { setToken(out.token); setUser(out.user) })
        .catch(() => (getToken() ? api<User>('/api/me').then(setUser).catch(() => setToken(null)) : undefined))
      : getToken() ? api<User>('/api/me').then(setUser).catch(() => setToken(null)) : Promise.resolve()
    Promise.all([api<Status>('/api/status').then(setStatus).catch(() => undefined), me]).finally(() => setReady(true))
  }, [])

  const start = (out: { token: string; user: User }) => {
    setToken(out.token)
    setUser(out.user)
  }
  const login = async (username: string, password: string) =>
    start(await api('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) }))
  const setup = async (input: SetupInput) => {
    start(await api('/api/setup', { method: 'POST', body: JSON.stringify(input) }))
    setStatus(await api<Status>('/api/status'))
  }
  const logout = () => {
    api('/api/logout', { method: 'POST' }).catch(() => undefined)
    setToken(null)
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, status, ready, login, setup, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
