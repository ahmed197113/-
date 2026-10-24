import { addDays, today } from '../lib/api'
import { C } from './ui'

/** Expired, or expiring within 30 days. */
export function iqamaState(expiry: string) {
  if (expiry < today()) return { label: 'الإقامة منتهية', color: C.bad, bg: C.badBg }
  if (expiry <= addDays(today(), 30)) return { label: 'الإقامة تنتهي قريباً', color: '#8a5a00', bg: C.lateBg }
  return null
}
