import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, closeSocket, getToken, setToken, type User } from './api'

interface AuthState { user: User | null; ready: boolean; login: (u: string, p: string) => Promise<void>; logout: () => void }
const AuthContext = createContext<AuthState>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(!getToken())

  useEffect(() => {
    if (!getToken()) return
    api<User>('/api/me').then(setUser).catch(() => setToken(null)).finally(() => setReady(true))
  }, [])

  const login = async (username: string, password: string) => {
    const out = await api<{ token: string; user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
    setToken(out.token)
    setUser(out.user)
  }
  const logout = () => {
    setToken(null)
    closeSocket()
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, ready, login, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
