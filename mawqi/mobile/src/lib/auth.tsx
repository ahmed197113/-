import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, loadSession, setServer, setToken, type User } from './api'

interface AuthState {
  user: User | null
  ready: boolean
  login: (server: string, username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}
const AuthContext = createContext<AuthState>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    loadSession()
      .then(({ server, token }) => (server && token ? api<User>('/api/me').then(setUser) : undefined))
      .catch(() => undefined)
      .finally(() => setReady(true))
  }, [])

  const login = async (server: string, username: string, password: string) => {
    await setServer(server)
    const out = await api<{ token: string; user: User }>('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) })
    await setToken(out.token)
    setUser(out.user)
  }
  const logout = async () => {
    api('/api/logout', { method: 'POST' }).catch(() => undefined)
    await setToken(null)
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, ready, login, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
