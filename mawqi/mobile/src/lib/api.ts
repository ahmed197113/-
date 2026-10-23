import AsyncStorage from '@react-native-async-storage/async-storage'
import { io, type Socket } from 'socket.io-client'

export type Role = 'admin' | 'project_manager' | 'supervisor' | 'accountant'
export interface User { id: number; name: string; username: string; role: Role; roleLabel: string }

export interface ProjectRow {
  id: number; name: string; city: string; planned_workers: number; progress: number
  supervisor: string; present: number; absent: number; open_issues: number
  cost_today: number; cost_month: number
}
export interface Alert {
  type: 'understaffed' | 'absence_streak' | 'overdue_issue' | 'iqama_expiry'
  level: 'high' | 'medium' | 'low'; title: string; detail: string
}
export interface Dashboard {
  date: string
  cards: {
    totalWorkers: number; presentToday: number; absentToday: number; onLeaveToday: number
    notRecorded: number; openIssues: number; costToday: number; costMonth: number
  }
  projects: ProjectRow[]
  attendanceSeries: { date: string; present: number; late: number; absent: number; leave: number }[]
  alerts: Alert[]
}

const K = { server: 'mawqi.server', token: 'mawqi.token' }
// The company server address is set once on the login screen and remembered.
let server = ''
let token: string | null = null

export async function loadSession() {
  const [[, s], [, t]] = await AsyncStorage.multiGet([K.server, K.token])
  server = s ?? ''
  token = t
  return { server, token }
}
export const getServer = () => server
export async function setServer(url: string) {
  server = url.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//.test(server)) server = `http://${server}`
  await AsyncStorage.setItem(K.server, server)
}
export async function setToken(t: string | null) {
  token = t
  if (t) await AsyncStorage.setItem(K.token, t)
  else await AsyncStorage.removeItem(K.token)
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(server + path, {
      ...init,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token ?? ''}`, ...(init.headers as object) },
    })
  } catch {
    throw new Error('تعذر الوصول إلى خادم الشركة — تحقق من الاتصال')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(body.error || 'حدث خطأ في الخادم'), { status: res.status })
  return body as T
}

let socket: Socket | null = null
let socketKey = ''
/** One shared real-time connection, rebuilt if the server address or login changes. */
export function liveSocket(): Socket {
  const key = `${server}|${token}`
  if (socket && socketKey !== key) closeSocket()
  if (!socket) {
    socket = io(server, { auth: { token }, transports: ['websocket'] })
    socketKey = key
  }
  return socket
}
export function closeSocket() {
  socket?.disconnect()
  socket = null
}

const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
export const fmt = (n: number) => num.format(n)
export const sar = (n: number) => `${num.format(n)} ر.س`
const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
// Hermes ships limited Arabic locale data, so dates are formatted by hand.
export function longDate(d: string) {
  const x = new Date(d + 'T12:00:00Z')
  return `${days[x.getUTCDay()]}، ${x.getUTCDate()} ${months[x.getUTCMonth()]} ${x.getUTCFullYear()}`
}
export const shortDate = (d: string) => `${Number(d.slice(8))} ${months[Number(d.slice(5, 7)) - 1]}`
