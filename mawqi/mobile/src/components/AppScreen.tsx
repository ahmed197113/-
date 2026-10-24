import type { ComponentProps } from 'react'
import { StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSync } from '../lib/sync'
import { C, Screen, T } from './ui'

/** Offline notice and the count of changes waiting to be sent. */
export function NetBanner() {
  const { online, queue } = useSync()
  if (online && !queue.length) return null
  return (
    <View style={[s.bar, { backgroundColor: online ? C.lateBg : C.badBg }]}>
      <Ionicons name={online ? 'cloud-upload-outline' : 'cloud-offline-outline'} size={22} color={online ? '#8a5a00' : C.bad} />
      <T w="bold" style={{ flex: 1, color: online ? '#8a5a00' : C.bad, fontSize: 15 }}>
        {online ? 'جارٍ إرسال البيانات المحفوظة…' : 'لا يوجد اتصال — تُعرض آخر بيانات محفوظة'}
      </T>
      {!!queue.length && (
        <View style={s.pill}><T w="bold" style={{ color: '#fff', fontSize: 13 }}>بانتظار الإرسال ({queue.length})</T></View>
      )}
    </View>
  )
}

export function AppScreen(p: Omit<ComponentProps<typeof Screen>, 'banner'>) {
  return <Screen {...p} banner={<NetBanner />} />
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  pill: { backgroundColor: C.amber, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
})
