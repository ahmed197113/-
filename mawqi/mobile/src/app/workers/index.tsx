import { useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { Worker } from '../../lib/api'
import { useData } from '../../lib/sync'
import { AppScreen } from '../../components/AppScreen'
import { iqamaState } from '../../components/iqama'
import { Badge, C, Chip, Empty, ErrorBox, Header, Loading, Row, Search, T } from '../../components/ui'

export default function Workers() {
  const { data, error, loading, refreshing, refresh } = useData<Worker[]>('/api/workers?active=1')
  const [q, setQ] = useState('')
  const [onlyIqama, setOnlyIqama] = useState(false)
  const [where, setWhere] = useState<'all' | 'factory' | 'none'>('all')

  const expiring = (data ?? []).filter((w) => iqamaState(w.iqama_expiry)).length
  const shown = useMemo(() => {
    const t = q.trim()
    return (data ?? []).filter((w) => (!onlyIqama || iqamaState(w.iqama_expiry)) &&
      (where === 'all' || (where === 'factory' ? w.location_kind === 'factory' : !w.project_id)) &&
      (!t || w.name.includes(t) || w.iqama_no.includes(t) || (w.profession ?? '').includes(t) || (w.project ?? '').includes(t)))
  }, [data, q, onlyIqama, where])

  return (
    <AppScreen scroll={false} header={<Header title="العمال" sub={data ? `${data.length} عامل نشط` : undefined} onBack={() => router.back()} />}>
      <FlatList
        data={shown}
        keyExtractor={(w) => String(w.id)}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[C.navy]} />}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 4 }}>
            <Search value={q} onChangeText={setQ} placeholder="ابحث بالاسم أو رقم الإقامة أو المهنة" />
            <Row>
              <Chip label="كل العمال" active={where === 'all'} onPress={() => setWhere('all')} />
              <Chip label="🏭 المصنع" active={where === 'factory'} onPress={() => setWhere('factory')} color={C.amber} />
              <Chip label="غير موزّع" active={where === 'none'} onPress={() => setWhere('none')} />
            </Row>
            {expiring > 0 && (
              <Row>
                <Chip label="الكل" active={!onlyIqama} onPress={() => setOnlyIqama(false)} />
                <Chip label={`إقامات تنتهي (${expiring})`} active={onlyIqama} onPress={() => setOnlyIqama(true)} color={C.bad} />
              </Row>
            )}
          </View>
        }
        ListEmptyComponent={!data ? (loading ? <Loading /> : <ErrorBox text={error ?? ''} onRetry={refresh} />)
          : <Empty icon="people-outline" title={q ? 'لا توجد نتائج' : 'لا يوجد عمال'} sub={q ? `لا يوجد عامل يطابق «${q}»` : undefined} />}
        renderItem={({ item: w }) => {
          const iq = iqamaState(w.iqama_expiry)
          return (
            <Pressable onPress={() => router.push(`/workers/${w.id}`)} style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}>
              <View style={s.avatar}><T w="black" style={{ color: C.navy, fontSize: 20 }}>{w.name.trim()[0]}</T></View>
              <View style={{ flex: 1, gap: 2 }}>
                <T w="bold" style={{ fontSize: 17 }} numberOfLines={1}>{w.name}</T>
                <T style={{ color: C.muted, fontSize: 14 }} numberOfLines={1}>{w.profession} · {w.project ? `${w.location_kind === 'factory' ? '🏭 ' : ''}${w.project}` : 'غير موزّع'}</T>
                {iq && <View style={{ alignSelf: 'flex-start', marginTop: 4 }}><Badge label={`${iq.label} ${w.iqama_expiry}`} color={iq.color} bg={iq.bg} /></View>}
              </View>
              <Ionicons name="chevron-back" size={22} color={C.muted} />
            </Pressable>
          )
        }}
      />
    </AppScreen>
  )
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 12, minHeight: 72 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.navySoft, alignItems: 'center', justifyContent: 'center' },
})
