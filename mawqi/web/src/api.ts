export type Role = 'admin' | 'project_manager' | 'supervisor' | 'accountant'
export interface User { id: number; name: string; username: string; role: Role; roleLabel: string; permissions: Record<string, boolean> }

export interface ProjectRow {
  id: number; name: string; city: string; planned_workers: number; progress: number
  start_date: string; end_date: string; supervisor: string; manager: string
  assigned: number; present: number; absent: number; open_issues: number
  cost_today: number; cost_month: number
}
export interface Alert {
  type: 'understaffed' | 'absence_streak' | 'overdue_issue' | 'iqama_expiry'
  level: 'high' | 'medium' | 'low'; title: string; detail: string
}
export interface Dashboard {
  date: string; generatedAt: string
  cards: {
    totalWorkers: number; presentToday: number; absentToday: number; onLeaveToday: number
    notRecorded: number; openIssues: number; costToday: number; costMonth: number
  }
  projects: ProjectRow[]
  attendanceSeries: { date: string; present: number; late: number; absent: number; leave: number }[]
  alerts: Alert[]
}

const TOKEN_KEY = 'mawqi.token'
export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string | null) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY))

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${getToken() ?? ''}`, ...init.headers },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(body.error || 'تعذر الاتصال بالخادم'), { status: res.status })
  return body as T
}

export interface Status { needsSetup: boolean; companyName: string; version: number }

const num = new Intl.NumberFormat('ar-SA-u-nu-latn', { maximumFractionDigits: 0 })
export const fmt = (n: number) => num.format(n)
export const sar = (n: number) => `${num.format(n)} ر.س`
const num2 = new Intl.NumberFormat('ar-SA-u-nu-latn', { maximumFractionDigits: 2 })
export const sar2 = (n: number) => `${num2.format(n)} ر.س`
export const compact = (n: number) => (Math.abs(n) >= 1e6 ? `${num2.format(n / 1e6)} مليون` : Math.abs(n) >= 1e4 ? `${num.format(n / 1e3)} ألف` : num.format(n))
export const shortDate = (d: string) =>
  new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'short' }).format(new Date(d + 'T12:00:00'))
export const longDate = (d: string) =>
  new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d + 'T12:00:00'))
