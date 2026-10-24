import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

export type Role = 'admin' | 'sysadmin' | 'project_manager' | 'supervisor' | 'accountant'
export type Permission = 'projects' | 'projectsCreate' | 'workers' | 'moveWorkers' | 'attendance' | 'dailyReports' | 'issues' | 'invoices' | 'directOrders' | 'users' | 'delete' | 'costs'
export interface User { id: number; name: string; username: string; role: Role; roleLabel: string; permissions: Partial<Record<Permission, boolean>> }

export interface ProjectRow {
  id: number; name: string; city: string | null; planned_workers: number; progress: number; assigned: number
  supervisor: string | null; present: number; absent: number; open_issues: number
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
  alerts: Alert[]
}
export interface Meta { professions?: string[]; places?: { id: number; name: string; kind: string }[]; projects: { id: number; name: string; status: string; kind?: string }[]; users: { id: number; name: string; role: Role; active: number }[] }

export type AttStatus = 'present' | 'late' | 'overtime' | 'absent' | 'leave'
export interface AttRow { worker_id: number; name: string; profession: string; project_id: number; project: string; status: AttStatus | null; check_in: string | null; check_out: string | null; overtime_hours: number | null }

export interface Report {
  id: number; project_id: number; project: string; date: string; weather: string | null; work_done: string; next_plan: string | null
  equipment: string | null; materials: string | null; obstacles: string | null; progress: number | null; author: string | null
  present: number; absent: number; media?: import('./media').MediaFile[]
}
export type Severity = 'low' | 'medium' | 'high' | 'critical'
export interface Issue {
  id: number; project_id: number; project: string; title: string; description: string | null; category: string; severity: Severity
  status: 'open' | 'in_progress' | 'closed'; assignee: string | null; reporter: string | null; due_at: string | null
  created_at: string; resolution: string | null; overdue: number; media?: import('./media').MediaFile[]
}
export interface Worker {
  id: number; name: string; iqama_no: string; iqama_expiry: string; nationality: string; profession: string; phone: string | null
  wage_type: 'daily' | 'monthly'; wage: number; project_id: number | null; project: string | null; location_kind?: string | null; subcontractor: string | null; active: number
  days_present: number; days_absent: number; iqama_soon: number
  photo?: string | null; today?: AttStatus | null
}
export interface WorkerDetail extends Worker {
  renewals?: { id: number; date: string; amount: number; new_expiry: string | null; note: string | null; project: string | null }[]
  media?: import('./media').MediaFile[]
  attendance: { date: string; status: AttStatus; check_in: string | null; overtime_hours: number; project?: string | null }[]
  history: { from_date: string; to_date: string | null; project: string }[]
}
export interface Invoice {
  id: number; number: string; kind: 'client' | 'subcontractor'; project: string; subcontractor: string | null
  period_from: string | null; period_to: string | null; gross: number; retention: number; deductions: number; net: number; vat: number; total: number
  status: 'draft' | 'submitted' | 'approved' | 'paid' | 'rejected'
}
export interface DirectOrder {
  id: number; number: string; title: string; project: string; subcontractor: string | null; date: string; due_date: string | null
  status: 'open' | 'in_progress' | 'done' | 'cancelled'; value: number; done_value: number; items_count: number
}

export const DEFAULT_SERVER = 'https://app.metal-lines.com'
export const ALT_SERVER = 'https://metall.sg-host.com'

// SecureStore has no web implementation; the web preview keeps the token in AsyncStorage.
const secure = Platform.OS === 'web'
  ? { get: (k: string) => AsyncStorage.getItem(k), set: (k: string, v: string) => AsyncStorage.setItem(k, v), del: (k: string) => AsyncStorage.removeItem(k) }
  : { get: (k: string) => SecureStore.getItemAsync(k), set: (k: string, v: string) => SecureStore.setItemAsync(k, v), del: (k: string) => SecureStore.deleteItemAsync(k) }

const K = { server: 'mawqi.server', token: 'mawqi_token', user: 'mawqi.user' }
let server = ''
let token: string | null = null
let onUnauthorized: () => void = () => undefined

export async function loadSession() {
  server = (await AsyncStorage.getItem(K.server)) ?? ''
  token = await secure.get(K.token).catch(() => null)
  const raw = await AsyncStorage.getItem(K.user)
  return { server, token, user: raw ? (JSON.parse(raw) as User) : null }
}
export const getServer = () => server
export const getToken = () => token
/** A download link that opens in the phone's browser (it cannot send headers, so the token rides along). */
export const fileUrl = (path: string) => `${server}${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token ?? '')}`
export const normalizeServer = (url: string) => {
  let s = url.trim().replace(/\/+$/, '')
  if (s && !/^https?:\/\//.test(s)) s = `https://${s}`
  return s
}
export async function setServer(url: string) {
  server = normalizeServer(url)
  await AsyncStorage.setItem(K.server, server)
}
export async function saveSession(t: string | null, user: User | null) {
  token = t
  if (t) await secure.set(K.token, t)
  else await secure.del(K.token)
  if (user) await AsyncStorage.setItem(K.user, JSON.stringify(user))
  else await AsyncStorage.removeItem(K.user)
}
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn }

/** Thrown when the phone cannot reach the server at all (as opposed to the server refusing). */
export class OfflineError extends Error {
  offline = true
  constructor() { super('لا يوجد اتصال بالإنترنت أو الخادم غير متاح') }
}
export const isOffline = (e: unknown) => !!(e as OfflineError)?.offline

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase()
  // Shared hosting caches GET responses; a timestamp keeps every read fresh.
  const url = server + path + (method === 'GET' ? `${path.includes('?') ? '&' : '?'}_=${Date.now()}` : '')
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 20000)
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      signal: ctl.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token ?? ''}`, ...(init.headers as object) },
    })
  } catch {
    throw new OfflineError()
  } finally {
    clearTimeout(timer)
  }
  const body = await res.json().catch(() => ({}))
  if (res.status === 401 && path !== '/api/login') onUnauthorized()
  if (!res.ok) throw Object.assign(new Error(body.error || 'حدث خطأ في الخادم'), { status: res.status })
  return body as T
}

// ---------- formatting: Latin digits, Gregorian dates ----------
const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
export const fmt = (n: number) => num.format(n || 0)
export const sar = (n: number) => `${num.format(n || 0)} ر.س`
const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
// Hermes ships limited Arabic locale data, so dates are formatted by hand.
export function longDate(d: string) {
  const x = new Date(d.slice(0, 10) + 'T12:00:00Z')
  return `${days[x.getUTCDay()]} ${x.getUTCDate()} ${months[x.getUTCMonth()]} ${x.getUTCFullYear()}`
}
export const shortDate = (d: string) => `${Number(d.slice(8, 10))} ${months[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`
/** Today in Saudi time (the server's time zone), as YYYY-MM-DD. */
export const today = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10)
export function addDays(d: string, n: number) {
  const x = new Date(d + 'T12:00:00Z')
  x.setUTCDate(x.getUTCDate() + n)
  return x.toISOString().slice(0, 10)
}
