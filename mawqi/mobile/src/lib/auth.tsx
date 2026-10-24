import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, isOffline, loadSession, saveSession, setServer, setUnauthorizedHandler, type Permission, type User } from './api'

interface AuthState {
  user: User | null
  ready: boolean
  can: (p: Permission) => boolean
  login: (server: string, username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}
const AuthContext = createContext<AuthState>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  const logout = useCallback(async () => {
    api('/api/logout', { method: 'POST' }).catch(() => undefined)
    await saveSession(null, null)
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => { saveSession(null, null).then(() => setUser(null)) })
    loadSession()
      .then(async ({ server, token, user: saved }) => {
        if (!server || !token) return
        // Open with the saved account straight away so the app works without a network.
        if (saved) setUser(saved)
        try {
          const me = await api<User>('/api/me')
          setUser(me)
          await saveSession(token, me)
        } catch (e) {
          if (!isOffline(e) && !saved) setUser(null)
        }
      })
      .catch(() => undefined)
      .finally(() => setReady(true))
  }, [])

  const login = async (server: string, username: string, password: string) => {
    await setServer(server)
    const out = await api<{ token: string; user: User }>('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) })
    await saveSession(out.token, out.user)
    setUser(out.user)
  }

  const can = (p: Permission) => !!user?.permissions?.[p]

  return <AuthContext.Provider value={{ user, ready, can, login, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
